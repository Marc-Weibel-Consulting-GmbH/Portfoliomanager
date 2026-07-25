import { getSecret } from "./secretsManager";

export const ENV = {
  get appId() { return process.env.VITE_APP_ID ?? ""; },
  get cookieSecret() { return process.env.JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get oAuthServerUrl() { return process.env.OAUTH_SERVER_URL ?? ""; },
  get ownerId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.BUILT_IN_FORGE_API_URL ?? ""; },
  get forgeApiKey() { return process.env.BUILT_IN_FORGE_API_KEY ?? ""; },
  get eodhdApiKey() { return process.env.EODHD_API_KEY ?? ""; },
  get stripeSecretKey() { return process.env.STRIPE_SECRET_KEY ?? ""; },
  get stripeWebhookSecret() { return process.env.STRIPE_WEBHOOK_SECRET ?? ""; },
  get finnhubApiKey() { return process.env.FINNHUB_API_KEY ?? ""; },
  get fiscalApiKey() { return process.env.FISCAL_API_KEY ?? ""; },
  get resendApiKey() { return process.env.RESEND_API_KEY ?? ""; },
  get twilioAccountSid() { return process.env.TWILIO_ACCOUNT_SID ?? ""; },
  get twilioAuthToken() { return process.env.TWILIO_AUTH_TOKEN ?? ""; },
  get twilioWhatsappNumber() { return process.env.TWILIO_WHATSAPP_NUMBER ?? ""; },
  get emailFrom() { return process.env.EMAIL_FROM ?? ""; },
  get ownerName() { return process.env.OWNER_NAME ?? ""; },
  get kimiApiKey() { return process.env.KIMI_API_KEY ?? ""; },
};

/** Get Stripe secret key — env first, then DB fallback. */
export async function getStripeSecretKey(): Promise<string> {
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey) return envKey;
  return (await getSecret('STRIPE_SECRET_KEY')) ?? '';
}

/** Get Finnhub API key — env first, then DB fallback. */
export async function getFinnhubApiKey(): Promise<string> {
  const envKey = process.env.FINNHUB_API_KEY;
  if (envKey) return envKey;
  return (await getSecret('FINNHUB_API_KEY')) ?? '';
}

/** Get EODHD API key — env first, then DB fallback. */
export async function getEodhdApiKey(): Promise<string> {
  const envKey = process.env.EODHD_API_KEY;
  if (envKey) return envKey;
  return (await getSecret('EODHD_API_KEY')) ?? '';
}

/** Get Resend API key — env first, then DB fallback. */
export async function getResendApiKey(): Promise<string> {
  const envKey = process.env.RESEND_API_KEY;
  if (envKey) return envKey;
  return (await getSecret('RESEND_API_KEY')) ?? '';
}

/** Get Twilio credentials — env first, then DB fallback. */
export async function getTwilioCredentials(): Promise<{
  accountSid: string;
  authToken: string;
  whatsappNumber: string;
}> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || (await getSecret('TWILIO_ACCOUNT_SID')) || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || (await getSecret('TWILIO_AUTH_TOKEN')) || '';
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || (await getSecret('TWILIO_WHATSAPP_NUMBER')) || '';
  return { accountSid, authToken, whatsappNumber };
}

/** Get Twilio Account SID — env first, then DB fallback. */
export async function getTwilioAccountSid(): Promise<string> {
  return process.env.TWILIO_ACCOUNT_SID || (await getSecret('TWILIO_ACCOUNT_SID')) || '';
}

/** Get Twilio Auth Token — env first, then DB fallback. */
export async function getTwilioAuthToken(): Promise<string> {
  return process.env.TWILIO_AUTH_TOKEN || (await getSecret('TWILIO_AUTH_TOKEN')) || '';
}

/** Get Twilio WhatsApp Number — env first, then DB fallback. */
export async function getTwilioWhatsAppNumber(): Promise<string> {
  return process.env.TWILIO_WHATSAPP_NUMBER || (await getSecret('TWILIO_WHATSAPP_NUMBER')) || '';
}
