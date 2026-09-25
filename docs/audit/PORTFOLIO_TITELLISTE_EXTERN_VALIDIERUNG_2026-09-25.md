# Externe Validierung der Portfolio-Titelliste

**Stichtag:** 25. September 2026, 09:22 Uhr Europe/Zurich  
**Kursbasis:** grundsätzlich letzter abgeschlossener Handelsschluss am 24. September 2026  
**Autor:** Manus AI  

## Executive Summary

1. **Die Instrumentidentität ist bei 30 von 31 Positionen hinreichend geklärt.** Für Roche muss die Titelliste jedoch zwingend zwischen der Stammaktie **RO** und dem seit 11. März 2026 separat geführten Partizipationsschein **ROP** unterscheiden. Bis zur fachlichen Zuordnung darf keine historische RO-/ROP-Kursreihe automatisch fortgeschrieben werden. [3] [4]

2. **Die reine YTD-Kursrendite ist keine Total-Return-Rendite.** Der Bericht führt daher unadjustierte Schlusskursrenditen in der jeweiligen Handelswährung als Hauptkennzahl. Total-Return- oder Adjusted-Close-Werte werden nur separat ausgewiesen, weil sie Ausschüttungen einbeziehen und nicht mit dem Kursreturn vermischt werden dürfen. Dies erklärt beispielsweise die Differenz bei Aker BP von 40,3 % Kurs-YTD zu 49,1 % Adjusted-Close-Return. [22]

3. **Mehrere YTD-Werte erfordern materielle Korrekturen.** Besonders gross sind die Abweichungen bei TSM (+48,5 % statt +39,7 %), Aker BP (+40,3 % statt +35,3 %), Palantir (+8,3 % statt +14,3 %), BB Biotech (+13,9 % statt +18,8 %) und Tesla (−16,0 % statt −13,2 %). [64] [22] [69] [42] [73]

4. **Forward- und TTM-Dividendenrenditen müssen getrennt geführt werden.** Die deutlichste Sachkorrektur betrifft Cembra: Die nachhaltigkeitsnahe Forward-Rendite aus der ordentlichen Dividende beträgt 5,3 %, die tatsächlich in den letzten zwölf Monaten ausgeschüttete Cash-Rendite inklusive CHF 1,00 Sonderdividende dagegen 6,5 %. [44] [45]

5. **Für physisch besicherte ETPs sind Aktienkennzahlen nicht sinnvoll.** Bei ZGLD (Gold-ETF) und ABTC (Bitcoin-ETP/Schuldverschreibung) sind Dividendenrendite und KGV als **nicht sinnvoll** zu kennzeichnen. Ein numerischer P/E- oder Dividendenwert würde die Produktökonomie falsch darstellen. [19] [20] [46] [48]

6. **Das KGV ist nur mit definierter EPS-Basis verwendbar.** Neben TTM und Forward müssen bei Versicherern, Banken, Beteiligungsgesellschaften und Titeln mit Sondereffekten die EPS-Basis und die Quelle sichtbar bleiben. Beispielhaft stehen Holcim (reported TTM 98,7x gegenüber normalisiert 20,25x) sowie BB Biotech (TTM 2,09x, aber mark-to-market-getrieben). [26] [43]

7. **Die 5-Jahres-Volatilität ist die grösste Datenlücke.** Nur sechs der 31 Positionen haben eine numerisch belegte, methodisch hinreichend passende 5J-Vola: AKRBP, ABTC, JNJ, CMBN, KNIN und ABBN. Für die übrigen 25 Positionen wird konsequent `n.v.` statt einer nicht reproduzierbaren Zahl geführt. [23] [48] [36] [45] [76] [80]

8. **Provider-Multiples sind zeitpunkt- und definitionsabhängig.** Dies ist keine Rechtfertigung für unmarkierte Abweichungen: Anbieterwerte werden nur dann übernommen, wenn ihre Quelle kenntlich gemacht wird. Bei Tesla etwa liegt Yahoo bei 351,96x TTM und 158,73x Forward, während StockAnalysis 392,19x beziehungsweise 197,52x ausweist. [73] [74]

9. **Die bereinigte Liste enthält keine Währungsumrechnung in Anlegerwährung.** Alle Kurs-, Rendite- und Bewertungsdaten beziehen sich auf die geprüfte Handelslinie in CHF, NOK, EUR, USD, DKK oder SGD. Eine CHF-Anlegerperformance hätte zusätzlich eine explizit definierte FX-Reihe benötigt und ist nicht Gegenstand dieser Prüfung.

10. **Die Titelliste ist nach Umsetzung der priorisierten Korrekturen nutzbar, aber nicht homogen vollständig.** Preis-, Instrument- und Dividendenangaben sind überwiegend gut belegt. Die fehlende Vollständigkeit der offenen Tageshistorien begrenzt vor allem die Vergleichbarkeit der Volatilität sowie einzelner Total-Return-Werte.

## Prüfungsrahmen und Definitionen

> **YTD Kurs** ist die unadjustierte Kursrendite in der Handelswährung: `(Schlusskurs am letzten verfügbaren Handelstag / Schlusskurs am letzten Handelstag 2025 − 1) × 100`. Ausschüttungen sind nicht enthalten. Wo der 31. Dezember kein Handelstag war, wurde der in der jeweiligen Kursquelle ausgewiesene letzte Handelsschluss Ende 2025 verwendet.

> **YTD Total Return** wird nur ausgewiesen, wenn eine separate Adjusted-Close-, Anbieter- oder Emittentenkennzahl tatsächlich geöffnet wurde. Ein `†` markiert eine definitionsabweichende Kontrollgrösse; sie ist nicht mit der Kurs-YTD gleichzusetzen.

