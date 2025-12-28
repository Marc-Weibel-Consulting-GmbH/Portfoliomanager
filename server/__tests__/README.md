# Testing Documentation

## Overview

This directory contains unit tests for critical portfolio calculations and business logic. The tests are written using **Vitest** and focus on preventing regressions in core financial calculations.

## Test Structure

```
server/__tests__/
├── README.md                        # This file
├── utils/
│   └── testHelpers.ts              # Mock data generators and test utilities
├── portfolioPerformance.test.ts    # Portfolio performance calculations
└── currencyConversion.test.ts      # Currency conversion and realized gains
```

## Running Tests

```bash
# Run all tests
pnpm vitest run

# Run specific test file
pnpm vitest run server/__tests__/portfolioPerformance.test.ts

# Run tests in watch mode
pnpm vitest

# Run tests with coverage
pnpm vitest run --coverage
```

## Test Coverage

### Portfolio Performance Tests (15 tests)
- **Holdings Calculation** (4 tests)
  - Buy transactions
  - Partial sells
  - Complete sells
  - Multiple buys and sells

- **Cash Position Calculation** (5 tests)
  - Initial buy (implicit deposit)
  - Deposit and buy
  - Sell transactions
  - Dividends
  - Complex scenarios with multiple transaction types

- **Total Invested Calculation** (3 tests)
  - Initial transactions
  - Additional deposits
  - Non-initial buys

- **Regression Tests** (3 tests)
  - Negative cash position bug (Nov 10, 2025)
  - Partial sell performance bug (Nov 10, 2025)
  - Initial buys as implicit deposits

### Currency Conversion Tests (9 tests)
- **FX Rate Calculations** (3 tests)
  - USD to CHF conversion
  - EUR to CHF conversion
  - CHF to CHF identity

- **Realized Gains with Currency Split** (4 tests)
  - Stock gain in local currency
  - FX gain calculation
  - Currency strengthening scenarios
  - Average cost basis for partial sells

- **Tax Reporting** (2 tests)
  - Separate stock gains and FX gains
  - Multiple sells with different FX rates

## Test Utilities

### Mock Data Generators

The `testHelpers.ts` file provides functions to create mock data for testing:

```typescript
// Create mock transactions
createMockBuyTransaction(ticker, shares, pricePerShare, date, isInitial)
createMockSellTransaction(ticker, shares, pricePerShare, date)
createMockDepositTransaction(amount, date)
createMockWithdrawalTransaction(amount, date)
createMockDividendTransaction(ticker, amount, date)

// Create mock stock data
createMockStock(ticker, companyName, currentPrice, currency)
createMockHistoricalPrice(ticker, date, closePrice)
createMockRealizedGain(ticker, realizedGain, stockGainLocal, fxGain)

// Test implementations of calculations
calculateHoldingsFromTransactions(transactions)
calculateCashPosition(transactions)
calculateTotalInvested(transactions)
```

## Key Formulas Tested

### Holdings Calculation
```
holdings[ticker] = sum(buy_shares) - sum(sell_shares)
```

### Cash Position Calculation
```
cash = totalDeposits - totalBuyAmounts + totalSellProceeds + totalDividends

where:
- totalDeposits includes initial buy amounts (implicit deposits)
- totalBuyAmounts includes all buy transactions
- totalSellProceeds includes all sell proceeds
- totalDividends includes all dividend payments
```

### Total Invested Calculation
```
totalInvested = sum(initial_buy_amounts) + sum(deposits) - sum(withdrawals)
```

### Realized Gains with Currency Split
```
stockGainLocal = (sellPrice - buyPrice) * shares  // In original currency
buyCostCHF = shares * buyPrice * buyFxRate
sellProceedsCHF = shares * sellPrice * sellFxRate
totalRealizedGainCHF = sellProceedsCHF - buyCostCHF
stockGainCHF = stockGainLocal * sellFxRate
fxGain = totalRealizedGainCHF - stockGainCHF
```

## Critical Bugs Tested

### 1. Negative Cash Position (Nov 10, 2025)
**Problem:** Cash position showed negative values when initial buys were not counted as implicit deposits.

**Fix:** Treat initial buy transactions (marked with "Initial position" in notes) as implicit deposits.

**Test:** `should not show negative cash position`

### 2. Incorrect Performance on Partial Sells (Nov 10, 2025)
**Problem:** Live performance showed negative values after partial sells at break-even prices.

**Fix:** Use current holdings (not original holdings) for performance calculation.

**Test:** `should handle partial sell without negative performance`

### 3. Currency Gain/Loss Not Separated (Nov 10, 2025)
**Problem:** Realized gains did not separate stock gains from FX gains for tax reporting.

**Fix:** Calculate stock gain in local currency, then calculate FX gain as the difference between total gain and stock gain.

**Test:** `should separate stock gains and FX gains for tax purposes`

## Best Practices

1. **Use Mock Data Generators:** Always use the provided mock data generators instead of creating raw objects.

2. **Test Edge Cases:** Include tests for edge cases like zero holdings, negative amounts, and floating-point precision.

3. **Use `toBeCloseTo` for Floating-Point:** Use `expect(value).toBeCloseTo(expected, precision)` instead of `toBe()` for floating-point comparisons.

4. **Document Regression Tests:** When adding a regression test, include the date and a brief description of the bug in the test name.

5. **Keep Tests Fast:** Avoid database calls and external API calls in unit tests. Use mocks instead.

## Future Enhancements

- [ ] Add integration tests with real database
- [ ] Add tests for API endpoints (tRPC procedures)
- [ ] Add tests for alert system
- [ ] Add tests for dividend tracking
- [ ] Set up CI/CD pipeline for automated testing
- [ ] Add test coverage reporting
- [ ] Add performance benchmarks for critical calculations

## Troubleshooting

### Tests Fail with Floating-Point Precision Errors
Use `toBeCloseTo(expected, precision)` instead of `toBe(expected)`.

```typescript
// ❌ Bad
expect(cash).toBe(1990.34);

// ✅ Good
expect(cash).toBeCloseTo(1990.34, 2);
```

### Tests Fail with "Database not available"
Unit tests should not require database access. Use mock data instead.

### Tests Run Slowly
Check for:
- Unnecessary database calls
- External API calls
- Large loops or complex calculations

## Contact

For questions or issues with tests, please contact the development team or create an issue in the project repository.
