/**
 * Entitlements-Layer (Audit K-A1) — eine Wahrheit pro Berechtigung.
 *
 * Vorher wurde die «Premium»-Paywall nirgends durchgesetzt: `hasPaid` wurde nur
 * im Admin-Zähler gelesen, jeder Free-Nutzer hatte vollen Zugriff. Dieser Layer
 * bündelt Plan-Limits und Feature-Freigaben an EINER Stelle und wird an den
 * tRPC-Prozeduren erzwungen.
 *
 * Soft-Launch: `ENFORCE_PAYWALL` (Env) steuert die Durchsetzung.
 *  - nicht gesetzt / "false" (Default): requireFeature/checkLimit sind No-ops —
 *    das Verhalten bleibt exakt wie heute (kein bestehender Nutzer wird gesperrt),
 *    bis Stripe live ist und der Schalter umgelegt wird.
 *  - "true": Limits/Features werden erzwungen.
 *
 * Grandfathering (Migration 0035): hasPaid=1 → plan="plus".
 * Admin-Konten haben immer Pro-Rechte.
 */
import { TRPCError } from "@trpc/server";

export type Plan = "free" | "plus" | "pro";
export type Feature =
  | "realtime_prices"      // Echtzeit-Kurse (sonst verzögert)
  | "performance_metrics"  // TTWROR/IRR
  | "auto_portfolio"       // KI-Auto-Portfolio-Vorschlag (buildProposal)
  | "optimizer"            // Portfolio-Optimierung (analytics.optimize)
  | "optimizer_exact"      // exakter Optimierer + Sektor-Caps (PyPortfolioOpt, Pro)
  | "challenge_report"     // Multi-Agent-Challenge-Report (Pro)
  | "tax_report"           // Steuer-Reporting
  | "dividend_tracking";   // Dividenden-Kalender & -Tracking

export interface PlanLimits {
  portfolios: number;          // Anzahl Live-Portfolios (Infinity = unbegrenzt)
  priceAlerts: number;
  copilotQuestionsPerMonth: number;
  features: ReadonlySet<Feature>;
}

const F = (...f: Feature[]) => new Set<Feature>(f);

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    portfolios: 1,
    priceAlerts: 3,
    copilotQuestionsPerMonth: 5,
    features: F(),
  },
  plus: {
    portfolios: 3,
    priceAlerts: 25,
    copilotQuestionsPerMonth: 100,
    features: F("realtime_prices", "performance_metrics", "auto_portfolio", "optimizer", "tax_report", "dividend_tracking"),
  },
  pro: {
    portfolios: Infinity,
    priceAlerts: Infinity,
    copilotQuestionsPerMonth: Infinity,
    features: F("realtime_prices", "performance_metrics", "auto_portfolio", "optimizer", "optimizer_exact", "challenge_report", "tax_report", "dividend_tracking"),
  },
};

// Anzeigenamen der Stufen. Der DB-Enum-Wert bleibt "plus" (keine Migration),
// nach aussen heisst die mittlere Stufe jedoch «Basic».
export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  plus: "Basic",
  pro: "Pro",
};

export function planLabel(plan: Plan): string {
  return PLAN_LABELS[plan] ?? "Free";
}

export function isPaywallEnforced(): boolean {
  return (process.env.ENFORCE_PAYWALL ?? "").toLowerCase() === "true";
}

interface UserCtxLike {
  id: number;
  role?: string | null;
}

// 5-Min-Cache je Nutzer (wie riskFreeRate) — der Plan ändert sich selten.
const cache = new Map<number, { plan: Plan; at: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Effektiver Plan des Nutzers: Admin → pro; sonst users.plan (canceled → free). */
export async function getPlan(user: UserCtxLike): Promise<Plan> {
  if (user.role === "admin") return "pro";
  const hit = cache.get(user.id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.plan;
  let plan: Plan = "free";
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (db) {
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [row] = await db
        .select({ plan: users.plan, planStatus: users.planStatus })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      if (row) plan = row.planStatus === "canceled" ? "free" : ((row.plan as Plan) ?? "free");
    }
  } catch {
    plan = "free";
  }
  cache.set(user.id, { plan, at: Date.now() });
  return plan;
}

export function invalidatePlanCache(userId?: number): void {
  if (userId === undefined) cache.clear();
  else cache.delete(userId);
}

export async function getEntitlements(user: UserCtxLike): Promise<{ plan: Plan; limits: PlanLimits }> {
  const plan = await getPlan(user);
  return { plan, limits: PLAN_LIMITS[plan] };
}

const UPGRADE_HINT = "Diese Funktion ist Teil von Basic/Pro. Jetzt upgraden unter Einstellungen › Abo.";

/**
 * Wirft FORBIDDEN, wenn der Plan die Funktion nicht enthält — es sei denn, die
 * Paywall ist (noch) nicht scharf geschaltet (Soft-Launch).
 */
export async function requireFeature(user: UserCtxLike, feature: Feature): Promise<void> {
  if (!isPaywallEnforced()) return;
  const { limits } = await getEntitlements(user);
  if (!limits.features.has(feature)) {
    throw new TRPCError({ code: "FORBIDDEN", message: UPGRADE_HINT });
  }
}

/**
 * Wirft FORBIDDEN, wenn das Anlegen einer weiteren Ressource das Plan-Limit
 * überschreitet. `currentCount` = bereits vorhandene Anzahl.
 */
export async function checkLimit(
  user: UserCtxLike,
  resource: "portfolios" | "priceAlerts",
  currentCount: number
): Promise<void> {
  if (!isPaywallEnforced()) return;
  const { limits } = await getEntitlements(user);
  const max = limits[resource];
  if (currentCount >= max) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Ihr Plan erlaubt maximal ${max} ${resource === "portfolios" ? "Live-Portfolios" : "Preisalarme"}. ${UPGRADE_HINT}`,
    });
  }
}

/** Reines Prüfen ohne Werfen — für Quota-Zähler (Copilot). true = erlaubt. */
export async function isWithinMonthlyQuota(
  user: UserCtxLike,
  resource: "copilotQuestionsPerMonth",
  usedThisMonth: number
): Promise<boolean> {
  if (!isPaywallEnforced()) return true;
  const { limits } = await getEntitlements(user);
  return usedThisMonth < limits[resource];
}
