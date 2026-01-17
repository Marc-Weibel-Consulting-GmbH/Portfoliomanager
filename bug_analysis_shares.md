# Bug Analysis: Shares Rounding Issue

## Problem
Portfolio shows incorrect share counts for USD stocks, resulting in total value being ~CHF 77,227 instead of expected CHF 80,000.

## Transaction Data (Correct)
| Ticker | Anzahl | Preis/Aktie | Währung | Gesamt (CHF) |
|--------|--------|-------------|---------|--------------|
| NEE | 125.593208 | USD 83.63 | USD | CHF 8336.00 |
| CMBN.SW | 66.111111 | CHF 100.80 | CHF | CHF 6664.00 |

## Portfolio Display (Incorrect)
| Ticker | Anzahl | Wert (CHF) |
|--------|--------|------------|
| NEE | 100.00 | CHF 6,703.78 |
| JNJ | 23.00 | CHF 4,031.39 |

## Root Cause Location
File: `server/routers/portfoliosRouter.ts`
Line 234:
```typescript
shares = currentPrice > 0 ? Math.round((allocationAmount / currentPrice)) : 0;
```

This code runs when `shares === 0` in the portfolio data. The problem is:
1. It calculates shares from allocationAmount (in CHF) divided by currentPrice (in local currency)
2. For USD stocks, this gives wrong result because currencies don't match
3. Then it rounds to whole numbers

## Why This Happens
The `getWithCurrency` procedure checks:
```typescript
let shares = parseFloat(stock.shares) || 0;
if (shares === 0 && portfolio.investmentAmount) {
  // Fallback calculation with bug
}
```

The shares ARE stored in portfolioData during creation (line 564):
```typescript
updatedHoldings.push({
  ...holding,
  shares: shares,  // Correct decimal value
  avgCost: holding.currentPrice,
});
```

But when reading, `parseFloat(stock.shares)` returns 0 if shares is stored as a string like "125.593208" but the property name doesn't match.

## Fix Required
1. Check if shares are being stored correctly in portfolioData
2. Fix the fallback calculation to handle FX conversion
3. Remove Math.round() to preserve decimal precision
