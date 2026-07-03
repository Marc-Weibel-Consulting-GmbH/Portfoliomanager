# Portfolio Detail Page Redesign Specification

Based on mockup analysis (Dec 28, 2025)

## Layout Structure

### Header Section
- **Portfolio Name**: "Tech Growth Portfolio" (large, white)
- **Badges**: 
  - "Wachstum" (cyan/teal badge)
  - "Live" (green badge with dot)
- **Action Buttons** (top right):
  - Bearbeiten (Edit) - cyan border
  - Löschen (Delete) - gray
  - Teilen (Share) - gray

### Performance Section (Top)
**Left Side - Large Value Display:**
- Portfolio Value: "CHF 45,230" (huge cyan text)
- Performance: "+18.5% (+CHF 7,230)" with green up arrow
- Dark card background

**Right Side - Performance Chart:**
- Title: "Portfolio Value Over Time (6 Months)"
- Y-axis: CHF values (38,000 - 46,000)
- X-axis: Months (Jan - Jun)
- Two lines:
  - Portfolio (solid cyan line with gradient fill)
  - SMI (dotted gray line) - Benchmark
- Legend top right: "Portfolio" and "SMI"
- Dark background with grid

### Key Metrics Cards (Below Chart)
5 cards in a row, each with:
- Label (top, gray text)
- Value (large white text)
- Dark background with cyan border

Cards:
1. **IRR**: 16.2%
2. **Dividendenrendite**: 2.1%
3. **Beta**: 1.15
4. **Volatilität**: 18.3%
5. **Sharpe Ratio**: 1.42

### Holdings Section
**Left Side - Holdings Table:**
- Title: "Holdings"
- Columns:
  - Logo (stock logo icon)
  - Ticker (e.g., GOOGL)
  - Name (e.g., Alphabet Inc.)
  - Shares (e.g., 50)
  - Weight % (e.g., 25%)
  - Current Price (e.g., CHF 2,510.45)
  - Value (e.g., CHF 12,552.25)
  - Performance % (e.g., +12.3% with green arrow)
  - Dividend Yield (e.g., 0.0%)

Rows shown:
1. GOOGL - Alphabet Inc. - 50 shares - 25% - CHF 2,510.45 - CHF 12,552.25 - +12.3% - 0.0%
2. MSFT - Microsoft Corp. - 100 shares - 22% - CHF 289.60 - CHF 28,960.00 - +15.7% - 0.9%
3. AAPL - Apple Inc. - 150 shares - 20% - CHF 160.20 - CHF 24,030.00 - +21.1% - 0.5%
4. AMZN - Amazon.com Inc. - 60 shares - 18% - CHF 3,240.10 - CHF 19,440.60 - +9.8% - 0.0%
5. TSLA - Tesla Inc. - 40 shares - 15% - CHF 1,015.55 - CHF 4,062.20 - +8.5% - 0.0%

**Right Side - Allocation Donut Chart:**
- Title: "TSLA" (top left with percentage)
- Donut chart showing allocation by stock:
  - GOOGL: 25% (cyan)
  - MSFT: 22% (blue)
  - AAPL: 20% (dark gray center)
  - AMZN: 18% (light blue)
  - IEX: 15% (orange)
- Tabs below chart:
  - "Nach Aktie" (active)
  - "Nach Sektor"
  - "Nach Kategorie"

### Transactions Section (Bottom Right)
- Title: "Letzte Transaktionen"
- 3 recent transactions shown:
  1. 15. Jun 2024 - Kauf - MSFT - +10 Shares
  2. 10. Jun 2024 - Dividende - AAPL - CHF 125.40
  3. 01. Jun 2024 - Kauf - GOOGL - +5 Shares
- Link: "Alle Transaktionen"
- Button: "Neue Transaktion" (cyan)

## Color Scheme
- **Primary Cyan**: #00CFC1 (used for portfolio line, badges, buttons)
- **Background Dark**: #0a0f1a (main background)
- **Card Background**: #0f1420 (slightly lighter)
- **Text White**: #ffffff
- **Text Gray**: #9ca3af
- **Success Green**: For positive performance
- **Border**: rgba(255, 255, 255, 0.1)

## Typography
- **Portfolio Value**: Very large (72px+), cyan
- **Performance**: Medium (24px), white with green
- **Card Labels**: Small (12px), gray
- **Card Values**: Large (24px), white
- **Table Headers**: Small (12px), gray
- **Table Values**: Medium (14px), white

## Responsive Behavior
- Desktop: 2-column layout (table left, chart right)
- Tablet: Stack sections vertically
- Mobile: Single column, simplified table

## Interactive Elements
- Hoverable rows in holdings table
- Clickable tabs for allocation view switching
- Benchmark selector dropdown (not visible in mockup but mentioned)
- Action buttons with hover states

## Data Requirements
- Portfolio value history (6 months, daily)
- Benchmark data (SMI) for comparison
- Current holdings with all metrics
- Recent transactions (last 3-5)
- Calculated metrics: IRR, Beta, Volatility, Sharpe Ratio
