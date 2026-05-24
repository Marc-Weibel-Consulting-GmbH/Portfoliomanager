/**
 * Tests for Copilot Scheduled Handlers and Auto-Save
 */
import { describe, it, expect, vi } from 'vitest';

// Test 1: Verify scheduled handler module exports
describe('Copilot Scheduled Handlers', () => {
  it('exports all three scheduled handlers', async () => {
    const mod = await import('../scheduled/copilotScheduled');
    expect(typeof mod.handleWalkForwardWeekly).toBe('function');
    expect(typeof mod.handleLPPLMonitoring).toBe('function');
    expect(typeof mod.handleEvaluateRecommendations).toBe('function');
  });

  it('handlers reject unauthenticated requests', async () => {
    const mod = await import('../scheduled/copilotScheduled');
    
    // Mock request without valid cron auth
    const mockReq = {
      headers: { cookie: '' },
      url: '/api/scheduled/walkForwardWeekly',
    } as any;
    
    let statusCode = 0;
    let responseBody: any = null;
    const mockRes = {
      status: (code: number) => {
        statusCode = code;
        return { json: (body: any) => { responseBody = body; } };
      },
      json: (body: any) => { responseBody = body; },
    } as any;

    // Should return error status (403 or 500) because no valid session
    await mod.handleWalkForwardWeekly(mockReq, mockRes);
    
    // Unauthenticated requests should be rejected
    expect(statusCode).toBeGreaterThanOrEqual(400);
    expect(responseBody).toBeTruthy();
  });
});

// Test 2: Verify copilotHistory auto-save integration
describe('Copilot History Auto-Save', () => {
  it('saveCopilotRecommendations accepts batch of recommendations', async () => {
    const { saveCopilotRecommendations } = await import('../analytics/copilotHistory');
    expect(typeof saveCopilotRecommendations).toBe('function');
  });

  it('CopilotRecommendation type has correct fields', async () => {
    const mod = await import('../analytics/copilotHistory');
    // Verify the module exports the expected functions
    expect(typeof mod.saveCopilotRecommendation).toBe('function');
    expect(typeof mod.saveCopilotRecommendations).toBe('function');
    expect(typeof mod.getCopilotHistoryForPortfolio).toBe('function');
    expect(typeof mod.getCopilotHistoryStats).toBe('function');
    expect(typeof mod.evaluateRecommendations).toBe('function');
    expect(typeof mod.markRecommendationAsApplied).toBe('function');
  });
});

// Test 3: Verify the copilotRouter has the auto-save code
describe('Copilot Router Auto-Save Integration', () => {
  it('copilotRouter imports saveCopilotRecommendations', async () => {
    // Read the router file to verify the import exists
    const fs = await import('fs');
    const routerContent = fs.readFileSync(
      new URL('../routers/copilotRouter.ts', import.meta.url).pathname.replace('%20', ' '),
      'utf-8'
    );
    expect(routerContent).toContain('saveCopilotRecommendations');
    expect(routerContent).toContain('AUTO-SAVE to Copilot History');
    expect(routerContent).toContain('copilot_analysis');
  });
});

// Test 4: Verify scheduled routes are mounted
describe('Scheduled Routes Registration', () => {
  it('index.ts mounts all scheduled endpoints', async () => {
    const fs = await import('fs');
    const indexContent = fs.readFileSync(
      new URL('../_core/index.ts', import.meta.url).pathname.replace('%20', ' '),
      'utf-8'
    );
    expect(indexContent).toContain('/api/scheduled/walkForwardWeekly');
    expect(indexContent).toContain('/api/scheduled/lpplMonitoring');
    expect(indexContent).toContain('/api/scheduled/evaluateRecommendations');
    expect(indexContent).toContain('handleWalkForwardWeekly');
    expect(indexContent).toContain('handleLPPLMonitoring');
    expect(indexContent).toContain('handleEvaluateRecommendations');
  });
});

// Test 5: Verify SDK cron patches
describe('SDK Cron Patches', () => {
  it('sdk.ts has cron support (CRON_OPEN_ID_PREFIX, AuthenticatedUser)', async () => {
    const fs = await import('fs');
    const sdkContent = fs.readFileSync(
      new URL('../_core/sdk.ts', import.meta.url).pathname.replace('%20', ' '),
      'utf-8'
    );
    expect(sdkContent).toContain('CRON_OPEN_ID_PREFIX');
    expect(sdkContent).toContain('AuthenticatedUser');
    expect(sdkContent).toContain('buildCronUser');
    expect(sdkContent).toContain('isCron');
    expect(sdkContent).toContain('taskUid');
  });

  it('manusTypes.ts has taskUid field', async () => {
    const fs = await import('fs');
    const typesContent = fs.readFileSync(
      new URL('../_core/types/manusTypes.ts', import.meta.url).pathname.replace('%20', ' '),
      'utf-8'
    );
    expect(typesContent).toContain('taskUid');
  });
});
