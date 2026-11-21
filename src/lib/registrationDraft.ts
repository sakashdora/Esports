import type { PlayerInput } from './tournamentRules';

/**
 * Unfinished registrations are kept in this browser so a refresh, a closed tab or a dropped
 * connection does not wipe what the participant typed. Nothing is sent to the server until
 * they submit, and the draft is deleted on success.
 */
export interface RegistrationDraft {
  version: 1;
  savedAt: number;
  eventSlug: string;
  step: 1 | 2 | 3;
  teamName: string;
  collegeName: string;
  iglPhone: string;
  iglEmail: string;
  hasSubstitute: boolean;
  members: PlayerInput[];
  eligibilityConfirmed: boolean;
  fairPlayConfirmed: boolean;
  activeSkillConfirmed: boolean;
  utrNumber: string;
  upiApp: string;
}

const DRAFT_KEY = 'samt_registration_draft_v1';
const LAST_TEAM_KEY = 'samt_last_team_code';
// Shared computers (college labs): do not keep personal details around for long.
const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const ROLES = ['IGL', 'P2', 'P3', 'P4', 'SUB'];

function isDraft(value: unknown): value is RegistrationDraft {
  const d = value as Partial<RegistrationDraft> | null;
  return Boolean(
    d &&
      d.version === 1 &&
      typeof d.savedAt === 'number' &&
      typeof d.eventSlug === 'string' &&
      [1, 2, 3].includes(Number(d.step)) &&
      typeof d.teamName === 'string' &&
      typeof d.collegeName === 'string' &&
      typeof d.iglPhone === 'string' &&
      typeof d.iglEmail === 'string' &&
      Array.isArray(d.members) &&
      d.members.every(
        (m) =>
          m &&
          ROLES.includes(m.slotRole) &&
          typeof m.fullName === 'string' &&
          typeof m.inGameName === 'string' &&
          typeof m.characterId === 'string' &&
          typeof m.wantsLunch === 'boolean'
      )
  );
}

export function loadDraft(): RegistrationDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isDraft(parsed) || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<RegistrationDraft, 'version' | 'savedAt'>): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, version: 1, savedAt: Date.now() }));
  } catch {
    // Private mode or full storage: the form still works, it just cannot be restored.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The Team ID of the last submitted registration, to prefill the status page. */
export function rememberTeamCode(teamCode: string): void {
  try {
    localStorage.setItem(LAST_TEAM_KEY, teamCode);
  } catch {
    // Optional convenience only.
  }
}

export function lastTeamCode(): string {
  try {
    return localStorage.getItem(LAST_TEAM_KEY) || '';
  } catch {
    return '';
  }
}
