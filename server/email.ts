import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer/index.js';
import { renderBrandedQr } from './qrPass.js';
import { confirmedSeat, isWaitlistSlot } from '../src/lib/checkIn.js';
import { escapeHtml, type PlayerInput } from '../src/lib/tournamentRules.js';

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

// One pooled connection is reused across emails instead of a fresh TLS login for each one.
let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let cachedTransporterKey = '';

function createTransporter() {
  const key = [process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER, process.env.SMTP_PASS].join('|');
  if (!cachedTransporter || cachedTransporterKey !== key) {
    cachedTransporter = buildTransporter();
    cachedTransporterKey = key;
  }
  return cachedTransporter;
}

function buildTransporter() {
  const port = Number(process.env.SMTP_PORT || '465');
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    pool: true,
    maxConnections: 3,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Bound SMTP waits so background delivery and explicit admin resends can finish.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
}

/** Public site address for links in emails (APP_URL, else the Vercel production domain). */
export function resolveAppUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && /^https?:\/\//i.test(configured)) return configured.replace(/\/$/, '');
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

type CheckInPlayer = Pick<PlayerInput,
  'slotRole' | 'fullName' | 'inGameName' | 'characterId' | 'collegeOverride' | 'academicLevel' | 'wantsLunch' | 'dietType'
>;

export interface TeamConfirmationEmailParams {
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
  members?: readonly CheckInPlayer[];
}

const BRAND = 'Srusti Esports 2026';
const ACADEMY = 'Srusti Academy of Management and Technology (Autonomous)';
const SUPPORT_EMAIL = 'mail@srustiacademy.ac.in';
const LOGO_PATH = 'assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.png';
const CHECK_IN_QR_CID = 'srusti-team-check-in';
type CheckInQrContents = 'roster' | 'status';

const PLAYER_ROLES: Record<CheckInPlayer['slotRole'], string> = {
  IGL: 'Team leader',
  P2: 'Player 2',
  P3: 'Player 3',
  P4: 'Player 4',
  SUB: 'Substitute',
};

const CHECK_IN = [
  'Bring your original college or institution photo ID to check-in.',
  'Use the Character ID and in-game name you entered at registration.',
  'Verified team leaders receive room credentials 15 minutes before their match wave.',
];

function eventDetails(params: TeamConfirmationEmailParams): [string, string][] {
  const event = params.eventTitle.toLowerCase().includes(params.gameTitle.toLowerCase())
    ? params.eventTitle
    : `${params.eventTitle} · ${params.gameTitle}`;
  return [
    ['Tournament', event],
    ['Campus entry', params.eventDateLabel || 'Dates to be announced'],
    ['Venue', params.venueLabel || 'SAMT Campus LAN Arena'],
  ];
}

function rosterDetails(member: CheckInPlayer, compact = false): string[] {
  return [
    compact ? member.inGameName : `IGN ${member.inGameName}`,
    compact ? member.characterId : `Character ID ${member.characterId}`,
    member.collegeOverride || (compact ? '—' : ''),
    member.academicLevel,
    member.wantsLunch ? (member.dietType === 'VEG' ? 'Veg lunch' : 'Non-veg lunch') : 'No lunch',
  ].filter(Boolean);
}

function statusUrl(params: TeamConfirmationEmailParams, appUrl: string): string {
  return `${appUrl}/track?code=${encodeURIComponent(params.teamCode)}`;
}

export async function createCheckInQr(params: TeamConfirmationEmailParams, appUrl: string) {
  const seat = confirmedSeat(params);
  if (!seat || !params.members?.length) return null;

  const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();
  const roster = params.members.map(member =>
    `${PLAYER_ROLES[member.slotRole]}: ${oneLine(member.fullName)} | ${rosterDetails(member, true).map(oneLine).join(' | ')}`,
  );
  const payload = [
    `${BRAND} | Team check-in`,
    `Team code: ${oneLine(params.teamCode)}`,
    `Team: ${oneLine(params.teamName)}`,
    ...eventDetails(params).map(([label, value]) => `${label}: ${oneLine(value)}`),
    oneLine(seat),
    'Roster (name | IGN | Character ID | College | Course | Lunch)',
    ...roster,
  ].join('\n');

  // Keep on-screen modules large enough to scan. Dense rosters open the same private details by link.
  const contents: CheckInQrContents = Buffer.byteLength(payload) <= 750 ? 'roster' : 'status';
  const encoded = contents === 'roster' ? payload : statusUrl(params, appUrl);
  const png = await renderBrandedQr(encoded, contents === 'roster' ? 'M' : 'H');
  return { contents, png, encoded };
}

