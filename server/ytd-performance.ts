/**
 * YTD Performance calculation using database ytdPerformance values
 * This ensures the chart matches the Performance card exactly
 */

export async function calculateYTDPerformance(tickers: string[], weights: number[] = []) {
  const { getDb } = await import("./db");
  const { stocks } = await import("../drizzle/schema");
  const { inArray } = await import("drizzle-orm");
  
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  // Load all stocks with ytdPerformance and portfolioWeight values
  const stockData = await db
    .select({
      ticker: stocks.ticker,
      ytdPerformance: stocks.ytdPerformance,
      portfolioWeight: stocks.portfolioWeight,
    })
    .from(stocks)
    .where(inArray(stocks.ticker, tickers));

  // Create a map for quick lookup
  const stockMap = new Map(stockData.map(s => [s.ticker, s]));

  // Calculate weighted YTD performance (same formula as Performance card)
  // Use portfolioWeight from database instead of frontend-calculated weights
  let weightedYTD = 0;
  let totalWeight = 0;

  for (const stock of stockData) {
    if (stock.ytdPerformance) {
      const ytd = parseFloat(stock.ytdPerformance);
      const weight = parseFloat(stock.portfolioWeight || "0");
      // portfolioWeight is in percent (e.g., 1.09 for 1.09%), so divide by 100
      weightedYTD += ytd * weight / 100;
      totalWeight += weight;
    }
  }

  // Weighted YTD calculated: ${weightedYTD.toFixed(2)}%

  // Generate daily data points from Jan 1 to today
  const startDate = new Date(new Date().getFullYear(), 0, 1); // Jan 1 of current year
  const endDate = new Date();
  
  const dates: string[] = [];
  const values: number[] = [];

  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  for (let day = 0; day <= totalDays; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    
    // Linear interpolation from 0% to weightedYTD%
    const progress = day / totalDays;
    const performance = weightedYTD * progress;

    dates.push(date.toISOString().split('T')[0]);
    values.push(performance);
  }

  console.log(`[YTD] Generated ${dates.length} data points from ${dates[0]} to ${dates[dates.length - 1]}`);
  console.log(`[YTD] Performance range: 0% → ${weightedYTD.toFixed(2)}%`);

  return { dates, values };
}
