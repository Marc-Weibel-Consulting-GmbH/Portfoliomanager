import { getSecret } from "./secretsManager";

// Debug: Log all environment variables on first access
let debugLogged = false;
function debugEnv() {
  if (!debugLogged) {
    debugLogged = true;
    console.log('[ENV DEBUG] Environment variables:');
    console.log('[ENV DEBUG] STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'SET (length: ' + process.env.STRIPE_SECRET_KEY.length + ')' : 'NOT SET');
    console.log('[ENV DEBUG] FINNHUB_API_KEY:', process.env.FINNHUB_API_KEY ? 'SET (length: ' + process.env.FINNHUB_API_KEY.length + ')' : 'NOT SET');
    console.log('[ENV DEBUG] EODHD_API_KEY:', process.env.EODHD_API_KEY ? 'SET (length: ' + process.env.EODHD_API_KEY.length + ')' : 'NOT SET');
    console.log('[ENV DEBUG] NODE_ENV:', process.env.NODE_ENV);
  }
}

export const ENV = {
  get appId() { return process.env.VITE_APP_ID ?? ""; },
  get cookieSecret() { return process.env.JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get oAuthServerUrl() { return process.env.OAUTH_SERVER_URL ?? ""; },
  get ownerId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.BUILT_IN_FORGE_API_URL ?? ""; },
  get forgeApiKey() { return process.env.BUILT_IN_FORGE_API_KEY ?? ""; },
  get eodhdApiKey() { debugEnv(); return process.env.EODHD_API_KEY ?? ""; },
  get stripeSecretKey() { debugEnv(); return process.env.STRIPE_SECRET_KEY ?? ""; },
  get stripeWebhookSecret() { return process.env.STRIPE_WEBHOOK_SECRET ?? ""; },
  get finnhubApiKey() { debugEnv(); return process.env.FINNHUB_API_KEY ?? ""; },
  get fiscalApiKey() { return process.env.FISCAL_API_KEY ?? ""; },
  get resendApiKey() { return process.env.RESEND_API_KEY ?? ""; },
  get twilioAccountSid() { return process.env.TWILIO_ACCOUNT_SID ?? ""; },
  get twilioAuthToken() { return process.env.TWILIO_AUTH_TOKEN ?? ""; },
  get twilioWhatsappNumber() { return process.env.TWILIO_WHATSAPP_NUMBER ?? ""; },
  get emailFrom() { return process.env.EMAIL_FROM ?? ""; },
  get ownerName() { return process.env.OWNER_NAME ?? ""; },
};

/**
 * Get Stripe secret key with database fallback
 * Tries process.env first, then falls back to database-stored secret
 */
export async function getStripeSecretKey(): Promise<string> {
  debugEnv();
  
  // First try environment variable (platform secrets)
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey) {
    console.log('[STRIPE] Using STRIPE_SECRET_KEY from environment');
    return envKey;
  }
  
  // Fallback to database secret
  console.log('[STRIPE] Environment variable not found, checking database...');
  const dbKey = await getSecret('STRIPE_SECRET_KEY');
  if (dbKey) {
    console.log('[STRIPE] Using STRIPE_SECRET_KEY from database');
    return dbKey;
  }
  
  console.warn('[STRIPE] STRIPE_SECRET_KEY not found in environment or database');
  return '';
}
