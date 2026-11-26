import { ArrowRight, CalendarDays, Clock3, MapPin } from 'lucide-react';
import { ACADEMY_MAP_URL } from '../lib/academy';
import { EVENT_ENTRY_ISO, type CampusEvent } from '../lib/defaultEvents';
import { getEventBannerUrl } from '../lib/eventArtwork';
import type { AppRoute } from './Navbar';
import { PointsGuide } from './PointsGuide';
import { TournamentContactCarousel } from './TournamentContactCarousel';

export function ChampionshipStage({ events, loading, onNavigate }: { events: CampusEvent[]; loading: boolean; onNavigate: (route: AppRoute) => void }) {
  const primary = events[0];
  return <div className="championship-stage">
    <section className="campus-hero" aria-labelledby="championship-title">
      <img className="campus-arena" src="/assets/brand/srusti-student-arena.webp" width="1536" height="1024" alt="College players competing on mobile phones in a championship arena" fetchPriority="high" />
      <div className="arena-scrim" aria-hidden="true" />
      <div className="stage-container hero-content">
        <div className="hero-identity">
          <h1 id="championship-title" className="srusti-title" aria-label="Srusti e-Sports">
            <span>SRUSTI</span>
            <span className="esports-wordmark"><img src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.webp" alt="" width="1400" height="500" /></span>
          </h1>
          <p className="championship-subtitle">Campus LAN Championship 2026</p>
          <p className="championship-eligibility">
            <span>Age criteria 16–22</span><span><strong>₹{primary?.baseFee ?? 299}</strong> per team</span>
          </p>
        </div>
        <div className="hero-bottom">
          <div className="match-day-strip">
            <span><CalendarDays aria-hidden="true" /><time dateTime={EVENT_ENTRY_ISO}>13 December 2026</time></span>
            <span><Clock3 aria-hidden="true" />Entry 9:30 AM IST</span>
            <a className="campus-map-link" href={ACADEMY_MAP_URL} target="_blank" rel="noopener noreferrer">
              <MapPin aria-hidden="true" /><span>Srusti Campus</span>
            </a>
          </div>
          <TournamentContactCarousel />
          <div className="hero-actions">
            <a className="arena-button primary" href="#events">Register your squad <ArrowRight aria-hidden="true" /></a>
            <button type="button" className="arena-button secondary" onClick={() => onNavigate({ page: 'track' })}>Track status</button>
          </div>
        </div>
      </div>
    </section>
    <section id="events" className="stage-container battlegrounds" aria-labelledby="battleground-title">
      <h2 className="home-section-heading" id="battleground-title" tabIndex={-1}>Choose your battleground</h2>
      <div className="battleground-grid" aria-busy={loading}>
        {events.map((event) => <article key={event.id} className="battleground-card">
          <div className="battleground-visual">
            <img src={getEventBannerUrl(event.slug, event.gameTitle)} alt="" className="battleground-art" loading="lazy" />
            <div className="battleground-caption">
              <h3>{event.gameTitle}</h3>
              <p>{event.title.replace(/2k26/gi, '2026').replace(' — Free Fire', '')}</p>
            </div>
          </div>
          <div className="battleground-copy">
            <p className="game-prize"><strong>₹{event.prizePoolTotal.toLocaleString('en-IN')}</strong> prize pool</p>
            <p className="game-entry">₹{event.baseFee} per team · {event.maxTeams} squad slots</p>
            <p className="game-roster">4 players + optional substitute</p>
            <div className="game-actions">
              <button className="arena-button secondary" onClick={() => onNavigate({ page: 'event', slug: event.slug })}>View rulebook</button>
              <button className="arena-button primary" disabled={!event.isOpen || loading} onClick={() => onNavigate({ page: 'register', slug: event.slug })}>{!event.isOpen ? 'Closed' : loading ? 'Loading…' : 'Register squad'}<ArrowRight aria-hidden="true" /></button>
            </div>
          </div>
        </article>)}
      </div>
      <PointsGuide events={events} />
      <a className="tournament-guide-link" href="/tournament-guide">Explore tournament guide <ArrowRight aria-hidden="true" /></a>
    </section>
  </div>;
}
