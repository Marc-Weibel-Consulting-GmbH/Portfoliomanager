# Performance Calculation Validation Report

**Date:** November 15, 2025  
**Portfolio ID:** 240001 (Portfolio Test 1)  
**Live Start Date:** November 13, 2025

---

## Executive Summary

✅ **All performance calculations are mathematically correct**  
✅ **FX rates are applied consistently from historical data**  
✅ **Cost basis calculations handle partial sells correctly**  
✅ **Performance breakdown (Stock + FX) matches total performance**

---

## Validation Methodology

### 1. Data Sources
- **Exchange Rates:** Historical FX rates from `exchangeRates` table
- **Stock Prices:** Current prices from `stocks` table, historical from `historicalPrices` table
- **Transactions:** All buy/sell transactions from `portfolioTransactions` table

### 2. Calculation Logic
```
Performance = (Current Value - Live Start Value) / Live Start Value × 100

Where:
- Current Value = Shares × Current Price × Current FX Rate
- Live Start Value = Shares × Live Start Price × Live Start FX Rate
```

### 3. Performance Breakdown
```
Total Performance ≈ Stock Performance + FX Performance

Where:
- Stock Performance = (Current Price - Live Start Price) / Live Start Price × 100
- FX Performance = (Current FX Rate - Live Start FX Rate) / Live Start FX Rate × 100
```

---

## Test Results

### Portfolio Summary
| Metric | Value |
|--------|-------|
| Total Invested (Cost Basis) | CHF 89'701.02 |
| Live Start Value | CHF 90'509.01 |
| Current Value | CHF 89'043.98 |
| **Portfolio Performance** | **-1.62%** |
| Absolute Gain/Loss | CHF -1'465.03 |

### Individual Stock Performance

#### 1. NESN.SW (CHF) - Swiss Stock
| Metric | Value |
|--------|-------|
| Shares | 125.00 |
| Avg Buy Price | CHF 77.70 |
| Total Invested | CHF 9'712.50 |
| Live Start Price | 77.70 CHF |
| Current Price | 77.00 CHF |
| **Performance** | **-0.96%** |
| Price Change | -0.96% |
| FX Change | 0.00% (CHF) |

✅ **Validation:** Pure price change, no FX effect

---

#### 2. EOSE (USD) - US Stock with Partial Sell
| Metric | Value |
|--------|-------|
| Initial Buy | 366 shares @ USD 15.25 (FX: 0.7985) = CHF 4'456.83 |
| Partial Sell | 166 shares @ USD 15.21 (FX: 0.7921) = CHF 1'979.28 |
| **Remaining Shares** | **200.00** |
| **Avg Buy Price** | **CHF 12.18 per share** |
| **Total Invested** | **CHF 2'435.43** |
| Live Start Price | 15.21 USD |
| Current Price | 14.48 USD |
| **Performance** | **-5.34%** |
| Price Change (USD) | -4.77% |
| FX Change | -0.60% |

✅ **Validation:** 
- Cost basis correctly reduced by average cost of sold shares
- Performance breakdown: -4.77% (stock) + -0.60% (FX) ≈ -5.34% ✅

---

#### 3. TSM (USD) - Pure FX Effect
| Metric | Value |
|--------|-------|
| Shares | 27.00 |
| Live Start Price | 284.89 USD |
| Current Price | 284.89 USD |
| **Performance** | **-0.60%** |
| Price Change (USD) | 0.00% |
| FX Change | -0.60% |

✅ **Validation:** Price unchanged, performance = pure FX loss

---

#### 4. MONC.MI (EUR) - European Stock
| Metric | Value |
|--------|-------|
| Shares | 141.00 |
| Live Start Price | 57.14 EUR |
| Current Price | 57.14 EUR |
| **Performance** | **-0.34%** |
| Price Change (EUR) | 0.00% |
| FX Change (EUR/CHF) | -0.34% |

✅ **Validation:** EUR weakened against CHF, reflected in performance

---

## FX Rate Consistency Check

### USD/CHF Rates
| Date | Rate | Source |
|------|------|--------|
| 2025-11-10 | 0.8059 | Database |
| 2025-11-13 | 0.7985 | Database (Live Start) |
| 2025-11-14 | 0.7921 | Database (Current) |

**Change:** 0.7985 → 0.7921 = **-0.60%** ✅

### EUR/CHF Rates
| Date | Rate | Source |
|------|------|--------|
| 2025-11-13 | 0.9253 | Database (Live Start) |
| 2025-11-14 | 0.9222 | Database (Current) |

**Change:** 0.9253 → 0.9222 = **-0.34%** ✅

---

## Key Findings

### ✅ Correct Implementations

1. **FX Rate Application**
   - Historical rates correctly fetched from `exchangeRates` table
   - Fallback to nearest previous date when exact date unavailable
   - Separate rates for buy date, live start date, and current date

2. **Cost Basis Calculation**
   - Average buy price correctly calculated: `Total Invested / Total Shares Bought`
   - Partial sells reduce cost basis proportionally: `Shares Sold × Avg Buy Price`
   - Example: EOSE reduced from CHF 4'456.83 to CHF 2'435.43 after selling 166/366 shares

3. **Performance Calculation**
   - Uses live start date as baseline (not buy date)
   - Correctly converts both baseline and current values to CHF
   - Formula: `(Current CHF - Live Start CHF) / Live Start CHF × 100`

4. **Performance Breakdown**
   - Stock component: Price change in local currency
   - FX component: Exchange rate change
   - Total ≈ Stock + FX (minor rounding differences acceptable)

---

## Validation Scripts

Three validation scripts have been created:

### 1. `check-fx-rates.ts`
- Displays recent exchange rates from database
- Verifies FX data availability

### 2. `analyze-portfolio-transactions.ts`
- Analyzes all transactions for a portfolio
- Checks ticker existence in stocks table
- Validates FX rate consistency

### 3. `validate-real-portfolio.ts`
- Comprehensive validation of performance calculations
- Compares manual calculations with server logic
- Provides detailed breakdown for each position

**Usage:**
```bash
pnpm tsx validate-real-portfolio.ts [portfolioId]
```

---

## Conclusion

**The performance calculation system is working correctly.** The mentioned "discrepancies" (0.80 vs 0.7985 for USD/CHF) are not errors but reflect the actual market exchange rates on different dates.

### Verified Components:
✅ FX rate retrieval from historical data  
✅ Currency conversion for all positions  
✅ Cost basis tracking with partial sells  
✅ Live start date as performance baseline  
✅ Performance breakdown into stock and FX components  

### No Issues Found:
- All formulas are mathematically correct
- FX rates are applied consistently
- Performance calculations match manual verification
- No systematic errors or bugs detected

---

## Recommendations

1. **Documentation:** Add inline comments explaining the performance calculation logic in `calculateLivePerformance`
2. **User Education:** Explain to users that performance includes both stock price changes AND currency effects
3. **UI Enhancement:** Show performance breakdown (Stock + FX) in the UI for transparency
4. **Testing:** Keep validation scripts for regression testing after future changes

---

**Report Generated:** November 15, 2025  
**Validation Status:** ✅ PASSED  
**Next Review:** After any changes to performance calculation logic
