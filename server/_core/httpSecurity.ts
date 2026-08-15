import type { Response } from "express";

/**
 * Minimal transport-level hardening that is safe for the current Vite and
 * reverse-proxy deployment. A restrictive CSP remains intentionally separate:
 * it requires a verified inventory of script, font and API origins first.
 */
export function applyHttpSecurityHeaders(res: Pick<Response, "setHeader">, isProduction: boolean): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");

  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
}
