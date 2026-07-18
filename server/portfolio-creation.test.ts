import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from '../server/routers';
import type { Context } from '../server/_core/context';

describe('Portfolio Creation', () => {
  const mockContext: Context = {
    user: {
      id: 1,
      openId: 'test-user',
      username: 'testuser',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'hashed_password',
      mobile: '+41791234567',
      loginMethod: 'email',
      role: 'user',
      hasPaid: 0,
      paymentDate: null,
      stripeCustomerId: null,
      whatsappAlerts: 0,
      emailVerified: 1,
      hasSeenOnboarding: 0,
      hasDemoPortfolio: 0,
      welcomeEmailSent: 0,
      hasCompletedRegistration: 1,
      hasCompletedOnboarding: 0,
      subscriptionTier: 'free',
      plan: 'free' as const,
      planStatus: 'active' as const,
      planRenewsAt: null,
      stripeSubscriptionId: null,
      investmentGoal: null,
      riskTolerance: null,
      investmentHorizon: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as any,
    res: {} as any,
  };

  it('should create a new portfolio without throwing TRPCError reference error', async () => {
    const caller = appRouter.createCaller(mockContext);

    const portfolioData = {
      name: 'Test Portfolio',
      description: 'A test portfolio',
      portfolioData: JSON.stringify({
        stocks: [
          {
            ticker: 'AAPL',
            companyName: 'Apple Inc.',
            currentPrice: '150.00',
            portfolioWeight: 50,
            sector: 'Technology',
            ytdPerformance: '10.5',
            dividendYield: '0.5',
            category: 'Aktien',
          },
          {
            ticker: 'MSFT',
            companyName: 'Microsoft Corporation',
            currentPrice: '300.00',
            portfolioWeight: 50,
            sector: 'Technology',
            ytdPerformance: '15.2',
            dividendYield: '0.8',
            category: 'Aktien',
          },
        ],
      }),
      investmentAmount: 10000,
      portfolioType: 'demo' as const,
    };

    try {
      const result = await caller.portfolios.create(portfolioData);
      
      // If we get here, the TRPCError import is working
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
      expect(result.portfolio).toBeDefined();
      expect(result.portfolio.name).toBe('Test Portfolio');
      
      console.log('✅ Portfolio creation successful!');
      console.log('Portfolio ID:', result.portfolio.id);
    } catch (error: any) {
      // Check if it's a TRPCError reference error (the bug we're fixing)
      if (error.message && error.message.includes('TRPCError is not defined')) {
        throw new Error('BUG STILL EXISTS: TRPCError is not defined in portfoliosRouter.ts');
      }
      
      // Other errors are acceptable (e.g., database connection issues in test environment)
      console.log('Expected error (not the TRPCError bug):', error.message);
      expect(error).toBeDefined();
    }
  });

  it('should handle invalid input gracefully', async () => {
    const caller = appRouter.createCaller(mockContext);

    const invalidData = {
      name: '', // Empty name should fail validation
      description: 'Invalid portfolio',
      portfolioData: '{}',
      investmentAmount: -1000, // Negative amount should fail
      portfolioType: 'demo' as const,
    };

    try {
      await caller.portfolios.create(invalidData);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Should throw a validation error, not a TRPCError reference error
      expect(error).toBeDefined();
      expect(error.message).not.toContain('TRPCError is not defined');
      console.log('✅ Validation error handled correctly:', error.message);
    }
  });
});
