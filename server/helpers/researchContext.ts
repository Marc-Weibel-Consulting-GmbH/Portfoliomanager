/**
 * Research Context Helper
 * =======================
 * Fetches analyzed research documents and provides a formatted context string
 * that can be injected into any LLM system prompt to enrich AI recommendations.
 */
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { researchDocuments } from "../../drizzle/schema";

export interface ResearchContextResult {
  contextString: string;
  documentCount: number;
  tickers: string[];
}

/**
 * Get a formatted research context string for LLM injection.
 * Returns the most recent research insights (max 20 docs) as a condensed text block.
 * 
 * @param relevantTickers - Optional: filter to only include insights mentioning these tickers
 */
export async function getResearchContextForLLM(relevantTickers?: string[]): Promise<ResearchContextResult> {
  const db = await getDb();
  if (!db) return { contextString: "", documentCount: 0, tickers: [] };

  try {
    const docs = await db.select({
      title: researchDocuments.title,
      summary: researchDocuments.summary,
      keyInsights: researchDocuments.keyInsights,
      relevantTickers: researchDocuments.relevantTickers,
      analyzedAt: researchDocuments.analyzedAt,
    })
    .from(researchDocuments)
    .where(eq(researchDocuments.status, "ready"))
    .orderBy(desc(researchDocuments.analyzedAt))
    .limit(20);

    if (docs.length === 0) return { contextString: "", documentCount: 0, tickers: [] };

    // Optionally filter by relevant tickers
    let filteredDocs = docs;
    if (relevantTickers && relevantTickers.length > 0) {
      const tickerSet = new Set(relevantTickers.map(t => t.toUpperCase()));
      filteredDocs = docs.filter(doc => {
        const docTickers = (doc.relevantTickers as string[]) || [];
        return docTickers.some(t => tickerSet.has(t.toUpperCase())) || docTickers.length === 0;
      });
      // If no filtered docs match, use all docs (general context)
      if (filteredDocs.length === 0) filteredDocs = docs;
    }

    const allTickers: string[] = [];
    const parts: string[] = [];

    for (const doc of filteredDocs) {
      let part = `[${doc.title}]`;
      if (doc.summary) part += `: ${doc.summary}`;
      if (doc.keyInsights && (doc.keyInsights as string[]).length > 0) {
        const insights = (doc.keyInsights as string[]).slice(0, 3);
        part += ` | Erkenntnisse: ${insights.join("; ")}`;
      }
      parts.push(part);
      
      if (doc.relevantTickers) {
        allTickers.push(...(doc.relevantTickers as string[]));
      }
    }

    const contextString = `\n\n--- AKTUELLE RESEARCH-ERKENNTNISSE (${filteredDocs.length} Dokumente) ---\n${parts.join("\n")}\n--- ENDE RESEARCH ---`;

    return {
      contextString,
      documentCount: filteredDocs.length,
      tickers: [...new Set(allTickers)],
    };
  } catch (error) {
    console.error("[ResearchContext] Failed to fetch research context:", error);
    return { contextString: "", documentCount: 0, tickers: [] };
  }
}
