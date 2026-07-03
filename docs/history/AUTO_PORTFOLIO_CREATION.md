# Automatic Portfolio Creation Feature

## Overview
System automatically generates a diversified portfolio based on user's investment profile (Anlageprofil).

## User Profile Fields (Already in Database)
```typescript
// In users table
{
  investmentGoal: 'dividends' | 'growth' | 'balanced',
  riskTolerance: 'low' | 'medium' | 'high',
  investmentHorizon: 'short' | 'medium' | 'long',
}
```

## Feature Flow

### 1. Entry Point
**Location**: Portfolio Builder Step 2 (Stock Selection)

**UI Addition**:
```
┌────────────────────────────────────────────────────────┐
│ 🤖 Automatisches Portfolio erstellen                  │
│                                                        │
│ Lass unser System ein diversifiziertes Portfolio      │
│ basierend auf deinem Anlageprofil erstellen.          │
│                                                        │
│ Dein Profil:                                           │
│ • Anlageziel: Wachstum                                 │
│ • Risikotoleranz: Mittel                               │
│ • Anlagehorizont: Langfristig                          │
│                                                        │
│ [Automatisch erstellen]  [Manuell auswählen]          │
└────────────────────────────────────────────────────────┘
```

### 2. Generation Process
When user clicks "Automatisch erstellen":

1. **Fetch user profile**
2. **Generate portfolio using LLM**
3. **Query stock database for matching stocks**
4. **Calculate optimal weights**
5. **Present to user for review**

### 3. Portfolio Generation Logic

#### Investment Goal Mapping
**Dividends**:
- Filter: `dividendYield > 3%`
- Prefer: Stable companies, blue chips
- Sectors: Utilities, Consumer Staples, Real Estate
- Examples: Nestlé, Novartis, Swiss Re

**Growth**:
- Filter: `ytdPerformance > 15%`
- Prefer: Tech, Innovation, High P/E
- Sectors: Technology, Healthcare, Consumer Discretionary
- Examples: Apple, Microsoft, Tesla

**Balanced**:
- Mix of dividends (40%) and growth (60%)
- Diversified across sectors
- Examples: Mix of above

#### Risk Tolerance Mapping
**Low**:
- Large-cap only (market cap > $50B)
- Beta < 1.0
- Established companies (> 10 years)
- Max 5% per position

**Medium**:
- Mix of large-cap (70%) and mid-cap (30%)
- Beta 0.8 - 1.2
- Max 8% per position

**High**:
- Include small-cap and growth stocks
- Beta > 1.0
- Higher concentration allowed
- Max 12% per position

#### Investment Horizon Mapping
**Short** (< 3 years):
- Prefer stable, dividend-paying stocks
- Lower volatility
- More defensive sectors

**Medium** (3-7 years):
- Balanced approach
- Mix of growth and value

**Long** (> 7 years):
- Can include high-growth stocks
- Higher volatility acceptable
- Focus on long-term potential

### 4. Stock Selection Algorithm

```typescript
async function generateAutoPortfolio(userProfile: UserProfile) {
  // 1. Define criteria based on profile
  const criteria = mapProfileToCriteria(userProfile);
  
  // 2. Query stocks from database
  const candidateStocks = await db
    .select()
    .from(stocks)
    .where(
      and(
        criteria.minMarketCap ? gte(stocks.marketCap, criteria.minMarketCap) : undefined,
        criteria.minDividendYield ? gte(stocks.dividendYield, criteria.minDividendYield) : undefined,
        criteria.minYtdPerformance ? gte(stocks.ytdPerformance, criteria.minYtdPerformance) : undefined,
        criteria.maxBeta ? lte(stocks.beta, criteria.maxBeta) : undefined,
        criteria.sectors ? inArray(stocks.sector, criteria.sectors) : undefined,
      )
    )
    .limit(50);
  
  // 3. Score each stock
  const scoredStocks = candidateStocks.map(stock => ({
    ...stock,
    score: calculateStockScore(stock, userProfile),
  }));
  
  // 4. Sort by score and select top 10-15
  const selectedStocks = scoredStocks
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  
  // 5. Calculate optimal weights
  const weights = calculateOptimalWeights(selectedStocks, criteria);
  
  // 6. Return portfolio
  return selectedStocks.map((stock, i) => ({
    ticker: stock.ticker,
    companyName: stock.companyName,
    weight: weights[i],
    currentPrice: stock.currentPrice,
    ytdPerformance: stock.ytdPerformance,
    dividendYield: stock.dividendYield,
    sector: stock.sector,
  }));
}
```

