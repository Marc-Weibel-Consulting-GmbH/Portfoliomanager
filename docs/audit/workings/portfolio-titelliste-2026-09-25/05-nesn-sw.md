# NESN.SW – Nestlé S.A. (SIX)

## Kurzfazit

**NESN.SW ist korrekt als Nestlé-Stammaktie an der SIX Swiss Exchange in CHF identifiziert.** Als sauberer Kursstichtag für den Auftrag (25.09.2026, 09:22 Europe/Zurich) ist der letzte abgeschlossene SIX-Handelstag, der **24.09.2026**, zu verwenden; der Yahoo-Historienfeed zeigt zwar bereits einen 25.09.-Intraday-Satz, dieser war zum Referenzzeitpunkt nicht abgeschlossen. Der Schlusskurs am 24.09.2026 betrug **CHF 77,94**. Die reine Kurs-YTD vom letzten Schlusskurs 2025 (30.12.2025: CHF 78,74) bis 24.09.2026 beträgt damit **−1,0 %** (unadjusted close; (77,94 / 78,74 − 1)). Sie ist ausdrücklich **kein Total Return**.

Die Dividende von **CHF 3,10 je Aktie** für 2025 wurde von Nestlé als Vorschlag ausgewiesen und am 16.04.2026 von der Generalversammlung beschlossen; sie ist die reguläre letzte Jahresdividende. Daraus ergeben sich bei CHF 77,94 sowohl eine Forward-Rendite als auch eine TTM-Rendite von **3,98 % (≈4,0 %)**. Der letzte Ex-Dividendentag im Yahoo-Datensatz ist 20.04.2026; der Datensatz dokumentiert eine Dividendenzahlung von CHF 3,10.

Beim KGV ist die Definition entscheidend: Nestlés geprüfter Geschäftsbericht weist für 2025 ein **reported basic EPS von CHF 3,51** aus; der Kurs 77,94 geteilt durch dieses Jahres-EPS entspricht rund **22,2x**, ist aber kein TTM-Multiple aus den letzten vier Quartalen. Als unabhängige, explizit TTM/Forward bezeichnete Kontrollwerte weist Yahoo Finance zum abgerufenen Datenstand **TTM P/E 26,68x** und **Forward P/E 16,16x** aus. Der alte Listenwert 26,69x ist daher für TTM praktisch bestätigt; ein Forward-KGV darf nicht mit ihm vermischt werden.

## Identität, Handelslinie und Währung

| Feld | Verifiziert |
|---|---|
| Instrument | Nestlé S.A., Namenaktie/NESTLE N |
| Primäre Handelslinie | SIX Swiss Exchange, Symbol NESN, ISIN CH0038863350 |
| Handelswährung | CHF |
| Instrumenttyp | Aktie; kein ADR/GDR, kein ETF/ETP |
| Referenzkurs | CHF 77,94 Schlusskurs am 24.09.2026; 25.09.2026 um 09:22 war die Börse noch im laufenden Handel |

Die SIX-Share-Explorer-Seite identifiziert die Linie als **NESTLE N** und verlinkt zur Schweizer Börse; der Yahoo-Chartfeed bestätigt Symbol NESN.SW, Währung CHF, Exchange „Swiss“ und Instrumenttyp EQUITY. Es liegt kein Split/ADR-Verhältnis vor. Die auffällige Nestlé-Beteiligung an L’Oréal ist eine Konzernbeteiligung, macht NESN aber nicht zu einer Beteiligungsgesellschaft; ein normales Aktien-KGV bleibt grundsätzlich sinnvoll.

## Strukturierte Kennzahlen (Stichtag 25.09.2026, 09:22 Europe/Zurich)

