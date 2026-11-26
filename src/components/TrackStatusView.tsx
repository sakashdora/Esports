import { Printer, Search, Upload } from 'lucide-react';
import { useState } from 'react';
import { clearDraft, lastTeamCode, loadDraft } from '../lib/registrationDraft';
import type { AppRoute } from './Navbar';
import { compressScreenshot } from '../lib/imageCompression';
import { isStrict12DigitUtr } from '../lib/tournamentRules';
import { DigitHint } from './DigitHint';
import { cleanPhoneInput, cleanUtrInput, digitBorderClass, phoneStatus, utrStatus } from '../lib/numericInput';
import type { StatusSummary } from '../lib/tracking';
import { confirmedSeat } from '../lib/checkIn';
import { TeamCheckInPass } from './TeamCheckInPass';

interface TrackedData {
  registration: {
    id: string;
    teamCode: string;
    teamName: string;
    collegeName: string;
    iglPhone: string;
    iglEmail: string;
    lunchCount: number;
    vegCount: number;
    nonVegCount: number;
    totalFee: number;
    status: string;
    slotNumber: string | null;
    groupName: string | null;
    rejectionReason: string | null;
    createdAt: string;
  };
  event: {
    title: string;
    gameTitle: string;
    venueLabel: string;
    eventDateLabel: string;
  };
  members: Array<{
    slotRole: string;
    fullName: string;
    inGameName: string;
    characterId: string;
    academicLevel: string;
    collegeOverride?: string;
    wantsLunch: boolean;
    dietType: string;
  }>;
  latestProof: {
    utrNumber: string;
    upiApp: string;
    paidAmount: number;
    reviewStatus: string;
    rejectionReason: string | null;
    createdAt: string;
  } | null;
}

interface TrackStatusViewProps {
  prefillCode?: string;
  onNavigate?: (next: AppRoute) => void;
}