### 5. Stock Scoring System

```typescript
function calculateStockScore(stock: Stock, profile: UserProfile): number {
  let score = 0;
  
  // Base score from fundamentals
  score += stock.peRatio > 0 && stock.peRatio < 30 ? 10 : 0;
  score += stock.debtToEquity < 1.0 ? 10 : 0;
  score += stock.currentRatio > 1.5 ? 10 : 0;
  
  // Investment goal alignment
  if (profile.investmentGoal === 'dividends') {
    score += stock.dividendYield * 10; // 3% yield = 30 points
    score += stock.payoutRatio > 0 && stock.payoutRatio < 0.7 ? 15 : 0;
  } else if (profile.investmentGoal === 'growth') {
    score += stock.ytdPerformance / 2; // 20% YTD = 10 points
    score += stock.revenueGrowth > 10 ? 20 : 0;
  } else { // balanced
    score += stock.dividendYield * 5;
    score += stock.ytdPerformance / 4;
  }
  
  // Risk tolerance alignment
  if (profile.riskTolerance === 'low') {
    score += stock.beta < 0.8 ? 20 : 0;
    score += stock.marketCap > 100_000_000_000 ? 15 : 0; // > $100B
  } else if (profile.riskTolerance === 'high') {
    score += stock.beta > 1.2 ? 15 : 0;
    score += stock.ytdPerformance > 20 ? 20 : 0;
  }
  
  // Sector diversification bonus (calculated separately)
  
  return score;
}
```

### 6. Weight Calculation

```typescript
function calculateOptimalWeights(stocks: Stock[], criteria: Criteria): number[] {
  const n = stocks.length;
  
  // Simple approach: Equal weight with adjustments
  let weights = new Array(n).fill(100 / n);
  
  // Adjust based on score
  const totalScore = stocks.reduce((sum, s) => sum + s.score, 0);
  weights = stocks.map(s => (s.score / totalScore) * 100);
  
  // Apply constraints
  weights = weights.map(w => {
    if (w < criteria.minWeight) return criteria.minWeight;
    if (w > criteria.maxWeight) return criteria.maxWeight;
    return w;
  });
  
  // Normalize to 100%
  const sum = weights.reduce((a, b) => a + b, 0);
  weights = weights.map(w => (w / sum) * 100);
  
  return weights;
}
```

## UI Flow

### Step 1: Trigger Auto-Generation
User clicks "Automatisch erstellen" button

### Step 2: Loading State
```
┌────────────────────────────────────────┐
│  🤖 Portfolio wird erstellt...         │
│                                        │
│  [████████████░░░░░░░░░░] 60%         │
│                                        │
│  ✓ Anlageprofil analysiert             │
│  ✓ Aktien gefiltert                    │
│  → Optimale Gewichtung berechnet...    │
│                                        │
└────────────────────────────────────────┘
```

### Step 3: Present Generated Portfolio
```
┌──────────────────────────────────────────────────────────┐
│ ✨ Dein automatisch erstelltes Portfolio                 │
│                                                          │
│ Basierend auf deinem Profil haben wir ein diversi-      │
│ fiziertes Portfolio mit 12 Aktien erstellt:              │
│                                                          │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐│
│ │[Logo] AAPL     │ │[Logo] MSFT     │ │[Logo] GOOGL    ││
│ │Apple Inc.      │ │Microsoft       │ │Alphabet        ││
│ │8.5%            │ │9.2%            │ │7.8%            ││
│ │CHF 150.00      │ │CHF 320.00      │ │CHF 140.00      ││
│ │+12.5% YTD      │ │+8.3% YTD       │ │+15.2% YTD      ││
│ │[Entfernen]     │ │[Entfernen]     │ │[Entfernen]     ││
│ └────────────────┘ └────────────────┘ └────────────────┘│
│                                                          │
│ ... (9 more stocks) ...                                  │
│                                                          │
│ Portfolio-Metriken:                                      │
│ • Erwartete Rendite: 8.5%                                │
│ • Volatilität: 15.2%                                     │
│ • Sharpe Ratio: 0.56                                     │
│ • Diversifikation: Sehr gut (12 Aktien, 8 Sektoren)     │
│                                                          │
│ [Neu generieren] [Anpassen] [Portfolio übernehmen]      │
└──────────────────────────────────────────────────────────┘
```

