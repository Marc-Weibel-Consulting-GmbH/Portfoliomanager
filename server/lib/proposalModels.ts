/**
 * Modellwahl pro Rolle für den KI-Portfolio-Vorschlag.
 *
 * Der Enhancing-Schritt kennt zwei Rollen:
 *  - `analysis`: kritische Prüfung + finale Empfehlung (Challenger + Synthese,
 *    aus Performance-Gründen in einem Aufruf zusammengefasst).
 *  - `text`: die einfachen Titel-Begründungen (positionReasons).
 *
 * Welcher Anbieter je Rolle zum Einsatz kommt, ist im Admin konfigurierbar
 * (appSettings-Schlüssel `proposal_agent_models`). So kann für die Analyse der
 * stärkste Reasoner und für die Texte das sprachlich beste Modell gewählt
 * werden. Fällt ein Anbieter aus (fehlender Key, HTTP-Fehler, kaputtes JSON),
 * greift automatisch Kimi als verlässlicher Fallback.
 */

import { invokeKimi, invokeLLM, type JsonSchema } from "../_core/llm";
import { getSecret } from "../_core/secretsManager";

export type ProposalProvider = "kimi" | "gemini" | "claude" | "perplexity" | "groq";
export type ProposalRole = "analysis" | "text";

export interface ProposalModelConfig {
  /** Qualitätsmodus: zwei Challenger parallel → Synthese → Text (statt Ein-Aufruf). */
  ensemble: boolean;
  /** Analyse-Modell; im Ensemble-Modus zugleich Challenger A. */
  analysis: ProposalProvider;
  /** Ensemble: der zweite Challenger (bewusst andere Modell-Familie). */
  challengerB: ProposalProvider;
  /** Ensemble: der Synthesizer, der beide Kritiken abwägt. */
  synthesis: ProposalProvider;
  /** Titel-Texte je Position. Default nicht Kimi (schwach bei deutscher Prosa). */
  text: ProposalProvider;
}

export const DEFAULT_PROPOSAL_MODELS: ProposalModelConfig = {
  ensemble: false,
  analysis: "kimi",
  challengerB: "gemini",
  synthesis: "kimi",
  text: "gemini",
};

export const PROVIDER_LABELS: Record<ProposalProvider, string> = {
  kimi: "Kimi K3 (Moonshot)",
  gemini: "Gemini 2.5 Flash (Manus)",
  claude: "Claude 3.5 Sonnet (Anthropic)",
  perplexity: "Perplexity Sonar",
  groq: "Groq Llama 3.3 70B (gratis)",
};

const VALID_PROVIDERS: ProposalProvider[] = ["kimi", "gemini", "claude", "perplexity", "groq"];

/** Lädt die Rollen-Modell-Konfiguration aus appSettings. Fallback: Defaults. */
export async function getProposalModelConfig(): Promise<ProposalModelConfig> {
  try {
    const { getDb } = await import("../db");
    const { appSettings } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return { ...DEFAULT_PROPOSAL_MODELS };
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "proposal_agent_models"));
    const raw = rows[0]?.value as any;
    const cfg = typeof raw === "string" ? JSON.parse(raw) : raw;
    const pick = (v: any, def: ProposalProvider): ProposalProvider => (VALID_PROVIDERS.includes(v) ? v : def);
    return {
      ensemble: cfg?.ensemble === true,
      analysis: pick(cfg?.analysis, DEFAULT_PROPOSAL_MODELS.analysis),
      challengerB: pick(cfg?.challengerB, DEFAULT_PROPOSAL_MODELS.challengerB),
      synthesis: pick(cfg?.synthesis, DEFAULT_PROPOSAL_MODELS.synthesis),
      text: pick(cfg?.text, DEFAULT_PROPOSAL_MODELS.text),
    };
  } catch {
    return { ...DEFAULT_PROPOSAL_MODELS };
  }
}

