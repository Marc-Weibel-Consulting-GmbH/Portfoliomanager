/**
 * Bridge zum Financial-Datasets-MCP-Service (mcp-servers/financial-datasets).
 *
 * Liefert kompakte, deutschsprachige Fundamentaldaten-Fakten (Umsatztrend,
 * Nettomarge, Free Cash Flow) für LLM-Prompts — Copilot-Chat und das
 * Multi-Agent-Challenge-Layer des Auto-Portfolios.
 *
 * Ehrlichkeits-Grenzen (bewusst):
 *  - Die API deckt primär US-gelistete Titel ab → Nicht-US-Ticker (Suffix
 *    ausser .US) liefern IMMER null; Aufrufer kennzeichnen «nur US-Titel».
 *  - Ohne FINANCIAL_DATASETS_MCP_URL ist alles inaktiv (null, kein Fehler).
 *  - Jeder Abruf ist zeitbegrenzt und non-fatal — die Anreicherung darf den
 *    tragenden Pfad (Chat/Vorschlag) nie zum Scheitern bringen.
 */

const MCP_BASE = process.env.FINANCIAL_DATASETS_MCP_URL?.replace(/\/$/, "") ?? "";

export function isFinancialDatasetsConfigured(): boolean {
  return MCP_BASE.length > 0;
}

/**
 * App-Ticker → Financial-Datasets-Ticker (nur US-Titel).
 * "AAPL" → "AAPL", "AAPL.US" → "AAPL", "NESN.SW"/"DGE.L"/… → null.
 */
export function toUsTicker(ticker: string): string | null {
  const t = (ticker || "").trim().toUpperCase();
  if (!t) return null;
  if (!t.includes(".")) return t;
  if (t.endsWith(".US")) return t.slice(0, -3);
  return null;
}

// ── MCP-Protokoll (Streamable HTTP, identisches Muster wie tradingview.ts) ────

async function mcpInit(): Promise<string> {
  const res = await fetch(`${MCP_BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "portfolio-app", version: "1.0" },
      },
    }),
  });
  const sessionId = res.headers.get("mcp-session-id") ?? res.headers.get("Mcp-Session-Id");
  if (!sessionId) throw new Error("Financial-Datasets-MCP: keine Session-ID erhalten");

  fetch(`${MCP_BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
  }).catch(() => {});

  return sessionId;
}

async function mcpCallTool<T = unknown>(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${MCP_BASE}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Mcp-Session-Id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const json = JSON.parse(line.slice(6));
      if (json.error) throw new Error(`MCP tool "${toolName}": ${JSON.stringify(json.error)}`);
      // FastMCP liefert dict-Ergebnisse als JSON-Text in content[0].text
      // (neuere SDKs zusätzlich als structuredContent).
      const structured = json.result?.structuredContent;
      if (structured !== undefined) return structured as T;
      const raw = json.result?.content?.[0]?.text;
      if (raw === undefined) continue;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
    throw new Error(`MCP tool "${toolName}": keine Antwort im Stream`);
  } finally {
    clearTimeout(timer);
  }
}

// ── Zusammenfassung (pur, unit-getestet) ──────────────────────────────────────

interface StatementRow {
  [key: string]: unknown;
}

function num(row: StatementRow, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    const n = typeof v === "number" ? v : v != null ? parseFloat(String(v)) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function fmtBillions(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)} Mrd.`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(0)} Mio.`;
  return v.toFixed(0);
}

export interface FundamentalsFacts {
  ticker: string;
  /** Kompakte deutsche Fakten-Zeile für LLM-Prompts. */
  summary: string;
  revenueYoYPct: number | null;
  netMarginPct: number | null;
  freeCashFlow: number | null;
  fcfYoYPct: number | null;
}

/**
 * Verdichtet Income- und Cashflow-Statements (neueste zuerst ODER älteste
 * zuerst — wird intern normalisiert) zu einer Fakten-Zeile. Pur und
 * deterministisch; fehlende Felder degradieren zu «—».
 */
