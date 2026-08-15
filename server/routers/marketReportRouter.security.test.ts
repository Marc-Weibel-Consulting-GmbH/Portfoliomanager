import { afterEach, describe, expect, it } from "vitest";
import { handleMarketReportWebhook } from "./marketReportRouter";

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
});
