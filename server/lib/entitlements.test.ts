import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PLAN_LIMITS, requireFeature, checkLimit, isWithinMonthlyQuota, isPaywallEnforced } from "./entitlements";

describe("entitlements — Plan-Limits", () => {
  it("Free < Plus < Pro bei Portfolios/Alarmen/Copilot", () => {
    expect(PLAN_LIMITS.free.portfolios).toBeLessThan(PLAN_LIMITS.plus.portfolios);
    expect(PLAN_LIMITS.plus.portfolios).toBeLessThan(PLAN_LIMITS.pro.portfolios);
    expect(PLAN_LIMITS.pro.portfolios).toBe(Infinity);
    expect(PLAN_LIMITS.free.priceAlerts).toBe(3);
    expect(PLAN_LIMITS.free.copilotQuestionsPerMonth).toBe(5);
  });
  it("Free hat keine Premium-Features, Pro hat alle", () => {
    expect(PLAN_LIMITS.free.features.size).toBe(0);
    expect(PLAN_LIMITS.plus.features.has("auto_portfolio")).toBe(true);
    expect(PLAN_LIMITS.plus.features.has("optimizer_exact")).toBe(false); // nur Pro
    expect(PLAN_LIMITS.pro.features.has("optimizer_exact")).toBe(true);
    expect(PLAN_LIMITS.pro.features.has("challenge_report")).toBe(true);
  });
});

describe("entitlements — Soft-Launch (ENFORCE_PAYWALL)", () => {
  const prev = process.env.ENFORCE_PAYWALL;
  afterEach(() => { if (prev === undefined) delete process.env.ENFORCE_PAYWALL; else process.env.ENFORCE_PAYWALL = prev; });

  it("Default (nicht gesetzt): keine Durchsetzung — Free darf alles", async () => {
    delete process.env.ENFORCE_PAYWALL;
    expect(isPaywallEnforced()).toBe(false);
    // requireFeature/checkLimit sind No-ops → werfen nicht
    await expect(requireFeature({ id: 1 }, "auto_portfolio")).resolves.toBeUndefined();
    await expect(checkLimit({ id: 1 }, "portfolios", 99)).resolves.toBeUndefined();
    expect(await isWithinMonthlyQuota({ id: 1 }, "copilotQuestionsPerMonth", 9999)).toBe(true);
  });

  it("Admin hat immer Pro-Rechte (auch bei scharfer Paywall)", async () => {
    process.env.ENFORCE_PAYWALL = "true";
    await expect(requireFeature({ id: 1, role: "admin" }, "optimizer_exact")).resolves.toBeUndefined();
    await expect(checkLimit({ id: 1, role: "admin" }, "portfolios", 1000)).resolves.toBeUndefined();
  });

  it("Scharf: Free-Nutzer wird gesperrt (ohne DB → Plan 'free')", async () => {
    // Ohne DB fällt getPlan auf 'free' zurück — exakt der Free-Pfad.
    process.env.ENFORCE_PAYWALL = "true";
    await expect(requireFeature({ id: 42, role: "user" }, "auto_portfolio")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(checkLimit({ id: 42, role: "user" }, "portfolios", 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(checkLimit({ id: 42, role: "user" }, "portfolios", 0)).resolves.toBeUndefined(); // 1. Portfolio erlaubt
  });
});
