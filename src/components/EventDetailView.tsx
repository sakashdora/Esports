import { ArrowLeft, ArrowRight, Trophy } from 'lucide-react';
import { useState } from 'react';
import type { CampusEvent } from '../lib/defaultEvents';
import { getEventBannerUrl } from '../lib/eventArtwork';
import type { AppRoute } from './Navbar';

interface EventDetailViewProps {
  event: CampusEvent;
  allEvents: CampusEvent[];
  onNavigate: (next: AppRoute) => void;
}

export function EventDetailView({ event, allEvents, onNavigate }: EventDetailViewProps) {
  const filled = event.registeredCount || 0;
  const remaining = Math.max(0, event.maxTeams - filled);
  const bannerUrl = getEventBannerUrl(event.slug, event.gameTitle);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <main className="min-h-screen bg-[#0D0A09] text-neutral-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <button
            type="button"
            onClick={() => onNavigate({ page: 'home' })}
            className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to All Events
          </button>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#141110] p-1">
            {allEvents.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setImgFailed(false);
                  onNavigate({ page: 'event', slug: item.slug });
                }}
                className={`min-h-10 rounded-md px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                  item.slug === event.slug
                    ? 'bg-[#D41B14] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                {item.gameTitle}
              </button>
            ))}
          </div>
        </div>

        {/* Event Banner + Title Header */}
        <section
          key={event.slug}
          className="animate-panel-enter mt-8 grid items-stretch gap-8 lg:grid-cols-12"
        >
          <div className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/12 bg-[#141110] lg:col-span-8">
            <div className="relative aspect-[16/8] w-full overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#233D8B]/30 via-[#141110] to-[#D41B14]/25">
              {bannerUrl && !imgFailed ? (
                <img
                  src={bannerUrl}
                  alt={`${event.title.replace(/2k26/gi, '2026')} — ${event.gameTitle} Promotional Key Art`}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover object-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                  <Trophy className="h-10 w-10 text-[#E5C736]" />
                  <span className="mt-2 font-display text-2xl font-bold text-white uppercase">
                    {event.gameTitle}
                  </span>
                </div>
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#141110] via-[#141110]/40 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 px-6 pb-5 sm:px-8">
                <p className="text-xs font-semibold tracking-wide text-[#E5C736] uppercase">
                  Official Rulebook &amp; Fixtures · {event.gameTitle}
                </p>
                <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-white uppercase sm:text-5xl">
                  {event.title.replace(/2k26/gi, '2026')}
                </h1>
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-center px-6 py-5 sm:px-8">
              <p className="text-sm font-medium text-neutral-200">{event.subtitle}</p>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-neutral-400">
                {event.rulesJson.eligibilitySummary}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between rounded-xl border border-white/12 bg-[#141110] p-6 lg:col-span-4">
            <div className="space-y-3 text-xs">
              <div className="border-b border-white/10 pb-3">
                <div className="text-xs text-neutral-400">Event Prize Pool</div>
                <div className="mt-1 font-mono text-2xl font-semibold text-[#E5C736] tabular-nums">
                  Rs. {event.prizePoolTotal.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="flex justify-between gap-4 pt-1">
                <span className="text-neutral-400">Slots Available</span>
                <span className="font-mono font-semibold text-white whitespace-nowrap tabular-nums">
                  {remaining} of {event.maxTeams} Left
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-400">Base Entry Fee</span>
                <span className="font-mono font-semibold text-white whitespace-nowrap tabular-nums">
                  Rs. {event.baseFee} / Squad
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-400">Lunch Add-On</span>
                <span className="font-mono font-semibold text-white whitespace-nowrap tabular-nums">
                  +Rs. {event.lunchFee} / Team (optional)
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-400">Venue</span>
                <span className="text-right text-neutral-200">{event.venueLabel}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-400">Map Pool</span>
                <span className="text-right text-neutral-200">
                  {event.rulesJson.mapPool.join(', ')}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={!event.isOpen}
              onClick={() => onNavigate({ page: 'register', slug: event.slug })}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#D41B14] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#B41510] disabled:opacity-50"
            >
              {event.isOpen ? 'Register Squad Now' : 'Registrations Closed'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Tournament Stages & Fixtures */}
        <section className="mt-12 grid gap-8 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <h2 className="font-display text-2xl font-bold text-white uppercase">
              01. Tournament Structure &amp; Fixtures
            </h2>
            <div className="mt-4 space-y-3">
              {event.rulesJson.stages.map((stage) => (
                <div
                  key={stage.stageNumber}
                  className="rounded-xl border border-white/10 bg-[#1A1716] p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-white">
                      {stage.stageNumber}. {stage.name}
                    </span>
                    <span className="text-xs font-medium text-[#E5C736]">
                      {stage.formatAndTeams}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                    {stage.advancement}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-white/10 bg-[#1A1716]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-400">
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Match / Series</th>
                    <th className="px-4 py-3 font-medium">Participants</th>
                    <th className="px-4 py-3 font-medium">Scoring &amp; Qualification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-neutral-200">
                  {event.rulesJson.fixtures.map((fix) => (
                    <tr key={`${fix.stage}-${fix.matchId}`}>
                      <td className="px-4 py-3 font-medium text-white">{fix.stage}</td>
                      <td className="px-4 py-3 font-mono text-neutral-300">{fix.matchId}</td>
                      <td className="px-4 py-3 text-neutral-300">{fix.participants}</td>
                      <td className="px-4 py-3 text-neutral-400">{fix.scoring}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scoring System & Prize Breakdown */}
          <div className="min-w-0 lg:col-span-5">
            <h2 className="font-display text-2xl font-bold text-white uppercase">
              02. Placement &amp; Kill Points
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#1A1716]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs">
                <span className="text-neutral-400">Elimination (Kill) Bonus</span>
                <span className="font-mono font-semibold text-[#E5C736] tabular-nums">
                  +{event.rulesJson.killPoints} Point per Kill
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-400">
                    <th className="px-4 py-2.5 font-medium">Match Rank</th>
                    <th className="px-4 py-2.5 text-right font-medium">Placement Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-neutral-200">
                  {event.rulesJson.placementPoints.map((row) => (
                    <tr key={row.rank}>
                      <td className="px-4 py-2.5">{row.rank}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-white tabular-nums">
                        {row.points} Pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-8 font-display text-2xl font-bold text-white uppercase">
              03. Prize Distribution
            </h3>
            <div className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10 bg-[#1A1716]">
              {event.prizeBreakdown.map((tier) => (
                <div key={tier.position} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Trophy className="h-3.5 w-3.5 text-[#E5C736]" />
                      {tier.position}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-400">{tier.award}</div>
                  </div>
                  <div className="font-mono text-sm font-semibold text-[#E5C736] tabular-nums">
                    Rs. {tier.cashPrize.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Special Rules & Tie Breaker */}
        <section className="mt-12 grid gap-8 border-t border-white/10 pt-10 md:grid-cols-2">
          <div>
            <h3 className="font-display text-xl font-bold text-white uppercase">
              Game-Specific Conduct &amp; Rules
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-neutral-300">
              {event.rulesJson.specialRules.map((rule) => (
                <li key={rule} className="rounded-lg border border-white/10 bg-[#1A1716] p-3.5">
                  {rule}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-white uppercase">
              Universal Tie-Break Protocol
            </h3>
            <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-neutral-300">
              {event.rulesJson.tieBreaker.map((step, i) => (
                <li key={step} className="rounded-lg border border-white/10 bg-[#1A1716] p-3.5">
                  <span className="font-mono font-semibold text-[#E5C736]">{i + 1}.</span> {step}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
