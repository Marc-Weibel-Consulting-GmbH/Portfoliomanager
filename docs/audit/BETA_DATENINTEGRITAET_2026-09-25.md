# Beta-Datenintegrität für Portfolio «Mami»

**Datum:** 25. September 2026  
**Status:** Korrigiert und verifiziert  
**Geltungsbereich:** Risikotab des Portfolios, rein lesende Kennzahlenberechnung

## Ergebnis

Der zuvor angezeigte Betawert von **0.00** war **nicht belastbar**. Die Ursache war keine echte Marktentkopplung des Portfolios, sondern eine fehlerhafte Paarung der täglichen Portfolio- und Benchmarkrenditen. Nach Bereinigung und datumsgleicher Paarung zeigt die Entwicklungsansicht für Portfolio **4020001 «Mami»** einen Betawert von **0.51 gegenüber dem SPI**.

> **Beta** misst die historische Sensitivität einer Renditereihe gegenüber einem Benchmark. Sie wird als Kovarianz der Portfolio- und Marktrenditen dividiert durch die Varianz der Marktrenditen berechnet. Ein Wert unter 1 bedeutet in diesem historischen Fenster eine geringere Marktsensitivität als der Benchmark; er ist keine Prognose. [1]

## Befund

Die Tabelle `benchmarkData` enthielt im verwendeten Einjahresfenster **83’651 Datensätze für nur 250 unterschiedliche Handelstage**. Pro Handelstag waren typischerweise 351 additive Importzeilen vorhanden; einzelne Tage enthielten drei abweichende Schlusskurse. Die bisherige Logik berechnete tägliche Portfolio- und Benchmarkrenditen als zwei Arrays und verglich diese anschliessend nach Array-Index. Damit wurden aufgrund der Duplikate und unterschiedlicher Börsenfeiertage Renditen verschiedener Tage gegeneinander gestellt. Die resultierende Benchmarkvarianz war faktisch nicht aussagekräftig und der Wert wurde als `0.00` angezeigt.

Die Gegenprüfung bei EODHD für den 25. September 2025 ergab für `CHSPI.SW` einen Rohschluss von **CHF 143.90** und einen split-/ausschüttungsbereinigten Schluss von **CHF 140.0159**. Die Serie nutzt für Renditekennzahlen die bereinigte Basis. Es wurden weder Benchmark- noch Portfoliohistorien gelöscht oder überschrieben.

## Korrigierte Berechnung

Die Korrektur verarbeitet additive Daten ausschliesslich lesend. Für jeden Benchmarkhandelstag wird die zeitlich zuletzt importierte, valide EODHD-Beobachtung ausgewählt. Danach werden sowohl Portfolio- als auch Benchmarkwerte in tägliche Renditen überführt. Eine Beta-Beobachtung entsteht nur, wenn beide Renditen denselben Handelstag tragen.

| Schritt | Berechnung |
|---|---|
| 1. Benchmark bereinigen | Genau ein gültiger Schlusswert je Datum; bei Duplikaten gewinnt die zuletzt importierte Zeile. |
| 2. Portfolio-Rendite | \(r_{P,t} = V_t/V_{t-1} - 1\) aus der CHF-Portfoliowertreihe inklusive Demo-Cash. |
| 3. SPI-Rendite | \(r_{SPI,t} = B_t/B_{t-1} - 1\) aus der bereinigten CHSPI.SW-Reihe. |
| 4. Zeitachsen verbinden | Ausschliesslich Paare mit identischem Datum \(t\) werden verwendet. |
| 5. Beta | \(\beta = \operatorname{Cov}(r_P, r_{SPI}) / \operatorname{Var}(r_{SPI})\). |
| 6. Datenlücke | Bei weniger als 11 gemeinsamen Renditetagen oder ohne Benchmarkvarianz zeigt die Oberfläche `—` statt `0.00`. |

## Verifikation

Der lokale, schreibgeschützte Abgleich ergab 258 Portfolio-Werttage, 257 Portfolio-Renditetage und 249 gemeinsame Renditepaare mit der deduplizierten Benchmarkreihe. Die unabhängige Paarberechnung ergab Beta **0.4825** vor der UI-Rundung. Der anschliessende Live-Aufruf der Risikoansicht berechnete mit der aktuellen, vollständigen Entwicklungsreihe **0.51** und zeigte diesen Wert im Risikotab an.

Die Tests für Duplikatbereinigung, datumsgleiche Paarung, Betaformel und Datenlücke bestanden. TypeScript war fehlerfrei. Die Änderung erzeugt keine Positionen, Cashbewegungen, Transaktionen, Buchungen, Aufträge oder Aktivierungen.

## Quellen

[1]: https://www.investopedia.com/terms/b/beta.asp "What Beta Means for Investors"
