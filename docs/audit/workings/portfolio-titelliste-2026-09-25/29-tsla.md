# TSLA — Tesla, Inc. (Prüfbericht zum 25.09.2026, 09:22 Europe/Zurich)

## Executive Summary

Die Entity Card ist für die geprüfte Primärlinie korrekt: **Tesla, Inc., TSLA, NasdaqGS/Nasdaq, USD, Stammaktie**. Der letzte verfügbare reguläre Schlusskurs vor dem Stichtag ist der **24.09.2026: USD 377,94**. Aus den tatsächlich geöffneten Yahoo-Historical-Data-Kursen ergibt sich für die verlangte reine Kurs-YTD (31.12.2025 bis 24.09.2026, unadjusted/splitbereinigt, ohne Dividenden) **−15,96 %**, nicht −13,2 %. Tesla weist keine Dividende aus; Forward- und TTM-Rendite sind daher **0,00 %**. Das bisherige KGV 356,55 ist nicht stabil reproduzierbar: Yahoo weist **TTM 351,96** und **Forward 158,73** aus, StockAnalysis (Datenquelle S&P Global Market Intelligence) **TTM 392,19** und **Forward 197,52**. Die Differenz ist eine EPS-/Datenanbieterdefinition, nicht ein ETF/ETP-Sonderfall. Eine eigene 5-Jahres-Tagesvolatilität konnte aus einer offen zugänglichen, vollständig abrufbaren Tagesreihe im Laufzeitumfeld nicht belastbar reproduziert werden; daher wird kein scheinpräziser Ersatzwert behauptet. Yahoo weist lediglich **Beta 5Y monthly 1,85** aus; das ist ausdrücklich nicht die verlangte annualisierte Standardabweichung täglicher Renditen.

## Identität, Handelslinie und Stichtagskurs

Die Entity Card nennt die Nasdaq-Handelslinie in USD. Yahoo Finance bestätigt auf der geöffneten Kursseite „NasdaqGS – Delayed Quote – USD“ und den Schlusskurs **USD 377,94 am 24.09.2026 um 16:00 EDT**. StockAnalysis bestätigt unabhängig „NASDAQ: TSLA“, „USD“ und denselben Schlusskurs. Es handelt sich um eine US-Stammaktie, nicht um ADR/GDR, ETF oder ETP. Der letzte dokumentierte Split ist der 3:1-Split vom 25.08.2022; die verwendeten historischen Yahoo-Schlusskurse sind splitbereinigt. Seitdem ist in den geöffneten Daten kein weiterer Split- oder Dividendenereignis ersichtlich.

## YTD-Kursperformance (ohne Dividenden)

Die definierte Hauptkennzahl ist Kursperformance in Handelswährung: `(Kurs 24.09.2026 / Schlusskurs 31.12.2025 − 1) × 100`. Yahoo Historical Data zeigt **31.12.2025: USD 449,72** und **24.09.2026: USD 377,94**. Die nachvollziehbare Rechnung lautet `(377,94 / 449,72 − 1) × 100 = −15,9637 %`, gerundet **−16,0 %**. Beide Kursfelder sind in Yahoo als „Close price adjusted for splits“ bezeichnet; „Adj Close“ ist bei Tesla am gezeigten Stichtag identisch, weil keine Ausschüttung erfasst ist. Der Wert ist somit eine Kurs-/keine Total-Return-Kennzahl. Eine separate Total-Return-Komponente ist mangels Dividende ebenfalls **−16,0 %**.

Der bisherige Wert **−13,2 %** ist damit als Korrektur zu behandeln. Eine CHF-Anlegerperformance wurde nicht berechnet, weil die verlangte Hauptbasis die Handelswährung USD ist und eine FX-Reihe nicht Bestandteil dieser Einzelprüfung war.

## Dividendenrendite