function registrationMessage(params: TeamConfirmationEmailParams, slot: string) {
  const reason = params.rejectionReason?.trim();
  switch (params.status) {
    case 'verified':
      if (isWaitlistSlot(params)) {
        return {
          title: 'Payment Verified — Waitlisted',
          status: 'Waitlisted',
          message: 'The tournament desk verified your payment. Check Team Status for your waitlist position and updates.',
          action: 'Check team status',
          accent: '#805009',
        };
      }
      return {
        title: slot ? 'Slot Confirmed' : 'Registration Verified',
        status: 'Verified',
        message: slot
          ? 'The tournament desk has verified your registration and assigned your LAN seat. Open your team pass before match day.'
          : 'The tournament desk has verified your registration. Check Team Status for your LAN seat.',
        action: slot ? 'Open team pass' : 'Check team status',
        accent: '#116149',
      };
    case 'reupload_required':
      return {
        title: 'Payment Proof Re-upload Required',
        status: 'Action required',
        message: 'Open Team Status and enter your team ID and team leader’s mobile number to upload a clear payment screenshot with the 12-digit UTR visible.',
        reason: reason || 'The tournament desk could not verify the UTR or screenshot.',
        action: 'Update payment proof',
        accent: '#a33521',
      };
    case 'rejected':
      return {
        title: 'Registration Not Approved',
        status: 'Review complete',
        message: 'Check Team Status for the latest decision or contact the tournament desk if you have questions.',
        reason: reason || 'The tournament desk could not verify the submitted registration or payment details.',
        action: 'Review team status',
        accent: '#a33521',
      };
    case 'pending':
      return {
        title: 'Registration Received',
        status: 'Pending verification',
        message: 'We received your squad registration and payment proof. The tournament desk will review your UPI reference before confirming your slot.',
        action: 'Track registration',
        accent: '#805009',
      };
  }
}

function checkInInstructions(contents: CheckInQrContents): string {
  return contents === 'roster'
    ? 'Show this QR at campus check-in. It contains your squad roster and entry details. Staff will verify the roster and college IDs.'
    : 'Scan the QR and enter the team leader’s phone number to open the private roster. Show this email at campus check-in.';
}

function renderCheckInPass(params: TeamConfirmationEmailParams, slot: string, contents: CheckInQrContents) {
  const players = (params.members || []).map(member => `
    <tr><td style="padding:10px 14px;border-bottom:1px solid #e5ded1;line-height:1.5;">
      <span style="font-size:12px;color:#61554d;">${PLAYER_ROLES[member.slotRole]}</span><br>
      <strong style="font-size:15px;color:#211e23;">${escapeHtml(member.fullName)}</strong><br>
      <span style="font-size:13px;color:#51453e;overflow-wrap:anywhere;">${escapeHtml(rosterDetails(member).join(' · '))}</span>
    </td></tr>`).join('');
  return `
    <tr><td style="padding:0 20px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #d8cbb7;">
        <tr><td bgcolor="#172249" style="padding:22px 20px;background-color:#172249;border-top:4px solid #eec36c;color:#ffffff;">
          <h2 style="margin:0 0 10px;font-size:21px;line-height:1.3;color:#ffffff;">Team check-in pass</h2>
          <p style="margin:0 0 8px;font-family:Consolas,'Courier New',monospace;font-size:24px;font-weight:bold;color:#f5d18a;overflow-wrap:anywhere;">${escapeHtml(params.teamCode)}</p>
          <p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#ffffff;">${escapeHtml(slot)}</p>
          ${eventDetails(params).map(([, value]) => `<p style="margin:0 0 4px;font-size:14px;line-height:1.45;color:#f2efe9;overflow-wrap:anywhere;">${escapeHtml(value)}</p>`).join('')}
        </td></tr>
        <tr><td align="center" bgcolor="#ffffff" style="padding:12px 14px 16px;background-color:#ffffff;">
          <img src="cid:${CHECK_IN_QR_CID}" width="380" alt="Team check-in QR code with the Srusti crest" style="display:block;width:380px;max-width:100%;height:auto;margin:0 auto;color:#211e23;">
          <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#51453e;">${checkInInstructions(contents)}</p>
        </td></tr>
        <tr><td bgcolor="#f8f4ed" style="padding:12px 14px;background-color:#f8f4ed;border-top:1px dashed #d8cbb7;">
          <h3 style="margin:0;font-size:15px;color:#211e23;">Registered squad</h3>
        </td></tr>
        ${players}
      </table>
    </td></tr>`;
}

