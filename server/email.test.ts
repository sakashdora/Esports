import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTeamConfirmationEmail } from './email.js';

const input = {
  toEmail: 'leader@example.test',
  teamCode: 'KW26-003',
  teamName: 'Arena & Squad',
  eventTitle: 'Kalinga Warriors',
  gameTitle: 'BGMI',
  status: 'pending' as const,
  totalFee: 399,
  lunchCount: 2,
  vegCount: 1,
  nonVegCount: 1,
  utrNumber: '123456789012',
};

test('participant messages use bracket-free Srusti Esports subjects and the full academy name', () => {
  const cases = [
    { status: 'pending', title: 'Registration Received', action: 'Track registration' },
    { status: 'verified', title: 'Slot Confirmed', action: 'Open team pass' },
    { status: 'reupload_required', title: 'Payment Proof Re-upload Required', action: 'Update payment proof' },
    { status: 'rejected', title: 'Registration Not Approved', action: 'Review team status' },
  ] as const;

  for (const { status, title, action } of cases) {
    const email = buildTeamConfirmationEmail(
      { ...input, status, groupName: 'Group A', slotNumber: 'A1', rejectionReason: '<unreadable>' },
      'https://esports.example.test',
      'cid:srusti-esports-logo',
    );
    assert.equal(email.subject, `Srusti Esports 2026 — ${title} — KW26-003`);
    for (const version of [email.html, email.text]) {
      assert.ok(version.includes('Srusti Academy of Management and Technology (Autonomous)'));
      assert.ok(version.includes('https://esports.example.test/track?code=KW26-003'));
      assert.ok(version.includes(action));
      assert.equal(version.includes('Group A · Seat A1'), status === 'verified');
    }
    assert.ok(email.html.includes('Arena &amp; Squad'));
    assert.equal(email.html.includes('<unreadable>'), false);
    assert.equal(email.html.includes('&lt;unreadable&gt;'), status === 'rejected' || status === 'reupload_required');
  }
});
