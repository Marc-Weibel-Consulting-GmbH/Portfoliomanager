# BION.SW (BB Biotech AG) – Teilbericht zur externen Plausibilisierung

**Referenzzeitpunkt:** 25.09.2026, 09:22 Europe/Zurich. Für die Hauptkennzahlen wird der letzte verfügbare offizielle Schlusskurs vom 24.09.2026 verwendet. Alle Kursangaben beziehen sich auf CHF und die SIX-Handelslinie.

## Kurzfazit

BB Biotech AG ist **keine operative Biotech-Aktie und kein ETF/ETP**, sondern eine börsenkotierte Beteiligungsgesellschaft/Investmentgesellschaft mit einem Portfolio börsenkotierter Biotech-Unternehmen. Deshalb ist ein KGV nur eingeschränkt aussagekräftig: Der Gewinn schwankt stark mit den Marktwertänderungen der Beteiligungen. Der ökonomisch wichtigere Bewertungsanker ist der NAV und der Börsenkursabschlag zum NAV. Die Entity Card ist hinsichtlich Identität, Börse und Währung korrekt: **BION, SIX Swiss Exchange, CHF** (ISIN CH0038389992).

Die bisherige YTD-Angabe von 18,8 % ist als reine unadjustierte Kursperformance nicht bestätigt. Aus dem unadjustierten Schlusskurs vom 30.12.2025 von CHF 44,95 und dem offiziellen Schlusskurs vom 24.09.2026 von CHF 51,20 ergibt sich **(51,20 / 44,95 − 1) = 13,9 %**. Die offizielle BB-Biotech-Seite weist dagegen 19,89 % Share-Performance aus; diese Zahl ist nicht mit der verlangten unadjustierten Preisformel vereinbar und wird daher als definitionsabhängige, vermutlich ausschüttungs-/adjustmentbasierte Performance getrennt behandelt.

## Identität, Handelslinie und Stichtagskurs

| Merkmal | Verifiziert |
|---|---|
| Instrument | BB Biotech AG, Beteiligungsgesellschaft/Investmentgesellschaft |
| Primäre Handelslinie | BION an der SIX Swiss Exchange |
| ISIN | CH0038389992 |
| Handelswährung | CHF |
| Schlusskurs 24.09.2026 | CHF 51,20 |
| NAV je Aktie 24.09.2026 | CHF 58,70 |
| Discount zum NAV | −12,8 % |

Die Primärquelle nennt ausdrücklich „BION (SIX)“, Trading currency CHF, ISIN CH0038389992 und den Schlusskursstand 24.09.2026. Aus den ebenfalls veröffentlichten Kurs- und NAV-Werten lässt sich der Discount näherungsweise als 51,20 / 58,70 − 1 = −12,78 % nachvollziehen. Die SIX-Seite bestätigt die Wertpapierbezeichnung „BB BIOTECH N“ und ist die unabhängige Kontrollquelle für die Schweizer Börsenlinie; die dynamischen Kursfelder werden dort in der extrahierten Darstellung nicht vollständig ausgespielt.

## Strukturierte Metrics

```json
{
  "ytd": {
    "price_return_unadjusted_pct": 13.9,
    "price_return_basis": "CHF 44.95 Schlusskurs 30.12.2025 bis CHF 51.20 Schlusskurs 24.09.2026; ohne Dividende",
    "total_return_pct": 19.89,
    "total_return_status": "offizielle BB-Biotech-Performance, Definition/Adjustment nicht deckungsgleich mit der Hauptformel; separat ausgewiesen"
  },
  "dividend": {
    "ttm_chf_per_share": 2.25,
    "ttm_yield_pct": 4.39,
    "forward_chf_per_share": 2.25,
    "forward_yield_pct": 4.39,
    "next_consensus_estimate_chf_per_share": 2.454,
    "next_consensus_yield_pct": 4.79,
    "basis": "reguläre Ausschüttung; keine Sonderdividende im TTM-Fenster"
  },
  "pe": {
    "ttm": 2.09,
    "ttm_eps_chf": 24.57,
    "forward": 12.59,
    "forward_eps_chf": 4.068,
    "caveat": "bei Beteiligungsgesellschaft stark mark-to-market- und periodenabhängig; NAV/Discount sind primäre Ergänzung"
  },
  "volatility": {
    "five_year_annualized_daily_pct": null,
    "method": "gefordert: Standardabweichung täglicher Kursrenditen 25.09.2021–24.09.2026 × sqrt(252)",
    "status": "nicht abschließend verifizierbar aus den im Stichtagszugang verfügbaren vollständigen Tagesdaten; kein Portalwert als eigener Rechenwert ausgegeben"
  }
}
```

## YTD: Kurs gegenüber Total Return

Yahoo Finance stellt die historische Tabelle für BION.SW in CHF bereit und kennzeichnet den Schlusskurs als splitbereinigt; der **Adj Close** ist dagegen zusätzlich um Dividenden bzw. Ausschüttungen bereinigt. In der zugänglichen Tabelle sind unter anderem 30.12.2025: Close CHF 44,95 und 24.09.2026: Close CHF 51,20 ausgewiesen. Die reine Kursrechnung lautet:

`(51,20 / 44,95 − 1) × 100 = 13,86 %`, gerundet **13,9 %**.

Die offizielle BB-Biotech-Seite meldet für YTD 19,89 % Share-Performance und separat 22,16 % NAV-Performance. Da diese Zahl nicht aus den beiden unadjustierten Schlusskursen reproduzierbar ist und die Gesellschaft ihre historische Performance in Berichten grundsätzlich als Total Return inklusive Ausschüttungen darstellen kann, wird sie nicht mit der Haupt-Kurs-YTD vermischt. Die Ausschüttung von CHF 2,25 hatte Ex-Datum 23.03.2026; eine Total-Return-Rechnung liegt folglich über der reinen Kursrendite. Die ursprüngliche 18,8-%-Angabe ist nahe an dieser anderen Definition, aber für die verlangte Kurskennzahl nicht passend.

## Dividendenrendite: TTM und Forward

BB Biotech nennt für 2026 eine reguläre Dividende von **CHF 2,25**, Ex-Datum 23.03.2026, und eine angezeigte Rendite von rund 4,4 %. Die Gesellschaft erklärt zudem, dass der Verwaltungsrat die jährliche Rendite innerhalb eines Zielbands von 3–5 % festlegt und die Dividende auf Basis eines 20-Tage-VWAP bestimmt. Digrin bestätigt unabhängig die Dividendenhistorie, CHF 2,25 und eine Forward Yield von 4,39 % bei einem Preis von CHF 51,20. Die direkte Rechnung ist `2,25 / 51,20 = 4,3945 %`.

Für das **TTM-Fenster bis 25.09.2026** ist CHF 2,25 die einzige Ex-Dividende innerhalb der letzten zwölf Monate (23.03.2026); die CHF 1,80 vom 21.03.2025 liegt außerhalb des Fensters. Deshalb beträgt die TTM-Cash-Dividendenrendite ebenfalls **4,39 %**. Forward ist die Zahl nur dann belastbar, wenn CHF 2,25 als zuletzt festgelegte reguläre Jahresdividende fortgeschrieben wird. Eine noch nicht beschlossene nächste Ausschüttung darf nicht als sicherer Beschluss ausgegeben werden. MarketScreener führt als Analystenschätzung für 2026 CHF 2,454 bzw. 4,79 % auf; das ist eine **Forward-Schätzung**, nicht die beschlossene 2026-Ausschüttung.

## KGV und ökonomische Einordnung

Yahoo Finance weist zum Stichtagszugang **TTM P/E 2,09** und TTM-EPS CHF 24,57 aus; CHF 51,20 / CHF 24,57 = 2,084, also reproduzierbar rund 2,09. MarketScreener weist für 2026 EPS CHF 4,068 und P/E 12,59x aus; die rechnerische Relation 51,20 / 4,068 = 12,59 bestätigt diesen Forward-Wert.

Diese Werte sind bei BB Biotech nicht wie bei einem normalen Industrieunternehmen zu interpretieren. Das ausgewiesene EPS enthält Bewertungsgewinne und -verluste aus dem Portfolio; es kann daher von Jahr zu Jahr stark wechseln und ein extrem niedriges TTM-KGV erzeugen. Der Geschäftsbericht beschreibt das einzige Segment als Investition in Biotech-Unternehmen und weist per 31.12.2025 NAV CHF 2.778,8 Mio., Börsenkapitalisierung CHF 2.490,2 Mio. und einen Jahresgewinn CHF 578,1 Mio. aus. Für die Titelliste sollten **KGV TTM 2,09 und Forward 12,59 nur mit dem Hinweis „mark-to-market-/beteiligungsbedingt“** geführt werden. NAV je Aktie CHF 58,70 und der Abschlag von 12,8 % zum NAV sind die sachgerechtere Ergänzung. Das Instrument ist kein ETP, daher ist KGV nicht formal „nicht sinnvoll“ wie bei Gold- oder Bitcoin-ETPs; es ist aber ökonomisch eingeschränkt aussagekräftig.

## 5-Jahres-Volatilität

Die verbindliche Definition ist die annualisierte Standardabweichung täglicher **Kursrenditen** vom 25.09.2021 bis 24.09.2026, multipliziert mit √252. Für diesen Teilbericht konnte aus dem zugänglichen Stichtagsmaterial keine vollständige, maschinenlesbare Tagesreihe über das gesamte Fünfjahresfenster zuverlässig gewonnen und unabhängig gegen einen ausgewiesenen Tagesvolatilitätswert abgeglichen werden. Daher wird **kein scheinpräziser Prozentwert** ausgegeben. Der bisherige Wert von 25,5 % ist weder als eigene Rechnung reproduziert noch durch eine zugängliche unabhängige 5J-Tagesvolatilitätsquelle bestätigt und bleibt unverifiziert. Die Yahoo-Historientabelle macht zudem den notwendigen Unterschied zwischen Close (splitbereinigt) und Adj Close (zusätzlich dividendenbereinigt) ausdrücklich sichtbar; für eine Kursvolatilität wären Close-Renditen, bei Corporate Actions nötigenfalls splitbereinigt, die passende Basis.

