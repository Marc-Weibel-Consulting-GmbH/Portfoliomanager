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

  it("setzt HSTS nur in Produktion", () => {
    const { headers, response } = createResponse();

    applyHttpSecurityHeaders(response, true);

    expect(headers.get("Strict-Transport-Security")).toBe("max-age=15552000; includeSubDomains");
  });
});
