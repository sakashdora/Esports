import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ACADEMY_NAME } from '../lib/academy';
import { AcademyLogo } from './AcademyLogo';

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

const navigationItems: { label: string; route: AppRoute }[] = [
  { label: 'Tournaments', route: { page: 'home' } },
  { label: 'Live Counts', route: { page: 'live' } },
  { label: 'Track Status', route: { page: 'track' } },
  { label: 'Admin sign in', route: { page: 'admin' } },
];

const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson';
const registerStyle = 'min-h-11 items-center justify-center rounded-md bg-crimson px-4 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-crimson-hover';

export function Navbar({ route, onNavigate, defaultEventSlug }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDarkShell = route.page !== 'admin';
  const registrationRoute: AppRoute = { page: 'register', slug: defaultEventSlug };

  function navigate(next: AppRoute) {
    setMobileOpen(false);
    onNavigate(next);
  }

  return (
    <header
      className={`no-print sticky top-0 z-40 border-b ${
        isDarkShell ? 'border-white/10 bg-obsidian text-white' : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <div className="stage-container flex min-h-16 items-center justify-between gap-3 lg:min-h-18 lg:gap-6">
        <button
          type="button"
          aria-label={`${ACADEMY_NAME} home`}
          onClick={() => navigate({ page: 'home' })}
          className={`flex min-h-11 w-full min-w-0 max-w-76 items-center rounded-md py-1 lg:max-w-80 ${focusStyle}`}
        >
          <AcademyLogo darkSurface={isDarkShell} />
        </button>

        <nav aria-label="Primary" className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {navigationItems.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-current={route.page === item.route.page ? 'page' : undefined}
              onClick={() => navigate(item.route)}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-t-md border-b-2 border-transparent px-3 pt-0.5 text-sm font-medium transition-colors aria-[current=page]:border-crimson ${focusStyle} ${
                isDarkShell
                  ? 'text-neutral-300 hover:bg-white/5 hover:text-white aria-[current=page]:text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 aria-[current=page]:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(registrationRoute)}
            className={`hidden sm:inline-flex ${registerStyle} ${focusStyle}`}
          >
            Register Squad
          </button>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((prev) => !prev)}
            className={`inline-flex size-11 items-center justify-center rounded-md border transition-colors lg:hidden ${focusStyle} ${
              isDarkShell
                ? 'border-white/10 text-neutral-200 hover:bg-white/5 aria-expanded:bg-white/5'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100 aria-expanded:bg-slate-100'
            }`}
          >
            {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        className={`border-t lg:hidden ${mobileOpen ? 'block' : 'hidden'} ${
          isDarkShell ? 'border-white/10 bg-charcoal' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="stage-container flex flex-col gap-1 py-3">
          {navigationItems.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-current={route.page === item.route.page ? 'page' : undefined}
              onClick={() => navigate(item.route)}
              className={`min-h-11 rounded-md border-l-2 border-transparent px-3 text-left text-sm font-medium transition-colors aria-[current=page]:border-crimson ${focusStyle} ${
                isDarkShell
                  ? 'text-neutral-300 hover:bg-white/5 aria-[current=page]:bg-white/8 aria-[current=page]:text-white'
                  : 'text-slate-700 hover:bg-slate-100 aria-[current=page]:bg-slate-200 aria-[current=page]:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate(registrationRoute)}
            className={`mt-2 inline-flex sm:hidden ${registerStyle} ${focusStyle}`}
          >
            Register Squad
          </button>
        </div>
      </nav>
    </header>
  );
}
