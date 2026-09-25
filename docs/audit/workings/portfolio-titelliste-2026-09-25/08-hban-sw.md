# HBAN.SW – Helvetia Baloise Holding AG

## Kurzfazit

Die Entity Card ist korrekt: **HBAN** ist die Namenaktie (ISIN CH0466642201) an der **SIX Swiss Exchange** in **CHF**; es handelt sich weder um ADR/GDR noch um ein ETP. Die Fusion von Helvetia und Baloise ist für die historische Interpretation relevant: Der Zusammenschluss wurde Ende 2025 vollzogen, und Baloises Beitrag war im IFRS-Ergebnis 2025 noch nicht in der Gewinn- und Verlustrechnung enthalten. Die Börsenlinie und der Ticker blieben jedoch HBAN. Am Referenzzeitpunkt weist SIX für 25.09.2026 um 10:25:57 Uhr einen Kurs von CHF 213.60 und einen letzten Schlusskurs von CHF 213.00 aus. SIX zeigt YTD +2.10%; dies bestätigt die bisherige Größenordnung von +1.9%, wobei die offizielle SIX-Zahl vorzuziehen ist.

## Identität, Handelslinie und Kursstichtag

Die Primärquelle von Helvetia Baloise nennt Ticker **HBAN**, ISIN **CH0466642201**, Börse **SIX Swiss Exchange**, 100% Namenaktien und Nominalwert CHF 0.02. Die Handelswährung ist CHF. SIX bestätigt dieselbe ISIN und dasselbe Symbol; die SIX-Seite weist am 25.09.2026 um 10:25:57 Uhr einen Last Trade von CHF 213.60 und den letzten Schlusskurs von CHF 213.00 aus. Für einen Vergleich mit der Ausgangsdatenbasis um 09:22 Europe/Zurich ist der letzte verfügbare offizielle Schlusskurs maßgeblich; der 24.09.2026-Schlusskurs von CHF 213.00 ist daher der saubere Tagesstichtag. Der 25.09.-Intradaykurs wird nur als Kontext angegeben, nicht mit dem Schlusskurs vermischt.

## Strukturereignis und historische Vergleichbarkeit

Helvetia Baloise meldet, dass die Fusion Ende 2025 als Erwerb nach IFRS bilanziert wurde. Im Jahresabschluss 2025 ist Baloises Ergebnisbeitrag zur Gewinn- und Verlustrechnung noch nicht enthalten, sondern im Wesentlichen nur in der Bilanz; im ersten Halbjahr 2026 liegen erstmals kombinierte Ergebnisse vor. Das ist ein wesentlicher Grund, weshalb TTM- und Forward-KGV nicht unkritisch aus einem einzigen Geschäftsjahr abgeleitet werden dürfen. Es gab keine für die Börsenidentität relevante Umstellung von HBAN auf eine andere Aktie. Eine frühere 1:5-Aktiensplit-Historie (13.05.2019) ist von Yahoo dokumentiert und liegt außerhalb des hier verwendeten Fünfjahresfensters; splitbereinigte Reihen sind trotzdem für lange Historien vorzuziehen.

## Verifizierte Kennzahlen

| Kennzahl | Verifiziert | Definition / Datenstand | Beurteilung gegenüber bisher |
|---|---:|---|---|
| YTD-Kursperformance | **+2.10%** | SIX-Performanceanzeige, 25.09.2026; Kursperformance, nicht Total Return | 🟡 bisher +1.9% plausibel, aber SIX ist maßgeblich |
| Dividende Forward | **CHF 7.70 je Aktie; ca. 3.6%** | Beschlossene bzw. vorgeschlagene reguläre Dividende für GJ 2025; CHF 7.70 / CHF 213.60 = 3.60% (auf 24.09.-Schluss CHF 213.00 = 3.62%) | ✅ bisher 3.6% bestätigt |
| Dividende TTM | **CHF 7.70 je Aktie; ca. 3.6%** | Yahoo: trailing annual dividend CHF 7.70, trailing yield 3.62% | ✅ bestätigt |
| KGV TTM | **41.26** | Yahoo Statistics, CHF 213.60, diluted EPS TTM CHF 5.22; 213.60 / 5.22 = 40.92, geringe Differenz durch Datenzeitpunkt/rounding | 🔴 bisher 40.80 nahe, aber nicht exakt; Yahoo liefert den aktuellen TTM-Wert |
| KGV Forward | **nicht belastbar als einheitlicher Stichtagswert**; Kontrollwert MarketScreener: **20.6x für 2027E** | Yahoo Forward P/E nicht verfügbar; MarketScreener weist 2026 wegen negativer EPS-Prognose mit -1,183x aus und 2027E mit 20.6x | 🟡 bisheriger Wert 40.80 ist kein Forward-KGV |
| 5J-Volatilität | **nicht abschließend verifizierbar** | SIX-Historic-CSV-URL geöffnet; die ausgelieferte Datei enthielt nur den aktuellen Ausschnitt bis 27.04.2026 und nicht das verlangte vollständige Fenster 25.09.2021–24.09.2026. Daher keine Scheingenauigkeit | ⚪ bisher 19.9% weder bestätigt noch widerlegt |

