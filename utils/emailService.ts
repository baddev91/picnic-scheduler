/**
 * Email Service for sending confirmation emails via Resend
 * 
 * IMPORTANT: This is a placeholder implementation.
 * In production, you should:
 * 1. Create a Supabase Edge Function or backend API endpoint
 * 2. Store the Resend API key securely in environment variables
 * 3. Call that endpoint from this function
 * 
 * Example Supabase Edge Function setup:
 * - Create: supabase/functions/send-email/index.ts
 * - Deploy: supabase functions deploy send-email
 * - Call from here using supabase.functions.invoke('send-email', { body: emailData })
 */

import { ShopperShift, BusConfig } from '../types';

export interface EmailData {
  to: string;
  shopperName: string;
  firstWorkingDay: string;
  shifts: ShopperShift[];
  usePicnicBus: boolean;
  busConfig: BusConfig;
}

/**
 * Send a confirmation email to the shopper
 * @param emailData - Email recipient and content data
 * @returns Promise<boolean> - Success status
 */
export async function sendConfirmationEmail(emailData: EmailData): Promise<boolean> {
  try {
    // Import supabase client
    const { supabase } = await import('../supabaseClient');

    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: emailData.to,
        subject: 'Your Picnic Shift Schedule Confirmation',
        html: generateEmailHTML(emailData),
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message);
    }

    console.log('✅ Email sent successfully:', data);
    return true;
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    // Don't throw - we don't want email failures to block the submission
    return false;
  }
}

/**
 * Generate HTML email content
 * This would be used in your backend/edge function
 */
function generateEmailHTML(emailData: EmailData): string {
  // Format shifts with readable dates
  const formatShiftDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Generate shift list HTML
  const shiftsHTML = emailData.shifts.map(shift => {
    const shiftTypeColor = shift.type === 'Always Available' ? '#ef4444' : '#22c55e';
    const shiftTypeBadge = shift.type === 'Always Available' ? 'AA' : 'Standard';

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <strong>${formatShiftDate(shift.date)}</strong>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${shift.time}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="background: ${shiftTypeColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">
            ${shiftTypeBadge}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // Generate bus schedule HTML if applicable
  let busScheduleHTML = '';
  if (emailData.usePicnicBus && emailData.busConfig && emailData.busConfig.length > 0) {
    const busStopsHTML = emailData.busConfig.map(stop => {
      const schedulesHTML = Object.entries(stop.schedules).map(([shiftTime, schedule]) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">
            ${shiftTime.split('(')[0].trim()}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace; font-size: 14px;">
            ${schedule.departure}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace; font-size: 14px;">
            ${schedule.return}
          </td>
        </tr>
      `).join('');

      return `
        <div style="margin-bottom: 20px; background: #f9fafb; padding: 15px; border-radius: 8px;">
          <h4 style="margin: 0 0 5px 0; color: #667eea; font-size: 16px;">
            🚏 ${stop.name}
          </h4>
          <p style="margin: 0 0 10px 0; font-size: 13px; color: #6b7280;">
            📍 ${stop.locationName}
          </p>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background: #667eea; color: white;">
                <th style="padding: 10px; text-align: left; font-size: 13px;">Shift</th>
                <th style="padding: 10px; text-align: center; font-size: 13px;">Departure</th>
                <th style="padding: 10px; text-align: center; font-size: 13px;">Return</th>
              </tr>
            </thead>
            <tbody>
              ${schedulesHTML}
            </tbody>
          </table>
          <p style="margin: 10px 0 0 0; font-size: 12px;">
            <a href="${stop.googleMapsLink}" style="color: #667eea; text-decoration: none;">📍 View on Google Maps</a>
          </p>
        </div>
      `;
    }).join('');

    busScheduleHTML = `
      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
        <h2 style="color: #8b5cf6; margin-top: 0; font-size: 20px;">🚌 Bus Schedule Information</h2>
        <p style="font-size: 14px; color: #6b7280; margin-bottom: 15px;">
          You selected to use the Picnic bus. Here are the pickup and return times for all bus stops:
        </p>
        ${busStopsHTML}
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shift Schedule Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to Picnic!</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${emailData.shopperName}</strong>,</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      Great news! Your shift schedule has been successfully submitted. 🚀
    </p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="color: #667eea; margin-top: 0; font-size: 20px;">📅 Your Shift Schedule</h2>
      <p style="margin: 10px 0 15px 0;"><strong>First Working Day:</strong> ${emailData.firstWorkingDay}</p>
      <p style="margin: 10px 0 15px 0;"><strong>Total Shifts:</strong> ${emailData.shifts.length}</p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #667eea; color: white;">
            <th style="padding: 12px; text-align: left; font-size: 14px;">Date</th>
            <th style="padding: 12px; text-align: left; font-size: 14px;">Shift Time</th>
            <th style="padding: 12px; text-align: center; font-size: 14px;">Type</th>
          </tr>
        </thead>
        <tbody>
          ${shiftsHTML}
        </tbody>
      </table>
    </div>

    ${busScheduleHTML}

    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <h3 style="color: #d97706; margin-top: 0; font-size: 18px;">⚠️ Important: Shift Absence Policy</h3>
      <p style="font-size: 14px; color: #92400e; margin: 5px 0;">
        If you are unable to work <strong>any shift</strong> (including your first shift) due to an emergency, you <strong>must</strong> call:
      </p>
      <p style="font-size: 20px; font-weight: bold; color: #d97706; margin: 10px 0; text-align: center;">
        📞 +31 78 808 1137
      </p>
      <p style="font-size: 14px; color: #92400e; margin: 5px 0;">
        <strong>Call between:</strong>
      </p>
      <ul style="font-size: 14px; color: #92400e; margin: 8px 0; padding-left: 20px; line-height: 1.8;">
        <li><strong>5:00 - 5:30 AM</strong> for <strong>Opening</strong> or <strong>Morning</strong> shifts</li>
        <li><strong>2:00 - 2:30 PM</strong> for <strong>Noon</strong>, <strong>Afternoon</strong>, or <strong>Night</strong> shifts</li>
      </ul>
      <p style="font-size: 13px; color: #92400e; margin: 10px 0 0 0; font-style: italic;">
        This applies to your first shift and all future shifts.
      </p>
    </div>

    <p style="font-size: 16px; margin-bottom: 20px;">
      We're excited to have you on the team! If you have any questions, please don't hesitate to reach out to your recruiter.
    </p>

    <p style="font-size: 16px; margin-bottom: 10px;">
      See you soon! 👋
    </p>

    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
      This is an automated confirmation email. Please do not reply to this message.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Example Supabase Edge Function code (for reference):
 * 
 * // supabase/functions/send-email/index.ts
 * import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
 * import { Resend } from 'npm:resend@2.0.0'
 * 
 * const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
 * 
 * serve(async (req) => {
 *   const { to, subject, html } = await req.json()
 *   
 *   const { data, error } = await resend.emails.send({
 *     from: 'Picnic Scheduler <noreply@yourdomain.com>',
 *     to: [to],
 *     subject: subject,
 *     html: html,
 *   })
 *   
 *   if (error) {
 *     return new Response(JSON.stringify({ error }), { status: 400 })
 *   }
 *   
 *   return new Response(JSON.stringify({ data }), { status: 200 })
 * })
 */

