/**
 * Fetch dividend yield with 3-tier fallback: EODHD → Finnhub → Yahoo Finance
 * @param ticker Stock ticker symbol
 * @param eodhDividendYield Dividend yield from EODHD (may be null)
 * @returns Dividend yield as percentage or null if not available
 */
export async function fetchDividendYieldWithFallback(ticker: string, eodhDividendYield: number | null): Promise<number | null> {
  let dividendYield = eodhDividendYield;
  
  // Fallback 1: Finnhub
  if (dividendYield === null || isNaN(dividendYield)) {
    try {
      const { getFinnhubApiKey } = await import("./env");
      const finnhubKey = await getFinnhubApiKey();
      if (finnhubKey) {
        const finnhubUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${finnhubKey}`;
        const finnhubRes = await fetch(finnhubUrl);
        if (finnhubRes.ok) {
          const finnhubData = await finnhubRes.json();
          if (finnhubData.metric?.dividendYieldIndicatedAnnual) {
            dividendYield = finnhubData.metric.dividendYieldIndicatedAnnual;
            console.log(`[DividendYield] Finnhub: ${ticker} = ${dividendYield}%`);
          }
        }
      }
    } catch (finnhubError) {
      console.warn(`[DividendYield] Finnhub failed for ${ticker}:`, finnhubError);
    }
  }
  
  // Fallback 2: Yahoo Finance
  if (dividendYield === null || isNaN(dividendYield)) {
    try {
      const yahooUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail`;
      const yahooRes = await fetch(yahooUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (yahooRes.ok) {
        const yahooData = await yahooRes.json();
        const summaryDetail = yahooData.quoteSummary?.result?.[0]?.summaryDetail;
        if (summaryDetail?.dividendYield?.raw) {
          dividendYield = summaryDetail.dividendYield.raw * 100;
          console.log(`[DividendYield] Yahoo Finance: ${ticker} = ${dividendYield}%`);
        }
      }
    } catch (yahooError) {
      console.warn(`[DividendYield] Yahoo Finance failed for ${ticker}:`, yahooError);
    }
  }
  
  return dividendYield;
}
