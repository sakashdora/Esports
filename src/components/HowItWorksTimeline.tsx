import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronsRight,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import type { AppRoute } from './Navbar';

export interface TimelineStep {
  step: string;
  phase: string;
  shortTitle: string;
  cardCaption: string;
  title: string;
  summary: string;
  requirements: string[];
  checkpointLabel: string;
  checkpointValue: string;
  checkpointNote: string;
  actionLabel: string;
  actionRoute: AppRoute;
}

interface HowItWorksTimelineProps {
  defaultEventSlug: string;
  onNavigate: (next: AppRoute) => void;
}

function StepVectorIcon({ step, isActive }: { step: string; isActive: boolean }) {
  switch (step) {
    case '01':
      return (
        <svg viewBox="0 0 88 64" className="h-14 w-20 overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="squadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor={isActive ? '#FF9A92' : '#D4D4D8'} />
            </linearGradient>
          </defs>
          {/* Back Left & Right Squad Silhouettes */}
          <circle cx="26" cy="24" r="6.5" fill="url(#squadGrad)" opacity="0.88" />
          <path d="M14 43c0-6.5 5.2-11 12-11s12 4.5 12 11z" fill="url(#squadGrad)" opacity="0.85" />
          <circle cx="62" cy="24" r="6.5" fill="url(#squadGrad)" opacity="0.88" />
          <path d="M50 43c0-6.5 5.2-11 12-11s12 4.5 12 11z" fill="url(#squadGrad)" opacity="0.85" />
          {/* Front Center IGL Silhouette */}
          <circle cx="44" cy="20" r="8.5" fill="#FFFFFF" />
          <path d="M28 45c0-8 7-13.5 16-13.5S60 37 60 45z" fill="#FFFFFF" />
          {/* Crimson Orbital Swoosh */}
          <ellipse
            cx="44"
            cy="36"
            rx="34"
            ry="10.5"
            transform="rotate(-9 44 36)"
            fill="none"
            stroke="#FF2E24"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="145 24"
          />
          <circle cx="75" cy="30" r="2.6" fill="#FF6B5B" />
        </svg>
      );
    case '02':
      return (
        <svg viewBox="0 0 88 64" className="h-14 w-20 overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="clocheGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#C4C4CC" />
            </linearGradient>
          </defs>
          {/* Cloche Top Handle */}
          <circle cx="44" cy="14" r="3" fill="#FFFFFF" />
          {/* Cloche Dome */}
          <path
            d="M23 39c0-11.6 9.4-21 21-21s21 9.4 21 21H23z"
            fill="url(#clocheGrad)"
          />
          {/* Platter Rim */}
          <rect x="17" y="41" width="54" height="3.8" rx="1.9" fill="#E4E4E7" />
          {/* Golden Orbital Swoosh */}
          <ellipse
            cx="44"
            cy="36"
            rx="33"
            ry="10.5"
            transform="rotate(-11 44 36)"
            fill="none"
            stroke="#F5B82E"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="148 22"
          />
          <circle cx="73" cy="29" r="2.4" fill="#FDE047" />
        </svg>
      );
    case '03':
      return (
        <svg viewBox="0 0 88 64" className="h-14 w-20 overflow-visible" aria-hidden="true">
          {/* 4 Golden Corner Scanner Brackets */}
          <path
            d="M22 20V11h9M57 11h9v9M66 44v9h-9M31 53h-9v-9"
            fill="none"
            stroke="#F5B82E"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Crisp QR Finder Squares & Matrix */}
          <rect x="28" y="17" width="11" height="11" rx="1.5" fill="none" stroke="#FFFFFF" strokeWidth="2.6" />
          <rect x="32" y="21" width="3" height="3" fill="#FFFFFF" />
          <rect x="49" y="17" width="11" height="11" rx="1.5" fill="none" stroke="#FFFFFF" strokeWidth="2.6" />
          <rect x="53" y="21" width="3" height="3" fill="#FFFFFF" />
          <rect x="28" y="36" width="11" height="11" rx="1.5" fill="none" stroke="#FFFFFF" strokeWidth="2.6" />
          <rect x="32" y="40" width="3" height="3" fill="#FFFFFF" />
          <rect x="43" y="18" width="3" height="3" fill="#D4D4D8" />
          <rect x="43" y="24" width="3" height="4" fill="#FFFFFF" />
          <rect x="43" y="32" width="5" height="3" fill="#FFFFFF" />
          <rect x="50" y="33" width="4" height="4" fill="#FFFFFF" />
          <rect x="57" y="33" width="3" height="7" fill="#FFFFFF" />
          <rect x="44" y="40" width="4" height="7" fill="#FFFFFF" />
          <rect x="51" y="43" width="9" height="4" fill="#FFFFFF" />
        </svg>
      );
    case '04':
      return (
        <svg viewBox="0 0 88 64" className="h-14 w-20 overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="cloudGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F5B82E" />
            </linearGradient>
          </defs>
          {/* Cloud Outline */}
          <path
            d="M27 47h33a11 11 0 0 0 1.4-21.9A15 15 0 0 0 32.5 21a12.5 12.5 0 0 0-5.5 26z"
            fill="rgba(255,255,255,0.06)"
            stroke="url(#cloudGrad)"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          {/* Upward Upload Arrow */}
          <path
            d="M44 45V28m0 0-7 7m7-7 7 7"
            fill="none"
            stroke="#FDE047"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 88 64" className="h-14 w-20 overflow-visible" aria-hidden="true">
          {/* Tilted Pass Ticket Stub */}
          <g transform="rotate(-10 44 32)">
            <path
              d="M17 19h54v8a5 5 0 0 0 0 10v8H17v-8a5 5 0 0 0 0-10v-8z"
              fill="rgba(255,255,255,0.08)"
              stroke="#F4F4F5"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
            <path
              d="M36 32.5l5.5 5.5 11.5-12"
              fill="none"
              stroke="#F5B82E"
              strokeWidth="3.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      );
  }
}

