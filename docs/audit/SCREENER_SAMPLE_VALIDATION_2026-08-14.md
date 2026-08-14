# Screener-Stichprobenvalidierung — 20 neu berechnete Aktien

**Stichtag:** 14. August 2026  
**Interner Berechnungszeitraum:** 20:52:31–20:55:00 UTC  
**Externer Preisabruf:** 21:31:49–21:32:03 UTC  
**Ergebnis:** **Kein bestätigter Berechnungsfehler. Keine Produktivlogik geändert.**

> Die Stichprobe ist kein Anlagevorschlag. Sie prüft ausschliesslich, ob die im Screener gespeicherten Markt- und Bewertungskennzahlen mit der gewählten externen Vergleichsbasis übereinstimmen.

## Methode und Kennzahlenvertrag

Die Stichprobe wurde reproduzierbar aus `stock_signal_cache` gezogen: aktive, nicht als ETF kategorisierte Titel mit einem Berechnungszeitpunkt innerhalb der letzten 48 Stunden; Reihenfolge `RAND(20260814)`, anschliessend die ersten 20 Werte. Verglichen wurden der interne Cache sowie Yahoo Finance als externe Markt- und Kennzahlenreferenz. Der Kursvergleich verwendet den regulären Marktpreis. KGV ist als Trailing-KGV und PEG als vom Datenanbieter publizierte Kennzahl behandelt; PEG wird in dieser Prüfung nicht neu berechnet.

| Kennzahl | Materiell ab | Begründung |
|---|---:|---|
| Kurs | 2.00 % relative Abweichung | Tageszeit, Börsenlatenz und Rundung bleiben unterhalb der Schwelle. |
| Trailing-KGV | 10.00 % relative Abweichung | Provider- und Update-Zeitpunkt können TTM-Werte leicht verschieben. |
| PEG | 20.00 % relative Abweichung | Anbieter verwenden unterschiedliche Wachstumshorizonte und Schätzungen. |
| Dividendenrendite | 0.50 Prozentpunkte **und** 20.00 % relativ | Trennt kleine Rundungsdifferenzen von Basisunterschieden. |

## Vollständige Stichprobe und Ergebnis

| Ticker | Kursdifferenz | KGV-Differenz | PEG-Differenz | Dividendenrendite: Befund | Klassifikation | Externe Referenz |
|---|---:|---:|---:|---|---|---|
| NN.AS | 0.00 % | 0.00 % | 0.00 % | 5.18 % / 5.18 % | innerhalb Toleranz | [Yahoo][1] |
| KNIN.SW | 0.00 % | 0.00 % | 0.00 % | 2.86 % / 2.95 % | innerhalb Toleranz | [Yahoo][2] |
| MATX | −0.33 % | −0.34 % | 0.00 % | 0.71 % / 0.71 % | innerhalb Toleranz | [Yahoo][3] |
| LONN.SW | 0.00 % | 0.00 % | 0.00 % | 0.87 % / 0.87 % | innerhalb Toleranz | [Yahoo][4] |
| LLY | −0.21 % | −1.12 % | extern nicht publiziert | 0.57 % / 0.57 % | Basisunterschied PEG | [Yahoo][5] |
| SREN.SW | 0.00 % | 0.00 % | 0.00 % | 4.53 % / 4.56 % | innerhalb Toleranz | [Yahoo][6] |
| TNZ.TO | −0.18 % | −0.21 % | extern nicht publiziert | intern `NULL`, extern 0.00 % | Verfügbarkeit/Semantik | [Yahoo][7] |
| FTK | +0.17 % | −4.62 % | extern nicht publiziert | intern `NULL`, extern 0.00 % | Verfügbarkeit/Semantik | [Yahoo][8] |
| SOFI | +0.67 % | +1.60 % | 0.00 % | intern `NULL`, extern 0.00 % | Verfügbarkeit/Semantik | [Yahoo][9] |
| ANET | +0.03 % | +0.03 % | 0.00 % | intern `NULL`, extern 0.00 % | Verfügbarkeit/Semantik | [Yahoo][10] |
| MC.PA | 0.00 % | 0.00 % | 0.00 % | 2.83 % / 2.80 % | innerhalb Toleranz | [Yahoo][11] |
| ACA.PA | 0.00 % | 0.00 % | 0.00 % | 8.46 % / 8.46 % | innerhalb Toleranz | [Yahoo][12] |
| BE | +0.51 % | +0.51 % | 0.00 % | intern `NULL`, extern 0.00 % | Verfügbarkeit/Semantik | [Yahoo][13] |
| RUS.TO | +0.13 % | −1.64 % | extern nicht publiziert | 2.19 % / 2.19 % | Basisunterschied PEG | [Yahoo][14] |
| BAC | −0.08 % | +0.88 % | 0.00 % | 2.00 % / 1.75 % | Primärquelle bestätigt interne Basis | [Yahoo][15] [BofA][21] |
| RMBS | −0.46 % | −0.45 % | 0.00 % | intern `NULL`, extern 0.00 % | Verfügbarkeit/Semantik | [Yahoo][16] |
| MO | +0.16 % | +0.14 % | 0.00 % | 6.52 % / 6.52 % | innerhalb Toleranz | [Yahoo][17] |
| PATH | +0.16 % | +2.85 % | 0.00 % | intern `NULL`, extern 0.00 % | Verfügbarkeit/Semantik | [Yahoo][18] |
| FLEX | −0.50 % | −0.49 % | 0.00 % | intern `NULL`, extern 0.00 % | Verfügbarkeit/Semantik | [Yahoo][19] |
| ORCL | −0.13 % | −0.12 % | 0.00 % | 1.28 % / 1.30 % | innerhalb Toleranz | [Yahoo][20] |

