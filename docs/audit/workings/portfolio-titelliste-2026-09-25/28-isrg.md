# ISRG – Intuitive Surgical, Inc.

## Executive Summary

ISRG ist die **US-Stammaktie von Intuitive Surgical, Inc.** an der **Nasdaq Global Select Market (NasdaqGS)** in **USD**; es handelt sich weder um ADR/GDR noch um ETF/ETP. Diese Identität wird durch die Entity Card und die geöffnete Yahoo-Finance-Chart-Metadatei bestätigt (`symbol=ISRG`, `currency=USD`, `exchangeName=NMS`, `fullExchangeName=NasdaqGS`, `instrumentType=EQUITY`). Der letzte verfügbare reguläre Schlusskurs zum Stichtag ist **399,52 USD am 24.09.2026, 16:00 EDT**. Die reine Kurs-YTD vom letzten Schlusskurs 2025 bis 24.09.2026 beträgt aus den unadjustierten Schlusskursen **−29,4 %** (566,36 auf 399,52 USD) und liegt damit nahe am bisherigen Wert −29,1 %.

Intuitive Surgical zahlt keine Dividende; Forward- und TTM-Dividendenrendite sind daher jeweils **0,0 % bzw. nicht anwendbar**, nicht „–“ wegen einer fehlenden Datenquelle. Das TTM-KGV liegt bei **45,81** (StockAnalysis; EPS 8,72 USD) bzw. **45,87** (Macrotrends; 24.09.2026); das Forward-KGV beträgt **35,36**. Der bisherige Wert 45,66 ist somit als gerundete/zeitpunktabhängige TTM-Zahl plausibel, während das Forward-KGV zusätzlich dokumentiert werden muss.

Eine eigene 5-Jahres-Berechnung der annualisierten täglichen Renditevolatilität konnte aus der geöffneten historischen API-Quelle in dieser Ausführung nicht belastbar reproduziert werden; deshalb wird **kein scheinpräziser Volatilitätswert** ausgegeben. StockAnalysis weist lediglich eine 5J-Beta von 1,46 aus, die nicht mit einer 5J-Tagesvolatilität gleichzusetzen ist.

## Identität, Handelslinie und Währung

| Feld | Verifiziert |
|---|---|
| Instrument | Intuitive Surgical, Inc. Common Stock |
| Ticker | ISRG |
| Primäre Handelslinie | Nasdaq Global Select Market (NasdaqGS), USA |
| Handelswährung | USD |
| Instrumenttyp | Aktie / EQUITY |
| Schlusskurs-Stichtag | 24.09.2026, 16:00 EDT |
| Schlusskurs | 399,52 USD |

Die historische Kurs-API meldet exakt `currency=USD`, `symbol=ISRG`, `exchangeName=NMS`, `fullExchangeName=NasdaqGS` und `instrumentType=EQUITY`; StockAnalysis bestätigt „NASDAQ: ISRG“ und USD. Es liegt kein ADR/GDR-Verhältnis und keine Corporate Action im Bewertungszeitraum vor, die die Identität der Handelslinie verändert. Der letzte von StockAnalysis dokumentierte Split war 3:1 am 05.10.2021 und liegt außerhalb des 25.09.2021–24.09.2026-Fensters; für eine langfristige Renditereihe wäre er dennoch durch splitbereinigte Daten zu berücksichtigen.

## YTD-Kursperformance ohne Dividenden

Gemäß Prüfauftrag wird die unadjustierte Schlusskursformel verwendet:

`(Kurs 24.09.2026 / Kurs 31.12.2025 − 1) × 100`

Die geöffnete Yahoo-Finance-Tagesreihe liefert für den letzten Handelstag 2025 (31.12.2025) **566,36 USD** und für den letzten regulären Handelsschluss am Stichtag (24.09.2026) **399,52 USD**. Daraus folgt:

`(399,52 / 566,36 − 1) × 100 = −29,44 %`, gerundet **−29,4 %**.

Das ist **Kursperformance**, nicht Total Return. Da ISRG keine Dividenden ausschüttet, wäre der Total Return in diesem Zeitraum wirtschaftlich identisch (abgesehen von Daten-/Rundungsfragen). Die API stellt `close` und `adjclose` bereit; beide sind hier gleich, was mit der fehlenden Dividende konsistent ist. Der bisherige Wert **−29,1 %** wird als plausibel, aber um rund 0,3 Prozentpunkte zu aktualisieren beurteilt.

## Dividendenrendite: Forward und TTM

StockAnalysis weist für ISRG „does not appear to pay any dividends“ sowie Dividend Per Share und Dividend Yield jeweils als n/a aus. Das ist mit der Unternehmenshistorie und dem Geschäftsmodell als nicht ausschüttendes Wachstumsunternehmen konsistent. Für die standardisierte Tabelle ist daher zu verwenden:

- **Forward Dividend Yield: 0,0 % / nicht anwendbar** (keine reguläre erwartete Jahresdividende).
- **TTM Dividend Yield: 0,0 % / nicht anwendbar** (keine Ausschüttung in den letzten zwölf Monaten).

Die Werte sind nicht mit ETF-/ETP-Distribution-Yields zu verwechseln; ISRG ist eine Einzelaktie. Es gibt keine Sonderdividende, ADR-Gebühr oder Fremdwährungsumrechnung zu berücksichtigen.

## KGV / P/E

