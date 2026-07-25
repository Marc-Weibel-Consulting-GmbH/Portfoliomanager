// Client-Spiegel der Feature-Freigaben (server/lib/entitlements.ts).
// Nur zur Anzeige: welche Stufe schaltet ein Feature frei und wie heisst es.
// Die eigentliche Durchsetzung bleibt serverseitig (requireFeature).
export type Feature =
  | "realtime_prices"
  | "performance_metrics"
  | "auto_portfolio"
  | "optimizer"
  | "optimizer_exact"
  | "challenge_report"
  | "dividend_tracking";

// Mindeststufe, die das Feature freischaltet (DB-Enum-Wert; «plus» = Anzeige «Basic»).
export const FEATURE_MIN_PLAN: Record<Feature, "plus" | "pro"> = {
  realtime_prices: "plus",
  performance_metrics: "plus",
  auto_portfolio: "plus",
  optimizer: "plus",
  dividend_tracking: "plus",
  optimizer_exact: "pro",
  challenge_report: "pro",
};

// Kurze, kundengerechte Bezeichnungen für Teaser-Texte.
export const FEATURE_LABELS: Record<Feature, string> = {
  realtime_prices: "Echtzeit-Kursdaten",
  performance_metrics: "Performance-Kennzahlen (TTWROR/IRR)",
  auto_portfolio: "KI-Auto-Portfolio",
  optimizer: "Portfolio-Optimierung",
  optimizer_exact: "Exakter Optimierer & Sektor-Caps",
  challenge_report: "Multi-Agent-Challenge-Report",
  dividend_tracking: "Dividenden-Kalender & -Tracking",
};
