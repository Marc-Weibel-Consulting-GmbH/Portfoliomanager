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
  get fmpApiKey() { return process.env.FMP_API_KEY ?? ""; },
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

/**
 * Get Finnhub API key with database fallback
 */
export async function getFinnhubApiKey(): Promise<string> {
  debugEnv();
  
  const envKey = process.env.FINNHUB_API_KEY;
  if (envKey) {
    console.log('[FINNHUB] Using FINNHUB_API_KEY from environment');
    return envKey;
  }
  
  console.log('[FINNHUB] Environment variable not found, checking database...');
  const dbKey = await getSecret('FINNHUB_API_KEY');
  if (dbKey) {
    console.log('[FINNHUB] Using FINNHUB_API_KEY from database');
    return dbKey;
  }
  
  console.warn('[FINNHUB] FINNHUB_API_KEY not found in environment or database');
  return '';
}

/**
 * Get EODHD API key with database fallback
 */
export async function getEodhdApiKey(): Promise<string> {
  debugEnv();
  
  const envKey = process.env.EODHD_API_KEY;
  if (envKey) {
    console.log('[EODHD] Using EODHD_API_KEY from environment');
    return envKey;
  }
  
  console.log('[EODHD] Environment variable not found, checking database...');
  const dbKey = await getSecret('EODHD_API_KEY');
  if (dbKey) {
    console.log('[EODHD] Using EODHD_API_KEY from database');
    return dbKey;
  }
  
  console.warn('[EODHD] EODHD_API_KEY not found in environment or database');
  return '';
}

/**
 * Get Resend API key with database fallback
 */
export async function getResendApiKey(): Promise<string> {
  const envKey = process.env.RESEND_API_KEY;
  if (envKey) {
    console.log('[RESEND] Using RESEND_API_KEY from environment');
    return envKey;
  }
  
  console.log('[RESEND] Environment variable not found, checking database...');
  const dbKey = await getSecret('RESEND_API_KEY');
  if (dbKey) {
    console.log('[RESEND] Using RESEND_API_KEY from database');
    return dbKey;
  }
  
  console.warn('[RESEND] RESEND_API_KEY not found in environment or database');
  return '';
}

/**
 * Get Twilio credentials with database fallback
 */
export async function getTwilioCredentials(): Promise<{
  accountSid: string;
  authToken: string;
  whatsappNumber: string;
}> {
  let accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  let authToken = process.env.TWILIO_AUTH_TOKEN || '';
  let whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';
  
  // Check database for missing credentials
  if (!accountSid) {
    console.log('[TWILIO] TWILIO_ACCOUNT_SID not in environment, checking database...');
    accountSid = await getSecret('TWILIO_ACCOUNT_SID') || '';
    if (accountSid) console.log('[TWILIO] Using TWILIO_ACCOUNT_SID from database');
  }
  
  if (!authToken) {
    console.log('[TWILIO] TWILIO_AUTH_TOKEN not in environment, checking database...');
    authToken = await getSecret('TWILIO_AUTH_TOKEN') || '';
    if (authToken) console.log('[TWILIO] Using TWILIO_AUTH_TOKEN from database');
  }
  
  if (!whatsappNumber) {
    console.log('[TWILIO] TWILIO_WHATSAPP_NUMBER not in environment, checking database...');
    whatsappNumber = await getSecret('TWILIO_WHATSAPP_NUMBER') || '';
    if (whatsappNumber) console.log('[TWILIO] Using TWILIO_WHATSAPP_NUMBER from database');
  }
  
  if (!accountSid || !authToken) {
    console.warn('[TWILIO] Twilio credentials incomplete');
  }
  
  return { accountSid, authToken, whatsappNumber };
}

/**
 * Get Twilio Account SID with database fallback
 */
export async function getTwilioAccountSid(): Promise<string> {
  const envKey = process.env.TWILIO_ACCOUNT_SID;
  if (envKey) {
    console.log('[TWILIO] Using TWILIO_ACCOUNT_SID from environment');
    return envKey;
  }
  
  console.log('[TWILIO] Environment variable not found, checking database...');
  const dbKey = await getSecret('TWILIO_ACCOUNT_SID');
  if (dbKey) {
    console.log('[TWILIO] Using TWILIO_ACCOUNT_SID from database');
    return dbKey;
  }
  
  console.warn('[TWILIO] TWILIO_ACCOUNT_SID not found in environment or database');
  return '';
}

/**
 * Get Twilio Auth Token with database fallback
 */
export async function getTwilioAuthToken(): Promise<string> {
  const envKey = process.env.TWILIO_AUTH_TOKEN;
  if (envKey) {
    console.log('[TWILIO] Using TWILIO_AUTH_TOKEN from environment');
    return envKey;
  }
  
  console.log('[TWILIO] Environment variable not found, checking database...');
  const dbKey = await getSecret('TWILIO_AUTH_TOKEN');
  if (dbKey) {
    console.log('[TWILIO] Using TWILIO_AUTH_TOKEN from database');
    return dbKey;
  }
  
  console.warn('[TWILIO] TWILIO_AUTH_TOKEN not found in environment or database');
  return '';
}

/**
 * Get Twilio WhatsApp Number with database fallback
 */
export async function getTwilioWhatsAppNumber(): Promise<string> {
  const envKey = process.env.TWILIO_WHATSAPP_NUMBER;
  if (envKey) {
    console.log('[TWILIO] Using TWILIO_WHATSAPP_NUMBER from environment');
    return envKey;
  }
  
  console.log('[TWILIO] Environment variable not found, checking database...');
  const dbKey = await getSecret('TWILIO_WHATSAPP_NUMBER');
  if (dbKey) {
    console.log('[TWILIO] Using TWILIO_WHATSAPP_NUMBER from database');
    return dbKey;
  }
  
  console.warn('[TWILIO] TWILIO_WHATSAPP_NUMBER not found in environment or database');
  return '';
}
