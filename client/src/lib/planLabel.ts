// Anzeigenamen der Abo-Stufen (Client). Der DB-/API-Wert der mittleren Stufe
// bleibt "plus"; nach aussen heisst sie «Basic». Muss mit server/lib/entitlements.ts
// (PLAN_LABELS) übereinstimmen.
export const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  plus: "Basic",
  pro: "Pro",
};

export function planLabel(plan?: string | null): string {
  return PLAN_LABELS[plan ?? "free"] ?? "Free";
}
