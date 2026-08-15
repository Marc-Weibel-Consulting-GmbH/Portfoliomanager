import { describe, expect, it } from "vitest";
import type { User } from "../../drizzle/schema";
import { kiBoomRouter } from "./kiBoomRouter";

function callerFor(user: User | null) {
  return kiBoomRouter.createCaller({
    user,
    req: {} as never,
    res: {} as never,
  });
}

describe("kiBoomRouter manual trigger authorization", () => {
  it("rejects an anonymous snapshot trigger before any side effect", async () => {
    await expect(callerFor(null).triggerSnapshot()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a fallback admin identity before any side effect", async () => {
    await expect(callerFor({ id: 1, role: "admin" } as User).triggerDynamicFetch()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