```json
{
  "ytd": {
    "price_return_unadjusted": -1.0,
    "currency": "CHF",
    "start_date": "2025-12-30",
    "start_close": 78.74,
    "end_date": "2026-09-24",
    "end_close": 77.94,
    "total_return": "nicht separat berechnet; adjusted-close-Reihe wäre wegen Dividende nicht Kurs-YTD"
  },
  "dividend": {
    "forward_annual_dividend_chf": 3.10,
    "forward_yield": 3.98,
    "ttm_dividend_chf": 3.10,
    "ttm_yield": 3.98,
    "basis": "reguläre Jahresdividende / CHF 77.94"
  },
  "pe": {
    "ttm": 26.68,
    "forward": 16.16,
    "control_source": "Yahoo Finance; Definitionen ausdrücklich TTM bzw. Forward",
    "reported_2025_eps_crosscheck": 3.51,
    "price_divided_by_2025_reported_eps": 22.20
  },
  "volatility": {
    "five_year_annualized_daily_close_return": "nicht abschließend numerisch verifiziert in dieser Arbeitsumgebung",
    "method": "Standardabweichung täglicher Close-to-Close-Renditen × sqrt(252), splitbereinigte Kurse; Fenster 25.09.2021–24.09.2026",
    "existing_value": 18.4,
    "assessment": "plausibel, aber nicht als eigene Endzahl bestätigt"
  }
}
```

## Berechnung und Definitionskontrolle

**YTD.** Yahoo Historical Data weist für den 30.12.2025 einen Close von CHF 78,74 und für den 24.09.2026 CHF 77,94 aus. Beide Felder sind „Close price adjusted for splits“ und nicht „Adj Close“; die Seite erklärt, dass Adj Close zusätzlich Dividenden/Kapitalausschüttungen berücksichtigt. Daher wurde für die Hauptkennzahl der unadjustierte Schlusskurs genutzt: `(77,94 / 78,74 − 1) × 100 = −1,016 %`, gerundet **−1,0 %**. Der Ausgangswert von +0,9 % ist damit zu korrigieren. Eine Total-Return-Zahl wird nicht als Kurs-YTD ausgegeben; sie müsste mit der adjusted-close-Reihe und einer eindeutig festgelegten Reinvestitions-/Steuerannahme berechnet werden.

**Dividende.** Nestlés 2025-Ergebnisveröffentlichung nennt CHF 3,10 vorgeschlagene Dividende je Aktie (gegenüber CHF 3,05 für 2024). Der geprüfte Finanzbericht erklärt zugleich, dass die Dividende erst nach Genehmigung bilanziell als Ausschüttung behandelt wird; die Generalversammlung am 16.04.2026 genehmigte sie. Yahoo zeigt CHF 3,10 als letzte Ausschüttung bzw. Ex-Dividenden-Ereignis. Somit ist die TTM-Summe der regulären Ausschüttungen im zwölfmonatigen Fenster CHF 3,10. `3,10 / 77,94 = 3,977 %`. Forward und TTM fallen zufällig zusammen; es ist keine Sonderdividende bekannt.

**KGV.** Nestlés berichtetes 2025-EPS von CHF 3,51 ist ein Jahreswert und keine TTM-Schätzung. Die mechanische Plausibilisierung auf diesem EPS ergibt 22,20x. Yahoo Finance liefert für den tatsächlich aufgerufenen NESN.SW-Datensatz jedoch TTM P/E 26,68x und Forward P/E 16,16x. Diese Werte sind deshalb getrennt zu führen. Der Listenwert 26,69 liegt nur 0,01x vom Yahoo-TTM-Wert entfernt und ist als bestätigt/plausibel einzustufen; er darf nicht als Forward-KGV interpretiert werden.

**5-Jahres-Volatilität.** Vorgabe ist die annualisierte Standardabweichung täglicher Renditen aus einer durchgehenden Kursreihe 25.09.2021–24.09.2026, mit splitbereinigten Preisen, nicht eine monatliche Beta-/Vola-Kennzahl. Der Yahoo-Chartfeed wurde für dieses Fenster geöffnet und liefert die tägliche Close-Reihe sowie separate Dividendenereignisse; wegen einer lokalen Ausführungsbeschränkung konnte die numerische Batch-Berechnung der vollständigen Reihe hier nicht reproduzierbar abgeschlossen werden. Deshalb wird **18,4 % nicht als eigenberechneter verifizierter Wert behauptet**. Der bestehende Wert bleibt lediglich **plausibel/unbestätigt**, bis die Reihe offline mit `std(daily_returns) × sqrt(252)` gerechnet und gegen eine unabhängige Tagesdatenquelle abgeglichen ist.

