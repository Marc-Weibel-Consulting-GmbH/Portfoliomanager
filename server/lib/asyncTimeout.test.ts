import { describe, expect, it, vi } from "vitest";
import { withTimeout } from "./asyncTimeout";

describe("withTimeout", () => {
  it("lehnt einen hängenden Provideraufruf innerhalb des vereinbarten Zeitbudgets ab", async () => {
    vi.useFakeTimers();
    try {
      const slowProvider = new Promise<string>((resolve) => {
        setTimeout(() => resolve("zu spät"), 50);
      });
      const bounded = withTimeout(slowProvider, 10, "Copilot-Antwort hat das Zeitlimit überschritten.");
      const expectation = expect(bounded).rejects.toThrow("Copilot-Antwort hat das Zeitlimit überschritten.");

      await vi.advanceTimersByTimeAsync(50);

      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
