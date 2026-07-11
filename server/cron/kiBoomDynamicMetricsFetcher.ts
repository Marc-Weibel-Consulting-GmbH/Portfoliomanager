/**
 * kiBoomDynamicMetricsFetcher.ts
 *
 * Ruft via Perplexity Sonar-Pro aktuelle KI-Boom-Metriken ab und speichert
 * sie in der Tabelle `ki_boom_dynamic_metrics`. Die Werte werden täglich
 * aktualisiert und dienen als Ersatz für die statischen STATIC_METRICS in
 * kiBoomRouter.ts.
 *
 * Metriken:
 *   openai_valuation       — OpenAI-Bewertung (Mrd. USD)
 *   openai_revenue         — OpenAI-Jahresumsatz (Mrd. USD)
 *   openai_loss_rate       — OpenAI-Verlustquote (%)
 *   hyperscaler_capex_yoy  — Hyperscaler CapEx-Wachstum YoY (%)
 *   hyperscaler_capex_abs  — Hyperscaler CapEx absolut (Mrd. USD)
 *   vc_ai_share            — VC-Anteil KI-Startups (%)
 *   vc_total_volume        — VC-Gesamtvolumen (Mrd. USD)
 *   ai_roi_success_rate    — KI-Pilotprojekte ROI-Erfolgsquote (%)
 */

import { getDb } from "../db";
import { kiBoomDynamicMetrics } from "../../drizzle/schema";
import { getSecret } from "../_core/secretsManager";
import { desc, eq } from "drizzle-orm";

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface DynamicMetricResult {
  metricKey: string;
  numericValue: number | null;
  displayValue: string;
  unit: string;
  source: string;
  description: string;
}

// ── Perplexity-Abfrage ────────────────────────────────────────────────────────

