# Portfolio Debugging Strategy

## Overview

This document outlines a systematic approach to debugging portfolio calculations, based on best practices for financial performance tracking.

---

## Phase 1: Implement Debugging Infrastructure

### 1.1 Frontend Debug Panel

**Goal:** Make all calculation inputs and outputs visible in the UI

**Implementation:**
- Add a debug toggle (only visible in development)
- Show raw data for each calculation:
  - Transaction inputs (shares, price, FX rate, fees)
  - Cost basis calculations
  - Cash flow tracking
  - Performance metrics (TWR, realized gains)
- Add "Export as JSON" button for each section
- Display correlation ID for tracing

**Files to modify:**
- `client/src/pages/PortfolioDetail.tsx`
- Create `client/src/components/DebugPanel.tsx`

### 1.2 Backend Logging & Tracing

**Goal:** Track calculations end-to-end with correlation IDs

**Implementation:**
- Add `trace_id` to all calculation procedures
- Log intermediate steps:
  - Transaction processing
  - Cost basis updates
  - Realized gain calculations
  - Performance metrics
- Use structured logging (JSON format)

**Files to modify:**
- `server/routers.ts` (add logging to calculation procedures)

### 1.3 SQL Reference Calculations

**Goal:** Provide independent validation of calculations

**Implementation:**
- Create SQL queries that calculate metrics independently
- Compare with application results
- Store in reconciliation table

**Files to create:**
- `server/sql-reference/cost-basis.sql`
- `server/sql-reference/realized-gains.sql`
- `server/sql-reference/performance.sql`

---

## Phase 2: Test Portfolio Creation

### 2.1 Test Scenario Design

**Golden Portfolio #1: Simple Buy-and-Hold**
- 3 positions (2 CHF, 1 USD)
- No sells, no dividends
- Expected: Cost basis = total invested

**Golden Portfolio #2: Buy-Sell Cycle**
- 2 positions
- Buy → Sell partial → Buy again
- Expected: Realized gains tracked correctly

**Golden Portfolio #3: Multi-Currency**
- USD, EUR, CHF positions
- Fixed FX rates for reproducibility
- Expected: Correct FX conversion

### 2.2 Test Data Preparation

**For each test portfolio:**
1. Document expected values (Excel/JSON)
2. Create transactions with known outcomes
3. Record FX rates used
4. Calculate expected results manually

---

## Phase 3: Test Mode Validation

### 3.1 Initial Position Check

**Validate:**
- [ ] All transactions imported correctly
- [ ] Shares match expected values
- [ ] Cost basis calculated correctly
- [ ] Cash position accurate

**Debug checklist:**
```
1. Check transaction count in DB
2. Verify totalAmountCHF for each transaction
3. Sum all BUY transactions → should equal "Invested in Stocks"
4. Calculate cash: Deposits - Buys + Sells + Dividends
5. Compare with UI display
```

### 3.2 Transaction Processing

**For each transaction type:**

**BUY:**
- [ ] Shares added to holdings
- [ ] Cost basis increased
- [ ] Cash decreased
- [ ] FX conversion correct

**SELL:**
- [ ] Shares removed from holdings
- [ ] Cost basis reduced proportionally
- [ ] Realized gain calculated
- [ ] Cash increased

**DIVIDEND:**
- [ ] Cash increased
- [ ] No impact on holdings
- [ ] Recorded in transaction history

**DEPOSIT/WITHDRAWAL:**
- [ ] Cash adjusted
- [ ] No impact on holdings

---

## Phase 4: Live Mode Performance

### 4.1 Performance Calculation Validation

**Metrics to validate:**

1. **Total Current Value**
   ```
   = Current Stock Value (CHF) + Cash Position
   ```

2. **Invested in Stocks**
   ```
   = Sum of cost basis for all current holdings
   ```

3. **Total Deposits**
   ```
   = Sum of DEPOSIT transactions
   - Sum of WITHDRAWAL transactions
   + Implicit deposits (initial BUY transactions on liveStartDate)
   ```

4. **Performance %**
   ```
   = (Total Current Value - Total Deposits) / Total Deposits * 100
   ```

5. **Realized Gains**
   ```
   = Sum of (Sell Price - Cost Basis) * Shares for all SELL transactions
   ```

### 4.2 Debug Checklist for Performance

**Step-by-step validation:**

1. **Check Live Start Date**
   - [ ] Correct date set
   - [ ] Initial positions on that date identified

2. **Validate Total Deposits**
   - [ ] All DEPOSIT transactions summed
   - [ ] Initial BUY transactions on liveStartDate counted as implicit deposits
   - [ ] WITHDRAWAL transactions subtracted

