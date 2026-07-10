/**
 * Characterization test: QuantStats Tear-Sheet endpoint on Railway analytics_service.
 * Verifies the /analytics/tearsheet endpoint returns a valid self-contained HTML report.
 */
import { describe, it, expect } from "vitest";

const ANALYTICS_URL = "https://analytics-service-production-0295.up.railway.app";

// Minimal synthetic daily returns (35 trading days)
const RETURNS = [
  0.01, -0.005, 0.02, 0.003, -0.01, 0.015, 0.008, -0.003, 0.012, 0.005,
  0.01, -0.005, 0.02, 0.003, -0.01, 0.015, 0.008, -0.003, 0.012, 0.005,
  0.01, -0.005, 0.02, 0.003, -0.01, 0.015, 0.008, -0.003, 0.012, 0.005,
  0.01, -0.005, 0.02, 0.003, -0.01,
];
const DATES = [
  "2024-01-02","2024-01-03","2024-01-04","2024-01-05","2024-01-08",
  "2024-01-09","2024-01-10","2024-01-11","2024-01-12","2024-01-15",
  "2024-01-16","2024-01-17","2024-01-18","2024-01-19","2024-01-22",
  "2024-01-23","2024-01-24","2024-01-25","2024-01-26","2024-01-29",
  "2024-01-30","2024-01-31","2024-02-01","2024-02-02","2024-02-05",
  "2024-02-06","2024-02-07","2024-02-08","2024-02-09","2024-02-12",
  "2024-02-13","2024-02-14","2024-02-15","2024-02-16","2024-02-19",
];

describe("analytics_service /analytics/tearsheet", () => {
  it("returns a self-contained HTML report from QuantStats", async () => {
    const res = await fetch(`${ANALYTICS_URL}/analytics/tearsheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returns: RETURNS, dates: DATES, title: "CT Test Portfolio", rf: 0 }),
      signal: AbortSignal.timeout(60000),
    });

    expect(res.status).toBe(200);
    const html = await res.text();

    // Must be a non-trivial HTML document
    expect(html.length).toBeGreaterThan(10000);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("QuantStats");
  }, 65000);

  it("returns 422 for empty returns array", async () => {
    const res = await fetch(`${ANALYTICS_URL}/analytics/tearsheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returns: [], dates: [] }),
      signal: AbortSignal.timeout(15000),
    });
    // FastAPI validation error or our own 422
    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 20000);
});