> **Div.-Yield TTM** bezeichnet die nachweisbaren Bruttoausschüttungen im zurückliegenden Zwölfmonatsfenster geteilt durch den Stichtagskurs. **Div.-Yield Forward** beruht auf einer belastbaren Unternehmensguidance, einem Konsens oder – ausdrücklich als Proxy – der zuletzt beschlossenen regulären Jahresdividende. Sonderdividenden werden nicht als nachhaltige Forward-Dividende fortgeschrieben.

> **KGV TTM** und **KGV Forward** sind voneinander getrennt. Bei Providerwerten bleibt die jeweilige EPS-/Schätzbasis massgeblich. Ein normalisiertes KGV wird als solches benannt; es ist kein synonymes reported-TTM-KGV.

> **Vola 5J** bedeutet annualisierte Stichproben-Standardabweichung täglicher Renditen über möglichst 25.09.2021–24.09.2026, annualisiert mit `√252`. `n.v.` bedeutet: aus den tatsächlich geöffneten Quellen nicht vollständig reproduzierbar verifizierbar. `n.s.` bedeutet: für die Produktart wirtschaftlich nicht sinnvoll.

Die Daten sind **Bruttowerte vor individuellen Steuern, Gebühren und allfälliger Quellensteuer**. Für US-, Londoner- und asiatische Handelsplätze war am Referenzmorgen ebenfalls der Schluss vom 24. September 2026 die zeitlich konsistente Hauptbasis. Für einzelne SIX-Anzeigen, die nach dem Referenzzeitpunkt nur intraday verfügbar waren, ist die abweichende Zeitbasis in der Haupttabelle ausdrücklich vermerkt.

## Haupttabelle: vollständiger Auditbefund je Titel und Kennzahl

**Legende Status:** **H** = hoch belastbar; **M** = belastbar, aber provider-/definitions- oder stichtagsabhängig; **N** = nicht abschliessend verifizierbar; **I** = indikative Plausibilitätsableitung; **n.s.** = nicht sinnvoll; **n.v.** = nicht verifizierbar. Alle Zahlen sind Prozent, ausser KGV-Werte mit `x`.