## Klassifikation und Remediation-Entscheid

**Alle 20 Kurswerte** liegen innerhalb der vorab definierten 2.00-%-Schwelle. Die grösste Kursdifferenz beträgt **+0.67 %** bei SOFI. Die **20 verfügbaren Trailing-KGV-Vergleiche** liegen innerhalb der 10.00-%-Schwelle; die grösste Abweichung beträgt **−4.62 %** bei FTK. Bei den **16 beidseitig verfügbaren PEG-Werten** liegt keine Abweichung vor. Vier externe PEG-Werte sind nicht publiziert, während der Screener einen Anbieterwert führt; dies ist ein Datenabdeckungs-, kein Formelbefund.

Bei der Dividendenrendite sind acht `NULL`-gegen-0.00-%-Fälle vorhanden. Der Screener verwendet `NULL`, wenn der Anbieter keine Zahl liefert; die Vergleichsquelle stellt dieselben Nichtzahler als 0.00 % dar. Diese Darstellung ist fachlich unterschiedlich, aber keine falsche Berechnung. Bei BAC beträgt die Differenz 0.25 Prozentpunkte. Die offizielle Bank-of-America-Mitteilung vom 24. Juli 2026 erklärt den aktuellen Quartalswert von USD 0.32; annualisiert sind das USD 1.28. Auf dem internen Kurs USD 64.4399 ergibt dies 1.9864 %, gerundet **2.00 %**. Der Yahoo-Wert 1.75 % basiert damit auf einer anderen Dividendenbasis (Trailing statt indicated annual), nicht auf einer fehlerhaften Screener-Formel.[21]

**Remediation:** Es gibt keinen bestätigten Berechnungsfehler. Daher wurde bewusst **kein Code-Fix** vorgenommen. Eine Umstellung von `NULL` auf 0.00 % wäre eine Produkt- und Darstellungsvorgabe, keine Korrektur der Finanzberechnung; sie wird nicht ohne separate Entscheidung durchgeführt.

## Nachweisartefakte

Die maschinenlesbare Abweichungstabelle liegt in `docs/audit/screener_sample_comparison.csv` und `docs/audit/screener_sample_comparison.json`. Die direkt abgerufenen externen Kurs- und Profilantworten sind in `docs/audit/screener_external_yahoo_prices_raw.json` und `docs/audit/screener_external_yahoo_raw.json` gespeichert.

## Quellen

[1]: https://finance.yahoo.com/quote/NN.AS/ "Yahoo Finance — NN.AS"
[2]: https://finance.yahoo.com/quote/KNIN.SW/ "Yahoo Finance — KNIN.SW"
[3]: https://finance.yahoo.com/quote/MATX/ "Yahoo Finance — MATX"
[4]: https://finance.yahoo.com/quote/LONN.SW/ "Yahoo Finance — LONN.SW"
[5]: https://finance.yahoo.com/quote/LLY/ "Yahoo Finance — LLY"
[6]: https://finance.yahoo.com/quote/SREN.SW/ "Yahoo Finance — SREN.SW"
[7]: https://finance.yahoo.com/quote/TNZ.TO/ "Yahoo Finance — TNZ.TO"
[8]: https://finance.yahoo.com/quote/FTK/ "Yahoo Finance — FTK"
[9]: https://finance.yahoo.com/quote/SOFI/ "Yahoo Finance — SOFI"
[10]: https://finance.yahoo.com/quote/ANET/ "Yahoo Finance — ANET"
[11]: https://finance.yahoo.com/quote/MC.PA/ "Yahoo Finance — MC.PA"
[12]: https://finance.yahoo.com/quote/ACA.PA/ "Yahoo Finance — ACA.PA"
[13]: https://finance.yahoo.com/quote/BE/ "Yahoo Finance — BE"
[14]: https://finance.yahoo.com/quote/RUS.TO/ "Yahoo Finance — RUS.TO"
[15]: https://finance.yahoo.com/quote/BAC/ "Yahoo Finance — BAC"
[16]: https://finance.yahoo.com/quote/RMBS/ "Yahoo Finance — RMBS"
[17]: https://finance.yahoo.com/quote/MO/ "Yahoo Finance — MO"
[18]: https://finance.yahoo.com/quote/PATH/ "Yahoo Finance — PATH"
[19]: https://finance.yahoo.com/quote/FLEX/ "Yahoo Finance — FLEX"
[20]: https://finance.yahoo.com/quote/ORCL/ "Yahoo Finance — ORCL"
[21]: https://newsroom.bankofamerica.com/content/newsroom/press-releases/2026/07/bank-of-america-increases-common-stock-dividend-14--to--0-32-per.html "Bank of America — Dividendenerhöhung auf USD 0.32 je Aktie"
