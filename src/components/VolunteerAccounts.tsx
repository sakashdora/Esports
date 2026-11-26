import { KeyRound, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminRequest } from '../lib/adminRequest';
import type { VolunteerAccount } from '../lib/checkIn';
import { deskButton, deskInput, deskPrimary, deskSecondary } from './CheckInScanner';

export function VolunteerAccounts({ token, onSessionExpired }: { token: string; onSessionExpired: () => void }) {
  const [volunteers, setVolunteers] = useState<VolunteerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [editing, setEditing] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await adminRequest('/api/admin/volunteers', token, { signal: controller.signal }, onSessionExpired);
        const result: { volunteers: VolunteerAccount[] } = await response.json();
        if (!controller.signal.aborted) setVolunteers(result.volunteers);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Unable to load volunteer accounts.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [token, onSessionExpired]);

  async function save(event: React.FormEvent, updating: boolean) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const url = updating ? `/api/admin/volunteers/${encodeURIComponent(editing)}/password` : '/api/admin/volunteers';
      const response = await adminRequest(url, token, {
        method: updating ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updating ? { password: newPassword } : { loginId, password }),
      }, onSessionExpired);
      const account: VolunteerAccount = await response.json();
      if (updating) {
        setEditing('');
        setNewPassword('');
        setNotice(`Password updated for ${account.loginId}. They’ll need to sign in again.`);
      } else {
        setVolunteers((current) => [...current, account].sort((a, b) => a.loginId.localeCompare(b.loginId)));
        setLoginId('');
        setPassword('');
        setNotice(`Volunteer account ${account.loginId} created.`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save this volunteer account.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(`Remove volunteer ${id}? They will be signed out and can no longer open check-in.`)) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await adminRequest(`/api/admin/volunteers/${encodeURIComponent(id)}`, token, { method: 'DELETE' }, onSessionExpired);
      setVolunteers((current) => current.filter((volunteer) => volunteer.loginId !== id));
      if (editing === id) setEditing('');
      setNotice(`Volunteer ${id} removed.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to remove this volunteer.');
    } finally {
      setBusy(false);
    }
  }

  function edit(next: string) {
    setEditing(next);
    setNewPassword('');
    setNotice('');
    setError('');
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white" aria-labelledby="volunteer-accounts-title">
      <div className="border-b border-slate-200 p-4 sm:p-5">
        <h2 id="volunteer-accounts-title" className="text-xl font-bold text-slate-950">Volunteer accounts</h2>
        <p className="mt-1 text-sm text-slate-600">Volunteers use the Admin sign-in page to open Event check-in.</p>
        {notice && <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
        {error && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      </div>
      <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(260px,350px)_1fr]">
        <form className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => void save(event, false)}>
          <h3 className="font-semibold text-slate-950">Create volunteer</h3>
          <label htmlFor="new-volunteer-id" className="block text-sm font-medium text-slate-800">Volunteer ID</label>
          <input id="new-volunteer-id" className={deskInput} value={loginId} minLength={3} maxLength={32} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="desk-01" onChange={(event) => setLoginId(event.target.value)} required />
          <label htmlFor="new-volunteer-password" className="block text-sm font-medium text-slate-800">Password</label>
          <input id="new-volunteer-password" className={deskInput} type="password" value={password} minLength={8} maxLength={128} autoComplete="new-password" placeholder="At least 8 characters" onChange={(event) => setPassword(event.target.value)} required />
          <button className={deskPrimary} type="submit" disabled={busy || loading || Boolean(loadError)}><UserPlus className="h-4 w-4" aria-hidden="true" /> Create account</button>
        </form>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-950">Existing volunteers</h3>
          {loadError ? <p role="alert" className="mt-2 text-sm text-red-800">{loadError}</p> : loading ? (
            <p role="status" className="mt-2 text-sm text-slate-600">Loading accounts…</p>
          ) : volunteers.length ? (
            <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200">
              {volunteers.map(({ loginId }) => (
                <li key={loginId} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="break-all font-mono text-sm font-semibold text-slate-900">{loginId}</span>
                    {editing !== loginId && (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={deskSecondary} disabled={busy} onClick={() => edit(loginId)} aria-label={`Change password for ${loginId}`}><KeyRound className="h-4 w-4" aria-hidden="true" /> Change password</button>
                        <button type="button" className={`${deskButton} border border-red-200 bg-white text-red-700 hover:bg-red-50`} disabled={busy} onClick={() => void remove(loginId)} aria-label={`Remove volunteer ${loginId}`}><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove</button>
                      </div>
                    )}
                  </div>
                  {editing === loginId && (
                    <form className="mt-2 space-y-2" onSubmit={(event) => void save(event, true)}>
                      <label htmlFor="reset-volunteer-password" className="text-sm font-medium text-slate-800">New password</label>
                      <input id="reset-volunteer-password" type="password" className={deskInput} value={newPassword} minLength={8} maxLength={128} autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} required autoFocus />
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" className={deskPrimary} disabled={busy}>Update password</button>
                        <button type="button" className={deskSecondary} disabled={busy} onClick={() => edit('')}>Cancel</button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-slate-600">No volunteer accounts yet.</p>}
        </div>
      </div>
    </section>
  );
}
