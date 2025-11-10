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
