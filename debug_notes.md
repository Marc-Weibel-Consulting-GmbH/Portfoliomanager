# Debug-Analyse: "Keine historischen Daten verfügbar"

## Problem
Das "Test Cash Portfolio" zeigt "Keine historischen Daten verfügbar" obwohl es als Live markiert ist.

## Ursache identifiziert
1. **Test Cash Portfolio (ID: 1020002)**:
   - isLive: true
   - liveStartDate: 2026-01-11T16:13:22.000Z
   - **Transaktionen: 0** ← DAS IST DAS PROBLEM!
   - Stocks in portfolioData: 10

2. **Regula Portfolio (ID: 270001)** - funktioniert:
   - isLive: true
   - liveStartDate: 2025-12-28T18:44:43.000Z
   - Transaktionen: 14 ✓
   - Stocks in portfolioData: 14

## Code-Analyse
In `getHistoricalPerformance`:
- Zeile 1032-1041: Für Live-Portfolios werden Transaktionen geladen
- Zeile 1052-1058: Wenn `transactions.length === 0`, wird `earliestTransactionDate = null`
- Zeile 1104: `shouldUseStitchedBranch` wird nur true wenn `isLivePortfolio && (period === 'YTD' || period === 'All') && creationDate`
- Zeile 1317-1322: Wenn `realRes` leer ist, wird `{ chartData: [] }` zurückgegeben

Das Problem ist:
1. Live-Portfolio ohne Transaktionen → `transactions = []`
2. `getRealTwrSeriesFromTransactions` gibt leere Serie zurück
3. `chartData = []` wird zurückgegeben

## Lösung
Für Live-Portfolios ohne Transaktionen sollte das System:
1. Die Aktien aus `portfolioData` verwenden (wie bei Test-Portfolios)
2. Eine hypothetische Performance basierend auf den Gewichtungen berechnen
3. ODER einen klaren Hinweis anzeigen, dass Transaktionen fehlen

## Empfohlene Änderung
Im Frontend: Wenn ein Live-Portfolio keine Transaktionen hat, sollte eine Warnung angezeigt werden und ggf. auf die Test-Portfolio-Logik zurückgefallen werden.
