# Portfolio System Bug Analysis

## Issues Found (Dec 28, 2025)

### 1. Portfolio Loading Inconsistency ✅ FOUND ROOT CAUSE
**Status**: Portfolios ARE being loaded on Dashboard but show "0" in count and "Portfolios werden geladen..." message
**Evidence**: 
- Dashboard shows 4 portfolios in the cards section:
  - "Marc Weibel" (Test portfolio)
  - "Regula" (Live portfolio)
  - "Demo Portfolio - Schweizer Blue Chips"
  - "Portfolio Test 1" (Live portfolio)
- But summary card shows "Portfolios: 0"
- Portfolio page shows "0 Active Portfolios"

**Root Cause**: 
1. Dashboard is loading portfolios correctly via `trpc.portfolios.list.useQuery()`
2. Summary card shows hardcoded "0" instead of actual count
3. Portfolio Builder page (`/portfolios`) shows empty state but portfolios exist

**Fix Required**:
- Update summary card to use actual portfolio count
- Fix Portfolio Builder page to show actual portfolios

### 2. Portfolio Detail Navigation Issue
**Status**: When clicking on portfolio from dashboard, it navigates to `/portfolios/{id}` but may not load data
**Location**: `PortfolioDetail.tsx` uses route `/portfolio/:id` (singular) but Dashboard links to `/portfolios/${portfolio.id}` (plural)
**Fix Required**: Standardize route - either `/portfolio/:id` or `/portfolios/:id`

### 3. Portfolio Builder Design Mismatch
**Status**: Current design does not match mockup at all
**Current**: Simple card-based list view showing saved portfolios
**Expected (from mockup)**: 
- Multi-step wizard interface for CREATING portfolios
- Steps: Grundlagen, Aktien auswählen, Anleihen & ETFs, Verteilung & Risiko, Abschluss
- Stock selection with search and filters (Dividenden, Wachstum, ETF, Sektoren)
- Selected positions panel on left side
- Weight progress bar showing allocation
- Stock cards with logos, prices, YTD performance, dividend yield, score
- Real-time portfolio composition preview

**Current Flow**: 
- `/portfolios` = List of saved portfolios
- `/home` = Portfolio Optimizer (creates new portfolio)

**Expected Flow**:
- `/portfolios` = Portfolio Builder wizard (create new portfolio step-by-step)
- Separate page for listing saved portfolios

### 4. Missing Automatic Portfolio Creation
**Status**: Feature completely missing
**Expected**: System should automatically create portfolio based on user's investment profile (Anlageprofil)
- Investment goal (dividends/growth/balanced)
- Risk tolerance (low/medium/high)  
- Investment horizon (short/medium/long)
- Should suggest stocks based on profile
- User can accept, modify, or reject suggestions

**Implementation Plan**:
- Add "Automatisches Portfolio erstellen" button
- Use LLM to generate portfolio based on user profile
- Query stock database for suitable stocks
- Apply scoring/filtering based on investment goals
- Present suggested portfolio to user for approval

### 5. TypeScript Errors
- LiveTracking.tsx: Property 'mwr' does not exist
- OptimizerResults.tsx: Property 'isAutoSave' does not exist

## Priority Order
1. **HIGH**: Fix route mismatch (portfolio vs portfolios)
2. **HIGH**: Fix portfolio count display on dashboard
3. **HIGH**: Fix Portfolio Builder page to show actual portfolios
4. **CRITICAL**: Redesign Portfolio Builder to match mockup (multi-step wizard)
5. **CRITICAL**: Implement automatic portfolio creation feature
6. **MEDIUM**: Fix TypeScript errors