export function HowItWorksTimeline({ defaultEventSlug, onNavigate }: HowItWorksTimelineProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const steps: TimelineStep[] = [
    {
      step: '01',
      phase: 'Squad Entry',
      shortTitle: 'Build Squad',
      cardCaption: 'Create your team and add members.',
      title: 'Select Title & Enter 4+1 Roster',
      summary:
        'Choose Kalinga Warriors (BGMI) or Kurukshetra (Free Fire) and enter your squad leader contact and player IDs—no account login needed.',
      requirements: [
        'Team Name, College Name, and 10-digit IGL Phone & Email',
        '4 Active Players + 1 Optional Substitute (Name, IGN, Character ID, Class/Year)',
        'Open to students aged 16–22 or enrolled in Class 11 through UG',
      ],
      checkpointLabel: 'Roster Validation',
      checkpointValue: '4 Active + 1 Sub · Unique IDs',
      checkpointNote:
        'Each Character ID and Team Name is checked per tournament to prevent duplicate entries.',
      actionLabel: 'Start Squad Registration',
      actionRoute: { page: 'register', slug: defaultEventSlug },
    },
    {
      step: '02',
      phase: 'Optional Meals',
      shortTitle: 'Lunch & Fee',
      cardCaption: 'Select meal options and pay the fee.',
      title: 'Add Optional Campus Lunch',
      summary:
        'Your squad pays a flat Rs. 299 entry fee. Optionally toggle campus lunch (+Rs. 100 once per team) with Veg or Non-Veg preferences.',
      requirements: [
        'Flat Rs. 299 team registration fee per squad',
        'Optional lunch add-on: Rs. 100 per team, regardless of meal count',
        'Veg or Non-Veg choice recorded individually for catering',
      ],
      checkpointLabel: 'Fee Formula',
      checkpointValue: 'Rs. 299 + optional Rs. 100 per team',
      checkpointNote:
        'For example, 4 players choosing lunch brings your squad total to Rs. 399.',
      actionLabel: 'Calculate Fee & Register',
      actionRoute: { page: 'register', slug: defaultEventSlug },
    },
    {
      step: '03',
      phase: 'UPI Payment',
      shortTitle: 'Scan & Pay',
      cardCaption: 'Scan the QR code and make payment.',
      title: 'Pay via Official SAMT UPI QR',
      summary:
        'Confirm your calculated total, then scan the official college UPI QR with GPay, PhonePe, Paytm, or BHIM to pay directly.',
      requirements: [
        'Official SAMT UPI QR with your exact team total pre-filled on mobile',
        'Zero gateway convenience charges — settles straight to the college account',
        'Save your 12-digit UPI UTR reference number and payment screenshot',
      ],
      checkpointLabel: 'Accepted Apps',
      checkpointValue: 'GPay · PhonePe · Paytm · BHIM',
      checkpointNote:
        'Keep the confirmation screen handy so you can upload it in the next step.',
      actionLabel: 'Proceed to Registration',
      actionRoute: { page: 'register', slug: defaultEventSlug },
    },
    {
      step: '04',
      phase: 'Proof Upload',
      shortTitle: 'Upload UTR',
      cardCaption: 'Upload your payment reference (UTR).',
      title: 'Upload Screenshot & 12-Digit UTR',
      summary:
        'Submit your payment screenshot and 12-digit UTR number to receive an instant Team ID and confirmation receipt by email.',
      requirements: [
        'Upload clear JPEG, PNG, or WebP payment proof (up to 5 MB)',
        'Every 12-digit UTR and payment screenshot is verified for uniqueness',
        'Instant Team ID (e.g., KW26-001) emailed directly to your squad leader',
      ],
      checkpointLabel: 'Submission Status',
      checkpointValue: 'Pending Admin Verification',
      checkpointNote:
        'Check verification progress anytime using your Team ID and 10-digit IGL phone number.',
      actionLabel: 'Track Team Status',
      actionRoute: { page: 'track' },
    },
    {
      step: '05',
      phase: 'Slot Pass',
      shortTitle: 'Confirmed Pass',
      cardCaption: 'Get your confirmation pass.',
      title: 'Administrator Approval & Slot Pass',
      summary:
        'Administrators match your UTR against the college statement, assign your Group A or Group B LAN seat, and email your verified pass.',
      requirements: [
        'Administrator audit against the official SAMT payment statement',
        'Automatic seat assignment in Group A (A1–A12) or Group B (B1–B12)',
        'Verified confirmation email + printable LAN Slot Pass unlocked',
      ],
      checkpointLabel: 'Final Outcome',
      checkpointValue: 'Verified · Group Seat + Printable Pass',
      checkpointNote:
        'If a screenshot is blurry, administrators can request a quick proof re-upload without losing your squad spot.',
      actionLabel: 'Open Status Tracker',
      actionRoute: { page: 'track' },
    },
  ];

  const currentStep = steps[activeIndex] || steps[0];

  return (
    <div className="relative">
      {/* Centered Eyebrow, Bold Italic Display Title & Dual Accent Bar */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center gap-3">
          {/* Left Triple Crimson Diagonal Slashes */}
          <span aria-hidden="true" className="hidden items-center gap-1 sm:inline-flex">
            <span className="h-3.5 w-1.5 -skew-x-[24deg] bg-[#D41B14]/45" />
            <span className="h-3.5 w-1.5 -skew-x-[24deg] bg-[#D41B14]/70" />
            <span className="h-3.5 w-1.5 -skew-x-[24deg] bg-[#D41B14]" />
          </span>

          <div className="hud-chamfer-bar bg-[#D41B14]/55 p-px">
            <div className="hud-chamfer-bar bg-[#0B0909] px-5 py-1.5 text-[11px] font-semibold tracking-[0.26em] uppercase">
              <span className="text-[#E61E19]">Registration</span>{' '}
              <span className="text-neutral-200">Process</span>
            </div>
          </div>

          {/* Right Triple Crimson Diagonal Slashes */}
          <span aria-hidden="true" className="hidden items-center gap-1 sm:inline-flex">
            <span className="h-3.5 w-1.5 -skew-x-[24deg] bg-[#D41B14]" />
            <span className="h-3.5 w-1.5 -skew-x-[24deg] bg-[#D41B14]/70" />
            <span className="h-3.5 w-1.5 -skew-x-[24deg] bg-[#D41B14]/45" />
          </span>
        </div>

        <h2 className="mt-3 font-display text-5xl leading-none font-extrabold italic tracking-tight uppercase sm:text-6xl">
          <span className="text-white">How It </span>
          <span className="text-[#E61E19] drop-shadow-[0_0_24px_rgba(230,30,25,0.4)]">Works ?</span>
        </h2>

        <p className="mx-auto mt-2.5 max-w-xl text-sm italic text-neutral-300">
          Complete all 5 steps and secure your team&apos;s spot in the tournament.
        </p>

        {/* Centered Red & Gold Accent Bar */}
        <div aria-hidden="true" className="mt-3.5 flex items-center justify-center gap-2">
          <span className="h-[3px] w-12 rounded-full bg-[#E61E19]" />
          <span className="h-[3px] w-12 rounded-full bg-[#E5C736]" />
        </div>
      </div>

      {/* 5 Chamfered Esports HUD Step Cards Connected by Golden >> Chevrons */}
      <div
        role="tablist"
        aria-label="Registration Process Steps"
        className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:flex lg:items-stretch lg:gap-2.5"
      >
        {steps.map((item, idx) => {
          const isActive = idx === activeIndex;
          const isFinalGoldCard = idx === steps.length - 1 && !isActive;

          const borderBackground = isActive
            ? 'bg-gradient-to-b from-[#FF3B30] via-[#D41B14] to-[#FF3B30]'
            : isFinalGoldCard
            ? 'bg-gradient-to-br from-white/20 via-white/12 to-[#F5B82E]/85'
            : 'bg-white/18 group-hover:bg-white/35';

          return (
            <Fragment key={item.step}>
              <div
                className={`relative flex-1 min-w-0 pt-3.5 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isActive
                    ? 'drop-shadow-[0_0_20px_rgba(212,27,20,0.48)] lg:-translate-y-1'
                    : isFinalGoldCard
                    ? 'drop-shadow-[0_0_16px_rgba(245,184,46,0.2)]'
                    : 'hover:-translate-y-0.5'
                }`}
              >
                {/* Centered Top Hexagonal Number Badge */}
                <span
                  aria-hidden="true"
                  className={`hud-hex-badge pointer-events-none absolute top-0 left-1/2 z-20 flex h-7 w-16 -translate-x-1/2 items-center justify-center p-px ${
                    isActive
                      ? 'bg-[#FF4D42] shadow-[0_0_16px_rgba(230,30,25,0.9)]'
                      : 'bg-white/30'
                  }`}
                >
                  <span
                    className={`hud-hex-badge flex h-full w-full items-center justify-center font-display text-lg font-extrabold italic tracking-wide ${
                      isActive
                        ? 'bg-gradient-to-b from-[#E61E19] to-[#9E110C] text-white'
                        : 'bg-[#1D1918] text-neutral-100'
                    }`}
                  >
                    {item.step}
                  </span>
                </span>

                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`${item.step} ${item.shortTitle} — ${item.cardCaption}`}
                  onClick={() => setActiveIndex(idx)}
                  className="group relative block h-full w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C736] rounded-xl"
                >
                  {/* Outer Chamfered Border Layer */}
                  <div
                    className={`hud-chamfer-card h-full p-[1.5px] transition-colors duration-200 ${borderBackground}`}
                  >
                    {/* Inner Dark Carbon HUD Surface */}
                    <div
                      className={`hud-chamfer-card relative flex h-full min-h-[214px] flex-col items-center justify-between px-4 pt-9 pb-3.5 ${
                        isActive
                          ? 'bg-[#170909]'
                          : 'bg-[#121010] group-hover:bg-[#171413]'
                      }`}
                    >
                      {/* Active Radial Crimson Glow */}
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(230,30,25,0.42),transparent_68%)]"
                        />
                      )}

                      {/* Custom HUD Vector Icon */}
                      <div className="relative z-10 flex h-16 items-center justify-center transition-transform duration-200 group-hover:scale-105">
                        <StepVectorIcon step={item.step} isActive={isActive} />
                      </div>

                      {/* Title & Concise 2-Line Caption */}
                      <div className="relative z-10 mt-2">
                        <div className="font-display text-2xl leading-none font-extrabold italic tracking-wide text-white">
                          {item.shortTitle}
                        </div>
                        <p className="mx-auto mt-2 max-w-[175px] text-xs leading-relaxed text-neutral-300">
                          {item.cardCaption}
                        </p>
                      </div>

                      {/* Bottom Edge 4 Diagonal HUD Slashes */}
                      <div aria-hidden="true" className="relative z-10 mt-4 flex items-center gap-1">
                        {[0, 1, 2, 3].map((tick) => (
                          <span
                            key={tick}
                            className={`h-1.5 w-2.5 -skew-x-[28deg] ${
                              isActive ? 'bg-[#E61E19]' : 'bg-white/22'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Golden Double-Chevron Connector Between Desktop Cards */}
              {idx < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className="hidden shrink-0 items-center justify-center pt-3.5 lg:flex"
                >
                  <ChevronsRight
                    className={`chevron-flow h-6 w-6 ${
                      idx === activeIndex
                        ? 'text-[#F5B82E] drop-shadow-[0_0_8px_rgba(245,184,46,0.85)]'
                        : 'text-[#F5B82E]/75'
                    }`}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Bottom Centered Chamfered Action Bar ("Already registered? | Track Team ID →") */}
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() => onNavigate({ page: 'track' })}
          className="group relative max-w-full drop-shadow-[0_0_18px_rgba(245,184,46,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C736]"
        >
          <div className="hud-chamfer-bar bg-gradient-to-r from-[#F5B82E]/75 via-white/25 to-[#F5B82E]/65 p-px transition-all duration-200 group-hover:from-[#F5B82E] group-hover:to-[#F5B82E]">
            <div className="hud-chamfer-bar flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 bg-[#100D0C] px-7 py-3 text-xs sm:px-10 sm:text-sm">
              <span className="inline-flex items-center gap-2.5 text-neutral-300 whitespace-nowrap">
                <Users className="h-4 w-4 text-neutral-400" />
                Already registered?
              </span>
              <span aria-hidden="true" className="hidden h-4 w-px bg-white/20 sm:inline-block" />
              <span className="inline-flex items-center gap-1.5 font-semibold italic text-[#F5B82E] whitespace-nowrap transition-transform duration-150 group-hover:translate-x-0.5">
                Track Team ID
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Interactive Step Walkthrough & Direct Action Strip */}
      <div
        key={currentStep.step}
        className="animate-panel-enter mt-7 grid divide-y divide-white/10 overflow-hidden rounded-xl border border-white/12 bg-[#0D0A09]/95 lg:grid-cols-12 lg:divide-x lg:divide-y-0"
      >
        <div className="flex min-w-0 flex-col justify-between p-5 sm:p-6 lg:col-span-7">
          <div>
            <div className="flex items-center gap-2.5 text-xs">
              <span className="font-mono font-semibold text-[#E5C736]">
                Step {currentStep.step} of 05
              </span>
              <span aria-hidden="true" className="text-neutral-600">
                ·
              </span>
              <span className="font-medium text-neutral-300">{currentStep.phase}</span>
            </div>

            <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-white uppercase sm:text-3xl">
              {currentStep.title}
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-300">
              {currentStep.summary}
            </p>

            <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs text-neutral-300">
              {currentStep.requirements.map((req) => (
                <li key={req} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E5C736]" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#151211] px-3 py-2 text-xs font-medium text-neutral-200 whitespace-nowrap transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                disabled={activeIndex === steps.length - 1}
                onClick={() => setActiveIndex((prev) => Math.min(steps.length - 1, prev + 1))}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#151211] px-3 py-2 text-xs font-medium text-neutral-200 whitespace-nowrap transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next Step
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigate(currentStep.actionRoute)}
              className="inline-flex items-center gap-2 rounded-md bg-[#D41B14] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap transition-colors hover:bg-[#B41510]"
            >
              {currentStep.actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between bg-[#131010] p-5 sm:p-6 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <span className="text-xs font-medium text-neutral-400">Stage Checkpoint</span>
              <ShieldCheck className="h-4 w-4 text-[#E5C736]" />
            </div>

            <div className="mt-4">
              <div className="text-xs text-neutral-400">{currentStep.checkpointLabel}</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#E5C736] tabular-nums">
                {currentStep.checkpointValue}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                {currentStep.checkpointNote}
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="text-[11px] font-medium text-neutral-400">Registration Progress</div>
            <div className="mt-2 grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-md border border-white/10 bg-[#0D0A09] text-center text-[11px]">
              <div
                className={`px-2 py-2 ${
                  activeIndex <= 2 ? 'font-semibold text-[#E5C736]' : 'text-neutral-500'
                }`}
              >
                Squad &amp; Pay
              </div>
              <div
                className={`px-2 py-2 ${
                  activeIndex === 3 ? 'font-semibold text-[#E5C736]' : 'text-neutral-500'
                }`}
              >
                Under Review
              </div>
              <div
                className={`px-2 py-2 ${
                  activeIndex === 4 ? 'font-semibold text-emerald-400' : 'text-neutral-500'
                }`}
              >
                Slot Confirmed
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
