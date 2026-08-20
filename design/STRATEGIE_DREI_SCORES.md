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
| **Signal** | **Zustandsbeschreibung** aus Qualität und Timing, regimegewichtet (`dreiScoreSignal.ts`); die Bewertung wirkt als Wächter (Deckel bei extremer Überbewertung). Nirgends Sortier- oder Auswahlkriterium für Käufe (E2). | Reform umgesetzt |
| **Rhythmus & Kosten** | Lange Haltedauern, Totband, Kosten nur auf den gewechselten Teil. | gesichert |

Es gibt **eine** Signal-Formel: `rechneSignal` über die drei Scores. Die alte
Zusammensetzung (Momentum + Qualität − LPPL, `blendCombinedScore`) entscheidet
nirgends mehr und wird aus allen kundensichtbaren Pfaden entfernt.

## 3. Darstellung (verbindlich)

**Drei Kreise, ein daraus abgeleitetes Signal.**

- Kreise: **Qualität · Bewertung · Timing** — gleichrangig, denn sie sind die
  Messungen.
- Signal: **Farbskala 0–100** (rot → gelb → grün) mit Marker auf dem aktuellen
  Wert und drei Zonen **Schwach / Neutral / Stark** (E2: Zustandsworte statt
  Kauforder; die neutralen Anzeige-Texte liefert `shared/signalAnzeige.ts`,
  die gespeicherten Schlüssel bleiben unverändert). Die Zonengrenzen kommen
  aus `SCORE_BAENDER` — Anzeige und Rechnung können nicht auseinanderlaufen.
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
- **PEG: Ausweichen auf die Schätzquelle + Herleitung bei Ausblendung
  (2026-08, ohne FASSUNG-Wechsel):** Burkhalter-Befund: Die Rangfolge nahm
  die ERSTE tragfähige historische Quelle, auch wenn sie kaputt war — ein
  fusionszerdrückter 5j-CAGR knapp über 2 % ergab PEG 9.7 → ausgeblendet,
  während MarketScreener aus der intakten Analystenschätzung ~1.9 zeigt.
  Zwei Korrekturen: (1) Ergibt die historische Quelle ein bereinigtes PEG
  jenseits der Obergrenze 8 und liegt ein erwartetes Wachstum
  (Schätzung gegen Schätzung) im Korridor 2–35 %, weicht die Rechnung auf
  die Schätzquelle aus (frame-konsistent mit dem Forward-KGV) — Grundsatz
  «realistische Zahl zeigen, nicht ausblenden»; der Hinweis nennt beide
  Rechnungen. Hilft auch die Schätzung nicht unter die Obergrenze, bleibt
  der Faktor ausgeblendet. (2) Beim Ausblenden wegen Obergrenze bleiben
  Rohwert und Herleitung erhalten (Hinweis «… (KGV 23.3 ÷ 2.4 %
  5-Jahres-CAGR = 9.71 roh)») — die wiederkehrende «9.7» las sich sonst
  wie hardcoded; tatsächlich ist sie ein Trichter (KGV 19–24 ÷ Rate knapp
  über 2 %, Bereinigung hebt sich bei Qualität 75–85 fast auf, Rundung auf
  eine Nachkommastelle). Kein FASSUNG-Wechsel (Rekonstruktion rechnet kein
  PEG).
- **E1/E2 — Bewertung als Wächter, Signal als Zustandsbeschreibung
  (2026-08, ohne FASSUNG-Wechsel):** Die Bewertung trägt in `rechneSignal`
  kein Gewicht mehr (alle Regimes 0); die Qualität↔Timing-Verschiebung je
  Regime bleibt, von Hand renormiert (Krise 75/25 → Bulle 35/65, Standard
  50/50). Neu der **Bewertungs-Wächter**: Bewertung ≤ 20 (extrem teuer)
  deckelt das Signal auf 45 (oberes Ende «Neutral») — «günstig» gibt keine
  Punkte, Extreme kosten. Begründung nach Regel 1 (IC-Diagnose + Rangtest
  mit Kosten): Bewertung über 1/6/12 Monate invers (−0.021/−0.063/−0.093,
  22 % der Stichtage richtig), die Signal-Rangliste unterlag dem
  gleichgewichteten kuratierten Universum (−9.20 % vs. +10.94 % der
  Gegenprobe). Ausdrücklich KEINE Skalen-Inversion. Folgen: Kandidaten
  ohne Kursreihe (Screener) haben kein Signal mehr — die Kandidatenliste
  führt die Qualität; Anzeige-Labels neutral («Sehr gut» … «Sehr
  schwach», Note A–F bleibt), gespeicherte Schlüssel unverändert. Kein
  FASSUNG-Wechsel: Die Punkt-in-Zeit-Reihen speichern die drei Scores,
  nicht das Signal — die Signal-Ableitung wird beim Lesen gerechnet und
  gilt damit rückwirkend einheitlich; die drei Score-Formeln selbst sind
  unverändert. Noch offen (E3): Die Auswahl-Engine des Vorschlags-Wizards
  läuft weiter auf dem alten `combinedScore`-Ranking — ihr Umbau auf
  kuratiertes Universum + Lücken-Logik ist ein eigenes Paket.
