import { describe, expect, it, vi } from "vitest";
import {
  DEEP_DIVE_TIMEOUT_MESSAGE,
  DEEP_DIVE_TIMEOUT_MS,
  withDeepDiveTimeout,
} from "./deepDiveTimeout";

describe("withDeepDiveTimeout", () => {
  it("begrenzt den vollständigen Deep-Dive-Lauf auf 90 Sekunden", () => {
    expect(DEEP_DIVE_TIMEOUT_MS).toBe(90_000);
  });

  it("liefert bei einem hängenden Deep-Dive eine verständliche Zeitlimitmeldung", async () => {
    vi.useFakeTimers();
    try {
      const hangingOperation = new Promise<never>(() => undefined);
      const result = withDeepDiveTimeout(hangingOperation);
      const expectation = expect(result).rejects.toThrow(DEEP_DIVE_TIMEOUT_MESSAGE);

      await vi.advanceTimersByTimeAsync(DEEP_DIVE_TIMEOUT_MS);

      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
