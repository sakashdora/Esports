import fs from 'node:fs';
import path from 'node:path';
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
  const safeDate = escapeHtml(params.eventDateLabel || 'Dates to be announced');

  // Handle Logo attachment & resolution
  const logoPath = path.resolve(process.cwd(), 'public/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.png');
  const attachments: Array<{ filename: string; path: string; cid: string }> = [];
  let logoSrc = `${appUrl}/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.png`;

  if (fs.existsSync(logoPath)) {
    attachments.push({
      filename: 'srusti-esports-logo.png',
      path: logoPath,
      cid: 'srusti-esports-logo',
    });
    logoSrc = 'cid:srusti-esports-logo';
  }

  let subject = `[SAMT Esports 2K26] Registration Received — ${params.teamCode}`;
  let statusBadge = 'Pending Verification';
  let badgeColor = '#D97706';
  let badgeBg = 'rgba(217, 119, 6, 0.15)';
  let headline = 'Registration & Payment Received';
  let warmWelcome =
    'On behalf of the faculty, student leadership, and tournament committee of <strong>Srusti Academy of Management and Technology (SAMT)</strong>, we are delighted to receive your squad registration. Our verification desk is cross-checking your UPI reference against our college accounts.';

  if (params.status === 'verified') {
    subject = `🎮 Confirmed Slot & Official Welcome — ${params.teamName} (${params.teamCode})`;
    statusBadge = 'Verified & Confirmed';
    badgeColor = '#4ADE80';
    badgeBg = 'rgba(22, 163, 74, 0.15)';
    headline = 'Slot Confirmed — Welcome to the Arena!';
    warmWelcome =
      'On behalf of the leadership, faculty, and esports organizing council of <strong>Srusti Academy of Management and Technology (SAMT)</strong>, we extend our warmest welcome to you and your squad! Your registration, roster eligibility, and UPI payment reference have been verified by the Tournament Desk. Your team is officially confirmed for competition!';
  } else if (params.status === 'reupload_required') {
    subject = `⚠️ Payment Proof Re-Upload Required — ${params.teamCode}`;
    statusBadge = 'Re-Upload Required';
    badgeColor = '#F87171';
    badgeBg = 'rgba(220, 38, 38, 0.15)';
    headline = 'Action Required: Update Payment Proof';
    warmWelcome = `The tournament desk reviewed your payment submission and flagged the following issue: <strong>${escapeHtml(
      params.rejectionReason || 'UTR transaction reference or screenshot could not be verified.'
    )}</strong>. Please submit a clear screenshot with visible 12-digit UTR reference.`;
  } else if (params.status === 'rejected') {
    subject = `❌ Registration Notice — ${params.teamCode}`;
    statusBadge = 'Rejected';
    badgeColor = '#EF4444';
    badgeBg = 'rgba(239, 68, 68, 0.15)';
    headline = 'Registration Not Approved';
    warmWelcome = `Your tournament submission could not be approved due to: <strong>${escapeHtml(
      params.rejectionReason || 'Duplicate or invalid transaction reference.'
    )}</strong>. Please contact tournament support if you have questions.`;
  }

  const mealSummary =
    params.lunchCount > 0
      ? `${params.lunchCount} Meal(s) (${params.vegCount} Veg, ${params.nonVegCount} Non-Veg)`
      : 'No Lunch Add-on';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAMT Esports 2K26</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080B10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #080B10; padding: 30px 12px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; margin: 0 auto; background-color: #0E131F; border-radius: 16px; border: 1px solid #1E293B; overflow: hidden; box-shadow: 0 20px 45px rgba(0,0,0,0.6);">
      
      <!-- Top Accent Line -->
      <tr>
        <td style="height: 4px; background: linear-gradient(90deg, #D41B14 0%, #FF6B1A 50%, #E5C736 100%);"></td>
      </tr>

      <!-- Header with Logo and College Identity -->
      <tr>
        <td style="padding: 32px 32px 24px 32px; background: radial-gradient(circle at top right, rgba(212,27,20,0.18), transparent 70%), #0E131F; border-bottom: 1px solid #1E293B; text-align: center;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center">
                <img src="${logoSrc}" alt="Srusti Esports" width="190" style="display: block; width: 190px; max-width: 100%; height: auto; margin: 0 auto 16px auto;" />
                <div style="font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: #E5C736; margin-bottom: 4px;">
                  Srusti Academy of Management and Technology
                </div>
                <div style="font-size: 13px; font-weight: 500; color: #94A3B8; letter-spacing: 0.5px;">
                  Campus LAN Esports Championship &bull; Edition 2K26
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Main Body -->
      <tr>
        <td style="padding: 32px 32px 20px 32px; color: #F8FAFC;">
          <div style="display: inline-block; padding: 6px 14px; background: ${badgeBg}; border: 1px solid ${badgeColor}; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: ${badgeColor}; text-transform: uppercase; margin-bottom: 16px;">
            &#10003; ${statusBadge}
          </div>
          
          <h1 style="margin: 0 0 14px 0; font-size: 24px; font-weight: 800; color: #FFFFFF; line-height: 1.3; letter-spacing: -0.5px;">
            ${headline}
          </h1>

          <p style="margin: 0 0 16px 0; font-size: 15px; color: #CBD5E1; line-height: 1.6;">
            Dear In-Game Leader (IGL) of <strong>${safeTeam}</strong>,
          </p>

          <p style="margin: 0 0 20px 0; font-size: 14px; color: #94A3B8; line-height: 1.6;">
            ${warmWelcome}
          </p>

          ${
            params.status === 'verified' && params.slotNumber
              ? `
          <!-- Allocation Highlight Banner -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, rgba(212,27,20,0.12), rgba(229,199,54,0.08)); border: 1px solid rgba(229,199,54,0.4); border-radius: 12px; margin-bottom: 24px;">
            <tr>
              <td style="padding: 20px; text-align: center;">
                <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #E5C736; margin-bottom: 6px;">
                  OFFICIAL TOURNAMENT ALLOCATION
                </div>
                <div style="font-size: 22px; font-weight: 900; color: #FFFFFF; letter-spacing: 0.5px;">
                  ${escapeHtml(params.groupName || 'Main Bracket')} &bull; ${escapeHtml(params.slotNumber)}
                </div>
                <div style="font-size: 13px; color: #4ADE80; font-weight: 600; margin-top: 4px;">
                  ${safeGame} &bull; LAN Stage
                </div>
              </td>
            </tr>
          </table>`
              : ''
          }

          <!-- Dossier Matrix -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #141B2D; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; margin-bottom: 28px;">
            <tr>
              <td colspan="2" style="background-color: #1A2238; padding: 12px 18px; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #E2E8F0; border-bottom: 1px solid #1E293B;">
                Registration & Payment Dossier
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; color: #94A3B8; font-size: 13px; border-bottom: 1px solid #1E293B; width: 45%;">Team Code</td>
              <td style="padding: 12px 18px; color: #FFFFFF; font-size: 13px; font-weight: 700; text-align: right; border-bottom: 1px solid #1E293B; font-family: monospace;">${safeCode}</td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; color: #94A3B8; font-size: 13px; border-bottom: 1px solid #1E293B;">Tournament Event</td>
              <td style="padding: 12px 18px; color: #FFFFFF; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid #1E293B;">${safeEvent} (${safeGame})</td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; color: #94A3B8; font-size: 13px; border-bottom: 1px solid #1E293B;">UTR / Transaction Ref</td>
              <td style="padding: 12px 18px; color: #4ADE80; font-size: 13px; font-weight: 700; text-align: right; border-bottom: 1px solid #1E293B; font-family: monospace;">${safeUtr}</td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; color: #94A3B8; font-size: 13px; border-bottom: 1px solid #1E293B;">Total Fee</td>
              <td style="padding: 12px 18px; color: #E5C736; font-size: 14px; font-weight: 800; text-align: right; border-bottom: 1px solid #1E293B;">Rs. ${params.totalFee}</td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; color: #94A3B8; font-size: 13px; border-bottom: 1px solid #1E293B;">Lunch Add-On</td>
              <td style="padding: 12px 18px; color: #CBD5E1; font-size: 13px; text-align: right; border-bottom: 1px solid #1E293B;">${escapeHtml(mealSummary)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; color: #94A3B8; font-size: 13px;">Campus Venue</td>
              <td style="padding: 12px 18px; color: #FFFFFF; font-size: 13px; font-weight: 600; text-align: right;">${safeVenue} &bull; ${safeDate}</td>
            </tr>
          </table>

          <!-- Button Call to Action -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
            <tr>
              <td align="center">
                <a href="${trackUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #D41B14 0%, #FF6B1A 100%); color: #FFFFFF; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 14px; font-weight: 800; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(212,27,20,0.4); text-transform: uppercase;">
                  Open Live Tracker &bull; View Team Pass &rarr;
                </a>
              </td>
            </tr>
          </table>

          <!-- Matchday Check-in Instructions -->
          <div style="background-color: #0B0E17; border-left: 3px solid #E5C736; padding: 14px 18px; border-radius: 4px; margin-bottom: 24px;">
            <div style="font-size: 12px; font-weight: 800; color: #E5C736; text-transform: uppercase; margin-bottom: 4px;">
              Important Matchday Instructions:
            </div>
            <ul style="margin: 0; padding-left: 18px; color: #94A3B8; font-size: 12px; line-height: 1.6;">
              <li>All squad members must carry original <strong>College / Institution Photo ID cards</strong> for arena check-in.</li>
              <li>Custom match room credentials will be shared with verified IGLs 15 minutes before match wave.</li>
              <li>Players must enter using their registered <strong>Character IDs and In-Game Names</strong> strictly.</li>
            </ul>
          </div>

          <!-- Closing Signature -->
          <div style="padding-top: 10px; border-top: 1px solid #1E293B; color: #CBD5E1; font-size: 13px; line-height: 1.6;">
            <p style="margin: 0 0 4px 0;">We wish your squad the very best of luck and peak performance. Train hard, play fair, and see you on the battlefield!</p>
            <p style="margin: 12px 0 0 0; color: #94A3B8;">
              Warm regards,<br>
              <strong style="color: #FFFFFF;">Tournament Organizing Committee</strong><br>
              Srusti Academy of Management and Technology (SAMT)<br>
              <span style="font-size: 12px; color: #E5C736;">Bhubaneswar, Odisha</span>
            </p>
          </div>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding: 20px 32px; background-color: #080B10; border-top: 1px solid #1E293B; text-align: center; color: #64748B; font-size: 11px; line-height: 1.5;">
          Official communication from Srusti Academy of Management and Technology.<br>
          Need assistance or roster adjustments? Reach out to <a href="mailto:info.esport@srustiacademy.ac.in" style="color: #FF6B1A; text-decoration: none;">info.esport@srustiacademy.ac.in</a><br>
          &copy; 2026 Srusti Academy of Management and Technology. All rights reserved.
        </td>
      </tr>

    </table>
  </div>
</body>
</html>
  `;

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: params.toEmail,
      subject,
      html,
      attachments,
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