/** Erstes balanciertes JSON-Objekt aus einem Freitext extrahieren (String-sicher). */
function extractJson(text: string): any {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("kein JSON gefunden");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return JSON.parse(text.slice(start, i + 1)); }
  }
  throw new Error("JSON unvollständig");
}

async function callKimiJson(system: string, user: string, schema: JsonSchema, maxTokens: number): Promise<any> {
  const res = await invokeKimi({
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    max_tokens: maxTokens,
    response_format: { type: "json_schema", json_schema: schema },
  });
  const content = res.choices[0]?.message?.content as string | undefined;
  return content ? JSON.parse(content) : {};
}

async function callGeminiJson(system: string, user: string, schema: JsonSchema, maxTokens: number): Promise<any> {
  const res = await invokeLLM({
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    max_tokens: maxTokens,
    response_format: { type: "json_schema", json_schema: schema },
  });
  const content = res.choices[0]?.message?.content as string | undefined;
  return content ? extractJson(content) : {};
}

/** Claude/Perplexity haben kein natives json_schema → Schema als Anweisung + Extraktion. */
function jsonInstruction(schema: JsonSchema): string {
  return `\n\nAntworte AUSSCHLIESSLICH mit gültigem JSON, das exakt diesem Schema entspricht (kein Text davor oder danach, keine Markdown-Fences):\n${JSON.stringify(schema.schema)}`;
}

async function callClaudeJson(system: string, user: string, schema: JsonSchema, maxTokens: number): Promise<any> {
  const apiKey = await getSecret("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nicht konfiguriert");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: maxTokens,
      system: system + jsonInstruction(schema),
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return extractJson(data.content?.[0]?.text || "");
}

async function callGroqJson(system: string, user: string, schema: JsonSchema, maxTokens: number): Promise<any> {
  const apiKey = await getSecret("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY nicht konfiguriert");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      // Groq erzwingt gültiges JSON via json_object; das Schema kommt als Anweisung dazu.
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system + jsonInstruction(schema) }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return extractJson(data.choices?.[0]?.message?.content || "");
}

async function callPerplexityJson(system: string, user: string, schema: JsonSchema, maxTokens: number): Promise<any> {
  const apiKey = await getSecret("PERPLEXITY_API_KEY");
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY nicht konfiguriert");
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "sonar-pro",
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system + jsonInstruction(schema) }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return extractJson(data.choices?.[0]?.message?.content || "");
}

export interface ProposalAgentArgs {
  system: string;
  user: string;
  schema: JsonSchema;
  maxTokens?: number;
}

export interface ProposalAgentOutcome {
  result: any;
  providerUsed: ProposalProvider;
}

/**
 * Führt einen Rollen-Aufruf beim gewählten Anbieter aus und liefert das
 * geparste JSON. Bei jedem Fehler (fehlender Key, HTTP, JSON) fällt der Aufruf
 * automatisch auf Kimi zurück — der Enhancing-Schritt bleibt so robust.
 */
export async function invokeProposalAgent(
  provider: ProposalProvider,
  args: ProposalAgentArgs,
): Promise<ProposalAgentOutcome> {
  const maxTokens = args.maxTokens ?? 4096;
  const run = (p: ProposalProvider) => {
    switch (p) {
      case "gemini": return callGeminiJson(args.system, args.user, args.schema, maxTokens);
      case "claude": return callClaudeJson(args.system, args.user, args.schema, maxTokens);
      case "perplexity": return callPerplexityJson(args.system, args.user, args.schema, maxTokens);
      case "groq": return callGroqJson(args.system, args.user, args.schema, maxTokens);
      case "kimi":
      default: return callKimiJson(args.system, args.user, args.schema, maxTokens);
    }
  };
  try {
    return { result: await run(provider), providerUsed: provider };
  } catch (err: any) {
    if (provider === "kimi") throw err;
    console.warn(`[proposalModels] ${provider} fehlgeschlagen (${err?.message}) — Fallback auf Kimi.`);
    return { result: await run("kimi"), providerUsed: "kimi" };
  }
}