- **FASSUNG 7 (2026-08): ROIC-Wächter.** Kapitalrendite über der Obergrenze
  150 % wird ausgeblendet (Renormierung) statt mit Bestnote belohnt.
  Begründung nach Regel 1 (Expedia-Befund: ROIC 399.36 % → 100/100):
  Die Definition NOPAT ÷ (Eigenkapital + Nettoschulden) misst jenseits
  dieser Schwelle den Nenner, nicht das Geschäft — Rückkäufe oder
  Netto-Cash schrumpfen das investierte Kapital auf einen Restposten.
  Reale Spitzenwerte (Apple ~60–70 %) liegen deutlich darunter; der
  bestehende Netto-Cash-Hinweis ab 50 % bleibt. Gleiche Linie wie die
  PEG-Obergrenze: Eine Zahl ohne Aussage wird ausgeblendet, nie belohnt.
  FASSUNG-Wechsel, weil die Rekonstruktion das ROIC selbst rechnet — die
  Punkt-in-Zeit-Historie zieht automatisch nach.
- **K1 — Selbstlern-Stopp (2026-08, ohne FASSUNG-Wechsel).** Setzt Leitsatz
  L3 aus KONSOLIDIERUNG_RECHENWERKE.md durch (messen ja, automatisch
  übernehmen nein): Der wöchentliche Regime-Priors-Cron und der monatliche
  Optimizer-Cron sind entfernt (beide Werkzeuge bleiben als Admin-Knopf);
  der Algo-Backtest-Feedback-Loop schreibt keine `signalWeights` mehr,
  sondern dokumentiert seinen Gewichts-Vorschlag nur noch im Tuning-Log;
  das wöchentliche ML-Training speichert Modelle ausschliesslich als
  Kandidaten — aktiviert wird ein Modell nur noch manuell auf der
  ML-Trainer-Seite. Kein FASSUNG-Wechsel: Die drei Score-Formeln und
  `rechneSignal` sind unberührt; gestoppt wurden nur ungegatete
  Schreibpfade in Labor-/Fallback-Konfigurationen.
- **K2 — EIN Signal für Badges & Alerts (2026-08, ohne FASSUNG-Wechsel).**
  `stocks.signalScore`/`signalType` wurden von zwei eigenen Formeln
  gefüllt (Alert-Heuristik `computeWatchlistSignalScore` und
  `calcSignalScore`) — auf /aktien stand damit ein Badge aus einem anderen
  Modell als die Zahl daneben. Beide Formeln sind entfernt; die Spalten
  werden ausschliesslich aus dem Drei-Score-Signal übernommen
  (`kernsignalUebernahme.ts` liest `stock_signal_cache`). Push-/WhatsApp-
  Hinweise feuern nur noch am starken Rand des Kernsignals, beim
  Zustands-Übergang, mit 7-Tage-Cooldown; Texte neutral («sehr guter /
  schwacher Zustand»). Titel ohne Kernsignal zeigen ehrlich «—» statt
  «Halten». Der «KI-Empfohlen»-Generator heisst ehrlich «Titel-Vorschläge
  aus kuratierten Listen» und vergibt keine Scores mehr; die
  alertConfig-Seite trägt ein Ohne-Wirkung-Banner (Rückbau in K12).
  Kein FASSUNG-Wechsel: Kernrechnung unberührt — es wurden nur
  Zweitformeln durch die eine Rechnung ersetzt.
