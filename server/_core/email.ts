import { Resend } from 'resend';
import { ENV, getResendApiKey } from './env';

let resend: Resend | null = null;

async function getResend(): Promise<Resend> {
  if (!resend) {
    const apiKey = await getResendApiKey();
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured. Please add it via Admin > API Secrets.');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  try {
    const resendInstance = await getResend();
    const from = ENV.emailFrom || 'onboarding@resend.dev';
    
    const { data, error } = await resendInstance.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return false;
    }

    console.log('[Email] Sent successfully:', data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Error:', error);
    return false;
  }
}

export function generatePaymentConfirmationEmail(userName: string, userEmail: string): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zahlungsbestätigung - Portfolio BIG</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Portfolio BIG</h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Zahlungsbestätigung</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 24px; font-weight: 600;">Vielen Dank für Ihre Zahlung!</h2>
              
              <p style="margin: 0 0 16px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Hallo ${userName || 'Kunde'},
              </p>
              
              <p style="margin: 0 0 16px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Ihre Zahlung wurde erfolgreich verarbeitet. Sie haben jetzt <strong>vollständigen Zugriff</strong> auf alle Funktionen von Portfolio BIG:
              </p>
              
              <ul style="margin: 20px 0; padding-left: 20px; color: #4a5568; font-size: 16px; line-height: 1.8;">
                <li>Zugriff auf alle 107 Aktien und ETFs</li>
                <li>Portfolio-Optimierung mit Risikomanagement</li>
                <li>Live-Performance-Tracking</li>
                <li>Historische Analysen und Charts</li>
                <li>Dividenden-Kalender</li>
                <li>Unbegrenzte Portfolio-Erstellung</li>
              </ul>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #f7fafc; border-left: 4px solid #667eea; border-radius: 4px;">
                <p style="margin: 0; color: #2d3748; font-size: 14px; line-height: 1.6;">
                  <strong>Ihre Zugangsdaten:</strong><br>
                  E-Mail: ${userEmail}<br>
                  Status: ✓ Vollzugriff freigeschaltet
                </p>
              </div>
              
              <p style="margin: 20px 0 16px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Sie können sich jetzt anmelden und alle Funktionen nutzen:
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${process.env.VITE_APP_URL || 'https://portfoliodash.manus.space'}" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Jetzt anmelden
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Bei Fragen oder Problemen können Sie uns jederzeit kontaktieren.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f7fafc; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; line-height: 1.6;">
                © ${new Date().getFullYear()} Portfolio BIG. Alle Rechte vorbehalten.<br>
                Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateWelcomeEmail(userName: string, userEmail: string): string {
  const appUrl = process.env.VITE_APP_URL || 'https://portfoliodash-aqvizp6n.manus.space';
  const firstName = userName?.split(' ')[0] || 'Investor';
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Willkommen bei Portfolio Intelligence</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#0a0f1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#0f1420;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#00CFC1 0%,#0891b2 100%);padding:40px;text-align:center;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;color:#0a0f1a;font-size:26px;font-weight:700;">Portfolio Intelligence</h1>
              <p style="margin:8px 0 0;color:#0a0f1a;font-size:15px;opacity:0.85;">Ihr KI-gestützter Portfolioassistent</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:22px;font-weight:600;">Willkommen, ${firstName}! 👋</h2>
              <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.7;">
                Ihr Account ist eingerichtet. Hier sind die drei wichtigsten Features, mit denen Sie sofort starten können:
              </p>
              <!-- Feature list -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="padding:12px 16px;background:#1a1f2e;border-radius:8px;border-left:3px solid #00CFC1;margin-bottom:12px;">
                    <div style="color:#00CFC1;font-size:13px;font-weight:600;margin-bottom:4px;">🤖 KI-Portfolio-Builder</div>
                    <div style="color:#94a3b8;font-size:13px;line-height:1.5;">Erstellen Sie in 5 Schritten ein diversifiziertes Portfolio — passend zu Ihrem Risikoprofil.</div>
                  </td>
                </tr>
                <tr><td style="height:10px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background:#1a1f2e;border-radius:8px;border-left:3px solid #00CFC1;">
                    <div style="color:#00CFC1;font-size:13px;font-weight:600;margin-bottom:4px;">📊 Markt-Hub</div>
                    <div style="color:#94a3b8;font-size:13px;line-height:1.5;">Echtzeit-Marktdaten, Heatmaps, Sektoranalysen und aktuelle Finanznachrichten auf einen Blick.</div>
                  </td>
                </tr>
                <tr><td style="height:10px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background:#1a1f2e;border-radius:8px;border-left:3px solid #00CFC1;">
                    <div style="color:#00CFC1;font-size:13px;font-weight:600;margin-bottom:4px;">🔔 Kursalarme</div>
                    <div style="color:#94a3b8;font-size:13px;line-height:1.5;">Legen Sie Preisziele fest und erhalten Sie sofortige Benachrichtigungen bei Kursänderungen.</div>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:24px 0 16px;">
                    <a href="${appUrl}/builder"
                       style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00CFC1 0%,#0891b2 100%);color:#0a0f1a;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;">
                      Jetzt Portfolio erstellen →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:1.6;text-align:center;">
                Bei Fragen steht Ihnen der KI-Copilot unter <a href="${appUrl}/copilot" style="color:#00CFC1;text-decoration:none;">${appUrl}/copilot</a> zur Verfügung.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
                © ${new Date().getFullYear()} Portfolio Intelligence · Diese E-Mail wurde automatisch generiert.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
