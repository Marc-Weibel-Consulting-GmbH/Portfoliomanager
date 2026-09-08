# Perplexity-Feedback — Portfolio «Mami»

**Quelle:** Vom Nutzer bereitgestellter Textauszug `Pasted_content_20.txt`, 8. September 2026. Die im Anhang enthaltene zeitlich signierte Drittanbieter-URL wird nicht reproduziert.

## Prüffähige Kernaussagen

| Bereich | Behauptung aus dem Feedback | Vorläufiger Prüfstatus |
| --- | --- | --- |
| Snapshotwert / Gewichtung | Der im PDF berichtete Marktwert und die gerundeten Gewichte seien intern plausibel. | Gegen den aktuellen Snapshot getrennt zu prüfen, da das Feedback einen anderen Berichtszeitpunkt nennt. |
| Schweizer Direktpositionen | Stückzahl × Kurs sei bei den meisten Schweizer Titeln plausibel; LUKN.SW weiche etwas stärker ab. | Gegen gespeichertem Kurs, Portfolio-Stückzahl und Zeitstempel prüfen. |
| Fremdwährung | Implizite USD/CHF-Kurse seien im Report konsistent; FX-Zeitpunkt müsse explizit ausgewiesen werden. | Methodik- und Provenienzprüfung nötig. |
| Instrumentidentität | ABTC.SW könne fälschlich als US-Ticker `ABTC` aufgelöst werden; ZGLD.SW sei extern nicht eindeutig. | Hohe Priorität; lokale Alias-, EODHD- und Instrumentmetadaten prüfen. |
| ETF-Look-through | CHDVD.SW werde formal als «Andere» geführt, wirtschaftliche Sektor-/Einzelwert-Exposures seien dadurch nicht sichtbar. | Fachlich plausible Produktanforderung, nicht als Snapshotfehler belegt. |
| Performancekennzahlen | Einzelpositionen mit 0,0 % seit Kauf seien neben positiver Gesamtperformance methodisch missverständlich; TTWROR, XIRR und Modellverlauf sollten getrennt angezeigt werden. | Bestehende Darstellung und Herkunft der Kennzahlen prüfen. |
| Risiko | Sharpe, Volatilität und Drawdown seien ohne vollständige Zeitreihe nicht unabhängig reproduzierbar; Frequenz, rf-Satz, CHF-Basis und Datenstand sollen sichtbar sein. | Transparenz-/Methodikprüfung nötig, kein belegter Berechnungsfehler. |

## Bereits bekannter Abgleichpunkt

Der aktuelle Datenbanksnapshot für `Mami` (`#4020001`) zeigt einen Demo-/Planungsstatus (`isLive = 0`), eine Kapitalbasis von CHF 500'000 und eine Cash-Reserve von CHF 49'047.22. Die im Feedback genannten Marktwerte stammen aus einem anderen PDF-Snapshot und dürfen nicht ohne gemeinsamen Stichtag als aktuelle Abweichung interpretiert werden.

Der heutige Review bleibt rein lesend. Er erzeugt keine Positionen, keine Cashbewegungen, keine Watchlistmutation, keine Transaktion und keine Handelsaktion.

## Abgleich — Ergebnisse

| Priorität | Befund | Bewertung des Perplexity-Feedbacks | Nachweis / Auswirkung |
| --- | --- | --- | --- |
| P0 | Tagesrendite DBS | Bereits vor diesem Review bestätigt und korrigiert: Eine USD-ADR-Historie darf nicht gegen den nativen SGD-Kurs verrechnet werden. | Der aktuelle Datensatz trägt `data_gap`; die Portfolioansicht zeigt anstelle eines Phantomverlusts `—`. |
| P0 | ZGLD-Instrumentidentität | Die generelle Sorge zu Schweizer Fonds-/ETF-Auflösung ist berechtigt. | `ZGLD.SW` wird als gültiger SIX-Ticker erkannt. Die lokale ISIN-Aliasregel weicht jedoch von der börsenbestätigten ISIN `CH0139101593` ab und benötigt eine separate, testgetriebene Korrektur. |
| P1 | Individuelle Rendite «seit Kauf» | **Bestätigt.** `Mami` enthält 35 Demo-Positionen ohne gespeicherte `shares`, `avgBuyPrice` oder `avgBuyPriceCHF` sowie keine Transaktionen. | Der Portfolio-Router ersetzt die fehlende Einstandsbasis je Position mit dem aktuellen CHF-Kurs; daraus folgt technisch 0,0 %. Die Anzeige ist nachvollziehbar, aber als Rendite missverständlich. Sie muss als «Einstandsdaten fehlen» gekennzeichnet oder bei vorhandener Erstellungsbasis korrekt rückbefüllt werden. |
| P1 | Gesamtkennzahl gegenüber Positionskennzahlen | Die Kritik am Nebeneinander von positiver Gesamtkennzahl und 0,0 %-Positionswerten ist fachlich berechtigt. | Die Gesamtkennzahl rechnet aus Gesamtwert inklusive Cash, während die Positionen ohne Einstandsbasis den aktuellen Kurs als Ersatz verwenden. Das sind verschiedene Datenverträge und dürfen nicht gleich bezeichnet werden. |
| P1 | ABTC.SW als US-Tickerkollision | **Nicht als aktueller Projektfehler belegt.** | Die zentrale Symbolauflösung belässt `ABTC.SW` unverändert; zusätzlich existiert der Alias `CH0454664001 → ABTC.SW`. Die offizielle 21Shares-Seite bestätigt genau diese ISIN, das CHF-SIX-Listing und den Valor. Das fehlende ISIN-/MIC-Feld in der Stammaktienzeile bleibt dennoch eine echte strukturelle Lücke. |
| P2 | CHDVD-Look-through | Als Erweiterung berechtigt, nicht als Fehler der direkten Ansicht. | CHDVD ist ein physisch replizierender CHF-ETF mit 20 Einzeltiteln. Die heutige Sektoransicht klassifiziert die direkte ETF-Position, nicht wirtschaftliche Durchschau. Beide Sichten sollten ausdrücklich getrennt angeboten werden. |
| P2 | Sharpe, Volatilität, Drawdown | Kein Berechnungsfehler ist mit dem vorliegenden PDF belegt; die Forderung nach Methodentransparenz ist jedoch richtig. | Ohne gemeinsame Wertreihe, Stichtags-Cut-off, Frequenz, risikofreien Satz und Cashflow-Zeitpunkte lassen sich die Werte nicht unabhängig reproduzieren. Eine Methodikzeile nahe der Kennzahl ist sinnvoll. |
| P3 | LUKN- und übrige Snapshotabweichungen | Nicht als aktueller Fehler belegt. | Das Feedback vergleicht einen PDF-Snapshot mit Kursen eines möglicherweise anderen Zeitpunkts. Der aktuelle `Mami`-Entwurf enthält für LUKN einen anderen gespeicherten Kurs; ohne identischen Stichtag wäre eine Fehlerbehauptung nicht belastbar. |

