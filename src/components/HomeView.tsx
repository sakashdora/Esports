import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Gamepad2,
  HelpCircle,
  MapPin,
  Play,
  Radio,
  Search,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CampusEvent } from '../lib/defaultEvents';
import {
  BGMI_BANNER_IMAGE,
  CAMPUS_EVENT_BANNER_IMAGE,
  CONTROLLER_HERO_IMAGE,
  FREEFIRE_BANNER_IMAGE,
  getEventBannerUrl,
  getEventPosterUrl,
  PRIZE_POOL_TROPHY_IMAGE,
} from '../lib/eventArtwork';
import {
  computeCountdown,
  OFFICIAL_REGISTRATION_DEADLINE_ISO,
  resolveDeadlineTimestamp,
} from '../lib/tournamentRules';
import { EmberParticles } from './EmberParticles';
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
      { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

// Emblems for Top Teams in SVG with cyber neon glows
function TeamEmblem({ type, color }: { type: 'shield' | 'wings' | 'phoenix' | 'cyber' | 'apex'; color: string }) {
  if (type === 'wings') {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
        <path d="M24 8 L32 20 L44 22 L34 32 L36 44 L24 36 L12 44 L14 32 L4 22 L16 20 Z" fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="5" fill={color} />
      </svg>
    );
  }
  if (type === 'phoenix') {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
        <path d="M24 6 C30 14, 38 18, 42 26 C44 32, 38 42, 24 42 C10 42, 4 32, 6 26 C10 18, 18 14, 24 6 Z" fill="none" stroke={color} strokeWidth="2.5" />
        <path d="M24 16 L29 26 L19 26 Z" fill={color} />
      </svg>
    );
  }
  if (type === 'apex') {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
        <polygon points="24,6 42,38 6,38" fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <polygon points="24,18 34,36 14,36" fill="none" stroke={color} strokeWidth="1.5" />
        <circle cx="24" cy="28" r="3" fill={color} />
      </svg>
    );
  }
  if (type === 'cyber') {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
        <path d="M12 8 L36 8 L44 24 L36 40 L12 40 L4 24 Z" fill="none" stroke={color} strokeWidth="2.5" />
        <path d="M18 16 L30 16 L34 24 L30 32 L18 32 L14 24 Z" fill="none" stroke={color} strokeWidth="1.5" />
        <circle cx="24" cy="24" r="3" fill={color} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
      <path d="M24 4 L40 10 L40 26 C40 35, 24 44, 24 44 C24 44, 8 35, 8 26 L8 10 Z" fill="none" stroke={color} strokeWidth="2.5" />
      <path d="M24 12 L32 16 L32 26 C32 31, 24 36, 24 36 C24 36, 16 31, 16 26 L16 16 Z" fill={color} opacity="0.8" />
    </svg>
  );
}

