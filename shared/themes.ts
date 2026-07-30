/**
 * Themen-Cluster: Titel, deren Kursentwicklung an derselben Variable hängt,
 * obwohl sie in verschiedenen GICS-Sektoren stehen.
 *
 * Hintergrund: Die Sektor-Obergrenze misst Konzentration entlang der
 * Branchenklassifikation. Die wirtschaftlich relevante Abhängigkeit läuft aber
 * regelmässig quer dazu. Ein Depot mit NVDA (Technology), AVGO
 * (Semiconductors), IREN (Financials laut Klassifikation) und MSTR sieht nach
 * drei Sektoren aus und ist faktisch eine Wette auf das Investitionsbudget
 * einiger weniger Hyperscaler.
 *
 * Genau diese Art Korrelation fällt erst auf, wenn sie getestet wird — bis
 * dahin erscheint das Depot diversifiziert.
 *
 * ABGRENZUNG: Diese Liste ist eine Konzentrations-Warnung, KEINE Bewertung.
 * Sie sagt nichts darüber, ob ein Thema attraktiv ist, sondern nur, dass die
 * enthaltenen Titel gemeinsam steigen und fallen. Bewusst kurz gehalten: nur
 * Cluster, deren gemeinsame Abhängigkeit klar benennbar ist und quer zur
 * Sektorlogik verläuft. Eine lange Liste vager Themen würde die Kennzahl
 * entwerten.
 */

export const THEME_LABELS = {
  ai_infra: "KI-Infrastruktur",
  crypto_proxy: "Krypto-Proxy",
} as const;

export type ThemeKey = keyof typeof THEME_LABELS;

/**
 * Ticker (Grossschreibung) → Thema.
 *
 * ai_infra: Umsatz hängt überwiegend am Investitionsbudget der Hyperscaler —
 * Chips, Netzwerk, Strom und Rechenzentrums-Betreiber gleichermassen.
 *
 * crypto_proxy: Aktien, die faktisch als gehebelter Zugang zum Kryptomarkt
 * gehalten werden. Der Kryptopreis dominiert dort den Kurs, nicht das
 * operative Geschäft.
 */
export const THEME_BY_TICKER: Record<string, ThemeKey> = {
  // ── KI-Infrastruktur ───────────────────────────────────────────────
  NVDA: "ai_infra",
  AVGO: "ai_infra",
  AMD: "ai_infra",
  MU: "ai_infra",
  MRVL: "ai_infra",
  ARM: "ai_infra",
  TSM: "ai_infra",
  ANET: "ai_infra",
  SMCI: "ai_infra",
  VRT: "ai_infra",
  CRDO: "ai_infra",
  ORCL: "ai_infra",
  CRWV: "ai_infra",
  IREN: "ai_infra",
  APLD: "ai_infra",
  NBIS: "ai_infra",

  // ── Krypto-Proxy ───────────────────────────────────────────────────
  MSTR: "crypto_proxy",
  COIN: "crypto_proxy",
  MARA: "crypto_proxy",
  RIOT: "crypto_proxy",
  CLSK: "crypto_proxy",
  CIFR: "crypto_proxy",
  WULF: "crypto_proxy",
  HUT: "crypto_proxy",
};

/** Thema eines Tickers, oder null. Schreibweise egal. */
export function themeOfTicker(ticker: string | null | undefined): ThemeKey | null {
  if (!ticker) return null;
  return THEME_BY_TICKER[String(ticker).toUpperCase()] ?? null;
}
