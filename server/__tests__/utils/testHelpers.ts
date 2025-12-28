/**
 * Test Utilities for Portfolio Analysis Tests
 * Provides mock data and helper functions for testing critical calculations
 */

export interface MockTransaction {
  id: number;
  portfolioId: number;
  ticker: string;
  transactionType: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend';
  shares?: string;
  pricePerShare?: string;
  totalAmount?: string;
  totalAmountCHF?: string;
  transactionDate: Date;
  notes?: string;
  feesCHF?: string;
}

export interface MockStock {
  ticker: string;
  companyName: string;
  currentPrice: string;
  currency: string;
}

export interface MockHistoricalPrice {
  ticker: string;
  date: string;
  close: string;
}

export interface MockRealizedGain {
  portfolioId: number;
  ticker: string;
  realizedGain: string;
  stockGainLocal?: string;
  fxGain?: string;
}

/**
 * Create mock buy transaction
 */
export function createMockBuyTransaction(
  ticker: string,
  shares: number,
  pricePerShare: number,
  date: Date = new Date(),
  isInitial = false
): MockTransaction {
  const totalAmount = shares * pricePerShare;
  return {
    id: Math.floor(Math.random() * 10000),
    portfolioId: 1,
    ticker,
    transactionType: 'buy',
    shares: shares.toString(),
    pricePerShare: pricePerShare.toString(),
    totalAmount: totalAmount.toString(),
    totalAmountCHF: totalAmount.toString(),
    transactionDate: date,
    notes: isInitial ? 'Initial position from optimizer' : undefined,
    feesCHF: '0',
  };
}

/**
 * Create mock sell transaction
 */
export function createMockSellTransaction(
  ticker: string,
  shares: number,
  pricePerShare: number,
  date: Date = new Date()
): MockTransaction {
  const totalAmount = shares * pricePerShare;
  return {
    id: Math.floor(Math.random() * 10000),
    portfolioId: 1,
    ticker,
    transactionType: 'sell',
    shares: shares.toString(),
    pricePerShare: pricePerShare.toString(),
    totalAmount: totalAmount.toString(),
    totalAmountCHF: totalAmount.toString(),
    transactionDate: date,
    feesCHF: '0',
  };
}

/**
 * Create mock deposit transaction
 */
export function createMockDepositTransaction(
  amount: number,
  date: Date = new Date()
): MockTransaction {
  return {
    id: Math.floor(Math.random() * 10000),
    portfolioId: 1,
    ticker: '',
    transactionType: 'deposit',
    totalAmount: amount.toString(),
    totalAmountCHF: amount.toString(),
    transactionDate: date,
    feesCHF: '0',
  };
}

/**
 * Create mock withdrawal transaction
 */
export function createMockWithdrawalTransaction(
  amount: number,
  date: Date = new Date()
): MockTransaction {
  return {
    id: Math.floor(Math.random() * 10000),
    portfolioId: 1,
    ticker: '',
    transactionType: 'withdrawal',
    totalAmount: amount.toString(),
    totalAmountCHF: amount.toString(),
    transactionDate: date,
    feesCHF: '0',
  };
}

/**
 * Create mock dividend transaction
 */
export function createMockDividendTransaction(
  ticker: string,
  amount: number,
  date: Date = new Date()
): MockTransaction {
  return {
    id: Math.floor(Math.random() * 10000),
    portfolioId: 1,
    ticker,
    transactionType: 'dividend',
    totalAmount: amount.toString(),
    totalAmountCHF: amount.toString(),
    transactionDate: date,
    feesCHF: '0',
  };
}

/**
 * Create mock stock data
 */
export function createMockStock(
  ticker: string,
  companyName: string,
  currentPrice: number,
  currency: string = 'CHF'
): MockStock {
  return {
    ticker,
    companyName,
    currentPrice: currentPrice.toString(),
    currency,
  };
}

/**
 * Create mock historical price
 */
export function createMockHistoricalPrice(
  ticker: string,
  date: string,
  closePrice: number
): MockHistoricalPrice {
  return {
    ticker,
    date,
    close: closePrice.toString(),
  };
}

/**
 * Create mock realized gain
 */
export function createMockRealizedGain(
  ticker: string,
  realizedGain: number,
  stockGainLocal?: number,
  fxGain?: number
): MockRealizedGain {
  return {
    portfolioId: 1,
    ticker,
    realizedGain: realizedGain.toString(),
    stockGainLocal: stockGainLocal?.toString(),
    fxGain: fxGain?.toString(),
  };
}

/**
 * Calculate holdings from transactions (test implementation)
 */
export function calculateHoldingsFromTransactions(
  transactions: MockTransaction[]
): Record<string, number> {
  const holdings: Record<string, number> = {};
  
  transactions.forEach((tx) => {
    if (tx.transactionType === 'buy') {
      const shares = parseFloat(tx.shares || '0');
      holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
    } else if (tx.transactionType === 'sell') {
      const shares = parseFloat(tx.shares || '0');
      holdings[tx.ticker] = (holdings[tx.ticker] || 0) - shares;
    }
  });
  
  return holdings;
}

/**
 * Calculate cash position from transactions (test implementation)
 */
export function calculateCashPosition(
  transactions: MockTransaction[]
): number {
  let totalDeposits = 0;
  let totalBuyAmounts = 0;
  let totalSellProceeds = 0;
  let totalDividends = 0;
  
  transactions.forEach((tx) => {
    const amount = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
    const isInitialTransaction = tx.notes && tx.notes.includes('Initial position');
    
    if (tx.transactionType === 'buy') {
      if (isInitialTransaction) {
        totalDeposits += amount;
      }
      totalBuyAmounts += amount;
    } else if (tx.transactionType === 'sell') {
      totalSellProceeds += amount;
    } else if (tx.transactionType === 'deposit') {
      if (!isInitialTransaction) {
        totalDeposits += amount;
      }
    } else if (tx.transactionType === 'withdrawal') {
      totalDeposits -= Math.abs(amount);
    } else if (tx.transactionType === 'dividend') {
      totalDividends += amount;
    }
  });
  
  return totalDeposits - totalBuyAmounts + totalSellProceeds + totalDividends;
}

/**
 * Calculate total invested from transactions (test implementation)
 */
export function calculateTotalInvested(
  transactions: MockTransaction[]
): number {
  let totalDeposits = 0;
  
  transactions.forEach((tx) => {
    const amount = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
    const isInitialTransaction = tx.notes && tx.notes.includes('Initial position');
    
    if (tx.transactionType === 'buy' && isInitialTransaction) {
      totalDeposits += amount;
    } else if (tx.transactionType === 'deposit') {
      totalDeposits += amount;
    } else if (tx.transactionType === 'withdrawal') {
      totalDeposits -= Math.abs(amount);
    }
  });
  
  return totalDeposits;
}
