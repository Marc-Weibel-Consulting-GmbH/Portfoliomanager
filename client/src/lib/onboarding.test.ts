import { describe, it, expect } from "vitest";
import { needsOnboardingRedirect } from "./onboarding";

describe("needsOnboardingRedirect", () => {
  const base = { hasUser: true, onboardingLoaded: true, hasCompletedOnboarding: false, location: "/dashboard" };

  it("leitet neue (nicht abgeschlossene) Nutzer in den Wizard", () => {
    expect(needsOnboardingRedirect(base)).toBe(true);
  });

  it("leitet NICHT, wenn Onboarding abgeschlossen ist", () => {
    expect(needsOnboardingRedirect({ ...base, hasCompletedOnboarding: true })).toBe(false);
  });

  it("leitet NICHT, solange der Status noch lädt", () => {
    expect(needsOnboardingRedirect({ ...base, onboardingLoaded: false })).toBe(false);
  });

  it("leitet NICHT ohne eingeloggten Nutzer", () => {
    expect(needsOnboardingRedirect({ ...base, hasUser: false })).toBe(false);
  });

  it("leitet NICHT, wenn bereits auf /onboarding", () => {
    expect(needsOnboardingRedirect({ ...base, location: "/onboarding" })).toBe(false);
  });
});
