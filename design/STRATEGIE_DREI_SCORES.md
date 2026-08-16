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
- **PEG-Rückfall (2026-08, ohne FASSUNG-Wechsel):** Fehlt das Vendor-PEG,
  wird das rohe PEG selbst gerechnet — KGV ÷ belegtes Gewinnwachstum
  (5-Jahres-CAGR führt, TTM als Rückfall, 2-%-Untergrenze strikt), danach
  dieselbe Bereinigung und dieselben Wächter (`bereinigtesPeg.ts`).
  Screener-Befund: Bei vielen Nicht-US-Titeln fehlt die Zahl beim Vendor,
  nicht in den Daten; der Faktor-Hinweis weist «selbst gerechnet» aus. Kein
  FASSUNG-Wechsel, weil die Rekonstruktion das bereinigte PEG ohnehin nicht
  rechnet (`punktInZeitKennzahlen.adjustedPeg = null`, Vendor-Schätzungen von
  damals sind nicht archiviert) — die Historie bleibt vergleichbar.

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
