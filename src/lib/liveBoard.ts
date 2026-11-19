import type { CampusEvent } from './defaultEvents.js';
import type { RegistrationStatus, SlotRole } from './tournamentRules.js';

export interface PublicRosterMember {
  slotRole: SlotRole;
  inGameName: string;
}

export interface PublicRegisteredTeam {
  id: string;
  teamCode: string;
  eventId: string;
  eventTitle: string;
  gameTitle: string;
  teamName: string;
  collegeName: string;
  status: RegistrationStatus;
  groupName: string | null;
  slotNumber: string | null;
  playerCount: number;
  hasSubstitute: boolean;
  rosterIgns: PublicRosterMember[];
  createdAt: string;
  updatedAt: string;
}

export interface EventLiveStats {
  eventId: string;
  slug: string;
  title: string;
  gameTitle: string;
  maxTeams: number;
  isOpen: boolean;
  totalActive: number;
  verifiedCount: number;
  pendingCount: number;
  waitlistedCount: number;
  remainingSlots: number;
  verifiedPercent: number;
  filledPercent: number;
}

export interface LiveBoardSummary {
  totalActive: number;
  verifiedCount: number;
  pendingCount: number;
  waitlistedCount: number;
  totalCapacity: number;
  remainingSlots: number;
  perEvent: EventLiveStats[];
}

export interface GroupSlotCell {
  slotNumber: string;
  groupName: string;
  team: PublicRegisteredTeam | null;
}

export interface RawBundleForPublicBoard {
  registration: {
    id: string;
    teamCode: string;
    eventId: string;
    teamName: string;
    collegeName: string;
    hasSubstitute: boolean;
    status: RegistrationStatus;
    groupName: string | null;
    slotNumber: string | null;
    createdAt: string;
    updatedAt: string;
  };
  event: Pick<CampusEvent, 'id' | 'title' | 'gameTitle'>;
  members: Array<{
    slotRole: SlotRole;
    inGameName: string;
  }>;
}

/**
 * Strips all sensitive personal/payment fields (IGL phone, email, UTR, screenshot paths,
 * student real full names, fee breakdown) and outputs strictly public roster scoreboard fields.
 */
export function sanitizePublicTeam(bundle: RawBundleForPublicBoard): PublicRegisteredTeam {
  const { registration, event, members } = bundle;
  return {
    id: registration.id,
    teamCode: registration.teamCode,
    eventId: registration.eventId,
    eventTitle: event.title,
    gameTitle: event.gameTitle,
    teamName: registration.teamName,
    collegeName: registration.collegeName,
    status: registration.status,
    groupName: registration.groupName,
    slotNumber: registration.slotNumber,
    playerCount: members.length,
    hasSubstitute: registration.hasSubstitute,
    rosterIgns: members.map((m) => ({
      slotRole: m.slotRole,
      inGameName: m.inGameName,
    })),
    createdAt: registration.createdAt,
    updatedAt: registration.updatedAt,
  };
}

/**
 * Computes aggregate and per-event live registration KPIs from active teams.
 */
export function computeLiveBoardSummary(
  events: CampusEvent[],
  teams: PublicRegisteredTeam[]
): LiveBoardSummary {
  let totalActive = 0;
  let verifiedCount = 0;
  let pendingCount = 0;
  let waitlistedCount = 0;
  let totalCapacity = 0;
  let remainingSlots = 0;

  const perEvent: EventLiveStats[] = events.map((evt) => {
    const evtTeams = teams.filter((t) => t.eventId === evt.id && t.status !== 'rejected');
    const evtVerified = evtTeams.filter((t) => t.status === 'verified').length;
    const evtPending = evtTeams.filter(
      (t) => t.status === 'pending' || t.status === 'reupload_required'
    ).length;
    const evtWaitlisted = evtTeams.filter((t) => t.status === 'waitlisted').length;
    const evtActive = evtTeams.length;
    const evtRemaining = Math.max(0, evt.maxTeams - evtActive);

    totalActive += evtActive;
    verifiedCount += evtVerified;
    pendingCount += evtPending;
    waitlistedCount += evtWaitlisted;
    totalCapacity += evt.maxTeams;
    remainingSlots += evtRemaining;

    return {
      eventId: evt.id,
      slug: evt.slug,
      title: evt.title,
      gameTitle: evt.gameTitle,
      maxTeams: evt.maxTeams,
      isOpen: evt.isOpen,
      totalActive: evtActive,
      verifiedCount: evtVerified,
      pendingCount: evtPending,
      waitlistedCount: evtWaitlisted,
      remainingSlots: evtRemaining,
      verifiedPercent:
        evt.maxTeams > 0 ? Math.min(100, Math.round((evtVerified / evt.maxTeams) * 100)) : 0,
      filledPercent:
        evt.maxTeams > 0 ? Math.min(100, Math.round((evtActive / evt.maxTeams) * 100)) : 0,
    };
  });

  return {
    totalActive,
    verifiedCount,
    pendingCount,
    waitlistedCount,
    totalCapacity,
    remainingSlots,
    perEvent,
  };
}

/**
 * Client-side filter over public registered teams by event, status bucket, and search query.
 */
export function filterLiveTeams(
  teams: PublicRegisteredTeam[],
  filters: {
    eventId?: string;
    status?: 'all' | 'verified' | 'pending' | 'waitlisted';
    search?: string;
  }
): PublicRegisteredTeam[] {
  const query = (filters.search || '').trim().toLowerCase();
  const eventId = filters.eventId || 'all';
  const status = filters.status || 'all';

  return teams.filter((team) => {
    if (team.status === 'rejected') return false;
    if (eventId !== 'all' && team.eventId !== eventId) return false;

    if (status === 'verified' && team.status !== 'verified') return false;
    if (
      status === 'pending' &&
      team.status !== 'pending' &&
      team.status !== 'reupload_required'
    ) {
      return false;
    }
    if (status === 'waitlisted' && team.status !== 'waitlisted') return false;

    if (!query) return true;

    const matchesMeta =
      team.teamCode.toLowerCase().includes(query) ||
      team.teamName.toLowerCase().includes(query) ||
      team.collegeName.toLowerCase().includes(query) ||
      (team.slotNumber || '').toLowerCase().includes(query);

    if (matchesMeta) return true;

    return team.rosterIgns.some((member) =>
      member.inGameName.toLowerCase().includes(query)
    );
  });
}

/**
 * Maps verified squads for a single event into deterministic Group A & Group B LAN slot grids.
 */
export function buildGroupSlotGrid(
  teams: PublicRegisteredTeam[],
  eventId: string,
  maxTeams = 24
): { groupA: GroupSlotCell[]; groupB: GroupSlotCell[] } {
  const safeMax = Math.max(2, maxTeams);
  const half = Math.ceil(safeMax / 2);
  const slotMap = new Map<string, PublicRegisteredTeam>();

  for (const team of teams) {
    if (team.eventId === eventId && team.status === 'verified' && team.slotNumber) {
      slotMap.set(team.slotNumber.toUpperCase(), team);
    }
  }

  const groupA: GroupSlotCell[] = [];
  for (let i = 1; i <= half; i += 1) {
    const slotNumber = `A${i}`;
    groupA.push({
      slotNumber,
      groupName: 'Group A',
      team: slotMap.get(slotNumber) || null,
    });
  }

  const groupB: GroupSlotCell[] = [];
  for (let i = 1; i <= safeMax - half; i += 1) {
    const slotNumber = `B${i}`;
    groupB.push({
      slotNumber,
      groupName: 'Group B',
      team: slotMap.get(slotNumber) || null,
    });
  }

  return { groupA, groupB };
}
