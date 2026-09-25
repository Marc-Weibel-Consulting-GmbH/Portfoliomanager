# Entity Cards: externe Plausibilisierung der Titelliste

**Referenzzeitpunkt:** 25. September 2026, 09:22 Uhr Europe/Zurich. Diese Arbeitsdatei fixiert die vom Nutzer vorgegebenen Instrumentidentitäten, Börsen und Handelswährungen vor der externen Recherche. Felder wie Fiskaljahr, Reportingwährung und Instrumentdetails werden in der Validierung gegen Primärquellen bestätigt; sie sind hier keine verifizierten Kennzahlen.

| Nr. | Ticker | Instrument | Primäre Handelslinie | Handelswährung | Instrumenttyp | Prüfschwerpunkt |
|---:|---|---|---|---|---|---|
| 1 | CHDVD.SW | iShares Swiss Dividend ETF | SIX Swiss Exchange | CHF | ETF | Fonds-KGV und Distribution Yield von BlackRock/iShares |
| 2 | RO.SW | Roche Holding AG | SIX Swiss Exchange | CHF | Aktie | Participation Certificate, nicht ADR |
| 3 | ZURN.SW | Zurich Insurance Group AG | SIX Swiss Exchange | CHF | Aktie | Forward- vs. TTM-Dividende |
| 4 | SREN.SW | Swiss Re AG | SIX Swiss Exchange | CHF | Aktie | reguläre und Sonderdividenden trennen |
| 5 | NESN.SW | Nestlé S.A. | SIX Swiss Exchange | CHF | Aktie | TTM- und Forward-KGV trennen |
| 6 | SLHN.SW | Swiss Life Holding AG | SIX Swiss Exchange | CHF | Aktie | Dividendenbasis prüfen |
| 7 | SCMN.SW | Swisscom AG | SIX Swiss Exchange | CHF | Aktie | Kurs- gegenüber Total-Return-YTD |
| 8 | HBAN.SW | Helvetia Baloise Holding AG | SIX Swiss Exchange | CHF | Aktie | Fusion/Ticker- und Historienkontinuität |
| 9 | ZGLD.SW | ZKB Gold ETF AA CHF | SIX Swiss Exchange | CHF | ETF/ETC | KGV und Dividendenrendite nicht sinnvoll |
| 10 | AKRBP.OL | Aker BP ASA | Oslo Børs | NOK | Aktie | NOK-Kursreihe und CHF-Umrechnung nicht vermischen |
| 11 | HOLN.SW | Holcim AG | SIX Swiss Exchange | CHF | Aktie | auffälliges TTM-KGV, Sondereffekte |
| 12 | PST.MI | Poste Italiane S.p.A. | Borsa Italiana | EUR | Aktie | Borsa-Italianiana-Kursreihe und 5J-Vola |
| 13 | GOOGL | Alphabet Inc. Class A | Nasdaq | USD | Aktie | Class A, nicht GOOG Class C |
| 14 | SGKN.SW | St. Galler Kantonalbank AG | SIX Swiss Exchange | CHF | Aktie | Dividendenbasis |
| 15 | JNJ | Johnson & Johnson | NYSE | USD | Aktie | EPS-Basis und KGV-Definition |
| 16 | OFN.SW | Orell Füssli Holding AG | SIX Swiss Exchange | CHF | Aktie | Dividenden- und KGV-Validierung |
| 17 | BION.SW | BB Biotech AG | SIX Swiss Exchange | CHF | Beteiligungsgesellschaft | NAV und Premium/Discount zusätzlich zu KGV |
| 18 | CMBN.SW | Cembra Money Bank AG | SIX Swiss Exchange | CHF | Aktie | 5J-Tagesvolatilität |
| 19 | ABTC.SW | 21Shares Bitcoin ETP | SIX Swiss Exchange | CHF | Krypto-ETP | keine Dividende/KGV; 5J-Vola |
| 20 | NVDA | NVIDIA Corporation | Nasdaq | USD | Aktie | TTM- und Forward-KGV trennen |
| 21 | GIVN.SW | Givaudan S.A. | SIX Swiss Exchange | CHF | Aktie | Dividenden- und EPS-Basis |
| 22 | FHZN.SW | Flughafen Zürich AG | SIX Swiss Exchange | CHF | Aktie | Kursreihe und Dividendenbasis |
| 23 | KAP.IL | NAC Kazatomprom JSC GDR | London International | USD | GDR | GDR-Verhältnis, Handelslinie und Dividende |
| 24 | NOVO-B.CO | Novo Nordisk A/S Class B | Nasdaq Copenhagen | DKK | Aktie | B-Aktie, nicht ADR NVO |
| 25 | TSM | Taiwan Semiconductor Manufacturing Co. ADR | NYSE | USD | ADR | ADR-Verhältnis und Stammaktienkennzahlen |
| 26 | D05.SI | DBS Group Holdings Ltd | Singapore Exchange | SGD | Aktie | SGD-Historie und Datenlücke 5J |
| 27 | PLTR | Palantir Technologies Inc. Class A | NYSE | USD | Aktie | TTM- und Forward-KGV |
| 28 | ISRG | Intuitive Surgical, Inc. | Nasdaq | USD | Aktie | TTM- und Forward-KGV |
| 29 | TSLA | Tesla, Inc. | Nasdaq | USD | Aktie | TTM- und Forward-KGV |
| 30 | KNIN.SW | Kühne + Nagel International AG | SIX Swiss Exchange | CHF | Aktie | Dividenden- und EPS-Basis |
| 31 | ABBN.SW | ABB Ltd | SIX Swiss Exchange | CHF | Aktie | Handelslinie und Dividendenbasis |

## Verbindliche Messbasis

Die Haupt-YTD ist die **unadjustierte Kursperformance** in der jeweiligen Handelswährung, vom letzten Handelstag 2025 bis zum letzten verfügbaren Schlusskurs am Referenzzeitpunkt. Die 5-Jahres-Volatilität ist die annualisierte Standardabweichung täglicher Renditen über das fünfjährige Fenster, mit splitbereinigten Preisen soweit erforderlich. Ausschüttungen werden nicht in die Haupt-YTD gemischt; eine Total-Return-Angabe bleibt getrennt. Bei Aktien ist die primäre Rendite die erwartete reguläre Jahresdividende geteilt durch den letzten Kurs; TTM-Rendite und Sonderausschüttungen bleiben separat. Das Haupt-KGV ist TTM auf einem explizit genannten EPS; Forward-KGV bleibt separat.

## Ausschlüsse und Datenlücken

ZGLD.SW und ABTC.SW erhalten keine KGV- oder Dividendenrendite. Bei BION.SW wird ein KGV nicht ohne NAV-Kontext als ökonomische Bewertungszahl interpretiert. Nicht kompatible Handelslinien, nicht überprüfbare GDR-/ADR-Verhältnisse, fehlende FX- oder Preiszeitreihen und unklare Corporate Actions bleiben Datenlücken, nicht Schätzwerte.
