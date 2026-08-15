# Novo Nordisk — Diagnose der Dividendenrendite

**Ticker:** `NOVO-B.CO`  
**Untersuchungsdatum:** 15. August 2026  
**Ergebnis:** Die gemeldete Dividendenrendite von 25 % ist im aktuellen Datenbestand **nicht reproduzierbar**. Aktueller Screenerwert: **3.92 %**.

> Es wurde kein Produktivwert überschrieben und keine Berechnungslogik geändert, weil kein aktueller Rechenfehler bestätigt werden konnte.

## Befundkette

| Prüfstufe | Beobachtung | Ergebnis |
|---|---|---|
| Screener-Stammdaten `stocks` | DKK 294.70, Dividendenrendite 3.92 %, letzter Kennzahlenrefresh 15. August 2026 05:57 UTC | korrekt gespeichert |
| Signal-Cache `stock_signal_cache` | DKK 294.70, Dividendenrendite 3.92 %, Berechnung 05:54 UTC | konsistent mit Stammdaten |
| Cache-Detailtext | „Gute Dividende (3.9 %)“ | kein abweichender UI-Detailwert im aktuellen Cache |
| Historie `historicalMetrics` | keine gespeicherte Novo-Nordisk-Rendite über 10 % | kein persistierter 25-%-Ausreisser gefunden |
| Frischer EODHD-Rohdatenabruf | Dividendenrendite 3.92 % | Cache-Mapping und Prozentkonvention stimmen überein |
| Offizielle Novo-Nordisk-Quelle | Interimsdividende 2026: DKK 3.75 | Ausschüttung und Aktie/ADR-Verhältnis bestätigt |
| Unabhängige Sekundärquelle | DKK 11.70 annualisierte Ausschüttung, 3.91 % Rendite bei DKK 299.50 | Größenordnung des Screenerwerts bestätigt |

## Rechengegenprobe

Die unabhängige Referenz führt DKK 7.95 Schlussdividende und DKK 3.75 Interimsdividende für 2026 auf. Die annualisierte Ausschüttung beträgt damit DKK 11.70. Bei DKK 299.50 ergibt sich:

> **DKK 11.70 / DKK 299.50 × 100 = 3.9065 %**, gerundet **3.91 %**.

Der aktuelle Screenerwert 3.92 % liegt damit in der erwartbaren Rundungs- und Kursdifferenz.

## Ursache und Abgrenzung

Die zentrale Einheit lautet Prozent: Ein gespeicherter Wert 3.92 bedeutet 3.92 %, nicht 0.0392. Ein historischer Faktor-100-Fehler wurde bereits über die zentrale Normalisierung, einen idempotenten Reparaturpfad und 16 zielgerichtete Regressionstests abgesichert. Aktuell existiert weder im Screener-Cache noch im Stammwert noch in der gespeicherten Kennzahlenhistorie ein Novo-Nordisk-Wert von 25 %.

Die 25-%-Angabe kann deshalb aus einem früheren Browser-/UI-Cache, einer nicht mehr aktuellen Ansicht oder einer Verwechslung mit einem Faktor- oder Gewichtungswert stammen. Ohne reproduzierbaren aktuellen Wert wäre eine weitere Datenmutation spekulativ und daher nicht vertretbar.

## Weiteres Vorgehen

Die aktive wöchentliche Stichprobenvalidierung überwacht künftig automatisch 20 frisch berechnete Titel. Für eine erneute Einzelfallanalyse benötigen wir bei erneut sichtbaren 25 % einen Screenshot mit URL, Ticker und Uhrzeit oder die genaue Ansicht; dann kann die Client-Antwort gegen den Datenbankwert verglichen werden.

## Referenzen

[1]: https://www.novonordisk.com/investors/stock-information/dividend.html "Novo Nordisk — Dividend pay for investors"
[2]: https://www.investing.com/equities/novo-nordisk-dividends "Investing.com — Novo Nordisk A/S Class B dividends"
