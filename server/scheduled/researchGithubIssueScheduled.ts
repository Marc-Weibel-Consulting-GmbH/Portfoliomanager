/**
 * Research → GitHub Issue Scheduled Handler
 *
 * Triggered daily via Heartbeat cron (09:00 UTC, after n8n research feed refresh).
 * Finds all research_signals with relevanceScore >= 8 and githubIssueNumber IS NULL,
 * fetches article full-text via Firecrawl (if URL available),
 * enriches each signal via LLM (hypothesis, expected effect, confidence, affected engine),
 * creates a [Research] GitHub Issue, and stores the issue number back in the DB.
 *
 * Requires GITHUB_TOKEN env variable with repo scope.
 * Requires FIRECRAWL_API_KEY env variable for article full-text extraction.
 */
import type { Request, Response } from "express";

const GITHUB_REPO = "Marc-Weibel-Consulting-GmbH/Portfoliomanager";
const SCORE_THRESHOLD = 8;
/** Max characters of article text passed to LLM to stay within token budget */
const MAX_ARTICLE_CHARS = 6000;

interface LLMEnrichment {
  affectedEngine: string;
  hypothesis: string;
  expectedEffect: string;
  confidence: number;
  preregisteredThreshold: string;
}

/**
 * Fetches the full text of an article via Firecrawl.
 * Returns null if Firecrawl is not configured, the URL is missing, or extraction fails.
 */
async function fetchArticleText(url: string | null): Promise<string | null> {
  if (!url) return null;
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) {
    console.warn("[researchGithubIssue] FIRECRAWL_API_KEY not set — skipping article extraction");
    return null;
  }
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 20000,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      console.warn(`[researchGithubIssue] Firecrawl ${response.status} for ${url}`);
      return null;
    }
    const data = (await response.json()) as { success?: boolean; data?: { markdown?: string } };
    if (!data.success || !data.data?.markdown) return null;
    const text = data.data.markdown.trim();
    // Truncate to budget
    return text.length > MAX_ARTICLE_CHARS ? text.slice(0, MAX_ARTICLE_CHARS) + "\n\n[...truncated]" : text;
  } catch (err: any) {
    console.warn(`[researchGithubIssue] Firecrawl error for ${url}: ${err?.message}`);
    return null;
  }
}

