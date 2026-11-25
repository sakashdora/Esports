import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignFirstFreeTournamentSlot,
  assignTournamentSlot,
  buildUpiIntentUri,
  calculateRegistrationFee,
  computeCountdown,
  escapeHtml,
  escapeCsvCell,
  formatTeamCode,
  isStrict12DigitUtr,
  isValidEmail,
  isValidIndianPhone,
  isValidUpiVpa,
  normalizePhone,
  OFFICIAL_REGISTRATION_DEADLINE_ISO,
  OTHER_ACADEMIC_LEVEL,
  resolveDeadlineTimestamp,
  validateSquadSubmission,
  type PlayerInput,
} from './tournamentRules';

function makeMembers(lunchFlags: Array<{ lunch: boolean; diet: 'VEG' | 'NON_VEG' | 'NONE' }>): PlayerInput[] {
  const roles: Array<'IGL' | 'P2' | 'P3' | 'P4' | 'SUB'> = ['IGL', 'P2', 'P3', 'P4', 'SUB'];
  return lunchFlags.map((flag, idx) => ({
    slotRole: roles[idx],
    fullName: `Player ${idx + 1}`,
    inGameName: `IGN_${idx + 1}`,
    characterId: `51000000${idx + 1}`,
    academicLevel: 'UG',
    collegeOverride: `College ${idx + 1}`,
    wantsLunch: flag.lunch,
    dietType: flag.diet,
  }));
}

test('calculateRegistrationFee applies Rs. 299 base + Rs. 100 once per team opting for lunch', () => {
  const noLunch = calculateRegistrationFee(
    makeMembers([
      { lunch: false, diet: 'NONE' },
      { lunch: false, diet: 'NONE' },
      { lunch: false, diet: 'NONE' },
      { lunch: false, diet: 'NONE' },
    ])
  );
  assert.equal(noLunch.totalFee, 299);
  assert.equal(noLunch.lunchCount, 0);

  const twoMeals = calculateRegistrationFee(
    makeMembers([
      { lunch: true, diet: 'VEG' },
      { lunch: false, diet: 'NONE' },
      { lunch: true, diet: 'NON_VEG' },
      { lunch: false, diet: 'NONE' },
    ])
  );
  assert.equal(twoMeals.baseFee, 299);
  assert.equal(twoMeals.lunchCount, 2);
  assert.equal(twoMeals.vegCount, 1);
  assert.equal(twoMeals.nonVegCount, 1);
  assert.equal(twoMeals.lunchTotal, 100);
  assert.equal(twoMeals.totalFee, 399);

  const fiveMeals = calculateRegistrationFee(
    makeMembers([
      { lunch: true, diet: 'VEG' },
      { lunch: true, diet: 'VEG' },
      { lunch: true, diet: 'NON_VEG' },
      { lunch: true, diet: 'NON_VEG' },
      { lunch: true, diet: 'VEG' },
    ])
  );
  assert.equal(fiveMeals.totalFee, 399);
  assert.equal(fiveMeals.vegCount, 3);
  assert.equal(fiveMeals.nonVegCount, 2);
});

test('UTR, phone, and email validation enforce clean formats', () => {
  assert.equal(isStrict12DigitUtr('432198765432'), true);
  assert.equal(isStrict12DigitUtr('4321 9876 5432'), true);
  assert.equal(isStrict12DigitUtr('12345'), false);
  assert.equal(isStrict12DigitUtr('ABC123456789'), false);

  assert.equal(normalizePhone('+91 98765-43210'), '9876543210');
  assert.equal(isValidIndianPhone('9876543210'), true);
  assert.equal(isValidIndianPhone('1234567890'), false);

  assert.equal(isValidEmail('leader@srustiacademy.edu.in'), true);
  assert.equal(isValidEmail('invalid-email'), false);
});