Yahoo Key Statistics weist „Forward Annual Dividend Rate —“, „Forward Annual Dividend Yield —“, „Trailing Annual Dividend Rate 0,00“ und „Trailing Annual Dividend Yield 0,00 %“ aus; Ex-Dividend-Date und Dividend-Date sind ebenfalls „—“. StockAnalysis bestätigt: Tesla „does not appear to pay any dividends“, Dividend Per Share n/a und Dividend Yield n/a. Für die strukturierte Liste wird deshalb fachlich **Forward 0,00 %** und **TTM 0,00 %** geführt, nicht ein fehlender oder geschätzter Wert. Es gibt keine Sonderdividende, keine Währungsumrechnung und keinen Total-Return-Dividendenbeitrag.

## KGV / EPS

Die Hauptdefinition ist TTM-KGV; Forward-KGV wird getrennt berichtet. Yahoo Key Statistics (geöffnet, Datenstand 25.09.2026) nennt **TTM P/E 351,96** (Spalte „Current“) und **Forward P/E 158,73**. Yahoo zeigt außerdem TTM diluted EPS **USD 1,06**. Die einfache Plausibilisierung mit dem Schlusskurs und diesem gerundeten EPS ist `377,94 / 1,06 = 356,55`; diese Rechnung erklärt, warum der bisherige Wert 356,55 nahe am Yahoo-Wert liegt, ist aber wegen des gerundeten EPS nicht die exakte Anbieterberechnung.

StockAnalysis nennt am selben Stichtag **TTM PE 392,19**, **Forward PE 197,52**, TTM EPS **USD 1,08** und TTM Net Income **USD 3,81 Mrd.**. Die Seite nennt als Datenquelle S&P Global Market Intelligence. Die Abweichung ist erheblich und resultiert plausibel aus unterschiedlichen Aktualisierungszeitpunkten, Aktien-/EPS-Definitionen und standardisierten versus Anbieterberechnungen; sie darf nicht als identische Kennzahl behandelt werden. Für diese Titelliste wird **Yahoo 351,96 / 158,73** als bevorzugte, zeitpunktnahe Quotierung übernommen, während StockAnalysis als unabhängige Kontrollspanne dokumentiert wird. Die 2025-10-K-/IR-Dokumente sind Primärquellen für die berichteten Gewinne, liefern aber nicht automatisch das am 25.09.2026 konsensbasierte Forward-EPS; deshalb wird kein selbst erfundenes Forward-EPS angegeben.

## 5-Jahres-Volatilität

Die verlangte Definition lautet annualisierte Stichproben-Standardabweichung täglicher Renditen über das Fenster 25.09.2021–24.09.2026, typischerweise `stdev(daily returns) × sqrt(252)`. Eine vollständige, tatsächlich abrufbare Tageskursreihe für alle fünf Jahre konnte in der verwendeten offenen Laufzeitumgebung nicht verlässlich geladen werden (Yahoo-Chart-API antwortete mit Rate-Limit; Nasdaq-Seite zeigte „Historical Data is currently not available“). Daher wird **keine eigene 5J-Vola als nachweisbarer Wert behauptet**. Yahoo weist **Beta (5Y Monthly) 1,85** aus; StockAnalysis weist **Beta (5Y) 1,84** aus. Beide Betas sind Markt-Sensitivitäten aus monatlichen/portalspezifischen Daten und **nicht** gleich annualisierte tägliche Kursvolatilität. Der bisherige Wert **59,9 %** bleibt deshalb „nicht abschließend verifiziert“, statt ihn fälschlich zu bestätigen oder durch Beta zu ersetzen.

## Strukturierte Kennzahlen

