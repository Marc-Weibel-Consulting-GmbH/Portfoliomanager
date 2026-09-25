# Einstandsbasis und erweiterter PDF-Report: Portfolio «Mami»

**Datenstand:** 25. September 2026  
**Autor:** Manus AI

## Fazit

Die sichtbare Kennzahl von **+2,5 %** ist nicht die Summe einzelner Renditen «seit Kauf». Sie beschreibt den **Gesamtzuwachs seit Portfolio-Start**: aktueller Depotwert inklusive Cash abzüglich dokumentierter Kapitalbasis, geteilt durch diese Kapitalbasis. Die Kennzahl wurde deshalb in der Oberfläche in **«Rendite · seit Portfolio-Start»** umbenannt. Sie bleibt eine Gesamtportfoliokennzahl und wird nicht als Einstandsrendite einzelner Titel ausgegeben.

Der frühere PDF-Hinweis «Einstandsdaten fehlen» war für die einzelnen Positionen korrekt. Für CHDVD.SW und die geprüften weiteren Positionen ist kein bestätigter Einstandspreis und kein Einstandsdatum im Portfolio gespeichert. Ein gegen den aktuellen Kurs gesetzter Scheineinstand würde immer künstlich 0,0 % ergeben und wurde daher bewusst nicht erzeugt. Der Positionsdialog zeigt in diesem Fall einen leeren Einstandspreis und ein leeres Datum; ein aktueller Kurs wird nicht als Kaufpreis ausgegeben.

## Trennung der Kennzahlen

| Kennzahl | Berechnung | Aussage |
|---|---|---|
| Rendite seit Portfolio-Start | `(Depotwert inkl. Cash − Kapitalbasis) / Kapitalbasis` | Tatsächliche Veränderung des gesamten Demoportfolios seit dem dokumentierten Portfolio-Start, unabhängig davon, ob für jede Position eine Kaufbasis vorliegt. |
| Rendite seit Kauf einer Position | `(aktueller CHF-Kurs − bestätigter CHF-Einstand) / bestätigter CHF-Einstand` | Nur verfügbar, wenn ein gespeicherter Einstandspreis oder eine Buchungsbasis vorliegt. |
| Einstandsdatum | Gespeichertes Datum oder eindeutiges Kaufdatum aus einer Buchung | Wird bei mehreren Kauftranchen nicht geraten, weil ein Durchschnittspreis kein eindeutiges Einzeldatum besitzt. |

> Ein positiver Depotzuwachs seit Portfolio-Start ersetzt keine positionsbezogene Einstandsbasis. Beide Informationen beantworten unterschiedliche Fragen.

## Verhalten im Positionsdialog

Der Dialog erlaubt weiterhin die manuelle, ausdrücklich durch Speichern bestätigte Korrektur eines durchschnittlichen Einstandspreises und eines Einstandsdatums. Der Benutzer kann ein Datum nur dann sinnvoll hinterlegen, wenn es sich um eine einheitliche Kaufbasis handelt. Bei mehreren Kauftranchen bleibt das Datum leer und der Status lautet **«Mehrere Kauftranchen»**. Es wurden im Zuge dieser Korrektur keine Einstandspreise, Einstandsdaten, Stückzahlen, Cashbestände oder Transaktionen automatisch verändert.

## Erweiterter PDF- und Excel-Export

Die Titelliste im PDF und Excel enthält nun zusätzlich die aktuelle **Dividendenrendite**, das **KGV** und die **annualisierte Fünfjahresvolatilität**. Fehlende Daten werden mit einem Gedankenstrich ausgewiesen, nicht durch Schätzwerte ersetzt. Das Feld Einstandsdatum zeigt den tatsächlichen Status der Positionsbasis, etwa **«Einstandsdaten fehlen»** oder bei belegter Basis ein Datum.

Der PDF-Report enthält drei voneinander getrennte Vergleichscharts. Der erste Chart beginnt am Portfolio-Start und rebaset Portfolio, SPI und S&P 500 am ersten gemeinsamen Handelstag auf 0 %. Der zweite zeigt die YTD-Reihe. Der dritte zeigt die verfügbare Fünfjahresreihe. Bei den längeren Vergleichen handelt es sich um eine gewichtete historische Entwicklung der aktuellen Zusammensetzung in CHF; sie sind keine rückwirkend behauptete Transaktionshistorie. Die Benchmarklinien sind daher Vergleichsreihen, keine Anlageempfehlung.

## Verifikation

Der aktuelle Beispielbericht für «Mami» wurde nach der Änderung im Entwicklungsserver erzeugt und geprüft. Er hat drei Seiten und enthält die Charts **Seit Portfolio-Start**, **YTD** und **5 Jahre** sowie die erweiterten Positionsspalten. Die erste Vergleichsreihe beginnt am 8. September 2026 und endet am 23. September 2026. Der aktuelle Excel-Export enthält die Blätter **Übersicht**, **Titelliste**, **Depotentwicklung** und **Verlustrisiko**. Die Spalten Dividendenrendite, KGV, Volatilität 5J und Einstandsdatum wurden strukturell geprüft.

Die Testabdeckung umfasst die Einstandsstatus-Auflösung, die manuelle Feldbearbeitung, das Exportmodell, die KGV-/Volatilitätswerte und die rebasierte Portfolio-Start-Vergleichsreihe. TypeScript, fokussierte Tests, ein aktualisierter PDF-Export und ein aktualisierter Excel-Export werden vor dem Checkpoint erneut verifiziert.

## References

[1]: https://portfolio.mw/portfolios/4020001 "Portfolio Mami"