export function HomeView({ events, loading, onNavigate }: HomeViewProps) {
  const primaryEvent = events[0];
  const [selectedFeaturedSlug, setSelectedFeaturedSlug] = useState<string>(
    events[0]?.slug || 'kalinga-warriors-bgmi'
  );
  const [bracketTab, setBracketTab] = useState<string>(
    events[0]?.slug || 'kalinga-warriors-bgmi'
  );
  const [prizeModalOpen, setPrizeModalOpen] = useState(false);
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [trackQuery, setTrackQuery] = useState('');
  const [agreeUpdates, setAgreeUpdates] = useState(true);
  const [subscribedToast, setSubscribedToast] = useState(false);

  // Countdown timer calculation
  const targetMs = resolveDeadlineTimestamp(
    primaryEvent?.registrationDeadline,
    OFFICIAL_REGISTRATION_DEADLINE_ISO
  );
  const [countdown, setCountdown] = useState(() => computeCountdown(targetMs));

  useEffect(() => {
    setCountdown(computeCountdown(targetMs));
    const timer = window.setInterval(() => {
      setCountdown(computeCountdown(targetMs));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [targetMs]);

  const featuredReveal = useScrollReveal();
  const teamsReveal = useScrollReveal();
  const newsReveal = useScrollReveal();
  const guideReveal = useScrollReveal();
  const rulesReveal = useScrollReveal();

  const activeBracketEvent =
    events.find((e) => e.slug === bracketTab) || events[0];

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackQuery.trim()) return;
    if (trackQuery.includes('@')) {
      // Newsletter email
      setSubscribedToast(true);
      setTimeout(() => setSubscribedToast(false), 4000);
      setTrackQuery('');
    } else {
      // Code or phone search -> go to track page
      onNavigate({ page: 'track', prefillCode: trackQuery.trim() });
    }
  };

  const topTeams = [
    { name: 'REALM ECLIPSE', rank: 'RANK #1', game: 'BGMI', color: '#FF2A3B', emblem: 'wings' as const },
    { name: 'OBLIVION FORCE', rank: 'RANK #2', game: 'FREE FIRE', color: '#00E5FF', emblem: 'shield' as const },
    { name: 'NOVA STRIKE', rank: 'RANK #3', game: 'BGMI', color: '#FF7A00', emblem: 'phoenix' as const },
    { name: 'INFERNO ESPORTS', rank: 'RANK #4', game: 'FREE FIRE', color: '#00D1FF', emblem: 'cyber' as const },
    { name: 'VELOCITY GAMING', rank: 'RANK #5', game: 'BGMI', color: '#E51D2E', emblem: 'apex' as const },
  ];

  const newsItems = [
    {
      id: 1,
      tag: 'TOURNAMENT',
      tagColor: 'border-[#FF2A3B]/40 text-[#FF2A3B] bg-[#FF2A3B]/10',
      date: 'FEB 28, 2026',
      title: 'SAMT Championship 2K26 Registration is Officially Live!',
      snippet: 'Battlegrounds Mobile India & Free Fire MAX squad slots are now open with verified UPI QR passes.',
      img: '/src/assets/images/bgmi_esports_poster_1794845845748.jpg',
      linkAction: () => onNavigate({ page: 'register', slug: primaryEvent?.slug || 'kalinga-warriors-bgmi' }),
      linkText: 'REGISTER SQUAD →',
    },
    {
      id: 2,
      tag: 'LAN VENUE',
      tagColor: 'border-[#00E5FF]/40 text-[#00E5FF] bg-[#00E5FF]/10',
      date: 'FEB 22, 2026',
      title: 'Main Auditorium Arena Stage & Dedicated LAN Rigs Confirmed',
      snippet: 'SAMT Central Auditorium features immersive broadcast screens, low-latency Wi-Fi, and live shoutcasting.',
      img: '/src/assets/images/campus_esports_promo_1794841270850.jpg',
      linkAction: () => {
        document.getElementById('tournament-schedule')?.scrollIntoView({ behavior: 'smooth' });
      },
      linkText: 'VIEW SCHEDULE →',
    },
    {
      id: 3,
      tag: 'FAIR PLAY',
      tagColor: 'border-[#E5C736]/40 text-[#E5C736] bg-[#E5C736]/10',
      date: 'FEB 15, 2026',
      title: 'Official Device Restrictions & Anti-Cheat Protocols Released',
      snippet: 'Strict mobile-only policy enforced. Emulators, iPads, and physical trigger buttons are strictly prohibited.',
      img: '/src/assets/images/freefire_esports_poster_1794845845810.jpg',
      linkAction: () => onNavigate({ page: 'event', slug: primaryEvent?.slug || 'kalinga-warriors-bgmi' }),
      linkText: 'READ RULEBOOK →',
    },
  ];

  return (
    <main className="bg-[#09080A] text-neutral-100 selection:bg-[#D41B14] selection:text-white">
      {/* Floating Vertical Social Strip on Right Viewport (Matches Reference Image) */}
      <aside
        aria-label="Social Links"
        className="fixed right-5 top-1/2 -translate-y-1/2 z-30 hidden xl:flex flex-col items-center gap-4.5"
      >
        <a
          href="https://discord.com"
          target="_blank"
          rel="noopener noreferrer"
          title="Join Discord"
          className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#120F12]/80 text-neutral-400 backdrop-blur-md transition-all duration-200 hover:border-[#5865F2]/50 hover:bg-[#5865F2]/20 hover:text-white hover:scale-110"
        >
          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.098.246.195.373.288a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </a>
        <a
          href="https://twitter.com"
          target="_blank"
          rel="noopener noreferrer"
          title="Follow on Twitter / X"
          className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#120F12]/80 text-neutral-400 backdrop-blur-md transition-all duration-200 hover:border-white/40 hover:bg-white/10 hover:text-white hover:scale-110"
        >
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
        <a
          href="https://youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          title="Watch on YouTube"
          className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#120F12]/80 text-neutral-400 backdrop-blur-md transition-all duration-200 hover:border-[#FF0000]/50 hover:bg-[#FF0000]/20 hover:text-white hover:scale-110"
        >
          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </a>
        <a
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          title="Follow on Instagram"
          className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#120F12]/80 text-neutral-400 backdrop-blur-md transition-all duration-200 hover:border-[#E1306C]/50 hover:bg-[#E1306C]/20 hover:text-white hover:scale-110"
        >
          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        </a>
        <div className="my-1 h-10 w-px bg-white/20" />
        <span className="text-[10px] tracking-[0.28em] font-bold text-neutral-400 uppercase [writing-mode:vertical-rl] select-none">
          FOLLOW US
        </span>
      </aside>

      {/* SECTION 1: HERO BROADCAST STAGE */}
      <section className="relative min-h-[92svh] flex flex-col justify-between overflow-hidden border-b border-white/[0.08] bg-[#09080A]">
        {/* Ambient Stadium Lighting Scrims */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(229,29,46,0.28),transparent_55%),radial-gradient(circle_at_20%_80%,rgba(0,229,255,0.12),transparent_48%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#09080A] via-[#09080A]/75 to-transparent z-[1]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#09080A] via-transparent to-[#09080A]/60 z-[1]"
        />

        {/* 60fps Fire Ember Particle Canvas */}
        <EmberParticles density={36} />

        {/* Hero Content Container */}
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pt-8 pb-12 sm:px-6 lg:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
            {/* Left Column: Battle Headline & Primary CTAs */}
            <div className="animate-stage-enter flex flex-col justify-center lg:col-span-7">
              {/* Badge: The Ultimate Battle Awaits */}
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#FF2A3B]/40 bg-[#FF2A3B]/10 px-3.5 py-1 text-xs font-semibold tracking-wider text-[#FF2A3B] uppercase backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF2A3B] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF2A3B]" />
                </span>
                <span>THE ULTIMATE BATTLE AWAITS</span>
              </div>

              {/* Distressed High-Impact Typography */}
              <h1 className="mt-5 font-display uppercase tracking-tight text-white select-none">
                <span className="block text-5xl font-extrabold sm:text-6xl lg:text-[5.2rem] leading-[0.9]">
                  DOMINATE
                </span>
                <span className="block text-5xl font-extrabold sm:text-6xl lg:text-[5.2rem] leading-[0.9] text-transparent bg-clip-text bg-gradient-to-r from-[#FF3B47] via-[#D41B14] to-[#FF7A00] text-glow-red">
                  THE ARENA
                </span>
              </h1>

              {/* Subtitle / Mission */}
              <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-300 sm:text-lg">
                SAMT Campus Esports brings together the state&apos;s best collegiate squads to
                compete for glory, fame, and legendary cash prizes in{' '}
                <strong className="text-white font-semibold">BGMI</strong> and{' '}
                <strong className="text-white font-semibold">Free Fire MAX</strong>.
              </p>

              {/* Primary & Secondary Action Buttons */}
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({
                      page: 'register',
                      slug: primaryEvent?.slug || 'kalinga-warriors-bgmi',
                    })
                  }
                  className="group relative inline-flex items-center gap-3 overflow-hidden rounded-md bg-gradient-to-r from-[#FF2A3B] to-[#D41B14] px-7 py-3.5 text-sm font-bold tracking-wider uppercase text-white shadow-lg shadow-[#FF2A3B]/35 transition-all duration-200 hover:shadow-[#FF2A3B]/60 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    REGISTER NOW
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setTrailerModalOpen(true)}
                  className="group inline-flex items-center gap-2.5 rounded-md border border-white/20 bg-white/[0.04] px-5 py-3.5 text-sm font-semibold text-neutral-100 backdrop-blur-md transition-all duration-200 hover:border-white/40 hover:bg-white/[0.09] active:scale-[0.98]"
                >
                  <Play className="h-4 w-4 text-[#FF2A3B] fill-[#FF2A3B] transition-transform duration-200 group-hover:scale-110" />
                  <span>WATCH TEASER</span>
                </button>
              </div>

              {/* Tournament Specs Sub-strip */}
              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-400">
                <span className="inline-flex items-center gap-1.5 text-neutral-300">
                  <Flame className="h-3.5 w-3.5 text-[#FF2A3B]" /> Srusti Academy LAN Stage
                </span>
                <span aria-hidden="true" className="text-white/20">·</span>
                <span>Mobile Only</span>
                <span aria-hidden="true" className="text-white/20">·</span>
                <span>Rs. 299 / Squad</span>
                <span aria-hidden="true" className="text-white/20">·</span>
                <span className="text-[#E5C736] font-semibold">₹50,000+ Prize Pool</span>
              </div>
            </div>

            {/* Right Column: High-Tech Cyber Controller Visual (Direct from Reference) */}
            <div className="animate-stage-delay-1 relative flex items-center justify-center lg:col-span-5">
              {/* Backlit Red & Cyan Ambient Rings */}
              <div
                aria-hidden="true"
                className="animate-pulse-neon-red pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,42,59,0.38),rgba(0,229,255,0.18)_50%,transparent_75%)] blur-2xl"
              />

              {/* Controller Graphic Container with Floating Animation */}
              <div className="animate-float-slow relative w-full max-w-[460px] aspect-square rounded-2xl overflow-hidden border border-white/10 bg-[#120E12]/80 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
                <img
                  src={CONTROLLER_HERO_IMAGE}
                  alt="Pro Esports Controller in Cyan and Red Neon Backlighting"
                  className="h-full w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                  onError={(e) => {
                    // Fallback to arena banner if custom asset not resolved
                    (e.currentTarget as HTMLImageElement).src = CAMPUS_EVENT_BANNER_IMAGE;
                  }}
                />

                {/* Cyber Corner Ticks */}
                <span className="absolute top-3 left-3 h-3 w-3 border-t-2 border-l-2 border-[#FF2A3B]" />
                <span className="absolute top-3 right-3 h-3 w-3 border-t-2 border-r-2 border-[#00E5FF]" />
                <span className="absolute bottom-3 left-3 h-3 w-3 border-b-2 border-l-2 border-[#FF2A3B]" />
                <span className="absolute bottom-3 right-3 h-3 w-3 border-b-2 border-r-2 border-[#00E5FF]" />

                {/* Floating HUD Chip Top */}
                <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-md border border-white/15 bg-black/70 px-2.5 py-1 text-[11px] font-mono font-semibold text-white backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF] animate-ping" />
                  <span>LAN BROADCAST LIVE</span>
                </div>

                {/* Floating HUD Chip Bottom */}
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-md border border-[#FF2A3B]/40 bg-black/80 px-2.5 py-1 text-[11px] font-mono font-semibold text-[#FF2A3B] backdrop-blur-md">
                  <Trophy className="h-3 w-3 text-[#E5C736]" />
                  <span>KALINGA 2K26</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sponsor & Partner Strip below Hero (Matches Reference Image) */}
        <div className="border-t border-white/[0.08] bg-[#0C0A0D]/90 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 sm:px-6">
            <div className="flex items-center gap-8 opacity-80 transition-all duration-300 hover:opacity-100 flex-wrap">
              <span className="text-[11px] font-bold tracking-widest text-neutral-400 uppercase">
                OFFICIAL PARTNERS
              </span>
              <img
                src="/assets/aistudio/Prospectus_2026_-_27_-_1_bb4cb47c.png"
                alt="SAMT"
                className="h-7 w-auto object-contain grayscale hover:grayscale-0 transition-all"
              />
              <img
                src="/assets/aistudio/SAGSH_22e6af6f.png"
                alt="SAGS"
                className="h-6 w-auto object-contain grayscale hover:grayscale-0 transition-all"
              />
              <img
                src="/assets/aistudio/SRUSTI_PRASAAR_-_BRAND_DESIGN_GUIDE_a91fc8eb.png"
                alt="Srusti Prasaar"
                className="h-6 w-auto object-contain grayscale hover:grayscale-0 transition-all"
              />
            </div>
            <div className="flex items-center gap-6 font-mono text-xs font-semibold text-neutral-400 flex-wrap">
              <span className="tracking-widest uppercase hover:text-white transition-colors">KRAFTON / BGMI</span>
              <span className="text-white/20">|</span>
              <span className="tracking-widest uppercase hover:text-white transition-colors">GARENA FREE FIRE</span>
              <span className="text-white/20">|</span>
              <span className="tracking-widest uppercase hover:text-[#E5C736] transition-colors">INTEL GAMING</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: NEXT TOURNAMENT COUNTDOWN BANNER (Direct from Reference Image) */}
      <section className="relative z-20 mx-auto -mt-4 max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-xl border border-[#FF2A3B]/40 bg-[#141014]/92 p-5 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)]">
          {/* Subtle Top Red Glow Hairline */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF2A3B] to-transparent"
          />

          <div className="grid items-center gap-5 md:grid-cols-12">
            {/* Left Column: Next Tournament Title */}
            <div className="md:col-span-4">
              <span className="text-[11px] font-bold tracking-[0.2em] text-[#FF2A3B] uppercase">
                NEXT TOURNAMENT
              </span>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-white uppercase sm:text-3xl">
                SAMT CHAMPIONSHIP <span className="text-[#FF2A3B]">2K26</span>
              </h2>
            </div>

            {/* Center Column: Digital Chronometer */}
            <div className="flex flex-col items-start md:items-center md:col-span-5">
              <span className="text-[11px] font-medium tracking-wider text-neutral-400 uppercase">
                {countdown.expired ? 'REGISTRATION CLOSED' : 'TOURNAMENT STARTS IN'}
              </span>
              <div className="mt-1.5 flex items-baseline gap-3 sm:gap-4 font-mono">
                <div className="text-center">
                  <span className="text-2xl font-bold text-white tabular-nums sm:text-3xl">
                    {String(countdown.days).padStart(2, '0')}
                  </span>
                  <span className="block text-[10px] font-bold text-[#FF2A3B] tracking-wider uppercase">
                    DAYS
                  </span>
                </div>
                <span className="text-xl font-bold text-white/30">:</span>
                <div className="text-center">
                  <span className="text-2xl font-bold text-white tabular-nums sm:text-3xl">
                    {String(countdown.hours).padStart(2, '0')}
                  </span>
                  <span className="block text-[10px] font-bold text-[#FF2A3B] tracking-wider uppercase">
                    HRS
                  </span>
                </div>
                <span className="text-xl font-bold text-white/30">:</span>
                <div className="text-center">
                  <span className="text-2xl font-bold text-white tabular-nums sm:text-3xl">
                    {String(countdown.minutes).padStart(2, '0')}
                  </span>
                  <span className="block text-[10px] font-bold text-[#FF2A3B] tracking-wider uppercase">
                    MINS
                  </span>
                </div>
                <span className="text-xl font-bold text-white/30">:</span>
                <div className="text-center">
                  <span className="text-2xl font-bold text-[#E5C736] tabular-nums sm:text-3xl countdown-digit-tick">
                    {String(countdown.seconds).padStart(2, '0')}
                  </span>
                  <span className="block text-[10px] font-bold text-[#FF2A3B] tracking-wider uppercase">
                    SECS
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: View Details CTA */}
            <div className="flex justify-start md:justify-end md:col-span-3">
              <button
                type="button"
                onClick={() => {
                  document.getElementById('featured-games')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="group inline-flex items-center gap-2 rounded-md border border-[#FF2A3B]/60 bg-[#FF2A3B]/10 px-5 py-2.5 text-xs font-bold tracking-wider text-white uppercase backdrop-blur-sm transition-all duration-200 hover:bg-[#FF2A3B] hover:border-[#FF2A3B] hover:shadow-lg hover:shadow-[#FF2A3B]/40 active:scale-95"
              >
                <span>VIEW DETAILS</span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: TWO-COLUMN SECTION (FEATURED GAMES + PRIZE POOL) (Direct from Reference Image) */}
      <section
        id="featured-games"
        ref={featuredReveal.ref}
        className={`reveal-section mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 ${
          featuredReveal.visible ? 'is-visible' : ''
        }`}
      >
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column (approx 65% width): FEATURED GAMES */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#FF2A3B]">✦</span>
                <h3 className="font-display text-xl font-extrabold tracking-wider text-white uppercase sm:text-2xl">
                  FEATURED GAMES
                </h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  onNavigate({ page: 'event', slug: primaryEvent?.slug || 'kalinga-warriors-bgmi' })
                }
                className="group flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#FF2A3B] uppercase transition-colors hover:text-white"
              >
                <span>VIEW ALL GAMES</span>
                <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>

            {/* 3 Featured Tournament Cards */}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {/* Card 1: BGMI (Active glowing border as in reference) */}
              <div
                onClick={() => setSelectedFeaturedSlug('kalinga-warriors-bgmi')}
                className={`cyber-card cursor-pointer group relative flex flex-col justify-between overflow-hidden rounded-xl border p-3 ${
                  selectedFeaturedSlug === 'kalinga-warriors-bgmi'
                    ? 'border-[#FF2A3B] ring-1 ring-[#FF2A3B]/50 shadow-[0_0_24px_rgba(255,42,59,0.25)]'
                    : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black/60">
                    <img
                      src={BGMI_BANNER_IMAGE}
                      alt="BGMI Kalinga Clash"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute top-2 left-2 rounded bg-[#FF2A3B] px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                      BGMI
                    </span>
                  </div>
                  <div className="mt-3">
                    <h4 className="font-display text-lg font-bold text-white uppercase">
                      KALINGA CLASH
                    </h4>
                    <p className="text-[11px] font-medium text-neutral-400">
                      4+1 SQUAD · MOBILE
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                  <span className="font-mono text-xs font-bold text-[#E5C736]">
                    ₹299 ENTRY
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate({ page: 'register', slug: 'kalinga-warriors-bgmi' });
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded bg-[#FF2A3B]/20 text-[#FF2A3B] transition-colors hover:bg-[#FF2A3B] hover:text-white"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Card 2: Free Fire */}
              <div
                onClick={() => setSelectedFeaturedSlug('kurukshetra-free-fire')}
                className={`cyber-card cursor-pointer group relative flex flex-col justify-between overflow-hidden rounded-xl border p-3 ${
                  selectedFeaturedSlug === 'kurukshetra-free-fire'
                    ? 'border-[#FF2A3B] ring-1 ring-[#FF2A3B]/50 shadow-[0_0_24px_rgba(255,42,59,0.25)]'
                    : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black/60">
                    <img
                      src={FREEFIRE_BANNER_IMAGE}
                      alt="Free Fire Kurukshetra"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute top-2 left-2 rounded bg-[#00E5FF] px-1.5 py-0.5 text-[9px] font-bold text-black uppercase">
                      FREE FIRE
                    </span>
                  </div>
                  <div className="mt-3">
                    <h4 className="font-display text-lg font-bold text-white uppercase">
                      KURUKSHETRA
                    </h4>
                    <p className="text-[11px] font-medium text-neutral-400">
                      4+1 SQUAD · MOBILE
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                  <span className="font-mono text-xs font-bold text-[#E5C736]">
                    ₹299 ENTRY
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate({ page: 'register', slug: 'kurukshetra-free-fire' });
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-neutral-300 transition-colors hover:bg-[#FF2A3B] hover:text-white"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Card 3: Valorant Exhibition Showmatch */}
              <div
                onClick={() => setSelectedFeaturedSlug('valorant-showmatch')}
                className={`cyber-card cursor-pointer group relative flex flex-col justify-between overflow-hidden rounded-xl border p-3 ${
                  selectedFeaturedSlug === 'valorant-showmatch'
                    ? 'border-[#FF2A3B] ring-1 ring-[#FF2A3B]/50 shadow-[0_0_24px_rgba(255,42,59,0.25)]'
                    : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black/60">
                    <img
                      src="/src/assets/images/campus_esports_promo_1794841270850.jpg"
                      alt="Valorant Invitational"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute top-2 left-2 rounded bg-[#E5C736] px-1.5 py-0.5 text-[9px] font-bold text-black uppercase">
                      EXHIBITION
                    </span>
                  </div>
                  <div className="mt-3">
                    <h4 className="font-display text-lg font-bold text-white uppercase">
                      LAN SHOWMATCH
                    </h4>
                    <p className="text-[11px] font-medium text-neutral-400">
                      5V5 PC · AUDITORIUM
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                  <span className="font-mono text-xs font-bold text-[#00E5FF]">
                    INVITATIONAL
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate({ page: 'live' });
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-neutral-300 transition-colors hover:bg-[#FF2A3B] hover:text-white"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (approx 35% width): PRIZE POOL (Direct from Reference Image) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-3">
              <span className="text-xs font-bold text-[#FF2A3B]">✦</span>
              <h3 className="font-display text-xl font-extrabold tracking-wider text-white uppercase sm:text-2xl">
                PRIZE POOL
              </h3>
            </div>

            <div className="cyber-card relative flex flex-1 flex-col items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-[#120E12]/90 p-6 text-center">
              {/* Backlit Red Aura */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,42,59,0.22),transparent_70%)]"
              />

              <div className="relative z-10">
                <div className="font-display text-4xl font-black tracking-tight text-[#FF2A3B] sm:text-5xl text-glow-red">
                  ₹50,000+
                </div>
                <div className="mt-1 text-xs font-bold tracking-[0.2em] text-neutral-300 uppercase">
                  TOTAL PRIZE POOL
                </div>
              </div>

              {/* Gleaming Trophy Stage Visual */}
              <div className="relative my-4 aspect-[16/10] w-full max-w-[280px] overflow-hidden rounded-lg">
                <img
                  src={PRIZE_POOL_TROPHY_IMAGE}
                  alt="Esports Championship Trophy on Cyber Stage"
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/src/assets/images/bgmi_tournament_poster_1794844478895.jpg';
                  }}
                />
              </div>

              {/* Prize Breakdown Trigger Button (Matches Reference) */}
              <button
                type="button"
                onClick={() => setPrizeModalOpen(true)}
                className="group relative z-10 inline-flex items-center gap-2 rounded-md border border-[#FF2A3B]/60 bg-[#FF2A3B]/10 px-5 py-2.5 text-xs font-bold tracking-wider text-white uppercase transition-all duration-200 hover:bg-[#FF2A3B] hover:shadow-lg hover:shadow-[#FF2A3B]/30 active:scale-95"
              >
                <Trophy className="h-3.5 w-3.5 text-[#E5C736]" />
                <span>PRIZE BREAKDOWN</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: TOP TEAMS SECTION (Direct from Reference Image) */}
      <section
        ref={teamsReveal.ref}
        className={`reveal-section mx-auto max-w-6xl px-4 py-8 sm:px-6 ${
          teamsReveal.visible ? 'is-visible' : ''
        }`}
      >
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#FF2A3B]">✦</span>
            <h3 className="font-display text-xl font-extrabold tracking-wider text-white uppercase sm:text-2xl">
              TOP TEAMS
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ page: 'live' })}
            className="group flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#FF2A3B] uppercase transition-colors hover:text-white"
          >
            <span>VIEW LEADERBOARD</span>
            <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* 5 Top Team Cards in a Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {topTeams.map((team) => (
            <div
              key={team.name}
              className="cyber-card group flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#120F12]/85 p-5 text-center transition-all duration-200 hover:border-white/30 hover:scale-105"
            >
              <TeamEmblem type={team.emblem} color={team.color} />
              <h4 className="mt-3 font-display text-sm font-bold tracking-wide text-white uppercase">
                {team.name}
              </h4>
              <span className="mt-1 font-mono text-[11px] font-semibold text-neutral-400">
                {team.rank}
              </span>
              <span className="mt-1 text-[9px] font-bold tracking-wider text-neutral-500 uppercase">
                {team.game}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5: LATEST NEWS + STAY UPDATED (Direct from Reference Image) */}
      <section
        id="latest-news"
        ref={newsReveal.ref}
        className={`reveal-section mx-auto max-w-6xl px-4 py-12 sm:px-6 ${
          newsReveal.visible ? 'is-visible' : ''
        }`}
      >
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column (approx 65% width): LATEST NEWS */}
          <div className="lg:col-span-8">
            <div className="flex items-center gap-2 pb-4">
              <span className="text-xs font-bold text-[#FF2A3B]">✦</span>
              <h3 className="font-display text-xl font-extrabold tracking-wider text-white uppercase sm:text-2xl">
                LATEST NEWS
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {newsItems.map((item) => (
                <article
                  key={item.id}
                  className="cyber-card group flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-[#120F12]/80 p-3"
                >
                  <div>
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black/70">
                      <img
                        src={item.img}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-neutral-400">{item.date}</span>
                      <span className={`rounded border px-1.5 py-0.5 font-bold uppercase ${item.tagColor}`}>
                        {item.tag}
                      </span>
                    </div>

                    <h4 className="mt-2 text-xs font-bold leading-snug text-white line-clamp-2">
                      {item.title}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={item.linkAction}
                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FF2A3B] uppercase transition-colors hover:text-white"
                  >
                    <span>{item.linkText}</span>
                  </button>
                </article>
              ))}
            </div>
          </div>

          {/* Right Column (approx 35% width): STAY UPDATED / TRACK SQUAD (Matches Reference) */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-4">
              <span className="text-xs font-bold text-[#FF2A3B]">✦</span>
              <h3 className="font-display text-xl font-extrabold tracking-wider text-white uppercase sm:text-2xl">
                STAY UPDATED
              </h3>
            </div>

            <div className="cyber-card relative flex flex-1 flex-col justify-between rounded-xl border border-white/10 bg-[#120E12]/90 p-5">
              <div>
                <p className="text-xs leading-relaxed text-neutral-300">
                  Track your team registration status in real time or subscribe for live tournament schedules and bracket updates.
                </p>

                <form onSubmit={handleTrackSubmit} className="mt-4">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={trackQuery}
                      onChange={(e) => setTrackQuery(e.target.value)}
                      placeholder="Enter Team Code or IGL Phone"
                      className="w-full rounded-md border border-white/15 bg-white/[0.04] py-2.5 pl-3.5 pr-12 text-xs font-medium text-white placeholder-neutral-500 focus:border-[#FF2A3B] focus:outline-none focus:ring-1 focus:ring-[#FF2A3B]"
                    />
                    <button
                      type="submit"
                      className="absolute right-1.5 flex h-7 w-8 items-center justify-center rounded bg-[#FF2A3B] text-white transition-all hover:bg-[#D41B14] hover:scale-105 active:scale-95"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <label className="mt-3 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeUpdates}
                      onChange={(e) => setAgreeUpdates(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-[#FF2A3B]"
                    />
                    <span className="text-[11px] text-neutral-400">
                      I agree to receive official emails and tournament updates.
                    </span>
                  </label>
                </form>

                {subscribedToast && (
                  <div className="mt-3 rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-400 animate-panel-enter">
                    ✓ Subscribed! You will receive tournament notifications.
                  </div>
                )}
              </div>

              <div className="mt-5 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'track' })}
                  className="w-full rounded-md border border-white/15 bg-white/[0.04] py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-white/[0.08]"
                >
                  Direct Squad Status Tracker →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: TOURNAMENT BRACKET & FORMAT TIMELINE */}
      <section
        id="tournament-schedule"
        ref={guideReveal.ref}
        className={`reveal-section border-t border-white/10 bg-[#080708] py-14 ${
          guideReveal.visible ? 'is-visible' : ''
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <HowItWorksTimeline
            defaultEventSlug={primaryEvent?.slug || 'kalinga-warriors-bgmi'}
            onNavigate={onNavigate}
          />

          {/* Match Stages & Podium Split */}
          {activeBracketEvent && (
            <div className="mt-10 overflow-hidden rounded-xl border border-white/12 bg-[#0F0D10]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4.5">
                <div>
                  <div className="text-xs font-semibold text-[#E5C736]">
                    MATCH STAGES &amp; PODIUM SPLIT
                  </div>
                  <h3 className="mt-0.5 font-display text-2xl font-extrabold tracking-tight text-white uppercase sm:text-3xl">
                    {activeBracketEvent.title} ({activeBracketEvent.gameTitle})
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-[#161215] p-1">
                  {events.map((evt) => (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => setBracketTab(evt.slug)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                        activeBracketEvent.slug === evt.slug
                          ? 'bg-[#FF2A3B] text-white shadow-md shadow-[#FF2A3B]/30'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {evt.gameTitle}
                    </button>
                  ))}
                </div>
              </div>

              <div
                key={activeBracketEvent.slug}
                className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4"
              >
                {activeBracketEvent.rulesJson.stages.map((stage) => (
                  <div key={stage.stageNumber} className="p-5.5">
                    <div className="font-mono text-xs font-bold text-[#E5C736]">
                      STAGE {stage.stageNumber}
                    </div>
                    <div className="mt-1 font-display text-lg font-bold text-white uppercase">
                      {stage.name}
                    </div>
                    <div className="mt-1 text-xs font-medium text-neutral-300">
                      {stage.formatAndTeams}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                      {stage.advancement}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col justify-between gap-4 border-t border-white/10 bg-[#141014] px-6 py-4 lg:flex-row lg:items-center">
                <div>
                  <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[#E5C736]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified Cash Prize Split
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-white">
                    Rs. {activeBracketEvent.prizePoolTotal.toLocaleString('en-IN')} Total Prize Pool
                  </div>
                </div>
                <div className="grid grid-cols-1 divide-y divide-white/10 rounded-lg border border-white/10 bg-[#0A080A] sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:min-w-[560px]">
                  {activeBracketEvent.prizeBreakdown.map((tier) => (
                    <div
                      key={tier.position}
                      className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs"
                    >
                      <span className="text-neutral-300">{tier.position}</span>
                      <span className="font-mono font-bold text-[#E5C736] whitespace-nowrap tabular-nums">
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

      {/* SECTION 7: FAIR PLAY, ELIGIBILITY & REFEREE RULES */}
      <section
        ref={rulesReveal.ref}
        className={`reveal-section border-t border-white/10 bg-[#09080A] py-14 ${
          rulesReveal.visible ? 'is-visible' : ''
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h3 className="font-display text-2xl font-extrabold tracking-tight text-white uppercase sm:text-3xl">
                FAIR PLAY &amp; ELIGIBILITY
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                Official rules enforced under the SAMT Campus LAN Esports Rulebook (2K26).
              </p>

              <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
                <div className="py-3.5">
                  <div className="font-mono text-xs font-bold text-[#E5C736]">
                    01 · Roster &amp; Eligibility
                  </div>
                  <h4 className="mt-1 text-xs font-bold text-white">
                    4 Active Players + 1 Optional Substitute
                  </h4>
                  <p className="mt-1 text-xs text-neutral-400">
                    Open to enrolled Class 11, Class 12, and College UG students. College ID cards verified at LAN check-in.
                  </p>
                </div>

                <div className="py-3.5">
                  <div className="font-mono text-xs font-bold text-[#E5C736]">
                    02 · Devices &amp; Punctuality
                  </div>
                  <h4 className="mt-1 text-xs font-bold text-white">
                    Mobile Only &amp; 10-Minute Check-In Window
                  </h4>
                  <p className="mt-1 text-xs text-neutral-400">
                    Emulators, tablets, triggers, hacks, and teaming result in permanent disqualification.
                  </p>
                </div>

                <div className="py-3.5">
                  <div className="font-mono text-xs font-bold text-[#E5C736]">
                    03 · Payment &amp; Slot Pass
                  </div>
                  <h4 className="mt-1 text-xs font-bold text-white">
                    Official College UPI QR &amp; Instant Email Pass
                  </h4>
                  <p className="mt-1 text-xs text-neutral-400">
                    Submit your UPI transaction screenshot with the 12-digit UTR for fast approval.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col justify-between">
              <div className="overflow-hidden rounded-xl border border-white/12 bg-[#120F12]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                  <div>
                    <div className="text-xs font-semibold text-[#E5C736]">
                      REFEREE CODE OF CONDUCT
                    </div>
                    <h4 className="font-display text-xl font-bold text-white uppercase">
                      Penalty &amp; Disqualification Matrix
                    </h4>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-[#E5C736]" />
                </div>

                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400">
                      <th className="px-5 py-3 font-medium">Offense</th>
                      <th className="px-5 py-3 font-medium">Penalty</th>
                      <th className="px-5 py-3 font-medium">Protocol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-neutral-200">
                    <tr>
                      <td className="px-5 py-3.5 font-semibold text-[#E5C736]">Lobby Tardiness</td>
                      <td className="px-5 py-3.5 text-white">Warning / Point Cut</td>
                      <td className="px-5 py-3.5 text-neutral-400">Failure to join custom room within 10 minutes of schedule.</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3.5 font-semibold text-[#FF2A3B]">Unauthorized Devices</td>
                      <td className="px-5 py-3.5 text-white">Immediate Forfeit</td>
                      <td className="px-5 py-3.5 text-neutral-400">Emulators, iPads, macros, or hardware triggers used.</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3.5 font-semibold text-[#FF2A3B]">Cheating / Teaming</td>
                      <td className="px-5 py-3.5 text-white">Disqualification</td>
                      <td className="px-5 py-3.5 text-neutral-400">Third-party scripts, teaming, or identity misrepresentation.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/12 bg-[#120E12] p-5">
                <div>
                  <div className="text-sm font-bold text-white">
                    Ready to claim your championship slot?
                  </div>
                  <p className="text-xs text-neutral-400">
                    Limited to 32 squads per game. Fast UPI QR verification.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({
                      page: 'register',
                      slug: primaryEvent?.slug || 'kalinga-warriors-bgmi',
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-[#FF2A3B] px-5 py-2.5 text-xs font-bold text-white uppercase tracking-wider transition-all hover:bg-[#D41B14] hover:shadow-lg hover:shadow-[#FF2A3B]/40 active:scale-95"
                >
                  <span>REGISTER SQUAD</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER (Matches Reference Image) */}
      <footer className="border-t border-white/10 bg-[#070608] py-12 text-xs text-neutral-400">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Col 1: Brand Lockup */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl font-extrabold tracking-wider text-white uppercase">
                SRUSTI
              </span>
              <img
                src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.png"
                alt="SRUSTI e-SPORTS"
                className="h-6 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,42,59,0.7)]"
              />
            </div>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-neutral-400">
              The flagship inter-college esports tournament organized by Srusti Academy of Management &amp; Technology (SAMT) in collaboration with SAGS and Srusti Prasaar.
            </p>
            <p className="mt-3 text-[11px] text-neutral-500">
              © 2026 Srusti Academy &amp; Nexus Esports. All Rights Reserved.
            </p>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <div className="font-bold tracking-wider text-white uppercase">QUICK LINKS</div>
            <ul className="mt-3 space-y-2">
              <li>
                <button type="button" onClick={() => onNavigate({ page: 'home' })} className="hover:text-white transition-colors">
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'event', slug: primaryEvent?.slug || 'kalinga-warriors-bgmi' })}
                  className="hover:text-white transition-colors"
                >
                  Tournaments &amp; Games
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate({ page: 'live' })} className="hover:text-white transition-colors">
                  Registered Teams
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate({ page: 'track' })} className="hover:text-white transition-colors">
                  Track Approval Status
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Support & Rules */}
          <div>
            <div className="font-bold tracking-wider text-white uppercase">SUPPORT &amp; RULES</div>
            <ul className="mt-3 space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'event', slug: primaryEvent?.slug || 'kalinga-warriors-bgmi' })}
                  className="hover:text-white transition-colors"
                >
                  Rulebook &amp; Scoring
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('tournament-schedule')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="hover:text-white transition-colors"
                >
                  Match Schedules
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate({ page: 'admin' })} className="hover:text-white transition-colors">
                  Coordinator Login
                </button>
              </li>
              <li>
                <a href="mailto:esports@srustiacademy.edu.in" className="hover:text-white transition-colors">
                  Contact Support
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Follow Us */}
          <div>
            <div className="font-bold tracking-wider text-white uppercase">FOLLOW US</div>
            <p className="mt-3 text-xs text-neutral-400">
              Join the official campus LAN Discord or follow on YouTube for live broadcasts.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-neutral-300 hover:bg-[#5865F2] hover:text-white transition-colors">
                <Radio className="h-4 w-4" />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-neutral-300 hover:bg-[#FF0000] hover:text-white transition-colors">
                <Play className="h-4 w-4" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-neutral-300 hover:bg-[#E1306C] hover:text-white transition-colors">
                <Flame className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL 1: PRIZE BREAKDOWN (Matches Reference Button) */}
      {prizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-panel-enter">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#FF2A3B]/50 bg-[#120E12] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setPrizeModalOpen(false)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-neutral-300 hover:bg-[#FF2A3B] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <Trophy className="h-6 w-6 text-[#E5C736]" />
              <h3 className="font-display text-2xl font-extrabold uppercase text-white">
                OFFICIAL PRIZE BREAKDOWN
              </h3>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Guaranteed cash rewards + championship trophies distributed at the SAMT LAN Grand Finals stage.
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-[#E5C736]/40 bg-[#E5C736]/10 p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E5C736] font-bold text-black text-sm">
                    1st
                  </span>
                  <div>
                    <div className="font-bold text-white text-sm">CHAMPION SQUAD</div>
                    <div className="text-[11px] text-neutral-300">Gold Trophy + Certificates + Medals</div>
                  </div>
                </div>
                <span className="font-mono text-base font-bold text-[#E5C736]">
                  ₹25,000 CASH
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/20 bg-white/[0.04] p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-300 font-bold text-black text-sm">
                    2nd
                  </span>
                  <div>
                    <div className="font-bold text-white text-sm">RUNNER-UP SQUAD</div>
                    <div className="text-[11px] text-neutral-300">Silver Crest + Certificates + Medals</div>
                  </div>
                </div>
                <span className="font-mono text-base font-bold text-white">
                  ₹15,000 CASH
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/20 bg-white/[0.04] p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-700 font-bold text-white text-sm">
                    3rd
                  </span>
                  <div>
                    <div className="font-bold text-white text-sm">SECOND RUNNER-UP</div>
                    <div className="text-[11px] text-neutral-300">Bronze Crest + Certificates</div>
                  </div>
                </div>
                <span className="font-mono text-base font-bold text-white">
                  ₹10,000 CASH
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setPrizeModalOpen(false);
                onNavigate({ page: 'register', slug: primaryEvent?.slug || 'kalinga-warriors-bgmi' });
              }}
              className="mt-6 w-full rounded-md bg-[#FF2A3B] py-3 text-xs font-bold tracking-wider text-white uppercase transition-all hover:bg-[#D41B14] hover:shadow-lg hover:shadow-[#FF2A3B]/40"
            >
              REGISTER SQUAD NOW →
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: WATCH TEASER / TOURNAMENT TRAILER */}
      {trailerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-panel-enter">
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/20 bg-[#120E12] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setTrailerModalOpen(false)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-neutral-300 hover:bg-[#FF2A3B] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-[#FF2A3B]" />
              <h3 className="font-display text-2xl font-extrabold uppercase text-white">
                CAMPUS ESPORTS LAN TEASER
              </h3>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Live broadcast stage preview from Srusti Academy of Management &amp; Technology.
            </p>

            <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl bg-black relative flex items-center justify-center border border-white/10">
              <img
                src={CAMPUS_EVENT_BANNER_IMAGE}
                alt="LAN Stage Preview"
                className="h-full w-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col items-center justify-center text-center p-6">
                <div className="h-16 w-16 rounded-full bg-[#FF2A3B] flex items-center justify-center text-white shadow-lg shadow-[#FF2A3B]/50 animate-pulse">
                  <Play className="h-7 w-7 fill-white translate-x-0.5" />
                </div>
                <div className="mt-4 font-display text-xl font-bold uppercase text-white">
                  SAMT AUDITORIUM LAN FINALS
                </div>
                <p className="mt-1 text-xs text-neutral-300 max-w-sm">
                  Catch the high-voltage clash on 60fps big screens with live caster commentary.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setTrailerModalOpen(false)}
                className="rounded-md border border-white/20 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/10"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrailerModalOpen(false);
                  onNavigate({ page: 'register', slug: primaryEvent?.slug || 'kalinga-warriors-bgmi' });
                }}
                className="rounded-md bg-[#FF2A3B] px-5 py-2 text-xs font-bold text-white uppercase hover:bg-[#D41B14]"
              >
                Register Squad
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
