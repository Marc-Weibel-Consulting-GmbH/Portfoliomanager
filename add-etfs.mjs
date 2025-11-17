import { drizzle } from 'drizzle-orm/mysql2';
import { stocks } from './drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);

const etfs = [
  {
    ticker: 'CSWCFAH',
    companyName: 'UBS Equities Wrld x CH I-A hdg',
    category: 'Aktien Welt',
    currentPrice: 0,
    dividendYield: 0,
    ytdPerformance: 0,
    quantity: 0,
  },
  {
    ticker: 'VOO',
    companyName: 'Vanguard S&P 500 ETF',
    category: 'Aktien Nordamerika',
    currentPrice: 0,
    dividendYield: 0,
    ytdPerformance: 0,
    quantity: 0,
  },
  {
    ticker: 'IGF',
    companyName: 'iShares Global Infrastructure',
    category: 'Aktien Themen',
    currentPrice: 0,
    dividendYield: 0,
    ytdPerformance: 0,
    quantity: 0,
  },
  {
    ticker: 'UBSEPJA',
    companyName: 'UBS Eqt Pacific ex Jap Idx I-A',
    category: 'Aktien Asien/Pazifik',
    currentPrice: 0,
    dividendYield: 0,
    ytdPerformance: 0,
    quantity: 0,
  },
  {
    ticker: 'UBSPLW',
    companyName: 'UBS Eqty CH Passive Leader W',
    category: 'Aktien Schweiz',
    currentPrice: 0,
    dividendYield: 0,
    ytdPerformance: 0,
    quantity: 0,
  },
  {
    ticker: 'SWCSMGT',
    companyName: 'SWC IEF Small & Mid Caps CH GT',
    category: 'Aktien Schweiz',
    currentPrice: 0,
    dividendYield: 0,
    ytdPerformance: 0,
    quantity: 0,
  },
  {
    ticker: 'CHSPI',
    companyName: 'iShares Swiss Dividend A',
    category: 'Aktien Schweiz',
    currentPrice: 0,
    dividendYield: 0,
    ytdPerformance: 0,
    quantity: 0,
  },
  {
    ticker: 'UBSGOLD',
    companyName: 'UBS Gold hCHF I-A',
    category: 'Rohstoffe und Edelmetalle',
    currentPrice: 0,
    dividendYield: 0,
    ytdPerformance: 0,
    quantity: 0,
  },
];

async function addETFs() {
  console.log('Adding 8 ETFs to database...');
  
  for (const etf of etfs) {
    try {
      await db.insert(stocks).values(etf);
      console.log(`✓ Added: ${etf.companyName} (${etf.ticker})`);
    } catch (error) {
      console.error(`✗ Failed to add ${etf.ticker}:`, error.message);
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

addETFs();