### YTD: Kurs versus Total Return

SIX weist für HBAN am Referenzdatum eine **YTD change von +2.10%** aus. Diese Zahl ist als Börsenkurs-Performance zu behandeln; sie ist nicht als Total Return inklusive der am 27.05.2026 ex-dividend gegangenen CHF-7.70-Ausschüttung zu interpretieren. Eine separat aus einer vollständigen unadjustierten Tagesreihe nachgerechnete YTD-Zahl konnte aus der geöffneten SIX-Historien-CSV nicht reproduziert werden, weil der Download nur 2026-Daten bis 27.04.2026 enthielt. Für die Titelliste wird deshalb der explizit ausgewiesene SIX-Wert verwendet, nicht eine erzwungene Rekonstruktion.

### Dividendenrendite: Forward und TTM getrennt

Helvetia Baloise kündigte für das Geschäftsjahr 2025 eine Dividende von **CHF 7.70 je Aktie** an; Yahoo führt sowohl Forward Annual Dividend Rate als auch Trailing Annual Dividend Rate mit CHF 7.70. Beim SIX-Referenzschluss CHF 213.00 ergibt sich 7.70 / 213.00 = **3.62%**, gerundet 3.6%. Auf dem intraday SIX-Kurs CHF 213.60 sind es 3.60%. Es ist keine Sonderdividende als Bestandteil dieser Zahl ausgewiesen. Der Stichtagswert 3.6% ist daher für Forward und TTM praktisch identisch; die Bezeichnungen bleiben dennoch getrennt.

### KGV: TTM, Forward und Sondereffekte

Yahoo weist beim aktuellen Kurs von CHF 213.60 ein **Trailing P/E von 41.26** und ein verwässertes TTM-EPS von CHF 5.22 aus. Eine Gegenrechnung mit den gerundeten Portalwerten ergibt 213.60 / 5.22 = 40.92; die Differenz ist mit nicht gerundeten Kurs-/EPS-Daten und Datenzeitpunkt erklärbar. Der alte Wert 40.80 ist somit als Größenordnung plausibel, aber nicht der verifizierte aktuelle TTM-Wert.

Ein belastbares Forward-KGV ist nicht verfügbar: Yahoo gibt „--“ aus. MarketScreener zeigt für 2026E wegen einer negativen EPS-Prognose ein ökonomisch nicht sinnvolles negatives KGV von -1,183x, für 2027E dagegen 20.6x. Dieser 2027E-Wert ist ausdrücklich eine Schätzung und nicht mit TTM 41.26 zu vermischen. Die starke Differenz ist sachlich erklärbar: Der H1-2026-IFRS-Gewinn wurde durch CHF 671.7 Mio. beschleunigte Abschreibung mergerbezogener immaterieller Werte belastet, während die zugrunde liegenden Erträge CHF 631.6 Mio. betrugen. Deshalb sollte in der Hauptliste TTM 41.26 stehen und Forward als „nicht belastbar / 2027E 20.6x Kontrollwert“ dokumentiert werden.

### 5-Jahres-Volatilität

Die verbindliche Methodik wäre die annualisierte Standardabweichung der täglichen unadjustierten bzw. bei Corporate Actions erforderlichen splitbereinigten Kursrenditen von etwa 25.09.2021 bis 24.09.2026, multipliziert mit √252. Die offizielle SIX-Historien-URL wurde tatsächlich geöffnet. Der ausgelieferte CSV-Inhalt begann jedoch nur mit 25.09.2026 und reichte in dem verfügbaren Dokument bis 27.04.2026 zurück; das vollständige Fünfjahresfenster war nicht enthalten. Ohne die fehlenden 2021–April-2026-Daten wäre eine eigene 5J-Vola nicht reproduzierbar. Der Ausgangswert **19.9%** wird daher nicht als verifiziert übernommen und nicht korrigiert.

