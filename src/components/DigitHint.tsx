import { CheckCircle2 } from 'lucide-react';
import type { DigitStatus } from '../lib/numericInput';

const TONE_CLASS = {
  idle: 'text-neutral-400',
  progress: 'text-amber-300',
  error: 'text-red-400',
  ok: 'text-emerald-400',
} as const;

/** The live message under a number-only field. Announced politely to screen readers. */
export function DigitHint({ id, status }: { id: string; status: DigitStatus }) {
  return (
    <p id={id} role="status" aria-live="polite" className={`mt-1 flex items-center gap-1.5 text-[11px] leading-snug ${TONE_CLASS[status.tone]}`}>
      {status.tone === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{status.message}</span>
    </p>
  );
}