### Step 4: User Actions
- **Portfolio übernehmen**: Accept as-is and proceed to next step
- **Anpassen**: Keep generated portfolio but allow manual edits
- **Neu generieren**: Generate a different portfolio (with randomization)
- **Entfernen**: Remove individual stocks

## API Implementation

### Backend Procedure
```typescript
// server/routers/portfoliosRouter.ts

generateAutoPortfolio: protectedProcedure
  .input(z.object({
    investmentAmount: z.number().optional(),
    forceRegenerate: z.boolean().default(false),
  }))
  .mutation(async ({ ctx, input }) => {
    // Get user profile
    const user = await getUser(ctx.user.openId);
    
    if (!user.investmentGoal || !user.riskTolerance || !user.investmentHorizon) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Please complete your investment profile first',
      });
    }
    
    // Generate portfolio
    const portfolio = await generateAutoPortfolio({
      investmentGoal: user.investmentGoal,
      riskTolerance: user.riskTolerance,
      investmentHorizon: user.investmentHorizon,
      investmentAmount: input.investmentAmount,
      randomSeed: input.forceRegenerate ? Date.now() : undefined,
    });
    
    return {
      positions: portfolio,
      metrics: {
        expectedReturn: calculateExpectedReturn(portfolio),
        volatility: calculateVolatility(portfolio),
        sharpeRatio: calculateSharpeRatio(portfolio),
        diversificationScore: calculateDiversification(portfolio),
      },
    };
  });
```

### Frontend Hook
```typescript
// client/src/hooks/useAutoPortfolio.ts

export function useAutoPortfolio() {
  const generateMutation = trpc.portfolios.generateAutoPortfolio.useMutation();
  
  const generate = async (investmentAmount?: number) => {
    const result = await generateMutation.mutateAsync({
      investmentAmount,
      forceRegenerate: false,
    });
    return result;
  };
  
  const regenerate = async (investmentAmount?: number) => {
    const result = await generateMutation.mutateAsync({
      investmentAmount,
      forceRegenerate: true,
    });
    return result;
  };
  
  return {
    generate,
    regenerate,
    isLoading: generateMutation.isLoading,
    error: generateMutation.error,
  };
}
```

## Integration with Portfolio Builder

### Modified Step 2 Component
```typescript
// client/src/pages/PortfolioBuilder/Step2StockSelection.tsx

export function Step2StockSelection() {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [autoPortfolio, setAutoPortfolio] = useState<AutoPortfolio | null>(null);
  const { generate, isLoading } = useAutoPortfolio();
  
  const handleAutoGenerate = async () => {
    setMode('auto');
    const result = await generate();
    setAutoPortfolio(result);
  };
  
  const handleAcceptAuto = () => {
    // Copy auto portfolio to builder state
    autoPortfolio.positions.forEach(pos => {
      addPosition(pos);
    });
    setMode('manual');
  };
  
  return (
    <div>
      {mode === 'manual' ? (
        <>
          <AutoGeneratePrompt onGenerate={handleAutoGenerate} />
          <ManualStockSelection />
        </>
      ) : (
        <AutoPortfolioReview
          portfolio={autoPortfolio}
          onAccept={handleAcceptAuto}
          onRegenerate={handleAutoGenerate}
          onCancel={() => setMode('manual')}
        />
      )}
    </div>
  );
}
```

## Testing Strategy

### Test Cases
1. **Profile Variations**:
   - Test all 27 combinations (3 goals × 3 risks × 3 horizons)
   - Verify appropriate stocks are selected

2. **Edge Cases**:
   - User with incomplete profile
   - No stocks match criteria
   - Database connection failure

3. **Regeneration**:
   - Verify different results on regenerate
   - Ensure randomization works

4. **Weight Validation**:
   - Total weights = 100%
   - Individual weights within constraints
   - No negative weights

5. **Performance**:
   - Generation completes in < 3 seconds
   - No database timeouts

## Future Enhancements
1. **Machine Learning**: Train model on successful portfolios
2. **Backtesting**: Show historical performance of generated portfolio
3. **Customization**: Allow user to adjust criteria before generation
4. **Comparison**: Generate multiple portfolios and let user choose
5. **Rebalancing**: Suggest rebalancing for existing portfolios
