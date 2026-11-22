import { ArrowRight, Radio, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampusEvent } from '../lib/defaultEvents';
import { getEventBannerUrl } from '../lib/eventArtwork';
import { computeLiveBoardSummary, type LiveBoardSnapshot } from '../lib/liveBoard';
import type { AppRoute } from './Navbar';

interface LiveDashboardViewProps {
  initialEvents: CampusEvent[];
  onNavigate: (next: AppRoute) => void;
}

export function LiveDashboardView({ initialEvents, onNavigate }: LiveDashboardViewProps) {
  const [summary, setSummary] = useState(() => computeLiveBoardSummary(initialEvents));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [streamState, setStreamState] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const snapshotInFlight = useRef(false);

  const updateSummary = useCallback((snapshot: LiveBoardSnapshot) => {
    if (!Array.isArray(snapshot?.summary?.perEvent) || typeof snapshot.generatedAt !== 'string') {
      throw new Error('Unable to load registration totals.');
    }
    setSummary(snapshot.summary);
    setLastSyncedAt(snapshot.generatedAt);
    setError('');
  }, []);

  const fetchBoardSnapshot = useCallback(async (isManual = false): Promise<boolean> => {
    if (snapshotInFlight.current) return false;
    snapshotInFlight.current = true;
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/live-registrations');
      if (!res.ok) throw new Error('Unable to load live registrations.');
      const data: LiveBoardSnapshot & { realtime?: boolean } = await res.json();
      updateSummary(data);
      // The server reports whether it can push live updates (not on serverless hosting).
      return data.realtime !== false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sync live registration board.');
      return false;
    } finally {
      snapshotInFlight.current = false;
      setRefreshing(false);
    }
  }, [updateSummary]);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    const fallbackPoll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && (!es || es.readyState !== 1)) void fetchBoardSnapshot(false);
    }, 5000);

    void fetchBoardSnapshot(false).then((realtime) => {
      if (cancelled) return;
      if (!realtime || typeof EventSource === 'undefined') {
        setStreamState('polling');
        return;
      }
      es = new EventSource('/api/live-registrations/stream');
      es.onopen = () => {
        setStreamState('live');
      };
      es.addEventListener('board', (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent).data);
          updateSummary(parsed);
          setStreamState('live');
        } catch {
          // Ignore malformed frame
        }
      });
      es.onerror = () => {
        setStreamState('polling');
      };
    });

    return () => {
      cancelled = true;
      window.clearInterval(fallbackPoll);
      if (es) es.close();
    };
  }, [fetchBoardSnapshot, updateSummary]);

  const defaultSlug = summary.perEvent[0]?.slug || 'kalinga-warriors-bgmi';

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
                SAMT Campus LAN 2026
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-neutral-300">
                <Radio
                  className={`h-3.5 w-3.5 ${
                    streamState === 'live' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                />
                {streamState === 'live' ? 'Live Stream Active' : 'Auto-Syncing'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] tabular-nums">
                Last Synced: {lastSyncedLabel} IST
              </span>
            </div>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white uppercase sm:text-5xl [text-wrap:balance]">
              Live Registration Counts
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-400 sm:text-sm">
              See squad totals, verification progress, and available slots by tournament.
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
              Across {summary.perEvent.length} {summary.perEvent.length === 1 ? 'title' : 'titles'}
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
            const artUrl = getEventBannerUrl(evtStat.slug, evtStat.gameTitle);
            return (
              <div
                key={evtStat.eventId}
                className="tournament-card-lift group relative overflow-hidden rounded-xl border border-white/12 bg-[#141110] p-5 hover:border-white/25"
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

        {/* Privacy & Lookup Note */}
        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-white/10 bg-[#1A1716] px-5 py-4 text-xs text-neutral-300 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#E5C736]" />
            <span>
              Check your own registration, payment status, or verified pass.
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
