import { invokeLLM, invokeKimi } from "./llm";

export interface DailyNewsSection {
  title: string;
  content: string;
}

export interface DailyNewsResponse {
  earningsReleases: DailyNewsSection;
  companyNews: DailyNewsSection;
  relatedArticles: DailyNewsSection;
  generatedAt: string;
}

/**
 * Generates AI-powered daily news overview for a stock
 * Similar to Swissquote's "KI-Tagesüberblick" format
 */
export async function generateDailyNews(
  ticker: string,
  companyName: string
): Promise<DailyNewsResponse> {
  const today = new Date().toLocaleDateString("de-CH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const systemPrompt = `Du bist ein Finanzjournalist, der täglich kompakte News-Übersichten für Aktieninvestoren erstellt. 
Dein Stil ist sachlich, präzise und auf das Wesentliche konzentriert.
Erstelle eine strukturierte Übersicht mit genau 3 Abschnitten:
1. Heutige Quartalszahlen (falls vorhanden)
2. Unternehmensnachrichten
3. Verwandte Artikel

Jeder Abschnitt sollte 2-3 Sätze umfassen. Verwende aktuelle Informationen (Stand ${today}).`;

  const userPrompt = `Erstelle eine tägliche News-Übersicht für ${companyName} (${ticker}). 

Struktur:
1. **Heutige Quartalszahlen**: Gibt es heute Earnings Releases? Falls ja, kurze Zusammenfassung. Falls nein, schreibe "Keine Quartalszahlen heute."
2. **Unternehmensnachrichten**: Die wichtigsten aktuellen Nachrichten zum Unternehmen (Produkte, Deals, Management-Wechsel, etc.)
3. **Verwandte Artikel**: Marktanalysen, Analystenmeinungen oder Branchennews, die das Unternehmen betreffen

Antworte im JSON-Format:
{
  "earningsReleases": "Text für Abschnitt 1",
  "companyNews": "Text für Abschnitt 2",
  "relatedArticles": "Text für Abschnitt 3"
}`;

  try {
    const response = await invokeKimi({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "daily_news",
          strict: true,
          schema: {
            type: "object",
            properties: {
              earningsReleases: { type: "string", description: "Heutige Quartalszahlen" },
              companyNews: { type: "string", description: "Unternehmensnachrichten" },
              relatedArticles: { type: "string", description: "Verwandte Artikel" },
            },
            required: ["earningsReleases", "companyNews", "relatedArticles"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in LLM response");
    }
    if (typeof content !== 'string') {
      throw new Error("Invalid LLM response format");
    }

    const parsed = JSON.parse(content);

    return {
      earningsReleases: {
        title: "Heutige Quartalszahlen",
        content: parsed.earningsReleases,
      },
      companyNews: {
        title: "Unternehmensnachrichten",
        content: parsed.companyNews,
      },
      relatedArticles: {
        title: "Verwandte Artikel",
        content: parsed.relatedArticles,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[aiDailyNews] Error generating news:", error);
    // Return fallback content on error
    return {
      earningsReleases: {
        title: "Heutige Quartalszahlen",
        content: "Keine Quartalszahlen heute verfügbar.",
      },
      companyNews: {
        title: "Unternehmensnachrichten",
        content: "Aktuell keine Unternehmensnachrichten verfügbar.",
      },
      relatedArticles: {
        title: "Verwandte Artikel",
        content: "Aktuell keine verwandten Artikel verfügbar.",
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