## Quellengebundene Korrektur des externen Feedbacks

Die Aussage, `ABTC.SW` werde im Portfoliomanager als US-Ticker `ABTC` aufgelöst, trifft für den aktuellen Codepfad nicht zu. Die offizielle Produktseite beschreibt das 21shares Bitcoin ETP mit ISIN `CH0454664001`, Valor `45466400` und einer SIX-CHF-Notiz. Der Perplexity-Hinweis hat dennoch den richtigen Architekturpunkt berührt: Ein Tickernamen allein genügt nicht als unveränderliche Instrumentidentität.

Auch `ZGLD.SW` ist nicht bloss ein unauffindbarer Ticker. Die Börsenquellen belegen `ZGLD` für den CHF-Gold-ETF mit ISIN `CH0139101593`. Damit ist die aktuelle Tickerbasis plausibel, während die abweichende lokale ISIN-Aliasregel zwingend separat zu verifizieren und zu korrigieren ist.

## Empfohlene Reihenfolge für einen späteren, explizit freigegebenen Umsetzungsstrang

1. **Instrumentidentität absichern.** Eine kleine, getestete Normalisierung für `isin`, Börsenplatz/MIC, Handelswährung, `securityType` und nachweisliche EODHD-Quelle einführen. Beginn mit ZGLD, ABTC und den bereits als Proxy markierten DBS-/ADR-Fällen. Keine bestehende Preisreihe überschreiben.
2. **Demo-Einstand und Performanceanzeige bereinigen.** Für neue Demoportfolios den schon bei der Erstellung bekannten CHF-Einstand explizit speichern. Für bestehende Entwürfe keine historische Einstandsrate erfinden: entweder klar «Einstandsdaten fehlen» ausweisen oder nur mit einem nachvollziehbaren, vom Nutzer bestätigten Rekonstruktionsdatum arbeiten.
3. **Direkt- und Look-through-Sicht klar trennen.** Die bestehende direkte Sektoransicht unverändert belassen und eine gesonderte, datierte ETF-Durchschau mit Quellen-/Datenlückenhinweis aufbauen. Für CHDVD dürfen die tagesaktuellen Fondsgewichte nicht ohne festgehaltenen Stichtag mit historischen Portfoliogewichten vermischt werden.
4. **Kennzahlenmethodik sichtbar machen.** Pro KPI Zeitraum, Frequenz, CHF-Basis, Risikofreier Satz, Kurs-/FX-Cut-off, Total-Return-/Preisreihe und Datenlückenstatus ausweisen. TTWROR, XIRR und Modellverlauf nur bei erfüllter Datengrundlage getrennt anzeigen.

## Quellen

1. [21Shares — 21shares Bitcoin ETP, ABTC](https://www.21shares.com/en-eu/product/abtc), abgerufen am 8. September 2026.
2. [iShares / BlackRock — iShares Swiss Dividend ETF (CH), CHDVD](https://www.ishares.com/ch/individual/en/products/264108/ishares-swiss-dividend-ch-fund), abgerufen am 8. September 2026.
3. [SIX Structured Products — Swisscanto (CH) Gold ETF EA CHF, ZGLD](https://www.six-structured-products.com/en/underlying/zkb-gold-etf-chf-CH0139101593), abgerufen am 8. September 2026.
4. [BX Swiss — ZKB Gold ETF AA, CH0139101593](https://www.bxswiss.com/instruments/CH0139101593), abgerufen am 8. September 2026.
5. Nutzerbereitgestelltes Perplexity-Feedback `Pasted_content_20.txt`, 8. September 2026.
