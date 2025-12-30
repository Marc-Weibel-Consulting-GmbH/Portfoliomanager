# Portfolio Performance API Documentation

This document describes the new performance calculation APIs that provide accurate Time-Weighted Return (TWR), Money-Weighted Return (IRR/MWR), and comprehensive portfolio metrics.

## Overview

The performance calculation system has been completely redesigned to provide accurate, industry-standard metrics:

- **Time-Weighted Return (TWR)**: Eliminates the effect of cash flows, measuring pure investment performance
- **Money-Weighted Return (MWR/IRR)**: Accounts for the timing and size of cash flows, reflecting the actual investor experience
- **Comprehensive Metrics**: Total return, unrealized/realized gains, dividends, fees, and more

## API Endpoints

All endpoints are available under `trpc.portfolioMetrics.*`

### 1. Get Performance Metrics

Get comprehensive performance metrics for a portfolio.

```typescript
const metrics = trpc.portfolioMetrics.getMetrics.useQuery(portfolioId);
```

**Input**: `portfolioId: number`

**Output**:
```typescript
{
  totalReturn: number;              // Absolute return in CHF
  totalReturnPercent: number;       // Total return as percentage
  timeWeightedReturn: number;       // TWR as percentage (annualized if > 1 year)
  moneyWeightedReturn: number;      // IRR/MWR as percentage (annualized)
  unrealizedGains: number;          // Current unrealized gains in CHF
  unrealizedGainsPercent: number;   // Unrealized gains as percentage
  realizedGains: number;            // Total realized gains in CHF
  totalInvested: number;            // Total amount invested (deposits - withdrawals)
  currentValue: number;             // Current portfolio value in CHF
  dividendsReceived: number;        // Total dividends received
  feesPaid: number;                 // Total fees paid
}
```

**Example**:
```typescript
const { data: metrics } = trpc.portfolioMetrics.getMetrics.useQuery(1);

if (metrics) {
  console.log(`Total Return: CHF ${metrics.totalReturn.toFixed(2)}`);
  console.log(`TWR: ${metrics.timeWeightedReturn.toFixed(2)}%`);
  console.log(`MWR/IRR: ${metrics.moneyWeightedReturn.toFixed(2)}%`);
}
```

### 2. Get Holdings with Performance

Get all current holdings with detailed performance data.

```typescript
const holdings = trpc.portfolioMetrics.getHoldings.useQuery(portfolioId);
```

**Input**: `portfolioId: number`

**Output**:
```typescript
Array<{
  ticker: string;
  shares: number;
  avgCostBasis: number;           // Average purchase price per share in CHF
  currentPrice: number;           // Current price per share in CHF
  currentValue: number;           // Current value in CHF
  unrealizedGain: number;         // Unrealized gain/loss in CHF
  unrealizedGainPercent: number;  // Unrealized gain/loss as percentage
  totalInvested: number;          // Total amount invested in this position
  companyName: string;
  currency: string;
  sector: string;
  logoUrl: string | null;
  dividendYield: string;
}>
```

**Example**:
```typescript
const { data: holdings } = trpc.portfolioMetrics.getHoldings.useQuery(1);

holdings?.forEach(holding => {
  console.log(`${holding.ticker}: ${holding.unrealizedGainPercent.toFixed(2)}%`);
});
```

### 3. Get Portfolio Value History

Get portfolio value over time for charting.

```typescript
const history = trpc.portfolioMetrics.getValueHistory.useQuery({
  portfolioId: 1,
  startDate: "2024-01-01",  // Optional
  endDate: "2024-12-31",    // Optional
});
```

**Input**:
```typescript
{
  portfolioId: number;
  startDate?: string;  // YYYY-MM-DD format
  endDate?: string;    // YYYY-MM-DD format
}
```

**Output**:
```typescript
Array<{
  date: string;        // YYYY-MM-DD
  value: number;       // Portfolio value in CHF
  cashFlows: number;   // Net cash flows on this date
}>
```

