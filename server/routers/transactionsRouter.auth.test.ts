import { describe, expect, it } from "vitest";
import type { User } from "../../drizzle/schema";
import { appRouter } from "../routers";

function callerFor(user: User | null) {
  return appRouter.createCaller({
    user,
    req: {} as never,
    res: {} as never,
  });
}

describe("globales Transaktions-Auditlog", () => {
  it("weist anonyme Leser vor einer globalen Datenabfrage ab", async () => {
    await expect(callerFor(null).transactions.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("weist reguläre Nutzer vor Lesen und globalem Löschen ab", async () => {
    const user = { id: 2, role: "user" } as User;
    await expect(callerFor(user).transactions.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(user).transactions.deleteAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
