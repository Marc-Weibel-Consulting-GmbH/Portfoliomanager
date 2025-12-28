import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from '../server/routers';
import { getDb } from '../server/db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Onboarding Flow', () => {
  let testUserId: number;
  
  beforeAll(async () => {
    // Create a test user
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const [result] = await db.insert(users).values({
      openId: `test-onboarding-${Date.now()}`,
      name: 'Test User',
      email: 'test@example.com',
      hasSeenOnboarding: 0,
      hasCompletedOnboarding: 0,
    });
    
    testUserId = result.insertId;
  });

  it('should mark onboarding as completed', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Create a mock context
    const mockContext = {
      user: {
        id: testUserId,
        openId: `test-onboarding-${testUserId}`,
        name: 'Test User',
        email: 'test@example.com',
        hasSeenOnboarding: 0,
        hasCompletedOnboarding: 0,
        role: 'user' as const,
      },
      req: {} as any,
      res: {} as any,
    };

    // Create caller with mock context
    const caller = appRouter.createCaller(mockContext);

    // Save preferences
    await caller.onboarding.savePreferences({
      investmentGoal: 'balanced',
      riskTolerance: 'medium',
      investmentHorizon: 'medium',
    });

    // Complete onboarding
    await caller.onboarding.completeOnboarding();

    // Check if onboarding was marked as completed
    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(updatedUser.hasSeenOnboarding).toBe(1);
  });

  it('should check if user has completed onboarding', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Get the updated user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    const mockContext = {
      user: {
        id: testUserId,
        openId: user.openId,
        name: user.name || 'Test User',
        email: user.email || 'test@example.com',
        hasSeenOnboarding: user.hasSeenOnboarding,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        role: 'user' as const,
      },
      req: {} as any,
      res: {} as any,
    };

    const caller = appRouter.createCaller(mockContext);

    // Check onboarding status
    const status = await caller.onboarding.hasCompletedOnboarding();

    expect(status.hasSeenOnboarding).toBe(true);
  });
});
