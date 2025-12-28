/**
 * Timing test for secret initialization
 * Tests whether secrets become available after a delay
 */

interface SecretTimingResult {
  timestamp: string;
  elapsedSeconds: number;
  secrets: {
    STRIPE_SECRET_KEY: { available: boolean; length: number; prefix: string };
    FINNHUB_API_KEY: { available: boolean; length: number; prefix: string };
    EODHD_API_KEY: { available: boolean; length: number; prefix: string };
  };
}

const startTime = Date.now();
const timingResults: SecretTimingResult[] = [];

function checkSecrets(label: string): SecretTimingResult {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  
  const result: SecretTimingResult = {
    timestamp: new Date().toISOString(),
    elapsedSeconds: elapsed,
    secrets: {
      STRIPE_SECRET_KEY: {
        available: !!process.env.STRIPE_SECRET_KEY,
        length: process.env.STRIPE_SECRET_KEY?.length || 0,
        prefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7) || "N/A",
      },
      FINNHUB_API_KEY: {
        available: !!process.env.FINNHUB_API_KEY,
        length: process.env.FINNHUB_API_KEY?.length || 0,
        prefix: process.env.FINNHUB_API_KEY?.substring(0, 7) || "N/A",
      },
      EODHD_API_KEY: {
        available: !!process.env.EODHD_API_KEY,
        length: process.env.EODHD_API_KEY?.length || 0,
        prefix: process.env.EODHD_API_KEY?.substring(0, 7) || "N/A",
      },
    },
  };
  
  console.log(`[TIMING TEST ${elapsed}s] ${label}:`, JSON.stringify(result.secrets, null, 2));
  timingResults.push(result);
  
  return result;
}

// Check immediately on module load
checkSecrets("Module Load (0s)");

// Check after 5 seconds
setTimeout(() => {
  checkSecrets("Delayed Check (5s)");
}, 5000);

// Check after 30 seconds
setTimeout(() => {
  checkSecrets("Delayed Check (30s)");
}, 30000);

// Check after 60 seconds
setTimeout(() => {
  checkSecrets("Delayed Check (60s)");
}, 60000);

export function getTimingResults(): SecretTimingResult[] {
  return timingResults;
}

export function getCurrentSecretStatus(): SecretTimingResult {
  return checkSecrets("On-Demand Check");
}
