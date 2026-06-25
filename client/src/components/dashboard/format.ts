// Number formatters — match the patterns already used in UserDashboard.tsx
// so the new dashboard reads consistently with the rest of the app.

export const formatCHF = (value: number | undefined | null, decimals = 0) => {
  const v = typeof value === 'number' && isFinite(value) ? value : 0;
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
};

export const formatPercent = (value: number | undefined | null, decimals = 2) => {
  const v = typeof value === 'number' && isFinite(value) ? value : 0;
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
};

export const formatNumber = (value: number | undefined | null, decimals = 0) => {
  const v = typeof value === 'number' && isFinite(value) ? value : 0;
  return new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
};

export const formatDate = (date: Date = new Date()) =>
  date.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// Stable sector colors — used by allocation card, treemap labels, etc.
// Server may override per-holding via `color` field; this is the fallback.
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
