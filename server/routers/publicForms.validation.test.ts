import { afterEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../_core/rateLimit";
import { appRouter } from "../routers";

function anonymousCaller() {
  return appRouter.createCaller({
    user: null,
    req: { headers: {}, ip: "198.51.100.10" } as never,
    res: {} as never,
  });
}

afterEach(resetRateLimits);

describe("öffentliche Formulare", () => {
  it("weist ungültige Newsletter-Adressen vor einer Datenbankoperation ab", async () => {
    await expect(anonymousCaller().newsletter.subscribe({ email: "keine-adresse" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("begrenzt Kontaktformulare und akzeptiert keine nicht valide E-Mail-Adresse", async () => {
    await expect(anonymousCaller().contact.send({
      name: "Muster",
      email: "invalid",
      message: "Test",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(anonymousCaller().contact.send({
      name: "Muster",
      email: "muster@example.com",
      message: "x".repeat(5001),
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("begrenzt öffentliche Kontaktanfragen pro IP vor einem weiteren Seiteneffekt", async () => {
    const caller = anonymousCaller();
    const input = { name: "Muster", email: "muster@example.com", message: "Test" };

    await expect(caller.contact.send(input)).resolves.toMatchObject({ success: true });
    await expect(caller.contact.send(input)).resolves.toMatchObject({ success: true });
    await expect(caller.contact.send(input)).resolves.toMatchObject({ success: true });
    await expect(caller.contact.send(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
