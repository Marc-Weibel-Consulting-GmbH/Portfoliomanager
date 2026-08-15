import { describe, expect, it } from "vitest";
import type { User } from "../../drizzle/schema";
import { portfolioManagementRouter } from "./portfolioManagementRouter";

function callerFor(user: User | null) {
  return portfolioManagementRouter.createCaller({ user, req: {} as never, res: {} as never });
}

describe("Benchmark-Datenpflege", () => {
  const payload = { benchmark: "SMI" as const, date: "2026-08-15", close: "12000" };

  it("weist anonyme Aufrufe vor einem Schreibversuch ab", async () => {
    await expect(callerFor(null).upsertBenchmarkData(payload)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("weist Nicht-Administratoren vor einem Schreibversuch ab", async () => {
    await expect(callerFor({ id: 2, role: "user" } as User).upsertBenchmarkData(payload))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
