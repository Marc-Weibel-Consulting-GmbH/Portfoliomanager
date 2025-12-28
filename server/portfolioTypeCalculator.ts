/**
 * Calculate portfolio type based on composition
 * @param portfolioData JSON string with stocks and weights
 * @returns Portfolio type: Dividenden, Wachstum, Balanced, ETF, or null
 */
export function calculatePortfolioType(portfolioData: string): string | null {
  try {
    const stocks = JSON.parse(portfolioData);
    if (!Array.isArray(stocks) || stocks.length === 0) {
      return null;
    }

    // Calculate metrics
    let totalDividendYield = 0;
    let totalYTDPerformance = 0;
    let etfCount = 0;
    let validDividendCount = 0;
    let validYTDCount = 0;

    stocks.forEach((stock: any) => {
      const dividendYield = parseFloat(stock.dividendYield || "0");
      const ytdPerformance = parseFloat(stock.ytdPerformance || "0");
      const category = (stock.category || "").toLowerCase();

      if (dividendYield > 0) {
        totalDividendYield += dividendYield;
        validDividendCount++;
      }

      if (!isNaN(ytdPerformance)) {
        totalYTDPerformance += ytdPerformance;
        validYTDCount++;
      }

      if (category.includes("etf")) {
        etfCount++;
      }
    });

    const avgDividendYield = validDividendCount > 0 ? totalDividendYield / validDividendCount : 0;
    const avgYTDPerformance = validYTDCount > 0 ? totalYTDPerformance / validYTDCount : 0;
    const etfPercentage = (etfCount / stocks.length) * 100;

    // Classification logic
    if (etfPercentage >= 50) {
      return "ETF";
    } else if (avgDividendYield >= 3 && avgYTDPerformance < 20) {
      return "Dividenden";
    } else if (avgYTDPerformance >= 20) {
      return "Wachstum";
    } else if (avgDividendYield >= 2 || avgYTDPerformance >= 10) {
      return "Balanced";
    }

    return "Balanced"; // Default fallback
  } catch (error) {
    console.error("[PortfolioType] Failed to calculate:", error);
    return null;
  }
}