## Beurteilung der bisherigen Werte

| Kennzahl | Bisher | Verifiziert/empfohlen | Beurteilung | Begründung |
|---|---:|---:|---|---|
| YTD Kurs, CHF, unadjusted | 0,9 % | **−1,0 %** | 🔴 Korrektur | direkte Rechnung 78,74 → 77,94; Dividende nicht eingerechnet |
| Forward-Dividendenrendite | 4,0 % | **4,0 %** | ✅ | CHF 3,10 / CHF 77,94 = 3,98 % |
| TTM-Dividendenrendite | nicht angegeben | **4,0 %** | 🟡 ergänzen | letzte reguläre Ausschüttung CHF 3,10; Forward = TTM |
| KGV TTM | 26,69x | **26,68x** | ✅ | Yahoo-TTM-Kontrollwert; Rundungsdifferenz |
| KGV Forward | nicht angegeben | **16,16x** | 🟡 ergänzen | Yahoo führt Forward separat; nicht mit TTM vermischen |
| 5J-Tagesvolatilität | 18,4 % | **nicht abschließend verifiziert** | 🟡 | Methode spezifiziert, eigene Vollreihenrechnung offen |

## Quellen (tatsächlich geöffnet)

1. [SIX Swiss Exchange – NESTLE N / Share Details, ISIN CH0038863350](https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0038863350CHF4.html) – Primärquelle für Handelslinie und SIX-Referenz.
2. [Nestlé – Full-year results 2025 and strategic update (19.02.2026)](https://www.nestle.com/media/pressreleases/allpressreleases/full-year-results-2025) – Primärquelle für reported EPS CHF 3,51, underlying EPS CHF 4,42 und vorgeschlagene Dividende CHF 3,10.
3. [Nestlé – Financial Statements 2025 (PDF)](https://www.nestle.com/sites/default/files/2026-02/financial-statements-2025-en.pdf) – geprüfte EPS-Angaben, Dividendennote und Genehmigungsvorbehalt.
4. [Yahoo Finance – NESN.SW Key Statistics](https://finance.yahoo.com/quote/NESN.SW/key-statistics/) – unabhängige Kontrollquelle für Kurs/Währung sowie TTM P/E 26,68x und Forward P/E 16,16x.
5. [Yahoo Finance – NESN.SW Historical Data](https://finance.yahoo.com/quote/NESN.SW/history/) – tägliche Close-/Adj-Close-Reihe, einschließlich 30.12.2025 CHF 78,74, 24.09.2026 CHF 77,94 und Dividendenereignis 20.04.2026.
6. [Yahoo Finance Chart API – NESN.SW daily chart](https://query1.finance.yahoo.com/v8/finance/chart/NESN.SW?period1=1640995200&period2=1790294400&interval=1d&events=div%2Csplits) – maschinenlesbare Tagesreihe, CHF-Metadaten und Ausschüttungsereignisse; als Datenkontrollquelle geöffnet.

## Eindeutige Korrekturen

- YTD Kurs | 0,9 % | **−1,0 %** | Unadjusted Close 30.12.2025 CHF 78,74 versus 24.09.2026 CHF 77,94; der bisherige Wert ist nicht mit der vorgegebenen Kurs-YTD-Definition vereinbar.

Keine Korrektur des TTM-KGV nötig: 26,69x gegenüber 26,68x ist nur Rundung/Datenstand. Die 5J-Volatilität wird mangels abgeschlossener eigener Rechenprüfung nicht als eindeutige Korrektur ausgegeben.

**Stand:** Recherche- und Datenstand 25.09.2026; für die Haupt-YTD wurde wegen des Referenzzeitpunkts 09:22 Europe/Zurich der letzte abgeschlossene Schlusskurs 24.09.2026 verwendet.
