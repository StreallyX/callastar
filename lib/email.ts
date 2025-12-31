import { Resend } from 'resend';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Call a Star <onboarding@resend.dev>';

if (!RESEND_API_KEY) {
  console.warn('RESEND_API_KEY not configured. Emails will not be sent.');
}

// Create Resend client
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email using Resend
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!resend) {
    console.warn('Resend client not configured. Email not sent.');
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    console.log('Email sent:', data?.id);
    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Generate booking confirmation email HTML
 */
export function generateBookingConfirmationEmail({
  userName,
  creatorName,
  callTitle,
  callDateTime,
  callDuration,
  totalPrice,
  callUrl,
}: {
  userName: string;
  creatorName: string;
  callTitle: string;
  callDateTime: Date;
  callDuration: number;
  totalPrice: number;
  callUrl: string;
}) {
  const formattedDate = new Date(callDateTime).toLocaleString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmation de réservation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">✨ Réservation Confirmée !</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; font-size: 16px; color: #333333;">Bonjour ${userName},</p>
                  
                  <p style="margin: 0 0 30px; font-size: 16px; color: #333333;">
                    Votre réservation est confirmée ! Vous allez bientôt pouvoir discuter avec <strong>${creatorName}</strong>.
                  </p>
                  
                  <!-- Call Details Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 20px;">
                        <h2 style="margin: 0 0 15px; font-size: 20px; color: #667eea;">${callTitle}</h2>
                        
                        <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">
                          <strong>📅 Date et heure :</strong><br>
                          ${formattedDate}
                        </p>
                        
                        <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">
                          <strong>⏱️ Durée :</strong> ${callDuration} minutes
                        </p>
                        
                        <p style="margin: 0; font-size: 14px; color: #666666;">
                          <strong>💰 Montant payé :</strong> ${totalPrice.toFixed(2)} €
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${callUrl}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">Rejoindre l'appel</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0 0; font-size: 14px; color: #999999; text-align: center;">
                    Vous pourrez rejoindre l'appel 15 minutes avant l'heure prévue.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #999999;">
                    Call a Star - Connectez-vous avec vos créateurs préférés<br>
                    Cet email a été envoyé automatiquement, merci de ne pas y répondre.
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
}

/**
 * Generate reminder email HTML (English only)
 * This email is sent 15 minutes before a call starts
 * The callUrl should be the platform booking URL, not the Daily.io room URL
 */
export function generateBookingReminderEmail({
  userName,
  creatorName,
  callDateTime,
  bookingUrl,
}: {
  userName: string;
  creatorName: string;
  callDateTime: Date;
  bookingUrl: string;
}) {
  // Format the date and time in a user-friendly way
  const formattedDate = new Date(callDateTime).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Call Reminder - Your call is starting soon!</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">⏰ Your Call is Starting Soon!</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; font-size: 16px; color: #333333;">Hi ${userName},</p>
                  
                  <p style="margin: 0 0 30px; font-size: 16px; color: #333333;">
                    This is a friendly reminder that your call with <strong>${creatorName}</strong> is starting in approximately <strong>15 minutes</strong>.
                  </p>
                  
                  <!-- Call Details Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">
                          <strong>📅 Scheduled Time:</strong><br>
                          ${formattedDate}
                        </p>
                        
                        <p style="margin: 0; font-size: 14px; color: #666666;">
                          <strong>👤 With:</strong> ${creatorName}
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${bookingUrl}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">Join Call Now</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0 0; font-size: 14px; color: #999999; text-align: center;">
                    Make sure you're ready to join on time. We hope you enjoy your call!
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #999999;">
                    Call a Star - Connect with your favorite creators<br>
                    This is an automated email, please do not reply.
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
}

/**
 * @deprecated Use generateBookingReminderEmail instead
 * Generate reminder email HTML (French - kept for backwards compatibility)
 */
export function generateReminderEmail({
  userName,
  creatorName,
  callTitle,
  callDateTime,
  callUrl,
}: {
  userName: string;
  creatorName: string;
  callTitle: string;
  callDateTime: Date;
  callUrl: string;
}) {
  const timeUntilCall = formatDistanceToNow(new Date(callDateTime), {
    locale: fr,
    addSuffix: true,
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Rappel d'appel</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px;">
              <tr>
                <td style="padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0 0 20px; font-size: 24px; color: #667eea;">⏰ Rappel : Votre appel commence bientôt !</h1>
                  
                  <p style="margin: 0 0 30px; font-size: 16px; color: #333333;">
                    Bonjour ${userName},<br><br>
                    Votre appel avec <strong>${creatorName}</strong> commence ${timeUntilCall}.
                  </p>
                  
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${callUrl}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">Rejoindre maintenant</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
