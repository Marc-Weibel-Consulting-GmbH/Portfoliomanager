import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio Sandbox default

let twilioClient: ReturnType<typeof twilio> | null = null;

// Initialize Twilio client only if credentials are available
if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
}

export interface WhatsAppNotification {
  to: string; // User's mobile number (with country code, e.g., +41791234567)
  message: string;
}

/**
 * Send WhatsApp message via Twilio
 */
export async function sendWhatsAppMessage(notification: WhatsAppNotification): Promise<boolean> {
  if (!twilioClient) {
    console.warn('[WhatsApp] Twilio client not initialized. Skipping notification.');
    return false;
  }

  try {
    // Ensure phone number has whatsapp: prefix
    const to = notification.to.startsWith('whatsapp:') 
      ? notification.to 
      : `whatsapp:${notification.to}`;

    const message = await twilioClient.messages.create({
      from: whatsappNumber,
      to,
      body: notification.message,
    });

    console.log('[WhatsApp] Message sent:', message.sid);
    return true;
  } catch (error) {
    console.error('[WhatsApp] Failed to send message:', error);
    return false;
  }
}

/**
 * Format transaction notification message
 */
export function formatTransactionMessage(
  action: 'add' | 'delete' | 'update_weight' | 'update_data',
  ticker: string,
  companyName: string,
  details: {
    oldWeight?: string;
    newWeight?: string;
    comment?: string;
  }
): string {
  let emoji = '🔔';
  let actionText = '';

  switch (action) {
    case 'add':
      emoji = '✅';
      actionText = `${companyName} (${ticker}) hinzugefügt`;
      if (details.newWeight) {
        actionText += ` - ${details.newWeight}%`;
      }
      break;
    case 'delete':
      emoji = '❌';
      actionText = `${companyName} (${ticker}) gelöscht`;
      break;
    case 'update_weight':
      if (details.oldWeight && details.newWeight) {
        const oldW = parseFloat(details.oldWeight);
        const newW = parseFloat(details.newWeight);
        if (newW > oldW) {
          emoji = '📈';
          actionText = `${ticker} Position erhöht: ${details.oldWeight}% → ${details.newWeight}%`;
        } else {
          emoji = '📉';
          actionText = `${ticker} Position reduziert: ${details.oldWeight}% → ${details.newWeight}%`;
        }
      }
      break;
    case 'update_data':
      emoji = '✏️';
      actionText = `${ticker} Daten aktualisiert`;
      break;
  }

  let message = `${emoji} Portfolio BIG Alert\n\n${actionText}`;
  
  if (details.comment) {
    message += `\n\n💬 Kommentar: ${details.comment}`;
  }

  return message;
}

/**
 * Send transaction notification to user if WhatsApp alerts are enabled
 */
export async function notifyTransaction(
  userMobile: string | null,
  whatsappAlertsEnabled: boolean,
  action: 'add' | 'delete' | 'update_weight' | 'update_data',
  ticker: string,
  companyName: string,
  details: {
    oldWeight?: string;
    newWeight?: string;
    comment?: string;
  }
): Promise<void> {
  if (!whatsappAlertsEnabled || !userMobile) {
    return;
  }

  const message = formatTransactionMessage(action, ticker, companyName, details);
  
  await sendWhatsAppMessage({
    to: userMobile,
    message,
  });
}

