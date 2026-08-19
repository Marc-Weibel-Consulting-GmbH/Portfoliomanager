import { describe, expect, it } from "vitest";
import { applyHttpSecurityHeaders } from "./httpSecurity";

function createResponse() {
  const headers = new Map<string, string>();
  return {
    headers,
    response: {
      setHeader(name: string, value: string) {
        headers.set(name, value);
        return this;
      },
    },
  };
}

describe("applyHttpSecurityHeaders", () => {
  it("setzt die grundlegenden Schutzheader in jeder Umgebung", () => {
    const { headers, response } = createResponse();

    applyHttpSecurityHeaders(response, false);

    expect(headers).toMatchObject(new Map([
      ["X-Content-Type-Options", "nosniff"],
      ["X-Frame-Options", "DENY"],
      ["Referrer-Policy", "strict-origin-when-cross-origin"],
      ["Permissions-Policy", "camera=(), geolocation=(), microphone=()"],
    ]));
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });

  it("setzt HSTS und eine produktive CSP nur in Produktion", () => {
    const { headers, response } = createResponse();

    applyHttpSecurityHeaders(response, true);

    expect(headers.get("Strict-Transport-Security")).toBe("max-age=15552000; includeSubDomains");
    expect(headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("img-src 'self' data: blob: https:");
  });

  it("lässt die TradingView-Widgets durch — Loader-Script und Widget-iframe", () => {
    // Die CSP des Phase-2-Audits (nur 'self') liess seit dem 15.08. jede
    // TradingView-Einbettung leer: Das Loader-Script kommt von
    // s3.tradingview.com, das Widget selbst läuft als iframe von
    // tradingview-widget.com (Live-Befund 19.08., Tab «Chart & TA»).
    const { headers, response } = createResponse();

    applyHttpSecurityHeaders(response, true);

    const csp = headers.get("Content-Security-Policy")!;
    expect(csp).toContain("script-src 'self' https://s3.tradingview.com");
    expect(csp).toContain("frame-src 'self' https://*.tradingview.com https://*.tradingview-widget.com");
  });
});
