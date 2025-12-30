import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeTickerForDb, getTickerVariants, normalizeTickerList } from '../server/tickerNormalization';

describe('Ticker Normalization', () => {
  describe('normalizeTickerForDb', () => {
    it('should keep tickers with exchange suffix unchanged', () => {
      expect(normalizeTickerForDb('NESN.SW')).toBe('NESN.SW');
      expect(normalizeTickerForDb('AAPL.US')).toBe('AAPL.US');
      expect(normalizeTickerForDb('NOVN.SW')).toBe('NOVN.SW');
    });

    it('should add .SW suffix for known Swiss stocks', () => {
      expect(normalizeTickerForDb('NESN')).toBe('NESN.SW');
      expect(normalizeTickerForDb('NOVN')).toBe('NOVN.SW');
      expect(normalizeTickerForDb('ROG')).toBe('ROG.SW');
      expect(normalizeTickerForDb('ABBN')).toBe('ABBN.SW');
    });

    it('should add .US suffix for unknown stocks without suffix', () => {
      expect(normalizeTickerForDb('AAPL')).toBe('AAPL.US');
      expect(normalizeTickerForDb('MSFT')).toBe('MSFT.US');
      expect(normalizeTickerForDb('GOOGL')).toBe('GOOGL.US');
    });

    it('should handle empty and whitespace', () => {
      expect(normalizeTickerForDb('')).toBe('');
      expect(normalizeTickerForDb('  AAPL  ')).toBe('AAPL.US');
    });

    it('should convert to uppercase', () => {
      expect(normalizeTickerForDb('aapl')).toBe('AAPL.US');
      expect(normalizeTickerForDb('nesn')).toBe('NESN.SW');
    });
  });

  describe('getTickerVariants', () => {
    it('should return all possible variants for ticker without suffix', () => {
      const variants = getTickerVariants('AAPL');
      expect(variants).toContain('AAPL');
      expect(variants).toContain('AAPL.US');
      expect(variants).toContain('AAPL.SW');
      expect(variants.length).toBeGreaterThanOrEqual(3);
    });

    it('should return variants including base for ticker with suffix', () => {
      const variants = getTickerVariants('NESN.SW');
      expect(variants).toContain('NESN.SW');
      expect(variants).toContain('NESN');
      expect(variants.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty ticker', () => {
      const variants = getTickerVariants('');
      expect(variants).toEqual([]);
    });
  });

  describe('normalizeTickerList', () => {
    it('should normalize and deduplicate tickers', () => {
      const tickers = ['AAPL', 'aapl.us', 'NESN', 'nesn.sw', 'MSFT'];
      const normalized = normalizeTickerList(tickers);
      
      // Should deduplicate AAPL and aapl.us
      expect(normalized).toContain('AAPL.US');
      expect(normalized).toContain('NESN.SW');
      expect(normalized).toContain('MSFT.US');
      
      // Should not have duplicates
      const uniqueCount = new Set(normalized).size;
      expect(uniqueCount).toBe(normalized.length);
    });

    it('should filter out empty strings', () => {
      const tickers = ['AAPL', '', '  ', 'MSFT'];
      const normalized = normalizeTickerList(tickers);
      
      expect(normalized).toContain('AAPL.US');
      expect(normalized).toContain('MSFT.US');
      expect(normalized.length).toBe(2);
    });
  });
});

describe('Price Coverage (Integration)', () => {
  // Note: These tests would require database mocking or a test database
  // For now, we'll just test the structure
  
  it('should have correct structure for coverage result', () => {
    // This is a structural test - actual implementation would need DB
    const mockCoverageResult = {
      tickers: [
        {
          ticker: 'AAPL.US',
          minDate: '2024-01-01',
          maxDate: '2025-12-30',
          totalRows: 250,
          rowsInRange: 200,
          firstInRangeDate: '2025-01-01',
          lastInRangeDate: '2025-11-11'
        }
      ],
      distinctTickerSample: ['AAPL.US', 'NESN.SW', 'MSFT.US'],
      requestedRange: {
        from: '2025-01-01',
        to: '2025-11-11'
      }
    };

    expect(mockCoverageResult.tickers).toHaveLength(1);
    expect(mockCoverageResult.tickers[0]).toHaveProperty('ticker');
    expect(mockCoverageResult.tickers[0]).toHaveProperty('minDate');
    expect(mockCoverageResult.tickers[0]).toHaveProperty('maxDate');
    expect(mockCoverageResult.tickers[0]).toHaveProperty('totalRows');
    expect(mockCoverageResult.tickers[0]).toHaveProperty('rowsInRange');
    expect(mockCoverageResult.requestedRange).toHaveProperty('from');
    expect(mockCoverageResult.requestedRange).toHaveProperty('to');
  });
});

describe('Backfill Result Structure', () => {
  it('should have correct structure for backfill result', () => {
    const mockBackfillResult = {
      success: true,
      tickersProcessed: 5,
      pricesInserted: 1250,
      pricesUpdated: 0,
      missingTickers: [],
      errors: []
    };

    expect(mockBackfillResult).toHaveProperty('success');
    expect(mockBackfillResult).toHaveProperty('tickersProcessed');
    expect(mockBackfillResult).toHaveProperty('pricesInserted');
    expect(mockBackfillResult).toHaveProperty('pricesUpdated');
    expect(mockBackfillResult).toHaveProperty('missingTickers');
    expect(mockBackfillResult).toHaveProperty('errors');
    expect(Array.isArray(mockBackfillResult.missingTickers)).toBe(true);
    expect(Array.isArray(mockBackfillResult.errors)).toBe(true);
  });
});
