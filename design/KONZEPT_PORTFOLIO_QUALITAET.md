# Konzept: Portfolio-Qualität (Redesign «Portfolio-Qualitäts-History»)

Stand: 2026-07-16 · Status: **Konzept, zur Umsetzung freigegeben in Etappen (E0–E3)**

Grundlage: Feature-Stand nach Commits `0330dd0`/`c03e7d0`/`887d08c`
(`PortfolioQualityHistory.tsx`, `portfolioMetricsSnapshotScheduled.ts`,
`dashboard.getPortfolioMetricsHistory`) + Review-Input (Qualitätsmodell,
KPI-Karten, Small Multiples, Trajektorien-Pfad) + Code-Audit der Datenpipeline.

---

## 1. Ziel und Leitprinzipien

Aus einer «Sammlung von Linien» wird eine **Portfolio-Diagnose mit Handlungsaussage**:
*Wie gut ist mein Portfolio, hat es sich verbessert, und was hat die Optimierung gebracht?*

Verbindliche Prinzipien (aus dem Audit 2026-07, gelten unverändert):

1. **Keine erfundenen Daten.** Was historisch nicht existiert, wird nicht als
   Verlauf gezeichnet. Linien beginnen dort, wo echte Daten beginnen.
2. **Eine Wahrheit pro Kennzahl.** Sharpe, Beta, PEG etc. werden überall in der
   App gleich definiert und gleich berechnet (gleiche Datenquelle, gleicher
   risikofreier Zins 2 %, gleiches Fenster). Keine Parallel-Implementierungen.
3. **Lesbarkeit 50+.** Achsen/Labels min. 12 px, eine Aussage pro Grafik, keine
   Doppel-Y-Achsen, Fachbegriffe mit Klartext-Tooltip.
4. **Brutto/Netto und Näherungen kennzeichnen** (Dividendenrendite brutto,
   gewichteter Einzeltitel-Durchschnitt ≠ Portfolio-Kennzahl → Label sagt, was es ist).

---

## 2. Etappe 0 — Datenfundament reparieren (Blocker, vor allem anderen)

Die aktuelle Snapshot-Pipeline liefert teilweise falsche und teilweise erfundene
Zahlen. Politur auf diesem Fundament wäre verschwendet.

### E0.1 Bekannte Defekte im Snapshot-Job (`portfolioMetricsSnapshotScheduled.ts`)

| # | Defekt | Fix |
|---|--------|-----|
| D1 | `historicalPrices.adjustedClose ?? historicalPrices.close` vergleicht Drizzle-Spaltenobjekte, nie Werte → es wird immer `adjustedClose` selektiert; Titel mit `NULL` fallen komplett aus der Berechnung (erklärt die Sprünge/Spikes am rechten Rand, z. B. «Sharpe 4.27»). | SQL-`COALESCE(adjusted_close, close)`. |
| D2 | Tagesgewichte aus `close × shares` **ohne CHF-Umrechnung**; GBp-Titel (Pence) wären ~100× übergewichtet. | `convertToCHF`/`getFxRate` wie in `holdings.ts` (R-10-Konvention); GBp→GBP-Normalisierung. |
| D3 | Sharpe-Fenster ist «alles seit Cutoff» statt rollierend; am linken Rand nur ≥ 20 Punkte → wilde Ausschläge sind Fenster-Artefakte. Risikofrei = 0 % statt 2 % wie überall sonst. | Rollierendes 252-Tage-Fenster, `DEFAULT_RISK_FREE_RATE = 0.02` aus `riskStats.ts`, Mindesthistorie ehrlich als `null`. |
| D4 | «Ø Sharpe» ist ein gewichteter Durchschnitt der Einzeltitel-Sharpes — das ist **nicht** die Portfolio-Sharpe (Diversifikationseffekt fehlt). | Portfolio-Kennzahlen (Sharpe, Sortino, Volatilität, Max Drawdown) aus der historisch korrekten **Portfolio-Wertreihe** des `performanceService` berechnen (dieselbe Quelle wie der QuantStats-Tearsheet). |
| D5 | Beta wird nicht berechnet: Code baut Renditen auf, verwirft sie und nimmt das **heutige** DB-Beta für alle historischen Tage; negative Betas werden gefiltert (`b > 0`) — fachlich falsch. | Ehrlich machen: Beta als gewichteter Durchschnitt der Einzeltitel-Betas **nur für heute** ausweisen (Label «aktuell»); toten Berechnungscode entfernen; Filter `b > 0` streichen. |
| D6 | **Backfill erfindet Fundamental-History:** PEG/PE/Dividende der letzten 365 Tage sind die heutigen Werte mit historischen Gewichten → flache Linien, die «Stabilität» vortäuschen; im Streudiagramm klebt die ganze Historie bei PEG ≈ 2.8. | Fundamentaldaten **nicht mehr backfillen**. Sie akkumulieren ab Einführung ehrlich Tag für Tag. Rückwirkend nur, was aus Kursen echt berechenbar ist (E0.2). |

