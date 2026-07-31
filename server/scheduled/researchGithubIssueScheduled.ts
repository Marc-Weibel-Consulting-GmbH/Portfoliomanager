/**
 * Research → GitHub Issue Scheduled Handler
 *
 * Triggered daily via Heartbeat cron (09:00 UTC, after n8n research feed refresh).
 * Finds all research_signals with relevanceScore >= 7 and githubIssueNumber IS NULL,
 * creates a [Research] GitHub Issue for each, and stores the issue number back in the DB.
 *
 * Requires GITHUB_TOKEN env variable with repo scope.
 */
import type { Request, Response } from "express";

const GITHUB_REPO = "Marc-Weibel-Consulting-GmbH/Portfoliomanager";
const SCORE_THRESHOLD = 7;

function buildIssueBody(signal: {
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
}): string {
  const topics = Array.isArray(signal.topics) ? (signal.topics as string[]) : [];
  const topicsStr = topics.length > 0 ? topics.join(", ") : "–";
  const publishedStr = signal.publishedAt
    ? signal.publishedAt.toISOString().slice(0, 10)
    : "–";

  return `## Research-Hypothese

> Dieser Issue wurde automatisch aus dem Research Observatory erstellt (Score ${signal.relevanceScore}/10).

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
<!-- Bitte ausfüllen: Welche Engine ist betroffen? qualityMomentumEngine / algoBacktestEngine / regimeEngine / performanceEngine? -->

### Hypothese (These)
<!-- Bitte ausfüllen: Was genau soll getestet werden? -->

### Erwarteter Effekt
<!-- Bitte ausfüllen: Welche Verbesserung wird erwartet? ΔSharpe ≥ ? -->

### Pre-registrierte Schwelle
- ΔSharpe_netto ≥ +0.1 (OOS 2020–2024, netto 10 bps, robust über ≥ 4 Regime)

### Konfidenz (1-10)
<!-- Bitte ausfüllen: 1-10 -->

---
*Automatisch erstellt durch Research Observatory Heartbeat. Triage durch Manus erfolgt wöchentlich.*`;
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

    // Find all signals with score >= 7 and no GitHub issue yet
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
    const results: Array<{ signalId: string; issueNumber?: number; error?: string }> = [];

    for (const signal of candidates) {
      try {
        const topics = Array.isArray(signal.topics) ? (signal.topics as string[]) : [];

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

        const issueTitle = `[Research] ${signal.title}`;
        const issueBody = buildIssueBody(signal);

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

        console.log(`[researchGithubIssue] Created issue #${issue.number} for "${signal.signalId}" (score ${signal.relevanceScore})`);
        results.push({ signalId: signal.signalId, issueNumber: issue.number });
        created++;

        // Rate limit: 1 issue per second to avoid GitHub secondary rate limits
        await new Promise((r) => setTimeout(r, 1200));
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
