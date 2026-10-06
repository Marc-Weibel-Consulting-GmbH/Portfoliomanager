# STMN.SW – Entity Card (06.10.2026)

## Auftrag

Die sichtbare Straumann-Kennzahl `P/E 38.9` sowie die Signalherleitung gegen die vom Nutzer vorgelegten UBS/FactSet-Werte nachvollziehbar prüfen. Die Prüfung ist **read-only**, bis Ursache und Korrekturregel belegt sind.

## Instrumentidentität

| Feld | Wert | Status |
|---|---|---|
| App-Ticker | `STMN.SW` | zu prüfen |
| Emittent | Straumann Holding AG | zu prüfen |
| Handelsplatz | SIX Swiss Exchange | zu prüfen |
| Handelswährung | CHF | zu prüfen |
| ISIN | `CH1175448666` | Nutzerbeleg; noch gegen Primärquelle abzugleichen |

## Nutzerbelege (05.10.2026)

| Kennzahl | App-Screenshot | UBS/FactSet-Screenshot |
|---|---:|---:|
| Kurs | ca. CHF 91.5 | CHF 91.26 |
| P/E | 38.9 | 2026E 27.21; 2027E 23.36 |
| PEG | 1.25 | PEG(E) 2.10 |
| Dividendenrendite | 1.1 % | 2026E 1.21 % |
| 2026E EPS | — | CHF 3.30 |

> Forward-Schätzwerte (UBS/FactSet) dürfen nicht ohne eindeutige Kennzeichnung mit trailing Kennzahlen (EODHD) verglichen oder im selben Score vermischt werden.

## Offene Beweisfragen

1. Welcher EODHD-Rohwert, Stichtag und Periodenbezug erzeugt das derzeit gespeicherte P/E-/PEG-Feld?
2. Sind Marktkapitalisierung, Gewinn und Währung dieselbe Basis? Falls nein: Selbst-KGV sperren statt still rechnen.
3. Welche Scorequelle wird sichtbar angezeigt (Drei-Score-Satz vs. `stock_signal_cache`)?
4. Ist die gezeigte Gesamtnote mathematisch aus Qualität, Bewertung und Timing hergeleitet und in der UI ausreichend erklärt?
5. Welche allgemeine Validierungsregel ist über Straumann hinaus sicher anwendbar?

## Änderungsgrenze

Keine Portfolio-, Cash-, Ledger-, Transaktions- oder Handelsmutation. Kennzahlen-/Scoreänderungen erst nach Rohdaten- und Gegenquellenbeleg.

## Abschlussbefund

- **Identität bestätigt:** `STMN.SW`, SIX, CHF und `CH1175448666` stimmen zwischen EODHD-Rohantwort und UBS-Nutzerbeleg überein.
- **Keine KGV-Verwechslung in der Datenbank:** EODHD lieferte am 06.10.2026 `PERatio 38.8745` (TTM) und `ForwardPE 26.1097`. UBS/FactSet zeigte 2026E `27.21` und 2027E `23.36`. Die sichtbare Zahl 38,9 war daher TTM, nicht eine fehlerhaft übernommene 2026E-Schätzung.
- **PEG nicht direkt vergleichbar:** EODHD `PEGRatio 1.2548` und FactSet PEG(E) `2.10` verwenden keinen belegten identischen Forecast-/Wachstumsrahmen. Eine Gleichsetzung wäre Datenverfälschung.
- **Signalformel belegt:** Der konkrete Screenshotfall `69 / 24,6 / 67` ergibt im Standardregime `0,5 × 69 + 0 × 24,6 + 0,5 × 67 = 68`. Bewertung ist ein Extremteuer-Wächter, kein positiver Signalbeitrag.
- **Globale Rechenprobe:** 232 vollständig berechenbare Sätze in `stock_scores`, 0 Formelabweichungen; 33 Titel ohne qualifizierte Timingbasis bleiben ehrlich datenbedingt ohne Signal.
- **Umsetzung:** TTM-/Forward-Beschriftungen und getrenntes EODHD-Forward-KGV sichtbar gemacht; Signalbeiträge werden je Titel angezeigt.