| Ticker | Titel / geprüfte Handelslinie | YTD Kurs | YTD Total Return | Div.-Yield Forward | Div.-Yield TTM | KGV TTM | KGV Forward | Vola 5J | Auditbefund / Status | Belege |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| CHDVD.SW | iShares Swiss Dividend ETF (CH), SIX/CHF | +4,0 % | +7,7 %† | n.v. | 3,48 % | 18,90x‡ | n.v. | n.v. | ETF; iShares-Portfolio-KGV, Ad-hoc-Distributionen | M | [1] [2] |
| RO.SW | Roche; **Zuordnung RO vs. ROP offen**, SIX/CHF | n.v. | n.v. | 2,6 % | 2,6 % | 24,47x | 17,04x | n.v. | Ticker-/Linienrisiko vor Datenübernahme beheben | N | [3] [4] [5] |
| ZURN.SW | Zurich Insurance Group, SIX/CHF | n.v. | +1,6 %† | 5,66 %§ | 5,18 % | 15,83x§ | 14,80x§ | n.v. | TTM rekonstruiert; Forward Dividende/EPS sind Schätzungen | M | [6] [7] |
| SREN.SW | Swiss Re, SIX/CHF | +7,0 % | n.v. | 4,44 % | 4,44 % | 11,27x‡ | n.v. | n.v. | TTM-KGV ist normalisiert | M | [8] [9] |
| NESN.SW | Nestlé, SIX/CHF | −1,0 % | n.v. | 4,0 % | 4,0 % | 26,68x | 16,16x | n.v. | Kurs- und Multiples sauber getrennt | H/M | [10] [11] |
| SLHN.SW | Swiss Life, SIX/CHF | −1,5 % | n.v. | 4,0 % | 4,0 % | 19,68x | 19,10x | n.v. | TTM auf 24.09.-Schlusskurs umgerechnet | M | [12] [13] [14] |
| SCMN.SW | Swisscom N, SIX/CHF | +14,1 % | +18,5 %† | 4,1 % | 4,0 % | 25,77x | 19,12x | n.v. | Forward-Dividende ist bedingte Unternehmensplanung | H/M | [15] [16] |
| HBAN.SW | Helvetia Baloise, SIX/CHF | +2,1 %¶ | n.v. | 3,6 % | 3,6 % | 41,26x | n.v. | n.v. | Fusion belastet EPS-Vergleichbarkeit; 2027E 20,6x nur Kontrolle | M | [17] [18] |
| ZGLD.SW | ZKB Gold ETF AA CHF, SIX/CHF | +2,8 %¶ | n.v. | n.s. | n.s. | n.s. | n.s. | n.v. | Physisch besicherter Gold-ETF | H/N | [19] [20] |
| AKRBP.OL | Aker BP, Oslo/NOK | +40,3 % | +49,1 %† | 7,13 % | 6,99 % | 16,62x | 13,18x | 35,2 %‡ | Vola externe 5J-Kontrollkennzahl | H/M | [21] [22] [23] |
| HOLN.SW | Holcim, SIX/CHF | −14,7 % | n.v. | 2,56 % | 2,56 % | 98,7x | 44,3x | n.v. | reported TTM; normalisiert 20,25x nur Kontrollgrösse | M | [24] [25] [26] |
| PST.MI | Poste Italiane, Euronext Milan/EUR | +19,7 % | +23,8 %† | 4,86 % | 4,86 % | 13,87x | 13,19x | n.v. | Anbieterpaar StockAnalysis/S&P Global | H/M | [27] [29] [30] |
| GOOGL | Alphabet Class A, Nasdaq/USD | +9,4 % | +9,6 %† | 0,26 % | 0,25 % | 17,62x | 22,83x | n.v. | Provider-TTM-Multiple; Forward separat | H/M | [31] [32] |
| SGKN.SW | St. Galler Kantonalbank, SIX/CHF | +20,32 %¶ | n.v. | 2,86 %§ | 2,86 % | 18,20x‡ | n.v. | n.v. | Forward-Yield als letzter-Dividende-Proxy | M | [33] [34] |
| JNJ | Johnson & Johnson, NYSE/USD | +30,8 % | n.v. | 1,98 % | 1,95 % | 31,38x | 23,17x§ | 17,8 % | Forward auf adjusted-EPS-Guidance; Vola eigens berechnet | H/M | [35] [36] [37] |
| OFN.SW | Orell Füssli, SIX/CHF | ca. +18,4–18,5 % | n.v. | 4,1 % | 4,1 % | 16,97x | n.v. | n.v. | YTD nur aus Intraday-/Schlusskursrelation abgeleitet | I | [38] [39] [40] |
| BION.SW | BB Biotech, SIX/CHF | +13,9 % | +19,89 %† | 4,39 % | 4,39 % | 2,09x | 12,59x | n.v. | Beteiligungsgesellschaft; NAV-/Discount-Kontext wesentlich | H/M | [41] [42] [43] |
| CMBN.SW | Cembra Money Bank, SIX/CHF | −12,6 % | −7,5 %† | 5,3 % | 6,5 %* | 13,82x | 11,83x | 19,1 % | TTM Yield einschliesslich CHF 1,00 Sonderdividende | H | [44] [45] |
| ABTC.SW | 21Shares Bitcoin ETP, SIX-CHF-Linie | −3,03 % | n.v. | n.s. | n.s. | n.s. | n.s. | 49,64 %‡ | Schuldverschreibung/Bitcoin-ETP, keine Aktienkennzahlen | H/M | [46] [47] [48] |
| NVDA | NVIDIA, Nasdaq/USD | +20,4 % | n.v. | 0,45 % | 0,23 % | 28,51x | 24,88x | n.v. | TTM-Dividende aus tatsächlichen Zahlungen, nicht annualisiert | H/M | [49] [50] |
| GIVN.SW | Givaudan N, SIX/CHF | +8,3 % | n.v. | 2,1 % | 2,1 % | 30,54x§ | 26,73x§ | n.v. | MarketScreener-EPS-Basis; Yahoo-Kontrolle abweichend | M | [51] [52] [53] |
| FHZN.SW | Flughafen Zürich, SIX/CHF | −20,5 % | n.v. | 4,26 % | 4,26 % | 17,87x | 20,96x | n.v. | KGV vom Anbieter am 25.09.; Kurs-YTD zum 24.09. | H/M | [54] [55] |
| KAP.IL | Kazatomprom Reg-S GDR, LSE/USD | +21,9 % | +27,0 %† | 3,9–4,0 %§ | 3,9 % | 15,64x | 13,35x | n.v. | 1 GDR = 1 Aktie; KGV anbieterabhängig | M | [56] [57] [58] |
| NOVO-B.CO | Novo Nordisk B, Copenhagen/DKK | −22,2 % | n.v. | 4,6 %§ | 4,6 % | 9,64x | n.v. | n.v. | Forward Dividend als Anbieterfortschreibung; nicht final beschlossen | M | [59] [61] [62] |
| TSM | TSMC ADR, NYSE/USD | +48,5 % | n.v. | 0,91 % | ca. 0,84 % | 33,67x | 21,41x | n.v. | ADR, nicht TWSE-Stammaktie; Bruttodividende | H/M | [63] [64] |
| D05.SI | DBS Group, SGX/SGD | +37,5 % | n.v. | 4,1 % | 4,1 % | 19,36x‡ | n.v. | n.v. | KGV ist normalisiert | M | [65] [66] [67] |
| PLTR | Palantir Class A, Nasdaq/USD | +8,3 % | +8,3 % | 0,0 % | 0,0 % | 164,61x | 85,47x | n.v. | Keine Dividende; TR entspricht Kursreturn | H/M | [68] [69] [70] |
| ISRG | Intuitive Surgical, Nasdaq/USD | −29,4 % | −29,4 % | 0,0 % | 0,0 % | 45,81x | 35,36x | n.v. | Keine Dividende; TR entspricht Kursreturn | H/M | [71] [72] |
| TSLA | Tesla, Nasdaq/USD | −16,0 % | −16,0 % | 0,0 % | 0,0 % | 351,96x | 158,73x | n.v. | Keine Dividende; Provider-KGV streut erheblich | H/M | [73] [74] |
| KNIN.SW | Kühne + Nagel, SIX/CHF | +31,9 % | n.v. | 2,9 % | 2,7 % | 31,07x | 26,32x | 28,4 % | reported TTM-EPS-Roll-forward; Vola eigens berechnet | H | [75] [76] [77] |
| ABBN.SW | ABB N, SIX/CHF | +35,9 % | n.v. | 1,2 % | 1,2 % | 36,91x | 25,38x | 25,6 % | KGV providerdefiniert; Vola eigens berechnet | H/M | [78] [79] [80] |

**Fussnoten zur Haupttabelle:** `†` getrennte Adjusted-Close-, Total-Return- oder Emittenten-/Provider-Kontrollgrösse; keine einheitliche steuer- oder reinvestitionsbereinigte Methodik über alle Titel. `‡` Portfolio-, normalisiertes oder externes Volatilitätsmass; siehe Auditbefund. `§` Schätzung, Konsens, normalisierte EPS-Basis oder expliziter Proxy. `¶` offiziell publizierte SIX-YTD-Anzeige; die vollständige Schlusskursreihe war nicht unabhängig exportierbar. `*` Tatsächlicher TTM-Cashflow inklusive Sonderdividende; die reguläre/anbieterkonforme TTM-Rate liegt bei 5,3 %.

