# RO.SW – Roche Holding AG (Prüfbericht)

**Stichtag des Auftrags:** 25.09.2026, 09:22 Europe/Zurich.  
**Geprüfte Identität:** Roche Holding AG; primäre Schweizer Handelslinie laut Entity Card: **SIX Swiss Exchange, CHF**. Die Roche-FAQ weist jedoch für die seit 11.03.2026 umgetauschten Genussscheine die neue Partizipationsschein-Linie **ROP**, ISIN CH1499059983, aus; die Stammaktie ist **RO**, ISIN CH0012032113. Damit ist „RO.SW“ als Yahoo-/Datenanbieter-Symbol nicht selbsterklärend: Es muss vor einer automatisierten Übernahme geklärt werden, ob die Titelliste die Stammaktie RO oder den Partizipationsschein ROP meint. Ein ADR ist es nicht. Roche bestätigt, dass beide Schweizer Titel an der SIX gehandelt werden und Partizipationsscheine ökonomisch je einem Anteil an Gewinn/Liquidation entsprechen. Quellen: [Roche Investor FAQ](https://www.roche.com/investors/faq_investors), [SIX Share Explorer – Roche I](https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0012032113CHF4.html).

## Executive Summary

1. Die Entity Card bezeichnet RO.SW als Roche-Partizipationsschein; die aktuelle Roche-FAQ nennt dafür seit März 2026 den Ticker **ROP**, während **RO** die Stammaktie ist. Die Identität/Ticker-Zuordnung ist deshalb eine relevante Korrektur bzw. Datenlücke.
2. Handelsplatz und Währung sind SIX Swiss Exchange und CHF; ein ADR-/GDR-Verhältnis ist für die Schweizer Linie nicht anzuwenden.
3. Roche schlug für das Geschäftsjahr 2025 CHF 9.80 je Aktie und je Partizipationsschein vor; der Finanzbericht nennt IFRS diluted EPS CHF 16.04 und Core EPS CHF 19.46.
4. Die beobachtbare reguläre Forward-Dividendenrendite ist bei einem Kurs von CHF 376.60 rund **2.6%** (9.80 / 376.60); Yahoo weist am 25.09.2026 zugleich ein TTM-KGV 24.47 und Forward-KGV 17.04 aus.
5. Die ursprüngliche Dividendenrendite von 2.6% ist damit plausibel, aber nur bei einem Kurs um CHF 376. Die Digrin-Seite enthält widersprüchliche/stale Kursstände (CHF 322.30) und ist für den exakten 09:22-Kurs nicht geeignet.
6. Eine belastbare eigene YTD- und 5J-Tagesvolatilitätsberechnung war mit den im Zugriff tatsächlich prüfbaren Seiten nicht reproduzierbar: der Yahoo-Chart-Endpunkt war nicht extrahierbar, Digrin liefert nur Monatsdaten und im September 2026 einen offensichtlich veralteten Preis. Daher werden hierfür keine Scheingenauigkeitswerte als verifiziert ausgegeben.

## Kennzahlen und Methodik

| Kennzahl | Verifiziert | Basis / Beurteilung |
|---|---:|---|
| Handelslinie | SIX; RO = bearer share, ROP = participation certificate | **Identitätsprüfung offen:** Entity Card nennt RO.SW als Participation Certificate, Roche nennt dafür ROP ab 2026-03-11 |
| Handelswährung | CHF | Roche-/Yahoo-Seiten und SIX-Kontext |
| Kurs am 25.09.2026 | CHF 376.60 | Yahoo, 10:14:12 GMT+2; nach dem angeforderten 09:22-Zeitpunkt, daher nur Kontrollwert, nicht exakter Stichtags-Schlusskurs |
| YTD reine Kursrendite | **nicht abschließend verifizierbar** | Sollformel: (Schlusskurs 24.09.2026 / Schlusskurs 31.12.2025 − 1); keine belastbare Tagesreihe im tatsächlich geöffneten Datenmaterial |
| YTD proxy (nicht verwenden als Endwert) | 14.7% | CHF 328.20 (Digrin Dec-2025 „Real price“) → CHF 376.60 (Yahoo 25.09.2026 10:14); Zeitstempel und Linienabweichung verhindern Endwertfreigabe |
| Dividende Forward | CHF 9.80 je Titel | Roche Finance Report 2025: Board-Vorschlag für 2025, AGM-Genehmigung vorausgesetzt; Digrin zeigt am 25.09.2026 letzte Dividende CHF 9.80 |
| Dividendenrendite Forward | **2.6%** | 9.80 / 376.60 = 2.602%; reguläre Jahresdividende, keine Sonderdividende |
| Dividende TTM | CHF 9.80 | Letzte Ex-Dividende 12.03.2026 laut Digrin; vorher 9.70 am 27.03.2025 |
| Dividendenrendite TTM | **2.6%** | 9.80 / 376.60 = 2.602%; definitionsgemäß kursabhängig. Yahoo-Seite zeigt die Renditefelder im HTML nicht befüllt, daher eigene Rechnung aus geöffneten Werten |
| KGV TTM | 24.47 | Yahoo Finance Key Statistics, „Trailing P/E“, Währung CHF; unabhängige Kontrollseite Digrin zeigt P/E 20.11 bei stale CHF 322.30 und EPS 16.03 – Definitions-/Zeitpunktkonflikt |
| KGV Forward | 17.04 | Yahoo Finance Key Statistics, „Forward P/E“ |
| EPS reported TTM / 2025 | CHF 16.04 diluted IFRS | Roche Finance Report 2025; 2025-Jahreswert, nicht automatisch identisch mit Yahoo-TTM-EPS |
| Core EPS 2025 | CHF 19.46 | Roche Finance Report 2025; nicht für das reported-TTM-KGV mit IFRS-EPS vermischen |
| 5J-Volatilität | **nicht abschließend verifizierbar** | Gewünschte Definition wäre Standardabweichung täglicher (splitbereinigter) Kursrenditen 25.09.2021–24.09.2026 × √252; keine zugängliche/reproduzierbare Tagesreihe |

### Dividende: TTM versus Forward

Der Roche-Finanzbericht 2025 nennt CHF 9.80 als vom Verwaltungsrat vorgeschlagene Dividende für 2025, nach CHF 9.70 für 2024. Digrin bestätigt am 25.09.2026 CHF 9.80 als letzte Dividende und listet die Ex-Termine 12.03.2026 (CHF 9.80) und 27.03.2025 (CHF 9.70). Da Roche jährlich ausschüttet und am Stichtag die letzte reguläre Zahlung CHF 9.80 beträgt, sind Forward- und TTM-Betrag für diese Momentaufnahme identisch. Die Rendite 2.6% ist eine Rechnung aus CHF 9.80 / CHF 376.60; bei Verwendung des veralteten Digrin-Preises CHF 322.30 ergäbe sich 3.04%, was die dort ebenfalls ausgewiesene Forward Yield erklärt. Das ist kein wirtschaftlicher Widerspruch, sondern ein Kurszeitpunkt-/Datenstandsproblem.

### KGV: reported, Core und Forward strikt trennen

Roche berichtet für 2025 IFRS diluted EPS von CHF 16.04 und Core EPS von CHF 19.46. Yahoo Finance weist für die referenzierte Quote TTM P/E 24.47 und Forward P/E 17.04 aus. Der Digrin-Kontrollwert P/E 20.11 basiert auf CHF 322.30 und EPS CHF 16.03; er ist wegen des erkennbar stale Preises nicht mit dem Yahoo-Multiple zum selben Kurszeitpunkt vergleichbar. Das ursprüngliche KGV 24.46 ist praktisch mit Yahoo TTM 24.47 bestätigt (Rundungsdifferenz 0.01). Das Forward-KGV 17.04 bleibt separat und darf nicht als TTM-Wert verwendet werden.

### YTD und Volatilität

Die verbindliche Hauptdefinition verlangt unadjustierte Schlusskurse in Handelswährung sowie tägliche Renditen über fünf Jahre. Digrin stellt nur Monatsdaten bereit und weist für Juli/August 2026 unverändert CHF 322.30 aus, während Yahoo am 25.09.2026 CHF 376.60 zeigt. Der daraus erkennbare Datenbruch macht Digrin für eine Tagesdatenberechnung ungeeignet. Der geöffnete Yahoo-Chart-API-Endpunkt lieferte keinen extrahierbaren Datensatz. Folglich werden weder die 14.7%-Proxy-YTD noch eine aus fremden Monats-/Stale-Daten abgeleitete Volatilität als verifiziert empfohlen. Adjusted/Unadjusted und Kurs/Total Return wurden nicht vermischt; eine separate Total-Return-Zahl konnte aus den zugänglichen Primär-/Kontrollseiten nicht reproduziert werden.

## Vergleich mit Ausgangswerten

| Kennzahl | Bisher | Verifiziert / Empfehlung | Beurteilung |
|---|---:|---:|---|
| YTD Kurs | 12.6% | nicht abschließend verifizierbar; 14.7% nur Proxy | 🟡 Datenreihe/Linien-ID fehlt |
| Dividendenrendite | 2.6% | 2.6% bei CHF 376.60 | ✅ plausibel/bestätigt |
| KGV | 24.46 | TTM 24.47; Forward 17.04 | ✅ TTM bestätigt, Forward separat |
| 5J-Volatilität | 22.2% | nicht abschließend verifizierbar | 🟡 keine reproduzierbare Tagesreihe |

## Eindeutige Korrekturen

- **RO.SW – Handelslinie – Partizipationsschein unter RO.SW – ROP (ISIN CH1499059983) ab 11.03.2026; RO ist die Stammaktie (ISIN CH0012032113) – Roche-FAQ führt die Linien getrennt; falsche Instrumentidentität würde Kurs-/Corporate-Action-Reihen vermischen.**

Die Prozentwerte 2.6% und TTM-KGV 24.46/24.47 werden nicht als Korrektur zurückgegeben, da sie nach Definition und Rundung bestätigt sind. YTD und Vola werden wegen fehlender nachweisbarer Tagesreihe nicht spekulativ korrigiert.

## Quellen (tatsächlich geöffnet)

1. Roche Holding AG, **Frequently asked questions** – Ticker, SIX, CHF/ADR-Abgrenzung, Umtausch zu ROP, Rechte, ADR-Verhältnis: https://www.roche.com/investors/faq_investors
2. Roche Group, **Finance Report 2025** – IFRS diluted EPS CHF 16.04, Core EPS CHF 19.46, Dividende CHF 9.80, Ausschüttungshistorie: https://assets.roche.com/f/176343/x/fca190f63e/fb25e.pdf
3. Roche Group, **Annual Report 2025** – Dividendenvorschlag CHF 9.80 und Geschäftsentwicklung: https://assets.roche.com/f/250698/x/840001eb3d/rocheannualreport2025.pdf
4. SIX Swiss Exchange, **Share Explorer – ROCHE I** – offizielle SIX-Share-Explorer-Seite: https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0012032113CHF4.html
5. Yahoo Finance, **RO.SW Key Statistics** – CHF-Kurs 376.60 am 25.09.2026 10:14 GMT+2, TTM P/E 24.47, Forward P/E 17.04: https://finance.yahoo.com/quote/RO.SW/key-statistics/
6. Digrin, **ROG.SW Dividends** – CHF 9.80, Ex-Termine, Forward Yield 3.04% bei stale Preis CHF 322.30, P/E 20.11: https://www.digrin.com/stocks/detail/ROG.SW/
7. Digrin, **ROG.SW Price History** – Monats-Real-/Adjusted-Preise und der Datenbruch 2026: https://www.digrin.com/stocks/detail/ROG.SW/price/

**Disclosure:** Basis sind reine Kursrendite (nicht Total Return), reguläre Forward-/TTM-Dividende, reported TTM-P/E getrennt von Forward-P/E und tägliche 5J-Volatilität nach Aufgabendefinition. Preisbezug ist der Auftragstichtag; der einzige geöffnete Yahoo-Kurs ist 10:14 statt 09:22 und daher nur Kontrollwert. Hauptunsicherheit besteht in der RO/ROP-Linienidentität und der fehlenden Tageshistorie. Dies ist Research und Analyse, keine personalisierte Finanzberatung.

**Structured metrics:** `{"ytd":{"course_pct":null,"proxy_pct":14.7,"total_return_pct":null},"dividend":{"forward_yield_pct":2.6,"ttm_yield_pct":2.6,"forward_amount_chf":9.8,"ttm_amount_chf":9.8},"pe":{"ttm":24.47,"forward":17.04,"reported_eps_2025_chf":16.04,"core_eps_2025_chf":19.46},"volatility":{"five_year_annualized_pct":null,"method":"daily unadjusted/split-adjusted close returns x sqrt(252), not reproducible from accessible dataset"}}`
