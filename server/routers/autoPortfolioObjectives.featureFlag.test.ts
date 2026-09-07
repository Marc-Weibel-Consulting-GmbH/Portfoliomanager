import { describe, expect, it } from 'vitest';
import type { User } from '../../drizzle/schema';
import { autoPortfolioRouter } from './autoPortfolioRouter';

function callerFor(user: User | null) {
  return autoPortfolioRouter.createCaller({
    user,
    req: {} as never,
    res: {} as never,
  });
}

describe('autoPortfolioRouter dividend-quality feature flag', () => {
  it('exposes the configured experimental release only through the protected read-only objective contract', async () => {
    expect(process.env.FEATURE_DIVIDEND_QUALITY_10Y).toBe('true');

    const objectives = await callerFor({ id: 2, role: 'user' } as User).objectives();

    expect(objectives.dividendQuality10y).toMatchObject({
      enabled: true,
      defaultEnabled: false,
      featureFlag: 'FEATURE_DIVIDEND_QUALITY_10Y',
      requiredHistoryYears: 10,
    });
  });

  it('keeps the objective contract protected', async () => {
    await expect(callerFor(null).objectives()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
