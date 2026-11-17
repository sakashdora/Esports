import { Printer, Search, Upload } from 'lucide-react';
import { useState } from 'react';
import { compressScreenshot } from '../lib/imageCompression';
import { isValidUtr } from '../lib/tournamentRules';

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
}

export function TrackStatusView({ prefillCode }: TrackStatusViewProps) {
  const [teamCode, setTeamCode] = useState(prefillCode || '');
  const [iglPhone, setIglPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<TrackedData | null>(null);

  // Re-upload state
  const [newUtr, setNewUtr] = useState('');
  const [newUpiApp, setNewUpiApp] = useState('Google Pay');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [reuploading, setReuploading] = useState(false);
  const [reuploadMsg, setReuploadMsg] = useState('');

  async function handleLookup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError('');
    setReuploadMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/registrations/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamCode, iglPhone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No registration found.');
      setData(json);
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
    if (!isValidUtr(newUtr)) {
      setError('Enter a valid 12-digit UTR number.');
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Re-upload failed.');
      setReuploadMsg('New payment proof uploaded. Status reset to Pending Verification.');
      setNewUtr('');
      setNewFile(null);
      await handleLookup();
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
            Enter your Unique Team Registration ID and 10-digit IGL Phone Number to check live
            payment verification status or print your confirmed pass.
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
                type="text"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value)}
                placeholder="e.g. KW26-001"
                className="mt-1 w-full rounded-md border border-white/15 bg-[#110D0C] px-3 py-2 font-mono text-sm text-white uppercase focus:border-[#D41B14] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label htmlFor="track-phone" className="block text-[11px] text-neutral-400">
                IGL 10-Digit Phone
              </label>
              <input
                id="track-phone"
                type="tel"
                value={iglPhone}
                onChange={(e) => setIglPhone(e.target.value)}
                placeholder="9876543210"
                className="mt-1 w-full rounded-md border border-white/15 bg-[#110D0C] px-3 py-2 font-mono text-sm text-white focus:border-[#D41B14] focus:outline-none"
              />
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

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs text-red-200"
            >
              {error}
            </div>
          )}

          {reuploadMsg && (
            <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-xs text-emerald-200">
              {reuploadMsg}
            </div>
          )}
        </div>

        {/* Lookup Result Card / Printable Pass */}
        {data && (
          <section className="mt-8 rounded-xl border border-white/15 bg-[#1A1716] p-6 sm:p-8 print:border-slate-300 print:bg-white print:text-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5 print:border-slate-200">
              <div>
                <div className="text-xs text-[#E5C736] print:text-slate-600">
                  {data.event.title} · {data.event.gameTitle}
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
                      <td className="px-4 py-2.5">{m.fullName}</td>
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
                  <input
                    type="text"
                    value={newUtr}
                    onChange={(e) => setNewUtr(e.target.value)}
                    placeholder="New 12-digit UTR"
                    className="rounded border border-white/15 bg-[#1A1716] px-3 py-2 font-mono text-xs text-white"
                  />
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
