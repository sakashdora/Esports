import { lazy, startTransition, Suspense, useCallback, useEffect, useState } from 'react';
import { CinematicIntro, PageLoading, shouldShowIntro } from './components/CinematicIntro';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeView } from './components/HomeView';
import { Navbar, type AppRoute } from './components/Navbar';
import { DEFAULT_EVENTS, type CampusEvent } from './lib/defaultEvents';
import { dismissAnnouncement, shouldShowAnnouncement, WelcomeAnnouncement } from './components/WelcomeAnnouncement';

const AdminDashboardView = lazy(() => import('./components/AdminDashboardView').then(module => ({ default: module.AdminDashboardView })));
const VolunteerDashboardView = lazy(() => import('./components/VolunteerDashboardView'));
const TournamentGuide = lazy(() => import('./components/TournamentGuide'));
const EventDetailView = lazy(() => import('./components/EventDetailView').then(module => ({ default: module.EventDetailView })));
const RegisterView = lazy(() => import('./components/RegisterView').then(module => ({ default: module.RegisterView })));
const TrackStatusView = lazy(() => import('./components/TrackStatusView').then(module => ({ default: module.TrackStatusView })));

function parseLocationRoute(): AppRoute {
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);
  if (path === '/tournament-guide' || path === '/tournament-guide/') return { page: 'guide' };

  if (path.startsWith('/events/')) {
    return { page: 'event', slug: path.replace('/events/', '').split('/')[0] };
  }
  if (path.startsWith('/register/')) {
    return { page: 'register', slug: path.replace('/register/', '').split('/')[0] };
  }
  if (path === '/track') {
    return { page: 'track', prefillCode: search.get('code') || undefined };
  }
  if (path === '/admin') {
    return { page: 'admin' };
  }
  if (path === '/volunteer' || path === '/volunteer/') return { page: 'volunteer' };
  return { page: 'home' };
}

function routeToPath(route: AppRoute): string {
  switch (route.page) {
    case 'guide':
      return '/tournament-guide';
    case 'event':
      return `/events/${route.slug}`;
    case 'register':
      return `/register/${route.slug}`;
    case 'track':
      return route.prefillCode ? `/track?code=${encodeURIComponent(route.prefillCode)}` : '/track';
    case 'admin':
      return '/admin';
    case 'volunteer':
      return '/volunteer';
    default:
      return '/';
  }
}

