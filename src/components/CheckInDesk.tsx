import { CalendarDays, Check, MapPin, RefreshCw, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminRequest } from '../lib/adminRequest';
import type { AttendanceEntry, AttendanceMark, CheckInSquad } from '../lib/checkIn';
import { CheckInScanner, deskPrimary, deskSecondary } from './CheckInScanner';

interface CheckInDeskProps {
  token: string;
  onSessionExpired: () => void;
}

const slotLabels: Record<string, string> = { IGL: 'Team leader', P2: 'Player 2', P3: 'Player 3', P4: 'Player 4', SUB: 'Substitute' };
const timeFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

function formatCheckInTime(value: string) {
  return `${timeFormat.format(new Date(value))} IST`;
}

export function CheckInDesk({ token, onSessionExpired }: CheckInDeskProps) {
  const [squad, setSquad] = useState<CheckInSquad | null>(null);
  const [busy, setBusy] = useState('');
  const operation = useRef(false);
  const rosterRef = useRef<HTMLElement>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setAttendanceLoading(true);
    setAttendanceError('');
    void (async () => {
      try {
        const response = await adminRequest(`/api/check-in/attendance?page=${page}`, token, { signal: controller.signal }, onSessionExpired);
        const result: { entries: AttendanceEntry[]; hasMore: boolean } = await response.json();
        if (controller.signal.aborted) return;
        setEntries(result.entries);
        setHasMore(result.hasMore);
      } catch (error) {
        if (!controller.signal.aborted) setAttendanceError(error instanceof Error ? error.message : 'Unable to load attendance.');
      } finally {
        if (!controller.signal.aborted) setAttendanceLoading(false);
      }
    })();
    return () => controller.abort();
  }, [token, page, revision, onSessionExpired]);

  const lookup = useCallback(async (code: string) => {
    if (operation.current) return;
    operation.current = true;
    setBusy('lookup');
    setError('');
    setNotice('');
    setSquad(null);
    try {
      const response = await adminRequest('/api/check-in/lookup', token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      }, onSessionExpired);
      const result: { squad: CheckInSquad } = await response.json();
      setSquad(result.squad);
      // On phones the roster is below the scanner: bring it into view.
      if (window.matchMedia('(max-width: 1023px)').matches) {
        requestAnimationFrame(() => rosterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to look up this pass.');
    } finally {
      operation.current = false;
      setBusy('');
    }
  }, [token, onSessionExpired]);

  async function markPresent(player: CheckInSquad['players'][number]) {
    if (operation.current || !squad) return;
    operation.current = true;
    setBusy(player.id);
    setError('');
    setNotice('');
    try {
      const response = await adminRequest(`/api/check-in/${encodeURIComponent(squad.teamCode)}/present`, token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: player.id }),
      }, onSessionExpired);
      const { mark }: { mark: AttendanceMark } = await response.json();
      setSquad({ ...squad, players: squad.players.map((member) => member.id === player.id ? { ...member, attendance: mark } : member) });
      setNotice(`${player.fullName} is present.`);
      setPage(1);
      setRevision((current) => current + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save attendance.');
    } finally {
      operation.current = false;
      setBusy('');
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(285px,360px)_minmax(0,1fr)]">
        <CheckInScanner busy={Boolean(busy)} onRead={lookup} />
        <section ref={rosterRef} aria-labelledby="squad-title" className="min-w-0 scroll-mt-20 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
            <div className="min-w-0">
              {squad && <p className="mb-1 font-mono text-sm font-semibold text-[#233D8B]">{squad.teamCode}</p>}
              <h2 id="squad-title" className="break-words text-xl font-bold text-slate-950">{squad?.teamName || 'Team roster'}</h2>
              {squad && <p className="mt-1 text-sm text-slate-600">{squad.eventTitle} · {squad.seat}</p>}
            </div>
            {squad && <p className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">{squad.players.filter((player) => player.attendance).length} / {squad.players.length} present</p>}
          </div>
          {error && <p role="alert" className="mx-4 mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 sm:mx-5">{error}</p>}
          {notice && <p role="status" className="mx-4 mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:mx-5">{notice}</p>}
          {!squad ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center text-slate-600">
              <Users className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="text-sm" role={busy === 'lookup' ? 'status' : undefined}>{busy === 'lookup' ? 'Looking up the pass…' : 'Scan a team pass to view participants and mark attendance.'}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:px-5">
                <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#233D8B]" aria-hidden="true" />{squad.eventDate}</p>
                <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#233D8B]" aria-hidden="true" />{squad.venue}</p>
              </div>
              <ul className="divide-y divide-slate-200">
                {squad.players.map((player) => (
                  <li key={player.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                    <div className="min-w-0 break-words">
                      <p className="text-xs font-semibold text-[#233D8B]">{slotLabels[player.slotRole] || player.slotRole}</p>
                      <p className="text-base font-semibold text-slate-950">{player.fullName}</p>
                      <p className="text-sm text-slate-700">{player.inGameName} · ID {player.characterId}</p>
                      <p className="text-sm text-slate-600">{player.college} · {player.academicLevel}{player.wantsLunch ? ` · ${player.dietType === 'VEG' ? 'Veg lunch' : 'Non-veg lunch'}` : ' · No lunch'}</p>
                    </div>
                    {player.attendance ? (
                      <div className="text-sm sm:text-right">
                        <p className="inline-flex items-center gap-1 font-semibold text-emerald-800"><Check className="h-4 w-4" aria-hidden="true" /> Present</p>
                        <p className="text-xs text-slate-600">{formatCheckInTime(player.attendance.checkedInAt)}</p>
                      </div>
                    ) : (
                      <button type="button" className={deskPrimary} disabled={Boolean(busy)} onClick={() => void markPresent(player)} aria-label={`Mark ${player.fullName} present`}>
                        {busy === player.id ? 'Saving…' : 'Mark present'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="attendance-title" className="min-w-0 rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
          <h2 id="attendance-title" className="text-lg font-bold text-slate-950">Attendance</h2>
          <button type="button" className={deskSecondary} disabled={attendanceLoading} onClick={() => setRevision((current) => current + 1)}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh attendance
          </button>
        </div>
        {attendanceError ? <p role="alert" className="p-5 text-sm text-red-800">{attendanceError}</p> : attendanceLoading ? (
          <p role="status" className="p-5 text-sm text-slate-600">Loading attendance…</p>
        ) : entries.length ? (
          <>
          <ul className="divide-y divide-slate-200 sm:hidden">
            {entries.map((entry) => (
              <li key={entry.memberId} className="px-4 py-3 text-sm">
                <p className="font-semibold break-words text-slate-900">{entry.fullName}</p>
                <p className="break-words text-slate-700">{entry.teamName} <span className="text-xs text-slate-500">· {entry.teamCode}</span></p>
                <p className="text-xs text-slate-600">{formatCheckInTime(entry.checkedInAt)} · by <span className="break-all">{entry.checkedInBy}</span></p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>{['Participant', 'Team', 'Checked in (IST)', 'Marked by'].map((label) => <th key={label} scope="col" className="px-4 py-2.5 font-semibold sm:px-5">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {entries.map((entry) => (
                  <tr key={entry.memberId}>
                    <th scope="row" className="break-words px-4 py-2.5 font-semibold text-slate-900 sm:px-5">{entry.fullName}</th>
                    <td className="px-4 py-2.5 text-slate-700 sm:px-5">{entry.teamName}<span className="block text-xs text-slate-500">{entry.teamCode}</span></td>
                    <td className="px-4 py-2.5 text-slate-700 sm:px-5">{formatCheckInTime(entry.checkedInAt)}</td>
                    <td className="break-all px-4 py-2.5 text-slate-700 sm:px-5">{entry.checkedInBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : <p className="p-5 text-sm text-slate-600">No participants have checked in yet.</p>}
        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:px-5">
            <button type="button" className={deskSecondary} disabled={attendanceLoading || page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {page}</span>
            <button type="button" className={deskSecondary} disabled={attendanceLoading || !hasMore} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        )}
      </section>
    </div>
  );
}