StockAnalysis (Datenstand 25.09.2026) weist einen Kurs von 399,52 USD, ein TTM-EPS von 8,72 USD, ein **TTM-KGV von 45,81** und ein **Forward-KGV von 35,36** aus. Die einfache Plausibilisierung ergibt `399,52 / 8,72 = 45,82`, also praktisch exakt den ausgewiesenen TTM-Wert.

Macrotrends weist für den 24.09.2026 399,52 USD, TTM-EPS 8,71 USD und **P/E 45,87** aus. Die Differenz von 0,06 Punkten erklärt sich durch unterschiedliche EPS-Rundung bzw. Datenfeed-/Berechnungszeitpunkt und ist nicht ökonomisch relevant. Der bisherige Wert **45,66** ist als zeitpunktnahe TTM-Angabe plausibel; empfohlen wird der aktuellere StockAnalysis-Wert 45,81 (mit Macrotrends als unabhängiger Kontrolle). TTM und Forward dürfen nicht vermischt werden: **45,81 TTM** und **35,36 Forward** messen unterschiedliche Gewinnbasen.

## 5-Jahres-Volatilität

Die verbindliche Definition wäre die annualisierte Standardabweichung täglicher Renditen über möglichst genau 25.09.2021–24.09.2026, vorzugsweise aus splitbereinigten Schlusskursen. Die geöffnete Yahoo-Chart-API stellt dafür tägliche `close` und `adjclose` bereit, einschließlich der 2021er 3:1-Splitinformation. In dieser Ausführung konnte die vollständige 5-Jahresreihe jedoch nicht sicher in eine reproduzierbare lokale Berechnung überführt werden. Daher wird der bisherige Wert **34,6 % weder bestätigt noch ersetzt**. StockAnalysis’ **Beta (5Y) 1,46** ist ausdrücklich nur ein relatives Marktrisiko-Maß und kein Ersatz für die verlangte annualisierte Tagesvolatilität. Verifizierter Wert: **nicht abschließend verfügbar**.

## Bereinigte Kennzahlentabelle

| Ticker | YTD Kurs | YTD Total Return | Div.-Yield Forward | Div.-Yield TTM | KGV TTM | KGV Forward | Vola 5J | Stand |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| ISRG | −29,4 % | −29,4 %* | 0,0 % | 0,0 % | 45,81 | 35,36 | – | 25.09.2026; Kurs 24.09.2026 |

\* Wegen fehlender Dividenden entspricht Total Return der Kursperformance, vorbehaltlich Rundungsdifferenzen.

## Beurteilung und Korrekturen

| Kennzahl | Bisher | Verifiziert | Beurteilung |
|---|---:|---:|---|
| YTD-Kurs | −29,1 % | −29,4 % | 🟡 plausibel/kleine Abweichung; eigene Schlusskursrechnung |
| Dividendenrendite | – | 0,0 % / n.a. | ✅ keine Dividende |
| KGV TTM | 45,66 | 45,81 (Kontrolle 45,87) | ✅ definitions-/zeitpunktbedingt bestätigt |
| KGV Forward | nicht angegeben | 35,36 | Ergänzen; nicht mit TTM vermischen |
| Volatilität 5J | 34,6 % | nicht abschließend verfügbar | ⚪ nicht ohne reproduzierbare Tagesdaten bestätigen |

## Quellen

1. [Yahoo Finance Chart API – ISRG, tägliche Kurse, Metadaten, Close/Adjusted Close und Corporate Actions](https://query1.finance.yahoo.com/v8/finance/chart/ISRG?period1=1766966400&period2=1790467200&interval=1d&events=div%2Csplits&includeAdjustedClose=true) – geöffnet; Kursstichtag 24.09.2026 und Schlusskurse 31.12.2025/24.09.2026.
2. [StockAnalysis – ISRG Statistics](https://stockanalysis.com/stocks/isrg/statistics/) – geöffnet; Schlusskurs, TTM-/Forward-KGV, EPS, Dividendenstatus, Beta und Datenstand 25.09.2026.
3. [Macrotrends – Intuitive Surgical PE Ratio](https://www.macrotrends.net/stocks/charts/ISRG/intuitive-surgical/pe-ratio) – geöffnet; unabhängige Kontrolle des P/E 45,87 am 24.09.2026 und TTM-EPS 8,71 USD.
4. [Intuitive Surgical Investor Relations – 2025 Annual Report](https://isrg.intuitive.com/static-files/d01bbc25-f8cf-433b-8ebb-b5afc1926236) – geöffnet; Primärquelle zur Gesellschaft und Finanzberichterstattung.
5. [Nasdaq – ISRG Market Activity](https://www.nasdaq.com/market-activity/stocks/isrg) – geöffnet; offizielle Handelsplatz-/Instrumentseite (dynamische Kursdaten waren zum Abruf nicht verfügbar).

## Structured metrics

```json
{
  "ytd": {"course_pct": -29.4, "total_return_pct": -29.4, "currency": "USD", "as_of": "2026-09-24 close", "method": "unadjusted close; 566.36 to 399.52"},
  "dividend": {"forward_yield_pct": 0.0, "ttm_yield_pct": 0.0, "status": "no dividend"},
  "pe": {"ttm": 45.81, "forward": 35.36, "eps_ttm_usd": 8.72, "independent_ttm_check": 45.87},
  "volatility": {"five_year_annualized_daily_pct": null, "status": "not reproducibly verified; 34.6% remains unconfirmed"}
}
``` 
