import type { Response } from "express";

const PRODUCTION_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // TradingView-Widgets (Chart & TA der Titelseite, Markt-Hub, Ticker-Tape):
  // Das Loader-Script kommt von s3.tradingview.com, das Widget selbst läuft
  // danach als iframe von tradingview-widget.com bzw. tradingview.com. Die
  // CSP des Phase-2-Audits (nur 'self') liess seit dem 15.08. jede
  // Einbettung leer (Live-Befund 19.08.) — die Freigabe bleibt bewusst auf
  // genau diese Hosts begrenzt.
  // Manus-Hosting injiziert sein Umami-Analytics (Skript von
  // manus-analytics.com plus ein kleiner Inline-Loader). Der Loader wird
  // NICHT per 'unsafe-inline' freigegeben, sondern exakt über seinen
  // SHA-256-Hash (Live-Befund 20.08., Konsolenmeldung nennt den Hash) —
  // ändert Manus das Snippet, blockt die CSP wieder und der Hash wird
  // nachgeführt.
  "script-src 'self' https://s3.tradingview.com https://manus-analytics.com 'sha256-6Z59t59rp52o8zfsvvsotNda8VkKS1YOhoOYeTzwods='",
  // Inter wird in client/index.html von Google Fonts geladen — Stylesheet von
  // fonts.googleapis.com, Font-Dateien von fonts.gstatic.com.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  // Analytics sendet seine Beacons an manus-analytics.com.
  "connect-src 'self' https://manus-analytics.com",
  "frame-src 'self' https://*.tradingview.com https://*.tradingview-widget.com",
].join("; ");

/** Minimal transport-level hardening that remains compatible with local Vite. */
export function applyHttpSecurityHeaders(res: Pick<Response, "setHeader">, isProduction: boolean): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");

  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    res.setHeader("Content-Security-Policy", PRODUCTION_CSP);
  }
}
