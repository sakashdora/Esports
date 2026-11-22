import { useEffect, useState } from 'react';
import { computeCountdown } from '../lib/tournamentRules';
import { EVENT_ENTRY_ISO } from '../lib/defaultEvents';

const ordinalDay = new Intl.PluralRules('en', { type: 'ordinal' });
const daySuffixes = { one: 'st', two: 'nd', few: 'rd', other: 'th', zero: 'th', many: 'th' };

function RollingDigit({ digit }: { digit: string }) {
  const [frame, setFrame] = useState({ current: digit, previous: digit });
  if (frame.current !== digit) setFrame({ current: digit, previous: frame.current });
  const changed = frame.previous !== frame.current;
  return <span className="countdown-reel" aria-hidden="true">
    <span className={changed ? 'countdown-roll' : undefined} key={frame.current}>
      {changed && <span className="countdown-reel-digit countdown-digit-out">{frame.previous}</span>}
      <span className="countdown-reel-digit countdown-digit-in">{frame.current}</span>
    </span>
  </span>;
}

function RollingNumber({ value }: { value: number }) {
  const text = String(value).padStart(2, '0');
  return <span className="countdown-number" aria-label={text}>
    {text.split('').map((digit, index) => <RollingDigit digit={digit} key={index} />)}
  </span>;
}

export function HeroCountdown({ deadlineText = EVENT_ENTRY_ISO }: { deadlineText?: string }) {
  const parsed = Date.parse(deadlineText);
  const targetMs = Number.isFinite(parsed) ? parsed : Date.parse(EVENT_ENTRY_ISO);
  const [countdown, setCountdown] = useState(() => computeCountdown(targetMs));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      const now = Date.now();
      const remaining = computeCountdown(targetMs, now);
      setCountdown(remaining);
      if (!remaining.expired && !document.hidden) {
        // Align with real clock seconds; do not accumulate interval drift.
        timer = setTimeout(refresh, 1000 - (now % 1000) + 10);
      }
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [targetMs]);
  const dateLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
    .formatToParts(targetMs)
    .map(({ type, value }) => type === 'day' ? value + daySuffixes[ordinalDay.select(Number(value))] : value)
    .join('');
  const timeLabel = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(targetMs);
  const segments = [
    { label: 'Days', value: countdown.days }, { label: 'Hours', value: countdown.hours },
    { label: 'Minutes', value: countdown.minutes }, { label: 'Seconds', value: countdown.seconds },
  ];
  return <div className="center-countdown" data-testid="hero-countdown" role="timer" aria-live="off" aria-label={`Time until campus entry on ${dateLabel} at ${timeLabel} IST`}>
    <p className="countdown-heading"><span className="countdown-status-dot" aria-hidden="true" />{countdown.expired ? 'Campus entry has opened' : 'Campus entry opens in'}</p>
    <div className="countdown-grid">{segments.map(segment => <div className="countdown-tile" key={segment.label}>
      <RollingNumber value={segment.value} />
      <span className="countdown-unit">{segment.label}</span>
    </div>)}</div>
    <time className="countdown-target" dateTime={new Date(targetMs).toISOString()}>{dateLabel} · Entry {timeLabel.toUpperCase()} IST</time>
  </div>;
}
