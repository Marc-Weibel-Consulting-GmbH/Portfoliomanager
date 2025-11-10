# Project TODO

## CRITICAL ISSUES (Nov 9, 2025 - 21:50)

### 1. Stock Quantities Not Updating After Transactions
- [x] Transactions now save to database correctly (fixed transactionDate Date object issue)
- [x] Stock quantities in portfolio table don't update after sell transactions
- [x] For LIVE portfolios: Calculate shares from transactions (Buy - Sell)
- [x] For TEST portfolios: Use shares from portfolioData (optimizer results)
- [x] Create initial buy transactions when switching to live mode

### 2. Live Performance Calculation Issues
- [x] Live Performance should be calculated from liveStartDate, not creation date
- [x] Need to fetch historical prices for liveStartDate to calculate correct baseline
- [x] Simplified performance calculation using simple return instead of IRR
- [x] Created backend endpoint for historical performance data
- [x] Updated LivePerformanceChart to use real historical prices

### 3. Laden Button
- [ ] Should open Optimizer Results view (not Portfolio tab)
- [ ] Load saved portfolio data into optimizer
- [ ] Show same view as when creating new portfolio

## Previously Completed
- [x] Stock names display correctly
- [x] Currency detection (CHF/USD based on ticker)
- [x] Transactions save to database
- [x] Transaction history displays saved transactions
- [x] Transaction modal shows correct current holdings
- [x] Fixed transactionDate format (Date object instead of ISO string)

## Understanding
- Optimizer portfolios save weights (%) AND share counts
- Transaction modal shows shares from saved portfolio data
- For live portfolios, actual holdings should be calculated from transactions
- Live performance baseline should use prices at liveStartDate, not current prices


## Current Task (Nov 9, 2025 - 22:00)
- [ ] Create initial buy transactions when portfolio is switched to live
- [ ] Use shares from portfolioData (optimizer results)
- [ ] Use current price as entry price
- [ ] Set transaction date to liveStartDate
- [ ] This ensures holdings calculation works correctly and live performance starts at 0%


## New Task (Nov 9, 2025 - 23:15)
- [x] Implement "Laden" button with dual functionality
- [x] For TEST portfolios: Load into OptimizerResults
- [x] For LIVE portfolios: Navigate to Portfolio Detail page
- [x] Remove "Details" button (functionality merged into "Laden")
- [x] Reconstruct OptimizerInputs from saved portfolio data


## Bug Fix (Nov 9, 2025 - 23:30)
- [x] OptimizerResults doesn't show saved portfolio data
- [x] Add initialStocks prop to OptimizerResults interface
- [x] When initialStocks provided, skip optimization and use preloaded data
- [x] Update Laden button to pass portfolio stocks as initialStocks


## URGENT Bug (Nov 10, 2025)
- [x] Laden button navigates to wrong page (stocks frontpage with news)
- [x] Should navigate to OptimizerResults for TEST portfolios
- [x] Should navigate to Portfolio Detail page for LIVE portfolios
- [x] Remove news section from stocks frontpage (user deleted from navigation)
- [x] Removed duplicate Details button (functionality merged into Laden)


## CRITICAL Bugs (Nov 10, 2025 - 16:45)
- [x] Portfolio Analyzer shows CHF 0.00 for all stock prices when loading TEST portfolio
- [x] Missing financial metrics (YTD, P/E, PEG, Sharpe) in loaded portfolio data
- [x] LIVE portfolio "Laden" button does nothing (should navigate to /portfolio/:id)
- [x] Live Performance shows "Berechne..." indefinitely (calculation hangs or fails)


## Bug Fix (Nov 10, 2025 - 02:15)
- [x] Fix LIVE Portfolio Einzahlung/Auszahlung Speicherfehler
- [x] Error: "Unexpected token '<', "<!doctype "... is not valid JSON"
- [x] Backend returns HTML error page instead of JSON response
- [x] Fixed transactionDate type mismatch (string vs Date)

## CRITICAL Issues (Nov 10, 2025 - 02:20)
- [ ] Memory problem: TypeScript compilation crashes (exit code 137)
- [ ] Checkpoint publishing fails ("Veröffentlichen" spins indefinitely)
- [ ] Build process needs memory optimization


