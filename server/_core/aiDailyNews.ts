import { invokeLLM } from "./llm";

export interface DailyNewsItem {
  title: string;
  source: string;
  timestamp: string;
  sentiment: "Positiv" | "Neutral" | "Negativ";
  url?: string;
}

export interface DailyNewsOverview {
  earningsToday: DailyNewsItem[];
  companyNews: DailyNewsItem[];
  relatedArticles: DailyNewsItem[];
}

/**
 * Generate AI-powered daily news overview for a stock
 * Similar to Swissquote's "KI-Tagesüberblick"
 */
export async function generateDailyNews(
  ticker: string,
  companyName: string
): Promise<DailyNewsOverview> {
  try {
    // Use LLM to generate structured news overview
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Du bist ein Finanzanalyst der tägliche News-Überblicke für Aktien erstellt. 
Generiere einen strukturierten Überblick mit drei Kategorien:
1. Heutige Ergebnisveröffentlichungen (earnings releases)
2. Unternehmensnachrichten (company news mit Kursbewegung)
3. Verwandte Artikel (related news articles)

Verwende echte, aktuelle Informationen wenn möglich. Wenn keine aktuellen Daten verfügbar sind, gib leere Arrays zurück.
Sentiment: "Positiv", "Neutral", oder "Negativ"`,
        },
        {
          role: "user",
          content: `Erstelle einen täglichen News-Überblick für ${companyName} (${ticker}). Heute ist ${new Date().toLocaleDateString('de-DE')}.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "daily_news_overview",
          strict: true,
          schema: {
            type: "object",
            properties: {
              earningsToday: {
                type: "array",
                description: "Heutige Ergebnisveröffentlichungen",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    source: { type: "string" },
                    timestamp: { type: "string" },
                    sentiment: { type: "string", enum: ["Positiv", "Neutral", "Negativ"] },
                  },
                  required: ["title", "source", "timestamp", "sentiment"],
                  additionalProperties: false,
                },
              },
              companyNews: {
                type: "array",
                description: "Unternehmensnachrichten mit Kursbewegung",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    source: { type: "string" },
                    timestamp: { type: "string" },
                    sentiment: { type: "string", enum: ["Positiv", "Neutral", "Negativ"] },
                  },
                  required: ["title", "source", "timestamp", "sentiment"],
                  additionalProperties: false,
                },
              },
              relatedArticles: {
                type: "array",
                description: "Verwandte Artikel",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    source: { type: "string" },
                    timestamp: { type: "string" },
                    sentiment: { type: "string", enum: ["Positiv", "Neutral", "Negativ"] },
                  },
                  required: ["title", "source", "timestamp", "sentiment"],
                  additionalProperties: false,
                },
              },
            },
            required: ["earningsToday", "companyNews", "relatedArticles"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in LLM response");
    }

    const overview: DailyNewsOverview = JSON.parse(content);
    return overview;
  } catch (error) {
    console.error("[AI Daily News] Failed to generate news:", error);
    // Return empty overview on error
    return {
      earningsToday: [],
      companyNews: [],
      relatedArticles: [],
    };
  }
}