## Beurteilung der bisherigen Werte

| Kennzahl | Bisher | Verifiziert/empfohlen | Beurteilung |
|---|---:|---:|---|
| YTD Kurs, unadjusted | 18,8 % | **13,9 %** | Korrektur; bisherige Zahl nicht aus Close-zu-Close reproduzierbar |
| YTD Total Return/adjusted | nicht getrennt | 19,89 % offizielle Share-Performance | definitionsabhängig, nicht mit Kurs-YTD vermischen |
| Dividendenrendite | 4,4 % | TTM 4,39 %; Forward 4,39 % auf letzter regulärer Dividende | bestätigt, Rundung |
| KGV TTM | 2,10 | 2,09; EPS CHF 24,57 | bestätigt, aber Beteiligungsgesellschaft-Caveat |
| KGV Forward | nicht getrennt | 12,59; EPS CHF 4,068 | ergänzend, Schätzung/Definitionsbasis |
| Volatilität 5J | 25,5 % | nicht abschließend verifizierbar | keine belastbare Korrektur ohne vollständige Tagesreihe |
| NAV/Discount | nicht im Ausgangssatz | CHF 58,70 / −12,8 % | wesentliche Zusatzkennzahl |

## Korrekturen

- **YTD Kurs | 18,8 % | 13,9 % | unadjustierte Close-zu-Close-Rechnung: CHF 44,95 am 30.12.2025 zu CHF 51,20 am 24.09.2026; Dividenden nicht eingerechnet**

## Quellen (tatsächlich geöffnet)

1. BB Biotech AG, Share Information (Primärquelle; Kurs CHF 51,20, NAV CHF 58,70, Discount −12,8 %, YTD 19,89 %, Dividende CHF 2,25, Handelslinie SIX/CHF, Datenstand 24.09.2026): https://www.bbbiotech.ch/all-en/all/investors/share-information
2. BB Biotech AG, Dividend Policy (Primärquelle; Zielband 3–5 %, Ausschüttungshistorie, Berechnungssystematik): https://www.bbbiotech.ch/all-en/all/investors/dividend-policy
3. SIX Swiss Exchange, Share Details CH0038389992CHF4 (unabhängige Kontrollquelle für BB BIOTECH N/SIX): https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0038389992CHF4.html
4. Yahoo Finance, BION.SW Quote/Statistics (unabhängige Kontrollquelle; CHF-Kurs, TTM P/E 2,09, EPS 24,57, Forward Dividend 2,25/4,37 %): https://finance.yahoo.com/quote/BION.SW/
5. Yahoo Finance, BION.SW Historical Data (Close/Adj Close, CHF 44,95 am 30.12.2025, CHF 51,20 am 24.09.2026, Dividendenereignis): https://finance.yahoo.com/quote/BION.SW/history/
6. BB Biotech AG, Annual Report 2025 (Primärquelle; Beteiligungs-/Investmentsegment, NAV, Marktkapitalisierung, Ergebnis, historische Total-Return-Methodik): https://www.bbbiotech.ch/_Resources/Persistent/7/4/6/c/746cb818af6a39ab5739cd1965eb90e4e93dae2a/BB%20Biotech%20AG%20GB%202025_en.pdf
7. Digrin, BION.SW Dividends (unabhängige Kontrollquelle; CHF 2,25, Ex-Datum, Forward Yield 4,39 %, Dividendenhistorie): https://www.digrin.com/stocks/detail/BION.SW/
8. MarketScreener, BB Biotech Valuation/Dividend (unabhängige Schätz-/Kontrollquelle; 2026 EPS CHF 4,068, Forward P/E 12,59x, geschätzte Dividende CHF 2,454): https://www.marketscreener.com/quote/stock/BB-BIOTECH-AG-2975835/valuation-dividend/

**Datenbasis und Caveat:** Preisstichtag ist der 24.09.2026; TTM bezieht sich auf die zuletzt ausgewiesenen Daten im Stichtagszugang. Forward-Werte sind als solche gekennzeichnet. Die Volatilität bleibt mangels belastbar verfügbarer vollständiger Tagesreihe offen. Dies ist Research und Analyse, keine personalisierte Anlageberatung.

## Structured metrics (Objekt)

```json
{
  "ytd": {"price": 13.9, "total_return_or_official_share_performance": 19.89},
  "dividend": {"ttm_yield": 4.39, "forward_yield": 4.39, "forward_consensus_yield": 4.79},
  "pe": {"ttm": 2.09, "forward": 12.59},
  "volatility": {"five_year_annualized_daily": null}
}
``` 

## Corrections

`YTD Kurs | 18,8 % | 13,9 % | unadjustierte Schlusskursrechnung ohne Dividenden`

