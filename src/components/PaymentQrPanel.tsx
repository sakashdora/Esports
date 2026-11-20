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

  return (
    <div className={`rounded-xl border border-white/10 bg-[#1A1716] p-6 ${className}`}>
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

      <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white p-5 text-slate-900">
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
            {event.upiVpa && (
              <span className="mt-2 font-mono text-xs break-all text-slate-600">
                VPA: {event.upiVpa}
              </span>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-700">
              <a href={event.qrImageUrl} target="_blank" rel="noreferrer" className="underline hover:text-slate-900">
                View full size
              </a>
              <a href={event.qrImageUrl} download={`${event.slug}-upi-qr`} className="underline hover:text-slate-900">
                Save QR image
              </a>
            </div>
            <p className="mt-2 max-w-xs text-center text-[11px] text-slate-500">
              Paying from this phone? Save the QR, then choose “Scan from gallery” in your UPI app.
            </p>
          </>
        ) : upiIntentUri ? (
          <>
            <QRCodeSVG value={upiIntentUri} size={200} />
            <span className="mt-2 font-mono text-xs text-slate-600">
              VPA: {event.upiVpa}
            </span>
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
                  Official College QR Pending Upload
                </p>
                <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                  Tournament administrators can upload the official static UPI QR or set the
                  college UPI VPA inside Admin → Events &amp; QR Setup.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {upiIntentUri && (
        <a
          href={upiIntentUri}
          className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-[#E5C736]/40 bg-[#E5C736]/10 px-4 py-2.5 text-xs font-semibold text-[#E5C736] hover:bg-[#E5C736]/20"
        >
          Open in UPI App (Rs. {feeSummary.totalFee})
        </a>
      )}

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