**Example**:
```typescript
const { data: history } = trpc.portfolioMetrics.getValueHistory.useQuery({
  portfolioId: 1,
  startDate: "2024-01-01",
});

// Use for charting
const chartData = {
  labels: history?.map(p => p.date) || [],
  datasets: [{
    label: 'Portfolio Value',
    data: history?.map(p => p.value) || [],
  }],
};
```

### 4. Compare Portfolios

Compare performance metrics across multiple portfolios.

```typescript
const comparison = trpc.portfolioMetrics.comparePortfolios.useQuery([1, 2, 3]);
```

**Input**: `Array<number>` (2-5 portfolio IDs)

**Output**:
```typescript
Array<{
  portfolioId: number;
  portfolioName: string;
  totalReturn: number;
  totalReturnPercent: number;
  timeWeightedReturn: number;
  moneyWeightedReturn: number;
  unrealizedGains: number;
  unrealizedGainsPercent: number;
  realizedGains: number;
  totalInvested: number;
  currentValue: number;
  dividendsReceived: number;
  feesPaid: number;
}>
```

**Example**:
```typescript
const { data: comparison } = trpc.portfolioMetrics.comparePortfolios.useQuery([1, 2]);

comparison?.forEach(p => {
  console.log(`${p.portfolioName}: TWR ${p.timeWeightedReturn.toFixed(2)}%`);
});
```

### 5. Get Return Breakdown

Get detailed breakdown of returns by component.

```typescript
const breakdown = trpc.portfolioMetrics.getReturnBreakdown.useQuery(portfolioId);
```

**Input**: `portfolioId: number`

**Output**:
```typescript
{
  currentValue: number;
  totalInvested: number;
  unrealizedGains: number;
  realizedGains: number;
  dividends: number;
  fees: number;
  netReturn: number;  // unrealizedGains + realizedGains + dividends - fees
}
```

**Example**:
```typescript
const { data: breakdown } = trpc.portfolioMetrics.getReturnBreakdown.useQuery(1);

if (breakdown) {
  console.log(`Unrealized Gains: CHF ${breakdown.unrealizedGains.toFixed(2)}`);
  console.log(`Realized Gains: CHF ${breakdown.realizedGains.toFixed(2)}`);
  console.log(`Dividends: CHF ${breakdown.dividends.toFixed(2)}`);
  console.log(`Fees: CHF ${breakdown.fees.toFixed(2)}`);
  console.log(`Net Return: CHF ${breakdown.netReturn.toFixed(2)}`);
}
```

## Key Concepts

### Time-Weighted Return (TWR)

TWR measures the compound rate of growth in a portfolio, **eliminating the effect of cash flows**. This is the standard metric for comparing investment performance.

**Formula**: `TWR = [(1 + R1) × (1 + R2) × ... × (1 + Rn)] - 1`

Where Ri is the return for each sub-period between cash flows.

**Use Cases**:
- Comparing portfolio performance to benchmarks
- Evaluating investment manager skill
- Comparing different investment strategies

### Money-Weighted Return (MWR/IRR)

MWR (also called Internal Rate of Return) accounts for the **timing and size of cash flows**. It reflects the actual return experienced by the investor.

**Formula**: IRR is the rate r that satisfies: `NPV = Σ(CFt / (1 + r)^t) = 0`

**Use Cases**:
- Measuring actual investor returns
- Evaluating the impact of investment timing decisions
- Personal portfolio performance tracking

### When to Use Which Metric

- **TWR**: Use when comparing to benchmarks or other portfolios
- **MWR**: Use when evaluating personal investment decisions and timing

Both metrics are provided so you can show users the complete picture of their portfolio performance.

## Frontend Integration Examples

### Portfolio Detail Page

