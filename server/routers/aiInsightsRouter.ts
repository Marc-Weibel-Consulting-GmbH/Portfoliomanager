/**
 * AI Insights Router
 * ==================
 * Provides KI-powered portfolio health analysis using the built-in LLM.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM, invokeKimi } from "../_core/llm";
import { getResearchContextForLLM } from "../helpers/researchContext";

export const aiInsightsRouter = router({
  /**
   * Analyse a portfolio and return a structured health report.
   * Falls back to rule-based analysis if LLM is unavailable.
   */
  analyzePortfolio: protectedProcedure
    .input(
      z.object({
        portfolioName: z.string(),
        holdings: z.array(
          z.object({
            ticker: z.string(),
            weight: z.number(), // 0-100 (percent)
            sector: z.string().optional(),
          })
        ),
        riskMetrics: z
          .object({
            sharpeRatio: z.number(),
            sortinoRatio: z.number(),
            beta: z.number(),
            volatility: z.number(),
            maxDrawdown: z.number(),
            annualReturn: z.number(),
            varHistorical95: z.number(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { portfolioName, holdings, riskMetrics } = input;

      // Build sector breakdown
      const sectors = holdings.reduce((acc: Record<string, number>, h) => {
        const s = h.sector || "Unbekannt";
        acc[s] = (acc[s] || 0) + h.weight;
        return acc;
      }, {});

      const topHoldings = [...holdings]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5)
        .map((h) => `${h.ticker} (${h.weight.toFixed(1)}%)`)
        .join(", ");

      const metricsText = riskMetrics
        ? `
Risikometriken:
- Sharpe Ratio: ${riskMetrics.sharpeRatio.toFixed(2)}
- Sortino Ratio: ${riskMetrics.sortinoRatio.toFixed(2)}
- Beta: ${riskMetrics.beta.toFixed(2)}
- Volatilität (p.a.): ${riskMetrics.volatility.toFixed(2)}%
- Max. Drawdown: ${riskMetrics.maxDrawdown.toFixed(2)}%
- Annualisierte Rendite: ${riskMetrics.annualReturn.toFixed(2)}%
- VaR 95% (historisch): ${riskMetrics.varHistorical95.toFixed(2)}%`
        : "";

      const prompt = `Du bist ein erfahrener Schweizer Vermögensberater. Analysiere das folgende Portfolio und gib eine strukturierte Bewertung auf Deutsch zurück.

Portfolio: "${portfolioName}"
Anzahl Positionen: ${holdings.length}
Top 5 Positionen: ${topHoldings}

Sektoren:
${Object.entries(sectors)
  .map(([s, w]) => `- ${s}: ${(w as number).toFixed(1)}%`)
  .join("\n")}
${metricsText}

Gib deine Analyse als JSON zurück mit folgender Struktur (nur JSON, kein anderer Text):
{
  "healthScore": <Zahl 0-100>,
  "healthLabel": "<Sehr gut|Gut|Akzeptabel|Verbesserungsbedarf|Kritisch>",
  "summary": "<2-3 Sätze Gesamtbewertung>",
  "strengths": ["<Stärke 1>", "<Stärke 2>", "<Stärke 3>"],
  "risks": ["<Risiko 1>", "<Risiko 2>", "<Risiko 3>"],
  "recommendations": ["<Empfehlung 1>", "<Empfehlung 2>", "<Empfehlung 3>"],
  "riskLevel": "<Konservativ|Ausgewogen|Wachstum|Aggressiv>"
}`;

      try {
        // Inject research context into AI insights
        const researchCtx = await getResearchContextForLLM();
        const sysContent = "Du bist ein erfahrener Schweizer Vermögensberater. Antworte immer auf Deutsch und gib ausschliesslich gültiges JSON zurück." + researchCtx.contextString;
        const response = await invokeKimi({
          messages: [
            {
              role: "system",
              content: sysContent,
            },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "portfolio_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  healthScore: { type: "number" },
                  healthLabel: { type: "string" },
                  summary: { type: "string" },
                  strengths: { type: "array", items: { type: "string" } },
                  risks: { type: "array", items: { type: "string" } },
                  recommendations: { type: "array", items: { type: "string" } },
                  riskLevel: { type: "string" },
                },
                required: [
                  "healthScore",
                  "healthLabel",
                  "summary",
                  "strengths",
                  "risks",
                  "recommendations",
                  "riskLevel",
                ],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response?.choices?.[0]?.message?.content ?? "";
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        // Try direct parse
        return JSON.parse(content);
      } catch (llmErr) {
        // Fallback: rule-based analysis
        console.warn("[aiInsights] LLM failed, using rule-based fallback:", llmErr);

        if (!riskMetrics) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Analyse konnte nicht durchgeführt werden.",
          });
        }

        const { sharpeRatio, beta, maxDrawdown, annualReturn, volatility, varHistorical95 } =
          riskMetrics;

        const score = Math.min(
          100,
          Math.max(
            0,
            (sharpeRatio >= 1.5 ? 30 : sharpeRatio >= 0.5 ? 20 : 5) +
              (beta < 0.8 ? 20 : beta < 1.2 ? 15 : 5) +
              (maxDrawdown > -10 ? 20 : maxDrawdown > -20 ? 15 : 5) +
              (annualReturn > 10 ? 20 : annualReturn > 0 ? 15 : 5) +
              (holdings.length >= 10 ? 10 : holdings.length >= 5 ? 7 : 3)
          )
        );

        return {
          healthScore: Math.round(score),
          healthLabel:
            score >= 80
              ? "Sehr gut"
              : score >= 65
              ? "Gut"
              : score >= 50
              ? "Akzeptabel"
              : "Verbesserungsbedarf",
          summary: `Das Portfolio "${portfolioName}" zeigt eine annualisierte Rendite von ${annualReturn.toFixed(1)}% bei einer Volatilität von ${volatility.toFixed(1)}%. Der Sharpe Ratio von ${sharpeRatio.toFixed(2)} deutet auf eine ${sharpeRatio >= 1 ? "gute" : "ausbaufähige"} risikoadjustierte Rendite hin.`,
          strengths: [
            beta < 1
              ? `Defensives Portfolio (Beta: ${beta.toFixed(2)})`
              : `Marktkorrelation: Beta ${beta.toFixed(2)}`,
            annualReturn > 0
              ? `Positive Jahresrendite: +${annualReturn.toFixed(1)}%`
              : `Rendite: ${annualReturn.toFixed(1)}%`,
            holdings.length >= 10
              ? `Gute Diversifikation mit ${holdings.length} Positionen`
              : `${holdings.length} Positionen im Portfolio`,
          ],
          risks: [
            maxDrawdown < -15
              ? `Hoher Max. Drawdown: ${maxDrawdown.toFixed(1)}%`
              : `Max. Drawdown: ${maxDrawdown.toFixed(1)}%`,
            varHistorical95 < -2
              ? `Erhöhtes Tagesrisiko (VaR 95%: ${varHistorical95.toFixed(2)}%)`
              : `VaR 95%: ${varHistorical95.toFixed(2)}%`,
            sharpeRatio < 0.5
              ? "Schwache risikoadjustierte Rendite"
              : "Marktrisiken beachten",
          ],
          recommendations: [
            holdings.length < 10
              ? "Diversifikation durch weitere Positionen erhöhen"
              : "Diversifikation beibehalten",
            beta > 1.2
              ? "Portfolio defensiver ausrichten (Beta reduzieren)"
              : "Risikoprofil regelmässig überprüfen",
            "Regelmässige Rebalancierung empfohlen",
          ],
          riskLevel:
            beta < 0.8
              ? "Konservativ"
              : beta < 1.1
              ? "Ausgewogen"
              : beta < 1.4
              ? "Wachstum"
              : "Aggressiv",
        };
      }
    }),
});
