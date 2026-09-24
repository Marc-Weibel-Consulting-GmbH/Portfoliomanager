# CHDVD: Quellenabgleich und ETF-Look-through

**Datenstand der Prüfung:** 24. September 2026.  
**Instrument:** iShares Swiss Dividend ETF (CH), SIX Swiss Exchange, ISIN `CH0237935637`, Handelswährung CHF.

## Ergebnis

Ein wirtschaftlicher Look-through ist für CHDVD technisch möglich und wurde als **gewichtete, nicht redistributive Komponentenaggregation** ergänzt. Die Anwendung liest dafür die aktuelle EODHD-ETF-Bestandliste, prüft Fondsidentität, Bestandszahl und Gewichtssumme und berechnet Qualität, Bewertung und Timing für die zugrundeliegenden Schweizer Aktien. In der Oberfläche erscheinen ausschliesslich die drei gewichteten Scores, ihr Datenstand und die jeweilige Abdeckung. Einzelne Bestandstitel und Einzelgewichte werden weder gespeichert noch angezeigt.

Die erste Live-Prüfung liefert für CHDVD eine vollständige technische Timing-Abdeckung, aber für Qualität und Bewertung nur eine Gewichtungsabdeckung unter dem verbindlichen Mindestwert von 90 %. Die Anwendung zeigt deshalb für Qualität und Bewertung bewusst `—` statt einen scheinbar präzisen Mittelwert zu erfinden. Das Timing erscheint mit 56,2/100. Ein zusammengefasstes ETF-Handelssignal wird nicht berechnet, weil die Regimegewichte und der Bewertungswächter nicht linear mittelt werden dürfen.

## Abgleich der iShares-Angaben mit der Anwendung

| Kennzahl | iShares | Anwendung / EODHD | Beurteilung |
| --- | ---: | ---: | --- |
| Bestandteile | 20, Stand 22.09.2026 | 20, EODHD aktualisiert 23.09.2026 | Bestandzahl und ISIN stimmen überein. |
| Gewichtssumme der verfügbaren EODHD-Bestandliste | — | 98,83 % | Für eine ETF-Bestandliste plausibel, jedoch nicht als 100,00-%-Rekonstruktion ausgegeben. |
| Nachlaufende 12-Monats-Dividendenrendite | 3,48 %, Stand 22.09.2026 | 4,17 %, gespeicherter Vendorwert vom 23.09.2026 | Abweichung von 0,69 Prozentpunkten. Die Kennzahlbasis ist nicht belegt gleich; der primäre iShares-Wert ist für CHDVD der Referenzwert. |
| KGV | 18,99×, Stand 22.09.2026 | 20,199697×, Vendorwert vom 23.09.2026 | Abweichung von 1,209697× bzw. 6,37 %. Snapshot- oder Methodikunterschied möglich; kein stilles Überschreiben von Stammdaten. |
| Standardabweichung 3 Jahre | 10,40 %, Stand 31.08.2026 | 12,469432 % aus EODHD-adjustierten Börsenschlusskursen über exakt 31.08.2023–31.08.2026 | Abweichung von 2,069432 Prozentpunkten. Der iShares-Wert und die Börsenkursreihe sind nicht ohne Weiteres austauschbar, insbesondere wegen NAV-/Kurs- und Adjustierungsbasis. |
| Volatilität 5 Jahre | iShares-Angabe nicht vorliegend | 13,032338 % aus 1'257 splitbereinigten Handelstagen bis 23.09.2026 | Die neue Positionsspalte ist bewusst ein eigenes 5-Jahres-Kursmass und kein Ersatz für die iShares-3-Jahres-Standardabweichung. |

Die Anwendung darf die 5-Jahres-Volatilität daher weiterhin mit **13,0 %** ausweisen, muss sie aber klar als Kursreihenkennzahl auf EODHD-Basis bezeichnen. Ein Vergleich mit der iShares-Zahl 10,40 % ist nur mit dem ausdrücklichen Hinweis auf die unterschiedlichen Zeitfenster und Messbasen sinnvoll.

## Look-through-Vertrag

Der neue Pfad gilt vorerst ausschliesslich für `CHDVD.SW`. Vor jeder Berechnung werden ETF-Typ, ISIN, erwartete Bestandszahl von 20, vollständige SIX-Kennung der Bestandteile und eine Gewichtssumme zwischen 98 % und 101 % geprüft. Ein fehlgeschlagener Gate führt zu keiner Ausgabe von Look-through-Scores.

Für jede Säule wird der gewichtete Mittelwert unabhängig gebildet. Mindestens 90 % des verfügbaren ETF-Gewichts müssen für die betreffende Säule mit berechenbaren Titeldaten abgedeckt sein. Eine vorhandene Qualität kompensiert keine fehlende Bewertung, und umgekehrt. Das verhindert eine unzulässige Normierung auf eine zu kleine Teilmenge.

| Look-through-Säule | Abdeckung beim geprüften Stand | Ergebnis |
| --- | ---: | --- |
| Qualität | 80,8 % | `—`, da unter 90 % |
| Bewertung | 80,8 % | `—`, da unter 90 % |
| Timing | 100,0 % | 56,2/100 |

Die Ursache der Lücke ist nicht eine geschätzte Gewichtung, sondern eine aktuell unzureichende Fundamentaldatenabdeckung einzelner, kleinerer CHDVD-Bestandteile. Der Wert wird nicht hochgerechnet. Sobald die fehlenden Primär-/EODHD-Fundamentaldaten in ausreichender Qualität vorliegen, erscheinen Qualität und Bewertung automatisch mit derselben Berechnungsmethode wie für direkte Aktienpositionen.

## Nächste Daten-Governance-Massnahme

Für CHDVD sollten direkte Fondskennzahlen künftig als **datierte Primärquellen-Overlayfelder** geführt werden: Dividendenrendite, KGV, Kurs-Buchwert, 3-Jahres-Beta und 3-Jahres-Standardabweichung jeweils mit Definition, Stichtag, Quelle und Ablaufdatum. Dieses Overlay darf keine EODHD-Kursreihe oder die separate 5-Jahres-Volatilitätsberechnung überschreiben. Es löst die sichtbare Kennzahlabweichung, ohne Historie oder Vendorstammdaten destruktiv zu verändern.

## Validierung

Die reine Aggregationslogik ist mit vier Regressionstests abgedeckt. Getestet wurden die korrekte gewichtete Mittelung, das 90-%-Abdeckungsgate, die unabhängige Behandlung der drei Säulen und die Ablehnung einer unplausiblen Gewichtssumme. TypeScript war nach der Integration fehlerfrei. Die Live-Prüfung des Serverpfads bestätigte den aktuellen, bewusst nicht hochgerechneten Status von Qualität und Bewertung sowie den Timing-Score 56,2/100.

## References

[1]: https://www.ishares.com/ch/individual/en/products/264108/ishares-swiss-dividend-ch-fund "iShares Swiss Dividend ETF (CH) — official fund page"
[2]: https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds "EODHD Fundamental Data: Stocks, ETFs, Mutual Funds, Indices"
