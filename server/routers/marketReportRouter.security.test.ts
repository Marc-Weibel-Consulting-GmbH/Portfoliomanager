import { afterEach, describe, expect, it } from "vitest";
import { handleMarketReportWebhook, isFreshMarketReport, isVisibleReportDate } from "./marketReportRouter";

const originalWebhookKey = process.env.MARKET_REPORT_API_KEY;
const originalJwtSecret = process.env.JWT_SECRET;

function responseRecorder() {
  const state = { statusCode: 200, body: undefined as unknown };
  return {
    state,
    response: {
      status(code: number) {
        state.statusCode = code;
        return this;
      },
      json(body: unknown) {
        state.body = body;
        return this;
      },
    },
  };
}

afterEach(() => {
  process.env.MARKET_REPORT_API_KEY = originalWebhookKey;
  process.env.JWT_SECRET = originalJwtSecret;
});

describe("Market report webhook security", () => {
  it("hides stored reports whose report date lies in the future", () => {
    expect(isVisibleReportDate("2026-08-21", "2026-08-21")).toBe(true);
    expect(isVisibleReportDate("2026-09-05", "2026-08-21")).toBe(false);
  });

  it("hides a report whose source was received more than 36 hours ago", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    expect(isFreshMarketReport(new Date("2026-08-20T00:30:00.000Z"), now)).toBe(true);
    expect(isFreshMarketReport(new Date("2026-08-19T23:59:59.000Z"), now)).toBe(false);
  });

  it("rejects the JWT secret when no dedicated webhook key is configured", async () => {
    delete process.env.MARKET_REPORT_API_KEY;
    process.env.JWT_SECRET = "legacy-jwt-secret";
    const { response, state } = responseRecorder();

    await handleMarketReportWebhook(
      { headers: { "x-api-key": "legacy-jwt-secret" }, body: {} },
      response,
    );

    expect(state.statusCode).toBe(401);
    expect(state.body).toEqual({ error: "Ungültiger API-Key" });
  });

  it("rejects a market report whose report date lies in the future", async () => {
    process.env.MARKET_REPORT_API_KEY = "dedicated-webhook-key";
    const { response, state } = responseRecorder();

    await handleMarketReportWebhook(
      {
        headers: { "x-api-key": "dedicated-webhook-key" },
        body: {
          title: "Future market report",
          content: "Must not become visible as a current report.",
          reportDate: "2099-01-01",
        },
      },
      response,
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({ error: "reportDate darf nicht in der Zukunft liegen" });
  });
});
