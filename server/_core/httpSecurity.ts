import type { Response } from "express";

const PRODUCTION_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
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
