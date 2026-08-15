import { afterEach, describe, expect, it } from "vitest";
import { getCurrentSecretStatus } from "./secretsTimingTest";

const originalStripeKey = process.env.STRIPE_SECRET_KEY;
const originalFinnhubKey = process.env.FINNHUB_API_KEY;
const originalEodhdKey = process.env.EODHD_API_KEY;

afterEach(() => {
  process.env.STRIPE_SECRET_KEY = originalStripeKey;
  process.env.FINNHUB_API_KEY = originalFinnhubKey;
  process.env.EODHD_API_KEY = originalEodhdKey;
});

describe("wertfreie Secret-Verfügbarkeitsdiagnostik", () => {
  it("gibt niemals Secretwerte, -präfixe oder -längen zurück", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_should_not_leak";
    process.env.FINNHUB_API_KEY = "finnhub_should_not_leak";
    process.env.EODHD_API_KEY = "eodhd_should_not_leak";

    const result = getCurrentSecretStatus();
    const serialized = JSON.stringify(result);

    expect(result.secrets).toEqual({
      STRIPE_SECRET_KEY: { available: true },
      FINNHUB_API_KEY: { available: true },
      EODHD_API_KEY: { available: true },
    });
    expect(serialized).not.toContain("should_not_leak");
    expect(serialized).not.toContain("prefix");
    expect(serialized).not.toContain("length");
  });
});
