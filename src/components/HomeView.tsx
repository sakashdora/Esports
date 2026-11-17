import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  MapPin,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CampusEvent } from '../lib/defaultEvents';
import {
  CAMPUS_EVENT_BANNER_IMAGE,
  getEventBannerUrl,
  getEventPosterUrl,
} from '../lib/eventArtwork';
import { EmberParticles } from './EmberParticles';
import { HeroCountdown } from './HeroCountdown';
import { HowItWorksTimeline } from './HowItWorksTimeline';
import type { AppRoute } from './Navbar';

interface HomeViewProps {
  events: CampusEvent[];
  loading: boolean;
  onNavigate: (next: AppRoute) => void;
}

function useScrollReveal() {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: '0px 0px -30px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

export function HomeView({ events, loading, onNavigate }: HomeViewProps) {
  const primaryEvent = events[0];
  const featuredPosterEvents = events.slice(0, 2);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [failedBanners, setFailedBanners] = useState<Record<string, boolean>>({});
  const [failedPosters, setFailedPosters] = useState<Record<string, boolean>>({});
  const [bracketTab, setBracketTab] = useState<string>(events[0]?.slug || 'kalinga-warriors-bgmi');

  const eventsReveal = useScrollReveal();
  const guideReveal = useScrollReveal();
  const rulesReveal = useScrollReveal();

  const activeBracketEvent =
    events.find((e) => e.slug === bracketTab) || events[0];

  return (
    <main className="bg-[#0D0A09] text-neutral-100">
      {/* Full-Screen Championship Broadcast Hero Stage */}
      <section className="relative flex min-h-[calc(100svh-57px)] flex-col justify-between overflow-hidden border-b border-white/10 bg-[#0D0A09]">
        {!heroImgFailed && (
          <img
            src={CAMPUS_EVENT_BANNER_IMAGE}
            alt="SAMT Campus LAN Esports Championship Arena Stage"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="hero-backdrop-drift pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-68"
          />
        )}
        {/* Atmospheric Stage Lighting & Measured Contrast Scrims */}
        <div
          aria-hidden="true"
          className="stage-spotlight-drift pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,27,20,0.32),transparent_58%),radial-gradient(ellipse_at_bottom_left,rgba(255,107,26,0.16),transparent_52%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0D0A09]/96 via-[#0D0A09]/76 to-[#0D0A09]/28"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D0A09] via-transparent to-[#0D0A09]/65"
        />

        {/* Smooth 60fps Fire Ember & Spark Particle Layer */}
        <EmberParticles density={44} />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-between px-4 pt-5 pb-4 sm:px-6 lg:pt-7 lg:pb-5">
          <div className="my-auto grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Left Column: Brand Highlight, Display Headline, Chronograph Clock & Primary CTA */}
            <div className="animate-stage-enter flex min-w-0 flex-col justify-between lg:col-span-6">
              <div>
                {/* Highlighted SRUSTI e-SPORTS Emblem Showcase */}
                <div className="relative inline-flex max-w-full items-center gap-2.5 overflow-hidden rounded-lg border border-[#D41B14]/35 bg-[#141110]/78 px-3.5 py-2 backdrop-blur-md">
                  <span
                    aria-hidden="true"
                    className="logo-ember-aura pointer-events-none absolute -inset-2 bg-[radial-gradient(ellipse_at_left,rgba(212,27,20,0.34),rgba(255,107,26,0.12)_60%,transparent_80%)]"
                  />
                  <span className="relative font-display text-2xl leading-none font-extrabold tracking-wider text-white uppercase sm:text-[1.6rem]">
                    SRUSTI
                  </span>
                  <img
                    src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.png"
                    alt="SRUSTI e-SPORTS Official Emblem"
                    referrerPolicy="no-referrer"
                    className="relative h-7 w-auto shrink-0 object-contain drop-shadow-[0_0_12px_rgba(212,27,20,0.7)] sm:h-7.5"
                  />
                  <span
                    aria-hidden="true"
                    className="logo-shimmer-beam pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-transparent via-white/22 to-transparent"
                  />
                </div>

                <p className="mt-3.5 text-xs font-semibold tracking-wider text-[#E5C736] uppercase">
                  Srusti Academy of Management &amp; Technology · 2K26
                </p>
                <h1 className="mt-2 max-w-xl font-display text-5xl leading-[0.98] font-extrabold tracking-tight text-white uppercase sm:text-6xl lg:text-[4rem] [text-wrap:balance]">
                  Campus LAN Esports Championship 2K26
                </h1>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-neutral-200 sm:text-[15px]">
                  Battle live on the SAMT LAN stage in{' '}
                  <strong className="font-semibold text-white">Kalinga Warriors (BGMI)</strong> and{' '}
                  <strong className="font-semibold text-white">Kurukshetra (Free Fire)</strong>.
                  Register your 4+1 squad, pay via official UPI QR, and receive your verified slot
                  pass by email.
                </p>

                <HeroCountdown deadlineText={primaryEvent?.registrationDeadline} />

                <div className="mt-5 flex flex-wrap items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        page: 'register',
                        slug: primaryEvent?.slug || 'kalinga-warriors-bgmi',
                      })
                    }
                    className="group relative inline-flex shrink-0 items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-md bg-gradient-to-r from-[#D41B14] to-[#B41510] px-7 py-3.5 text-sm font-semibold tracking-wide text-white shadow-lg shadow-[#D41B14]/35 transition-all duration-200 hover:shadow-[#D41B14]/55 active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D41B14]"
                  >
                    <span className="relative z-10 inline-flex items-center gap-2.5">
                      Register Now
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'track' })}
                    className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-white/20 bg-white/[0.04] px-5 py-3.5 text-sm font-medium text-neutral-100 backdrop-blur-sm transition-all duration-150 hover:border-white/35 hover:bg-white/[0.09] active:scale-[0.985]"
                  >
                    Track Team Status
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-400">
                  <span className="whitespace-nowrap">Ages 16–22 or Class 11–UG</span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">Mobile Only</span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">Rs. 299 Entry (+Rs. 100 Optional Lunch)</span>
                </div>
              </div>

              {/* Clean Official Hosts & Media Partner Lockup */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src="/assets/aistudio/Prospectus_2026_-_27_-_1_bb4cb47c.png"
                    alt="Srusti Academy of Management and Technology"
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                  <img
                    src="/assets/aistudio/SAGSH_22e6af6f.png"
                    alt="SAGS"
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 shrink-0 object-contain"
                  />
                  <img
                    src="/assets/aistudio/SRUSTI_PRASAAR_-_BRAND_DESIGN_GUIDE_a91fc8eb.png"
                    alt="Srusti Prasaar Media Partner"
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 shrink-0 object-contain"
                  />
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[11px] font-medium text-neutral-400">
                    Hosted by SAMT &amp; Official Partners
                  </div>
                  <div className="font-mono text-xs font-semibold text-[#E5C736] tabular-nums">
                    SAMT · SAGS · Srusti Prasaar
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Dual Official 3:4 Championship Posters (BGMI & Free Fire) */}
            <div className="animate-stage-delay-1 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-6">
              {featuredPosterEvents.map((evt) => {
                const filled = evt.registeredCount || 0;
                const remaining = Math.max(0, evt.maxTeams - filled);
                const pct = Math.min(100, Math.round((filled / evt.maxTeams) * 100));
                const posterUrl = getEventPosterUrl(evt.slug, evt.gameTitle);
                const showPoster = posterUrl && !failedPosters[evt.id];

                return (
                  <article
                    key={evt.id}
                    className="tournament-card-lift group relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-xl border border-white/15 bg-[#151211] hover:border-[#E5C736]/60"
                  >
                    {showPoster ? (
                      <img
                        src={posterUrl}
                        alt={`${evt.title} — ${evt.gameTitle} Official Poster`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedPosters((prev) => ({ ...prev, [evt.id]: true }))
                        }
                        className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#233D8B]/40 via-[#151211] to-[#D41B14]/30 p-6 text-center">
                        <Trophy className="h-10 w-10 text-[#E5C736]" />
                        <span className="mt-2 font-display text-2xl font-bold text-white uppercase">
                          {evt.gameTitle}
                        </span>
                      </div>
                    )}

                    {/* Top & Bottom Measured Scrims */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#0D0A09]/75 to-transparent"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0D0A09] via-[#0D0A09]/72 to-transparent"
                    />

                    {/* Broadcast HUD Top Bar */}
                    <div className="relative flex items-center justify-between gap-2 px-4 pt-3.5 text-[11px] font-semibold">
                      <span className="tracking-wider text-[#E5C736] uppercase">{evt.gameTitle}</span>
                      <span className="font-mono text-neutral-100 whitespace-nowrap tabular-nums">
                        {remaining} / {evt.maxTeams} Open
                      </span>
                    </div>

                    {/* Broadcast HUD Corner Ticks */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-2 left-2 h-3 w-3 border-t border-l border-[#E5C736]/55"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-2 right-2 h-3 w-3 border-t border-r border-[#E5C736]/55"
                    />

                    {/* Poster Footer Info & Actions */}
                    <div className="relative p-4">
                      <h2 className="font-display text-2xl leading-none font-extrabold tracking-tight text-white uppercase">
                        {evt.title}
                      </h2>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-300">
                        <span className="font-mono font-semibold text-white tabular-nums">
                          Rs. {evt.prizePoolTotal.toLocaleString('en-IN')} Pool
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">Rs. {evt.baseFee} Entry</span>
                      </div>

                      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full bg-[#E5C736] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!evt.isOpen}
                          onClick={() => onNavigate({ page: 'register', slug: evt.slug })}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#D41B14] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B41510] disabled:opacity-50"
                        >
                          Register Now
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate({ page: 'event', slug: evt.slug })}
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-white/25 bg-[#0D0A09]/80 px-3 py-2 text-xs font-medium text-neutral-100 backdrop-blur-sm transition-colors hover:bg-white/15"
                        >
                          Rules
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* 4-Column Architectural Prize Ledger Strip */}
          <div className="animate-stage-delay-2 mt-6">
            <div className="grid grid-cols-2 divide-x divide-y divide-white/10 border-y border-white/15 bg-[#0D0A09]/65 backdrop-blur-sm lg:grid-cols-4 lg:divide-y-0">
              <div className="min-w-0 px-3.5 py-3 sm:px-5">
                <div className="text-[11px] font-medium text-neutral-400">Combined Prize Pool</div>
                <div className="mt-0.5 font-mono text-base font-semibold text-[#E5C736] whitespace-nowrap tabular-nums sm:text-xl">
                  Rs. 20,000 Total
                </div>
              </div>
              <div className="min-w-0 px-3.5 py-3 sm:px-5">
                <div className="text-[11px] font-medium text-neutral-400">1st Place Per Title</div>
                <div className="mt-0.5 font-mono text-base font-semibold text-white whitespace-nowrap tabular-nums sm:text-xl">
                  Rs. 5,500 + Trophy
                </div>
              </div>
              <div className="min-w-0 px-3.5 py-3 sm:px-5">
                <div className="text-[11px] font-medium text-neutral-400">2nd Place Per Title</div>
                <div className="mt-0.5 font-mono text-base font-semibold text-white whitespace-nowrap tabular-nums sm:text-xl">
                  Rs. 3,500 + Trophy
                </div>
              </div>
              <div className="min-w-0 px-3.5 py-3 sm:px-5">
                <div className="text-[11px] font-medium text-neutral-400">Final Match MVP</div>
                <div className="mt-0.5 font-mono text-base font-semibold text-white whitespace-nowrap tabular-nums sm:text-xl">
                  Rs. 1,000 Cash
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-center">
              <a
                href="#events"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 transition-colors hover:text-[#E5C736]"
              >
                <span>Events &amp; Registration Guide</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Section 01: Championship Titles & Events */}
      <section
        id="events"
        ref={eventsReveal.ref}
        className={`reveal-section mx-auto max-w-6xl px-4 py-16 sm:px-6 ${
          eventsReveal.visible ? 'is-visible' : ''
        }`}
      >
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-white uppercase sm:text-4xl">
              01. Championship Titles &amp; Events
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Compare prize pools, open squad slots, schedules, and official tournament rules.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-medium text-neutral-400 tabular-nums">
              {events.length} Active {events.length === 1 ? 'Event' : 'Events'}
            </span>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'live' })}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-white/15 bg-[#151211] px-4 py-2 text-xs font-semibold text-[#E5C736] transition-colors hover:border-[#E5C736]/40 hover:bg-white/[0.04]"
            >
              View Live Teams
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="h-96 animate-pulse rounded-xl border border-white/10 bg-[#151211]"
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {events.map((evt) => {
              const filled = evt.registeredCount || 0;
              const remaining = Math.max(0, evt.maxTeams - filled);
              const pct = Math.min(100, Math.round((filled / evt.maxTeams) * 100));
              const bannerUrl = getEventBannerUrl(evt.slug, evt.gameTitle);
              const showBannerImg = bannerUrl && !failedBanners[evt.id];

              return (
                <article
                  key={evt.id}
                  className="tournament-card-lift group flex flex-col justify-between overflow-hidden rounded-xl border border-white/12 bg-[#141110] hover:border-white/25"
                >
                  <div>
                    <div className="relative aspect-video w-full overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#233D8B]/30 via-[#141110] to-[#D41B14]/25">
                      {showBannerImg ? (
                        <img
                          src={bannerUrl}
                          alt={`${evt.title} — ${evt.gameTitle} Key Art`}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedBanners((prev) => ({ ...prev, [evt.id]: true }))
                          }
                          className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                          <Trophy className="h-10 w-10 text-[#E5C736]" />
                          <span className="mt-2 font-display text-2xl font-bold text-white uppercase">
                            {evt.gameTitle}
                          </span>
                        </div>
                      )}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#141110] via-[#141110]/30 to-transparent"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-6 pb-4">
                        <div>
                          <div className="text-xs font-semibold tracking-wide text-[#E5C736] uppercase">
                            {evt.gameTitle} · {evt.rulesJson.mapPool.join(' / ')}
                          </div>
                          <h3 className="mt-0.5 font-display text-3xl leading-none font-extrabold text-white uppercase">
                            {evt.title}
                          </h3>
                        </div>
                        <span className="font-mono text-xs font-medium text-neutral-200 whitespace-nowrap tabular-nums">
                          {evt.isOpen
                            ? remaining > 0
                              ? `${remaining} Slots Left`
                              : 'Waitlist Open'
                            : 'Closed'}
                        </span>
                      </div>
                    </div>

                    <div className="p-6">
                      <p className="text-sm text-neutral-300">{evt.subtitle}</p>

                      <div className="mt-4 grid grid-cols-2 divide-x divide-white/10 border-y border-white/10 text-xs">
                        <div className="py-3 pr-4">
                          <div className="inline-flex items-center gap-1.5 text-neutral-400">
                            <Trophy className="h-3.5 w-3.5 text-[#E5C736]" /> Prize Pool
                          </div>
                          <div className="mt-1 font-mono font-semibold text-white tabular-nums">
                            Rs. {evt.prizePoolTotal.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div className="py-3 pl-4">
                          <div className="inline-flex items-center gap-1.5 text-neutral-400">
                            <Users className="h-3.5 w-3.5" /> Entry Fee
                          </div>
                          <div className="mt-1 font-mono font-semibold text-white tabular-nums">
                            Rs. {evt.baseFee} (+Rs. {evt.lunchFee} Lunch)
                          </div>
                        </div>
                        <div className="border-t border-white/10 py-3 pr-4">
                          <div className="inline-flex items-center gap-1.5 text-neutral-400">
                            <Calendar className="h-3.5 w-3.5" /> Schedule
                          </div>
                          <div className="mt-1 text-neutral-200">{evt.eventDateLabel}</div>
                        </div>
                        <div className="border-t border-white/10 py-3 pl-4">
                          <div className="inline-flex items-center gap-1.5 text-neutral-400">
                            <MapPin className="h-3.5 w-3.5" /> Venue
                          </div>
                          <div className="mt-1 text-neutral-200">{evt.venueLabel}</div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400">Squad Slots Filled</span>
                          <span className="font-mono font-medium text-neutral-200 tabular-nums">
                            {filled} / {evt.maxTeams} Teams
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[#D41B14] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-6 py-4">
                    <button
                      type="button"
                      disabled={!evt.isOpen}
                      onClick={() => onNavigate({ page: 'register', slug: evt.slug })}
                      className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#D41B14] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#B41510] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {evt.isOpen ? 'Register Squad' : 'Closed'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate({ page: 'event', slug: evt.slug })}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-white/15 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.08]"
                    >
                      Rulebook
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 02: How It Works (Esports HUD Reference Canvas) */}
      <section
        id="how-it-works"
        ref={guideReveal.ref}
        className={`reveal-section relative overflow-hidden border-t border-white/10 bg-[#080707] ${
          guideReveal.visible ? 'is-visible' : ''
        }`}
      >
        {/* Subtle Blueprint Grid Texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:36px_36px]"
        />
        {/* Diagonal Crimson Beams & Corner Accent Lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rotate-45 bg-gradient-to-b from-[#E61E19]/35 via-[#D41B14]/15 to-transparent blur-xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 h-2 w-48 -rotate-45 origin-top-left bg-gradient-to-r from-[#FF3B30] to-transparent opacity-80"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -right-16 h-72 w-72 rotate-45 bg-gradient-to-t from-[#E61E19]/35 via-[#D41B14]/15 to-transparent blur-xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(212,27,20,0.16),transparent_42%),radial-gradient(ellipse_at_top_right,rgba(245,184,46,0.12),transparent_40%)]"
        />

        {/* Subtle Top-Left Helmeted Trooper Silhouette & Top-Right Trophy Backdrop */}
        <svg
          aria-hidden="true"
          viewBox="0 0 240 240"
          className="pointer-events-none absolute -top-2 left-0 hidden h-64 w-64 opacity-25 lg:block"
        >
          <defs>
            <linearGradient id="soldierRim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF3B30" />
              <stop offset="65%" stopColor="#261918" />
              <stop offset="100%" stopColor="#080707" />
            </linearGradient>
          </defs>
          <path
            d="M78 52c0-22 18-38 42-38s42 16 42 38v14c6 5 8 14 4 22l-10 18 28 24 14 78H32l12-72 30-26-8-22c-3-8 0-16 6-20V52z"
            fill="url(#soldierRim)"
          />
          <rect x="92" y="50" width="56" height="16" rx="4" fill="#080707" stroke="#FF3B30" strokeOpacity="0.6" strokeWidth="1.5" />
        </svg>

        <svg
          aria-hidden="true"
          viewBox="0 0 220 220"
          className="pointer-events-none absolute top-4 right-2 hidden h-56 w-56 opacity-35 lg:block"
        >
          <defs>
            <linearGradient id="trophyGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="55%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#7C2D12" />
            </linearGradient>
          </defs>
          <g transform="rotate(-12 110 110)">
            <path
              d="M66 42h88v38c0 28-19 52-44 58-25-6-44-30-44-58V42z"
              fill="url(#trophyGold)"
            />
            <path
              d="M66 54H42c0 24 10 38 26 42M154 54h24c0 24-10 38-26 42"
              fill="none"
              stroke="url(#trophyGold)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <rect x="100" y="136" width="20" height="24" fill="url(#trophyGold)" />
            <path d="M74 160h72l8 16H66l8-16z" fill="url(#trophyGold)" />
          </g>
        </svg>

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <HowItWorksTimeline
            defaultEventSlug={primaryEvent?.slug || 'kalinga-warriors-bgmi'}
            onNavigate={onNavigate}
          />

          {/* Interactive Tournament Progression Bracket */}
          {activeBracketEvent && (
            <div className="mt-10 overflow-hidden rounded-xl border border-white/12 bg-[#0D0A09]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div>
                  <div className="text-xs font-medium text-[#E5C736]">
                    Match Stages &amp; Podium Split
                  </div>
                  <h3 className="mt-0.5 font-display text-2xl font-extrabold tracking-tight text-white uppercase sm:text-3xl">
                    {activeBracketEvent.title
                      .toLowerCase()
                      .includes(activeBracketEvent.gameTitle.toLowerCase())
                      ? activeBracketEvent.title
                      : `${activeBracketEvent.title} (${activeBracketEvent.gameTitle})`}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#151211] p-1">
                  {events.map((evt) => (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => setBracketTab(evt.slug)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                        activeBracketEvent.slug === evt.slug
                          ? 'bg-[#D41B14] text-white'
                          : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      {evt.gameTitle} Format
                    </button>
                  ))}
                </div>
              </div>

              <div
                key={activeBracketEvent.slug}
                className={`animate-panel-enter grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 ${
                  activeBracketEvent.rulesJson.stages.length >= 4
                    ? 'lg:grid-cols-4'
                    : activeBracketEvent.rulesJson.stages.length === 3
                    ? 'lg:grid-cols-3'
                    : 'lg:grid-cols-2'
                }`}
              >
                {activeBracketEvent.rulesJson.stages.map((stage) => (
                  <div key={stage.stageNumber} className="p-6">
                    <div className="font-mono text-xs font-semibold text-[#E5C736]">
                      Stage {stage.stageNumber}
                    </div>
                    <div className="mt-1.5 text-base font-semibold text-white">{stage.name}</div>
                    <div className="mt-1 text-xs font-medium text-neutral-300">
                      {stage.formatAndTeams}
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-neutral-400">
                      {stage.advancement}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col justify-between gap-4 border-t border-white/10 bg-[#141110] px-6 py-4 lg:flex-row lg:items-center">
                <div>
                  <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[#E5C736]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Prize Distribution
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-white">
                    Rs. {activeBracketEvent.prizePoolTotal.toLocaleString('en-IN')} Total Prize Pool
                  </div>
                </div>
                <div className="grid grid-cols-1 divide-y divide-white/10 rounded-lg border border-white/10 bg-[#0D0A09] sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:min-w-[580px]">
                  {activeBracketEvent.prizeBreakdown.map((tier) => (
                    <div
                      key={tier.position}
                      className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs"
                    >
                      <span className="text-neutral-300">{tier.position}</span>
                      <span className="font-mono font-semibold text-[#E5C736] whitespace-nowrap tabular-nums">
                        Rs. {tier.cashPrize.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 03: Fair Play & Eligibility Rules */}
      <section
        ref={rulesReveal.ref}
        className={`reveal-section border-t border-white/10 bg-[#0D0A09] ${
          rulesReveal.visible ? 'is-visible' : ''
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-5">
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-white uppercase sm:text-4xl">
                03. Fair Play &amp; Eligibility
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Key guidelines for every participating squad under the SAMT Campus LAN Esports
                Rulebook (2K26).
              </p>

              <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
                <div className="py-4">
                  <div className="font-mono text-xs font-semibold text-[#E5C736]">
                    01 · Roster &amp; Eligibility
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-white">
                    4 Active Players + 1 Optional Substitute
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                    Open to students aged 16–22 or enrolled from Class 11 through Undergraduate (UG)
                    at any institution. Valid college ID cards are checked at LAN check-in.
                  </p>
                </div>

                <div className="py-4">
                  <div className="font-mono text-xs font-semibold text-[#E5C736]">
                    02 · Devices &amp; Punctuality
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-white">
                    Mobile Only &amp; 10-Min Check-In Window
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                    Emulators, PC clients, physical triggers, cheats, and teaming result in immediate
                    disqualification. Squads not seated within 10 minutes forfeit the match.
                  </p>
                </div>

                <div className="py-4">
                  <div className="font-mono text-xs font-semibold text-[#E5C736]">
                    03 · Payment &amp; Slot Pass
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-white">
                    Official UPI QR &amp; Email Confirmation
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                    Pay through the official college UPI QR and submit your screenshot with the
                    12-digit UTR. Once verified by Admin, your confirmed Group Slot Pass arrives by
                    email.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-between lg:col-span-7">
              <div>
                <div className="overflow-x-auto rounded-xl border border-white/12 bg-[#141110]">
                  <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                      <div className="text-xs font-semibold text-[#E5C736]">
                        SAMT Referee Standards
                      </div>
                      <h3 className="mt-0.5 font-display text-2xl font-bold text-white uppercase">
                        Official Penalty &amp; Fair Play Guide
                      </h3>
                    </div>
                    <ShieldCheck className="h-5 w-5 shrink-0 text-[#E5C736]" />
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral-400">
                        <th className="px-5 py-3.5 font-medium">Offense Level</th>
                        <th className="px-5 py-3.5 font-medium">Penalty</th>
                        <th className="px-5 py-3.5 font-medium">When It Applies</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-neutral-200">
                      <tr>
                        <td className="px-5 py-4 font-semibold whitespace-nowrap text-[#E5C736]">
                          Minor Offenses
                        </td>
                        <td className="px-5 py-4 font-medium text-white">
                          Warning or Point Deduction
                        </td>
                        <td className="px-5 py-4 leading-relaxed text-neutral-400">
                          Applied by referees if players miss lobby timings, room guidelines, or
                          stage conduct standards.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-5 py-4 font-semibold whitespace-nowrap text-[#D41B14]">
                          Major Offenses
                        </td>
                        <td className="px-5 py-4 font-medium text-white">
                          Match Forfeit or Disqualification
                        </td>
                        <td className="px-5 py-4 leading-relaxed text-neutral-400">
                          Enforced for emulators, hacks, duplicate IDs, or severe misconduct;
                          Management decision is final.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-white/12 bg-[#141110] p-6 sm:flex-row sm:items-center">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Ready to Lock Your Squad Slot?
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      Review full point tables or start your 4+1 squad registration now.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({
                          page: 'event',
                          slug: primaryEvent?.slug || 'kalinga-warriors-bgmi',
                        })
                      }
                      className="rounded-md border border-white/15 bg-[#0D0A09] px-4 py-2 text-xs font-medium text-neutral-200 whitespace-nowrap transition-colors hover:bg-white/10"
                    >
                      Read Rulebook
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({
                          page: 'register',
                          slug: primaryEvent?.slug || 'kalinga-warriors-bgmi',
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#D41B14] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap transition-colors hover:bg-[#B41510]"
                    >
                      Register Squad
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-white/10 bg-[#0D0A09]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-8 text-xs text-neutral-400 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-[#E5C736]" />
            <span>
              Srusti Academy of Management &amp; Technology · Campus LAN Esports Championship 2K26
            </span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => onNavigate({ page: 'live' })}
              className="hover:text-white"
            >
              Live Teams
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'track' })}
              className="hover:text-white"
            >
              Track Team Status
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'admin' })}
              className="hover:text-white"
            >
              Coordinator Admin
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
