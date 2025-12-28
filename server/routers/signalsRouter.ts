import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { savedPortfolios } from "../../drizzle/schema";

type SignalType = "buy" | "sell" | "hold";
type SignalStrength = "strong" | "moderate" | "weak";

interface Signal {
  ticker: string;
  companyName: string;
  type: SignalType;
  strength: SignalStrength;
  currentPrice: number;
  targetPrice: number;
  peRatio: number | null;
  dividendYield: number;
  ytdPerformance: number;
  reason: string;
  criteria: string[];
}

/**
 * Generate trading signals based on financial metrics
 */
function generateSignal(stock: any): Signal {
  const criteria: string[] = [];
  let score = 0; // Positive = buy, Negative = sell
  
  // Convert all numeric string fields to numbers
  const currentPrice = typeof stock.currentPrice === 'number' 
    ? stock.currentPrice 
    : parseFloat(stock.currentPrice) || 0;
  
  const peRatio = stock.peRatio 
    ? (typeof stock.peRatio === 'number' ? stock.peRatio : parseFloat(stock.peRatio))
    : null;
  
  const pegRatio = stock.pegRatio 
    ? (typeof stock.pegRatio === 'number' ? stock.pegRatio : parseFloat(stock.pegRatio))
    : null;
  
  const dividendYield = stock.dividendYield 
    ? (typeof stock.dividendYield === 'number' ? stock.dividendYield : parseFloat(stock.dividendYield))
    : 0;
  
  const ytdPerformance = stock.ytdPerformance 
    ? (typeof stock.ytdPerformance === 'number' ? stock.ytdPerformance : parseFloat(stock.ytdPerformance))
    : 0;
  
  const sharpeRatio = stock.sharpeRatio 
    ? (typeof stock.sharpeRatio === 'number' ? stock.sharpeRatio : parseFloat(stock.sharpeRatio))
    : null;
  
  // P/E Ratio analysis
  if (peRatio !== null && !isNaN(peRatio)) {
    if (peRatio < 15) {
      score += 2;
      criteria.push("Niedriges P/E (<15)");
    } else if (peRatio > 30) {
      score -= 2;
      criteria.push("Hohes P/E (>30)");
    }
  }

  // PEG Ratio analysis
  if (pegRatio !== null && !isNaN(pegRatio)) {
    if (pegRatio < 1) {
      score += 2;
      criteria.push("Attraktives PEG (<1)");
    } else if (pegRatio > 2) {
      score -= 1;
      criteria.push("Teures PEG (>2)");
    }
  }

  // Dividend Yield analysis
  if (dividendYield > 4) {
    score += 1;
    criteria.push("Hohe Dividende (>4%)");
  }

  // YTD Performance analysis
  if (ytdPerformance !== 0 && !isNaN(ytdPerformance)) {
    if (ytdPerformance < -20) {
      score += 1;
      criteria.push("Stark gefallen (>20%)");
    } else if (ytdPerformance > 30) {
      score -= 1;
      criteria.push("Stark gestiegen (>30%)");
    }
  }

  // Sharpe Ratio analysis
  if (sharpeRatio !== null && !isNaN(sharpeRatio)) {
    if (sharpeRatio > 1.5) {
      score += 1;
      criteria.push("Gute Sharpe Ratio (>1.5)");
    }
  }

  // Determine signal type and strength
  let type: SignalType;
  let strength: SignalStrength;
  let reason: string;
  let targetPrice: number;

  if (score >= 3) {
    type = "buy";
    strength = "strong";
    reason = "Mehrere positive Indikatoren deuten auf eine Kaufgelegenheit hin. Die Bewertung ist attraktiv und die Fundamentaldaten sind solide.";
    targetPrice = currentPrice * 1.15;
  } else if (score >= 1) {
    type = "buy";
    strength = "moderate";
    reason = "Einige positive Signale vorhanden. Könnte eine gute Ergänzung für diversifizierte Portfolios sein.";
    targetPrice = currentPrice * 1.10;
  } else if (score <= -3) {
    type = "sell";
    strength = "strong";
    reason = "Mehrere negative Indikatoren. Die Bewertung erscheint überzogen oder die Performance ist schwach. Gewinnmitnahme empfohlen.";
    targetPrice = currentPrice * 0.90;
  } else if (score <= -1) {
    type = "sell";
    strength = "moderate";
    reason = "Einige Warnsignale erkennbar. Überwachung empfohlen, ggf. Position reduzieren.";
    targetPrice = currentPrice * 0.95;
  } else {
    type = "hold";
    strength = "moderate";
    reason = "Neutrale Bewertung. Aktuelle Position beibehalten und Entwicklung beobachten.";
    targetPrice = currentPrice;
  }

  return {
    ticker: stock.ticker,
    companyName: stock.companyName,
    type,
    strength,
    currentPrice,
    targetPrice,
    peRatio: peRatio,
    dividendYield: dividendYield,
    ytdPerformance: ytdPerformance,
    reason,
    criteria
  };
}

export const signalsRouter = router({
  /**
   * Generate trading signals for a portfolio
   */
  generate: protectedProcedure
    .input(z.object({
      portfolioId: z.number()
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Fetch portfolio
      const [portfolio] = await db
        .select()
        .from(savedPortfolios)
        .where(eq(savedPortfolios.id, input.portfolioId))
        .limit(1);

      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Parse portfolio data
      const portfolioData = JSON.parse(portfolio.portfolioData);
      const stocks = portfolioData.stocks || [];

      // Generate signals for each stock
      const signals: Signal[] = stocks.map((stock: any) => generateSignal(stock));

      // Sort by signal strength and type (strong buy first, then moderate buy, etc.)
      const signalOrder = { buy: 0, hold: 1, sell: 2 };
      const strengthOrder = { strong: 0, moderate: 1, weak: 2 };
      
      signals.sort((a, b) => {
        if (signalOrder[a.type] !== signalOrder[b.type]) {
          return signalOrder[a.type] - signalOrder[b.type];
        }
        return strengthOrder[a.strength] - strengthOrder[b.strength];
      });

      return signals;
    })
});
