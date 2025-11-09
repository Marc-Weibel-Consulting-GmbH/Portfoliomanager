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