test('CSV export neutralizes spreadsheet formulas', () => {
  assert.equal(escapeCsvCell('=1+1'), "'=1+1");
  assert.equal(escapeCsvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(escapeCsvCell('Squad One'), 'Squad One');
});

test('roster validation rejects malformed and duplicated roles', () => {
  const input = {
    eventSlug: 'kalinga-warriors-bgmi', teamName: 'Test', collegeName: 'College',
    iglPhone: '9876543210', iglEmail: 'test@example.test', hasSubstitute: false,
    eligibilityConfirmed: true, fairPlayConfirmed: true,
    members: makeMembers(Array.from({ length: 4 }, () => ({ lunch: false, diet: 'NONE' as const }))),
  };
  input.members[3].slotRole = 'P3';
  assert.equal(validateSquadSubmission(input).valid, false);
  assert.equal(validateSquadSubmission({ ...input, members: [null] as unknown as PlayerInput[] }).valid, false);
});

test('each active player needs a college and Other needs a course', () => {
  const members = makeMembers(Array.from({ length: 5 }, () => ({ lunch: false, diet: 'NONE' as const })));
  members[1].academicLevel = OTHER_ACADEMIC_LEVEL;
  members[1].otherAcademicLevel = ' ';
  members[2].collegeOverride = '';
  members[4].collegeOverride = undefined;
  const input = {
    eventSlug: 'kalinga-warriors-bgmi', teamName: 'Test', collegeName: 'College',
    iglPhone: '9876543210', iglEmail: 'test@example.test', hasSubstitute: true,
    eligibilityConfirmed: true, fairPlayConfirmed: true, members,
  };
  const { errors } = validateSquadSubmission(input);
  assert.ok(errors.member_P2_otherAcademicLevel);
  assert.ok(errors.member_P3_collegeOverride);
  assert.ok(errors.member_SUB_collegeOverride);
  members[1].otherAcademicLevel = 'MBA';
  members[2].collegeOverride = 'Player Three College';
  assert.equal(validateSquadSubmission({ ...input, hasSubstitute: false }).valid, true);
  members[4].collegeOverride = 'Player Five College';
  assert.equal(validateSquadSubmission(input).valid, true);
});

test('assignTournamentSlot assigns Group A (1-12), Group B (1-12), and Waitlist', () => {
  assert.deepEqual(assignTournamentSlot(0, 24), { groupName: 'Group A', slotNumber: 'A1' });
  assert.deepEqual(assignTournamentSlot(11, 24), { groupName: 'Group A', slotNumber: 'A12' });
  assert.deepEqual(assignTournamentSlot(12, 24), { groupName: 'Group B', slotNumber: 'B1' });
  assert.deepEqual(assignTournamentSlot(23, 24), { groupName: 'Group B', slotNumber: 'B12' });
  assert.deepEqual(assignTournamentSlot(24, 24), { groupName: 'Waitlist', slotNumber: 'WL-1' });
  assert.equal(formatTeamCode('KW26', 7), 'KW26-007');
});

test('assignFirstFreeTournamentSlot reuses vacated seats and never duplicates an occupied one', () => {
  assert.deepEqual(assignFirstFreeTournamentSlot([], 24), { groupName: 'Group A', slotNumber: 'A1' });
  // A1 was vacated by a rejected team; A2 is still held, so the next approval gets A1, not A2.
  assert.deepEqual(assignFirstFreeTournamentSlot(['A2'], 24), { groupName: 'Group A', slotNumber: 'A1' });
  assert.deepEqual(assignFirstFreeTournamentSlot(['A1', null, 'a2'], 24), { groupName: 'Group A', slotNumber: 'A3' });
  const full = Array.from({ length: 4 }, (_, i) => assignTournamentSlot(i, 4).slotNumber);
  assert.deepEqual(assignFirstFreeTournamentSlot(full, 4), { groupName: 'Waitlist', slotNumber: 'WL-1' });
  assert.deepEqual(assignFirstFreeTournamentSlot([...full, 'WL-1'], 4), { groupName: 'Waitlist', slotNumber: 'WL-2' });
});

test('validateSquadSubmission catches duplicate character IDs and Free Fire skill rule', () => {
  const members = makeMembers([
    { lunch: true, diet: 'VEG' },
    { lunch: false, diet: 'NONE' },
    { lunch: false, diet: 'NONE' },
    { lunch: false, diet: 'NONE' },
  ]);
  members[2].characterId = members[0].characterId; // duplicate inside squad

  const res = validateSquadSubmission({
    eventSlug: 'kurukshetra-free-fire',
    teamName: 'Kalinga Strikers',
    collegeName: 'Srusti Academy of Management and Technology',
    iglPhone: '9876543210',
    iglEmail: 'igl@example.com',
    hasSubstitute: false,
    members,
    eligibilityConfirmed: true,
    fairPlayConfirmed: true,
    activeSkillConfirmed: false,
  });

  assert.equal(res.valid, false);
  assert.ok(res.errors.member_P3_characterId);
  assert.ok(res.errors.activeSkillConfirmed);
});

test('buildUpiIntentUri & escapeHtml work securely', () => {
  const uri = buildUpiIntentUri({
    vpa: 'samt@sbi',
    payeeName: 'Srusti Academy',
    amount: 499,
    teamCode: 'KW26-001',
    eventTitle: 'Kalinga Warriors BGMI',
  });
  assert.ok(uri.startsWith('upi://pay?'));
  assert.ok(uri.includes('am=499.00'));
  assert.ok(uri.includes('pn=Srusti%20Academy'));
  assert.ok(!uri.includes('+'));
  assert.ok(!uri.includes('tr='));
  assert.ok(isValidUpiVpa('samt@sbi'));
  assert.ok(!isValidUpiVpa('samt sbi'));

  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('resolveDeadlineTimestamp & computeCountdown compute accurate remaining time and clamp expiration', () => {
  const fallbackTarget = resolveDeadlineTimestamp('Open until 24 squad slots fill');
  assert.equal(fallbackTarget, Date.parse(OFFICIAL_REGISTRATION_DEADLINE_ISO));

  const customTarget = resolveDeadlineTimestamp('2026-12-10T12:00:00Z');
  assert.equal(customTarget, Date.parse('2026-12-10T12:00:00Z'));

  const twoDaysPlusMs = ((2 * 86400) + (5 * 3600) + (14 * 60) + 9) * 1000;
  const now = customTarget - twoDaysPlusMs;
  assert.deepEqual(computeCountdown(customTarget, now), {
    days: 2,
    hours: 5,
    minutes: 14,
    seconds: 9,
    expired: false,
  });

  assert.deepEqual(computeCountdown(customTarget, customTarget + 5000), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: true,
  });
});

test('entry countdown uses IST and never expires before the target instant', () => {
  const entry = Date.parse('2026-12-13T09:30:00+05:30');
  assert.equal(entry, Date.parse('2026-12-13T04:00:00Z'));
  assert.deepEqual(computeCountdown(entry, entry - 1), { days: 0, hours: 0, minutes: 0, seconds: 1, expired: false });
  assert.deepEqual(computeCountdown(entry, entry), { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
  assert.equal(computeCountdown(Number.NaN).expired, true);
});