export function buildTeamConfirmationEmail(
  params: TeamConfirmationEmailParams,
  appUrl: string,
  logoSrc: string,
  qrContents?: CheckInQrContents,
) {
  const slot = confirmedSeat(params);
  const checkIn = slot && params.members?.length ? qrContents : undefined;
  const message = registrationMessage(params, slot);
  const subject = `${BRAND} — ${message.title} — ${params.teamCode}`;
  const trackUrl = statusUrl(params, appUrl);
  const mealSummary = params.lunchCount > 0
    ? `${params.lunchCount} (${params.vegCount} veg · ${params.nonVegCount} non-veg)`
    : 'None selected';
  const details = [
    ...eventDetails(params),
    ['Submitted fee', `₹${params.totalFee.toLocaleString('en-IN')}`],
    ['UPI reference (UTR)', params.utrNumber || '—'],
    ['Optional meals', mealSummary],
  ];
  const rows = (checkIn ? details.slice(3) : details).map(([label, value]) => `
    <tr>
      <th scope="row" align="left" valign="top" width="39%" style="padding:10px 10px;border-bottom:1px solid #eae2d6;font-size:13px;line-height:1.4;color:#61554d;font-weight:normal;">${label}</th>
      <td valign="top" style="padding:10px 10px;border-bottom:1px solid #eae2d6;font-size:14px;line-height:1.4;color:#241b19;font-weight:bold;overflow-wrap:anywhere;">${escapeHtml(value)}</td>
    </tr>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${BRAND}</title>
</head>
<body bgcolor="#efebe5" style="margin:0;padding:0;background-color:#efebe5;font-family:Arial,Helvetica,sans-serif;color:#241b19;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#efebe5" style="background-color:#efebe5;">
    <tr><td align="center" style="padding:18px 8px;">
      <!--[if mso]><table role="presentation" width="620" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:620px;background-color:#ffffff;">
        <tr><td bgcolor="#231716" style="padding:22px 20px;border-bottom:4px solid #eec36c;background-color:#231716;color:#fff8ed;">
          <img src="${escapeHtml(logoSrc)}" alt="Srusti e-Sports logo" width="146" style="display:block;width:146px;max-width:100%;height:auto;color:#fff8ed;font-size:13px;">
          <p style="margin:8px 0 0;font-size:17px;line-height:1.35;font-weight:bold;color:#fff8ed;">${BRAND}</p>
          <p style="margin:4px 0 0;font-size:13px;line-height:1.5;color:#f3d6a1;">${ACADEMY}</p>
        </td></tr>
        <tr><td style="padding:24px 20px 20px;">
          <p style="margin:0 0 6px;color:${message.accent};font-size:13px;font-weight:bold;line-height:1.4;">${message.status}</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.12;color:#241b19;">${message.title}</h1>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.5;">Hello, team leader of <strong>${escapeHtml(params.teamName)}</strong>.</p>
          <p style="margin:0;font-size:15px;line-height:1.5;color:#51453e;">${message.message}</p>
          ${message.reason ? `<p style="margin:14px 0 0;padding:10px 12px;background-color:#fff3eb;border-left:3px solid ${message.accent};font-size:14px;line-height:1.5;"><strong>Review note</strong><br>${escapeHtml(message.reason)}</p>` : ''}
        </td></tr>
        ${checkIn ? renderCheckInPass(params, slot, checkIn) : `<tr><td style="padding:0 20px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8ebd1" style="background-color:#f8ebd1;border-left:4px solid #ad2d21;">
            <tr><td style="padding:12px 14px;">
              <p style="margin:0 0 4px;font-size:12px;color:#6a5140;">Team registration ID</p>
              <p style="margin:0;font-family:Consolas,'Courier New',monospace;font-weight:bold;font-size:24px;line-height:1.2;color:#251818;overflow-wrap:anywhere;">${escapeHtml(params.teamCode)}</p>
              ${slot ? `<p style="margin:8px 0 0;font-size:14px;font-weight:bold;color:#116149;">${escapeHtml(slot)}</p>` : ''}
            </td></tr>
          </table>
        </td></tr>`}
        <tr><td style="padding:0 20px 20px;">
          <h2 style="margin:0 0 6px;font-size:17px;color:#241b19;">${checkIn ? 'Payment details' : 'Registration details'}</h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#faf8f4" style="background-color:#faf8f4;">${rows}</table>
        </td></tr>
        <tr><td style="padding:0 20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#a6281d" style="background-color:#a6281d;mso-padding-alt:12px 18px;border-radius:4px;">
              <a href="${escapeHtml(trackUrl)}" style="display:inline-block;padding:12px 18px;color:#ffffff;font-size:15px;line-height:1.4;font-weight:bold;text-decoration:none;">${checkIn ? 'Open pass &amp; download QR' : message.action}</a>
            </td></tr>
          </table>
          ${slot ? `<h2 style="margin:18px 0 6px;font-size:17px;color:#241b19;">Match-day check-in</h2>
          <ul style="margin:0;padding-left:20px;color:#51453e;font-size:14px;line-height:1.55;">${CHECK_IN.map(item => `<li>${item}</li>`).join('')}</ul>` : ''}
        </td></tr>
        <tr><td bgcolor="#f5f0e9" style="padding:16px 20px;background-color:#f5f0e9;border-top:1px solid #e3d8cb;font-size:13px;line-height:1.55;color:#57493f;">
          <strong style="color:#241b19;">Srusti Esports Tournament Desk</strong><br>
          For help, email <a href="mailto:${SUPPORT_EMAIL}" style="color:#962518;overflow-wrap:anywhere;">${SUPPORT_EMAIL}</a>.<br>
          Replies to this automated notification are unmonitored.
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    BRAND,
    ACADEMY,
    '',
    `${message.title} · ${message.status}`,
    `Hello, team leader of ${params.teamName}.`,
    message.message,
    ...(message.reason ? [`Review note: ${message.reason}`] : []),
    '',
    `Team registration ID: ${params.teamCode}`,
    ...(slot ? [slot] : []),
    ...details.map(([label, value]) => `${label}: ${value}`),
    ...(checkIn ? [
      '',
      'Team check-in pass',
      checkInInstructions(checkIn),
      'Registered squad',
      ...(params.members || []).map(member =>
        `${PLAYER_ROLES[member.slotRole]}: ${member.fullName} — ${rosterDetails(member).join(' · ')}`,
      ),
    ] : []),
    '',
    `${checkIn ? 'Open pass and download QR' : message.action}: ${trackUrl}`,
    ...(slot ? ['', 'Match-day check-in', ...CHECK_IN.map(item => `- ${item}`)] : []),
    '',
    `For help, email ${SUPPORT_EMAIL}. Replies to this automated notification are unmonitored.`,
  ].join('\n');

  return { subject, html, text };
}

export async function sendTeamConfirmationEmail(params: TeamConfirmationEmailParams): Promise<EmailSendResult> {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      mode: 'unconfigured',
      error: 'College SMTP credentials are not configured in environment variables.',
    };
  }

  const appUrl = resolveAppUrl();
  const logoPath = path.resolve(process.cwd(), 'public', LOGO_PATH);
  const attachments: Attachment[] = fs.existsSync(logoPath)
    ? [{ filename: 'srusti-esports-logo.png', path: logoPath, cid: 'srusti-esports-logo' }]
    : [];
  const logoSrc = attachments.length ? 'cid:srusti-esports-logo' : `${appUrl}/${LOGO_PATH}`;

  try {
    const checkIn = await createCheckInQr(params, appUrl);
    if (checkIn) {
      attachments.push({
        filename: 'srusti-team-check-in.png',
        content: checkIn.png,
        contentType: 'image/png',
        cid: CHECK_IN_QR_CID,
      });
    }
    const { subject, html, text } = buildTeamConfirmationEmail(params, appUrl, logoSrc, checkIn?.contents);
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      replyTo: process.env.SMTP_REPLY_TO || 'noreply@srustiacademy.ac.in',
      // Tell mail servers and mailbox auto-responders this is an automated, no-reply message.
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
        Precedence: 'bulk',
      },
      to: params.toEmail,
      subject,
      html,
      text,
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
