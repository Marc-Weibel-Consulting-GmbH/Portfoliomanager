# PLTR — Palantir Technologies Inc. Class A

**Prüfzeitpunkt:** 25.09.2026, 09:22 Europe/Zurich. Für die Vergleichbarkeit wurde der letzte verfügbare offizi­elle US-Schlusskurs vom **24.09.2026** verwendet. Handelswährung ist **USD**.

## Executive Summary

1. Die Entity Card ist korrekt: **Palantir Technologies Inc. Class A, PLTR, Nasdaq/NasdaqGS, USD**; es handelt sich um eine Aktie, nicht ADR/GDR oder ETP.
2. Der 24.09.2026-Schlusskurs beträgt **$192,59**. Yahoo weist NasdaqGS und USD aus; der offizielle 10-K nennt Class A, Symbol PLTR und The Nasdaq Stock Market LLC.
3. Die selbst nachgerechnete **YTD-Kursperformance ohne Dividenden beträgt 8,35 %**: ($192,59 / $177,75 − 1), mit unadjustierten, splitbereinigten Schlusskursen. Der bisherige Wert **14,3 %** ist damit nicht bestätigt.
4. Palantir zahlte keine Dividende; Forward- und TTM-Dividendenrendite sind **0,00 %** bzw. wirtschaftlich „keine Ausschüttung“. Yahoo zeigt Forward Annual Dividend Rate „--“, TTM Rate 0,00 und beide Yields 0,00 %.
5. Das bisherige KGV **164,61** ist als TTM-KGV nachweisbar: Macrotrends verwendet am 24.09.2026 $192,59 und TTM-EPS $1,17 bzw. 164,61x. Yahoo zeigt zeitnah 163,92x; die geringe Differenz ist Daten-/Rundungsstichtag.
6. Das empfohlene **Forward-KGV beträgt 85,47x** nach Yahoo (aktueller Stand der geöffneten Kennzahlenseite); GuruFocus liefert als unabhängige Kontrolle 71,65x zum 12.09.2026. Unterschied: Konsensus-/Stichtags- und EPS-Basis; nicht als identische Serie vermischen.
7. Eine von Yahoo-Tagesdaten selbst reproduzierbare 5-Jahres-Berechnung konnte im vorliegenden Lauf wegen der Sandbox-Ausführungsbeschränkung nicht numerisch ausgeführt werden. Die Rohdaten-URL ist geöffnet und enthält Tageskurse/adjusted close für den Zeitraum. Die bisherige 67,0 % ist deshalb **nicht abschließend verifiziert**.
8. MarketChameleon bestätigt Identität und Nasdaq-Linie sowie den 24.09.2026-Kurs, veröffentlicht auf der geöffneten Übersichtsseite aber keinen auslesbaren 5-Jahres-Tagesvolatilitätswert; der dortige 20-Tage-Tagesbereich ist keine 5-Jahres-Vola.

## Identität, Börse und Währung

Der offizielle Palantir-10-K für das am 31.12.2025 beendete Geschäftsjahr listet „Class A Common Stock“, Symbol **PLTR**, Börse **The Nasdaq Stock Market LLC**. Die Yahoo-Chart-API bestätigt `symbol: PLTR`, `exchangeName: NMS`, `fullExchangeName: NasdaqGS`, `instrumentType: EQUITY` und `currency: USD`. Damit ist die in der Entity Card vorgegebene Handelslinie richtig. Es gibt keinen ADR-/GDR-Faktor und keine ETP-Sonderlogik.

## Kurs und YTD-Kursperformance

Yahoo Historical Data weist für den **31.12.2025** einen Close von **$177,75** und für den **24.09.2026** einen Close von **$192,59** aus. Yahoo beschreibt die Close-Spalte als splitbereinigt, während Adjusted Close zusätzlich Dividenden/Kapitalmaßnahmen berücksichtigt. Da Palantir keine Dividende zahlt und kein Split im geprüften Zeitraum ausgewiesen ist, sind Close und Adjusted Close in der Reihe identisch.

**Eigene Rechnung:**

`YTD = (192,59 / 177,75 − 1) × 100 = 8,34599 % = 8,3 %`.

Dies ist reine Kursperformance in USD, ohne Dividenden und ohne CHF-Umrechnung. Ein Total Return ist mangels Ausschüttungen identisch; er wird nicht mit der Kurskennzahl vermischt. Der bisherige Listeneintrag 14,3 % weicht um **−5,95 Prozentpunkte** ab und ist als Korrektur zu behandeln.

## Dividenden

