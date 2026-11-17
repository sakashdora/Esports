import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  computeCountdown,
  OFFICIAL_REGISTRATION_DEADLINE_ISO,
  resolveDeadlineTimestamp,
} from '../lib/tournamentRules';

interface HeroCountdownProps {
  deadlineText?: string;
}

export function HeroCountdown({ deadlineText }: HeroCountdownProps) {
  const targetMs = resolveDeadlineTimestamp(deadlineText, OFFICIAL_REGISTRATION_DEADLINE_ISO);
  const [countdown, setCountdown] = useState(() => computeCountdown(targetMs));

  useEffect(() => {
    setCountdown(computeCountdown(targetMs));
    const timer = window.setInterval(() => {
      setCountdown(computeCountdown(targetMs));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [targetMs]);

  const targetDateLabel = new Date(targetMs).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const targetTimeLabel = new Date(targetMs).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  const segments = [
    { label: 'Days', value: String(countdown.days).padStart(2, '0') },
    { label: 'Hours', value: String(countdown.hours).padStart(2, '0') },
    { label: 'Mins', value: String(countdown.minutes).padStart(2, '0') },
    { label: 'Secs', value: String(countdown.seconds).padStart(2, '0'), isSeconds: true },
  ];

  const secondsScale = countdown.expired ? 0 : Math.max(0.03, countdown.seconds / 60);

  return (
    <div
      data-testid="hero-countdown"
      className="relative mt-5 max-w-lg overflow-hidden rounded-xl border border-white/14 bg-[#120F0E]/82 p-4 backdrop-blur-md shadow-[0_14px_34px_-18px_rgba(0,0,0,0.9)]"
    >
      {/* Subtle Top Precision Accent Hairline */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D41B14]/70 to-transparent"
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-neutral-200 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[#E5C736]" />
          {countdown.expired ? 'Registration Closed' : 'Registration Closes In'}
        </span>
        <time
          dateTime={new Date(targetMs).toISOString()}
          className="font-mono text-[11px] font-medium text-neutral-400 whitespace-nowrap tabular-nums"
        >
          {targetDateLabel} · {targetTimeLabel.toUpperCase()} IST
        </time>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-2.5">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`relative overflow-hidden rounded-lg border px-2 py-2.5 text-center transition-colors ${
              seg.isSeconds
                ? 'border-[#D41B14]/45 bg-[#171110]/95'
                : 'border-white/10 bg-[#0A0807]/90'
            }`}
          >
            {/* Subtle Split-Chronograph Center Hairline */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/[0.04]"
            />

            <div className="relative flex justify-center overflow-hidden">
              <span
                key={seg.value}
                className={`countdown-digit-tick inline-block font-mono text-2xl leading-none font-bold tracking-tight tabular-nums sm:text-[1.8rem] ${
                  seg.isSeconds ? 'text-[#E5C736]' : 'text-white'
                }`}
              >
                {seg.value}
              </span>
            </div>

            <div className="relative mt-1.5 text-[11px] font-medium text-neutral-400">
              {seg.label}
            </div>

            {seg.isSeconds && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[#D41B14] transition-transform duration-700 ease-out"
                style={{ transform: `scaleX(${secondsScale})` }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
