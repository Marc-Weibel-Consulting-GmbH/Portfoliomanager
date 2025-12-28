# Portfolio Builder Redesign Plan

## Current vs. Expected

### Current Implementation
- Simple list view showing saved portfolios
- Located at `/portfolios` route
- Just displays existing portfolios with delete buttons
- No wizard, no step-by-step creation

### Expected Implementation (from Mockup)
- Multi-step wizard for portfolio creation
- Dark theme with teal/cyan accents (#00CFC1)
- Interactive stock selection with search and filters
- Real-time portfolio preview
- Weight allocation visualization

## Design Specifications

### Color Palette
- Background: `#0a0f1a` (very dark blue-black)
- Card background: `#0f1420` (dark blue)
- Border: `rgba(255, 255, 255, 0.1)` (subtle white)
- Accent: `#00CFC1` (teal/cyan)
- Text primary: `#ffffff`
- Text secondary: `#94a3b8` (slate-400)
- Success: `#10b981` (green)
- Warning: `#f59e0b` (amber)
- Error: `#ef4444` (red)

### Typography
- Headings: Bold, white
- Body: Regular, slate-400
- Numbers/metrics: Bold, white or accent color

## Step-by-Step Wizard Structure

### Step 1: Grundlagen (Basics)
**Purpose**: Set up portfolio name and strategy

**UI Elements**:
- Progress indicator at top (Step 1/5)
- Large heading: "Neues Portfolio erstellen"
- Form fields:
  - Portfolio Name (text input)
  - Beschreibung (textarea, optional)
  - Strategie (radio buttons):
    - 📈 Wachstum (Growth)
    - 💰 Dividenden (Dividends)
    - ⚖️ Ausgewogen (Balanced)
  - Anlagehorizont (select):
    - Kurzfristig (< 3 Jahre)
    - Mittelfristig (3-7 Jahre)
    - Langfristig (> 7 Jahre)
- Buttons:
  - "Abbrechen" (outline, left)
  - "Weiter" (primary, right)

### Step 2: Aktien auswählen (Stock Selection)
**Purpose**: Select stocks for the portfolio

**Layout**: Two-panel design
- **Left Panel** (30% width): Selected positions
- **Right Panel** (70% width): Stock search and selection

**Left Panel - Selected Positions**:
```
┌─────────────────────────────────┐
│ Ausgewählte Positionen (3)      │
├─────────────────────────────────┤
│ [Logo] AAPL                     │
│ Apple Inc.                      │
│ 25% ━━━━━━━━━━░░░░░░░░░░        │
│ CHF 150.00  +12.5%         [X]  │
├─────────────────────────────────┤
│ [Logo] MSFT                     │
│ Microsoft                       │
│ 30% ━━━━━━━━━━━━░░░░░░░░        │
│ CHF 320.00  +8.3%          [X]  │
├─────────────────────────────────┤
│ [Logo] GOOGL                    │
│ Alphabet Inc.                   │
│ 20% ━━━━━━━━░░░░░░░░░░░░        │
│ CHF 140.00  +15.2%         [X]  │
├─────────────────────────────────┤
│ Gesamt: 75%                     │
│ ━━━━━━━━━━━━━━━░░░░░            │
│ ⚠️ Noch 25% zu verteilen        │
└─────────────────────────────────┘
```

**Right Panel - Stock Search**:
```
┌──────────────────────────────────────────────────────────┐
│ 🔍 Aktien suchen...                                      │
├──────────────────────────────────────────────────────────┤
│ [Alle] [Dividenden] [Wachstum] [ETF] [Sektoren ▼]       │
├──────────────────────────────────────────────────────────┤
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐│
│ │[Logo] AAPL     │ │[Logo] MSFT     │ │[Logo] GOOGL    ││
│ │Apple Inc.      │ │Microsoft Corp. │ │Alphabet Inc.   ││
│ │                │ │                │ │                ││
│ │CHF 150.00      │ │CHF 320.00      │ │CHF 140.00      ││
│ │+12.5% YTD      │ │+8.3% YTD       │ │+15.2% YTD      ││
│ │Div: 0.5%       │ │Div: 0.8%       │ │Div: --         ││
│ │                │ │                │ │                ││
│ │Score: ●●●●○    │ │Score: ●●●●●    │ │Score: ●●●○○    ││
│ │[+ Hinzufügen]  │ │[+ Hinzufügen]  │ │[+ Hinzufügen]  ││
│ └────────────────┘ └────────────────┘ └────────────────┘│
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐│
│ │[Logo] NVDA     │ │[Logo] TSLA     │ │[Logo] AMZN     ││
│ │...             │ │...             │ │...             ││
│ └────────────────┘ └────────────────┘ └────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Features**:
- Real-time search filtering
- Filter buttons for quick access
- Stock cards with key metrics
- Drag-and-drop weight adjustment (optional)
- Weight slider when adding stock
- Validation: Total weight must equal 100%

### Step 3: Anleihen & ETFs (Optional)
**Purpose**: Add bonds and ETFs to portfolio

**Similar layout to Step 2** but with:
- Bond-specific filters (Government, Corporate, Duration)
- ETF-specific filters (Index, Sector, Region)
- Different metrics displayed

**Can be skipped** if user only wants stocks

### Step 4: Verteilung & Risiko (Allocation & Risk)
**Purpose**: Review and optimize portfolio allocation

**UI Elements**:
- Portfolio composition pie chart
- Asset allocation breakdown:
  - Aktien: 75%
  - Anleihen: 15%
  - Cash: 10%
- Risk metrics:
  - Erwartete Rendite: 8.5%
  - Volatilität: 15.2%
  - Sharpe Ratio: 0.56
  - Max Drawdown: -12.3%
- Sector allocation chart
- Geographic allocation chart
- Rebalancing suggestions (if needed)

**Buttons**:
- "Zurück" (go back to edit)
- "Optimieren" (run efficient frontier optimization)
- "Weiter" (proceed to final step)

### Step 5: Abschluss (Completion)
**Purpose**: Save portfolio and set options

**UI Elements**:
- Portfolio summary card
- Options:
  - ☐ Als Live-Portfolio aktivieren
  - ☐ Automatische Rebalancing-Alerts
  - ☐ Dividenden-Tracking aktivieren
- Success message
- Buttons:
  - "Portfolio speichern"
  - "Speichern und bearbeiten"

## Technical Implementation

### Component Structure
```
PortfolioBuilder/
├── index.tsx                 # Main wizard container
├── components/
│   ├── StepIndicator.tsx     # Progress bar at top
│   ├── Step1Basics.tsx       # Portfolio name & strategy
│   ├── Step2StockSelection.tsx
│   │   ├── SelectedPositions.tsx
│   │   ├── StockSearch.tsx
│   │   ├── StockCard.tsx
│   │   └── WeightSlider.tsx
│   ├── Step3BondsETFs.tsx
│   ├── Step4Allocation.tsx
│   │   ├── PieChart.tsx
│   │   ├── RiskMetrics.tsx
│   │   └── AllocationTable.tsx
│   └── Step5Completion.tsx
└── hooks/
    ├── usePortfolioBuilder.ts  # State management
    └── useStockSearch.ts       # Search & filtering
```

### State Management
```typescript
interface PortfolioBuilderState {
  currentStep: 1 | 2 | 3 | 4 | 5;
  portfolioName: string;
  description: string;
  strategy: 'growth' | 'dividends' | 'balanced';
  investmentHorizon: 'short' | 'medium' | 'long';
  positions: Array<{
    ticker: string;
    companyName: string;
    weight: number;
    type: 'stock' | 'bond' | 'etf';
  }>;
  totalWeight: number;
  isValid: boolean;
}
```

### API Endpoints Needed
```typescript
// Search stocks with filters
searchStocks: publicProcedure
  .input(z.object({
    query: z.string(),
    filters: z.object({
      type: z.enum(['all', 'dividends', 'growth', 'etf']),
      sector: z.string().optional(),
      minDividendYield: z.number().optional(),
      minYtdPerformance: z.number().optional(),
    }),
    limit: z.number().default(20),
  }))
  .query(async ({ input }) => {
    // Query stocks table with filters
    // Return stock cards with all needed data
  });

// Calculate portfolio metrics
calculatePortfolioMetrics: publicProcedure
  .input(z.object({
    positions: z.array(z.object({
      ticker: z.string(),
      weight: z.number(),
    })),
  }))
  .query(async ({ input }) => {
    // Calculate expected return, volatility, sharpe ratio
    // Return risk metrics
  });
```

### Validation Rules
1. Portfolio name: Required, 3-50 characters
2. Strategy: Required
3. Positions: At least 3 stocks
4. Total weight: Must equal 100%
5. Individual weight: 1% - 50% per position

## Mobile Responsiveness
- Stack left/right panels vertically on mobile
- Collapse filters into dropdown menu
- Reduce stock card size
- Make charts scrollable

## Animation & Transitions
- Smooth step transitions (fade + slide)
- Progress bar fills as user completes steps
- Stock cards hover effect (scale + glow)
- Weight slider real-time update
- Success confetti on completion

## Accessibility
- Keyboard navigation between steps
- Focus management
- ARIA labels for all interactive elements
- Screen reader announcements for step changes
- High contrast mode support

## Error Handling
- Validate each step before allowing "Weiter"
- Show inline error messages
- Prevent navigation if validation fails
- Auto-save draft portfolio every 30 seconds
- Restore draft on page reload

## Integration with Existing Features
- Use existing `StockLogo` component
- Integrate with `trpc.portfolios.create` mutation
- Link to Portfolio Detail page after creation
- Option to run Efficient Frontier optimization
- Option to activate as Live portfolio immediately
