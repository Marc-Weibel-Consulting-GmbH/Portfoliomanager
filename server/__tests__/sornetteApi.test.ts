/**
 * Sornette Finance API Integration Test
 * Tests that the credentials work and the API returns valid data.
 */
import { describe, it, expect } from 'vitest';

const SORNETTE_AUTH_URL = 'https://api.sornette.finance/v1/auth/token';
const SORNETTE_API_BASE = 'https://api.sornette.finance';

describe('Sornette Finance API', () => {
  it('should authenticate with valid credentials', async () => {
    const username = process.env.SORNETTE_USERNAME;
    const password = process.env.SORNETTE_PASSWORD;

    expect(username).toBeTruthy();
    expect(password).toBeTruthy();

    const resp = await fetch(SORNETTE_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    expect(resp.status).toBe(200);
    const data = await resp.json() as { token: string };
    expect(data.token).toBeTruthy();
    expect(typeof data.token).toBe('string');
  }, 15000);

  it('should fetch GSPC confidence data with valid token', async () => {
    const username = process.env.SORNETTE_USERNAME;
    const password = process.env.SORNETTE_PASSWORD;

    // Get token
    const authResp = await fetch(SORNETTE_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const { token } = await authResp.json() as { token: string };

    // Fetch GSPC confidence
    const confResp = await fetch(`${SORNETTE_API_BASE}/v1/stock/code/GSPC/confidence`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    expect(confResp.status).toBe(200);
    const data = await confResp.json() as Array<{ indicatorCode: string; positiveConfidence: number | string; t2: string }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Check that we have the expected time scales
    const codes = new Set(data.map(d => d.indicatorCode));
    expect(codes.has('2-6y')).toBe(true);
    expect(codes.has('1-3m')).toBe(true);
  }, 20000);

  it('should calculate a valid composite bubble score for GSPC', async () => {
    const { getSornetteBubbleScore } = await import('../analytics/sornetteApi');
    const score = await getSornetteBubbleScore('GSPC');

    expect(score).not.toBeNull();
    expect(score!.score).toBeGreaterThanOrEqual(0);
    expect(score!.score).toBeLessThanOrEqual(100);
    expect(score!.source).toBe('sornette_api');
    expect(score!.dataDate).toBeTruthy();
  }, 20000);
});