```json
{
  "ytd": {
    "price_return_pct": -16.0,
    "total_return_pct": -16.0,
    "currency": "USD",
    "basis": "unadjusted/split-adjusted close, 31.12.2025 USD 449.72 to 24.09.2026 USD 377.94",
    "status": "verifiziert"
  },
  "dividend": {
    "forward_yield_pct": 0.0,
    "ttm_yield_pct": 0.0,
    "forward_rate_usd": 0.0,
    "status": "verifiziert; Tesla zahlt keine Dividende"
  },
  "pe": {
    "ttm": 351.96,
    "forward": 158.73,
    "eps_basis": "Yahoo diluted EPS TTM USD 1.06; provider-reported ratios",
    "control": {"ttm": 392.19, "forward": 197.52, "source": "StockAnalysis/S&P Global Market Intelligence"},
    "status": "definitionsabhängig"
  },
  "volatility": {
    "five_year_annualized_daily_pct": null,
    "external_beta_5y_monthly_yahoo": 1.85,
    "external_beta_5y_stockanalysis": 1.84,
    "status": "nicht abschließend verifizierbar; Beta nicht als Vola verwenden"
  }
}
```

## Korrekturen

| Kennzahl | bisher | verifiziert | Grund |
|---|---:|---:|---|
| YTD-Kursperformance | −13,2 % | **−16,0 %** | Eigene Rechnung aus geöffneten Yahoo-Schlusskursen: `(377,94 / 449,72 − 1) × 100`; USD-Kurs, ohne Dividenden. |
| TTM-KGV | 356,55 | **351,96** (Kontrollspanne 392,19) | Aktueller Yahoo-Anbieterwert; 356,55 entsteht nur näherungsweise aus dem gerundeten EPS 1,06. Unterschiede zu StockAnalysis durch EPS-/Datenbasis. |
| Forward-KGV | nicht separat angegeben | **158,73** | Yahoo Key Statistics trennt Forward P/E vom TTM P/E; StockAnalysis-Kontrollwert 197,52. |
| 5J-Volatilität | 59,9 % | **nicht abschließend verifizierbar** | Keine belastbare vollständige Tagesreihe abrufbar; Beta 1,85/1,84 ist methodisch nicht substituierbar. |

## Quellen (tatsächlich geöffnet)

1. [Tesla Investor Relations](https://ir.tesla.com/) — IR-Übersicht, 2025 10-K und 2026 Q1/Q2 SEC-Verknüpfungen; Primärquellen-Navigation.
2. [Yahoo Finance TSLA Historical Data](https://finance.yahoo.com/quote/TSLA/history/) — NasdaqGS/USD, 24.09.2026 Schlusskurs 377,94, 31.12.2025 Schlusskurs 449,72, tägliche OHLC-/Close-/Adj-Close-Tabelle.
3. [Yahoo Finance TSLA Key Statistics](https://finance.yahoo.com/quote/TSLA/key-statistics/) — TTM P/E 351,96, Forward P/E 158,73, diluted EPS TTM 1,06, Forward-/TTM-Dividende 0,00 %, Beta 5Y monthly 1,85; Datenstand/Check 25.09.2026.
4. [StockAnalysis Tesla Statistics](https://stockanalysis.com/stocks/tsla/statistics/) — unabhängige Kontrolle: NASDAQ/USD, Schlusskurs 377,94, TTM PE 392,19, Forward PE 197,52, EPS 1,08, keine Dividende, Beta 1,84; Datenquelle S&P Global Market Intelligence, geprüft 25.09.2026.
5. [Nasdaq TSLA Historical Quotes](https://www.nasdaq.com/market-activity/stocks/tsla/historical) — offizielle Börsenseite geöffnet; historische Daten waren beim Abruf nicht verfügbar, daher keine daraus übernommene Zahl.

**Verdict:** Identität, Börse, Währung, YTD und Dividendenstatus sind verifiziert. KGV ist datenanbieter-/EPS-definitionsabhängig; 5J-Tagesvolatilität bleibt mangels belastbarer vollständiger Reihe offen. Der bisherige YTD-Wert ist eindeutig zu korrigieren; der bisherige KGV-Wert ist als veraltete bzw. nur näherungsweise reproduzierte Zahl zu ersetzen/zu dokumentieren.