### E0.2 Datenmigration

- Bestehende Snapshots (~6'984 Zeilen) sind durch D1+D2+D6 verunreinigt →
  **löschen und neu backfillen**, aber nur die kursbasierten Spalten
  (Sharpe/Sortino/Volatilität/Drawdown/Wert/Positionszahl aus Wertreihe + FX-korrekt).
  Fundamental-Spalten (PEG/PE/Dividende/Beta) bleiben für Vergangenheits-Tage `NULL`.
- Neue Spalte `source: 'live' | 'backfill'` pro Snapshot, damit die UI
  rekonstruierte Punkte kennzeichnen kann.
- Der Chart zeigt `null` als Lücke (Linie beginnt später) — **nicht** `connectNulls`.

**Akzeptanz E0:** Kein Sprung >|1.0| in Ø-Sharpe zwischen zwei Handelstagen ohne
Transaktion; Stichproben-Portfolio mit USD/GBp-Titeln hat plausible Gewichte;
Sharpe im Chart == Sharpe im Tearsheet (gleicher Tag, ±0.05); PEG-Linie beginnt
erst am Einführungsdatum.

---

## 3. Etappe 1 — Qualitätsmodell: Portfolio Quality Score (0–100)

Ein Score macht «Qualität» greifbar. Er wird **deterministisch und dokumentiert**
berechnet (kein LLM), serverseitig im Snapshot-Job, und pro Tag gespeichert —
damit ist seine Historie ab Einführung echt.

### 3.1 Komponenten (v1 — nur mit heute real vorhandenen Daten)

| Komponente | Gewicht | Kennzahlen (Quelle) |
|---|---|---|
| Risikoadjustierte Rendite | 30 % | Portfolio-Sharpe, Sortino, Max Drawdown (Wertreihe `performanceService`) |
| Bewertung | 25 % | Ø Forward-PEG bzw. PEG, Ø Forward-PE (`qualityMetricsService`/`stocks`), Anteil Titel PEG < 1.5, Anteil Titel PEG > 3 |
| Risiko | 20 % | Volatilität p.a. (Wertreihe), Ø Beta (Einzeltitel, «aktuell»), Konzentration (HHI der Positionsgewichte) |
| Ertrag | 15 % | Ø Dividendenrendite **brutto** (gewichtet) |
| Diversifikation | 10 % | Sektor-HHI, Fremdwährungsanteil, Anzahl Positionen vs. Zielband |

Bewusst **weggelassen in v1** (Datenlage, ehrlich statt geschätzt):
Faktor-Exposure, Gewinnrevisions-Trend, Dividendenstabilität/-wachstum,
FCF-Yield. → Kandidaten für v2, sobald EODHD-Extraktion dafür gebaut ist
(FCF und Dividenden-Historie sind über EODHD beschaffbar; Revisions-Trend nicht).

### 3.2 Berechnungsregeln

- Jede Kennzahl wird über dokumentierte Schwellen auf 0–100 abgebildet
  (z. B. Sharpe: ≤0 → 0 Pkt · 0.5 → 40 · 1.0 → 70 · ≥1.5 → 100; Zwischenwerte
  linear). Schwellen als Konstanten in einem neuen `server/lib/portfolioQualityScore.ts`,
  pure Funktion, vollständig unit-getestet.
- **Fehlende Kennzahl → Komponente wird nicht erfunden**, sondern die übrigen
  Komponenten werden renormalisiert; zusätzlich wird eine **Datenabdeckung in %**
  ausgewiesen («Score basiert auf 82 % der Kennzahlen»). Kein stilles Neutral-50.
- Konsistenz: Einzeltitel-Bewertungs-Inputs kommen aus denselben Quellen wie der
  bestehende Titel-`qualityScore` (Signal-Cache/`qualityMetricsService`) — kein
  zweites Bewertungsuniversum (Prinzip «eine Wahrheit pro Score»).
- Speicherung: neue Spalten in `portfolioMetricsSnapshot`:
  `qualityScore` (int), `qualityComponents` (JSON: Punktzahl + Inputs je Komponente),
  `dataCoveragePct`, plus kursbasierte Neuzugänge `volatility`, `maxDrawdown`, `sortino`.

### 3.3 PEG nicht isoliert (Bewertungsmodul)

Der Ø-PEG allein kann täuschen (überoptimistische Gewinnschätzungen drücken das
PEG). Das Bewertungs-Panel zeigt deshalb zusammen:

- Ø Forward-PEG (bevorzugt) bzw. Ø PEG mit Kennzeichnung, Ø Forward-PE
- Verteilung: «X von Y Titeln PEG < 1.5 · Z Titel PEG > 3» (mit Ticker-Nennung im Tooltip)
- Hinweistext, wenn Ø-PEG < 1: «Tiefer PEG kann auch überhöhte Gewinnschätzungen
  bedeuten — Verteilung prüfen.»

**Akzeptanz E1:** Score reproduzierbar (gleiche Inputs → gleicher Score, Unit-Tests
je Komponente inkl. Fehlende-Daten-Renormalisierung); Score-Historie beginnt am
Einführungstag; `qualityComponents` erklärt jeden Punktwert nachvollziehbar.

---

## 4. Etappe 2 — Darstellung (Client-Redesign)

Neuer Name der Sektion: **«Portfolio-Qualität»** (statt «Qualitäts-History»).
Aufbau in drei Zeilen:

### 4.1 Obere Zeile: KPI-Karten

6 Karten, grosse Zahl + Delta (Pfeil, Vergleich zu vor 30 Tagen bzw. letzter Optimierung):

| Karte | Anzeige | Anmerkung |
|---|---|---|
| Quality Score | «82/100 · +14» | mit Datenabdeckungs-Hinweis, Tooltip erklärt Komponenten |
| Sharpe | 1.45 · +0.85 | Portfolio-Sharpe (Wertreihe), Tooltip: «> 1 = gut» |
| Max Drawdown | −8.2 % | intuitivste Risikozahl für die Zielgruppe |
| Beta | 0.84 («aktuell») | Label ehrlich: Einzeltitel-Durchschnitt, heutiger Stand |
| Ø Forward-PEG | 1.0 | mit Verteilungshinweis («2 Titel > 3») |
| Dividendenrendite | 4.27 % brutto | Brutto-Kennzeichnung wie überall |

Delta erst anzeigen, wenn echte Vergleichsdaten existieren (sonst «—», kein 0).

### 4.2 Mittlere Zeile: Entwicklung als thematische Small Multiples

Statt 1 Chart mit 4 Linien / 2 Achsen → **3 Panels, je eigene Skala, keine
Doppelachse, eine Legende** (die doppelte Recharts+HTML-Legende entfällt):

1. **Risiko & Performance:** Sharpe (dominant) + Volatilität (dezent). Beta nur
   als aktueller Wert in der KPI-Karte, nicht als (fake-)Linie.
2. **Bewertung:** Ø Forward-PEG + Ø Forward-PE. Linien beginnen am Einführungsdatum;
   davor Hinweis «Bewertungs-Historie wächst ab 07/2026».
3. **Ertrag:** Dividendenrendite brutto.

Gemeinsam: Zeitraum-Schalter (1M/3M/6M/1J/Max) wie bisher; Optimierungs-Events
als vertikale Markierung in allen Panels; Achsen 12 px+, `interval`-Ticks,
Linien ≥ 2 px; `null` = Lücke.

### 4.3 Optimierungs-Events: Vorher/Nachher statt Blitz-Deko

Klick/Hover auf ein Event öffnet eine Karte:

```
Optimierung vom 08.07.2026 · 6 Trades (3 Käufe, 3 Verkäufe)
Sharpe   0.60 → 1.45   ▲
Ø PEG    2.80 → 1.00   ▲ (günstiger)
Div. %   3.8 % → 4.3 % ▲
Beta     0.92 → 0.84   ▲ (defensiver)
```

Daten: Snapshot letzter Handelstag **vor** dem Event vs. 5 Handelstage **nach**
dem Event (Einschwingzeit); Trades aus `portfolioTransactions` (source
`optimization`). Fehlt eine Seite (z. B. Event vor Snapshot-Start) → Karte zeigt
nur die Trades, keine erfundenen Vorher-Werte.

### 4.4 Untere Zeile: Qualitätsmatrix «Bewertung vs. Effizienz» (v2, nach Datenreife)

Die Streudiagramm-Idee ist gut, aber erst sinnvoll, wenn **echte** PEG-Historie
über mehrere Monate existiert (nach E0/D6 gibt es rückwirkend keine). Bis dahin
ersetzt die Vorher/Nachher-Karte (4.3) diesen Platz. Danach:

- **Pfad statt Punktwolke:** dünne Linie alt→neu, Monatspunkte, alte Punkte
  transparent; aktueller Punkt gross mit Label «Aktuell: PEG 1.0 / Sharpe 1.45»;
  letzter Optimierungsschritt als Pfeil, Punkt «vor Optimierung» markiert.
- Achsentitel in Klartext: X «Bewertung — Ø PEG (niedriger = günstiger)»,
  Y «Effizienz — Sharpe (höher = besser)».
- Referenzlinien mit Begründung: PEG = 1.5 («fair bewertet»), Sharpe = 1.0
  («gute risikoadjustierte Rendite») — beschriftet, nicht stumm bei 2/1.
- Quadranten: «Attraktiv & effizient», «Teuer, aber effizient»,
  «Günstig, aber schwach», «Teuer & schwach».
- Blasengrösse (Dividende) entfällt — drei Dimensionen reichen (x, y, Zeit).

### 4.5 Interpretation («Aktuelle Einschätzung»)

Kurzer automatischer Text neben den KPI-Karten — **regelbasiert aus den
Score-Komponenten** (deterministisch, kein LLM im tragenden Pfad), z. B.:

> Das Portfolio liegt im Bereich «günstig & effizient». Die Optimierung vom
> 08.07. hat den Ø-PEG von 2.8 auf 1.0 gesenkt und die Sharpe-Ratio auf 1.45
> verbessert. Beachten: 2 Titel mit PEG > 3; tiefer Ø-PEG setzt realistische
> Gewinnschätzungen voraus.

Bausteine: bester/schlechtester Komponenten-Score, grösste 30-Tage-Veränderung,
letzter Optimierungs-Effekt, offene Warnung (PEG-Verteilung, Konzentration,
Fremdwährungsanteil). Vertiefung auf Wunsch über den Copilot (hat via
Tool-Loop Zugriff auf Portfolio-Daten).

### 4.6 Farb- und Typo-System

Eine Bedeutung = eine Farbe, konsistent über KPI-Karten, Panels und Matrix:

| Bedeutung | Farbe |
|---|---|
| Performance/Sharpe | Cyan `#00CFC1` (dominant, Marken-Akzent) |
| Risiko/Beta/Volatilität | Violett (nicht Rot — Rot nur für Warnungen) |
| Bewertung/PEG/PE | Orange |
| Ertrag/Dividende | Grün |
| Warnung | Rot |
| Optimierungs-Event | Amber/Blitz |

Nur die Hauptlinie pro Panel voll leuchtend, Sekundärlinien gedämpft.
Schrift: Achsen/Ticks ≥ 12 px, Karten-Zahlen gross (Lesbarkeits-Standard 50+).

**Akzeptanz E2:** Keine Doppel-Y-Achse mehr; genau eine Legende; jede Grafik hat
eine Überschrift, die ihre Aussage benennt; alle Fachbegriffe mit Tooltip;
Delta-Werte nur bei echter Datenbasis; Live-Check auf www.portfolio.mw ohne
Konsolenfehler.

---

## 5. Etappenplan & Abgrenzung

| Etappe | Inhalt | Abhängigkeit |
|---|---|---|
| **E0** | Datenfundament: D1–D6, Migration, `source`-Spalte | keine — **zuerst** |
| **E1** | Quality Score (Modul + Tests + Snapshot-Spalten + tRPC) | E0 |
| **E2** | UI-Redesign: KPI-Karten, 3 Panels, Event-Karten, Interpretation, Farbsystem | E1 |
| **E3 (v2)** | Qualitätsmatrix als Pfad (nach ≥ 3 Monaten echter Historie); Bewertungsmodul-Ausbau: FCF-Yield, Dividendenstabilität/-wachstum aus EODHD; ggf. Regionen-/Faktor-Sicht | E0–E2 + Datenreife |

Nicht Teil dieses Konzepts: neue Datenprovider, LLM-generierte Bewertungstexte
im tragenden Pfad, Faktor-Modelle (keine Datenbasis).

---

## 6. Offene Punkte (Entscheid Product Owner)

1. **Score-Schwellen kalibrieren:** Vorschlag oben ist Startpunkt; nach 1–2 Wochen
   echter Scores gegen die 37 Bestandsportfolios prüfen (Verteilung sollte
   differenzieren, nicht alle bei 70–80 kleben).
2. **Backfill-Politik:** kursbasierte Kennzahlen 1 Jahr zurück rekonstruieren
   (empfohlen, als `backfill` gekennzeichnet) oder komplett bei 0 starten?
3. **Platzierung:** Sektion bleibt im Portfolio-Detail («Übersicht»-Tab) —
   KPI-Karten könnten zusätzlich verdichtet auf die Portfolio-Karte im Dashboard.