## Bereinigte Endtabelle

Die folgende Endtabelle ist die für eine Portfolioliste zu übernehmende Darstellung. Sie verwirft keine fehlenden Daten durch künstliche Schätzwerte. `H`, `M`, `N` und `I` entsprechen der vorstehenden Statuslegende.

| Ticker | YTD Kurs | YTD Total Return | Div.-Yield Forward | Div.-Yield TTM | KGV TTM | KGV Forward | Vola 5J | Stand |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| CHDVD.SW | +4,0 % | +7,7 %† | n.v. | 3,48 % | 18,90x‡ | n.v. | n.v. | M, 25.09.2026 [1] [2] |
| RO.SW | n.v. | n.v. | 2,6 % | 2,6 % | 24,47x | 17,04x | n.v. | N; RO/ROP klären [3] [5] |
| ZURN.SW | n.v. | +1,6 %† | 5,66 %§ | 5,18 % | 15,83x§ | 14,80x§ | n.v. | M, 25.09.2026 [6] [7] |
| SREN.SW | +7,0 % | n.v. | 4,44 % | 4,44 % | 11,27x‡ | n.v. | n.v. | M, 24.09.2026 [8] [9] |
| NESN.SW | −1,0 % | n.v. | 4,0 % | 4,0 % | 26,68x | 16,16x | n.v. | H/M, 24.09.2026 [10] [11] |
| SLHN.SW | −1,5 % | n.v. | 4,0 % | 4,0 % | 19,68x | 19,10x | n.v. | M, 24.09.2026 [12] [14] |
| SCMN.SW | +14,1 % | +18,5 %† | 4,1 % | 4,0 % | 25,77x | 19,12x | n.v. | H/M, 24.09.2026 [15] [16] |
| HBAN.SW | +2,1 %¶ | n.v. | 3,6 % | 3,6 % | 41,26x | n.v. | n.v. | M, SIX 25.09.2026 [17] [18] |
| ZGLD.SW | +2,8 %¶ | n.v. | n.s. | n.s. | n.s. | n.s. | n.v. | H/N, Gold-ETF [19] [20] |
| AKRBP.OL | +40,3 % | +49,1 %† | 7,13 % | 6,99 % | 16,62x | 13,18x | 35,2 %‡ | H/M, 24.09.2026 [22] [23] |
| HOLN.SW | −14,7 % | n.v. | 2,56 % | 2,56 % | 98,7x | 44,3x | n.v. | M, 24.09.2026 [24] [26] |
| PST.MI | +19,7 % | +23,8 %† | 4,86 % | 4,86 % | 13,87x | 13,19x | n.v. | H/M, 24.09.2026 [29] [30] |
| GOOGL | +9,4 % | +9,6 %† | 0,26 % | 0,25 % | 17,62x | 22,83x | n.v. | H/M, 24.09.2026 [31] [32] |
| SGKN.SW | +20,32 %¶ | n.v. | 2,86 %§ | 2,86 % | 18,20x‡ | n.v. | n.v. | M, SIX 24.09.2026 [33] [34] |
| JNJ | +30,8 % | n.v. | 1,98 % | 1,95 % | 31,38x | 23,17x§ | 17,8 % | H/M, 24.09.2026 [35] [36] |
| OFN.SW | ca. +18,4–18,5 % | n.v. | 4,1 % | 4,1 % | 16,97x | n.v. | n.v. | I, Schlusskursbasis [38] [39] |
| BION.SW | +13,9 % | +19,89 %† | 4,39 % | 4,39 % | 2,09x | 12,59x | n.v. | H/M, 24.09.2026 [41] [43] |
| CMBN.SW | −12,6 % | −7,5 %† | 5,3 % | 6,5 %* | 13,82x | 11,83x | 19,1 % | H, 24.09.2026 [44] [45] |
| ABTC.SW | −3,03 % | n.v. | n.s. | n.s. | n.s. | n.s. | 49,64 %‡ | H/M, CHF-Linie [46] [48] |
| NVDA | +20,4 % | n.v. | 0,45 % | 0,23 % | 28,51x | 24,88x | n.v. | H/M, 24.09.2026 [49] [50] |
| GIVN.SW | +8,3 % | n.v. | 2,1 % | 2,1 % | 30,54x§ | 26,73x§ | n.v. | M, 24.09.2026 [51] [53] |
| FHZN.SW | −20,5 % | n.v. | 4,26 % | 4,26 % | 17,87x | 20,96x | n.v. | H/M, 24.09.2026 [54] [55] |
| KAP.IL | +21,9 % | +27,0 %† | 3,9–4,0 %§ | 3,9 % | 15,64x | 13,35x | n.v. | M, 24.09.2026 [56] [58] |
| NOVO-B.CO | −22,2 % | n.v. | 4,6 %§ | 4,6 % | 9,64x | n.v. | n.v. | M, 24.09.2026 [59] [61] |
| TSM | +48,5 % | n.v. | 0,91 % | ca. 0,84 % | 33,67x | 21,41x | n.v. | H/M, ADR/USD [63] [64] |
| D05.SI | +37,5 % | n.v. | 4,1 % | 4,1 % | 19,36x‡ | n.v. | n.v. | M, 24.09.2026 [65] [67] |
| PLTR | +8,3 % | +8,3 % | 0,0 % | 0,0 % | 164,61x | 85,47x | n.v. | H/M, 24.09.2026 [69] [70] |
| ISRG | −29,4 % | −29,4 % | 0,0 % | 0,0 % | 45,81x | 35,36x | n.v. | H/M, 24.09.2026 [71] [72] |
| TSLA | −16,0 % | −16,0 % | 0,0 % | 0,0 % | 351,96x | 158,73x | n.v. | H/M, 24.09.2026 [73] [74] |
| KNIN.SW | +31,9 % | n.v. | 2,9 % | 2,7 % | 31,07x | 26,32x | 28,4 % | H, 24.09.2026 [75] [76] [77] |
| ABBN.SW | +35,9 % | n.v. | 1,2 % | 1,2 % | 36,91x | 25,38x | 25,6 % | H/M, 24.09.2026 [78] [80] |

