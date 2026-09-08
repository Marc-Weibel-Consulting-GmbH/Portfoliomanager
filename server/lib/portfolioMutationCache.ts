import { invalidatePortfolioDetailCache } from "./portfolioDetailCache";

type CacheDelete = (key: string) => Promise<unknown>;
type PerformanceInvalidator = (key: string) => Promise<unknown>;

/**
 * Verwirft nach einer erfolgreichen Portfolio-Mutation sämtliche abgeleiteten
 * Ansichten des betroffenen Eigentümers. Die Persistenz selbst findet vor dem
 * Aufruf statt; der Helfer erzeugt weder Portfolio- noch Ledgerdaten.
 */
export async function invalidatePortfolioMutationCaches(input: {
  cacheDel: CacheDelete;
  invalidatePerformance: PerformanceInvalidator;
  portfolioId: number;
  userId: number;
}): Promise<void> {
  await invalidatePortfolioDetailCache(input.cacheDel, input.portfolioId, input.userId);
  await input.invalidatePerformance(`perf:v2:${input.userId}`);
}
