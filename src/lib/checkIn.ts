export const VOLUNTEER_TOKEN_KEY = 'samt_volunteer_token';
export const VOLUNTEER_ID_KEY = 'samt_volunteer_id';
export const CHECK_IN_PAGE_SIZE = 25;

type SeatDetails = { status: string; slotNumber?: string | null; groupName?: string | null };

export function isWaitlistSlot({ slotNumber, groupName }: SeatDetails): boolean {
  return /^WL-/i.test(slotNumber?.trim() || '') || groupName?.trim().toLowerCase() === 'waitlist';
}

export function confirmedSeat(registration: SeatDetails): string {
  const slot = registration.slotNumber?.trim() || '';
  if (registration.status !== 'verified' || !slot || isWaitlistSlot(registration)) return '';
  return `${registration.groupName?.trim() || 'Main Bracket'} · Seat ${slot}`;
}

export interface VolunteerAccount {
  loginId: string;
}

export interface AttendanceMark {
  memberId: string;
  checkedInAt: string;
  checkedInBy: string;
}

export interface AttendanceEntry extends AttendanceMark {
  fullName: string;
  teamName: string;
  teamCode: string;
}

export interface CheckInSquad {
  teamName: string;
  teamCode: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  seat: string;
  players: Array<{
    id: string;
    fullName: string;
    slotRole: string;
    inGameName: string;
    characterId: string;
    college: string;
    academicLevel: string;
    wantsLunch: boolean;
    dietType: string;
    attendance: AttendanceMark | null;
  }>;
}