Yahoo Key Statistics weist **Forward Annual Dividend Rate: --**, **Forward Annual Dividend Yield: --**, **Trailing Annual Dividend Rate: 0,00**, **Trailing Annual Dividend Yield: 0,00 %**, **Payout Ratio: 0,00 %** und kein Ex-Dividend-Date aus. Der 10-K enthält keine Ankündigung einer regulären Dividende; Palantirs Kapitalverwendung ist daher nicht als laufende Ausschüttungsrendite zu modellieren.

**Empfohlene Darstellung:** Forward Dividend Yield: **0,00 % / keine geplante Dividende**; TTM Dividend Yield: **0,00 %**. Die Unterscheidung ist wichtig: „--“ bei Forward bedeutet beim Anbieter keine ausgewiesene Rate, nicht eine positive Rendite. Für die Titelliste ist 0,0 % die belastbare wirtschaftliche Darstellung.

## KGV: TTM versus Forward

Die offizielle Q2-2026-Ergebnisveröffentlichung meldet für das Quartal zum 30.06.2026 GAAP diluted EPS **$0,41** und Net Income attributable to common stockholders **$1.061,890 Mio.**; für das erste Halbjahr 2026 diluted EPS **$0,75**. Diese Quartals-/Halbjahreswerte sind nicht allein ein TTM-EPS und werden daher nicht fälschlich als TTM verwendet.

Macrotrends zeigt für den 24.09.2026: Kurs **$192,59**, TTM Net EPS **$1,17**, P/E **164,61x**. Die Kontrollquelle Yahoo zeigt TTM diluted EPS **$1,17** und aktuelles Trailing P/E **163,92x**. Die Differenz von 0,69x (0,4 %) liegt innerhalb der erwartbaren Zeit-/Rundungsabweichung. **Empfohlener TTM-Wert: 164,61x**, ausdrücklich auf TTM-EPS $1,17 und GAAP/diluted-Basis bezogen.

Yahoo zeigt **Forward P/E 85,47x**. GuruFocus zeigt **71,65x per 12.09.2026** und kennzeichnet diese Kennzahl als Forward PE Ratio. Beide sind forward-looking und dürfen nicht mit TTM-KGV oder mit dem alten Listenwert 164,61 als dieselbe Definition vermischt werden. Für den Referenzstichtag wird Yahoo 85,47x als primärer, zeitnäherer Forward-Wert verwendet; GuruFocus ist unabhängige Kontrolle, aber achtet Tage älter und basiert auf einem anderen Schätz-/Konsensusdatensatz.

Palantir ist profitabel; ein KGV ist daher ökonomisch sinnvoll. Die hohe TTM-Bewertung ist keine ETP-/ETF-Fehlklassifikation. GAAP und adjusted/non-GAAP EPS sind jedoch nicht austauschbar; die oben empfohlenen Marktseitenwerte sind als Anbieter-KGVs zu lesen, nicht als eigene Rekonstruktion aus nur einem Quartal.

## 5-Jahres-Volatilität

Verbindliche Definition: annualisierte Standardabweichung täglicher Renditen über möglichst 25.09.2021–24.09.2026, `stdev(daily returns) × sqrt(252)`. Die geöffnete Yahoo-Chart-API liefert Tages-`close` und `adjclose` für PLTR, Währung USD und NasdaqGS-Metadaten. Wegen einer Sandbox-Ausführungsbeschränkung konnte die gespeicherte Berechnung nicht ausgeführt werden; daher wird kein scheinpräziser eigener Vola-Wert behauptet.

MarketChameleon wurde als unabhängige Kontrolle geöffnet. Die Seite nennt PLTR Class A / NASDAQ, den 24.09.2026-Kurs $192,59 und einen kurzfristigen 20-Tage-Tagesbereich, enthält jedoch keinen auslesbaren 5-Jahres-Wert nach der geforderten Tagesrendite-Definition. Der bisherige Wert **67,0 %** bleibt deshalb **nicht abschließend verifiziert** und sollte nicht als bestätigt markiert werden. Insbesondere darf ein 20-Tage- oder impliziter Optionsvolatilitätswert nicht als 5-Jahres-historische Tagesvolatilität ausgegeben werden.

## Ergebnisobjekt / empfohlene Kennzahlen

