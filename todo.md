# Project TODO

## CRITICAL ISSUES (Nov 9, 2025 - 16:30)

### 1. Portfolio Detail Page Errors
- [ ] Fix "Rendered more hooks" error
- [ ] Verify page loads without errors
- [ ] Show Stückzahl, Total investiert, Aktueller Wert columns

### 2. Laden Button
- [ ] Should open Optimizer Results view (not Portfolio tab)
- [ ] Load saved portfolio data into optimizer
- [ ] Show same view as when creating new portfolio

### 3. Holdings Calculation
- [ ] Fix transaction modal showing 0 shares
- [ ] Calculate correct holdings from transactions
- [ ] Display current holdings when selling

## Previously Completed
- [x] Stock names display correctly
- [x] Currency detection (CHF/USD based on ticker)
- [x] Transactions save to database
- [x] Details button navigates to transaction page


## NEW UNDERSTANDING (Nov 9, 2025 - 16:45)
- [ ] Optimizer portfolios save only weights (%), not share counts
- [ ] Need to save "Stück" (share count) from optimizer when saving portfolio
- [ ] Transaction modal should show shares from saved portfolio, not from transactions
- [ ] "Laden" button should open Optimizer Results view with full portfolio data
