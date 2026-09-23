import { describe, expect, it } from "vitest";
import { resolvePortfolioReadAccess } from "./portfolioAccessPolicy";

describe("resolvePortfolioReadAccess", () => {
  const portfolioId = 4020001;
  const ownerUserId = 4082029;

  it("grants the owner full access without needing a share row", () => {
    expect(resolvePortfolioReadAccess({
      portfolioId,
      ownerUserId,
      requestingUserId: ownerUserId,
      share: null,
    })).toBe("owner");
  });

  it("grants an explicitly active viewer read-only access", () => {
    expect(resolvePortfolioReadAccess({
      portfolioId,
      ownerUserId,
      requestingUserId: 58350081,
      share: { portfolioId, userId: 58350081, permission: "view", revokedAt: null },
    })).toBe("viewer");
  });

  it("denies a viewer with a mismatched portfolio, user, permission, or revocation", () => {
    expect(resolvePortfolioReadAccess({
      portfolioId,
      ownerUserId,
      requestingUserId: 58350081,
      share: { portfolioId: 99, userId: 58350081, permission: "view", revokedAt: null },
    })).toBeNull();

    expect(resolvePortfolioReadAccess({
      portfolioId,
      ownerUserId,
      requestingUserId: 58350081,
      share: { portfolioId, userId: 12, permission: "view", revokedAt: null },
    })).toBeNull();

    expect(resolvePortfolioReadAccess({
      portfolioId,
      ownerUserId,
      requestingUserId: 58350081,
      share: { portfolioId, userId: 58350081, permission: "view", revokedAt: new Date() },
    })).toBeNull();
  });
});