```typescript
export function PortfolioDetail({ portfolioId }: { portfolioId: number }) {
  const { data: metrics } = trpc.portfolioMetrics.getMetrics.useQuery(portfolioId);
  const { data: holdings } = trpc.portfolioMetrics.getHoldings.useQuery(portfolioId);
  const { data: history } = trpc.portfolioMetrics.getValueHistory.useQuery({
    portfolioId,
    startDate: "2024-01-01",
  });

  if (!metrics) return <div>Loading...</div>;

  return (
    <div>
      <h1>Portfolio Performance</h1>
      
      <div className="metrics-grid">
        <MetricCard
          title="Current Value"
          value={`CHF ${metrics.currentValue.toFixed(2)}`}
        />
        <MetricCard
          title="Total Return"
          value={`${metrics.totalReturnPercent.toFixed(2)}%`}
          subtitle={`CHF ${metrics.totalReturn.toFixed(2)}`}
        />
        <MetricCard
          title="Time-Weighted Return"
          value={`${metrics.timeWeightedReturn.toFixed(2)}%`}
          tooltip="Eliminates effect of cash flows"
        />
        <MetricCard
          title="Money-Weighted Return"
          value={`${metrics.moneyWeightedReturn.toFixed(2)}%`}
          tooltip="Accounts for timing of cash flows"
        />
      </div>

      <PerformanceChart data={history} />
      
      <HoldingsTable holdings={holdings} />
    </div>
  );
}
```

### Performance Comparison Dashboard

```typescript
export function PortfolioComparison() {
  const { data: portfolios } = trpc.portfolios.list.useQuery();
  const portfolioIds = portfolios?.map(p => p.id) || [];
  
  const { data: comparison } = trpc.portfolioMetrics.comparePortfolios.useQuery(
    portfolioIds.slice(0, 5)  // Compare up to 5 portfolios
  );

  return (
    <div>
      <h1>Portfolio Comparison</h1>
      <table>
        <thead>
          <tr>
            <th>Portfolio</th>
            <th>Current Value</th>
            <th>TWR</th>
            <th>MWR</th>
            <th>Total Return</th>
          </tr>
        </thead>
        <tbody>
          {comparison?.map(p => (
            <tr key={p.portfolioId}>
              <td>{p.portfolioName}</td>
              <td>CHF {p.currentValue.toFixed(2)}</td>
              <td>{p.timeWeightedReturn.toFixed(2)}%</td>
              <td>{p.moneyWeightedReturn.toFixed(2)}%</td>
              <td>{p.totalReturnPercent.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Return Breakdown Visualization

```typescript
export function ReturnBreakdown({ portfolioId }: { portfolioId: number }) {
  const { data: breakdown } = trpc.portfolioMetrics.getReturnBreakdown.useQuery(portfolioId);

  if (!breakdown) return <div>Loading...</div>;

  const chartData = {
    labels: ['Unrealized Gains', 'Realized Gains', 'Dividends', 'Fees'],
    datasets: [{
      data: [
        breakdown.unrealizedGains,
        breakdown.realizedGains,
        breakdown.dividends,
        -breakdown.fees,  // Negative for fees
      ],
      backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#ef4444'],
    }],
  };

  return (
    <div>
      <h2>Return Breakdown</h2>
      <PieChart data={chartData} />
      <div className="breakdown-details">
        <div>Unrealized Gains: CHF {breakdown.unrealizedGains.toFixed(2)}</div>
        <div>Realized Gains: CHF {breakdown.realizedGains.toFixed(2)}</div>
        <div>Dividends: CHF {breakdown.dividends.toFixed(2)}</div>
        <div>Fees: CHF {breakdown.fees.toFixed(2)}</div>
        <div className="total">Net Return: CHF {breakdown.netReturn.toFixed(2)}</div>
      </div>
    </div>
  );
}
```

## Testing

All performance calculations have been thoroughly tested with 18 unit tests covering:

- ✅ TWR calculation with and without cash flows
- ✅ MWR/IRR calculation with multiple cash flows
- ✅ Holdings performance with buy/sell transactions
- ✅ Comprehensive metrics calculation
- ✅ Value points building from transactions
- ✅ Edge cases (zero prices, missing data, small values)

Run tests with:
```bash
pnpm test performanceCalculations.test.ts
```

## Notes

- All monetary values are in CHF (Swiss Francs)
- Returns are annualized when the time period exceeds 1 year
- Fees are always subtracted from returns
- Dividends are included in total return calculations
- Historical data is cached for performance optimization