```json
{
  "ytd": {
    "value": 8.3,
    "unit": "%",
    "basis": "Kursrendite USD, unadjusted/splitbereinigter Close, 31.12.2025 bis 24.09.2026",
    "total_return": 8.3,
    "status": "verifiziert"
  },
  "dividend": {
    "forward_yield": 0.0,
    "ttm_yield": 0.0,
    "basis": "keine Dividende; Yahoo Forward Rate -- und TTM Rate 0,00",
    "status": "verifiziert"
  },
  "pe": {
    "ttm": 164.61,
    "forward": 85.47,
    "ttm_eps": 1.17,
    "basis": "TTM diluted EPS; Forward-Anbieterwert, nicht mit GuruFocus 71,65 per 12.09.2026 vermischt",
    "status": "TTM verifiziert; Forward definitions-/stichtagsabhängig"
  },
  "volatility": {
    "five_year_annualized_daily": null,
    "basis": "eigene Berechnung aus Yahoo daily adjusted close vorgesehen; numerisch im Lauf nicht ausführbar",
    "status": "nicht abschließend verifiziert",
    "control": "MarketChameleon geöffnet, aber kein kompatibler 5J-Tageswert auslesbar"
  }
}
```

## Korrekturen

| Kennzahl | bisher | verifiziert | Grund |
|---|---:|---:|---|
| YTD-Kursperformance | 14,3 % | 8,3 % | eigene Rechnung aus unadjustiertem/splitbereinigtem Close: $177,75 am 31.12.2025 zu $192,59 am 24.09.2026; ohne Dividenden |
| KGV Forward | nicht in Ausgangsliste getrennt | 85,47x | Forward-KGV muss separat vom TTM-KGV geführt werden; Yahoo-Stichtagswert, GuruFocus-Kontrolle 71,65x am 12.09.2026 |
| Volatilität 5J | 67,0 % | nicht abschließend verifiziert | Rohdaten-URL geöffnet, aber numerische Ausführung der geforderten Tages-Stichprobe in der Sandbox blockiert; keine inkompatible Kurzfrist-/Optionsvola substituiert |

## Quellen (tatsächlich geöffnet)

1. Palantir Technologies, **2025 FY Form 10-K** (Class A, PLTR, Nasdaq; Geschäftsjahr 31.12.2025): <https://investors.palantir.com/files/2025%20FY%20PLTR%2010-K.pdf>
2. SEC Exhibit 99.1, **Palantir Q2 2026 Results** (30.06.2026 GAAP diluted EPS $0,41; Halbjahr $0,75): <https://www.sec.gov/Archives/edgar/data/1321655/000132165526000039/a2026q2ex991pressrelease.htm>
3. Palantir Investor Relations, **SEC Filings** (geöffnete Filings-Übersicht; Q2-2026 10-Q vom 04.08.2026): <https://investors.palantir.com/financials/sec-filings>
4. Yahoo Finance, **PLTR Historical Data** (Close $177,75 am 31.12.2025; $192,59 am 24.09.2026; USD/NasdaqGS): <https://finance.yahoo.com/quote/PLTR/history/>
5. Yahoo Finance, **PLTR Key Statistics** (TTM P/E 163,92; Forward P/E 85,47; diluted EPS TTM $1,17; Dividend fields): <https://finance.yahoo.com/quote/PLTR/key-statistics/>
6. Yahoo Finance Chart API, **PLTR daily OHLC/adjusted close** (Rohdaten für 5J-Tagesvola): <https://query1.finance.yahoo.com/v8/finance/chart/PLTR?period1=1632528000&period2=1790467200&interval=1d&events=history>
7. GuruFocus, **PLTR Forward PE Ratio** (71,65 per 12.09.2026): <https://www.gurufocus.com/term/forward-pe-ratio/PLTR>
8. Macrotrends, **PLTR PE Ratio** (TTM EPS $1,17; P/E 164,61 am 24.09.2026): <https://www.macrotrends.net/stocks/charts/PLTR/palantir-technologies/pe-ratio>
9. MarketChameleon, **PLTR overview** (Class A/NASDAQ; 24.09.2026-Kurs; keine kompatible 5J-Tagesvola auslesbar): <https://marketchameleon.com/Overview/PLTR/DailyCharts/>

**Basis/Offenlegung:** Kurs-YTD ist USD-Kursrendite ohne Dividenden; Close ist splitbereinigt, nicht Total Return. KGV TTM ist Anbieterwert auf TTM diluted EPS; Forward-KGV ist separat und konsensus-/stichtagsabhängig. Zeitbasis: 24.09.2026 Schlusskurs, letzter verfügbarer Schlusskurs vor dem Referenzzeitpunkt. Die Volatilität bleibt offen statt geschätzt, weil die geforderte eigene Berechnung in diesem Lauf nicht ausgeführt werden konnte. Dies ist Research und Analyse, keine personalisierte Finanzberatung.
