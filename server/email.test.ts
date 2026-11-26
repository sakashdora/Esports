import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { buildTeamConfirmationEmail, createCheckInQr, type TeamConfirmationEmailParams } from './email.js';
import { EVENT_DATE_LABEL } from '../src/lib/defaultEvents.js';

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

const appUrl = 'https://esports.example.test';
const approved: TeamConfirmationEmailParams = {
  ...input,
  status: 'verified',
  groupName: 'Group A',
  slotNumber: 'A1',
  venueLabel: 'SAMT Campus LAN Arena',
  eventDateLabel: EVENT_DATE_LABEL,
  members: [
    { slotRole: 'IGL', fullName: 'Demo <Captain>', inGameName: 'Nova', characterId: '100001', academicLevel: 'MBA', collegeOverride: 'Demo College', wantsLunch: true, dietType: 'VEG' },
    { slotRole: 'SUB', fullName: 'Demo Substitute', inGameName: 'Orbit', characterId: '100005', academicLevel: 'UG', wantsLunch: false, dietType: 'NONE' },
  ],
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

test('confirmed seat generates a PNG with the full check-in roster and entry details', async () => {
  const qr = await createCheckInQr(approved, appUrl);
  assert.ok(qr);
  assert.equal(qr.contents, 'roster');
  assert.equal(qr.png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const png = PNG.sync.read(qr.png);
  assert.equal(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data, qr.encoded);
  const center = ((png.height >> 1) * png.width + (png.width >> 1)) * 4;
  assert.notDeepEqual([...png.data.subarray(center, center + 3)], [15, 25, 48]);
  assert.notDeepEqual([...png.data.subarray(center, center + 3)], [255, 255, 255]);
  for (const detail of [EVENT_DATE_LABEL, 'KW26-003', 'Group A · Seat A1', 'Demo College', 'MBA', 'Veg lunch', 'Demo Substitute', 'Orbit', '100005']) {
    assert.ok(qr.encoded.includes(detail), detail);
  }
  assert.ok(!qr.encoded.includes(approved.toEmail));
  assert.ok(!qr.encoded.includes(approved.utrNumber));
  const email = buildTeamConfirmationEmail(approved, appUrl, 'cid:srusti-esports-logo', qr.contents);
  assert.ok(email.html.includes('cid:srusti-team-check-in'));
  assert.ok(email.html.includes('Demo &lt;Captain&gt;'));
  assert.ok(email.text.includes(EVENT_DATE_LABEL));
  assert.ok(email.text.includes('Demo Substitute'));
});

test('waitlist, pending and unassigned registrations omit the check-in QR', async () => {
  for (const change of [
    { status: 'pending' as const },
    { slotNumber: null },
    { groupName: 'Waitlist', slotNumber: 'WL-1' },
  ]) {
    const params = { ...approved, ...change };
    assert.equal(await createCheckInQr(params, appUrl), null);
    assert.ok(!buildTeamConfirmationEmail(params, appUrl, '', 'roster').html.includes('cid:srusti-team-check-in'));
  }
  const waitlisted = buildTeamConfirmationEmail({ ...approved, slotNumber: 'WL-1' }, appUrl, '');
  assert.ok(waitlisted.subject.includes('Waitlisted'));
  assert.ok(!waitlisted.text.includes('Slot Confirmed'));
});

test('an oversized roster keeps its full written details and opens private tracking by QR', async () => {
  const params = {
    ...approved,
    members: (['IGL', 'P2', 'P3', 'P4', 'SUB'] as const).map(slotRole => ({
      ...approved.members![0], slotRole,
      fullName: 'ଅ'.repeat(60), inGameName: 'ଆ'.repeat(30),
      collegeOverride: 'କ'.repeat(120), academicLevel: 'ମ'.repeat(80),
    })),
  };
  const qr = await createCheckInQr(params, appUrl);
  assert.equal(qr?.contents, 'status');
  assert.equal(qr?.encoded, `${appUrl}/track?code=KW26-003`);
  const png = PNG.sync.read(qr!.png);
  assert.equal(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data, qr?.encoded);
  const email = buildTeamConfirmationEmail(params, appUrl, '', qr?.contents);
  assert.ok(email.text.includes(params.members[0].collegeOverride));
  assert.ok(email.html.includes('private roster'));
});
