import { describe, it, expect } from 'vitest';

describe.skipIf(!process.env.WIKIFOLIO_EMAIL || !process.env.WIKIFOLIO_PASSWORD)('Wikifolio credentials', () => {
  it('should have WIKIFOLIO_EMAIL set and valid', () => {
    const email = process.env.WIKIFOLIO_EMAIL;
    expect(email).toBeTruthy();
    expect(email).toContain('@');
  });

  it('should have WIKIFOLIO_PASSWORD set', () => {
    const pw = process.env.WIKIFOLIO_PASSWORD;
    expect(pw).toBeTruthy();
    expect(pw!.length).toBeGreaterThan(4);
  });
});
