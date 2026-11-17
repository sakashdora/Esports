import nodemailer from 'nodemailer';
import { escapeHtml } from '../src/lib/tournamentRules';

export interface EmailSendResult {
  sent: boolean;
  mode: 'smtp' | 'unconfigured';
  messageId?: string;
  error?: string;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT || '465');
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendTeamConfirmationEmail(params: {
  toEmail: string;
  teamCode: string;
  teamName: string;
  eventTitle: string;
  gameTitle: string;
  status: 'pending' | 'verified' | 'rejected' | 'reupload_required';
  totalFee: number;
  lunchCount: number;
  vegCount: number;
  nonVegCount: number;
  utrNumber: string;
  slotNumber?: string | null;
  groupName?: string | null;
  rejectionReason?: string | null;
  venueLabel?: string;
  eventDateLabel?: string;
}): Promise<EmailSendResult> {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      mode: 'unconfigured',
      error: 'College SMTP credentials are not configured in environment variables.',
    };
  }

  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const trackUrl = `${appUrl}/track?code=${encodeURIComponent(params.teamCode)}`;

  const safeTeam = escapeHtml(params.teamName);
  const safeCode = escapeHtml(params.teamCode);
  const safeEvent = escapeHtml(params.eventTitle);
  const safeGame = escapeHtml(params.gameTitle);
  const safeUtr = escapeHtml(params.utrNumber);
  const safeVenue = escapeHtml(params.venueLabel || 'SAMT Campus LAN Arena');
  const safeDate = escapeHtml(params.eventDateLabel || 'To be announced');

  let subject = `[SAMT Esports 2K26] Registration Received — ${params.teamCode}`;
  let heading = 'Registration & Payment Proof Received';
  let statusBadge = 'PENDING VERIFICATION';
  let statusColor = '#D97706';
  let bodyIntro =
    'Your squad registration and UPI payment proof have been received. Our tournament committee will verify your UTR reference against the college bank statement shortly.';

  if (params.status === 'verified') {
    subject = `[SAMT Esports 2K26] CONFIRMED (${params.slotNumber || 'Slot Assigned'}) — ${params.teamCode}`;
    heading = 'Payment Verified & Tournament Slot Confirmed';
    statusBadge = 'VERIFIED & CONFIRMED';
    statusColor = '#16A34A';
    bodyIntro = `Congratulations! Your payment has been verified. Your squad is officially confirmed in <strong>${escapeHtml(
      params.groupName || 'Main Bracket'
    )}</strong> at <strong>Slot ${escapeHtml(params.slotNumber || 'Assigned')}</strong>.`;
  } else if (params.status === 'reupload_required' || params.status === 'rejected') {
    const isReupload = params.status === 'reupload_required';
    subject = `[SAMT Esports 2K26] Action Required for ${params.teamCode}`;
    heading = isReupload ? 'Payment Proof Re-Upload Requested' : 'Registration Payment Rejected';
    statusBadge = isReupload ? 'RE-UPLOAD REQUIRED' : 'REJECTED';
    statusColor = '#DC2626';
    bodyIntro = `Our verification desk reviewed your payment submission and flagged the following issue: <strong>${escapeHtml(
      params.rejectionReason || 'Transaction reference or screenshot could not be matched.'
    )}</strong>`;
  }

  const mealSummary =
    params.lunchCount > 0
      ? `${params.lunchCount} Meal(s) (${params.vegCount} Veg, ${params.nonVegCount} Non-Veg)`
      : 'No Lunch Add-on';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background: #110D0C; color: #ffffff; padding: 20px 24px; border-bottom: 3px solid #D41B14;">
        <div style="font-size: 12px; letter-spacing: 1px; color: #E5C736; text-transform: uppercase;">Srusti Academy of Management and Technology</div>
        <h1 style="margin: 6px 0 0; font-size: 20px; color: #ffffff;">${heading}</h1>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.6; font-size: 14px;">
        <p style="margin-top: 0;">Dear Team Leader (IGL) of <strong>${safeTeam}</strong>,</p>
        <p>${bodyIntro}</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 18px 0;">
          <div style="font-size: 12px; font-weight: bold; color: ${statusColor}; margin-bottom: 10px;">STATUS: ${statusBadge}</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 4px 0; color: #64748b;">Team Registration ID</td><td style="padding: 4px 0; font-weight: bold; text-align: right;">${safeCode}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Event / Title</td><td style="padding: 4px 0; font-weight: bold; text-align: right;">${safeEvent} (${safeGame})</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">UTR / Transaction Ref</td><td style="padding: 4px 0; font-family: monospace; text-align: right;">${safeUtr}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Total Fee</td><td style="padding: 4px 0; font-weight: bold; text-align: right;">Rs. ${params.totalFee}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Lunch Add-On</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(mealSummary)}</td></tr>
            ${
              params.slotNumber
                ? `<tr><td style="padding: 4px 0; color: #64748b;">Assigned Slot</td><td style="padding: 4px 0; font-weight: bold; color: #16A34A; text-align: right;">${escapeHtml(
                    `${params.groupName || ''} · ${params.slotNumber}`
                  )}</td></tr>`
                : ''
            }
            <tr><td style="padding: 4px 0; color: #64748b;">Venue & Schedule</td><td style="padding: 4px 0; text-align: right;">${safeVenue} · ${safeDate}</td></tr>
          </table>
        </div>
        <p style="margin: 20px 0;">
          <a href="${trackUrl}" style="display: inline-block; background: #D41B14; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold;">Track Status & Download Team Pass</a>
        </p>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
          Mandatory Check-in Reminder: All players must carry valid College/Institution ID cards and join custom rooms using only their registered Character ID & In-Game Name.
        </p>
      </div>
    </div>
  `;

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: params.toEmail,
      subject,
      html,
    });
    return {
      sent: true,
      mode: 'smtp',
      messageId: info.messageId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SMTP delivery failed';
    return {
      sent: false,
      mode: 'smtp',
      error: message,
    };
  }
}
