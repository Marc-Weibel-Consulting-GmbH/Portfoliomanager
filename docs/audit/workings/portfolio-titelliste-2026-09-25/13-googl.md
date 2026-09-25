# GOOGL – Alphabet Inc. Class A

## Executive Summary

Alphabet Inc. Class A ist korrekt als **GOOGL** an der **Nasdaq Global Select Market** in **USD** identifiziert; **GOOG** ist die separate Class-C-Linie. Der letzte für den Stichtag verfügbare offizielle Schlusskurs ist der **24.09.2026: 342,36 USD** (Nasdaq-Handelsschluss 16:00 EDT). Die eigene Kurs-YTD-Berechnung auf unadjusted Close beträgt **+9,4 %** (31.12.2025 bis 24.09.2026); die Adjusted-Close-/Total-Return-Näherung beträgt wegen der drei 2026-Dividenden **+9,6 %**. Die Dividendensätze sind klein, aber rechnerisch nachvollziehbar: **Forward 0,26 %**, **TTM 0,25 %**. Yahoo weist **TTM-KGV 17,62** und **Forward-KGV 22,83** aus; der bisherige Listenwert 16,95 ist nicht der zum Stichtag verifizierte TTM-Wert. Eine eigenständige 5-Jahres-Tagesvolatilität konnte aus der öffentlichen Chart-Ansicht in dieser Arbeitsumgebung nicht belastbar reproduziert werden; daher wird kein scheinpräziser Wert ausgegeben. Die verwendete Yahoo-Kontrollseite liefert lediglich ein 5-Jahres-Monats-Beta (1,23), nicht die geforderte Tagesvolatilität.

## Identität, Handelslinie und Währung

| Feld | Verifiziert |
|---|---|
| Emittent | Alphabet Inc. |
| Wertpapier | Common Stock, **Class A** |
| Primäre Handelslinie | **GOOGL**, Nasdaq Global Select Market / NasdaqGS |
| Handelswährung | **USD** |
| Abgrenzung | GOOG ist Alphabet Class C; Class B ist nicht börsenkotiert. GOOGL ist weder ADR/GDR noch ETF/ETP. |
| Stichtag | 25.09.2026, 09:22 Europe/Zurich; mangels US-Handelsbeginn wird der Schlusskurs vom 24.09.2026 verwendet. |

Die Alphabet-10-K beschreibt ausdrücklich, dass Class A seit 03.04.2014 unter **GOOGL** an der Nasdaq Global Select Market notiert ist; Class C notiert unter GOOG. Der Q2-2026-Release bezeichnet Alphabet ebenfalls als **NASDAQ: GOOG, GOOGL**. Damit ist die Entity Card bestätigt.

## Kurs, YTD und Total Return

Yahoo Finance zeigt für den 24.09.2026 einen unadjusted/split-adjusted Schlusskurs von **342,36 USD**. Für den 31.12.2025 zeigt dieselbe historische Reihe **313,00 USD**; Macrotrends bestätigt für 2025 den Jahresendwert auf Adjusted-Basis von **312,392 USD**. Die Hauptkennzahl folgt der vorgegebenen unadjustierten Kursdefinition:

`(342,36 / 313,00 – 1) × 100 = 9,38 %`, gerundet **+9,4 %**.

Für eine getrennte Total-Return-Näherung verwende ich Yahoo Adjusted Close: 24.09.2026 **342,36 USD** gegenüber 31.12.2025 **312,39 USD**. Daraus folgt **+9,59 %**, gerundet **+9,6 %**. Der Unterschied von rund 0,2 Prozentpunkten entspricht der im Zeitraum reinvestitions-/preisadjustiert berücksichtigten Dividendenwirkung. Beide Reihen sind splitbereinigt; der letzte Alphabet-Split war laut Yahoo 20:1 am 18.07.2022, also außerhalb des YTD-Fensters.

## Dividende: Forward und TTM

Alphabet erklärte im Q2-2026-Release eine reguläre Quartalsdividende von **0,22 USD je Class-A-, Class-B- und Class-C-Aktie**, zahlbar am 14.09.2026. Yahoo weist am Stichtag eine **Forward Annual Dividend Rate von 0,88 USD** und eine **Trailing Annual Dividend Rate von 0,85 USD** aus. Die Berechnung am Kursstichtag ist:

| Kennzahl | Eingangsgröße | Berechnung | Verifiziert |
|---|---:|---:|---:|
| Forward Dividend Yield | 0,88 USD | 0,88 / 342,36 | **0,26 %** |
| TTM Dividend Yield | 0,85 USD | 0,85 / 342,36 | **0,25 %** |

