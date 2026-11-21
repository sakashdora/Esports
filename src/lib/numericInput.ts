/**
 * Live, as-you-type handling for number-only fields (10-digit mobile, 12-digit UTR).
 * The helpers keep only digits, so letters, spaces and "+91" never end up in the field,
 * and describe the state in plain words for the hint shown under the input.
 */

export type DigitTone = 'idle' | 'progress' | 'error' | 'ok';

export interface DigitStatus {
  tone: DigitTone;
  message: string;
}

const onlyDigits = (raw: string) => raw.replace(/\D/g, '');

/** Keeps digits only. A pasted "+91 98765 43210" or "098765 43210" becomes the 10-digit number. */
export function cleanPhoneInput(raw: string): string {
  let digits = onlyDigits(raw);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** Keeps digits only, up to 12 (a pasted "UTR: 4321 9876 5432" becomes 432198765432). */
export function cleanUtrInput(raw: string): string {
  return onlyDigits(raw).slice(0, 12);
}

const plural = (n: number) => `${n} digit${n === 1 ? '' : 's'}`;

export function phoneStatus(value: string, emptyMessage = 'Enter the 10-digit mobile number (no +91, spaces or dashes).'): DigitStatus {
  const digits = onlyDigits(value);
  if (digits.length === 0) return { tone: 'idle', message: emptyMessage };
  if (!/^[6-9]/.test(digits)) {
    return { tone: 'error', message: 'Indian mobile numbers start with 6, 7, 8 or 9. Check the first digit.' };
  }
  if (digits.length < 10) {
    return { tone: 'progress', message: `${digits.length} of 10 digits entered — ${plural(10 - digits.length)} more needed.` };
  }
  return { tone: 'ok', message: 'Valid 10-digit mobile number.' };
}

export function utrStatus(value: string, emptyMessage = 'Found in GPay / PhonePe / Paytm payment details: exactly 12 digits.'): DigitStatus {
  const digits = onlyDigits(value);
  if (digits.length === 0) return { tone: 'idle', message: emptyMessage };
  if (digits.length < 12) {
    return { tone: 'progress', message: `${digits.length} of 12 digits entered — ${plural(12 - digits.length)} more needed.` };
  }
  return { tone: 'ok', message: 'Valid 12-digit UTR.' };
}

/** Border colour classes (dark theme) so a problem is visible on the field itself. */
export function digitBorderClass(tone: DigitTone): string {
  if (tone === 'error') return 'border-red-500/70 focus:border-red-400';
  if (tone === 'ok') return 'border-emerald-500/60 focus:border-emerald-400';
  if (tone === 'progress') return 'border-amber-500/50 focus:border-amber-400';
  return 'border-white/15 focus:border-[#D41B14]';
}
