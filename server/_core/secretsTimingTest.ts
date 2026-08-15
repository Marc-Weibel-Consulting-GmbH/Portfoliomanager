import { ENV } from "./env";

export interface SecretTimingResult {
  timestamp: string;
  elapsedSeconds: number;
  secrets: {
    STRIPE_SECRET_KEY: { available: boolean };
    FINNHUB_API_KEY: { available: boolean };
    EODHD_API_KEY: { available: boolean };
  };
}

const startTime = Date.now();
const timingResults: SecretTimingResult[] = [];

/**
 * Value-free diagnostic for an explicitly initiated health check. This module
 * must never log secret lengths, prefixes or values, and it performs no work
 * on module import.
 */
export function getCurrentSecretStatus(label = "On-Demand Check"): SecretTimingResult {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const result: SecretTimingResult = {
    timestamp: new Date().toISOString(),
    elapsedSeconds: elapsed,
    secrets: {
      STRIPE_SECRET_KEY: {
        available: !!process.env.STRIPE_SECRET_KEY,
      },
      FINNHUB_API_KEY: {
        available: !!ENV.finnhubApiKey,
      },
      EODHD_API_KEY: {
        available: !!ENV.eodhdApiKey,
      },
    },
  };

  void label;
  timingResults.push(result);
  return result;
}

export function getTimingResults(): SecretTimingResult[] {
  return timingResults;
}
