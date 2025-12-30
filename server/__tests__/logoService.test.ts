import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLogo, getSwissStockDomain, fetchLogoBatch } from '../logoService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock ENV
vi.mock('../_core/env', () => ({
  ENV: {
    fmpApiKey: 'test-fmp-key',
  },
}));

describe('Logo Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('fetchLogo - Clearbit primary', () => {
    it('should fetch logo from Clearbit when domain is provided and available', async () => {
      // Mock successful Clearbit response (HEAD request)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await fetchLogo('NESN.SW', 'nestle.com');

      expect(result.source).toBe('clearbit');
      expect(result.url).toBe('https://logo.clearbit.com/nestle.com');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://logo.clearbit.com/nestle.com',
        expect.objectContaining({ method: 'HEAD' })
      );
    });

    it('should handle Clearbit timeout gracefully', async () => {
      // Mock Clearbit timeout
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const result = await fetchLogo('NESN.SW', 'nestle.com');

      // Should fallback to generic (FMP will also fail without proper mock)
      expect(result.source).toBe('generic');
    });
  });

  describe('fetchLogo - FMP fallback', () => {
    it('should fallback to FMP when Clearbit fails', async () => {
      // Mock Clearbit failure (404)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Mock successful FMP response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ image: 'https://financialmodelingprep.com/image-stock/NESN.png' }],
      });

      const result = await fetchLogo('NESN.SW', 'nestle.com');

      expect(result.source).toBe('fmp');
      expect(result.url).toBe('https://financialmodelingprep.com/image-stock/NESN.png');
    });

    it('should clean ticker for FMP (remove .SW suffix)', async () => {
      // Mock Clearbit failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Mock FMP success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ image: 'https://fmp.com/logo/NESN.png' }],
      });

      await fetchLogo('NESN.SW', 'nestle.com');

      // Check that FMP was called with clean ticker (without .SW)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profile/NESN?'),
        expect.anything()
      );
    });

    it('should skip FMP when no API key is configured', async () => {
      // Temporarily remove API key
      vi.doMock('../_core/env', () => ({
        ENV: {
          fmpApiKey: '',
        },
      }));

      // Mock Clearbit failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchLogo('TEST.SW', 'test.com');

      // Should skip FMP and go to generic
      expect(result.source).toBe('generic');
    });
  });

  describe('fetchLogo - Generic SVG fallback', () => {
    it('should generate generic SVG when all APIs fail', async () => {
      // Mock Clearbit failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Mock FMP failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchLogo('TEST.SW', 'test.com');

      expect(result.source).toBe('generic');
      expect(result.url).toContain('data:image/svg+xml;base64');
      
      // Decode base64 to check initials
      const base64 = result.url.split(',')[1];
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      expect(decoded).toContain('TE'); // "TE" are the initials from "TEST"
    });

    it('should skip Clearbit when no domain is provided', async () => {
      // Mock FMP failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchLogo('AAPL');

      expect(result.source).toBe('generic');
      // Only FMP should be called (1 call)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should generate deterministic colors for same ticker', async () => {
      // Mock all failures
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result1 = await fetchLogo('AAPL');
      vi.clearAllMocks();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });
      const result2 = await fetchLogo('AAPL');

      // Same ticker should generate same logo
      expect(result1.url).toBe(result2.url);
    });

    it('should use first 2 characters as initials', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await fetchLogo('ABCD');

      // Decode base64 to check content
      const base64 = result.url.split(',')[1];
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      
      expect(decoded).toContain('AB'); // First 2 characters
    });
  });

  describe('fetchLogoBatch', () => {
    it('should fetch logos for multiple tickers in parallel', async () => {
      // Mock responses for different tickers
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 }) // Clearbit for NESN
        .mockResolvedValueOnce({ ok: true, status: 200 }); // Clearbit for NOVN

      const results = await fetchLogoBatch([
        { ticker: 'NESN.SW', domain: 'nestle.com' },
        { ticker: 'NOVN.SW', domain: 'novartis.com' },
      ]);

      expect(results.size).toBe(2);
      expect(results.get('NESN.SW')?.source).toBe('clearbit');
      expect(results.get('NOVN.SW')?.source).toBe('clearbit');
    });

    it('should handle mixed success and fallback', async () => {
      // NESN: Clearbit success
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      
      // NOVN: Clearbit fail, FMP success
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ image: 'https://fmp.com/novn.png' }],
      });

      const results = await fetchLogoBatch([
        { ticker: 'NESN.SW', domain: 'nestle.com' },
        { ticker: 'NOVN.SW', domain: 'novartis.com' },
      ]);

      expect(results.size).toBe(2);
      expect(results.get('NESN.SW')?.source).toBe('clearbit');
      expect(results.get('NOVN.SW')?.source).toBe('fmp');
    });

    it('should handle empty batch', async () => {
      const results = await fetchLogoBatch([]);
      expect(results.size).toBe(0);
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
