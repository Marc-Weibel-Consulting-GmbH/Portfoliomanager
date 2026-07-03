import mysql from 'mysql2/promise';
import { callDataApi } from './server/_core/dataApi.js';

async function fetchPrice(ticker: string): Promise<string | null> {
  try {
    let region = "US";
    
    if (ticker.includes(".")) {
      const suffix = ticker.split('.')[1];
      const regionMap: Record<string, string> = {
        "SW": "CH", "DE": "DE", "L": "GB",
        "PA": "FR", "CO": "DK", "MI": "IT"
      };
      region = regionMap[suffix] || "US";
    }

    const response = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: ticker,
        region: region,
        interval: "1d",
        range: "1d"
      }
    }) as any;

    if (response?.chart?.result?.[0]?.meta?.regularMarketPrice) {
      return response.chart.result[0].meta.regularMarketPrice.toString();
    }
    return null;
  } catch (error: any) {
    console.error(`Error fetching ${ticker}:`, error.message);
    return null;
  }
}

async function updateAllPrices() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  
  try {
    const [stocks] = await conn.query('SELECT ticker, companyName, currency FROM stocks') as any;
    console.log(`Updating ${stocks.length} stocks...`);
    console.log('='.repeat(80));
    
    let updated = 0;
    let failed = 0;
    
    for (const stock of stocks) {
      const newPrice = await fetchPrice(stock.ticker);
      
      if (newPrice) {
        await conn.query('UPDATE stocks SET currentPrice = ? WHERE ticker = ?', [newPrice, stock.ticker]);
        console.log(`✓ ${stock.ticker.padEnd(15)} ${newPrice.padStart(10)} ${stock.currency || 'USD'}`);
        updated++;
      } else {
        console.log(`✗ ${stock.ticker.padEnd(15)} FAILED`);
        failed++;
      }
      
      await new Promise(r => setTimeout(r, 300)); // Small delay
    }
    
    console.log('='.repeat(80));
    console.log(`\nCompleted: ${updated} updated, ${failed} failed`);
    
  } finally {
    await conn.end();
  }
}

updateAllPrices().catch(console.error);
