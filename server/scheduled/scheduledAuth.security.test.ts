import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateRequest } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({
  sdk: { authenticateRequest },
}));

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("../_core/researchSignals", () => ({
  refreshResearchSignals: vi.fn().mockResolvedValue(0),
}));

import { handlePortfolioMetricsSnapshot } from "./portfolioMetricsSnapshotScheduled";
import { handleResearchSignalsRefresh } from "./researchSignalsScheduled";
import { handleSignalAlerts } from "./signalAlertsScheduled";

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

describe("scheduled endpoint authentication", () => {
  beforeEach(() => {
    authenticateRequest.mockResolvedValue({ id: 42, role: "admin", isCron: false });
  });

  it.each([
    ["portfolio metrics snapshots", handlePortfolioMetricsSnapshot],
    ["research signals refresh", handleResearchSignalsRefresh],
    ["signal alerts", handleSignalAlerts],
  ])("rejects a non-cron caller before running %s", async (_name, handler) => {
    const { response, state } = responseRecorder();
    await handler({ query: {}, body: {} } as never, response as never);
    expect(state.statusCode).toBe(403);
    expect(state.body).toEqual({ error: "cron-only" });
  });
});
