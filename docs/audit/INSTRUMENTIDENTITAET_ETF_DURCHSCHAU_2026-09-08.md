# Instrumentidentität und ETF-Durchschau — Portfolio «Mami»

## Einordnung

Die Ergänzung ist **eine Datenintegritäts- und Transparenzfunktion**, keine Handels- oder Anlageempfehlung. Die Identitätsangabe reduziert das Risiko, dass ein gleichlautender Basisticker, ein ADR oder eine andere Anteilsklasse versehentlich als der gehaltene Titel interpretiert wird. Besonders nach dem DBS-Proxybefund und der ZGLD-ISIN-Korrektur ist dies sachlich sinnvoll.

Eine vollständige Fonds-Durchschau mit Bestandstiteln und Sektorgewichten wäre bei CHDVD wegen der direkten ETF-Quote von 19,7 % wirtschaftlich relevant. Die offizielle iShares-Seite nennt jedoch zwar Bestandanzahl, Datenstand und Downloadmöglichkeit, beschränkt die Weiterverbreitung der Bestanddaten aber ausdrücklich. Ohne einen lizenzierten, zeitnahen und redistributionsfähigen Bestanddatenvertrag zeigt die Anwendung daher **keine** scheinpräzisen Titel- oder Sektorgewichte.

## Umgesetzter Vertrag

| Funktion | Umsetzung | Abgrenzung |
| --- | --- | --- |
| Instrumentidentität | Datiertes, quellengebundenes ISIN-/Börsenplatz-/MIC-/Handelswährung-Disclosure für `CHDVD.SW`, `ZGLD.SW` und `ABTC.SW`. | Ergänzt die unvollständigen Vendor-Stammdaten read-only; keine Datenbankwerte werden überschrieben. |
| Unvollständige Identität | Unbekannte Titel erhalten keine geratenen Kennungen. | Ihre aktuelle Handelswährung bleibt sichtbar, ISIN/Börse/MIC bleiben explizit unvollständig. |
| CHDVD-Durchschau | Direkte ETF-Quote, Anzahl Einzeltitel, Datenstand, Markt-/Ertragsfokus und Indexmethodik. | Keine Bestandstitel, keine Titelgewichte, keine implizite Sektoranrechnung. |
| Direkte vs. wirtschaftliche Allokation | Die direkte ETF-Quote bleibt massgeblich. | Eine wirtschaftliche Titel-/Sektordurchschau wird ausdrücklich nicht berechnet, solange keine lizenzierte und aktualisierbare Datenbasis vorliegt. |

## Live-Nachweis

Am 8. September 2026 wurde das CHDVD-Detail im Portfolio «Mami» (`#4020001`) rein lesend geöffnet. Sichtbar waren die geprüfte ISIN `CH0237935637`, SIX Swiss Exchange (`XSWX`), CHF als Handelswährung und Datenstand `2026-09-07`. Der Durchschaubereich weist die direkte Allokation von `19,7 %`, 20 Einzeltitel und die Methodik «SPI Select Dividend 20 Total Return Index» aus. Er erklärt zudem klar, dass Titel- und Sektorgewichte nicht berechnet werden. Keine Position, Cashreserve, Preisreihe, Transaktion oder Handelsaktion wurde ausgelöst.

## Quellen

1. [iShares Swiss Dividend ETF (CH), offizielle Fondsseite](https://www.ishares.com/ch/individual/en/products/264108/ishares-swiss-dividend-ch-fund), abgerufen am 8. September 2026; Fondskennzahlen und Bestanddatenstand 7. September 2026.
2. [21Shares Bitcoin ETP (ABTC), offizielle Produktseite](https://www.21shares.com/en-eu/product/abtc), abgerufen am 8. September 2026.
3. [SIX Structured Products — ZKB Gold ETF CHF (ZGLD)](https://www.six-structured-products.com/en/underlying/zkb-gold-etf-chf-CH0139101593), abgerufen am 8. September 2026.
