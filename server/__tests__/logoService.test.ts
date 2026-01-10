import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLogo, getSwissStockDomain, fetchLogoBatch } from '../logoService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock ENV
vi.mock('../_core/env', () => ({
  ENV: {
    eodhdApiKey: 'test-eodhd-key',
    finnhubApiKey: 'test-finnhub-key',
  },
}));

// Mock database functions
const mockGetCachedLogo = vi.fn();
const mockSaveCachedLogo = vi.fn();
const mockGetCachedLogos = vi.fn();

vi.mock('../db', () => ({
  getCachedLogo: () => mockGetCachedLogo(),
  saveCachedLogo: (...args: any[]) => mockSaveCachedLogo(...args),
  getCachedLogos: (...args: any[]) => mockGetCachedLogos(...args),
}));

describe('Logo Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedLogo.mockResolvedValue(null);
    mockSaveCachedLogo.mockResolvedValue(undefined);
    mockGetCachedLogos.mockResolvedValue(new Map());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getSwissStockDomain', () => {
    it('should return correct domain for SMI stocks', () => {
      expect(getSwissStockDomain('NESN.SW')).toBe('nestle.com');
      expect(getSwissStockDomain('NOVN.SW')).toBe('novartis.com');
      expect(getSwissStockDomain('ROG.SW')).toBe('roche.com');
      expect(getSwissStockDomain('UBSG.SW')).toBe('ubs.com');
    });

    it('should return correct domain for additional Swiss stocks', () => {
      expect(getSwissStockDomain('HOLN.SW')).toBe('holcim.com');
      expect(getSwissStockDomain('VPBN.SW')).toBe('vp-bank.com');
      expect(getSwissStockDomain('BALZ.SW')).toBe('baloise.com');
    });

    it('should return undefined for unknown tickers', () => {
      expect(getSwissStockDomain('UNKNOWN.SW')).toBeUndefined();
      expect(getSwissStockDomain('AAPL')).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      expect(getSwissStockDomain('nesn.sw')).toBe('nestle.com');
      expect(getSwissStockDomain('NESN.sw')).toBe('nestle.com');
    });
  });

  describe('fetchLogo - Cache functionality', () => {
    it('should return cached logo when available', async () => {
      mockGetCachedLogo.mockResolvedValueOnce({
        ticker: 'NESN.SW',
        logoUrl: 'https://cached-logo.com/nesn.png',
        source: 'eodhd',
        lastFetched: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // expires tomorrow
      });

      const result = await fetchLogo('NESN.SW');

      expect(result.source).toBe('eodhd');
      expect(result.url).toBe('https://cached-logo.com/nesn.png');
      expect(result.cached).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return generic logo when cache has null logoUrl', async () => {
      mockGetCachedLogo.mockResolvedValueOnce({
        ticker: 'UNKNOWN.SW',
        logoUrl: null,
        source: 'generic',
        lastFetched: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await fetchLogo('UNKNOWN.SW');

      expect(result.source).toBe('generic');
      expect(result.url).toContain('data:image/svg+xml;base64');
      expect(result.cached).toBe(true);
    });

    it('should fetch from API when cache is empty', async () => {
      mockGetCachedLogo.mockResolvedValueOnce(null);
      
      // Mock EODHD success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => '/img/logos/US/AAPL.png',
      });

      const result = await fetchLogo('AAPL');

      expect(result.source).toBe('eodhd');
      expect(result.url).toBe('https://eodhd.com/img/logos/US/AAPL.png');
      expect(mockSaveCachedLogo).toHaveBeenCalledWith('AAPL', 'https://eodhd.com/img/logos/US/AAPL.png', 'eodhd', 30);
    });

    it('should skip cache when skipCache is true', async () => {
      // Mock EODHD success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => '/img/logos/US/AAPL.png',
      });

      const result = await fetchLogo('AAPL', undefined, true);

      expect(result.source).toBe('eodhd');
      expect(result.url).toBe('https://eodhd.com/img/logos/US/AAPL.png');
      expect(mockGetCachedLogo).not.toHaveBeenCalled();
    });
  });

  describe('fetchLogo - EODHD primary', () => {
    it('should fetch logo from EODHD when available', async () => {
      mockGetCachedLogo.mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => '/img/logos/US/AAPL.png',
      });

      const result = await fetchLogo('AAPL');

      expect(result.source).toBe('eodhd');
      expect(result.url).toBe('https://eodhd.com/img/logos/US/AAPL.png');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('eodhd.com/api/fundamentals/AAPL'),
        expect.anything()
      );
    });

    it('should handle EODHD timeout gracefully', async () => {
      mockGetCachedLogo.mockResolvedValueOnce(null);
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));
      // Finnhub also fails
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const result = await fetchLogo('AAPL');

      expect(result.source).toBe('generic');
    });
  });

  describe('fetchLogo - Finnhub fallback', () => {
    it('should fallback to Finnhub when EODHD fails', async () => {
      mockGetCachedLogo.mockResolvedValueOnce(null);
      // Mock EODHD failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Mock successful Finnhub response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logo: 'https://finnhub.io/logo/AAPL.png' }),
      });

      const result = await fetchLogo('AAPL');

      expect(result.source).toBe('finnhub');
      expect(result.url).toBe('https://finnhub.io/logo/AAPL.png');
    });

    it('should clean ticker for Finnhub (remove .SW suffix)', async () => {
      mockGetCachedLogo.mockResolvedValueOnce(null);
      // Mock EODHD failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Mock Finnhub success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logo: 'https://finnhub.io/logo/NESN.png' }),
      });

      await fetchLogo('NESN.SW');

      // Check that Finnhub was called with clean ticker (without .SW)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('symbol=NESN&'),
        expect.anything()
      );
    });
  });

  describe('fetchLogo - Generic SVG fallback', () => {
    it('should generate generic SVG when all APIs fail', async () => {
      mockGetCachedLogo.mockResolvedValueOnce(null);
      // Mock EODHD failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Mock Finnhub failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchLogo('TEST.SW');

      expect(result.source).toBe('generic');
      expect(result.url).toContain('data:image/svg+xml;base64');
      
      // Decode base64 to check initials
      const base64 = result.url.split(',')[1];
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      expect(decoded).toContain('TE'); // "TE" are the initials from "TEST"
    });

    it('should save null to cache when no logo found', async () => {
      mockGetCachedLogo.mockResolvedValueOnce(null);
      // Mock all failures
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await fetchLogo('UNKNOWN');

      expect(mockSaveCachedLogo).toHaveBeenCalledWith('UNKNOWN', null, 'generic', 30);
    });

    it('should generate deterministic colors for same ticker', async () => {
      // First call
      mockGetCachedLogo.mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const result1 = await fetchLogo('AAPL');
      
      // Second call
      mockGetCachedLogo.mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const result2 = await fetchLogo('AAPL');

      // Same ticker should generate same logo
      expect(result1.url).toBe(result2.url);
    });

    it('should use first 2 characters as initials', async () => {
      mockGetCachedLogo.mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await fetchLogo('ABCD');

      // Decode base64 to check content
      const base64 = result.url.split(',')[1];
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      
      expect(decoded).toContain('AB'); // First 2 characters
    });
  });

  describe('fetchLogoBatch', () => {
    it('should use cached logos when available', async () => {
      const cachedMap = new Map<string, string | null>();
      cachedMap.set('NESN.SW', 'https://cached.com/nesn.png');
      cachedMap.set('NOVN.SW', 'https://cached.com/novn.png');
      mockGetCachedLogos.mockResolvedValueOnce(cachedMap);

      const results = await fetchLogoBatch([
        { ticker: 'NESN.SW' },
        { ticker: 'NOVN.SW' },
      ]);

      expect(results.size).toBe(2);
      expect(results.get('NESN.SW')?.cached).toBe(true);
      expect(results.get('NOVN.SW')?.cached).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch only uncached logos', async () => {
      const cachedMap = new Map<string, string | null>();
      cachedMap.set('NESN.SW', 'https://cached.com/nesn.png');
      mockGetCachedLogos.mockResolvedValueOnce(cachedMap);

      // Mock EODHD success for NOVN
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => '/img/logos/VX/NOVN.png',
      });

      const results = await fetchLogoBatch([
        { ticker: 'NESN.SW' },
        { ticker: 'NOVN.SW' },
      ]);

      expect(results.size).toBe(2);
      expect(results.get('NESN.SW')?.cached).toBe(true);
      expect(results.get('NOVN.SW')?.source).toBe('eodhd');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one API call for NOVN
    });

    it('should handle empty batch', async () => {
      const results = await fetchLogoBatch([]);
      expect(results.size).toBe(0);
    });

    it('should handle null cached logos (no logo found)', async () => {
      const cachedMap = new Map<string, string | null>();
      cachedMap.set('UNKNOWN.SW', null);
      mockGetCachedLogos.mockResolvedValueOnce(cachedMap);

      const results = await fetchLogoBatch([
        { ticker: 'UNKNOWN.SW' },
      ]);

      expect(results.size).toBe(1);
      expect(results.get('UNKNOWN.SW')?.source).toBe('generic');
      expect(results.get('UNKNOWN.SW')?.cached).toBe(true);
    });
  });

  describe('Integration with Swiss stocks', () => {
    it('should automatically use domain mapping for known Swiss stocks', () => {
      const swissStocks = [
        'NESN.SW',
        'NOVN.SW',
        'ROG.SW',
        'UBSG.SW',
        'HOLN.SW',
        'VPBN.SW',
      ];

      swissStocks.forEach(ticker => {
        const domain = getSwissStockDomain(ticker);
        expect(domain).toBeDefined();
        expect(domain).toMatch(/\.(com|ch)$/);
      });
    });

    it('should handle Swiss stocks without domain mapping', () => {
      const unknownSwiss = getSwissStockDomain('UNKNOWN.SW');
      expect(unknownSwiss).toBeUndefined();
    });

    it('should cover major Swiss companies', () => {
      // SMI Index stocks
      const smiStocks = [
        'NESN.SW', 'NOVN.SW', 'ROG.SW', 'UBSG.SW', 'ZURN.SW',
        'ABBN.SW', 'SREN.SW', 'LONN.SW', 'GIVN.SW', 'SLHN.SW',
      ];

      smiStocks.forEach(ticker => {
        expect(getSwissStockDomain(ticker)).toBeDefined();
      });

      // Banks
      const banks = ['VPBN.SW', 'BAER.SW'];
      banks.forEach(ticker => {
        expect(getSwissStockDomain(ticker)).toBeDefined();
      });

      // Insurance
      const insurance = ['BALZ.SW', 'MOBN.SW'];
      insurance.forEach(ticker => {
        expect(getSwissStockDomain(ticker)).toBeDefined();
      });
    });
  });
});
