import { describe, it, expect, vi } from 'vitest';

// Test the TradingView widget configurations
describe('TradingView Widget Configurations', () => {
  it('should have valid HEATMAP_CONFIG', async () => {
    const { HEATMAP_CONFIG } = await import('../../client/src/components/TradingViewWidget');
    expect(HEATMAP_CONFIG).toBeDefined();
    expect(HEATMAP_CONFIG.colorTheme).toBe('dark');
    expect(HEATMAP_CONFIG.dataSource).toBe('SPX500');
    expect(HEATMAP_CONFIG.grouping).toBe('sector');
    expect(HEATMAP_CONFIG.blockSize).toBe('market_cap_basic');
    expect(HEATMAP_CONFIG.blockColor).toBe('change');
  });

  it('should have valid MARKET_OVERVIEW_CONFIG with Swiss stocks', async () => {
    const { MARKET_OVERVIEW_CONFIG } = await import('../../client/src/components/TradingViewWidget');
    expect(MARKET_OVERVIEW_CONFIG).toBeDefined();
    expect(MARKET_OVERVIEW_CONFIG.tabs).toHaveLength(3);
    expect(MARKET_OVERVIEW_CONFIG.tabs[0].title).toBe('Schweiz');
    expect(MARKET_OVERVIEW_CONFIG.tabs[0].symbols.length).toBeGreaterThan(0);
    expect(MARKET_OVERVIEW_CONFIG.tabs[0].symbols[0].s).toContain('SIX:');
  });

  it('should have valid ADVANCED_CHART_CONFIG', async () => {
    const { ADVANCED_CHART_CONFIG } = await import('../../client/src/components/TradingViewWidget');
    expect(ADVANCED_CHART_CONFIG).toBeDefined();
    expect(ADVANCED_CHART_CONFIG.timezone).toBe('Europe/Zurich');
    expect(ADVANCED_CHART_CONFIG.theme).toBe('dark');
    expect(ADVANCED_CHART_CONFIG.locale).toBe('de_DE');
    expect(ADVANCED_CHART_CONFIG.studies).toContain('RSI@tv-basicstudies');
  });

  it('should have valid TECHNICAL_ANALYSIS_CONFIG', async () => {
    const { TECHNICAL_ANALYSIS_CONFIG } = await import('../../client/src/components/TradingViewWidget');
    expect(TECHNICAL_ANALYSIS_CONFIG).toBeDefined();
    expect(TECHNICAL_ANALYSIS_CONFIG.showIntervalTabs).toBe(true);
    expect(TECHNICAL_ANALYSIS_CONFIG.interval).toBe('1D');
  });

  it('should have valid TICKER_TAPE_CONFIG with major indices', async () => {
    const { TICKER_TAPE_CONFIG } = await import('../../client/src/components/TradingViewWidget');
    expect(TICKER_TAPE_CONFIG).toBeDefined();
    expect(TICKER_TAPE_CONFIG.symbols.length).toBeGreaterThan(5);
    const titles = TICKER_TAPE_CONFIG.symbols.map((s: any) => s.title);
    expect(titles).toContain('SMI');
    expect(titles).toContain('S&P 500');
    expect(titles).toContain('DAX');
  });

  it('should have valid MARKET_QUOTES_CONFIG with SMI and DAX', async () => {
    const { MARKET_QUOTES_CONFIG } = await import('../../client/src/components/TradingViewWidget');
    expect(MARKET_QUOTES_CONFIG).toBeDefined();
    expect(MARKET_QUOTES_CONFIG.symbolsGroups).toHaveLength(2);
    expect(MARKET_QUOTES_CONFIG.symbolsGroups[0].name).toBe('SMI');
    expect(MARKET_QUOTES_CONFIG.symbolsGroups[1].name).toBe('DAX');
  });
});

// Test the price alerts scheduled handler
describe('Price Alerts Scheduled Handler', () => {
  it('should export handlePriceAlertsCheck function', async () => {
    const module = await import('../scheduled/priceAlertsScheduled');
    expect(module.handlePriceAlertsCheck).toBeDefined();
    expect(typeof module.handlePriceAlertsCheck).toBe('function');
  });
});

// Test the weekly review scheduled handler
describe('Weekly Review Scheduled Handler', () => {
  it('should export handleWeeklyReview function', async () => {
    const module = await import('../scheduled/weeklyReviewScheduled');
    expect(module.handleWeeklyReview).toBeDefined();
    expect(typeof module.handleWeeklyReview).toBe('function');
  });
});

// Test ticker symbol mapping for TradingView
describe('Ticker Symbol Mapping', () => {
  it('should correctly map Swiss tickers to TradingView format', () => {
    // The mapping logic used in StockDetail.tsx
    function mapToTradingView(ticker: string): string {
      if (ticker.endsWith('.SW')) {
        return `SIX:${ticker.replace('.SW', '')}`;
      } else if (ticker.endsWith('.DE')) {
        return `XETR:${ticker.replace('.DE', '')}`;
      } else if (ticker.endsWith('.PA')) {
        return `EURONEXT:${ticker.replace('.PA', '')}`;
      } else if (ticker.endsWith('.L')) {
        return `LSE:${ticker.replace('.L', '')}`;
      }
      return ticker; // US stocks don't need prefix
    }

    expect(mapToTradingView('SLHN.SW')).toBe('SIX:SLHN');
    expect(mapToTradingView('NESN.SW')).toBe('SIX:NESN');
    expect(mapToTradingView('SAP.DE')).toBe('XETR:SAP');
    expect(mapToTradingView('MC.PA')).toBe('EURONEXT:MC');
    expect(mapToTradingView('SHEL.L')).toBe('LSE:SHEL');
    expect(mapToTradingView('AAPL')).toBe('AAPL');
    expect(mapToTradingView('MSFT')).toBe('MSFT');
  });
});
