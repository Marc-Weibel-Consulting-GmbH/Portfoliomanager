/**
 * Validates that the deployed analytics_service on Railway is reachable.
 * Uses the hardcoded Railway URL since ANALYTICS_SERVICE_URL env var is
 * intercepted by the sandbox proxy in test environments.
 */
import { describe, it, expect } from "vitest";

// Hardcoded Railway URL — confirmed live via curl before this test was written
const RAILWAY_URL = "https://analytics-service-production-0295.up.railway.app";

describe("Analytics Service Health Check (Railway)", () => {
  it("GET /health returns { status: 'ok' }", async () => {
    const resp = await fetch(`${RAILWAY_URL}/health`);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { status: string; service?: string; version?: string };
    expect(body.status).toBe("ok");
    expect(typeof body.service).toBe("string");
  }, 20_000);
});
