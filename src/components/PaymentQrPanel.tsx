import { QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import type { CampusEvent } from '../lib/defaultEvents';
import type { FeeBreakdown } from '../lib/tournamentRules';

interface PaymentQrPanelProps {
  event: CampusEvent;
  feeSummary: FeeBreakdown;
  /** UPI deep link generated from the event VPA; empty when no VPA is configured. */
  upiIntentUri: string;
  className?: string;
}

/**
 * The participant-facing "Scan Official College QR" panel from the registration payment step.
 * Shared with the admin "Participant view" preview so administrators see exactly what students see.
 */
export function PaymentQrPanel({ event, feeSummary, upiIntentUri, className = '' }: PaymentQrPanelProps) {
  // A static QR that fails to load (moved/deleted file, private bucket) falls back to the
  // VPA-generated QR when a VPA is configured, instead of a broken image.
  const [failedQrUrl, setFailedQrUrl] = useState('');
  const qrLoadFailed = Boolean(event.qrImageUrl) && failedQrUrl === event.qrImageUrl;
  const showStaticQr = Boolean(event.qrImageUrl) && !qrLoadFailed;
  const [copied, setCopied] = useState(false);

  // Browsers ignore the download attribute for images on another domain (Supabase storage),
  // so fetch the image and save it from a local object URL instead.
  async function saveQrImage() {
    try {
      const response = await fetch(event.qrImageUrl);
      if (!response.ok) throw new Error('QR unavailable');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      link.href = url;
      link.download = `${event.slug}-upi-qr.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.open(event.qrImageUrl, '_blank', 'noopener');
    }
  }

  async function copyVpa() {
    try {
      await navigator.clipboard.writeText(event.upiVpa);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const vpaLine = event.upiVpa ? (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
      <span className="font-mono text-xs break-all text-slate-600">UPI ID: {event.upiVpa}</span>
      <button
        type="button"
        onClick={copyVpa}
        className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  ) : null;

  return (
    <div className={`min-w-0 rounded-xl border border-white/10 bg-[#1A1716] p-4 sm:p-6 ${className}`}>
      <h2 className="font-display text-2xl font-bold text-white uppercase">
        Scan Official College QR
      </h2>
      <p className="mt-1 text-xs text-neutral-400">
        Pay exact amount{' '}
        <strong className="font-mono text-[#E5C736] tabular-nums">
          Rs. {feeSummary.totalFee}
        </strong>{' '}
        using any UPI app (GPay, PhonePe, Paytm, BHIM).
      </p>

      {/* On a phone the QR on its own screen can't be scanned, so the app link comes first. */}
      {upiIntentUri && (
        <a
          href={upiIntentUri}
          className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-[#E5C736] px-4 py-3 text-sm font-bold text-[#110D0C] hover:bg-[#d4b72f] sm:hidden"
        >
          Pay Rs. {feeSummary.totalFee} in UPI App
        </a>
      )}

      <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white p-3 text-slate-900 sm:p-5">
        {showStaticQr ? (
          <>
            <a
              href={event.qrImageUrl}
              target="_blank"
              rel="noreferrer"
              title="Open the QR at full size"
              className="block w-full"
            >
              <img
                src={event.qrImageUrl}
                alt={`Official UPI QR for ${event.title.replace(/2k26/gi, '2026')}`}
                referrerPolicy="no-referrer"
                onError={() => setFailedQrUrl(event.qrImageUrl)}
                className="mx-auto h-auto max-h-[26rem] w-full max-w-[18rem] object-contain"
              />
            </a>
            {vpaLine}
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-700">
              <a href={event.qrImageUrl} target="_blank" rel="noreferrer" className="underline hover:text-slate-900">
                View full size
              </a>
              <button type="button" onClick={saveQrImage} className="font-semibold underline hover:text-slate-900">
                Save QR image
              </button>
            </div>
            <p className="mt-2 max-w-xs text-center text-[11px] text-slate-500">
              Paying from this phone? Save the QR, then choose “Scan from gallery” in your UPI app.
            </p>
          </>
        ) : upiIntentUri ? (
          <>
            <QRCodeSVG value={upiIntentUri} size={200} className="h-auto max-w-full" />
            {vpaLine}
          </>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <QrCode className="h-16 w-16 text-slate-400" />
            {qrLoadFailed ? (
              <>
                <p className="mt-3 text-xs font-semibold text-slate-800">
                  Official College QR Could Not Be Loaded
                </p>
                <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                  Refresh the page to try again, or contact the tournament coordinators
                  for the official payment details before paying.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-xs font-semibold text-slate-800">
                  Payment Details Coming Soon
                </p>
                <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                  The official college payment QR has not been published yet. Please do not pay
                  anyone else; check back shortly or contact the tournament coordinators.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {upiIntentUri && (
        <a
          href={upiIntentUri}
          className="mt-4 hidden w-full items-center justify-center rounded-md border border-[#E5C736]/40 bg-[#E5C736]/10 px-4 py-2.5 text-xs font-semibold text-[#E5C736] hover:bg-[#E5C736]/20 sm:inline-flex"
        >
          Open in UPI App (Rs. {feeSummary.totalFee})
        </a>
      )}
      {upiIntentUri && (
        <p className="mt-1.5 text-center text-[11px] text-neutral-500">
          Opens your UPI app with the amount filled in. If it declines, save the QR and use
          “Scan from gallery” instead.
        </p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
        After paying, note the 12-digit UTR / UPI Reference from the payment receipt and take a
        screenshot showing the amount and UTR.
      </p>

      <div className="mt-5 space-y-1.5 border-t border-white/10 pt-4 text-xs text-neutral-300">
        <div className="flex justify-between">
          <span className="text-neutral-400">Base Team Fee</span>
          <span className="font-mono tabular-nums">Rs. {feeSummary.baseFee}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-400">
            Team lunch · {feeSummary.lunchCount} meals
          </span>
          <span className="font-mono tabular-nums">Rs. {feeSummary.lunchTotal}</span>
        </div>
        <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-white">
          <span>Total Exact Payment</span>
          <span className="font-mono text-[#E5C736] tabular-nums">
            Rs. {feeSummary.totalFee}
          </span>
        </div>
      </div>
    </div>
  );
}
