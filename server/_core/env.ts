export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  eodhdApiKey: process.env.EODHD_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  finnhubApiKey: process.env.FINNHUB_API_KEY ?? "",
  fiscalApiKey: process.env.FISCAL_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioWhatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  ownerName: process.env.OWNER_NAME ?? "",
};

// Debug logging for production
if (process.env.NODE_ENV === "production") {
  console.log('[ENV] Stripe Secret Key available:', !!ENV.stripeSecretKey, 'Length:', ENV.stripeSecretKey?.length || 0);
  console.log('[ENV] Finnhub API Key available:', !!ENV.finnhubApiKey, 'Length:', ENV.finnhubApiKey?.length || 0);
}