export function TrackStatusView({ prefillCode, onNavigate }: TrackStatusViewProps) {
  const [teamCode, setTeamCode] = useState(prefillCode || lastTeamCode());
  // A registration this browser started but never submitted can be continued from here.
  const [unfinished, setUnfinished] = useState(() => loadDraft());
  const [iglPhone, setIglPhone] = useState('');
  const phoneState = phoneStatus(iglPhone, '10-digit mobile number used at registration (or use your Team ID).');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<TrackedData | null>(null);
  const [matches, setMatches] = useState<StatusSummary[]>([]);

  // Re-upload state
  const [newUtr, setNewUtr] = useState('');
  const newUtrState = utrStatus(newUtr);
  const [newUpiApp, setNewUpiApp] = useState('Google Pay');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [reuploading, setReuploading] = useState(false);
  const [reuploadMsg, setReuploadMsg] = useState('');

  async function handleLookup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError('');
    setReuploadMsg('');
    setData(null);
    setMatches([]);
    if (!teamCode.trim() && !iglPhone.trim()) {
      setError('Enter your team leader mobile number OR Team Registration ID. Only one is required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/registrations/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamCode, iglPhone }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error || 'Status lookup is unavailable right now. Please try again shortly.');
      if (json.matches) setMatches(json.matches);
      else setData(json);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to fetch registration.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReupload(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isStrict12DigitUtr(newUtr)) {
      setError('Enter the 12-digit UTR number (digits only).');
      return;
    }
    if (!newFile) {
      setError('Select a new payment screenshot.');
      return;
    }
    setReuploading(true);
    try {
      const compressed = await compressScreenshot(newFile);
      const fd = new FormData();
      fd.append('screenshot', compressed);
      fd.append('teamCode', teamCode);
      fd.append('iglPhone', iglPhone);
      fd.append('utrNumber', newUtr);
      fd.append('upiApp', newUpiApp);

      const res = await fetch('/api/registrations/reupload', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error || 'Re-upload failed. Please try again shortly.');
      setNewUtr('');
      setNewFile(null);
      // Refresh first: the lookup clears old messages, so set the success note afterwards.
      await handleLookup();
      setReuploadMsg('New payment proof uploaded. Status reset to Pending Verification.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-upload failed.');
    } finally {
      setReuploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#110D0C] text-neutral-100">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="no-print">
          <h1 className="font-display text-3xl font-bold text-white uppercase">
            Track Team Status &amp; Official Pass
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Enter your team leader mobile number OR Team Registration ID to check status.
            Only one is required.
          </p>

          <form
            onSubmit={handleLookup}
            className="mt-6 grid gap-3 rounded-xl border border-white/10 bg-[#1A1716] p-5 sm:grid-cols-12"
          >
            <div className="sm:col-span-5">
              <label htmlFor="track-code" className="block text-[11px] text-neutral-400">
                Team Registration ID
              </label>
              <input
                id="track-code"
                disabled={loading || reuploading}
                type="text"
                value={teamCode}
                onChange={(e) => { setTeamCode(e.target.value); setData(null); setMatches([]); }}
                placeholder="e.g. KW26-001"
                className="mt-1 w-full rounded-md border border-white/15 bg-[#110D0C] px-3 py-2 font-mono text-sm text-white uppercase focus:border-[#D41B14] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label htmlFor="track-phone" className="block text-[11px] text-neutral-400">
                OR Team Leader Mobile Number
              </label>
              <input
                id="track-phone"
                disabled={loading || reuploading}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={iglPhone}
                onChange={(e) => { setIglPhone(cleanPhoneInput(e.target.value)); setData(null); setMatches([]); }}
                aria-describedby="track-phone-hint"
                aria-invalid={phoneState.tone === 'error'}
                placeholder="9876543210"
                className={`mt-1 w-full rounded-md border bg-[#110D0C] px-3 py-2 font-mono text-sm text-white focus:outline-none ${digitBorderClass(phoneState.tone)}`}
              />
              <DigitHint id="track-phone-hint" status={phoneState} />
            </div>

            <div className="flex items-end sm:col-span-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#D41B14] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B41510] disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {loading ? 'Checking...' : 'Check Status'}
              </button>
            </div>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-neutral-400">
            Either field works for status. For your private payment details, official pass, or proof
            correction, enter both fields to verify your team.
          </p>

          {unfinished && onNavigate && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5C736]/40 bg-[#E5C736]/10 px-4 py-3 text-xs text-[#F3E7A6]">
              <span>
                You have an unfinished registration{unfinished.teamName ? ` for “${unfinished.teamName}”` : ''}. Pick up
                where you stopped.
              </span>
              <span className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'register', slug: unfinished.eventSlug })}
                  className="rounded-md bg-[#E5C736] px-3 py-1.5 font-semibold text-[#110D0C] hover:bg-[#d4b72f]"
                >
                  Continue registration
                </button>
                <button
                  type="button"
                  onClick={() => { clearDraft(); setUnfinished(null); }}
                  className="font-semibold underline"
                >
                  Discard
                </button>
              </span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs text-red-200"
            >
              {error}
              {unfinished && onNavigate ? ' If you never finished paying and submitting, use “Continue registration” above.' : ''}
            </div>
          )}

          {reuploadMsg && (
            <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-xs text-emerald-200">
              {reuploadMsg}
            </div>
          )}
        </div>

        {matches.length > 0 && (
          <section aria-live="polite" className="mt-8 space-y-4">
            <h2 className="font-display text-xl text-white">Registration Status</h2>
            {matches.map((match, index) => (
              <article key={index} className="rounded-xl border border-white/15 bg-[#1A1716] p-5">
                <p className="text-xs text-[#E5C736]">{match.eventTitle.replace(/2k26/gi, '2026')}</p>
                <h3 className="mt-2 break-words text-xl font-semibold">{match.teamName}</h3>
                <p className="mt-3 font-semibold text-white">
                  {({ pending: 'Pending payment verification', verified: 'Verified', rejected: 'Rejected',
                    reupload_required: 'Action required: re-upload payment proof', waitlisted: 'Waitlisted' } as Record<string, string>)[match.status] || 'Awaiting update'}
                </p>
                {match.status === 'reupload_required' && (
                  <p className="mt-2 text-xs text-amber-200">
                    To upload a new proof, enter both your Team ID and mobile number above, then check again.
                  </p>
                )}
                {match.slotNumber && <p className="mt-2 text-sm text-neutral-300">{match.groupName} · Slot {match.slotNumber}</p>}
                <p className="mt-2 text-sm text-neutral-400">{match.venueLabel} · {match.eventDateLabel}</p>
              </article>
            ))}
          </section>
        )}

        {/* Lookup Result Card / Printable Pass */}
        {data && (
          <section className="mt-8 rounded-xl border border-white/15 bg-[#1A1716] p-6 sm:p-8 print:border-slate-300 print:bg-white print:text-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5 print:border-slate-200">
              <div>
                <div className="text-xs text-[#E5C736] print:text-slate-600">
                  {data.event.title.replace(/2k26/gi, '2026')} · {data.event.gameTitle}
                </div>
                <h2 className="mt-1 font-display text-3xl font-bold text-white uppercase print:text-slate-900">
                  {data.registration.teamName}
                </h2>
                <div className="mt-1 text-xs text-neutral-400 print:text-slate-600">
                  {data.registration.collegeName}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="font-mono text-lg font-bold text-white tabular-nums print:text-slate-900">
                  {data.registration.teamCode}
                </div>
                <div className="mt-1 text-xs font-semibold uppercase">
                  {data.registration.status === 'verified' && (
                    <span className="text-emerald-400 print:text-emerald-700">
                      VERIFIED · {data.registration.groupName} ({data.registration.slotNumber})
                    </span>
                  )}
                  {data.registration.status === 'pending' && (
                    <span className="text-amber-400">PENDING PAYMENT VERIFICATION</span>
                  )}
                  {data.registration.status === 'reupload_required' && (
                    <span className="text-red-400">ACTION REQUIRED: RE-UPLOAD PROOF</span>
                  )}
                  {data.registration.status === 'rejected' && (
                    <span className="text-red-400">REJECTED</span>
                  )}
                  {data.registration.status === 'waitlisted' && (
                    <span className="text-amber-300">WAITLISTED (CAPACITY FULL)</span>
                  )}
                </div>
              </div>
            </div>

            {data.registration.rejectionReason && (
              <div className="mt-5 rounded-md border border-red-500/40 bg-red-950/40 p-4 text-xs text-red-200">
                <strong>Admin Note:</strong> {data.registration.rejectionReason}
              </div>
            )}

            <div className="mt-6 grid gap-4 text-xs sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-[#110D0C] p-3.5 print:border-slate-200 print:bg-slate-50">
                <div className="text-neutral-400 print:text-slate-500">Fee &amp; UTR</div>
                <div className="mt-1 font-mono font-semibold text-white tabular-nums print:text-slate-900">
                  Rs. {data.registration.totalFee} · {data.latestProof?.utrNumber || 'N/A'}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#110D0C] p-3.5 print:border-slate-200 print:bg-slate-50">
                <div className="text-neutral-400 print:text-slate-500">Lunch Summary</div>
                <div className="mt-1 font-mono font-semibold text-white tabular-nums print:text-slate-900">
                  {data.registration.lunchCount} Meals ({data.registration.vegCount} Veg /{' '}
                  {data.registration.nonVegCount} Non-Veg)
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#110D0C] p-3.5 print:border-slate-200 print:bg-slate-50">
                <div className="text-neutral-400 print:text-slate-500">Venue &amp; Schedule</div>
                <div className="mt-1 font-medium text-white print:text-slate-900">
                  {data.event.venueLabel} · {data.event.eventDateLabel}
                </div>
              </div>
            </div>

            {/* Squad Roster Table */}
            {confirmedSeat(data.registration) && <TeamCheckInPass teamCode={data.registration.teamCode} iglPhone={data.registration.iglPhone} />}

            <div className="mt-6 overflow-x-auto rounded-lg border border-white/10 print:border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-400 print:border-slate-200 print:text-slate-600">
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5 font-medium">Player Name</th>
                    <th className="px-4 py-2.5 font-medium">IGN</th>
                    <th className="px-4 py-2.5 font-medium">Character ID</th>
                    <th className="px-4 py-2.5 font-medium">Meal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 print:divide-slate-200">
                  {data.members.map((m) => (
                    <tr key={`${m.slotRole}-${m.characterId}`}>
                      <td className="px-4 py-2.5 font-mono font-semibold text-[#E5C736] print:text-slate-900">
                        {m.slotRole}
                      </td>
                      <td className="px-4 py-2.5">
                        {m.fullName}
                        <span className="mt-1 block text-neutral-400 print:text-slate-600">
                          {[m.collegeOverride, m.academicLevel].filter(Boolean).join(' · ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{m.inGameName}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums">{m.characterId}</td>
                      <td className="px-4 py-2.5">
                        {m.wantsLunch ? `Yes (${m.dietType})` : 'No'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Print Pass Button for Verified Teams */}
            {data.registration.status === 'verified' && (
              <div className="no-print mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  <Printer className="h-4 w-4" />
                  Print / Save Official Team Pass
                </button>
              </div>
            )}

            {/* Re-upload Proof Form if Admin requested re-upload */}
            {(data.registration.status === 'reupload_required' ||
              data.registration.status === 'rejected') && (
              <form
                onSubmit={handleReupload}
                className="no-print mt-6 rounded-lg border border-white/15 bg-[#110D0C] p-5"
              >
                <h3 className="text-sm font-semibold text-white">
                  Submit Updated Payment Proof
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label="New 12-digit UTR"
                      aria-describedby="new-utr-hint"
                      value={newUtr}
                      onChange={(e) => setNewUtr(cleanUtrInput(e.target.value))}
                      placeholder="New 12-digit UTR"
                      className={`w-full rounded border bg-[#1A1716] px-3 py-2 font-mono text-xs text-white focus:outline-none ${digitBorderClass(newUtrState.tone)}`}
                    />
                    <DigitHint id="new-utr-hint" status={newUtrState} />
                  </div>
                  <select
                    value={newUpiApp}
                    onChange={(e) => setNewUpiApp(e.target.value)}
                    className="rounded border border-white/15 bg-[#1A1716] px-3 py-2 text-xs text-white"
                  >
                    <option value="Google Pay">Google Pay</option>
                    <option value="PhonePe">PhonePe</option>
                    <option value="Paytm">Paytm</option>
                    <option value="BHIM UPI">BHIM UPI</option>
                  </select>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-white/25 px-3 py-2 text-xs text-neutral-200 hover:border-[#D41B14]">
                    <Upload className="h-3.5 w-3.5" />
                    {newFile ? newFile.name : 'Choose Screenshot'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                      className="sr-only"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={reuploading}
                  className="mt-3 rounded-md bg-[#D41B14] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B41510]"
                >
                  {reuploading ? 'Uploading...' : 'Re-submit Payment Proof'}
                </button>
              </form>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
