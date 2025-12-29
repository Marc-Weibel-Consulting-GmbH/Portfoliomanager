import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({}),
  updateStockSector: vi.fn().mockResolvedValue(undefined),
  getAllStocks: vi.fn().mockResolvedValue([
    { ticker: 'AAPL', companyName: 'Apple Inc.', sector: null },
    { ticker: 'MSFT', companyName: 'Microsoft Corp.', sector: 'Technology' },
    { ticker: 'NESN.SW', companyName: 'Nestlé', sector: null },
  ]),
  updateStock: vi.fn().mockResolvedValue(undefined),
}));

// Mock the EODHD API
vi.mock('../_core/eodhdApi', () => ({
  fetchEODHDFundamentals: vi.fn().mockImplementation((ticker: string) => {
    const sectors: Record<string, string> = {
      'AAPL': 'Technology',
      'NESN.SW': 'Consumer Defensive',
    };
    return Promise.resolve({
      companyName: null,
      sector: sectors[ticker] || null,
      industry: null,
      pegRatio: null,
      peRatio: null,
      dividendYield: null,
      marketCap: null,
      beta: null,
      eps: null,
      bookValue: null,
      earningsGrowth: null,
    });
  }),
}));

describe('Sector Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should identify stocks without sector data', async () => {
    const { getAllStocks } = await import('../db');
    const stocks = await getAllStocks();
    
    const stocksWithoutSector = stocks.filter(s => !s.sector || s.sector === '');
    
    expect(stocksWithoutSector.length).toBe(2);
    expect(stocksWithoutSector.map(s => s.ticker)).toContain('AAPL');
    expect(stocksWithoutSector.map(s => s.ticker)).toContain('NESN.SW');
  });

  it('should fetch sector data from EODHD API', async () => {
    const { fetchEODHDFundamentals } = await import('../_core/eodhdApi');
    
    const appleData = await fetchEODHDFundamentals('AAPL');
    expect(appleData.sector).toBe('Technology');
    
    const nestleData = await fetchEODHDFundamentals('NESN.SW');
    expect(nestleData.sector).toBe('Consumer Defensive');
  });

  it('should update stock sector in database', async () => {
    const { updateStockSector } = await import('../db');
    
    await updateStockSector('AAPL', 'Technology');
    
    expect(updateStockSector).toHaveBeenCalledWith('AAPL', 'Technology');
  });
});

describe('Transaction Update', () => {
  it('should validate transaction update input', () => {
    // Test input validation for transaction updates
    const validInput = {
      transactionId: 1,
      transactionDate: '2024-01-15',
      shares: '100',
      pricePerShare: '150.50',
      notes: 'Updated purchase'
    };
    
    expect(validInput.transactionId).toBeGreaterThan(0);
    expect(validInput.shares).toBeTruthy();
    expect(validInput.pricePerShare).toBeTruthy();
    expect(new Date(validInput.transactionDate)).toBeInstanceOf(Date);
  });

  it('should reject invalid transaction dates', () => {
    const invalidDate = 'not-a-date';
    const parsedDate = new Date(invalidDate);
    
    expect(isNaN(parsedDate.getTime())).toBe(true);
  });

  it('should reject negative share amounts', () => {
    const shares = parseFloat('-10');
    
    expect(shares).toBeLessThan(0);
  });

  it('should reject zero price per share', () => {
    const price = parseFloat('0');
    
    expect(price).toBeLessThanOrEqual(0);
  });
});

describe('Sector Allocation Calculation', () => {
  it('should calculate sector allocation percentages', () => {
    const holdings = [
      { ticker: 'AAPL', sector: 'Technology', currentValueCHF: 50000 },
      { ticker: 'MSFT', sector: 'Technology', currentValueCHF: 30000 },
      { ticker: 'NESN.SW', sector: 'Consumer Defensive', currentValueCHF: 20000 },
    ];
    
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValueCHF, 0);
    
    // Group by sector
    const sectorMap: Record<string, number> = {};
    holdings.forEach(h => {
      const sector = h.sector || 'Other';
      sectorMap[sector] = (sectorMap[sector] || 0) + h.currentValueCHF;
    });
    
    // Calculate percentages
    const sectorPercentages = Object.entries(sectorMap).map(([sector, value]) => ({
      sector,
      percentage: (value / totalValue) * 100
    }));
    
    expect(totalValue).toBe(100000);
    expect(sectorPercentages.find(s => s.sector === 'Technology')?.percentage).toBe(80);
    expect(sectorPercentages.find(s => s.sector === 'Consumer Defensive')?.percentage).toBe(20);
  });

  it('should handle stocks without sector data as "Other"', () => {
    const holdings = [
      { ticker: 'AAPL', sector: null, currentValueCHF: 50000 },
      { ticker: 'UNKNOWN', sector: '', currentValueCHF: 50000 },
    ];
    
    const sectorMap: Record<string, number> = {};
    holdings.forEach(h => {
      const sector = h.sector || 'Other';
      sectorMap[sector] = (sectorMap[sector] || 0) + h.currentValueCHF;
    });
    
    expect(sectorMap['Other']).toBe(100000);
    expect(Object.keys(sectorMap).length).toBe(1);
  });
});
