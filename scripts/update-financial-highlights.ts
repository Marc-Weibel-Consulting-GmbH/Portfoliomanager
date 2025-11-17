import { getDb } from "../server/db";
import { stocks } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const FMP_API_KEY = "demo"; // Replace with your Financial Modeling Prep API key
const DELAY_MS = 2000; // 2 seconds delay between requests to avoid rate limits

interface FinancialMetrics {
  revenueGrowth?: number;
  netProfitMargin?: number;
  freeCashFlow?: number;
}

async function fetchFinancialMetrics(ticker: string): Promise<FinancialMetrics | null> {
  try {
    // Remove Swiss exchange suffix for FMP API
    const cleanTicker = ticker.replace(/\.(SW|PA|MI|CO|DE|AS)$/, '');
    
    // Fetch key metrics from Financial Modeling Prep
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/key-metrics/${cleanTicker}?apikey=${FMP_API_KEY}&limit=1`
    );
    
    if (!response.ok) {
      console.error(`Failed to fetch metrics for ${ticker}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.log(`No metrics data for ${ticker}`);
      return null;
    }
    
    const metrics = data[0];
    
    // Fetch income statement for revenue growth
    const incomeResponse = await fetch(
      `https://financialmodelingprep.com/api/v3/income-statement/${cleanTicker}?apikey=${FMP_API_KEY}&limit=2`
    );
    
    let revenueGrowth: number | undefined;
    if (incomeResponse.ok) {
      const incomeData = await incomeResponse.json();
      if (incomeData && incomeData.length >= 2) {
        const currentRevenue = incomeData[0].revenue;
        const previousRevenue = incomeData[1].revenue;
        if (currentRevenue && previousRevenue) {
          revenueGrowth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
        }
      }
    }
    
    return {
      revenueGrowth,
      netProfitMargin: metrics.netProfitMargin ? metrics.netProfitMargin * 100 : undefined,
      freeCashFlow: metrics.freeCashFlowPerShare,
    };
  } catch (error) {
    console.error(`Error fetching metrics for ${ticker}:`, error);
    return null;
  }
}

function formatHighlight(label: string, value: number | undefined, unit: string = "%"): string | null {
  if (value === undefined || value === null) return null;
  
  const formattedValue = unit === "%" 
    ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
    : `${value.toFixed(2)} ${unit}`;
  
  return `${label}: ${formattedValue}`;
}

async function updateFinancialHighlights() {
  console.log("Starting financial highlights update...");
  
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }
  
  const allStocks = await db.select().from(stocks);
  console.log(`Found ${allStocks.length} stocks to update`);
  
  let updated = 0;
  let failed = 0;
  
  for (const stock of allStocks) {
    console.log(`\nProcessing ${stock.ticker} (${stock.companyName})...`);
    
    const metrics = await fetchFinancialMetrics(stock.ticker);
    
    if (metrics) {
      const highlights: (string | null)[] = [
        formatHighlight("Umsatzwachstum", metrics.revenueGrowth),
        formatHighlight("Gewinnmarge", metrics.netProfitMargin),
        formatHighlight("Freier Cashflow/Aktie", metrics.freeCashFlow, "USD"),
      ];
      
      // Filter out null values and take first 3
      const validHighlights = highlights.filter(h => h !== null);
      
      if (validHighlights.length > 0) {
        await db
          .update(stocks)
          .set({
            financialHighlight1: validHighlights[0] || null,
            financialHighlight2: validHighlights[1] || null,
            financialHighlight3: validHighlights[2] || null,
          })
          .where(eq(stocks.ticker, stock.ticker));
        
        console.log(`✓ Updated ${stock.ticker} with ${validHighlights.length} highlights`);
        validHighlights.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
        updated++;
      } else {
        console.log(`⚠ No valid highlights for ${stock.ticker}`);
        failed++;
      }
    } else {
      console.log(`✗ Failed to fetch metrics for ${stock.ticker}`);
      failed++;
    }
    
    // Delay to avoid rate limits
    if (allStocks.indexOf(stock) < allStocks.length - 1) {
      console.log(`Waiting ${DELAY_MS}ms before next request...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  console.log("\n=== Update Complete ===");
  console.log(`Updated: ${updated} stocks`);
  console.log(`Failed: ${failed} stocks`);
}

// Run the update
updateFinancialHighlights()
  .then(() => {
    console.log("\nFinancial highlights update completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nError updating financial highlights:", error);
    process.exit(1);
  });