Die Differenz ist definitionsbedingt: Forward annualisiert die aktuelle Quartalsrate von 0,22 USD; TTM summiert die tatsächlich im letzten Zwölfmonatsfenster ausgewiesenen Zahlungen. Yahoo listet als Ex-Dividenden-Datum 04.09.2026 und als Dividend Date 14.09.2026. Die Nasdaq-Dividendenhistorie war beim Abruf zwar erreichbar, meldete aber „Data is currently not available“; sie wird deshalb nicht als Beleg für einen konkreten Betrag verwendet. Die Primärquelle für 0,22 USD ist der Alphabet-Q2-Release.

## KGV / EPS

Yahoo Finance weist per 24.09./25.09.2026 **Diluted EPS (TTM) 20,20 USD**, **Trailing P/E 17,62** und **Forward P/E 22,83** aus. Die TTM-Rechnung ist plausibel: `342,36 / 20,20 = 16,95`; die kleine Differenz zum Yahoo-TTM-KGV 17,62 zeigt, dass Yahoo den Quotienten mit einer zeitgleichen/standardisierten Kurs- oder EPS-Basis berechnet und die sichtbare EPS-Zeile nicht zwingend exakt dieselbe Momentaufnahme ist. Für die Liste wird dennoch der explizit ausgewiesene Anbieterwert **17,62** als TTM-KGV verwendet und die rechnerische Abweichung offengelegt.

Der Q2-2026-Release meldet für Q2 2026 einen außergewöhnlich hohen diluted EPS von **9,11 USD** und für das erste Halbjahr **14,24 USD**, wesentlich beeinflusst durch einen Netto-Gewinn aus Wertpapieren von 98,0 Mrd. USD. Das erklärt, warum berichtetes/GAAP-TTM-EPS und Forward-Konsens nicht ohne Weiteres vergleichbar sind. Das Forward-KGV **22,83** ist eine separate, erwartungsbasierte Kennzahl und darf nicht als TTM-KGV eingesetzt werden. Der bisherige Listenwert **16,95** entspricht dem einfachen Quotienten 342,36/20,20, ist aber nicht der ausgewiesene Yahoo-TTM-Multiple; zudem war der historische Listen-Kursstichtag offenbar anders.

## 5-Jahres-Volatilität

Gefordert ist die annualisierte Standardabweichung täglicher Kursrenditen für ungefähr 25.09.2021–24.09.2026. Die zugängliche Yahoo-Historienseite bestätigt zwar die täglichen OHLC-/Close-/Adjusted-Close-Felder und den 24.09.2026-Schlusskurs, die öffentliche Darstellung war in dieser Ausführung jedoch auf eine begrenzte historische Tabelle/Ansicht beschränkt; eine vollständige, reproduzierbare Tagesreihe über das gesamte Fünfjahresfenster konnte nicht zuverlässig extrahiert werden. Yahoo weist auf der Statistikseite **Beta (5Y Monthly) = 1,23** aus, aber kein 5J-Tagesvolatilitätsmaß. Beta ist nicht Volatilität und wird daher nicht umetikettiert. Ergebnis: **5J-Tagesvolatilität nicht abschließend verifiziert; kein Ersatzwert**. Der Listenwert **32,2 %** kann damit weder bestätigt noch sauber widerlegt werden.

Methodisch wäre bei vollständiger Reihe zu rechnen: `stdev(Close_t / Close_(t-1) – 1) × sqrt(252)`. Die YTD-Hauptreihe verwendet unadjusted/split-adjusted Close; für die Vola wären wegen Dividenden und allfälliger Corporate Actions adjusted Close vorzuziehen, mit separater Kennzeichnung.

## Bereinigte Kennzahlentabelle

| Ticker | YTD Kurs | YTD Total Return | Div.-Yield Forward | Div.-Yield TTM | KGV TTM | KGV Forward | Vola 5J | Stand |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| GOOGL | **+9,4 %** | **+9,6 %** | **0,26 %** | **0,25 %** | **17,62** | **22,83** | **–** | 25.09.2026; Kursstand 24.09.2026 |

## Abgleich mit bisheriger Titelliste

| Kennzahl | Bisher | Verifiziert | Beurteilung |
|---|---:|---:|---|
| YTD Kurs | 7,2 % | 9,4 % | 🔴 abweichend; eigene unadjusted-Close-Rechnung |
| Dividendenrendite | 0,3 % | Forward 0,26 %, TTM 0,25 % | 🟡 plausibel, aber Definition fehlte |
| KGV | 16,95 | TTM 17,62; Forward 22,83 | 🔴 TTM/Forward bzw. Berechnungsbasis nicht sauber getrennt |
| 5J-Volatilität | 32,2 % | nicht abschließend verifizierbar | 🟡 keine belastbare Tagesreihenprüfung möglich |

