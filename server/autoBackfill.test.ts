import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ count: 0, minDate: null, maxDate: null }]),
  }),
}));

// Mock the backfillHistoricalPrices module
vi.mock('./backfillHistoricalPrices', () => ({
  backfillHistoricalPrices: vi.fn().mockResolvedValue({
    success: true,
    tickersProcessed: 1,
    pricesInserted: 1250,
    pricesUpdated: 0,
    missingTickers: [],
    errors: [],
  }),
}));

// Mock the tickerNormalization module
vi.mock('./tickerNormalization', () => ({
  normalizeTickerForDb: vi.fn((ticker: string) => ticker.toUpperCase()),
  getTickerVariants: vi.fn((ticker: string) => [ticker, ticker.replace('.SW', '.SWX')]),
}));

import {
  checkSymbolDataStatus,
  triggerMaxBackfillForSymbol,
  ensureMaxBackfillForSymbols,
  autoBackfillNewSymbols,
  getBackfillQueueStatus,
  clearBackfillCache,
  BackfillStatus,
  AutoBackfillResult,
} from './autoBackfill';
import { backfillHistoricalPrices } from './backfillHistoricalPrices';

describe('Auto-Backfill Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearBackfillCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkSymbolDataStatus', () => {
    it('should return correct status for a symbol without data', async () => {
      const status = await checkSymbolDataStatus('AAPL.US');
      
      expect(status).toBeDefined();
      expect(status.ticker).toBe('AAPL.US');
      expect(status.needsBackfill).toBe(true);
      expect(status.isBackfilling).toBe(false);
    });

    it('should normalize ticker symbols', async () => {
      const status = await checkSymbolDataStatus('aapl.us');
      
      expect(status.ticker).toBe('AAPL.US');
    });
  });

  describe('triggerMaxBackfillForSymbol', () => {
    it('should trigger backfill for a new symbol', async () => {
      const result = await triggerMaxBackfillForSymbol('NESN.SW');
      
      expect(result).toBeDefined();
      expect(result.ticker).toBe('NESN.SW');
      expect(result.success).toBe(true);
      expect(result.pricesInserted).toBe(1250);
      expect(result.duration).toBeGreaterThan(0);
      expect(backfillHistoricalPrices).toHaveBeenCalled();
    });

    it('should not trigger duplicate backfill for same symbol', async () => {
      // First call
      await triggerMaxBackfillForSymbol('NOVN.SW');
      
      // Second call should skip (recently completed)
      const result = await triggerMaxBackfillForSymbol('NOVN.SW');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('recently completed');
      expect(result.pricesInserted).toBe(0);
    });

    it('should force backfill when force=true', async () => {
      // First call
      await triggerMaxBackfillForSymbol('ROG.SW');
      
      // Force second call
      const result = await triggerMaxBackfillForSymbol('ROG.SW', true);
      
      expect(result.success).toBe(true);
      expect(backfillHistoricalPrices).toHaveBeenCalledTimes(2);
    });
  });

  describe('ensureMaxBackfillForSymbols', () => {
    it('should process multiple symbols', async () => {
      const tickers = ['AAPL.US', 'MSFT.US', 'GOOGL.US'];
      const results = await ensureMaxBackfillForSymbols(tickers);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should deduplicate tickers', async () => {
      const tickers = ['AAPL.US', 'aapl.us', 'AAPL.US'];
      const results = await ensureMaxBackfillForSymbols(tickers);
      
      // Should only process once due to deduplication
      expect(results).toHaveLength(1);
    });
  });

  describe('autoBackfillNewSymbols', () => {
    it('should detect and backfill new symbols', async () => {
      const tickers = ['NEW.SW', 'ANOTHER.SW'];
      const result = await autoBackfillNewSymbols(tickers);
      
      expect(result).toBeDefined();
      expect(result.statuses).toHaveLength(2);
      expect(result.newSymbolsDetected).toBeGreaterThanOrEqual(0);
    });

    it('should return empty results for empty input', async () => {
      const result = await autoBackfillNewSymbols([]);
      
      expect(result.statuses).toHaveLength(0);
      expect(result.backfillResults).toHaveLength(0);
      expect(result.newSymbolsDetected).toBe(0);
    });
  });

  describe('getBackfillQueueStatus', () => {
    it('should return queue status', () => {
      const status = getBackfillQueueStatus();
      
      expect(status).toBeDefined();
      expect(typeof status.pendingCount).toBe('number');
      expect(Array.isArray(status.pendingTickers)).toBe(true);
      expect(typeof status.recentlyCompletedCount).toBe('number');
    });
  });

  describe('clearBackfillCache', () => {
    it('should clear the cache without errors', () => {
      expect(() => clearBackfillCache()).not.toThrow();
    });
  });

  describe('BackfillStatus interface', () => {
    it('should have correct structure', () => {
      const mockStatus: BackfillStatus = {
        ticker: 'TEST.SW',
        hasData: false,
        dataPoints: 0,
        minDate: null,
        maxDate: null,
        needsBackfill: true,
        isBackfilling: false,
      };

      expect(mockStatus.ticker).toBe('TEST.SW');
      expect(mockStatus.hasData).toBe(false);
      expect(mockStatus.needsBackfill).toBe(true);
    });
  });

  describe('AutoBackfillResult interface', () => {
    it('should have correct structure', () => {
      const mockResult: AutoBackfillResult = {
        ticker: 'TEST.SW',
        success: true,
        pricesInserted: 1000,
        message: 'Success',
        duration: 5000,
      };

      expect(mockResult.ticker).toBe('TEST.SW');
      expect(mockResult.success).toBe(true);
      expect(mockResult.pricesInserted).toBe(1000);
      expect(mockResult.duration).toBe(5000);
    });
  });
});

describe('Integration with Portfolio Creation', () => {
  it('should have correct exports for portfolio integration', async () => {
    // Verify all required exports are available
    expect(typeof checkSymbolDataStatus).toBe('function');
    expect(typeof triggerMaxBackfillForSymbol).toBe('function');
    expect(typeof ensureMaxBackfillForSymbols).toBe('function');
    expect(typeof autoBackfillNewSymbols).toBe('function');
    expect(typeof getBackfillQueueStatus).toBe('function');
    expect(typeof clearBackfillCache).toBe('function');
  });
});
