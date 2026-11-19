import {
  ArrowRight,
  CheckCircle2,
  Clock,
  LayoutGrid,
  ListFilter,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CampusEvent } from '../lib/defaultEvents';
import { getEventBannerUrl } from '../lib/eventArtwork';
import {
  buildGroupSlotGrid,
  computeLiveBoardSummary,
  filterLiveTeams,
  type PublicRegisteredTeam,
} from '../lib/liveBoard';
import type { AppRoute } from './Navbar';

interface LiveDashboardViewProps {
  initialEvents: CampusEvent[];
  onNavigate: (next: AppRoute) => void;
}

export function LiveDashboardView({ initialEvents, onNavigate }: LiveDashboardViewProps) {
  const [events, setEvents] = useState<CampusEvent[]>(initialEvents);
  const [teams, setTeams] = useState<PublicRegisteredTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [streamState, setStreamState] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  const [eventFilter, setEventFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'waitlisted'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'ledger' | 'matrix'>('ledger');

  const fetchBoardSnapshot = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/live-registrations', { cache: 'no-store' });
      if (!res.ok) throw new Error('Unable to load live registrations.');
      const data = await res.json();
      if (Array.isArray(data.events)) setEvents(data.events);
      if (Array.isArray(data.teams)) setTeams(data.teams);
      setLastSyncedAt(data.generatedAt || new Date().toISOString());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sync live registration board.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchBoardSnapshot(false);

    let es: EventSource | null = null;
    if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
      es = new EventSource('/api/live-registrations/stream');
      es.onopen = () => {
        setStreamState('live');
      };
      es.addEventListener('board', (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent).data);
          if (Array.isArray(parsed.events)) setEvents(parsed.events);
          if (Array.isArray(parsed.teams)) setTeams(parsed.teams);
          setLastSyncedAt(parsed.generatedAt || new Date().toISOString());
          setLoading(false);
          setError('');
          setStreamState('live');
        } catch {
          // Ignore malformed frame
        }
      });
      es.onerror = () => {
        setStreamState('polling');
      };
    } else {
      setStreamState('polling');
    }

    const fallbackPoll = window.setInterval(() => {
      void fetchBoardSnapshot(false);
    }, 15000);

    return () => {
      window.clearInterval(fallbackPoll);
      if (es) es.close();
    };
  }, [fetchBoardSnapshot]);

  const summary = useMemo(() => computeLiveBoardSummary(events, teams), [events, teams]);

  const filteredTeams = useMemo(
    () =>
      filterLiveTeams(teams, {
        eventId: eventFilter,
        status: statusFilter,
        search: searchQuery,
      }),
    [teams, eventFilter, statusFilter, searchQuery]
  );

  const matrixEvents = useMemo(
    () => (eventFilter === 'all' ? events : events.filter((e) => e.id === eventFilter)),
    [events, eventFilter]
  );

  const defaultSlug =
    events.find((e) => e.id === eventFilter)?.slug ||
    events[0]?.slug ||
    'kalinga-warriors-bgmi';

  const lastSyncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      })
    : 'Syncing...';

  return (
    <main className="min-h-screen bg-[#0D0A09] text-neutral-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Top Header */}
        <div className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
              <span className="font-semibold text-[#E5C736] uppercase">
                SAMT Campus LAN 2026 · Public Roster Feed
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-neutral-300">
                <Radio
                  className={`h-3.5 w-3.5 ${
                    streamState === 'live' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                />
                {streamState === 'live' ? 'Live Stream Active' : 'Auto-Syncing (15s)'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] tabular-nums">
                Last Synced: {lastSyncedLabel} IST
              </span>
            </div>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white uppercase sm:text-5xl [text-wrap:balance]">
              Live Registered Teams Dashboard
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-400 sm:text-sm">
              Real-time squad counter, verified LAN group slots, and tournament capacity tracker.
              Personal contacts, UTRs, and payment proofs remain private.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void fetchBoardSnapshot(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-white/15 bg-[#141110] px-4 py-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'register', slug: defaultSlug })}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-[#D41B14] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#B41510]"
            >
              Register Squad
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 4-Column Seamless Architectural Summary KPI Strip */}
        <section
          aria-label="Live Registration Metrics"
          className="mt-6 grid grid-cols-2 divide-x divide-y divide-white/10 overflow-hidden rounded-xl border border-white/12 bg-[#141110] lg:grid-cols-4 lg:divide-y-0"
        >
          <div className="p-4 sm:p-5">
            <div className="text-xs text-neutral-400">Registered Squads</div>
            <div
              data-testid="live-total-active"
              className="mt-1 font-mono text-2xl font-bold text-white tabular-nums"
            >
              {summary.totalActive}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400 tabular-nums">
              Across {events.length} active {events.length === 1 ? 'title' : 'titles'}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="text-xs text-neutral-400">Verified &amp; Slotted</div>
            <div
              data-testid="live-verified-count"
              className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums"
            >
              {summary.verifiedCount}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              Official LAN seat assigned
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="text-xs text-neutral-400">Pending Payment Check</div>
            <div
              data-testid="live-pending-count"
              className="mt-1 font-mono text-2xl font-bold text-[#E5C736] tabular-nums"
            >
              {summary.pendingCount}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              Awaiting Admin UTR approval
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="text-xs text-neutral-400">Open LAN Slots Left</div>
            <div
              data-testid="live-remaining-slots"
              className="mt-1 font-mono text-2xl font-bold text-white tabular-nums"
            >
              {summary.remainingSlots} / {summary.totalCapacity}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400 tabular-nums">
              {summary.waitlistedCount} squad(s) waitlisted
            </div>
          </div>
        </section>

        {/* Per-Event Live Slot Fill Meters with Authentic BGMI & Free Fire Key Art */}
        <section aria-label="Per-Title Live Capacity" className="mt-6 grid gap-4 md:grid-cols-2">
          {summary.perEvent.map((evtStat) => {
            const isSelected = eventFilter === evtStat.eventId;
            const artUrl = getEventBannerUrl(evtStat.slug, evtStat.gameTitle);
            return (
              <div
                key={evtStat.eventId}
                className={`tournament-card-lift group relative overflow-hidden rounded-xl border bg-[#141110] p-5 ${
                  isSelected ? 'border-[#D41B14]' : 'border-white/12 hover:border-white/25'
                }`}
              >
                <img
                  src={artUrl}
                  alt={`${evtStat.title.replace(/2k26/gi, '2026')} (${evtStat.gameTitle}) Arena Backdrop`}
                  referrerPolicy="no-referrer"
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-35 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#141110] via-[#141110]/85 to-[#141110]/55"
                />

                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#E5C736] uppercase">
                      {evtStat.gameTitle} · {evtStat.isOpen ? 'Registration Open' : 'Closed'}
                    </div>
                    <h2 className="mt-0.5 font-display text-xl font-bold text-white uppercase">
                      {evtStat.title.replace(/2k26/gi, '2026')}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEventFilter((prev) =>
                        prev === evtStat.eventId ? 'all' : evtStat.eventId
                      )
                    }
                    className={`shrink-0 whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-medium transition-colors duration-100 ${
                      isSelected
                        ? 'bg-[#D41B14] text-white'
                        : 'border border-white/20 bg-[#110D0C]/85 text-neutral-200 hover:text-white'
                    }`}
                  >
                    {isSelected ? 'Filtered' : 'Filter Title'}
                  </button>
                </div>

                {/* Progress Bar (Verified emerald + Pending gold) */}
                <div className="relative mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300">
                      <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                        {evtStat.verifiedCount} Verified
                      </span>{' '}
                      ·{' '}
                      <span className="font-mono text-[#E5C736] tabular-nums">
                        {evtStat.pendingCount} Pending
                      </span>
                    </span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      {evtStat.totalActive} / {evtStat.maxTeams} Teams
                    </span>
                  </div>
                  <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded bg-white/15">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${evtStat.verifiedPercent}%` }}
                    />
                    <div
                      className="h-full bg-[#E5C736] transition-all duration-300"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100 - evtStat.verifiedPercent, evtStat.filledPercent - evtStat.verifiedPercent)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Controls Bar: Filters + Search + View Switcher */}
        <section className="mt-6 rounded-xl border border-white/10 bg-[#1A1716] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {/* Event Tabs */}
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#110D0C] p-1">
                <button
                  type="button"
                  onClick={() => setEventFilter('all')}
                  className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    eventFilter === 'all'
                      ? 'bg-[#D41B14] text-white'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  All Titles
                </button>
                {events.map((evt) => (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => setEventFilter(evt.id)}
                    className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      eventFilter === evt.id
                        ? 'bg-[#D41B14] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    {evt.gameTitle}
                  </button>
                ))}
              </div>

              {/* Status Tabs */}
              {viewMode === 'ledger' && (
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#110D0C] p-1">
                  {(
                    [
                      ['all', 'All'],
                      ['verified', 'Verified'],
                      ['pending', 'Pending'],
                      ['waitlisted', 'Waitlist'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStatusFilter(val)}
                      className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        statusFilter === val
                          ? 'bg-white/15 text-white'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {viewMode === 'ledger' && (
                <div className="relative flex-1 sm:w-64 sm:flex-none">
                  <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="search"
                    aria-label="Search registered teams"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Team ID, Name, College, IGN..."
                    className="w-full rounded-md border border-white/15 bg-[#110D0C] py-2 pr-3 pl-8 text-xs text-white placeholder:text-neutral-500 focus:border-[#E5C736] focus:outline-none"
                  />
                </div>
              )}

              {/* View Mode Switcher */}
              <div
                role="group"
                aria-label="Dashboard Display Mode"
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#110D0C] p-1"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('ledger')}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium ${
                    viewMode === 'ledger'
                      ? 'bg-[#D41B14] text-white'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <ListFilter className="h-3.5 w-3.5" />
                  Team Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('matrix')}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium ${
                    viewMode === 'matrix'
                      ? 'bg-[#D41B14] text-white'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  LAN Slot Matrix
                </button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D41B14]/40 bg-[#D41B14]/15 px-4 py-3 text-xs text-red-200">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void fetchBoardSnapshot(true)}
              className="rounded border border-white/20 px-3 py-1 font-semibold text-white hover:bg-white/10"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Main Content: Team Ledger or LAN Slot Matrix */}
        {loading ? (
          <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-[#1A1716] p-6">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-11 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : viewMode === 'ledger' ? (
          <section
            key="ledger"
            aria-label="Registered Squads Table"
            className="animate-panel-enter mt-6 rounded-xl border border-white/10 bg-[#1A1716]"
          >
            {filteredTeams.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Users className="mx-auto h-8 w-8 text-neutral-500" />
                <h2 className="mt-3 text-base font-semibold text-white">
                  {teams.length === 0
                    ? 'No Squads Registered Yet'
                    : 'No Registered Squads Match Filters'}
                </h2>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-neutral-400">
                  {teams.length === 0
                    ? 'Submitted teams appear here in real time the moment their UPI proof is submitted. Once verified by SAMT Coordinators, their LAN Group and Slot Seat update automatically.'
                    : 'Try clearing your search term or switching the event/status filter.'}
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  {teams.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEventFilter('all');
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className="rounded-md border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
                    >
                      Clear Filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigate({ page: 'register', slug: defaultSlug })}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#D41B14] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#B41510]"
                    >
                      Register First Squad
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Data Table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-[#161312] text-neutral-400">
                        <th className="px-4 py-3 font-medium">Team ID</th>
                        <th className="px-4 py-3 font-medium">Squad &amp; College</th>
                        <th className="px-4 py-3 font-medium">Title</th>
                        <th className="px-4 py-3 font-medium">Public Roster (IGNs)</th>
                        <th className="px-4 py-3 font-medium">LAN Slot</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Registered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredTeams.map((team) => {
                        const timeStr = new Date(team.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                          timeZone: 'Asia/Kolkata',
                        });
                        return (
                          <tr
                            key={team.id}
                            className="transition-colors hover:bg-white/[0.03]"
                          >
                            <td className="px-4 py-3 font-mono font-bold whitespace-nowrap text-[#E5C736] tabular-nums">
                              {team.teamCode}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-white">{team.teamName}</div>
                              <div className="text-[11px] text-neutral-400">
                                {team.collegeName}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-neutral-200">
                              {team.gameTitle}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-neutral-300">
                                {team.rosterIgns.map((m) => (
                                  <span key={`${team.id}-${m.slotRole}`}>
                                    <span className="font-mono text-neutral-500">
                                      {m.slotRole}:
                                    </span>{' '}
                                    {m.inGameName}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap tabular-nums">
                              {team.slotNumber ? (
                                <span className="font-semibold text-emerald-400">
                                  {team.groupName} · {team.slotNumber}
                                </span>
                              ) : (
                                <span className="text-neutral-500">Awaiting Verification</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusBadge status={team.status} />
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[11px] whitespace-nowrap text-neutral-400 tabular-nums">
                              {timeStr}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List (< md) */}
                <div className="divide-y divide-white/10 md:hidden">
                  {filteredTeams.map((team) => (
                    <div key={team.id} className="space-y-2.5 p-4 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-[#E5C736] tabular-nums">
                            {team.teamCode}
                          </span>
                          <span className="mx-1.5 text-neutral-500">·</span>
                          <span className="text-neutral-300">{team.gameTitle}</span>
                          <h3 className="mt-0.5 text-sm font-semibold text-white">
                            {team.teamName}
                          </h3>
                          <p className="text-[11px] text-neutral-400">{team.collegeName}</p>
                        </div>
                        <StatusBadge status={team.status} />
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 rounded border border-white/10 bg-[#110D0C] px-3 py-2 text-[11px] text-neutral-300">
                        {team.rosterIgns.map((m) => (
                          <span key={`${team.id}-mob-${m.slotRole}`}>
                            <span className="font-mono text-neutral-500">{m.slotRole}:</span>{' '}
                            {m.inGameName}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="font-mono tabular-nums">
                          {team.slotNumber
                            ? `${team.groupName} · Seat ${team.slotNumber}`
                            : 'Slot assigned on verification'}
                        </span>
                        <span className="font-mono tabular-nums">
                          {team.playerCount} Players
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : (
          /* LAN Slot Allocation Matrix (Group A & Group B Seats) */
          <section
            key="matrix"
            aria-label="LAN Group Slot Matrix"
            className="animate-panel-enter mt-6 space-y-6"
          >
            {matrixEvents.map((evt) => {
              const { groupA, groupB } = buildGroupSlotGrid(teams, evt.id, evt.maxTeams);
              const verifiedInEvt = teams.filter(
                (t) => t.eventId === evt.id && t.status === 'verified'
              ).length;
              return (
                <div
                  key={evt.id}
                  className="rounded-xl border border-white/10 bg-[#1A1716] p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <div className="text-xs font-semibold text-[#E5C736] uppercase">
                        {evt.gameTitle} · Official Group Seatings
                      </div>
                      <h2 className="mt-0.5 font-display text-2xl font-bold text-white uppercase">
                        {evt.title.replace(/2k26/gi, '2026')}
                      </h2>
                    </div>
                    <div className="font-mono text-xs text-neutral-300 tabular-nums">
                      <span className="font-semibold text-emerald-400">
                        {verifiedInEvt} Slotted
                      </span>{' '}
                      / {evt.maxTeams} LAN Seats
                    </div>
                  </div>

                  <div className="mt-5 grid gap-6 lg:grid-cols-2">
                    {[
                      { label: 'Group A (Seats A1–A12)', cells: groupA },
                      { label: 'Group B (Seats B1–B12)', cells: groupB },
                    ].map((group) => (
                      <div key={group.label}>
                        <h3 className="text-xs font-semibold text-neutral-300 uppercase">
                          {group.label}
                        </h3>
                        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                          {group.cells.map((cell) => (
                            <div
                              key={cell.slotNumber}
                              className={`rounded-lg border p-3 text-xs ${
                                cell.team
                                  ? 'border-emerald-500/35 bg-emerald-950/20'
                                  : 'border-white/10 bg-[#110D0C]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`font-mono font-bold tabular-nums ${
                                    cell.team ? 'text-emerald-400' : 'text-neutral-500'
                                  }`}
                                >
                                  {cell.slotNumber}
                                </span>
                                {cell.team && (
                                  <span className="font-mono text-[10px] text-[#E5C736] tabular-nums">
                                    {cell.team.teamCode}
                                  </span>
                                )}
                              </div>
                              <div
                                className={`mt-1 truncate font-medium ${
                                  cell.team ? 'text-white' : 'text-neutral-500'
                                }`}
                                title={cell.team ? cell.team.teamName : 'Open LAN Slot'}
                              >
                                {cell.team ? cell.team.teamName : 'Open Slot'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Privacy & Lookup Note */}
        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-white/10 bg-[#1A1716] px-5 py-4 text-xs text-neutral-300 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#E5C736]" />
            <span>
              Want to inspect your own payment screenshot status or download your verified pass?
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ page: 'track' })}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold text-[#E5C736] hover:underline"
          >
            Open Team Status Lookup
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: PublicRegisteredTeam['status'] }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald-400 uppercase">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Verified
      </span>
    );
  }
  if (status === 'waitlisted') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-blue-300 uppercase">
        <Clock className="h-3.5 w-3.5" />
        Waitlist
      </span>
    );
  }
  if (status === 'reupload_required') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-amber-300 uppercase">
        <Clock className="h-3.5 w-3.5" />
        Re-upload
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#E5C736] uppercase">
      <Clock className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}
