# Reformvorschlag: Rolle der Scores, KGV-Quellen, Screener-Auftrag

**Status: ENTWURF zur Entscheidung — noch keine Änderung an Rechnung oder Produkt.**
Entstanden am 18.08.2026 aus den Messungen vom 17.08. (IC-Diagnose auf drei
Horizonten, Rangtest «Die besten N halten» auf zwei Horizonten, KIMI-PEG-Audit,
Manus-PEG-Untersuchung, Manus-R1-Rohdiagnose). Jede Ziffer ist einzeln
entscheidbar; Umsetzung erst nach Marcs OK je Ziffer, gemäss Regel 1
(STRATEGIE_DREI_SCORES.md §4).

---

## 1. Die Evidenz — was gemessen wurde

Grundlage: die vollständige FASSUNG-6-Rekonstruktion (212 Titel, 127
Monatsstichtage 2016–2026, 25'558 Zeilen aktueller Fassung), Training/Prüfung
0.98 — die Messung ist übertragbar, kein Artefakt.

**IC-Diagnose (ordnet ein Score die Titel im Querschnitt richtig?):**

| Score | 1 Monat | 6 Monate | 12 Monate |
|---|---:|---:|---:|
| Qualität | 0.012 | 0.015 | 0.009 (Dezilspanne **−29.2**) |
| Bewertung | −0.021 | −0.063 | **−0.093** (22 % der Stichtage richtig) |
| Timing | 0.014 | −0.007 | −0.019 |

Zum Massstab: 0.03–0.05 gälte für einen Einzelfaktor als brauchbar.

**Rangtest mit echten Wechselkosten (40 Positionen, gegen das gleichgewichtete
Universum):**

| Auswahl nach | 6 M netto | 12 M netto | vorn (12 M) |
|---|---:|---:|---:|
| Signal heute | −3.91 | **−9.20** | 23 % |
| Bewertung | −2.93 | −6.68 | 21 % |
| Qualität | −1.06 | −2.95 | 46 % |
| Timing | +0.34 (n.s.) | +2.58 (n.s., ±3.87; 79 % Umschlag) | 51 % |
| **Gegenprobe: schlechteste nach Bewertung** | **+4.31** | **+10.94** | **80 %** |
| Ohne schlechtestes Zehntel nach Qualität | −1.14 | −3.29 | — |

Branchenneutralität ändert nichts (Gegenprobe +11.31) — kein Sektor-Artefakt.

**Lesart:** Die Scores tragen Information (die Gegenprobe ist spiegelbildlich
stark), aber als Kauf-Rangliste innerhalb des kuratierten Universums haben sie
über dieses Jahrzehnt systematisch geschadet. Der nachweisliche Gewinner ist
das **gleichgewichtete kuratierte Universum selbst**. Erklärung, konsistent mit
allen Daten: (a) Die Kuratierung hat die Qualitäts-Streuung bereits verbraucht;
(b) im meistanalysierten Marktsegment ist Fundamentalqualität eingepreist;
(c) «billig» heisst unter Champions meist «billig aus gutem Grund»;
(d) 2016–2026 war extrem growth-lastig — die Jahreszeilen zeigen die
Regimeabhängigkeit (Qualität 2017–2019 IC bis 0.26; Bewertung 2021 +0.21,
2025 +0.07).

**Was der Rückblick NICHT messen kann:** Haltedauern > 12 Monate, die
Schutzwirkung im nächsten Einbruch, und den Wert der Wächter (verhinderte
Fehlgriffe — Samsung-GDR, LISP, FDJ — erscheinen in keinem Durchschnitts-IC).

---

## 2. Entscheidungsvorschläge

### E1 — Bewertung: vom Renditefaktor zum Wächter

Die Bewertungs-Säule verliert den Anspruch, Rendite zu erklären. Sie bleibt
als **beschreibende Grösse** (mit allen Wächtern und Herleitungen) und wirkt
nur noch **negativ-selektiv**: Extreme Überbewertung (KGV-Deckel-Zone,
PEG jenseits der Aussage) bleibt ein Warn-/Ausschlusskriterium; «günstig»
gibt keine Pluspunkte mehr. **Ausdrücklich nicht:** die Skala umdrehen
(«teuer kaufen») — das wäre Rückwärts-Überanpassung an ein Jahrzehnt.

### E2 — Signal: Zustandsbeschreibung statt Kauf-Rangliste

Das Signal (A–F, STRONG BUY…) wird nirgends mehr als Sortier- oder
Auswahlkriterium für Käufe verwendet — weder im Vorschlags-Wizard noch im
Screener-Ranking. Es bleibt als kompakte Zustandsbeschreibung je Titel
(mit Klartext, wofür es steht und wofür nicht). Empfehlungslogik der App:
**kuratiertes Universum, Gleichgewichtung, Disziplin (Rebalancing),
Wächter** — das, was nachweislich trug.

Offener Prüfpunkt vor endgültiger Streichung der Regime-Gewichte: Haben sie
in den Value-Jahren (2021, 2025) die Bewertung tatsächlich messbar
hochgewichtet? Wenn nein, sind sie auch als Idee unbelegt.

### E3 — Screener: Trichter statt Bestenliste

Der Screener behält seine nachweislich funktionierenden Stufen und verliert
die Score-Sortierung als Empfehlungsgeste:

1. **Harte Wächter** (existiert): Gattungen, Identität, Datenqualität, GDR/OTC.
2. **Mindeststandards statt Maximierung:** F-Score-Untergrenze,
   Gewinn-Konstanz über 10 Jahre, keine Extrembewertung — Qualitäts-
   *Sicherung*, gegen die keine Messung spricht.
3. **Lücken-Logik:** Sortierung nach dem, was der Watchlist fehlt
   (Sektor-/Regionen-Lücken), nicht nach Score-Höhe.
4. **Entscheid bleibt bei Marc, und wird gemessen:** Das Lauf-Protokoll ist
   ein Punkt-in-Zeit-Universum; Übernahmen/Ablehnungen werden festgehalten —
   in 1–2 Jahren existiert erstmals eine unverzerrte Vorwärtsmessung.

### E4 — KGV-Quellen: weg vom bewiesen kaputten Vendor-Feld

Manus-R1 (docs/audit/KGV_RAW_DIAGNOSIS_VENDOR_OR_APP_2026-08-17.md) beweist:
`Valuation.ForwardPE` ist beim Vendor bit-identisch über verschiedene Firmen
dupliziert (GSK≡Fielmann, easyJet≡Stryker, Renault≡Covivio); das
Trailing-Feld ist individuell. Der KGV-Faktor und der KGV-Deckel nutzen heute
`forwardPE ?? trailingPE` — also mehrheitlich das kaputte Feld.

- **E4a (sofort, klein):** Faktor + Deckel auf `trailingPE ?? forwardPE`
  drehen. Kein FASSUNG-Wechsel (die Rekonstruktion rechnet ihr KGV selbst) —
  aber Score-Änderung bei rund einem Drittel der Titel, deshalb OK nötig.
- **E4b (nach Beleg-Lauf):** `kgvSelbst` (Marktkapitalisierung ÷ TTM-Gewinn,
  seit #309 datumsgefenstert) als Trailing-Primärquelle, Vendor als
  Gegenprobe; Duplikat-Zähler im Abdeckungs-Blatt muss danach 0 zeigen
  (KIMI R6). Entscheid auf Basis der Abweichungs-Statistik des finalen Laufs.
- **E4c (prüfen):** Forward-Seite des PEG ohne Vendor-Feld — selbst
  gerechnetes Forward-PE existiert im Code (`trailingPE × eps ÷ Schätzung`),
  trägt aber den Core/IFRS-Definitionsbruch (Roche) in sich. Nur übernehmen,
  wenn der Bruch ausgeschlossen werden kann; sonst bleibt die heutige
  Paarung mit dokumentierter Schwäche.

### E5 — Betriebs-Transparenz: Quota-Erschöpfung als solche benennen

429 Titel liefen am 17.08. in «keine Fundamentaldaten», tatsächlich war das
EODHD-Tageslimit erschöpft. Der HTTP-Status (402/429) muss bis in den
Fehlergrund des Screener-Protokolls durchgereicht werden («EODHD-Limit
erschöpft — später erneut»), damit Quota-Fälle nie wieder wie Datenlücken
aussehen und der Wiederanlauf gezielt erfolgen kann.

### E6 — Rechenbuch und App-Texte nachführen

Nach Entscheid über E1–E3: Rechenbuch (Rollen der Säulen), Signal-Klartexte
(«beschreibt den Zustand, ordnet keine Kaufliste»), Screener-Texte
(Mindeststandards/Lücken-Logik) in einem Zug aktualisieren — eine Sprache
überall, FASSUNG-Bump für die Rechnungsteile (voraussichtlich FASSUNG 7)
mit vollständigem Änderungslog.

---

## 3. Was ausdrücklich NICHT geändert wird

- Keine Skalen-Inversion der Bewertung (Rückwärts-Überanpassung).
- Keine Gewichts-Feinoptimierung per Backtest («Signal-Gewichte messen» würde
  bei diesen ICs nur Zufallsgewichte prämieren).
- Keine Lockerung der Wächter, Mindestabdeckungen oder der
  Renormierungs-Regeln — die Datenqualitäts-Schicht ist der bestätigte Kern.
- Kein neuer Daten-Vendor als Reflex (Yahoo zeigt dieselben PEG-Artefakte;
  Selbstrechnung aus Rohdaten schlägt den nächsten Fertig-Wert).

## 4. Umsetzungsreihenfolge (nach OK je Ziffer)

1. E4a + E5 (klein, risikoarm, sofort belegbar).
2. E1 + E2 + E6 als EIN konsistenter FASSUNG-7-Schritt mit Änderungslog und
   Punkt-in-Zeit-Neurechnung.
3. E3 (Screener-Umbau) als eigenes Paket.
4. E4b nach der Abweichungs-Statistik des finalen Laufs; E4c nur mit Beleg.
5. Vorwärts weiterlaufen lassen: Screener-Protokoll, PEG-Aufzeichnung,
   Übernahme-Entscheide — die Messungen, die der Rückblick nicht liefern kann.

## 5. Nachtrag: der finale Beleg-Lauf (#180001, 18.08.2026)

Erster Lauf mit erweitertem Universum (US bis 2'000, SIX ab 0.3 Mrd.):
**1'748 gesichtet, 844 berechnet** (+257 gegenüber #150001), davon US 287
und Schweiz 126 (darunter 40 neue Mid Caps unter 1 Mrd. — Zehnder, R&S
Group, BVZ, APG SGA, LEM …). Alle Nachher-Kriterien erfüllt:

| Kriterium | Ergebnis |
|---|---|
| Niveau aus Faktorspalten nachrechenbar (±0.2) | **820 / 820** |
| Fehlerzeilen (vorher 15, davon 12 Timeouts) | **3** (nur echte Datenlücken, 0 Timeouts) |
| KGV-Duplikate über Titel (KIMI R6; vorher 83 Gruppen / 177 Zeilen) | **9 Gruppen / 19 Zeilen** nach E4a |
| PEG belegt | 438 / 844; 37 aus unbrauchbarem Vendor-Wert gerettet, 150 ehrlich ausgeblendet |
| `kgvSelbst` belegt | **757 / 844 (90 %)**, davon 12 Titel, die NUR so ein KGV haben |
| Abweichung `kgvSelbst` vs. Vendor-Trailing | **Median 1.02–1.06 auf ALLEN sechs Börsen**; nur 10 % über Faktor 1.5 |

**E4b-Empfehlung (entscheidungsreif):** Die Selbstrechnung ist validiert —
sie trifft das Vendor-Trailing-Feld überall dort, wo es brauchbar ist, auf
wenige Prozent, füllt dessen Lücken (12 Titel) und macht die
Rest-Duplikate obsolet. Vorschlag: `kgvSelbst` wird Primärquelle des
KGV-Faktors und des Deckels; das Vendor-Feld bleibt als Gegenprobe — bei
Widerspruch über Faktor 1.5 zählt die vorsichtigere Zahl (das höhere KGV),
mit Ausweis im Datenqualitäts-Review. Gleiches Muster wie beim PEG.

**Offener Kleinpunkt:** Mailand lieferte 0 Titel (weder berechnet noch
aussortiert) — der EODHD-Exchange-Code «mi» ist zu prüfen.