## Priorisierte Korrekturliste

### Priorität 1 — sofort vor jeder weiteren Aktualisierung umsetzen

| Massnahme | Betroffene Titel | Korrektur und Begründung |
|---|---|---|
| Handelslinien-Mapping sperren und bereinigen | RO.SW | **RO und ROP dürfen nicht vermischt werden.** RO ist die Stammaktie (ISIN CH0012032113); ROP ist der Partizipationsschein (ISIN CH1499059983). Ohne fachliche Zuordnung sind Kurs-YTD, Corporate Actions und Historien nicht übernehmbar. [3] [4] |
| Nicht sinnvolle Kennzahlen unterdrücken | ZGLD.SW, ABTC.SW | Dividendenrendite und KGV sind bei physischem Gold bzw. Bitcoin-ETP nicht aussagekräftig. Als `n.s.` ausgeben, nicht als Null und nicht leer ohne Erklärung. [20] [46] [48] |
| Volatilitätsfelder bereinigen | 25 Titel mit `n.v.` | Alle nicht reproduzierbar geprüften 5J-Volatilitäten durch `n.v.` ersetzen. Nur AKRBP, ABTC, JNJ, CMBN, KNIN und ABBN erhalten eine numerische Zahl; deren unterschiedliche Basen bleiben dokumentiert. [23] [48] [36] [45] [76] [80] |
| Dividendenlogik trennen | alle ausschüttenden Titel, besonders CMBN, NVDA, TSM, SCMN, KNIN | TTM ist die tatsächliche Ausschüttung, Forward die künftige Rate/Schätzung. Bei CMBN 6,5 % Cash-TTM inklusive Sonderdividende versus 5,3 % regulär Forward; bei NVDA 0,23 % TTM versus 0,45 % Forward. [44] [45] [49] [50] |

### Priorität 2 — materielle Zahlenkorrekturen in der Titelliste

| Ticker | Kennzahl | bisher | bereinigt | Änderung / Grund |
|---|---|---:|---:|---|
| TSM | YTD Kurs | +39,7 % | **+48,5 %** | USD-ADR-Schlusskurse 303,89 zu 451,15; keine TWSE- oder Total-Return-Reihe. [64] |
| AKRBP.OL | YTD Kurs | +35,3 % | **+40,3 %** | NOK 256,90 zu 360,40; Dividenden ausgeschlossen. [22] |
| PLTR | YTD Kurs | +14,3 % | **+8,3 %** | USD 177,75 zu 192,59. [69] |
| BION.SW | YTD Kurs | +18,8 % | **+13,9 %** | CHF 44,95 zu 51,20; die 19,89 % der Gesellschaft sind definitionsabweichende Share-Performance. [41] [42] |
| TSLA | YTD Kurs | −13,2 % | **−16,0 %** | USD 449,72 zu 377,94. [73] |
| CMBN.SW | YTD / TTM Yield | −15,3 % / 5,3 % | **−12,6 % / 6,5 %*** | Schlusskurse 99,35 zu 86,80; TTM enthält CHF 1,00 Sonderdividende. [44] [45] |
| KAP.IL | Yield / KGV TTM | 5,7 % / 11,11x | **3,9–4,0 % / 15,64x** | GDR-Dividende ca. USD 2,68–2,73 und aktueller Yahoo-Statistics-Wert; 1:1-GDR beachten. [56] [57] [58] |
| SGKN.SW | YTD / KGV TTM | +17,5 % / 17,79x | **+20,32 % / 18,20x‡** | SIX-YTD; Morningstar-normalisiertes P/E als klar markierte Basis. [33] [34] |
| GOOGL | YTD / KGV TTM | +7,2 % / 16,95x | **+9,4 % / 17,62x** | USD 313,00 zu 342,36; explizites Yahoo-TTM-Multiple statt einfacher Quotient. [32] |
| GIVN.SW | YTD / KGV TTM | +10,1 % / 33,21x | **+8,3 % / 30,54x§** | CHF 3’146 zu 3’406; gewählte MarketScreener-EPS-Basis offenlegen. [52] [53] |
| NOVO-B.CO | YTD | −23,6 % | **−22,2 %** | DKK 325 zu 253; B-Aktie in DKK, nicht NVO-ADR. [59] [61] |
| ABTC.SW | YTD / Vola | −0,2 % / 77,2 % | **−3,03 % / 49,64 %‡** | korrekte SIX-CHF-Linie ABTCCHF; externe 5J-Risikokennzahl. [46] [47] [48] |

`*` Tatsächlicher TTM-Cashflow inklusive Sonderdividende. `‡` normalisierte bzw. externe Kennzahl, nicht als identische eigene Tagesberechnung auszugeben. `§` Schätz-/Providerbasis.

### Priorität 3 — kleinere Korrekturen und Pflicht-Ergänzungen

