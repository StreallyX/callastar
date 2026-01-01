import { Resend } from 'resend';
import { logEmailSent, logEmailError } from './logger';

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
  // Optional context for logging
  bookingId?: string;
  userId?: string;
  emailType?: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
  emailId?: string;
}

/**
 * Send email using Resend with automatic verification and logging
 * 
 * This function wraps email sending with:
 * - Try-catch error handling
 * - Response verification
 * - Automatic logging (success or failure)
 * - Non-blocking error handling (never throws)
 * 
 * @returns Promise with {success: boolean, error?: string, emailId?: string}
 */
export async function sendEmail({ 
  to, 
  subject, 
  html, 
  bookingId, 
  userId, 
  emailType 
}: SendEmailOptions): Promise<SendEmailResult> {
  // If Resend is not configured, log error and return failure
  if (!resend) {
    const errorMsg = 'Resend client not configured. Email not sent.';
    console.warn(errorMsg);
    
    // Log error if we have context
    if (bookingId && userId && emailType) {
      try {
        await logEmailError(bookingId, userId, emailType, errorMsg, {
          recipientEmail: to,
          subject,
        });
      } catch (logError) {
        console.error('Failed to log email error:', logError);
      }
    }
    
    return { success: false, error: errorMsg };
  }

  try {
    // Send email
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    // Check if sending failed
    if (error) {
      console.error('Error sending email:', error);
      
      // Log error if we have context
      if (bookingId && userId && emailType) {
        try {
          await logEmailError(bookingId, userId, emailType, error, {
            recipientEmail: to,
            subject,
          });
        } catch (logError) {
          console.error('Failed to log email error:', logError);
        }
      }
      
      return { 
        success: false, 
        error: typeof error === 'string' ? error : JSON.stringify(error) 
      };
    }

    // Verify email was sent successfully
    if (!data || !data.id) {
      const errorMsg = 'Email sent but no confirmation received from Resend';
      console.warn(errorMsg);
      
      // Log error if we have context
      if (bookingId && userId && emailType) {
        try {
          await logEmailError(bookingId, userId, emailType, errorMsg, {
            recipientEmail: to,
            subject,
          });
        } catch (logError) {
          console.error('Failed to log email error:', logError);
        }
      }
      
      return { success: false, error: errorMsg };
    }

    // Success! Log it
    console.log('Email sent successfully:', data.id);
    
    if (bookingId && userId && emailType) {
      try {
        await logEmailSent(bookingId, userId, emailType, {
          recipientEmail: to,
          subject,
          emailId: data.id,
        });
      } catch (logError) {
        console.error('Failed to log email success:', logError);
      }
    }
    
    return { success: true, emailId: data.id };
  } catch (error) {
    // Unexpected error
    console.error('Unexpected error sending email:', error);
    
    // Log error if we have context
    if (bookingId && userId && emailType) {
      try {
        await logEmailError(bookingId, userId, emailType, error, {
          recipientEmail: to,
          subject,
        });
      } catch (logError) {
        console.error('Failed to log email error:', logError);
      }
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Generate payment confirmation email HTML (English only)
 * 
 * This email is sent immediately after a successful payment.
 * It confirms the payment and provides booking details with a link to the booking page.
 */
export function generatePaymentConfirmationEmail({
  userName,
  creatorName,
  callTitle,
  callDateTime,
  callDuration,
  totalPrice,
  bookingUrl,
  currency = 'EUR',
}: {
  userName: string;
  creatorName: string;
  callTitle: string;
  callDateTime: Date;
  callDuration: number;
  totalPrice: number;
  bookingUrl: string;
  currency?: string;
}) {
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
      <title>Payment Confirmed - Your Call is Booked!</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">✅ Payment Confirmed - Your Call is Booked!</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; font-size: 16px; color: #333333;">Hello ${userName},</p>
                  
                  <p style="margin: 0 0 15px; font-size: 16px; color: #333333;">
                    Great news! Your payment has been successfully processed and your call with <strong>${creatorName}</strong> is now confirmed.
                  </p>
                  
                  <p style="margin: 0 0 30px; font-size: 16px; color: #333333;">
                    We're excited for your upcoming conversation!
                  </p>
                  
                  <!-- Call Details Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e5e7eb;">
                    <tr>
                      <td style="padding: 25px;">
                        <h2 style="margin: 0 0 20px; font-size: 20px; color: #667eea; font-weight: bold;">${callTitle}</h2>
                        
                        <p style="margin: 0 0 12px; font-size: 15px; color: #374151; line-height: 1.6;">
                          <strong>👤 Creator:</strong> ${creatorName}
                        </p>
                        
                        <p style="margin: 0 0 12px; font-size: 15px; color: #374151; line-height: 1.6;">
                          <strong>📅 Date & Time:</strong><br>
                          <span style="color: #667eea; font-weight: 500;">${formattedDate}</span>
                        </p>
                        
                        <p style="margin: 0 0 12px; font-size: 15px; color: #374151; line-height: 1.6;">
                          <strong>⏱️ Duration:</strong> ${callDuration} minutes
                        </p>
                        
                        <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">
                          <strong>💰 Amount Paid:</strong> <span style="color: #10b981; font-weight: 600;">${totalPrice.toFixed(2)} ${currency}</span>
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${bookingUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">View My Booking</a>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Important Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; margin-top: 30px; border-left: 4px solid #f59e0b;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 10px; font-size: 14px; color: #92400e; font-weight: bold;">
                          📌 Important Information:
                        </p>
                        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #92400e; line-height: 1.6;">
                          <li>You can join the call <strong>15 minutes before</strong> the scheduled time</li>
                          <li>Make sure you have a stable internet connection</li>
                          <li>We recommend using headphones for better audio quality</li>
                          <li>You'll receive a reminder email 15 minutes before the call</li>
                        </ul>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 30px 0 0; font-size: 16px; color: #374151; text-align: center; line-height: 1.6;">
                    Thank you for using Call a Star! We hope you have a wonderful conversation with ${creatorName}.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 5px; font-size: 13px; color: #6b7280; line-height: 1.5;">
                    <strong>Call a Star</strong> - Connect with your favorite creators
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
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
 * @deprecated Use generatePaymentConfirmationEmail instead (English only)
 * Generate booking confirmation email HTML (French - kept for backwards compatibility)
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
  // Redirect to English version
  return generatePaymentConfirmationEmail({
    userName,
    creatorName,
    callTitle,
    callDateTime,
    callDuration,
    totalPrice,
    bookingUrl: callUrl,
  });
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