async function queryPerplexity(prompt: string): Promise<string> {
  const apiKey = await getSecret("PERPLEXITY_API_KEY");
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY nicht konfiguriert");

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content:
            "You are a financial data assistant. Answer ONLY with a valid JSON object. No markdown, no explanation, just raw JSON.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1024,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ── Einzelne Metrik-Abfragen ──────────────────────────────────────────────────

async function fetchOpenAiMetrics(): Promise<DynamicMetricResult[]> {
  const prompt = `Search the web for the most recent data (2024 or 2025) about OpenAI's company valuation, annual revenue, and loss/burn rate.
Return a JSON object with these exact keys:
{
  "valuation_bn_usd": <number, valuation in billions USD>,
  "revenue_bn_usd": <number, annual revenue in billions USD>,
  "loss_rate_pct": <number, losses as % of revenue>,
  "source": "<source name and date, e.g. 'WSJ, June 2025'>",
  "notes": "<brief context>"
}
Use the most recent publicly available figures. If exact data is unavailable, use best estimates from credible sources.`;

  try {
    const raw = await queryPerplexity(prompt);
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const parsed = JSON.parse(jsonMatch[0]);

    const valuation = typeof parsed.valuation_bn_usd === "number" ? parsed.valuation_bn_usd : null;
    const revenue = typeof parsed.revenue_bn_usd === "number" ? parsed.revenue_bn_usd : null;
    const lossRate = typeof parsed.loss_rate_pct === "number" ? parsed.loss_rate_pct : null;
    const source = parsed.source ?? "Perplexity Sonar-Pro";

    const results: DynamicMetricResult[] = [];

    if (valuation !== null) {
      results.push({
        metricKey: "openai_valuation",
        numericValue: valuation,
        displayValue: `${valuation.toFixed(0)} Mrd. USD`,
        unit: "Mrd. USD",
        source,
        description: parsed.notes ?? `OpenAI-Bewertung: ${valuation.toFixed(0)} Mrd. USD (${source})`,
      });
    }

    if (revenue !== null) {
      results.push({
        metricKey: "openai_revenue",
        numericValue: revenue,
        displayValue: `${revenue.toFixed(1)} Mrd. USD`,
        unit: "Mrd. USD",
        source,
        description: `OpenAI-Jahresumsatz: ${revenue.toFixed(1)} Mrd. USD (${source})`,
      });
    }

    if (lossRate !== null) {
      results.push({
        metricKey: "openai_loss_rate",
        numericValue: lossRate,
        displayValue: `${lossRate.toFixed(0)}%`,
        unit: "%",
        source,
        description: `OpenAI-Verlustquote: ${lossRate.toFixed(0)}% des Umsatzes (${source})`,
      });
    }

    return results;
  } catch (e) {
    console.warn("[kiBoomDynamicMetrics] OpenAI metrics fetch failed:", (e as Error).message);
    return [];
  }
}

async function fetchHyperscalerCapex(): Promise<DynamicMetricResult[]> {
  const prompt = `Search the web for the most recent data (2024 or 2025) about combined capital expenditure (CapEx) plans of the four major hyperscalers: Amazon (AWS), Google (Alphabet), Microsoft, and Meta for AI infrastructure.
Return a JSON object with these exact keys:
{
  "capex_total_bn_usd": <number, combined CapEx in billions USD for the most recent full year or announced plan>,
  "capex_yoy_growth_pct": <number, year-over-year growth percentage>,
  "year": "<year or period, e.g. '2025' or '2025E'>",
  "source": "<source name and date>",
  "notes": "<brief context>"
}`;

  try {
    const raw = await queryPerplexity(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const parsed = JSON.parse(jsonMatch[0]);

    const capexTotal = typeof parsed.capex_total_bn_usd === "number" ? parsed.capex_total_bn_usd : null;
    const capexYoy = typeof parsed.capex_yoy_growth_pct === "number" ? parsed.capex_yoy_growth_pct : null;
    const source = parsed.source ?? "Perplexity Sonar-Pro";
    const year = parsed.year ?? "2025";

    const results: DynamicMetricResult[] = [];

    if (capexTotal !== null) {
      results.push({
        metricKey: "hyperscaler_capex_abs",
        numericValue: capexTotal,
        displayValue: `${capexTotal.toFixed(0)} Mrd. USD`,
        unit: "Mrd. USD",
        source,
        description: `Hyperscaler CapEx ${year}: ${capexTotal.toFixed(0)} Mrd. USD (Amazon, Google, Microsoft, Meta) — ${source}`,
      });
    }

    if (capexYoy !== null) {
      results.push({
        metricKey: "hyperscaler_capex_yoy",
        numericValue: capexYoy,
        displayValue: `+${capexYoy.toFixed(0)}% YoY`,
        unit: "%",
        source,
        description: `Hyperscaler CapEx-Wachstum ${year}: +${capexYoy.toFixed(0)}% YoY — ${parsed.notes ?? source}`,
      });
    }

    return results;
  } catch (e) {
    console.warn("[kiBoomDynamicMetrics] Hyperscaler CapEx fetch failed:", (e as Error).message);
    return [];
  }
}

async function fetchVcMetrics(): Promise<DynamicMetricResult[]> {
  const prompt = `Search the web for the most recent data (2024 or 2025) about global venture capital investments in AI companies.
Return a JSON object with these exact keys:
{
  "ai_share_pct": <number, percentage of all global VC investments going to AI companies>,
  "total_vc_bn_usd": <number, total global VC investment volume in billions USD>,
  "year": "<year or period>",
  "source": "<source name and date, e.g. 'PitchBook Q3 2025'>",
  "notes": "<brief context>"
}`;

  try {
    const raw = await queryPerplexity(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const parsed = JSON.parse(jsonMatch[0]);

    const aiShare = typeof parsed.ai_share_pct === "number" ? parsed.ai_share_pct : null;
    const totalVc = typeof parsed.total_vc_bn_usd === "number" ? parsed.total_vc_bn_usd : null;
    const source = parsed.source ?? "Perplexity Sonar-Pro";
    const year = parsed.year ?? "2025";

    const results: DynamicMetricResult[] = [];

    if (aiShare !== null) {
      results.push({
        metricKey: "vc_ai_share",
        numericValue: aiShare,
        displayValue: `${aiShare.toFixed(0)}%`,
        unit: "%",
        source,
        description: `${aiShare.toFixed(0)}% aller globalen VC-Investitionen ${year} flossen in KI-Unternehmen (${source})`,
      });
    }

    if (totalVc !== null) {
      results.push({
        metricKey: "vc_total_volume",
        numericValue: totalVc,
        displayValue: `${totalVc.toFixed(1)} Mrd. USD`,
        unit: "Mrd. USD",
        source,
        description: `Globales VC-Gesamtvolumen ${year}: ${totalVc.toFixed(1)} Mrd. USD (${source})`,
      });
    }

    return results;
  } catch (e) {
    console.warn("[kiBoomDynamicMetrics] VC metrics fetch failed:", (e as Error).message);
    return [];
  }
}

async function fetchRoiMetrics(): Promise<DynamicMetricResult[]> {
  const prompt = `Search the web for the most recent data (2024 or 2025) about the percentage of enterprise AI pilot projects that achieve their ROI (return on investment) targets, according to McKinsey, Gartner, or similar research firms.
Return a JSON object with these exact keys:
{
  "roi_success_pct": <number, percentage of AI projects meeting ROI goals>,
  "source": "<source name and date, e.g. 'McKinsey Global Survey 2025'>",
  "notes": "<brief context>"
}`;

  try {
    const raw = await queryPerplexity(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const parsed = JSON.parse(jsonMatch[0]);

    const roiSuccess = typeof parsed.roi_success_pct === "number" ? parsed.roi_success_pct : null;
    const source = parsed.source ?? "Perplexity Sonar-Pro";

    if (roiSuccess === null) return [];

    return [{
      metricKey: "ai_roi_success_rate",
      numericValue: roiSuccess,
      displayValue: `${roiSuccess.toFixed(0)}%`,
      unit: "%",
      source,
      description: `${roiSuccess.toFixed(0)}% der KI-Pilotprojekte erreichen ihre ROI-Ziele (${source})`,
    }];
  } catch (e) {
    console.warn("[kiBoomDynamicMetrics] ROI metrics fetch failed:", (e as Error).message);
    return [];
  }
}

// ── Hauptfunktion: Alle Metriken abrufen und speichern ───────────────────────

export async function fetchAndSaveDynamicMetrics(): Promise<{
  saved: number;
  metrics: DynamicMetricResult[];
  errors: string[];
}> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const errors: string[] = [];
  const allMetrics: DynamicMetricResult[] = [];

  // Alle Metriken parallel abrufen
  const [openAiResults, capexResults, vcResults, roiResults] = await Promise.allSettled([
    fetchOpenAiMetrics(),
    fetchHyperscalerCapex(),
    fetchVcMetrics(),
    fetchRoiMetrics(),
  ]);

  for (const result of [openAiResults, capexResults, vcResults, roiResults]) {
    if (result.status === "fulfilled") {
      allMetrics.push(...result.value);
    } else {
      errors.push(result.reason?.message ?? "Unknown error");
    }
  }

  if (allMetrics.length === 0) {
    return { saved: 0, metrics: [], errors };
  }

  // In DB speichern
  const now = new Date();
  await db.insert(kiBoomDynamicMetrics).values(
    allMetrics.map((m) => ({
      metricKey: m.metricKey,
      numericValue: m.numericValue !== null ? String(m.numericValue) : null,
      displayValue: m.displayValue,
      unit: m.unit,
      source: m.source,
      description: m.description,
      fetchedAt: now,
    }))
  );

  console.log(`[kiBoomDynamicMetrics] Saved ${allMetrics.length} metrics at ${now.toISOString()}`);
  return { saved: allMetrics.length, metrics: allMetrics, errors };
}

// ── Letzten Wert pro Metrik-Key abrufen ───────────────────────────────────────

export async function getLatestDynamicMetrics(): Promise<Record<string, DynamicMetricResult>> {
  const db = await getDb();
  if (!db) return {};

  const METRIC_KEYS = [
    "openai_valuation",
    "openai_revenue",
    "openai_loss_rate",
    "hyperscaler_capex_abs",
    "hyperscaler_capex_yoy",
    "vc_ai_share",
    "vc_total_volume",
    "ai_roi_success_rate",
  ];

  const result: Record<string, DynamicMetricResult> = {};

  // Für jeden Key den neuesten Wert abrufen
  await Promise.allSettled(
    METRIC_KEYS.map(async (key) => {
      const rows = await db
        .select()
        .from(kiBoomDynamicMetrics)
        .where(eq(kiBoomDynamicMetrics.metricKey, key))
        .orderBy(desc(kiBoomDynamicMetrics.fetchedAt))
        .limit(1);

      if (rows.length > 0) {
        const row = rows[0];
        result[key] = {
          metricKey: key,
          numericValue: row.numericValue !== null ? parseFloat(String(row.numericValue)) : null,
          displayValue: row.displayValue ?? "",
          unit: row.unit ?? "",
          source: row.source ?? "",
          description: row.description ?? "",
        };
      }
    })
  );

  return result;
}
