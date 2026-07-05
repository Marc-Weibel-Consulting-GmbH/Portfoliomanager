import nodemailer from "nodemailer";

// Create SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendPurchaseConfirmationParams {
  to: string;
  userName: string;
  amount: number;
  currency: string;
  transactionId: string;
}

export async function sendPurchaseConfirmation({
  to,
  userName,
  amount,
  currency,
  transactionId,
}: SendPurchaseConfirmationParams) {
  const appName = process.env.VITE_APP_TITLE || "Portfoliomanager";
  const appUrl = process.env.VITE_APP_URL || "http://localhost:3000";
  
  // Format amount (convert from cents to currency)
  const formattedAmount = (amount / 100).toFixed(2);
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kaufbestätigung - ${appName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                ✅ Zahlung erfolgreich!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Hallo <strong>${userName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Vielen Dank für deinen Kauf! Deine Zahlung wurde erfolgreich verarbeitet und du hast jetzt <strong>Vollzugriff</strong> auf alle Funktionen von ${appName}.
              </p>
              
              <!-- Purchase Details Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e3a8a;">
                      📋 Kaufdetails
                    </h2>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Betrag:</td>
                        <td style="padding: 8px 0; font-size: 14px; color: #1e293b; text-align: right; font-weight: bold;">
                          ${currency.toUpperCase()} ${formattedAmount}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Transaktions-ID:</td>
                        <td style="padding: 8px 0; font-size: 14px; color: #1e293b; text-align: right; font-family: monospace;">
                          ${transactionId}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Datum:</td>
                        <td style="padding: 8px 0; font-size: 14px; color: #1e293b; text-align: right;">
                          ${new Date().toLocaleDateString('de-CH', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Benefits -->
              <div style="margin: 30px 0;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e3a8a;">
                  🎉 Was du jetzt erhältst:
                </h2>
                <ul style="margin: 0; padding-left: 20px; color: #333333; font-size: 15px; line-height: 1.8;">
                  <li>Zugriff auf alle <strong>63 Aktien</strong> im Portfolio</li>
                  <li>Detaillierte Analysen und Kennzahlen</li>
                  <li>Performance-Tracking und Charts</li>
                  <li>Transaktions-Historie</li>
                  <li>Research-Dokumente und Insights</li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" style="display: inline-block; padding: 15px 40px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                      🚀 Jetzt Portfolio ansehen
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                Bei Fragen oder Problemen kannst du dich jederzeit über das Kontaktformular in der App an uns wenden.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">
                ${appName}
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                Diese E-Mail wurde automatisch generiert. Bitte antworte nicht auf diese E-Mail.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
Kaufbestätigung - ${appName}

Hallo ${userName},

Vielen Dank für deinen Kauf! Deine Zahlung wurde erfolgreich verarbeitet und du hast jetzt Vollzugriff auf alle Funktionen von ${appName}.

Kaufdetails:
- Betrag: ${currency.toUpperCase()} ${formattedAmount}
- Transaktions-ID: ${transactionId}
- Datum: ${new Date().toLocaleString('de-CH')}

Was du jetzt erhältst:
- Zugriff auf alle 63 Aktien im Portfolio
- Detaillierte Analysen und Kennzahlen
- Performance-Tracking und Charts
- Transaktions-Historie
- Research-Dokumente und Insights

Jetzt Portfolio ansehen: ${appUrl}

Bei Fragen oder Problemen kannst du dich jederzeit über das Kontaktformular in der App an uns wenden.

${appName}
Diese E-Mail wurde automatisch generiert.
  `;

  try {
    const info = await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: `✅ Kaufbestätigung - Vollzugriff auf ${appName}`,
      text: textContent,
      html: htmlContent,
    });

    console.log("[Email] Purchase confirmation sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Failed to send purchase confirmation:", error);
    throw error;
  }
}

// Test email configuration
export async function testEmailConnection() {
  try {
    await transporter.verify();
    console.log("[Email] SMTP connection verified successfully");
    return true;
  } catch (error) {
    console.error("[Email] SMTP connection failed:", error);
    return false;
  }
}