export default function App() {
  const [showIntro, setShowIntro] = useState(shouldShowIntro);
  const [showAnnouncement, setShowAnnouncement] = useState(shouldShowAnnouncement);
  const completeIntro = useCallback(() => {
    dismissAnnouncement();
    setShowAnnouncement(false);
    setShowIntro(false);
  }, []);
  const [route, setRoute] = useState<AppRoute>(() => parseLocationRoute());
  const [events, setEvents] = useState<CampusEvent[]>(DEFAULT_EVENTS);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const refreshEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events', { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.events) && json.events.length > 0) {
          setEvents(json.events);
        }
      }
    } catch {
      // Keep authoritative defaults if offline
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    refreshEvents();
    const onPopState = () => startTransition(() => setRoute(parseLocationRoute()));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Each page gets its own browser-tab title (it was the same on every page), and the admin
  // page asks search engines not to list it.
  useEffect(() => {
    const suffix = 'Srusti Campus Esports 2026 | SAMT';
    const event = 'slug' in route ? events.find((e) => e.slug === route.slug) : undefined;
    const name = event ? event.title.replace(/2k26/gi, '2026') : '';
    const titles: Record<AppRoute['page'], string> = {
      home: 'Srusti Campus Event & Esports Championship 2026 | SAMT',
      guide: `Tournament Guide | ${suffix}`,
      event: `${name ? name + ' Rulebook' : 'Tournament Rulebook'} | ${suffix}`,
      register: `Register Your Squad${name ? ' for ' + name : ''} | ${suffix}`,
      track: `Track Your Registration | ${suffix}`,
      admin: `Admin Desk | ${suffix}`,
      volunteer: `Event Check-in | ${suffix}`,
    };
    document.title = titles[route.page];
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (route.page === 'admin' || route.page === 'volunteer') {
      if (!robots) {
        robots = document.createElement('meta');
        robots.name = 'robots';
        document.head.appendChild(robots);
      }
      robots.content = 'noindex, nofollow';
    } else if (robots) {
      robots.remove();
    }
  }, [route, events]);

  // Once the first screen is up, quietly fetch the other pages so opening one is instant
  // instead of waiting on a download. The admin page is left out on purpose.
  useEffect(() => {
    if (showIntro) return;
    const warm = () => {
      void import('./components/RegisterView');
      void import('./components/TrackStatusView');
      void import('./components/EventDetailView');
    };
    const timer = window.setTimeout(warm, 1200);
    return () => window.clearTimeout(timer);
  }, [showIntro]);

  const navigate = useCallback((next: AppRoute) => {
    const nextPath = routeToPath(next);
    if (window.location.pathname + window.location.search !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    // A transition keeps the current page on screen until the next one is ready, so moving
    // between pages never flashes a loading screen.
    startTransition(() => setRoute(next));
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const defaultSlug = events[0]?.slug || 'kalinga-warriors-bgmi';
  function closeAnnouncement() {
    dismissAnnouncement();
    setShowAnnouncement(false);
  }

  function registerFromAnnouncement() {
    closeAnnouncement();
    // The home page is already mounted. Scroll after the modal restores body scrolling.
    window.requestAnimationFrame(() => {
      document.getElementById('events')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
      document.getElementById('battleground-title')?.focus({ preventScroll: true });
    });
  }
  const activeEvent =
    route.page === 'event'
      ? events.find((e) => e.slug === route.slug) || events[0]
      : events[0];
  const registrationEvent = route.page === 'register' ? events.find((event) => event.slug === route.slug) : undefined;

  // Keep the homepage and navigation out of the DOM until the intro finishes.
  // Event data still loads above, while the intro owns the first screen.
  if (showIntro) return <CinematicIntro onComplete={completeIntro} />;

  return (
    <div className="min-h-screen">
      {route.page !== 'volunteer' && <Navbar route={route} onNavigate={navigate} defaultEventSlug={defaultSlug} />}

      {/* Keyed by page so moving to another page clears a previous error. */}
      <ErrorBoundary key={route.page}>
      <Suspense fallback={<PageLoading />}>
      {route.page === 'guide' && <TournamentGuide events={events} />}
      {route.page === 'home' && (
        <HomeView events={events} loading={loadingEvents} onNavigate={navigate} />
      )}

      {route.page === 'event' && activeEvent && (
        <EventDetailView event={activeEvent} allEvents={events} onNavigate={navigate} />
      )}

      {route.page === 'register' && (registrationEvent ? (
        <RegisterView
          events={events}
          event={registrationEvent}
          onNavigate={navigate}
          onRefreshEvents={refreshEvents}
        />
      ) : loadingEvents ? <PageLoading /> : (
        <main className="mx-auto max-w-3xl px-4 py-12 text-white">
          <h1 className="text-2xl font-bold">Tournament unavailable</h1>
          <p className="mt-2 text-neutral-300">Choose a tournament from the homepage to register.</p>
          <button type="button" className="arena-button primary mt-5" onClick={() => navigate({ page: 'home' })}>View tournaments</button>
        </main>
      ))}

      {route.page === 'track' && <TrackStatusView prefillCode={route.prefillCode} onNavigate={navigate} />}

      {route.page === 'admin' && <AdminDashboardView onEventsUpdated={refreshEvents} onNavigate={navigate} />}
      {route.page === 'volunteer' && <VolunteerDashboardView onNavigate={navigate} />}
      </Suspense>
      </ErrorBoundary>
      {route.page === 'home' && showAnnouncement && (
        <WelcomeAnnouncement onDismiss={closeAnnouncement} onRegister={registerFromAnnouncement} />
      )}
    </div>
  );
}