Die folgenden Korrekturen sind numerisch kleiner, verbessern aber die Datenintegrität: CHDVD YTD +4,0 % statt +4,5 % und TTM-Distribution Yield 3,48 % statt 4,2 %; SREN YTD +7,0 % statt +7,4 % und Forward Yield 4,4 % statt 5,7 %; NESN YTD −1,0 % statt +0,9 %; SCMN YTD +14,1 % statt +13,0 %; HOLN YTD −14,7 % statt −13,4 %; JNJ YTD +30,8 % statt +29,8 %; NVDA Forward/TTM Yield 0,45 %/0,23 % statt pauschal 0,1 %; KNIN Forward Yield 2,9 % statt 2,6 %; ABBN YTD +35,9 % statt +34,6 %. [1] [8] [10] [15] [24] [36] [49] [75] [80]

Bei ZURN, SREN, SGKN, D05 und mehreren weiteren Titeln müssen normalisierte, rekonstruierte oder providerdefinierte KGVs mit ihrer Basis gekennzeichnet bleiben. Bei HBAN ist aufgrund mergerbezogener IFRS-Effekte kein belastbares einheitliches Forward-KGV verfügbar. Bei OFN ist die YTD nur indikativ; sie darf nicht als voll verifizierte Kursreihe gespeichert werden. [7] [9] [17] [34] [38]

## Beurteilung der Datenqualität

### Gesamturteil

Die Datenqualität ist **gut für Identität, Handelsplatz, Währung, Stichtagskurse und reguläre Dividenden**, **mittel für Bewertungsmultiples** und **uneinheitlich für Total Return sowie 5J-Volatilität**. Die Berichte sind transparent darin, dass sie fehlende Zeitreihen nicht durch Beta-Werte, kurzfristige Volatilitäten oder rückgerechnete Fantasiewerte ersetzen.

| Datenfeld | Abdeckung / Qualität | Hauptrisiko | Umgang in der Endtabelle |
|---|---|---|---|
| Instrumentidentität und Handelslinie | Hoch für 30 von 31 Titeln | Roche RO/ROP; mehrere Linien bei ABTC; ADR-Abgrenzung bei TSM/KAP/NOVO | RO.SW als Sperrfall; Handelslinie und Währung in Stammdaten fest hinterlegen |
| YTD Kurs | Hoch für 28 Titel; mittel für HBAN, ZGLD, SGKN; indikativ bei OFN; offen bei RO und ZURN | Intraday- statt Schlusskursbasis; Adjusted Close fälschlich als Kurs-YTD | nur unadjusted Close; offizielle SIX-YTD als solche kennzeichnen |
| YTD Total Return | Nur punktuell und methodisch heterogen vorhanden | Anbieter verwenden Adjusted Close, NAV, Dividend Reinvestment oder andere Zeitfenster | nur `†`-Kontrollwerte, sonst n.v.; nicht für Ranglisten mit Kurs-YTD mischen |
| Dividendenrendite | Hoch, wenn reguläre Dividende und Stichtagskurs vorliegen | Forward ist teils Konsens, Guidance oder Proxy; Sonderdividenden | Forward und TTM getrennt; CMBN-Sonderdividende separat |
| KGV TTM / Forward | Mittel | reported versus normalisiert, Datenanbieterzeitpunkt, negative EPS, Währungs-/ADR-Basis | Quelle und EPS-Art dokumentieren; n.v. bei nicht belastbarem Forward-KGV |
| Volatilität 5J | Niedrig bis mittel | keine vollständig exportierbare 5J-Tagesreihe in vielen geöffneten Quellen | nur sechs numerische Werte; im Übrigen n.v. |

Die wichtigsten strukturellen Einschränkungen sind damit nicht fehlende Marktinformationen, sondern **nicht einheitlich reproduzierbare offene Tagesdaten**, die für eine definierte 5J-Volatilitätsberechnung erforderlich wären. Monthly Beta, implizite Optionsvolatilität, einjähriger Standardabweichungswert oder 5J-CAGR wurden bewusst nicht als Ersatz verwendet. Die damit verbundene Datenlücke ist sachlich relevanter als eine scheinbare Vollständigkeit mit methodisch unvereinbaren Zahlen.

## Basis, Zeit, Annahmen, Quellen und Konfidenz

**Basis.** Die geprüften Werte beziehen sich auf die in der Haupttabelle bezeichnete Primärhandelslinie und deren Handelswährung. Kurs-YTD ist eine unadjustierte, splitbereinigte Schlusskursrendite ohne Dividenden. Wo eine Aktie in mehreren Formen gehandelt wird, wurde die konkrete Linie abgegrenzt: etwa TSM als NYSE-ADR in USD, KAP als Londoner Reg-S-GDR in USD und NOVO-B als Kopenhagener B-Aktie in DKK. [56] [59] [63]

**Zeit.** Referenzzeitpunkt ist der 25. September 2026, 09:22 Uhr Europe/Zurich. Für vergleichbare Kennzahlen wurde überwiegend der letzte abgeschlossene Schlusskurs vom 24. September 2026 verwendet. Ein KGV oder eine Yield-Anzeige kann wegen intraday aktualisierter Anbieterfelder trotzdem denselben Kalendertag, aber einen leicht abweichenden Kurszeitpunkt haben. Das ist im Status als `M` reflektiert.

**Annahmen.** Dividendenrenditen sind brutto und berücksichtigen weder individuelle Quellensteuer noch Depotgebühren. Eine letzte reguläre Dividende wird nur dann als Forward-Proxy verwendet, wenn dies im Befund ausdrücklich steht. Forward-KGVs sind Markt- oder Unternehmensschätzungen und keine realisierten Gewinne. Bei Beteiligungsgesellschaften, insbesondere BB Biotech, ergänzen NAV und Discount das KGV wirtschaftlich sinnvoller als bei einer operativen Gesellschaft. [41] [43]