async function enrichWithLLM(
  signal: {
    title: string;
    url: string | null;
    sourceName: string | null;
    topics: unknown;
    contentType: string | null;
    evidenceType: string | null;
    relevanceScore: number | null;
  },
  articleText: string | null
): Promise<LLMEnrichment> {
  try {
    const { invokeLLM } = await import("../_core/llm");
    const topics = Array.isArray(signal.topics) ? (signal.topics as string[]).join(", ") : "–";

    const systemPrompt = `Du bist ein quantitativer Analyst für einen Schweizer Aktien-Portfoliomanager.
Der Algorithmus besteht aus diesen Engines:
- qualityMomentumEngine: Momentum-Signale (12M, 6M, 3M), Qualitätsfaktoren (ROE, Marge, Wachstum)
- algoBacktestEngine: Backtesting, Regime-Checks, OOS-Validierung
- regimeEngine: Marktregime-Erkennung (Bull/Bear/Crisis/Recovery)
- performanceEngine: Portfolio-Performance, Sharpe, Drawdown, Attribution
- scoringEngine: Kombinierter Score aus Momentum + Qualität + Sentiment

Antworte NUR mit einem JSON-Objekt, keine Erklärung.`;

    const articleSection = articleText
      ? `\n\n### Artikel-Volltext (Auszug)\n${articleText}`
      : "";

    const userPrompt = `Analysiere diesen Research-Artikel und erstelle eine konkrete Forschungshypothese:

Titel: "${signal.title}"
Quelle: ${signal.sourceName ?? "–"}
Tags: ${topics}
Typ: ${signal.contentType ?? "–"} / ${signal.evidenceType ?? "–"}
Score: ${signal.relevanceScore}/10${articleSection}

Erstelle ein JSON mit diesen Feldern:
{
  "affectedEngine": "Name der betroffenen Engine (eine der oben genannten)",
  "hypothesis": "Konkrete, testbare Hypothese in 1-2 Sätzen (was genau soll implementiert/getestet werden?)",
  "expectedEffect": "Erwarteter quantitativer Effekt (z.B. ΔSharpe +0.15, bessere Regime-Erkennung, etc.)",
  "confidence": <Zahl 1-10, wie zuversichtlich bist du dass die Hypothese im Backtest bestätigt wird>,
  "preregisteredThreshold": "Konkrete Akzeptanzschwelle (z.B. ΔSharpe_netto ≥ +0.1 OOS)"
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "research_enrichment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              affectedEngine: { type: "string" },
              hypothesis: { type: "string" },
              expectedEffect: { type: "string" },
              confidence: { type: "number" },
              preregisteredThreshold: { type: "string" },
            },
            required: ["affectedEngine", "hypothesis", "expectedEffect", "confidence", "preregisteredThreshold"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return parsed as LLMEnrichment;
  } catch (err: any) {
    console.warn(`[researchGithubIssue] LLM enrichment failed: ${err?.message} — using defaults`);
    return {
      affectedEngine: "qualityMomentumEngine",
      hypothesis: "Hypothese konnte nicht automatisch generiert werden. Bitte manuell ausfüllen.",
      expectedEffect: "ΔSharpe_netto ≥ +0.1 (OOS 2020–2024)",
      confidence: 5,
      preregisteredThreshold: "ΔSharpe_netto ≥ +0.1 (OOS 2020–2024, netto 10 bps, robust über ≥ 4 Regime)",
    };
  }
}

function buildIssueBody(
  signal: {
    title: string;
    url: string | null;
    sourceName: string | null;
    sourceCategory: string | null;
    contentType: string | null;
    evidenceType: string | null;
    relevanceScore: number | null;
    topics: unknown;
    signalId: string;
    publishedAt: Date | null;
  },
  enrichment: LLMEnrichment,
  articleExtracted: boolean
): string {
  const topics = Array.isArray(signal.topics) ? (signal.topics as string[]) : [];
  const topicsStr = topics.length > 0 ? topics.join(", ") : "–";
  const publishedStr = signal.publishedAt
    ? signal.publishedAt.toISOString().slice(0, 10)
    : "–";
  const extractionNote = articleExtracted
    ? " *(Hypothese basiert auf Artikel-Volltext via Firecrawl)*"
    : " *(Hypothese basiert auf Titel + Tags — kein Volltext verfügbar)*";

  return `## Research-Hypothese

> Dieser Issue wurde automatisch aus dem Research Observatory erstellt (Score ${signal.relevanceScore}/10). Hypothese via LLM generiert${extractionNote} — bitte vor dem Triage-Loop prüfen.

### Quelle
- **Titel:** ${signal.title}
- **URL:** ${signal.url ? `[Link](${signal.url})` : "–"}
- **Quelle:** ${signal.sourceName ?? "–"} (${signal.sourceCategory ?? "–"})
- **Typ:** ${signal.contentType ?? "–"} / ${signal.evidenceType ?? "–"}
- **Veröffentlicht:** ${publishedStr}
- **Signal-ID:** \`${signal.signalId}\`

### Tags
${topicsStr}

### Relevanz für unseren Algorithmus
**Betroffene Engine:** \`${enrichment.affectedEngine}\`

### Hypothese (These)
${enrichment.hypothesis}

### Erwarteter Effekt
${enrichment.expectedEffect}

### Pre-registrierte Schwelle
${enrichment.preregisteredThreshold}

### Konfidenz (1-10)
**${enrichment.confidence}/10** *(LLM-Schätzung — bitte anpassen)*

---
*Automatisch erstellt durch Research Observatory Heartbeat (Score ≥ 8). Triage durch Manus erfolgt wöchentlich.*`;
}

export async function handleResearchGithubIssue(req: Request, res: Response) {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return res.status(500).json({ error: "GITHUB_TOKEN not configured" });
    }

    const { getDb } = await import("../db");
    const { researchSignals } = await import("../../drizzle/schema");
    const { isNull, gte, and, eq } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    // Find all signals with score >= 8 and no GitHub issue yet
    const candidates = await db
      .select()
      .from(researchSignals)
      .where(
        and(
          isNull(researchSignals.githubIssueNumber),
          gte(researchSignals.relevanceScore, SCORE_THRESHOLD)
        )
      );

    if (candidates.length === 0) {
      return res.json({ ok: true, created: 0, message: "No new high-score signals to process" });
    }

    console.log(`[researchGithubIssue] Found ${candidates.length} candidate(s) with score >= ${SCORE_THRESHOLD}`);

    let created = 0;
    let failed = 0;
    const results: Array<{ signalId: string; issueNumber?: number; articleExtracted?: boolean; error?: string }> = [];

    for (const signal of candidates) {
      try {
        const topics = Array.isArray(signal.topics) ? (signal.topics as string[]) : [];

        // Step 1: Fetch article full-text via Firecrawl (improves LLM hypothesis quality)
        console.log(`[researchGithubIssue] Fetching article text for "${signal.title}" (${signal.url ?? "no URL"})...`);
        const articleText = await fetchArticleText(signal.url);
        const articleExtracted = articleText !== null;
        if (articleExtracted) {
          console.log(`[researchGithubIssue] Firecrawl extracted ${articleText!.length} chars`);
        }

        // Step 2: LLM enrichment with full article context
        console.log(`[researchGithubIssue] Enriching "${signal.title}" via LLM...`);
        const enrichment = await enrichWithLLM(signal, articleText);

        // Build label list: research, research:new + topic-based algo labels
        const labels = ["research", "research:new"];
        if (topics.some(t => ["momentum", "trend_following", "momentum_in_stocks"].includes(t))) {
          labels.push("algo:momentum_quality");
        }
        if (topics.some(t => ["signals", "factor_investing", "investment_strategy"].includes(t))) {
          labels.push("algo:signals");
        }
        if (topics.some(t => ["regime", "market_regime", "macro"].includes(t))) {
          labels.push("algo:regime");
        }
        if (topics.some(t => ["risk", "portfolio_management", "volatility"].includes(t))) {
          labels.push("algo:risk");
        }
        if (topics.some(t => ["machine_learning", "ml", "ai"].includes(t))) {
          labels.push("algo:ml_feature");
        }
        // Add label based on LLM-detected engine
        if (enrichment.affectedEngine.includes("scoring")) labels.push("algo:scoring");
        if (enrichment.affectedEngine.includes("optimizer")) labels.push("algo:optimizer");

        const issueTitle = `[Research] ${signal.title}`;
        const issueBody = buildIssueBody(signal, enrichment, articleExtracted);

        // Create GitHub issue via REST API
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/issues`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({
              title: issueTitle,
              body: issueBody,
              labels,
            }),
            signal: AbortSignal.timeout(15000),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`GitHub API ${response.status}: ${errText.slice(0, 200)}`);
        }

        const issue = (await response.json()) as { number: number; html_url: string };

        // Store issue number back in DB to prevent duplicates
        await db
          .update(researchSignals)
          .set({ githubIssueNumber: issue.number })
          .where(eq(researchSignals.id, signal.id));

        console.log(`[researchGithubIssue] Created issue #${issue.number} for "${signal.signalId}" (score ${signal.relevanceScore}, confidence ${enrichment.confidence}, firecrawl=${articleExtracted})`);
        results.push({ signalId: signal.signalId, issueNumber: issue.number, articleExtracted });
        created++;

        // Rate limit: 1.5s between issues to avoid GitHub secondary rate limits
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err: any) {
        console.error(`[researchGithubIssue] Failed for "${signal.signalId}":`, err?.message);
        results.push({ signalId: signal.signalId, error: err?.message });
        failed++;
      }
    }

    return res.json({
      ok: true,
      created,
      failed,
      total: candidates.length,
      results,
    });
  } catch (err: any) {
    console.error("[researchGithubIssue] Fatal error:", err);
    return res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
}
