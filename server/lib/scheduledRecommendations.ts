/**
 * Empfehlungs-Generierung nach Kadenz (Track D / P3).
 *
 * Für jedes Portfolio mit gesetzter Kadenz (wöchentlich/monatlich/quartalsweise), dessen
 * nächste Aktualisierung fällig ist, wird eine Transaktions-Empfehlungsliste über die
 * bestehende Copilot-Analyse generiert und im Copilot-Verlauf gespeichert (abrufbar über
 * copilot.getHistory). K5 (design/KONSOLIDIERUNG_RECHENWERKE.md): Der frühere
 * autoExecute-Pfad — echte Transaktionen aus dem portfoliorelativen
 * Copilot-Score — ist entfernt. Empfehlungen werden nur noch gespeichert und
 * gemeldet; umsetzen tut sie der Nutzer im Empfehlungen-Tab.
 *
 * Datenquelle ist ausschliesslich EODHD (siehe copilotHoldings) — kein Yahoo, keine
 * Platzhalter. Titel ohne Kursreihe werden übersprungen statt erfunden.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { portfolioRecommendationConfig, savedPortfolios } from "../../drizzle/schema";
import { isDue, cadenceLabel, type Cadence } from "./recommendationCadence";
import { buildHoldingsEodhd } from "./copilotHoldings";
import { runCopilotAnalysis, type PortfolioHolding, type RebalancingSuggestion } from "../analytics/portfolioCopilot";
import { saveCopilotRecommendations } from "../analytics/copilotHistory";
import { notifyOwner } from "../_core/notification";

/** Mindestlänge der Kursreihe, damit die Analyse ein belastbares Signal liefert. */
const MIN_PRICE_HISTORY = 30;

type DueConfig = { cadence: Cadence; lastGeneratedAt: Date | string | null };

/** Rein & testbar: welche Konfigurationen sind jetzt fällig? */
export function selectDueConfigs<T extends DueConfig>(configs: T[], nowMs: number): T[] {
  return configs.filter((c) => {
    if (c.cadence === "off") return false;
    const lastMs = c.lastGeneratedAt ? new Date(c.lastGeneratedAt).getTime() : null;
    return isDue(c.cadence, lastMs, nowMs);
  });
}

/** RebalancingSuggestion.action → Signal-Enum des Copilot-Verlaufs. */
function actionToSignal(action: RebalancingSuggestion["action"]): "buy" | "sell" | "hold" | "strong_sell" {
  switch (action) {
    case "increase": return "buy";
    case "decrease": return "sell";
    case "exit": return "strong_sell";
    default: return "hold";
  }
}

/** Generiert die Empfehlung für ein einzelnes fälliges Portfolio (nur speichern + melden). */
async function processPortfolio(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  cfg: { portfolioId: number; cadence: Cadence; autoExecute: number },
  nowMs: number
): Promise<void> {
  const rows = await db.select().from(savedPortfolios).where(eq(savedPortfolios.id, cfg.portfolioId)).limit(1);
  const portfolio = rows[0];
  if (!portfolio) return;

  let stocks: Array<{ ticker: string; companyName?: string; name?: string; shares?: number | string; sector?: string }>;
  try {
    const parsed = JSON.parse(portfolio.portfolioData || "{}");
    stocks = Array.isArray(parsed) ? parsed : parsed.stocks || [];
  } catch {
    stocks = [];
  }
  stocks = stocks.filter((s) => s && s.ticker);
  if (stocks.length === 0) return;

  const allHoldings = await buildHoldingsEodhd(stocks);
  const holdings = allHoldings.filter((h) => (h.prices?.length ?? 0) >= MIN_PRICE_HISTORY);
  if (holdings.length === 0) {
    console.warn(`[recommendationCron] Portfolio ${cfg.portfolioId}: keine EODHD-Kursreihen — übersprungen`);
    return;
  }

  const analysis = await runCopilotAnalysis(holdings);
  const suggestions = analysis.rebalancingSuggestions ?? [];

  // Empfehlungsliste im Copilot-Verlauf speichern (abrufbar über copilot.getHistory).
  const recs = suggestions.map((s) => ({
    portfolioId: cfg.portfolioId,
    userId: portfolio.userId,
    ticker: s.ticker,
    companyName: s.companyName || s.ticker,
    signal: actionToSignal(s.action),
    rankScore: 0,
    priceAtSignal: String(byTickerPrice(holdings, s.ticker)),
    currency: holdings.find((h) => h.ticker === s.ticker)?.currency || "CHF",
    targetWeight: String(s.targetWeight),
    currentWeight: String(s.currentWeight),
    source: "copilot_analysis" as const,
  }));
  await saveCopilotRecommendations(recs);

  const actionable = suggestions.filter((s) => s.action !== "hold");
  // K5: keine automatische Ausführung mehr — ein gespeichertes autoExecute-Flag
  // wird bewusst ignoriert (der Copilot-Score ist portfoliorelativ und
  // beschreibend; echte Trades brauchen den Nutzer-Entscheid im Tab).

  await db
    .update(portfolioRecommendationConfig)
    .set({ lastGeneratedAt: new Date(nowMs) })
    .where(eq(portfolioRecommendationConfig.portfolioId, cfg.portfolioId));

  await notifyOwner({
    title: `📋 Empfehlungsliste (${cadenceLabel(cfg.cadence)}): ${portfolio.name}`,
    content:
      `Für Ihr Portfolio «${portfolio.name}» liegt eine neue Transaktions-Empfehlungsliste vor.\n\n` +
      `**Handlungsvorschläge:** ${actionable.length} von ${suggestions.length} Positionen\n` +
      `Öffnen Sie den Empfehlungen-Tab, um die Vorschläge einzeln oder gesamt zu übernehmen.\n`,
  }).catch((e) => console.warn(`[recommendationCron] Benachrichtigung fehlgeschlagen:`, (e as Error).message));

  console.log(
    `[recommendationCron] Portfolio ${cfg.portfolioId}: ${suggestions.length} Empfehlungen gespeichert (keine Auto-Ausführung, K5)`
  );
}

function byTickerPrice(holdings: PortfolioHolding[], ticker: string): number {
  return holdings.find((h) => h.ticker === ticker)?.currentPrice ?? 0;
}

/** Verarbeitet alle jetzt fälligen Portfolios. Rückgabe: Anzahl verarbeiteter Portfolios. */
export async function runDueRecommendations(nowMs: number): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn("[recommendationCron] Keine DB-Verbindung");
    return 0;
  }
  const configs = await db.select().from(portfolioRecommendationConfig);
  const due = selectDueConfigs(
    configs.map((c) => ({ ...c, cadence: c.cadence as Cadence })),
    nowMs
  );
  let processed = 0;
  for (const cfg of due) {
    try {
      await processPortfolio(db, { portfolioId: cfg.portfolioId, cadence: cfg.cadence, autoExecute: cfg.autoExecute }, nowMs);
      processed++;
    } catch (e) {
      console.error(`[recommendationCron] Portfolio ${cfg.portfolioId} fehlgeschlagen:`, (e as Error).message);
    }
  }
  return processed;
}
