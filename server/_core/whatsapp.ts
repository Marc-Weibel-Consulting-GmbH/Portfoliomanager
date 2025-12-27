import { ENV, getTwilioAccountSid, getTwilioAuthToken, getTwilioWhatsAppNumber } from './env';

let twilioClient: any = null;

async function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = await getTwilioAccountSid();
    const authToken = await getTwilioAuthToken();
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured. Please add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN via Admin > API Secrets.');
    }
    
    const twilio = await import('twilio');
    twilioClient = twilio.default(accountSid, authToken);
  }
  return twilioClient;
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    const client = await getTwilioClient();
    const from = await getTwilioWhatsAppNumber();
    
    if (!from) {
      console.error('[WhatsApp] TWILIO_WHATSAPP_NUMBER not configured');
      return false;
    }
    
    // Ensure phone number is in E.164 format (e.g., +41791234567)
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const formattedFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
    
    const result = await client.messages.create({
      body: message,
      from: formattedFrom,
      to: formattedTo,
    });
    
    console.log('[WhatsApp] Message sent successfully:', result.sid);
    return true;
  } catch (error) {
    console.error('[WhatsApp] Failed to send message:', error);
    return false;
  }
}
