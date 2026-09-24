# Vollständige Aktien-Neuoptimierung: lesbare Kandidatendetails

**Datum:** 24. September 2026  
**Autor:** Manus AI

## Ergebnis

Die vollständige Aktien-Neuoptimierung schreibt nun für jeden vorgeschlagenen Titel **Ticker und ausgeschriebenen Unternehmensnamen** aus. Jede Kartenzeile ist anklickbar. Der Klick öffnet eine lesende Detailansicht mit Kurs, Dividendenrendite, KGV, PEG, Beta, Sharpe Ratio, 1-Jahres-Kurschart sowie Qualität, Bewertung, Timing und Signal.

Die Ansicht ist bewusst **nicht transaktional**. Sie verändert weder die Vorschau noch Positionen, Cash, Buchungen, Orders oder die Aktivierung des Portfolios.

## Robuste Datenbasis

Der erste Live-Test zeigte, dass die Detailansicht auf eine Live-Abfrage von EODHD-Fundamentals und einer Live-Kursserie warten konnte. Das erzeugte bei einem Providerfehler einen sichtbaren Ladezustand. Der Pfad verwendet deshalb jetzt ausschließlich die bereits gespeicherten Daten der Anwendung:

- Stammdaten und Kennzahlen aus dem Aktienbestand;
- gespeicherte Drei-Scores aus `stock_scores`;
- die additive historische EODHD-Kursreihe aus `historical_prices`.

Der Chart verwendet bevorzugt den gespeicherten splitbereinigten Schlusskurs. Wenn dieser fehlt, verwendet er den dokumentierten Schlusskurs. Fehlende oder ungültige Kurse werden nicht geschätzt. Bei einer historischen ADR-/Proxyreihe in abweichender Preiswährung erscheint eine begründete Datenlücke statt einer irreführenden Kursentwicklung.

## Live-Nachweis

Der angemeldete Entwicklungsserver wurde am Portfolio **Mami** getestet. Nach einer rein lesenden 3-Jahres-Vorschau erschien beispielsweise `MOH.AT · Motor Oil (Hellas) Corinth Refineries S.A` mit einem anklickbaren Detaildialog. Die Details zeigten die gespeicherte Kursreihe, Dividendenrendite, KGV, PEG, Beta, Sharpe sowie alle verfügbaren Drei-Scores. Der Dialog enthielt keine Kauf-, Tausch- oder Umsetzungsaktion.

| Kontrolle | Ergebnis |
|---|---|
| Firmenname neben Ticker | Bestanden |
| Kandidat anklickbar | Bestanden |
| Kurschart aus gespeichertem Datenbestand | Bestanden |
| Kennzahlen und Drei-Scores | Bestanden, soweit Daten verfügbar |
| Mutation über den Detaildialog | Nicht vorhanden |
| Typprüfung | Bestanden |
| Fokussierte Regression | 3 Testdateien, 9 Tests bestanden |

## Abgrenzung

Die Neuoptimierung bleibt eine **nur lesende, historische Vorschau**. Die dargestellten Kennzahlen sind keine Prognose und keine Aufforderung zum Kauf oder Verkauf. Eine spätere Portfolioübernahme bleibt ein eigener, ausdrücklich bestätigter Vorgang.

## References

[1]: https://3000-is8njn3ye2p4cjooffyv0-6428be6f.us4.manus.computer/portfolios/4020001?tab=optimierung "Entwicklungsansicht der vollständigen Aktien-Neuoptimierung"
