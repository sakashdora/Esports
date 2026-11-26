import { LogOut } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { VOLUNTEER_ID_KEY, VOLUNTEER_TOKEN_KEY } from '../lib/checkIn';
import { CheckInDesk } from './CheckInDesk';
import { deskSecondary } from './CheckInScanner';
import type { AppRoute } from './Navbar';

export default function VolunteerDashboardView({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const [token] = useState(() => sessionStorage.getItem(VOLUNTEER_TOKEN_KEY) || '');
  const [loginId] = useState(() => sessionStorage.getItem(VOLUNTEER_ID_KEY) || '');
  const signOut = useCallback(() => {
    sessionStorage.removeItem(VOLUNTEER_TOKEN_KEY);
    sessionStorage.removeItem(VOLUNTEER_ID_KEY);
    onNavigate({ page: 'admin' });
  }, [onNavigate]);

  useEffect(() => {
    if (!token) signOut();
  }, [token, signOut]);

  if (!token) return null;
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <img alt="" src="/assets/brand/srusti-academy-crest.png" width="44" height="46" className="object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Event check-in</h1>
              <p className="mt-0.5 text-sm text-slate-600">Signed in as {loginId}</p>
            </div>
          </div>
          <button type="button" onClick={signOut} className={deskSecondary}><LogOut className="h-4 w-4" aria-hidden="true" /> Sign out</button>
        </header>
        <CheckInDesk token={token} onSessionExpired={signOut} />
      </div>
    </main>
  );
}
