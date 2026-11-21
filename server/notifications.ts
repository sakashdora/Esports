import { waitUntil } from '@vercel/functions';
import { sendTeamConfirmationEmail } from './email.js';
import { recordEmailAudit, type RegistrationBundle } from './store.js';

/** Keep mail alive after the response on Vercel. Delivery is best effort, not a durable queue.
 * Failed/undelivered mail can be resent by an administrator; the saved registration is authoritative.
 */
export function scheduleConfirmation(bundle: RegistrationBundle, deliver = deliverConfirmation) {
  waitUntil(deliver(bundle).catch(() => {
    // Never log SMTP responses, credentials, addresses, or registration identifiers.
    console.error('[notification] delivery or audit failed; use admin resend');
  }));
}

export async function deliverConfirmation(
  bundle: RegistrationBundle,
  send = sendTeamConfirmationEmail,
  audit = recordEmailAudit,
) {
  const r = bundle.registration;
  const started = performance.now();
  const status = r.status === 'verified' || r.status === 'rejected' || r.status === 'reupload_required'
    ? r.status : 'pending';
  let sent = false;
  try {
    const result = await send({
      toEmail: r.iglEmail, teamCode: r.teamCode, teamName: r.teamName,
      eventTitle: bundle.event.title, gameTitle: bundle.event.gameTitle, status,
      totalFee: r.totalFee, lunchCount: r.lunchCount, vegCount: r.vegCount,
      nonVegCount: r.nonVegCount, utrNumber: bundle.proofs[0]?.utrNumber || '',
      slotNumber: r.slotNumber, groupName: r.groupName, rejectionReason: r.rejectionReason,
      venueLabel: bundle.event.venueLabel, eventDateLabel: bundle.event.eventDateLabel,
    });
    sent = result.sent;
  } finally {
    await audit(r.id, sent, sent ? `Sent ${status} notification` : `${status} notification failed or SMTP unavailable; admin can resend`, r.status);
    console.info(JSON.stringify({ operation: 'notification', durationMs: Math.round(performance.now() - started), sent }));
  }
}
