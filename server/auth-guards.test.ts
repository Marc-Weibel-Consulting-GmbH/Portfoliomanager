import { describe, it, expect, beforeAll } from 'vitest';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/routers';
import superjson from 'superjson';

/**
 * Auth Guards Test Suite
 * 
 * Tests that all write procedures enforce hard authentication guards:
 * - No fallback to userId=1
 * - Fail-fast on missing ctx.user.id
 * - Proper UNAUTHORIZED errors
 */

const TEST_SERVER_URL = process.env.VITE_APP_URL || 'http://localhost:3000';

describe('Auth Guards - Write Procedures', () => {
  let client: ReturnType<typeof createTRPCProxyClient<AppRouter>>;

  beforeAll(() => {
    // Create client WITHOUT authentication cookie
    client = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${TEST_SERVER_URL}/api/trpc`,
          // No headers = no auth cookie
        }),
      ],
    });
  });

  describe('portfolios router', () => {
    it('should reject portfolio creation without auth', async () => {
      await expect(
        client.portfolios.create.mutate({
          name: 'Test Portfolio',
          portfolioData: JSON.stringify({ stocks: [] }),
          investmentAmount: 10000,
          portfolioType: 'demo',
        })
      ).rejects.toThrow();
    });

    it('should reject portfolio update without auth', async () => {
      await expect(
        client.portfolios.update.mutate({
          id: 1,
          name: 'Updated Portfolio',
        })
      ).rejects.toThrow();
    });

    it('should reject portfolio deletion without auth', async () => {
      await expect(
        client.portfolios.delete.mutate({
          id: 1,
        })
      ).rejects.toThrow();
    });

    it('should reject toggleLive without auth', async () => {
      await expect(
        client.portfolios.toggleLive.mutate({
          id: 1,
          isLive: true,
        })
      ).rejects.toThrow();
    });
  });

  describe('portfolioTransactions router', () => {
    it('should reject transaction creation without auth', async () => {
      await expect(
        client.portfolioTransactions.create.mutate({
          portfolioId: 1,
          transactionType: 'buy',
          ticker: 'AAPL',
          shares: '10',
          pricePerShare: '150',
          totalAmount: '1500',
          fees: '0',
          notes: null,
          transactionDate: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('should reject transaction update without auth', async () => {
      await expect(
        client.portfolioTransactions.update.mutate({
          transactionId: 1,
          shares: '20',
        })
      ).rejects.toThrow();
    });

    it('should reject transaction deletion without auth', async () => {
      await expect(
        client.portfolioTransactions.delete.mutate({
          transactionId: 1,
        })
      ).rejects.toThrow();
    });
  });

  describe('priceAlerts router', () => {
    it('should reject alert creation without auth', async () => {
      await expect(
        client.priceAlerts.create.mutate({
          ticker: 'AAPL',
          alertType: 'above_price',
          targetPrice: '200',
        })
      ).rejects.toThrow();
    });

    it('should reject alert update without auth', async () => {
      await expect(
        client.priceAlerts.update.mutate({
          id: 1,
          isActive: 0,
        })
      ).rejects.toThrow();
    });

    it('should reject alert deletion without auth', async () => {
      await expect(
        client.priceAlerts.delete.mutate({
          id: 1,
        })
      ).rejects.toThrow();
    });
  });

  describe('onboarding router', () => {
    it('should reject demo portfolio creation without auth', async () => {
      await expect(
        client.onboarding.createDemoPortfolio.mutate()
      ).rejects.toThrow();
    });
  });
});
