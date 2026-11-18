export type GameSlug = 'kalinga-warriors-bgmi' | 'kurukshetra-free-fire' | string;

export type DietType = 'VEG' | 'NON_VEG' | 'NONE';

export type SlotRole = 'IGL' | 'P2' | 'P3' | 'P4' | 'SUB';

export type RegistrationStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'reupload_required'
  | 'waitlisted';

export interface PlayerInput {
  slotRole: SlotRole;
  fullName: string;
  inGameName: string;
  characterId: string;
  academicLevel: string;
  collegeOverride?: string;
  wantsLunch: boolean;
  dietType: DietType;
}

export interface FeeBreakdown {
  baseFee: number;
  lunchFeePerTeam: number;
  lunchCount: number;
  vegCount: number;
  nonVegCount: number;
  lunchTotal: number;
  totalFee: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Computes exact tournament registration fee using the official rule:
 * Base Team Fee (Rs. 299) + one optional team lunch charge (Rs. 100).
 */
export function calculateRegistrationFee(
  members: Pick<PlayerInput, 'wantsLunch' | 'dietType'>[],
  baseFee = 299,
  lunchFeePerTeam = 100
): FeeBreakdown {
  let lunchCount = 0;
  let vegCount = 0;
  let nonVegCount = 0;

  for (const member of members) {
    if (member.wantsLunch) {
      lunchCount += 1;
      if (member.dietType === 'NON_VEG') {
        nonVegCount += 1;
      } else {
        vegCount += 1;
      }
    }
  }

  const lunchTotal = lunchCount > 0 ? lunchFeePerTeam : 0;
  return {
    baseFee,
    lunchFeePerTeam,
    lunchCount,
    vegCount,
    nonVegCount,
    lunchTotal,
    totalFee: baseFee + lunchTotal,
  };
}

/**
 * Validates Indian 12-digit NPCI UTR / UPI Reference Number.
 */
export function normalizeUtr(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isValidUtr(raw: string): boolean {
  const normalized = normalizeUtr(raw);
  // NPCI standard UPI RRN / UTR is 12 digits; some banks prefix with 12-22 alphanumeric chars
  return /^\d{12}$/.test(normalized) || /^[A-Z0-9]{12,22}$/.test(normalized);
}

export function isStrict12DigitUtr(raw: string): boolean {
  return /^\d{12}$/.test(normalizeUtr(raw));
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function isValidIndianPhone(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(raw));
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/**
 * Generates an NPCI standard UPI deep-link URI when a VPA is configured.
 */
export function buildUpiIntentUri(params: {
  vpa: string;
  payeeName: string;
  amount: number;
  teamCode: string;
  eventTitle: string;
}): string {
  const search = new URLSearchParams({
    pa: params.vpa.trim(),
    pn: params.payeeName.trim(),
    am: params.amount.toFixed(2),
    cu: 'INR',
    tn: `${params.teamCode} ${params.eventTitle}`.slice(0, 50),
    tr: params.teamCode,
  });
  return `upi://pay?${search.toString()}`;
}

/**
 * Assigns deterministic LAN group & slot number (A1..A12, B1..B12) from verified count.
 */
export function assignTournamentSlot(verifiedIndexZeroBased: number, maxTeams = 24): {
  groupName: string;
  slotNumber: string;
} {
  if (verifiedIndexZeroBased < 0 || verifiedIndexZeroBased >= maxTeams) {
    return {
      groupName: 'Waitlist',
      slotNumber: `WL-${verifiedIndexZeroBased - maxTeams + 1}`,
    };
  }
  const half = Math.ceil(maxTeams / 2);
  if (verifiedIndexZeroBased < half) {
    return {
      groupName: 'Group A',
      slotNumber: `A${verifiedIndexZeroBased + 1}`,
    };
  }
  return {
    groupName: 'Group B',
    slotNumber: `B${verifiedIndexZeroBased - half + 1}`,
  };
}

/**
 * Generates a unique readable team registration code (e.g., KW26-001 or FF26-004).
 */
export function formatTeamCode(prefix: string, sequenceNumber: number): string {
  const cleanPrefix = prefix.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6) || 'EVT26';
  return `${cleanPrefix}-${String(sequenceNumber).padStart(3, '0')}`;
}

/**
 * Validates full squad registration inputs before fee & proof submission.
 */
export function validateSquadSubmission(input: {
  eventSlug: string;
  teamName: string;
  collegeName: string;
  iglPhone: string;
  iglEmail: string;
  hasSubstitute: boolean;
  members: PlayerInput[];
  eligibilityConfirmed: boolean;
  fairPlayConfirmed: boolean;
  activeSkillConfirmed?: boolean;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!Array.isArray(input.members) || input.members.some((member) =>
    !member || !['IGL', 'P2', 'P3', 'P4', 'SUB'].includes(member.slotRole) ||
    ['fullName', 'inGameName', 'characterId', 'academicLevel'].some(key =>
      typeof member[key as keyof PlayerInput] !== 'string') ||
    typeof member.wantsLunch !== 'boolean'
  )) {
    return { valid: false, errors: { members: 'Provide a valid squad roster.' } };
  }

  if (!input.teamName.trim() || input.teamName.trim().length < 2) {
    errors.teamName = 'Team Name must be at least 2 characters.';
  }
  if (!input.collegeName.trim() || input.collegeName.trim().length < 3) {
    errors.collegeName = 'College / Institution name is required.';
  }
  if (!isValidIndianPhone(input.iglPhone)) {
    errors.iglPhone = 'Enter a valid 10-digit Indian mobile / WhatsApp number.';
  }
  if (!isValidEmail(input.iglEmail)) {
    errors.iglEmail = 'Enter a valid Team Leader (IGL) email address.';
  }

  const requiredRoles: SlotRole[] = ['IGL', 'P2', 'P3', 'P4'];
  const activeMembers = input.members.filter((m) =>
    input.hasSubstitute ? true : m.slotRole !== 'SUB'
  );
  const expectedCount = input.hasSubstitute ? 5 : 4;
  if (activeMembers.length !== expectedCount || new Set(activeMembers.map(m => m.slotRole)).size !== expectedCount) {
    errors.members = 'Provide exactly four active players and, if selected, one substitute.';
  }

  for (const role of requiredRoles) {
    if (!activeMembers.find((m) => m.slotRole === role)) {
      errors[`member_${role}`] = `Player ${role} details are required.`;
    }
  }

  const seenCharacterIds = new Set<string>();
  activeMembers.forEach((member) => {
    const prefix = `member_${member.slotRole}`;
    if (!member.fullName.trim()) {
      errors[`${prefix}_fullName`] = 'Full real name is required.';
    }
    if (!member.inGameName.trim()) {
      errors[`${prefix}_inGameName`] = 'In-Game Name (IGN) is required.';
    }
    const cleanId = member.characterId.trim().toLowerCase();
    if (!cleanId) {
      errors[`${prefix}_characterId`] = 'Character ID is required.';
    } else if (seenCharacterIds.has(cleanId)) {
      errors[`${prefix}_characterId`] = 'Duplicate Character ID within the same squad.';
    } else {
      seenCharacterIds.add(cleanId);
    }
    if (member.wantsLunch && member.dietType !== 'VEG' && member.dietType !== 'NON_VEG') {
      errors[`${prefix}_dietType`] = 'Select VEG or NON-VEG for lunch add-on.';
    }
  });

  if (!input.eligibilityConfirmed) {
    errors.eligibilityConfirmed = 'Confirm age (16–22) or Class 11–UG eligibility and valid College ID.';
  }
  if (!input.fairPlayConfirmed) {
    errors.fairPlayConfirmed = 'Accept the mobile-only hardware and anti-cheating rulebook.';
  }
  if (input.eventSlug === 'kurukshetra-free-fire' && !input.activeSkillConfirmed) {
    errors.activeSkillConfirmed =
      'Confirm the Free Fire rule: each squad player must equip a different active skill.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Escapes HTML special characters to prevent injection in transactional emails.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escapes CSV cell values cleanly.
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const str = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const OFFICIAL_REGISTRATION_DEADLINE_ISO = '2026-12-05T18:00:00+05:30';

export interface CountdownBreakdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

/**
 * Resolves an explicit ISO/date registration deadline string when provided,
 * falling back to the official championship deadline when only descriptive copy exists.
 */
export function resolveDeadlineTimestamp(
  deadlineText?: string,
  fallbackIso = OFFICIAL_REGISTRATION_DEADLINE_ISO
): number {
  const trimmed = (deadlineText || '').trim();
  if (trimmed && /20\d{2}/.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.parse(fallbackIso);
}

/**
 * Computes remaining Days, Hours, Minutes, and Seconds until targetMs.
 */
export function computeCountdown(targetMs: number, nowMs = Date.now()): CountdownBreakdown {
  const diffMs = targetMs - nowMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const totalSeconds = Math.ceil(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, expired: false };
}
