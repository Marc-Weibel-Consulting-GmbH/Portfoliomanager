type CacheDelete = (key: string) => Promise<unknown>;

export async function invalidatePortfolioDetailCache(
  cacheDel: CacheDelete,
  portfolioId: number,
  userId: number
): Promise<void> {
  await cacheDel(`portfolio:detail:${portfolioId}:${userId}`);
}
