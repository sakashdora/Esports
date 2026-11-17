import { useEffect, useState } from 'react';
import { AdminDashboardView } from './components/AdminDashboardView';
import { EventDetailView } from './components/EventDetailView';
import { HomeView } from './components/HomeView';
import { LiveDashboardView } from './components/LiveDashboardView';
import { Navbar, type AppRoute } from './components/Navbar';
import { RegisterView } from './components/RegisterView';
import { TrackStatusView } from './components/TrackStatusView';
import { DEFAULT_EVENTS, type CampusEvent } from './lib/defaultEvents';

function parseLocationRoute(): AppRoute {
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);

  if (path === '/live') {
    return { page: 'live' };
  }
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
  return { page: 'home' };
}

function routeToPath(route: AppRoute): string {
  switch (route.page) {
    case 'live':
      return '/live';
    case 'event':
      return `/events/${route.slug}`;
    case 'register':
      return `/register/${route.slug}`;
    case 'track':
      return route.prefillCode ? `/track?code=${encodeURIComponent(route.prefillCode)}` : '/track';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseLocationRoute());
  const [events, setEvents] = useState<CampusEvent[]>(DEFAULT_EVENTS);
  const [loadingEvents, setLoadingEvents] = useState(true);

  async function refreshEvents() {
    try {
      const res = await fetch('/api/events');
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
  }

  useEffect(() => {
    refreshEvents();
    const onPopState = () => setRoute(parseLocationRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigate(next: AppRoute) {
    const nextPath = routeToPath(next);
    if (window.location.pathname + window.location.search !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  const defaultSlug = events[0]?.slug || 'kalinga-warriors-bgmi';
  const activeEvent =
    route.page === 'event'
      ? events.find((e) => e.slug === route.slug) || events[0]
      : events[0];

  return (
    <div className="min-h-screen">
      <Navbar route={route} onNavigate={navigate} defaultEventSlug={defaultSlug} />

      {route.page === 'home' && (
        <HomeView events={events} loading={loadingEvents} onNavigate={navigate} />
      )}

      {route.page === 'live' && (
        <LiveDashboardView initialEvents={events} onNavigate={navigate} />
      )}

      {route.page === 'event' && activeEvent && (
        <EventDetailView event={activeEvent} allEvents={events} onNavigate={navigate} />
      )}

      {route.page === 'register' && (
        <RegisterView
          events={events}
          initialSlug={route.slug}
          onNavigate={navigate}
          onRefreshEvents={refreshEvents}
        />
      )}

      {route.page === 'track' && <TrackStatusView prefillCode={route.prefillCode} />}

      {route.page === 'admin' && <AdminDashboardView onEventsUpdated={refreshEvents} />}
    </div>
  );
}