- **K3 — Optimieren-Tab & Alerts konsistent (2026-08, ohne
  FASSUNG-Wechsel).** Nach K2 stammen Bestand und Kandidaten im
  Optimieren-Tab aus derselben Rechnung (Kernsignal); das Score-Delta ist
  damit wieder eine Aussage. Zusätzlich: Die «Ergänzungs-Vorschläge ab
  Score 65» (Kaufrangliste, L5-Verstoss) sind durch eine
  Diversifikations-Lücken-Logik ersetzt — vorgeschlagen wird nur, was
  einen im Portfolio fehlenden Sektor füllt UND den Türsteher besteht
  (kein Verkaufs-Zustand, konfigurierte Mindest-Schwelle; keine zweite
  Schwellenzahl mehr). Positionen ohne Kernsignal gelten nicht als
  «schwach» — ohne Signal kein Urteil. Der wöchentliche
  Optimierungs-Alert beurteilt nur noch das Kernsignal (der frühere
  qualityScore-Rückfall verglich zwei verschiedene Grössen an derselben
  Schwelle); der nie benutzte driftThresholdPp-Parameter ist entfernt.
  Veraltete Erklärtexte («Kombinierter Score aus Momentum, Qualität und
  LPPL») ersetzt durch die Drei-Score-Beschreibung.
- **K12 — Frontend entschlackt (2026-08, ohne FASSUNG-Wechsel).** Der
  «Signale»-Tab im Portfolio-Detail und die Seite /aktien/signale sind
  entfernt: Beide zeigten Labor-Signale (ML-`rfSignal`, Engine-Signale und
  die `signal_history`-Historie) im Kundenpfad — L2/L4-Verstoss — und
  doppelten die Positionsliste (Score-Spalten mit Klick-Dialogen) bzw. den
  Optimierungs-Tab. Alte Links (?tab=signale) landen auf den Positionen.
  Damit ist der letzte kundensichtbare Verbraucher der Labor-Signale weg.
- **K9 — Titel-Datenqualitäts-Ampel (2026-08, ohne FASSUNG-Wechsel).**
  Jeder Titel des Universums trägt im Admin eine Ampel «vollständig /
  lückenhaft / veraltet» (`titelDatenstatus.ts`, rein und getestet) aus
  Kursreihen-Länge (~250 Tage für 52-Wochen-Band und Timing), Kurs- und
  Kennzahlen-Frische (14/30 Tage) und Score-Basis (Qualität/Timing
  berechnet) — die Gründe stehen im Tooltip. Kein Eingriff in die
  Rechnung: Die Ampel erklärt, warum ein Titel kein Signal hat, sie
  erzeugt keines. Score-Spalte im Admin zeigt ohne Kernsignal «—» statt 0.
- **K6 — Portfolio-Zustand statt «Quality Score» (2026-08, ohne
  FASSUNG-Wechsel).** Die Bewertungs-Komponente (Ø PEG/PE aus rohen
  Vendor-Zahlen, 25 %) ist aus dem Portfolio-Score entfernt — sie war ein
  zweites Bewertungsuniversum an der bereinigten Kette vorbei und
  widersprach E1 (Bewertung ist Wächter der Titel-Rechnung, keine
  Portfolio-Note). Der Score heisst jetzt «Portfolio-Zustand», rechnet aus
  vier Komponenten (Risikoadjustierte Rendite, Risiko, Ertrag,
  Diversifikation; Abdeckung relativ zu deren Gewichten) und bleibt reine
  Anzeige. Titel-HHI in der Konfigurations-Seite korrekt unter
  «Diversifikation» gruppiert; der falsche Audit-Text («beeinflusst
  Kaufhinweise») korrigiert; Banner auf der Score-Konfigurations-Seite,
  dass die Bewertungs-Felder nicht mehr gelesen werden.
- **K8 — Namens- und Schichtenordnung (2026-08, ohne FASSUNG-Wechsel).**
  Admin-Navigation nach dem Vier-Schichten-Zielbild geordnet (Universum &
  Daten · Rechnung & Transparenz · Messung · Labor · Betrieb · «Rückbau
  geplant» für die seit K2/K6 wirkungslosen Konfigurations-Seiten), mit
  ehrlichen Kachel-Beschreibungen. Der aiInsights-Router (LLM-erfundene
  healthScore-Zahl, null Frontend-Verbraucher) ist entfernt.