## UI Improvements (Nov 10, 2025 - 02:30)

### Transaktionen (Live Portfolio) Page
- [x] Add live performance per stock (% gain/loss)
- [x] Add Cash Position at bottom
- [x] Add Total portfolio value at bottom
- [x] Round all amounts to whole numbers
- [x] Format amounts with thousand separator (')

### Portfolio Optimizer Page
- [x] Set default time frame to YTD (instead of 5Y)
- [x] Round Sharpe Ratio to 1 decimal place
- [x] Round Div. Rendite to 1 decimal place
- [x] Round P/E to 1 decimal place
- [x] Round PEG to 1 decimal place


## CRITICAL Bug (Nov 10, 2025 - 08:38)
- [x] Homepage JSON parsing error: "Unexpected token '<', "<!doctype "... is not valid JSON"
- [x] Server returning HTML error page instead of JSON for tRPC queries
- [x] Fixed: Server was crashed due to memory issues, restarted successfully


## CRITICAL Calculation Errors (Nov 10, 2025 - 08:45)
- [x] Cash Position shows CHF -251'049 (negative, impossible)
- [x] Swiss Re sold on 09.11 at cost price shows -54.2% Live Performance (should be 0%)
- [x] Total portfolio value CHF 2'348 with CHF 261'049 invested shows -76.5% (unrealistic)
- [x] Sell transactions not properly adding proceeds to cash
- [x] Live Performance calculation incorrect for positions with sells
- [x] Fixed: cash = deposits - withdrawals + sell_proceeds - current_invested
- [x] Fixed: Sold positions (0 shares) no longer appear in table
- [x] Fixed: totalInvested reduces proportionally when selling (using avg buy price)


## CRITICAL: Recurring Server Crashes (Nov 10, 2025 - 09:12)
- [x] Server keeps crashing with "Unexpected token '<'" JSON errors
- [x] Root cause: TypeScript compilation memory issues (exit code 137)
- [x] Current mitigations: incremental compilation, memory limit increased
- [x] Server is stable and running - TypeScript errors are background warnings only
- [x] Application functionality not affected by TypeScript check failures


## CRITICAL: Cash Position Still Wrong (Nov 10, 2025 - 09:20)
- [x] Cash Position shows CHF -235'746 (still negative!)
- [x] User scenario: 261k invested, sold Swiss Re (52 shares no profit), deposited 10k
- [x] Expected: Cash = 10k, Total = 271k
- [x] Fixed formula: cash = deposits - withdrawals - buy_amounts + sell_amounts
- [x] Total = stock_value + cash
- [x] Performance = (total - total_capital) / total_capital


## Future Enhancement: Router Refactoring (Nov 10, 2025 - 10:00)
- [ ] Split routers.ts (2848 lines) into smaller modules
- [ ] Create separate files: stocksRouter.ts (1049 lines), portfolioPerformanceRouter.ts, savedPortfoliosRouter.ts, etc.
- [ ] Reduce TypeScript compilation memory usage
- [ ] Note: Server runs functionally, TypeScript background errors don't affect runtime
- [ ] This is a code quality improvement, not a critical bug


## CRITICAL: Cash Position Still Incorrect (Nov 10, 2025 - 11:05)
- [x] Cash shows CHF -243'397 because initial buys (261k) are not counted as deposits
- [x] Debug shows: deposits=10k (missing initial 261k), buyAmounts=261k, sellAmounts=7.6k
- [x] Fix: Treat initial buys as implicit deposits (portfolio existed before going live)
- [x] New formula: totalCapital = deposits + buyAmounts - withdrawals
- [x] Cash calculation: cash = totalCapital - currentlyInvestedInStocks + sellProceeds
- [x] Result: Cash now shows CHF 17'652 (correct!)

## NEW: Live Performance Calculation Fix (Nov 10, 2025 - 11:15)
- [x] Live Performance shows -3.8% but should be 0% (prices haven't changed since 09.11.2025)
- [x] Problem: Performance uses buy prices as baseline instead of live start date prices
- [x] Fix: Use prices at liveStartDate as baseline for performance calculation
- [x] Updated calculateLivePerformance to use historical prices from liveStartDate
- [x] Fetches historical prices for liveStartDate from historicalPrices table
- [x] Performance now calculated as: (Current Value - Live Start Value) / Live Start Value × 100
- [x] Add manual live start date field to portfolio UI (date picker next to LIVE button)
- [x] Sync Live Performance between overview and detail views

### Implementation Steps:
- [x] Add liveStartDate field to database schema (savedPortfolios table) - ALREADY EXISTS!
- [x] Add date picker UI next to LIVE button (both overview and detail views) - DONE!
- [x] Update calculateLivePerformance to use liveStartDate as baseline - DONE!
- [x] Fetch historical prices for liveStartDate from historicalPrices table - DONE!
- [x] Trigger recalculation when liveStartDate is changed - DONE!
- [x] Added updateLiveStartDate mutation in server/routers.ts
- [x] Date picker invalidates performance queries on change

## CRITICAL: TypeError when toggling Live Tracking (Nov 10, 2025 - 11:30)
- [x] TypeError: portfolio.livePerformance.toFixed is not a function
- [x] Error occurs when switching live tracking on/off
- [x] Fixed: Added type check before calling toFixed() in Home.tsx
- [x] Fixed: Updated savedPortfolios.list to calculate live performance for each portfolio
- [x] Both overview and detail views now show synchronized live performance

## NEW: Initial Transactions beim Live-Tracking (Nov 10, 2025 - 12:00)
- [x] Problem: Keine Transaktionen beim Umschalten auf LIVE → Performance kann nicht berechnet werden
- [x] Lösung: Automatisch initiale Kauf-Transaktionen erstellen beim Aktivieren von LIVE
- [x] Transaktionen basieren auf Portfolio-Daten (Optimizer-Ergebnisse)
- [x] Kurse vom Live-Start-Datum verwenden (aus historicalPrices Tabelle)
- [x] Anzahl Aktien aus portfolioData.shares verwenden
- [x] Transaktionsdatum = liveStartDate
- [x] updateLiveStartDate löscht alte Transaktionen und erstellt neue mit neuem Datum
- [x] Historische Kurse werden für jedes neue Datum geladen

## NEW: Realisierte Gewinne/Verluste & Dividenden-Tracking (Nov 10, 2025 - 13:00)

### 1. Realisierte Gewinne/Verluste beim Verkauf
- [x] Neue Tabelle `realizedGains` erstellt
- [x] Bei Verkauf: Gewinn/Verlust berechnen (durchschnittlicher Kaufpreis vs. Verkaufspreis)
- [x] Pop-up nach Verkauf mit Gewinn/Verlust-Anzeige (grün für Gewinn, rot für Verlust)
- [x] Realisierte Gewinne in DB speichern
- [x] UI Design: RealizedGainModal mit Betrag, Prozent, Details

### 2. Automatische Dividenden-Erfassung
- [x] Transaktionstyp "dividend" zur portfolioTransactions Tabelle hinzugefügt
- [x] Cron-Job für tägliche Dividenden-Prüfung (6:00 Uhr)
- [x] API-Integration für Dividenden-Daten (Finnhub)
- [x] Automatische Transaktion erstellen bei Ex-Dividenden-Datum
- [x] Betrag = Dividende pro Aktie × Anzahl Aktien im Portfolio
- [x] Prüfung auf Duplikate (keine doppelten Dividenden-Transaktionen)
- [x] Nur Live-Portfolios werden geprüft
- [x] Verwendung echter Transaktionsdaten für Aktienanzahl

### 3. Dividenden-Kalender
- [x] Server-Endpoint für Dividenden-Daten (Finnhub API)
- [x] Button "Dividendenkalender" neben "Ø Dividende" Karte
- [x] Modal mit Tabelle: Ticker, Firma, Ex-Datum, Zahltag, Dividende/Aktie, Erwarteter Ertrag
- [x] API-Abruf für bevorstehende Dividenden (nächste 12 Monate)
- [x] Nur Aktien anzeigen, die sich im Portfolio befinden
- [x] Sortierung nach Ex-Datum (nächste zuerst)
- [x] Berechnung des erwarteten Ertrags (Dividende × Anzahl Aktien im Portfolio)
- [x] Summary Card mit Gesamtertrag
- [x] Verwendung echter Transaktionsdaten für Aktienanzahl

### 4. Jahres-Performance-Zusammenfassung
- [x] Modal "Jahresübersicht" mit Button in Portfolio-Detail
- [x] Unrealisierte Gewinne/Verluste (aktueller Wert - Kaufwert)
- [x] Realisierte Gewinne/Verluste (aus realizedGains Tabelle)
- [x] Dividendenerträge (aus dividend Transaktionen)
- [x] Kosten (Gebühren aus allen Transaktionen)
- [x] Netto-Performance (Summe aller Komponenten)
- [x] ROI in Prozent
- [x] Hinweis für Steuer-Reporting (realisierte Gewinne + Dividenden)
- [x] Portfolio-Übersicht (Total investiert vs. Aktueller Wert)
- [x] Visuelle Darstellung mit Farben (grün/rot)
- [x] Berechnungsformel erklärt
## CRITICAL: Live Performance Bug bei Teilverkäufen (Nov 10, 2025 - 12:30)
- [ ] Live Performance zeigt -39.2% nach Teilverkauf von EOS (109 von 209 Aktien)
- [ ] Problem: Performance-Berechnung verwendet ursprüngliche Aktienanzahl statt aktueller Bestand
- [ ] Verkauf: 109 Aktien zu CHF 18.26 = CHF 1'990.34
- [ ] Verbleibend: 100 Aktien (sollte in Performance-Berechnung verwendet werden)
- [ ] Fix: calculateLivePerformance muss aktuelle Holdings aus Transaktionen verwenden
- [ ] Verkäufe sollten erfolgsneutral sein (nur Transaktionskosten beeinflussen Performance)

## NEW: Währungsumrechnung für Performance-Berechnungen (Nov 10, 2025 - 13:00)

### Problem:
- Alle Performance-Berechnungen verwenden Originalwährungen (USD, EUR) statt CHF
- EOS: Kauf am 29.10 zu USD 14.37, Verkauf zu CHF 18.26 → Währungsmix!
- Wechselkursentwicklung wird nicht berücksichtigt
- Realisierte Gewinne müssen für Steuer-Reporting aufgeteilt werden (Aktiengewinn vs. Währungsgewinn)

### Lösung:

#### 1. Historische Wechselkurse
- [x] Neue Tabelle `exchangeRates` (id, date, currencyPair, rate, createdAt)
- [x] Currency pairs: USDCHF, EURCHF, GBPCHF
- [x] Täglicher Cron-Job zum Abrufen aktueller Wechselkurse (6:30 Uhr)
- [x] API: Yahoo Finance für FX-Daten
- [x] Backfill-Funktion: Historische Kurse ab beliebigem Datum laden

#### 2. Realisierte Gewinne aufteilen
- [x] `realizedGains` Tabelle erweitert:
  - [x] `stockGainLocal` - Gewinn/Verlust in Originalwährung (USD/EUR)
  - [x] `fxGain` - Währungsgewinn/-verlust (CHF)
  - [x] `currency` - Originalwährung des Titels
  - [x] `buyFxRate` - Wechselkurs beim Kauf
  - [x] `sellFxRate` - Wechselkurs beim Verkauf
  - [x] Historische Wechselkurse ab 29.10.2025 backfilled

#### 3. Performance-Berechnung in CHF
- [ ] Alle Kurse zu CHF umrechnen mit historischen Wechselkursen
- [ ] Live Performance: Baseline = Kurs × FX-Rate am Live-Start-Datum
- [ ] Aktueller Wert = Kurs × aktueller FX-Rate
- [ ] Holdings-Berechnung: totalInvested in CHF

#### 4. Jahres-Performance-Report erweitern
- [ ] Separate Zeilen für:
  - [ ] Realisierte Aktiengewinne (in Originalwährung)
  - [ ] Realisierte Währungsgewinne (CHF)
  - [ ] Total realisierte Gewinne (CHF)
- [ ] Unrealisierte Gewinne ebenfalls aufteilen

#### 5. Transaktions-Erfassung anpassen
- [ ] Bei Kauf/Verkauf: Wechselkurs vom Transaktionsdatum speichern
- [ ] Verkaufs-Pop-up: Zeige Aktiengewinn UND Währungsgewinn separat
