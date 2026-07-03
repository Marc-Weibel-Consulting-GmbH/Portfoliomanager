// Zentrale Zahlen- & Datumsformatierung (D-06) — einzige Quelle für die
// Schweizer Konvention: CHF-Präfix, Apostroph als Tausendertrennzeichen
// («CHF 1'234.56»), definierte Dezimalstellen.
//
// G-01: Negative Beträge tragen IMMER ein echtes Minuszeichen (kommt von
// Intl mit) — niemals Math.abs() + Farbe als einzige Unterscheidung.

export interface CurrencyFormatOptions {
  /** Anzahl Dezimalstellen (min = max). Default 2. */
  decimals?: number;
  /** Intl signDisplay, z. B. 'always' für explizites «+» bei Gewinnen. */
  signDisplay?: "auto" | "always" | "never" | "exceptZero";
}

const safe = (value: number | undefined | null) =>
  typeof value === "number" && isFinite(value) ? value : 0;

export const formatCurrency = (
  value: number | undefined | null,
  currency = "CHF",
  { decimals = 2, signDisplay = "auto" }: CurrencyFormatOptions = {},
) =>
  new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay,
  }).format(safe(value));

export const formatCHF = (
  value: number | undefined | null,
  options: CurrencyFormatOptions = {},
) => formatCurrency(value, "CHF", options);

export const formatPercent = (
  value: number | undefined | null,
  { decimals = 2, signed = true }: { decimals?: number; signed?: boolean } = {},
) => {
  const v = safe(value);
  const sign = signed && v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
};

export const formatNumber = (
  value: number | undefined | null,
  { decimals = 0 }: { decimals?: number } = {},
) =>
  new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe(value));

export const formatDate = (
  date: Date | string = new Date(),
  { withTime = false }: { withTime?: boolean } = {},
) =>
  new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
  });

// ── Farbpaletten ─────────────────────────────────────────────────────────────
// Bleiben vorerst hier (D-07 zentralisiert die Paletten in einem späteren
// Block). Server darf per Holding via `color`-Feld überschreiben; das hier
// ist der Fallback.

export const SECTOR_COLOR: Record<string, string> = {
  "Healthcare":        "#3B82F6",
  "Tech":              "#22D3EE",
  "Technology":        "#22D3EE",
  "Financials":        "#A78BFA",
  "Consumer Staples":  "#7BA66C",
  "Consumer Cyclical": "#F472B6",
  "Industrials":       "#F59E0B",
  "Materials":         "#F472B6",
  "Energy":            "#FB923C",
  "Utilities":         "#94A3B8",
  "Real Estate":       "#FCD34D",
  "Communication":     "#C084FC",
  "Cash":              "#475569",
};

export const REGION_COLOR: Record<string, string> = {
  "Schweiz": "#00CFC1",
  "CH":      "#00CFC1",
  "USA":     "#A78BFA",
  "US":      "#A78BFA",
  "Europa":  "#F59E0B",
  "EU":      "#F59E0B",
  "Other":   "#94A3B8",
  "Cash":    "#475569",
};
