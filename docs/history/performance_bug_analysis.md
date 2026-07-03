# Performance Bug Analysis - 11.01.2026

## Problem
Portfolio-Performance zeigt 0% bei fast allen Portfolios, nur Benchmark funktioniert korrekt.

## Beobachtungen aus dem Screenshot
- Portfolio "Regula Live" zeigt im Chart nur Werte von 0% bis 4%
- Der Benchmark (S&P 500) zeigt korrekte Werte
- Die Portfolioliste zeigt +11.46% für Regula, aber der Chart zeigt nur ~0-4%
- Performance im Detail: -5.55% (Gesamt Performance)

## Server Logs zeigen:
```
[11:48:37] [HistoricalPerformance] holdingsAtYtdStart: {}
[11:48:37] [HistoricalPerformance] isLivePortfolio: 1, ytdStartDate: 2025-12-11
[11:48:37] [HistoricalPerformance] startingValueCHF: 0
```

## Problem identifiziert:
1. `holdingsAtYtdStart` ist leer `{}`
2. `startingValueCHF` ist 0
3. Das führt dazu, dass die Performance-Berechnung 0% zurückgibt

## Ursache:
In `getRealTwrSeriesFromTransactions`:
- `startValue` wird aus `initialHoldings` und `initialCash` berechnet
- Wenn `initialHoldings` leer ist und `initialCash` = 0, dann ist `startValue` = 0
- Division durch 0 führt zu 0% Performance

## Zu prüfen:
1. Warum ist `holdingsAtYtdStart` leer?
2. Wie werden die initialen Holdings berechnet?
3. Werden die Transaktionen korrekt geladen?