## Empfohlener strukturierter Metrics-Block

```json
{
  "ytd": {
    "value_pct": 2.10,
    "type": "price_return",
    "currency": "CHF",
    "as_of": "2026-09-25",
    "source": "SIX Swiss Exchange"
  },
  "dividend": {
    "forward": {"chf_per_share": 7.70, "yield_pct_at_213_00": 3.62, "yield_pct_rounded": 3.6},
    "ttm": {"chf_per_share": 7.70, "yield_pct": 3.62, "yield_pct_rounded": 3.6},
    "currency": "CHF"
  },
  "pe": {
    "ttm": {"value": 41.26, "eps_ttm_chf_yahoo": 5.22},
    "forward": {"value": null, "control_2027e": 20.6, "control_2026e": -1183, "note": "Yahoo forward unavailable; 2026E negative EPS makes P/E not meaningful"}
  },
  "volatility": {
    "five_year_annualized_daily": null,
    "previous_value_pct": 19.9,
    "status": "not_verifiable_from_available_SIX_history_download"
  }
}
```

## Eindeutige Korrekturen

- **KGV TTM | 40.80 | 41.26 | Yahoo weist am Stichtag ein aktuelles Trailing P/E von 41.26 aus; 40.80 ist lediglich eine nahe, aber nicht aktuelle/identische Datenbasis.**

Der bisherige YTD-Wert +1.9% wird nicht als eindeutiger Fehler markiert, weil er innerhalb der Rundung und des Kurszeitpunkts liegt; SIX weist aktuell +2.10% aus. Die 5J-Volatilität 19.9% wird mangels vollständiger Kursreihe ausdrücklich offen gelassen und nicht als Korrektur behauptet.

## Quellen (tatsächlich geöffnet)

1. Helvetia Baloise, **Share price and key figures** (Ticker, ISIN, SIX, 2025 price/EPS/P-E/dividend): https://www.helvetia-baloise.com/corporate/hb/en/home/investors/aktie-und-aktionariat/share-price-key-figures.html
2. Helvetia Baloise, **Dividend** (Dividendenpolitik und historische Ausschüttungen): https://www.helvetia-baloise.com/corporate/hb/en/home/investors/aktie-und-aktionariat/dividend.html
3. SIX Swiss Exchange, **Share details CH0466642201CHF4** (HBAN, CHF-Kurs, Schlusskurs, YTD +2.10%, Handelsdaten): https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0466642201CHF4.html
4. SIX Swiss Exchange, **Historical values CSV** (offizielle Tageskursquelle; geöffneter Download mit unvollständigem verfügbarem Ausschnitt): https://www.six-group.com/sheldon/market_data/v1/CH0466642201CHF4/historic.csv
5. Yahoo Finance, **HBAN.SW Key Statistics** (TTM-/Forward-KGV, EPS TTM, Forward-/Trailing-Dividende, Ex-Tag): https://finance.yahoo.com/quote/HBAN.SW/key-statistics/
6. MarketScreener, **Valuation** (2026E/2027E KGV, EPS, Dividendenschätzungen): https://www.marketscreener.com/quote/stock/HELVETIA-BALOISE-HOLDING--58256052/valuation/
7. Helvetia Baloise/EQS, **2025 performance and CHF 7.70 dividend proposal** (2025 underlying earnings, IFRS income, Dividendenvorschlag, Fusionskontext): https://www.eqs-news.com/news/ad-hoc/helvetia-baloise-delivers-a-strong-2025-performance-increases-total-dividends-and-introduces-ambitious-financial-targets-for-2028/8e81e9ca-d92e-4e08-8a71-c87aa73b0eb7_en
8. MarketScreener, **H1 2026 results** (CHF 631.6 Mio. underlying earnings, CHF 84.6 Mio. IFRS net income, CHF 671.7 Mio. mergerbezogene Abschreibung): https://www.marketscreener.com/news/helvetia-baloise-delivers-strong-half-year-operating-results-and-fast-integration-progress-while-mai-ce785ad3d889f325

**Stand:** 25.09.2026, Europe/Zurich; letzter offizieller Schlusskurs für die Schlusskurskennzahlen: 24.09.2026. Intraday-Kontrollkurs SIX: 25.09.2026, 10:25:57, CHF 213.60.
