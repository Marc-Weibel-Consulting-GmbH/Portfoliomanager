import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { 
  getStripeSecretKey, 
  getFinnhubApiKey, 
  getEodhdApiKey, 
  getResendApiKey, 
  getTwilioCredentials 
} from "../_core/env";
import { getTimingResults, getCurrentSecretStatus } from "../_core/secretsTimingTest";
import { ENV } from "../_core/env";

/**
 * Test router to verify database-backed secrets functionality
 * Admin-only endpoints for testing secret loading
 */
export const testSecretsRouter = router({
  /**
   * Test Stripe secret key loading
   * Shows where the key is loaded from (env vs database)
   */
  testStripeKey: adminProcedure.query(async () => {
    const key = await getStripeSecretKey();
    
    return {
      hasKey: !!key,
      keyLength: key ? key.length : 0,
      keyPrefix: key ? key.substring(0, 7) + "..." : "NOT_FOUND",
      source: process.env.STRIPE_SECRET_KEY ? "environment" : (key ? "database" : "none"),
    };
  }),

  /**
   * Get timing test results
   * Shows secret availability at different points in time
   */
  getTimingResults: adminProcedure.query(() => {
    return getTimingResults();
  }),

  /**
   * Get current secret status (on-demand check)
   */
  getCurrentStatus: adminProcedure.query(() => {
    return getCurrentSecretStatus();
  }),

  /**
   * Test all API keys
   */
  testAllApis: adminProcedure.query(async () => {
    const results: Record<string, { status: 'success' | 'error' | 'missing'; message: string; source?: string }> = {};

    // Test Stripe
    try {
      const stripeKey = await getStripeSecretKey();
      if (stripeKey) {
        results.stripe = { 
          status: 'success', 
          message: 'Key found', 
          source: process.env.STRIPE_SECRET_KEY ? 'environment' : 'database' 
        };
      } else {
        results.stripe = { status: 'missing', message: 'Key not configured' };
      }
    } catch (error: any) {
      results.stripe = { status: 'error', message: error.message };
    }

    // Test Finnhub
    try {
      const finnhubKey = await getFinnhubApiKey();
      if (finnhubKey) {
        // Try a simple API call
        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${finnhubKey}`);
        if (response.ok) {
          results.finnhub = { 
            status: 'success', 
            message: 'API call successful', 
            source: ENV.finnhubApiKey ? 'environment' : 'database' 
          };
        } else {
          results.finnhub = { status: 'error', message: `API returned ${response.status}` };
        }
      } else {
        results.finnhub = { status: 'missing', message: 'Key not configured' };
      }
    } catch (error: any) {
      results.finnhub = { status: 'error', message: error.message };
    }

    // Test EODHD
    try {
      const eodhdKey = await getEodhdApiKey();
      if (eodhdKey) {
        // Try a simple API call
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`https://eodhd.com/api/eod/AAPL.US?from=${today}&to=${today}&api_token=${eodhdKey}&fmt=json`);
        if (response.ok) {
          results.eodhd = { 
            status: 'success', 
            message: 'API call successful', 
            source: ENV.eodhdApiKey ? 'environment' : 'database' 
          };
        } else {
          results.eodhd = { status: 'error', message: `API returned ${response.status}` };
        }
      } else {
        results.eodhd = { status: 'missing', message: 'Key not configured' };
      }
    } catch (error: any) {
      results.eodhd = { status: 'error', message: error.message };
    }

    // Test Resend
    try {
      const resendKey = await getResendApiKey();
      if (resendKey) {
        results.resend = { 
          status: 'success', 
          message: 'Key found (send test email to verify)', 
          source: ENV.resendApiKey ? 'environment' : 'database' 
        };
      } else {
        results.resend = { status: 'missing', message: 'Key not configured' };
      }
    } catch (error: any) {
      results.resend = { status: 'error', message: error.message };
    }

    // Test Twilio
    try {
      const twilioCredentials = await getTwilioCredentials();
      if (twilioCredentials.accountSid && twilioCredentials.authToken) {
        results.twilio = { 
          status: 'success', 
          message: 'Credentials found (send test message to verify)', 
          source: (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) ? 'environment' : 'database' 
        };
      } else {
        results.twilio = { status: 'missing', message: 'Credentials not configured' };
      }
    } catch (error: any) {
      results.twilio = { status: 'error', message: error.message };
    }

    return results;
  }),

  /**
   * Send test email
   */
  sendTestEmail: adminProcedure
    .input(z.object({ to: z.string().email() }))
    .mutation(async ({ input }) => {
      const { sendEmail } = await import("../_core/email");
      const success = await sendEmail({
        to: input.to,
        subject: 'Test Email from Portfolio BIG',
        html: '<h1>Test Email</h1><p>This is a test email from your Portfolio BIG application.</p>',
      });
      return { success, message: success ? 'Email sent successfully' : 'Failed to send email' };
    }),

  /**
   * Send test WhatsApp message
   */
  sendTestWhatsApp: adminProcedure
    .input(z.object({ to: z.string() }))
    .mutation(async ({ input }) => {
      const { sendWhatsAppMessage } = await import("../services/whatsapp");
      const success = await sendWhatsAppMessage({
        to: input.to,
        message: 'Test message from Portfolio BIG! 🎉',
      });
      return { success, message: success ? 'WhatsApp message sent successfully' : 'Failed to send message' };
    }),
});
