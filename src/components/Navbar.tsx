import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export type AppRoute =
  | { page: 'home' }
  | { page: 'guide' }
  | { page: 'live' }
  | { page: 'event'; slug: string }
  | { page: 'register'; slug: string }
  | { page: 'track'; prefillCode?: string }
  | { page: 'admin' };

interface NavbarProps {
  route: AppRoute;
  onNavigate: (next: AppRoute) => void;
  defaultEventSlug: string;
}

export function Navbar({ route, onNavigate, defaultEventSlug }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDarkShell = route.page !== 'admin';

  const navItems: Array<{ label: string; active: boolean; action: () => void }> = [
    {
      label: 'Tournaments',
      active: route.page === 'home',
      action: () => onNavigate({ page: 'home' }),
    },
    {
      label: 'Live Counts',
      active: route.page === 'live',
      action: () => onNavigate({ page: 'live' }),
    },
    {
      label: 'How it works',
      active: false,
      action: () => {
        onNavigate({ page: 'home' });
        window.setTimeout(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }), 0);
      },
    },
    {
      label: 'Track Status',
      active: route.page === 'track',
      action: () => onNavigate({ page: 'track' }),
    },
    { label: 'Admin sign in', active: route.page === 'admin', action: () => onNavigate({ page: 'admin' }) },
  ];

  return (
    <header
      className={`no-print sticky top-0 z-40 border-b transition-colors ${
        isDarkShell
          ? 'border-white/10 bg-[#0D0A09]/92 text-white backdrop-blur-md'
          : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-1 px-3 py-2.5 sm:gap-3 sm:px-6">
        <button
          type="button"
          aria-label="e-Sports home"
          onClick={() => onNavigate({ page: 'home' })}
          className="group relative flex min-h-10 shrink-0 items-center overflow-hidden rounded-md px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D41B14] sm:px-2"
        >
          {isDarkShell && (
            <span
              aria-hidden="true"
              className="logo-ember-aura pointer-events-none absolute -inset-1 rounded-lg bg-[radial-gradient(ellipse_at_center,rgba(212,27,20,0.28),rgba(255,107,26,0.12)_55%,transparent_75%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
            />
          )}
          <img
            src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.webp"
            alt=""
            referrerPolicy="no-referrer"
            className={`relative h-8 w-auto shrink-0 object-contain transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] sm:h-9 ${
              isDarkShell ? 'drop-shadow-[0_0_10px_rgba(212,27,20,0.65)]' : ''
            }`}
          />
          {isDarkShell && (
            <span
              aria-hidden="true"
              className="logo-shimmer-beam pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
          )}
        </button>

        {/* Zone 2: Single-line Navigation Links */}
        <nav aria-label="Primary" className="hidden items-center gap-4 xl:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className={`shrink-0 whitespace-nowrap border-b-2 py-1 text-[13px] font-medium tracking-wide transition-colors duration-150 ${
                item.active
                  ? isDarkShell
                    ? 'border-[#D41B14] text-white'
                    : 'border-[#D41B14] text-slate-900 font-semibold'
                  : isDarkShell
                  ? 'border-transparent text-neutral-400 hover:border-[#E5C736]/60 hover:text-white'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate({ page: 'register', slug: defaultEventSlug })}
            className="group relative hidden shrink-0 overflow-hidden whitespace-nowrap rounded-md bg-gradient-to-r from-[#D41B14] to-[#B41510] px-4 py-2.5 text-xs font-semibold tracking-wide text-white shadow-md shadow-[#D41B14]/30 transition-all duration-200 hover:shadow-[#D41B14]/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D41B14] sm:inline-flex"
          >
            <span className="relative z-10">Register Squad</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full"
            />
          </button>

          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md border xl:hidden ${
              isDarkShell
                ? 'border-white/15 text-neutral-200 hover:bg-white/5'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className={`border-t px-4 py-3 xl:hidden ${
            isDarkShell
              ? 'border-white/10 bg-[#1A1716] text-neutral-100'
              : 'border-slate-200 bg-slate-50 text-slate-900'
          }`}
        >
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  item.action();
                }}
                className={`w-full rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                  item.active
                    ? 'bg-[#D41B14]/15 text-[#D41B14]'
                    : isDarkShell
                    ? 'text-neutral-200 hover:bg-white/5'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onNavigate({ page: 'register', slug: defaultEventSlug });
              }}
              className="mt-2 w-full rounded-md bg-[#D41B14] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#B41510]"
            >
              Register Squad
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
