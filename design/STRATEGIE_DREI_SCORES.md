# Strategie: Das Drei-Scores-Konzept

Stand 2026-08 · verbindlich bis zur nächsten Revision · Nachfolger von
KONZEPT_SCORE_DREITEILUNG.md (das Konzept ist umgesetzt; dieses Dokument regelt
den Betrieb).

## 1. Was gemessen wurde — und was daraus folgt

Die Rekonstruktion 2016–2026 (212 Titel, 127 Monatsstichtage, Punkt-in-Zeit,
PR #253–#276) hat ergeben:

- **Keiner der drei Scores ordnet die Titel des eigenen Universums verlässlich
  nach künftiger Rendite.** Weder als Rangliste (beste N kaufen) noch als
  Ausschluss (schlechteste meiden), weder roh noch branchenneutral.
- **Das Ergebnis ist nicht interpretierbar**, weil das Universum nur die
  Überlebenden von heute enthält. Das schlechteste Qualitätszehntel «verdiente»
  rückblickend ~58 % p.a. — die Signatur der Überlebensverzerrung, nicht eine
  Eigenschaft schlechter Unternehmen. Eine plausible Ausfallquote von 30 %
  kippt das Vorzeichen.
- **Deshalb wird auf Basis dieser Daten NICHTS an den Scores geändert** — nicht
  umgedreht, nicht neu gewichtet, nicht ausgeschlossen. Jede solche Änderung
  wäre Anpassung an einen Stichprobenfehler.

Gesichert ist dagegen, unabhängig von jeder Verzerrung:

- **Handelskosten dominieren kurze Rhythmen.** Ein Rundlauf kostet ~1.125 %;
  monatliche Neubeurteilung ~13 % p.a. Seltener handeln ist die grösste
  sichere Verbesserung.
- **Breite schlägt Konzentration** in jeder gemessenen Variante.
- Drei Konstruktionsfehler wurden gefunden und behoben (Regime-Alias #264,
  fehlendes Timing #265, leerer Bewertungs-Score #272). Die Formeln sind
  geprüft; ihre Vorhersagekraft ist offen.

## 2. Rollenverteilung

| Baustein | Rolle | Status |
|---|---|---|
| **Kuratierte Watchlist** | Vermutete Haupt-Alphaquelle. Wird ausgebaut (Screener) und ab sofort protokolliert, damit sie messbar wird. | unbewiesen, plausibel |
| **Qualität / Bewertung / Timing** | **Beschreibung** eines Titels: Wie gut ist das Unternehmen, wie teuer die Aktie, wo steht der Kurs. Belegbar aus Kennzahlen. | Formeln geprüft |
| **Signal** | **Abgeleitete Grösse** aus den dreien, regimegewichtet (`dreiScoreSignal.ts`). Eine Orientierung, keine belegte Renditeprognose. | unvalidiert |
| **Rhythmus & Kosten** | Lange Haltedauern, Totband, Kosten nur auf den gewechselten Teil. | gesichert |

Es gibt **eine** Signal-Formel: `rechneSignal` über die drei Scores. Die alte
Zusammensetzung (Momentum + Qualität − LPPL, `blendCombinedScore`) entscheidet
nirgends mehr und wird aus allen kundensichtbaren Pfaden entfernt.

## 3. Darstellung (verbindlich)

**Drei Kreise, ein daraus abgeleitetes Signal.**

- Kreise: **Qualität · Bewertung · Timing** — gleichrangig, denn sie sind die
  Messungen.
- Signal: **Farbskala 0–100** (rot → gelb → grün) mit Marker auf dem aktuellen
  Wert und drei Zonen **Verkaufen / Halten / Kaufen**. Die Zonengrenzen kommen
  aus `SCORE_BAENDER` — dieselbe Tabelle, die die Empfehlung bestimmt. Anzeige
  und Entscheidung können nicht auseinanderlaufen.
- Das Signal wird nicht als vierter Kreis gezeigt: Es ist keine vierte Messung,
  sondern eine Rechnung aus den dreien.
- Ein Score ohne ausreichende Datenbasis zeigt «—», nie eine Zahl aus zwei
  Kennzahlen.

## 4. Regeln für Änderungen

1. **Formeländerungen nur mit fachlicher Begründung** — nie, weil ein Backtest
   auf dem Überlebenden-Universum etwas anderes nahelegt. Reihenfolge: erst
   Begründung, dann Plausibilitätsprüfung, nie umgekehrt.
2. **Jede Rechnungsänderung erhöht `FASSUNG`** (`punktInZeitStore.ts`); die
   Roh-Kennzahlen bleiben gespeichert, damit Neuberechnung keinen Neuabruf
   braucht.
3. **Gewichte bleiben wie sie sind** (regimeabhängige Tabelle,
   `DEFAULT_SIGNAL_GEWICHTE`), bis die Vorwärtsmessung etwas anderes belegt.
   Wechsel von einer unbelegten Annahme zur anderen ist keine Verbesserung.

## 5. Der Weg zur Validierung (vorwärts, nicht rückwärts)

Rückwärts ist die Frage nicht mehr beantwortbar. Vorwärts laufen drei Reihen,
alle ohne Überlebensverzerrung:

- **`combined_score_history`**: täglicher Snapshot des kundensichtbaren Scores,
  nach 30 Tagen gegen Benchmark ausgewertet (Alpha, Richtungstreffer).
- **PEG-Aufzeichnung** (`bewertung_vorwaerts`, seit 2026-08): schliesst die
  Lücke des geschätzten Bewertungsteils nach vorn.
- **Screener-Protokoll** (geplant): jeder Lauf hält fest, welche Titel zur
  Auswahl standen — das Punkt-in-Zeit-Universum, dessen Fehlen den Backtest
  entwertet hat.

**Entscheidungspunkt:** Frühestens nach 12 Monaten Vorwärtsdaten wird über
Gewichte, Schwellen oder die Rolle des Signals neu entschieden. Bis dahin gilt
dieses Dokument.

## 6. Änderungslog der Rechnung

- **FASSUNG 3 (2026-08):** KGV als eigener Bewertungs-Faktor für
  Nicht-Finanzwerte (Gewicht 0.15; PEG 0.45 → 0.35, FCF 0.35 → 0.30).
  Begründung nach Regel 1: Das PEG bestraft billige Wenig-Wächser — KGV 12 bei
  4 % Wachstum ergibt PEG 3 und damit 0 Punkte —, während die Billigkeit
  selbst nirgends Punkte bekam; der KGV-Deckel wirkte nur nach oben (teuer
  begrenzt), nie nach unten (billig belohnt). Nebenwirkung, bewusst in Kauf
  genommen: Titel ohne PEG erreichen mit KGV+FCF+Dividende jetzt 65 %
  Abdeckung und bekommen wieder einen vollen Bewertungs-Score.
- **FASSUNG 4 (2026-08):** Gewinnstabilität robust — nur benachbarte
  Geschäftsjahre bilden Wachstumsraten, Raten bei ±100 % gekappt, mindestens
  4 Jahresraten (`gewinnStabilitaet.ts`). Befund 1 der Scoring-Prüfung.
- **PEG-Wachstumsquellen (2026-08, ohne FASSUNG-Wechsel):** Der selbst
  gerechnete PEG-Nenner kennt vier Quellen in fester Rangfolge:
  5-Jahres-CAGR → TTM → robustes Raten-Mittel (aus `gewinnStabilitaet`) →
  erwartetes Wachstum (Analystenschätzung, wie Yahoo). Begründung
  (Schindler-Fall): Der CAGR ist eine Endpunkt-Rechnung — ein starkes
  Basisjahr drückte ihn unter 2 % und blendete das PEG aus, obwohl die
  Jahresraten im Mittel klar wuchsen. 2-%-Untergrenze gilt je Quelle
  strikt; die Herleitung steht als `rechnung` an jedem Faktor. Kein
  FASSUNG-Wechsel: Der PEG-Faktor ist als geschätzt markiert und in der
  Rekonstruktion ohnehin `null`.
- **FASSUNG 5 (2026-08):** Gewinnstabilität — Raten-Kappung ±100 % → ±50 %.
  Begründung nach Regel 1: Im vollständigen Screener-Lauf #150001 standen
  167 von 296 berechneten Stabilitätswerten auf exakt 0 (56 %) — ein Faktor,
  der die Hälfte des Universums identisch bestraft, unterscheidet nicht
  zwischen «etwas zyklisch» und «chaotisch» und trägt praktisch keine
  Information (15 % Gewicht als Rauschen). Ein einzelnes Extremjahr
  (Einmalgewinn, Split-Artefakt, Basiseffekt) zählt jetzt als
  50-%-Ereignis; erst WIEDERHOLTE grosse Sprünge (Wechselreihe ±50 %)
  erreichen weiterhin die 50-pp-Nullmarke. Anker unverändert
  (5 pp → 100, 50 pp → 0).
- **PEG-Rückfall (2026-08, ohne FASSUNG-Wechsel):** Fehlt das Vendor-PEG,
  wird das rohe PEG selbst gerechnet — KGV ÷ belegtes Gewinnwachstum
  (5-Jahres-CAGR führt, TTM als Rückfall, 2-%-Untergrenze strikt), danach
  dieselbe Bereinigung und dieselben Wächter (`bereinigtesPeg.ts`).
  Screener-Befund: Bei vielen Nicht-US-Titeln fehlt die Zahl beim Vendor,
  nicht in den Daten; der Faktor-Hinweis weist «selbst gerechnet» aus. Kein
  FASSUNG-Wechsel, weil die Rekonstruktion das bereinigte PEG ohnehin nicht
  rechnet (`punktInZeitKennzahlen.adjustedPeg = null`, Vendor-Schätzungen von
  damals sind nicht archiviert) — die Historie bleibt vergleichbar.

- **FASSUNG 6 (2026-08):** Gewinnwachstum als siebter Niveau-Faktor der
  Qualität — robustes Raten-Mittel der Jahres-EPS (berichtete Zahlen, voll
  rekonstruierbar), Anker 0 % → 0 Punkte, 20 % → 100 Punkte, Gewicht 15 %
  (finanziert aus Ertragsqualität 20→15, Stabilität 15→10, Bruttomarge
  10→5). Begründung nach Regel 1: Die Wachstums-HÖHE kam nur als
  PEG-Nenner vor — mit ausgeblendetem PEG verschwand sie ganz; der F-Score
  prüft nur das binäre Vorjahres-Delta, die Stabilität nur die
  Gleichmässigkeit — ein stabiler Null-Wächser holte Bestnoten. Nach dem
  Abgrenzungstest (kursunabhängig) gehört Wachstum in die Qualität, nicht
  in die Bewertung. Vorwärts-Beleg: Rekonstruktion FASSUNG 6 +
  «Scores diagnostizieren» nach dem Deploy.
- **PEG-Wachstums-Obergrenze (2026-08, ohne FASSUNG-Wechsel):** Der
  PEG-Nenner akzeptiert nur Quellen im Korridor 2–50 % p.a.; unplausible
  Quellen werden übersprungen, greift keine, wird der Faktor mit Grund
  «Basiseffekt» ausgeblendet. Begründung (FDJ-Fall): Ein Mini-Ausgangsgewinn
  erzeugte «erwartetes Wachstum» +1944 %, PEG 0.09 und volle Punktzahl —
  das G im PEG meint nachhaltiges Mehrjahres-Wachstum, über 50 % p.a. ist
  das nie plausibel. Kein FASSUNG-Wechsel (Rekonstruktion rechnet kein PEG).
- **Vendor-PEG-Konsistenz (2026-08, ohne FASSUNG-Wechsel):** Liegen
  Vendor-PEG UND eigene Rechnung (KGV ÷ tragfähige Quelle im Korridor) vor
  und weichen sie um mehr als Faktor 2 voneinander ab, zählt die eigene
  Rechnung — mit Hinweis am Faktor. Begründung (KIMI Punkt 7): Ein
  Vendor-PEG zwischen den Wächtern (≤ 8, Wachstum plausibel) kann trotzdem
  falsch sein, wenn der Vendor-Nenner nicht zu den belegten Zahlen passt;
  die nachvollziehbare Rechnung schlägt die Blackbox. Kein FASSUNG-Wechsel
  (Rekonstruktion rechnet kein PEG).
- **PEG-Nachschärfung am Roche-Fall (2026-08, ohne FASSUNG-Wechsel):**
  Drei Korrekturen nach einem Live-Befund (ROG: Vendor-PEG 1.68 wurde von
  einer kaputten Eigenrechnung 0.49 verdrängt → 100/100). (1) «Erwartetes
  Wachstum» rechnet Schätzung GEGEN Schätzung (laufendes vs. nächstes Jahr)
  statt Schätzung gegen berichtetes EPS — Analystenschätzungen basieren oft
  auf bereinigten EPS-Definitionen (Roche: Core vs. IFRS), der Bruch erzeugte
  +45.8 % statt ~8 %. (2) Die Konsistenz-Gegenprobe bevorzugt bei Widerspruch
  über Faktor 2 die VORSICHTIGERE Zahl (höheres PEG) statt pauschal die
  eigene Rechnung — bei widersprüchlichen Quellen nie die günstigere Lesart.
  (3) Wachstums-Obergrenze 50 → 35 % p.a.: 45.8 % schlüpfte knapp unter die
  alte Grenze; nachhaltige Raten darüber sind praktisch nie real. Kein
  FASSUNG-Wechsel (Rekonstruktion rechnet kein PEG).
- **PEG: Vendor-Unbrauchbarkeit + Frame-Konsistenz (2026-08, ohne
  FASSUNG-Wechsel):** Sanofi-Befund: EODHDs PEG-Feld lieferte ~50 (FactSet:
  1.20) — der Wächter blendete korrekt aus, aber die realistische Zahl
  fehlte, und die Titelseite zeigte obendrein das rohe Vendor-Feld als
  Ersatz. Drei Korrekturen: (1) Ein Vendor-Wert, der bereinigt jenseits der
  Obergrenze 8 läge, trägt keine Aussage — er gilt als FEHLEND, und die
  Selbstrechnung übernimmt mit allen Wächtern (Ziel: realistische Zahl
  zeigen, nicht ausblenden). (2) Frame-Konsistenz: Ein Schätzungs-Nenner
  (erwartetes Wachstum) paart mit dem Forward-KGV, historische Nenner mit
  dem Trailing-KGV — so rechnen FactSet & Co.; die Mischung trailing-KGV ÷
  Schätzwachstum überzeichnete das PEG bei gedrückten berichteten Gewinnen.
  (3) Anzeige: Die PEG-Kennzahl fällt nie mehr auf das rohe Vendor-Feld
  zurück — ausgeblendet heisst «—» mit Grund. Kein FASSUNG-Wechsel
  (Rekonstruktion rechnet kein PEG).
- **E4a — KGV-Quelle: Trailing vor Forward (2026-08, ohne FASSUNG-Wechsel):**
  Der KGV-Faktor und der KGV-Deckel lasen `forwardPE ?? trailingPE`. Die
  R1-Rohdiagnose (docs/audit/KGV_RAW_DIAGNOSIS_VENDOR_OR_APP_2026-08-17.md)
  beweist: EODHDs `Valuation.ForwardPE` ist über verschiedene Firmen
  bit-identisch dupliziert (GSK≡Fielmann, easyJet≡Stryker, Renault≡Covivio;
  31 % der Zeilen im Lauf #150001), das Trailing-Feld ist individuell.
  Neu an allen drei Rechenstellen (Service, Signal-Cron 2×):
  `trailingPE ?? forwardPE`. Kein FASSUNG-Wechsel: Die Rekonstruktion
  rechnet ihr KGV selbst aus Kurs und EPS.
- **Dividenden-Gegenprobe als Wächter (2026-08, ohne FASSUNG-Wechsel):**
  Widerlegt die unabhängige Gegenprobe (Yahoo-Ausschüttungen, ab 8 %
  Rendite) den EODHD-Quellenwert materiell, wird der Dividenden-Faktor im
  Screener ausgeblendet (Renormierung) statt still gekappt — mit beiden
  Zahlen im Hinweis. Begründung (LISP.SW: EODHD 18.98 %, Yahoo 1.93 %):
  Ein widerlegter Quellenwert trüge sonst bis zu 20 % (bzw. 35 % bei
  Finanzwerten) der Bewertung. Kein FASSUNG-Wechsel: Die Rekonstruktion
  rechnet die Dividende aus dem Zahlungsstrom, nicht aus dem Vendor-Feld.
- **E4b — KGV: Selbstrechnung als Primärquelle, Vendor als Gegenprobe
  (2026-08, ohne FASSUNG-Wechsel):** Das KGV für den Bewertungs-Score
  (Faktor und Deckel) kommt jetzt aus der eigenen Rechnung
  Marktkapitalisierung ÷ TTM-Nettogewinn (datumsgefenstert,
  `kgvSelbst.ts`); das Vendor-Trailing bleibt Gegenprobe. Bei Widerspruch
  über Faktor 1.5 zählt die vorsichtigere Zahl — das höhere KGV — mit
  Hinweis am Faktor; fehlt die Selbstrechnung (Verlust, keine
  Gewinnbasis), trägt weiter das Vendor-Feld (Trailing vor Forward, E4a).
  Begründung nach Regel 1 (Beleg-Lauf #180001, 820 Titel): Die
  Selbstrechnung erreicht 90 % Abdeckung, Median-Abweichung zum
  Vendor-Trailing 1.02–1.06 auf allen sechs Börsen, füllt 12
  Vendor-Lücken (v. a. Schweizer Titel mit leeren Vendor-Blöcken) und ist
  im Gegensatz zur Vendor-Blackbox nachrechenbar (Manus-R1: Vendor-Felder
  teils bit-identisch dupliziert). Die 1.5er-Schwelle trennt Stichtags-
  und Rundungsdifferenzen (~90 % der Titel) von echten Datenfehlern
  (~10 %). Kein FASSUNG-Wechsel: Die Rekonstruktion rechnet ihr KGV
  selbst aus Kurs und EPS.

## 6. Fahrplan

1. **Frontend-Konsolidierung** — eine Formel überall; drei Kreise + Signalskala
   (Abschnitt 3). Der alte `tradingview.stockScoring`-Pfad verschwindet aus der
   Titelansicht.
2. **Vorwärtsmessung sichtbar machen** — `combined_score_history` im Admin
   auswerten (Alpha, Trefferquote, Datenstand).
3. **Screener** — zweistufig (EODHD-Vorfilter → Scores), additiv zur
   Kuratierung, mit Protokoll. Vorschläge zur Prüfung, kein automatisches
   Ersetzen kuratierter Titel.
4. **Rhythmus** — Umschichtungsfrequenz und Kostenausweis im Vorschlagsprozess.