**Quellen und Konfidenz.** Es wurden ausschliesslich in den 31 Teilprüfungen tatsächlich geöffnete Primärquellen, Börsenquellen, Emittentenberichte und offen zugängliche Kontrollquellen verwendet. Die Referenzen am Ende dieses Berichts dokumentieren die konkreten URLs. Hohe Konfidenz besteht für direkt belegte Kurse, Corporate-Action-/Dividendendaten und die wenigen selbst reproduzierten Volatilitäten; mittlere Konfidenz für Anbieter-KGVs, Konsenswerte und offizielle YTD-Anzeigen ohne vollständigen Export; niedrige Konfidenz beziehungsweise `n.v.` für nicht zugängliche Tagesreihen und den OFN-Plausibilitätswert.

**Forschung und Analyse, keine persönliche Anlageberatung.**

## References

[1]: https://www.ishares.com/ch/individual/en/products/264108/ishares-swiss-dividend-ch-fund "iShares Swiss Dividend ETF (CH) product page"
[2]: https://www.six-group.com/en/market-data/etf/etf-explorer/etf-detail.CH0237935637CHF4.html "SIX ETF detail for iShares Swiss Dividend ETF (CH)"
[3]: https://www.roche.com/investors/faq_investors "Roche investor frequently asked questions"
[4]: https://assets.roche.com/f/176343/x/fca190f63e/fb25e.pdf "Roche Finance Report 2025"
[5]: https://finance.yahoo.com/quote/RO.SW/key-statistics/ "Yahoo Finance RO.SW key statistics"
[6]: https://www.zurich.com/investor-relations/our-shares/dividends "Zurich Insurance Group dividend policy"
[7]: https://www.marketscreener.com/quote/stock/ZURICH-INSURANCE-GROUP-LT-2955923/valuation-dividend/ "MarketScreener Zurich Insurance valuation and dividend"
[8]: https://www.swissre.com/investors/shares/dividends.html "Swiss Re dividend history"
[9]: https://www.morningstar.com/stocks/xswx/sren/quote "Morningstar Swiss Re AG SREN quote"
[10]: https://www.nestle.com/media/pressreleases/allpressreleases/full-year-results-2025 "Nestlé full-year results 2025"
[11]: https://finance.yahoo.com/quote/NESN.SW/key-statistics/ "Yahoo Finance NESN.SW key statistics"
[12]: https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0014852781CHF4.html "SIX share details for Swiss Life Holding AG"
[13]: https://www.swisslife.com/en/home/investors/swisslife-share/dividend.html "Swiss Life dividend history"
[14]: https://www.marketscreener.com/quote/stock/SWISS-LIFE-HOLDING-AG-9365007/valuation/ "MarketScreener Swiss Life valuation"
[15]: https://www.swisscom.ch/en/about/investors/shares.html "Swisscom share information"
[16]: https://finance.yahoo.com/quote/SCMN.SW/key-statistics/ "Yahoo Finance SCMN.SW key statistics"
[17]: https://www.helvetia-baloise.com/corporate/hb/en/home/investors/aktie-und-aktionariat/share-price-key-figures.html "Helvetia Baloise share price and key figures"
[18]: https://finance.yahoo.com/quote/HBAN.SW/key-statistics/ "Yahoo Finance HBAN.SW key statistics"
[19]: https://www.six-group.com/en/market-data/etf/etf-explorer/etf-detail.CH0139101593CHF4.html "SIX ETF detail for ZKB Gold ETF AA CHF"
[20]: https://swissfunddata.ch/sfdpub/docs/prp-70501_00_01-20230207-en.pdf "Swisscanto Gold ETF key information document"
[21]: https://akerbp.com/en/investor/share/ "Aker BP share information"
[22]: https://finance.yahoo.com/quote/AKRBP.OL/history/ "Yahoo Finance AKRBP.OL historical data"
[23]: https://www.justetf.com/en/stock-profiles/NO0010345853 "justETF Aker BP ASA stock profile"
[24]: https://www.holcim.com/investors/shareholder-information/dividend-history "Holcim dividend history"
[25]: https://finance.yahoo.com/quote/HOLN.SW/history/ "Yahoo Finance HOLN.SW historical data"
[26]: https://valueinvesting.io/HOLN.SW/valuation/fair-value "ValueInvesting Holcim valuation"
[27]: https://www.posteitaliane.it/en/investors/share-information "Poste Italiane share information"
[28]: https://www.posteitaliane.it/en/press-release/approval-full-year-2025-results "Poste Italiane full-year 2025 results"
[29]: https://finance.yahoo.com/quote/PST.MI/history/?period1=1766966400&period2=1790467200 "Yahoo Finance PST.MI historical data"
[30]: https://stockanalysis.com/quote/bit/PST/statistics/ "StockAnalysis Poste Italiane statistics"
[31]: https://s206.q4cdn.com/479360582/files/doc_financials/2026/q2/2026q2-alphabet-earnings-release.pdf "Alphabet Q2 2026 earnings release"
[32]: https://finance.yahoo.com/quote/GOOGL/key-statistics/ "Yahoo Finance GOOGL key statistics"
[33]: https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0011484067CHF4.html "SIX share details for St. Galler Kantonalbank"
[34]: https://www.morningstar.com/stocks/xswx/sgkn/quote "Morningstar St. Galler Kantonalbank quote"
[35]: https://www.investor.jnj.com/stock-info/dividend-history/default.aspx "Johnson and Johnson dividend history"
[36]: https://query1.finance.yahoo.com/v8/finance/chart/JNJ?period1=1640908800&period2=1790467200&interval=1d&events=div%2Csplits "Yahoo Finance JNJ daily chart data"
[37]: https://stockanalysis.com/stocks/jnj/statistics/ "StockAnalysis Johnson and Johnson statistics"
[38]: https://orell-fuessli-prod.fra1.cdn.digitaloceanspaces.com/images/corporate/GB-2025/OF_Annual_Report_2025.pdf "Orell Füssli Annual Report 2025"
[39]: https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0003420806CHF4.html "SIX share details for Orell Füssli"
[40]: https://finance.yahoo.com/quote/OFN.SW/ "Yahoo Finance OFN.SW quote"
[41]: https://www.bbbiotech.ch/all-en/all/investors/share-information "BB Biotech share information"
[42]: https://finance.yahoo.com/quote/BION.SW/history/ "Yahoo Finance BION.SW historical data"
[43]: https://www.marketscreener.com/quote/stock/BB-BIOTECH-AG-2975835/valuation-dividend/ "MarketScreener BB Biotech valuation and dividend"
[44]: https://www.cembra.ch/en/investor/investor-relation/share-information/dividend/ "Cembra dividend information"
[45]: https://finance.yahoo.com/quote/CMBN.SW/key-statistics/ "Yahoo Finance CMBN.SW key statistics"
[46]: https://cdn.21shares.com/uploads/current-documents/factsheets/all/Factsheet_ABTC.pdf "21Shares Bitcoin ETP factsheet"
[47]: https://finance.yahoo.com/quote/ABTC.SW/history/ "Yahoo Finance ABTC.SW historical data"
[48]: https://www.justetf.com/en/etf-profile.html?isin=CH0454664001 "justETF 21Shares Bitcoin ETP profile"
[49]: https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027 "NVIDIA Q2 fiscal 2027 financial results"
[50]: https://finance.yahoo.com/quote/NVDA/key-statistics/ "Yahoo Finance NVDA key statistics"
[51]: https://www.givaudan.com/media/media-releases/2026/2025-full-year-results "Givaudan 2025 full-year results"
[52]: https://finance.yahoo.com/quote/GIVN.SW/history/ "Yahoo Finance GIVN.SW historical data"
[53]: https://www.marketscreener.com/quote/stock/GIVAUDAN-SA-16414496/valuation/ "MarketScreener Givaudan valuation"
[54]: https://newsroom.flughafen-zuerich.ch/en/key-stock-data/ "Flughafen Zürich key stock data"
[55]: https://finance.yahoo.com/quote/FHZN.SW/key-statistics/ "Yahoo Finance FHZN.SW key statistics"
[56]: https://www.londonstockexchange.com/stock/KAP/joint-stock-company-national-atomic-company-kazatomprom/company-page "London Stock Exchange KAP company page"
[57]: https://www.kazatomprom.kz/en/investors/devidenti "Kazatomprom dividend information"
[58]: https://finance.yahoo.com/quote/KAP.IL/key-statistics/ "Yahoo Finance KAP.IL key statistics"
[59]: https://www.novonordisk.com/investors/stock-information/dividend.html "Novo Nordisk dividend and stock information"
[60]: https://annualreport.novonordisk.com/2025/introducing-novo-nordisk/five-year-overview.html "Novo Nordisk Annual Report 2025 five-year overview"
[61]: https://finance.yahoo.com/quote/NOVO-B.CO/ "Yahoo Finance NOVO-B.CO quote"
[62]: https://www.morningstar.com/stocks/xcse/novo%20b/quote "Morningstar Novo Nordisk B quote"
[63]: https://investor.tsmc.com/english/dividends "TSMC dividend history"
[64]: https://finance.yahoo.com/quote/TSM/key-statistics/ "Yahoo Finance TSM key statistics"
[65]: https://links.sgx.com/1.0.0/corporate-actions/2236193 "SGX DBS corporate action 2236193"
[66]: https://finance.yahoo.com/quote/D05.SI/history/ "Yahoo Finance D05.SI historical data"
[67]: https://www.morningstar.com/stocks/xses/d05/quote "Morningstar DBS Group quote"
[68]: https://investors.palantir.com/files/2025%20FY%20PLTR%2010-K.pdf "Palantir 2025 Form 10-K"
[69]: https://finance.yahoo.com/quote/PLTR/key-statistics/ "Yahoo Finance PLTR key statistics"
[70]: https://www.macrotrends.net/stocks/charts/PLTR/palantir-technologies/pe-ratio "Macrotrends Palantir PE ratio"
[71]: https://query1.finance.yahoo.com/v8/finance/chart/ISRG?period1=1766966400&period2=1790467200&interval=1d&events=div%2Csplits&includeAdjustedClose=true "Yahoo Finance ISRG daily chart data"
[72]: https://stockanalysis.com/stocks/isrg/statistics/ "StockAnalysis Intuitive Surgical statistics"
[73]: https://finance.yahoo.com/quote/TSLA/key-statistics/ "Yahoo Finance TSLA key statistics"
[74]: https://stockanalysis.com/stocks/tsla/statistics/ "StockAnalysis Tesla statistics"
[75]: https://www.kuehne-nagel.com/company/investor-relations/consensus-data-and-share-price "Kuehne and Nagel consensus data and share price"
[76]: https://query1.finance.yahoo.com/v8/finance/chart/KNIN.SW?period1=1632528000&period2=1790467200&interval=1d&events=div%2Csplits&includeAdjustedClose=true "Yahoo Finance KNIN.SW daily chart data"
[77]: https://assets.kuehne-nagel.com/f/331466/x/2fa31c0666/kn_2025_ar_consolidated_financial_statement.pdf "Kuehne and Nagel consolidated financial statements 2025"
[78]: https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0012221716CHF4.html "SIX share details for ABB Ltd"
[79]: https://global.abb/group/en/investors/investor-and-shareholder-resources/dividend "ABB dividend information"
[80]: https://finance.yahoo.com/quote/ABBN.SW/key-statistics/ "Yahoo Finance ABBN.SW key statistics"
