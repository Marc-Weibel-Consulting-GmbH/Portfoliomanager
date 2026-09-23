export type PortfolioReadAccess = "owner" | "viewer";

export type PortfolioViewShare = {
  portfolioId: number;
  userId: number;
  permission: "view";
  revokedAt: Date | null;
};

/**
 * Decides whether a user may read a portfolio. Ownership always wins. A share
 * grants the deliberately narrow `viewer` role only when it matches both the
 * portfolio and recipient and has not been revoked.
 */
export function resolvePortfolioReadAccess(input: {
  portfolioId: number;
  ownerUserId: number;
  requestingUserId: number;
  share: PortfolioViewShare | null;
}): PortfolioReadAccess | null {
  if (input.ownerUserId === input.requestingUserId) return "owner";

  const { share } = input;
  if (
    share
    && share.portfolioId === input.portfolioId
    && share.userId === input.requestingUserId
    && share.permission === "view"
    && share.revokedAt === null
  ) {
    return "viewer";
  }

  return null;
}