export function summarizeFundamentals(
  ticker: string,
  incomeRows: StatementRow[],
  cashflowRows: StatementRow[]
): FundamentalsFacts | null {
  const byPeriodDesc = (rows: StatementRow[]) =>
    [...rows].sort((a, b) =>
      String(b.report_period ?? b.reportPeriod ?? "").localeCompare(String(a.report_period ?? a.reportPeriod ?? ""))
    );
  const income = byPeriodDesc(incomeRows ?? []);
  const cashflow = byPeriodDesc(cashflowRows ?? []);
  if (income.length === 0 && cashflow.length === 0) return null;

  const rev0 = income[0] ? num(income[0], "revenue", "total_revenue") : null;
  const rev1 = income[1] ? num(income[1], "revenue", "total_revenue") : null;
  const net0 = income[0] ? num(income[0], "net_income", "netIncome") : null;
  const fcf0 = cashflow[0] ? num(cashflow[0], "free_cash_flow", "freeCashFlow") : null;
  const fcf1 = cashflow[1] ? num(cashflow[1], "free_cash_flow", "freeCashFlow") : null;

  const revenueYoYPct = rev0 !== null && rev1 !== null && rev1 !== 0
    ? Math.round(((rev0 - rev1) / Math.abs(rev1)) * 1000) / 10
    : null;
  const netMarginPct = rev0 !== null && rev0 !== 0 && net0 !== null
    ? Math.round((net0 / rev0) * 1000) / 10
    : null;
  const fcfYoYPct = fcf0 !== null && fcf1 !== null && fcf1 !== 0
    ? Math.round(((fcf0 - fcf1) / Math.abs(fcf1)) * 1000) / 10
    : null;

  const parts: string[] = [];
  if (rev0 !== null) {
    parts.push(`Umsatz ${fmtBillions(rev0)}${revenueYoYPct !== null ? ` (${revenueYoYPct >= 0 ? "+" : ""}${revenueYoYPct}% YoY)` : ""}`);
  }
  if (netMarginPct !== null) parts.push(`Nettomarge ${netMarginPct}%`);
  if (fcf0 !== null) {
    parts.push(`Free Cash Flow ${fmtBillions(fcf0)}${fcfYoYPct !== null ? ` (${fcfYoYPct >= 0 ? "+" : ""}${fcfYoYPct}% YoY)` : ""}`);
  }
  if (parts.length === 0) return null;

  return {
    ticker,
    summary: `${ticker}: ${parts.join(" · ")} (letztes Geschäftsjahr, Financial Datasets)`,
    revenueYoYPct,
    netMarginPct,
    freeCashFlow: fcf0,
    fcfYoYPct,
  };
}

// ── Öffentliche Abruf-Helfer (non-fatal) ──────────────────────────────────────

/**
 * Fundamentaldaten-Fakten für EINEN Titel — null bei Nicht-US-Ticker,
 * fehlender Konfiguration, Timeout oder API-Fehler (nie werfen).
 */
export async function getFundamentalsFacts(
  ticker: string,
  timeoutMs = 8_000
): Promise<FundamentalsFacts | null> {
  if (!isFinancialDatasetsConfigured()) return null;
  const usTicker = toUsTicker(ticker);
  if (!usTicker) return null;

  try {
    const sessionId = await mcpInit();
    const [incomeRes, cashflowRes] = await Promise.all([
      mcpCallTool<any>(sessionId, "get_income_statements", { ticker: usTicker, period: "annual", limit: 2 }, timeoutMs),
      mcpCallTool<any>(sessionId, "get_cash_flow_statements", { ticker: usTicker, period: "annual", limit: 2 }, timeoutMs),
    ]);
    const incomeRows = incomeRes?.income_statements ?? (Array.isArray(incomeRes) ? incomeRes : []);
    const cashflowRows = cashflowRes?.cash_flow_statements ?? (Array.isArray(cashflowRes) ? cashflowRes : []);
    return summarizeFundamentals(usTicker, incomeRows, cashflowRows);
  } catch (e) {
    console.warn(`[financialDatasets] Fakten für ${ticker} nicht verfügbar:`, (e as Error).message);
    return null;
  }
}

/**
 * Fakten für mehrere Titel (nur US-Ticker werden abgefragt, max. `maxTickers`).
 * Gesamtzeit begrenzt; Ausfälle einzelner Titel sind still (Ergebnis fehlt).
 */
export async function getFundamentalsFactsBatch(
  tickers: string[],
  maxTickers = 5,
  timeoutMs = 8_000
): Promise<FundamentalsFacts[]> {
  if (!isFinancialDatasetsConfigured()) return [];
  const usTickers = tickers.map(toUsTicker).filter((t): t is string => t !== null).slice(0, maxTickers);
  if (usTickers.length === 0) return [];
  const results = await Promise.allSettled(usTickers.map((t) => getFundamentalsFacts(t, timeoutMs)));
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((f): f is FundamentalsFacts => f !== null);
}
