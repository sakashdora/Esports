import type { CampusEvent } from './defaultEvents.js';

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

export interface LiveBoardSnapshot {
  summary: LiveBoardSummary;
  generatedAt: string;
}

/**
 * Computes aggregate and per-event live registration KPIs from active teams.
 */
export function computeLiveBoardSummary(events: CampusEvent[]): LiveBoardSummary {
  let totalActive = 0;
  let verifiedCount = 0;
  let pendingCount = 0;
  let waitlistedCount = 0;
  let totalCapacity = 0;
  let remainingSlots = 0;

  const perEvent: EventLiveStats[] = events.map((evt) => {
    const evtActive = evt.registeredCount ?? 0;
    const evtVerified = evt.verifiedCount ?? 0;
    const evtPending = evt.pendingCount ?? 0;
    const evtWaitlisted = Math.max(0, evtActive - evtVerified - evtPending);
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