- **K10 — Portfolio-Ausweis in drei Kundenkategorien (2026-08, ohne
  FASSUNG-Wechsel).** Die KPI-Zeile des Portfolio-Details ordnet ihre
  Kacheln nach den drei Kategorien des Soll-Ablaufs: **Rendite** (YTD vs.
  SPI, seit Kauf), **Risiko** (Sharpe vs. Benchmark), **Verlustrisiko**
  (neu: max. Drawdown vs. Benchmark) plus **Ertrag** (Dividendenrendite).
  Geprüft und festgehalten: Die zentrale Regeltabelle
  (shared/diversificationRules.ts — Positionsgrössen, Sektor-/Währungs-/
  Themen-Deckel, Anlageklassen-Toleranz) wird bereits von Wizard,
  Optimieren-Tab und Backtests gemeinsam gelesen und im Admin gepflegt;
  die tägliche Portfolio-Historie läuft ab Erstellung
  (portfolioMetricsSnapshot).
- **K5 — Copilot entschärft (2026-08, ohne FASSUNG-Wechsel).** Der
  Copilot-Composite rechnet nur noch mit Preisgrössen (Momentum, Sharpe,
  Volatilität, Drawdown) — der ML-Anteil (RF 15–25 %) und der
  PE/PEG-Anteil («billig = gut», E1-Widerspruch) sind entfernt, die
  Regime-Gewichte renormiert. Der Wert bleibt portfoliorelativ und wird im
  UI ausdrücklich so erklärt. Die automatische Ausführung
  (autoExecute-Trades aus dem Relativ-Score) ist stillgelegt: Empfehlungen
  werden gespeichert und gemeldet, umgesetzt nur durch den Nutzer; der
  Schalter ist aus dem UI entfernt, ein gespeichertes Flag wird ignoriert.
  Der Portfolio-Deep-Dive beschreibt statt zu empfehlen.
- **K7 — Labor gekennzeichnet, Messfenster fixiert (2026-08, ohne
  FASSUNG-Wechsel).** Die Engine-Auswertung misst jetzt bis zum
  SIGNAL-HORIZONT (computedAt + holdingPeriodHint) statt bis «heute» —
  vorher wuchs das Fenster mit jedem Tag Cron-Verzug, und in steigenden
  Märkten wurde fast jedes alte Kaufen-Signal irgendwann «richtig» (Mean
  Reversion «59 %» bei Ø-Alpha −0.17 %). Die Signal-Performance-Seite
  sortiert führend nach Ø-Alpha statt Trefferquote. Vier Admin-Seiten
  (Signal-Performance, ML-Trainer, Signal-Optimizer, Algo-Backtest) tragen
  ein «Labor — entscheidet nichts»-Banner; falsche UI-Texte korrigiert
  («maximale Trefferquote» → Netto-Sharpe; ML-Label 30 Tage statt 20;
  Universum 300 statt 80).
- **K11 — Projektleiter-Cockpit & Lernwerkstatt (2026-08, ohne
  FASSUNG-Wechsel).** Neues Lagebild auf dem Admin-Dashboard
  (`ermittleCockpitLage`): aggregierte K9-Datenampel des Universums
  (vollständig/lückenhaft/veraltet mit Problem-Titeln und Gründen) und
  offene Lern-Vorschläge (ML-Kandidaten, Gewichts-Vorschläge des
  Feedback-Loops). Dazu eine wöchentliche Cockpit-Meldung (Mo 05:30 UTC)
  an den Projektleiter — reiner Bericht; jede Übernahme läuft weiterhin
  ausschliesslich über die Freigabe-Klicks (L3).
- **K4 (Vorab-Schnitt) — Wizard bereinigt (2026-08, ohne
  FASSUNG-Wechsel).** Drei sichere Schnitte vor dem eigentlichen
  E3-Umbau: (1) Der tote `buildProposal`-Zweitpfad (eigener kompletter
  Vorschlags-Rechenweg mit eigener Sleeve-Zumischung und eigenem
  stocksOnly-Default — die Wurzel des Multi-Asset-trotz-nur-Aktien-
  Befunds) ist gelöscht; es gibt nur noch EINEN Vorschlagsweg
  (startProposal). (2) Die Admin-Feedback-Schleife liest jetzt das echte
  Schreibformat (`changes[]` statt der nie existierenden
  reduced/increased/replaced-Felder) — der Kontext war vorher IMMER leer.
  (3) Der versteckte Kurations-Bonus (+10) ist aus Ranking und
  Fallback-Gewichtung entfernt; Kuratierung wirkt über die Filter.
  OFFEN für den E3-Sprint: Auswahl über Wächter+Lücken-Logik statt
  Score+Tilts, Pauschal-60 für Expansions-Kandidaten, autoApply-Zwang,
  Anlageklassen-Wahl als Profil-Merkmal (braucht Schema-Migration).

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