## Structured metrics

```json
{
  "ytd": {
    "currency": "USD",
    "price_return_pct": 9.38,
    "total_return_pct": 9.59,
    "start_date": "2025-12-31",
    "end_date": "2026-09-24",
    "start_close_usd": 313.00,
    "end_close_usd": 342.36,
    "basis": "unadjusted/split-adjusted close; Total Return separately from adjusted close"
  },
  "dividend": {
    "forward_annual_usd": 0.88,
    "forward_yield_pct": 0.26,
    "ttm_annual_usd": 0.85,
    "ttm_yield_pct": 0.25,
    "basis": "regular common-stock dividend; no special dividend included"
  },
  "pe": {
    "ttm": 17.62,
    "forward": 22.83,
    "ttm_eps_usd_yahoo": 20.20,
    "basis": "Yahoo Finance displayed valuation measures; TTM and forward kept separate"
  },
  "volatility": {
    "five_year_annualized_daily_pct": null,
    "status": "not conclusively verifiable from the accessible complete daily series",
    "non_substitute_control": "Yahoo 5Y monthly beta 1.23 is not volatility"
  }
}
```

## Quellen (tatsächlich geöffnet)

1. [Alphabet Investor Relations](https://abc.xyz/investor/) – Investor-Relations-Navigation und Ergebnis-/SEC-Filing-Bereich; geöffnet am 25.09.2026.
2. [Alphabet Q2 2026 Earnings Release (PDF)](https://s206.q4cdn.com/479360582/files/doc_financials/2026/q2/2026q2-alphabet-earnings-release.pdf) – NASDAQ-Ticker GOOG/GOOGL, Q2-/YTD-EPS, 0,22-USD-Quartalsdividende, Zahlungs-/Record-Daten; 22.07.2026.
3. [Alphabet 2025 Form 10-K, SEC](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm) – Class-A-Notierung unter GOOGL, Class-C unter GOOG, Dividend Program und 2025-Dividendenzahlungen; Geschäftsjahr 2025.
4. [Yahoo Finance GOOGL Historical Data](https://finance.yahoo.com/quote/GOOGL/history/) – tägliche Close-/Adjusted-Close-Reihe, 31.12.2025 313,00/312,39 USD, 24.09.2026 342,36 USD, Ex-Dividenden-Einträge.
5. [Yahoo Finance GOOGL Key Statistics](https://finance.yahoo.com/quote/GOOGL/key-statistics/) – TTM P/E 17,62, Forward P/E 22,83, diluted EPS TTM 20,20 USD, Forward-/TTM-Dividendenraten und Renditen, 5Y-Monats-Beta 1,23.
6. [Macrotrends Alphabet price history](https://www.macrotrends.net/stocks/charts/GOOGL/alphabet/stock-price-history) – unabhängige Kurskontrolle: 24.09.2026 342,36 USD; Jahresdaten und Methodik als adjusted-for-splits-and-dividends gekennzeichnet.
7. [Nasdaq GOOGL Dividend History](https://www.nasdaq.com/market-activity/stocks/googl/dividend-history) – geöffnete offizielle Kontrollseite; beim Abruf keine Dividendenhistorie verfügbar, daher nicht als Betragsquelle verwendet.

## Corrections

`YTD Kurs | 7,2 % | 9,4 % | Unadjusted Schlusskurs 31.12.2025 313,00 USD und 24.09.2026 342,36 USD ergeben +9,38 %.`

`Dividendenrendite | 0,3 % | 0,26 % Forward / 0,25 % TTM | Yahoo weist 0,88 USD Forward-Rate und 0,85 USD TTM-Rate aus; bei 342,36 USD ergeben sich die getrennten Renditen.`

`KGV | 16,95 | 17,62 TTM / 22,83 Forward | TTM und Forward wurden im bisherigen Wert nicht getrennt; Yahoo weist beide Multiples separat aus.`

`5J-Volatilität | 32,2 % | nicht abschließend verifizierbar | Eine vollständige Tagesreihenberechnung konnte aus der zugänglichen öffentlichen Datenansicht nicht belastbar reproduziert werden; 5Y-Monats-Beta 1,23 ist kein Volatilitätswert.`

**Gesamturteil:** Identität, Börse und Währung sind eindeutig und bestätigt. YTD und Dividendenrendite sind mit klarer Definitionsseparation belastbar. Das KGV des Ausgangswerts ist nicht als sauberer Stichtags-TTM-Wert belegt. Die Volatilität bleibt eine offene Datenlücke und sollte erst nach Import einer vollständigen täglichen OHLCV-Reihe (idealerweise Nasdaq-/Yahoo-Download oder lizenzierte Marktdaten) endgültig korrigiert werden.