3. **Validate Current Stock Value**
   - [ ] Current prices fetched correctly
   - [ ] FX rates applied correctly
   - [ ] Holdings multiplied by current price
   - [ ] Summed to CHF

4. **Validate Cash Position**
   ```
   Cash = Deposits - Withdrawals - Total Buys + Total Sells + Dividends
   ```

5. **Validate Performance**
   - [ ] Formula applied correctly
   - [ ] Matches manual calculation

---

## Phase 5: Transaction Testing

### 5.1 Test Scenarios

**Scenario 1: Add new position**
1. Buy 10 shares of AAPL at $150
2. Expected:
   - Holdings: +10 AAPL
   - Cost basis: +$1500 (converted to CHF)
   - Cash: -CHF equivalent

**Scenario 2: Sell partial position**
1. Sell 5 shares of existing position
2. Expected:
   - Holdings: -5 shares
   - Cost basis: reduced by avg cost * 5
   - Realized gain: (sell price - avg cost) * 5
   - Cash: +CHF proceeds

**Scenario 3: Dividend received**
1. Receive $50 dividend
2. Expected:
   - Cash: +CHF equivalent
   - Holdings: unchanged
   - Performance: increased

### 5.2 Validation After Each Transaction

**Immediate checks:**
- [ ] Transaction appears in history
- [ ] Holdings updated correctly
- [ ] Cash position updated
- [ ] Performance recalculated
- [ ] Charts updated

**Database checks:**
```sql
-- Check transaction recorded
SELECT * FROM portfolioTransactions 
WHERE portfolioId = ? 
ORDER BY transactionDate DESC LIMIT 5;

-- Check realized gains (for sells)
SELECT * FROM realizedGains 
WHERE portfolioId = ? 
ORDER BY saleDate DESC LIMIT 5;

-- Verify cost basis
SELECT ticker, 
       SUM(CASE WHEN transactionType = 'buy' THEN totalAmountCHF ELSE 0 END) as total_cost,
       SUM(CASE WHEN transactionType = 'buy' THEN shares 
                WHEN transactionType = 'sell' THEN -shares 
                ELSE 0 END) as total_shares
FROM portfolioTransactions
WHERE portfolioId = ?
GROUP BY ticker;
```

---

## Phase 6: Common Issues & Solutions

### Issue 1: "Invested in Stocks" doesn't match expected

**Debug steps:**
1. Export all BUY transactions to JSON
2. Sum `totalAmountCHF` manually
3. Check for:
   - Missing transactions
   - Incorrect FX rates
   - Wrong `totalAmountCHF` calculation
4. Verify formula: `shares * price * fxRate`

### Issue 2: Cash position incorrect

**Debug steps:**
1. Calculate expected cash:
   ```
   Cash = Σ Deposits 
        - Σ Withdrawals 
        - Σ (Buy totalAmountCHF)
        + Σ (Sell totalAmountCHF)
        + Σ Dividends
   ```
2. Compare with displayed value
3. Check transaction types are correct

### Issue 3: Performance % wrong

**Debug steps:**
1. Verify Total Deposits includes implicit deposits
2. Check current stock value calculation
3. Verify FX rates for current prices
4. Recalculate manually

### Issue 4: Realized gains incorrect

**Debug steps:**
1. For each SELL transaction:
   ```
   Realized Gain = (Sell Price - Avg Cost) * Shares Sold
   ```
2. Check `realizedGains` table entries
3. Verify cost basis was reduced correctly

---

## Implementation Priority

### Sprint 1: Core Debugging Tools
1. ✅ Add debug logging to calculation procedures
2. ✅ Create SQL reference queries
3. ✅ Add transaction validation checks

### Sprint 2: Frontend Visibility
1. ⬜ Debug panel component
2. ⬜ JSON export functionality
3. ⬜ Correlation ID display

### Sprint 3: Automated Testing
1. ⬜ Golden portfolio test data
2. ⬜ Automated reconciliation
3. ⬜ CI/CD integration

---

## Test Execution Checklist

### Before Testing
- [ ] All portfolios deleted
- [ ] Test data prepared
- [ ] Expected results calculated manually
- [ ] Debug logging enabled

### During Testing
- [ ] Document each step
- [ ] Screenshot key results
- [ ] Export JSON for each calculation
- [ ] Note any discrepancies immediately

### After Testing
- [ ] Compare actual vs. expected
- [ ] Document all issues found
- [ ] Create bug tickets
- [ ] Update test scenarios

---

## Next Steps

1. **User deletes all portfolios**
2. **Implement Phase 1 debugging tools**
3. **User creates test portfolio**
4. **Execute Phase 2-5 validation**
5. **Fix issues found**
6. **Repeat until all tests pass**
7. **Save checkpoint**
