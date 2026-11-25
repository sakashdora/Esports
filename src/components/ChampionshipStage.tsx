import { ArrowRight, CalendarDays, Clock3, MapPin, Trophy } from 'lucide-react';
import { ACADEMY_MAP_URL, ACADEMY_NAME } from '../lib/academy';
import { EVENT_ENTRY_ISO, type CampusEvent } from '../lib/defaultEvents';
import { getEventBannerUrl } from '../lib/eventArtwork';
import type { AppRoute } from './Navbar';
import { EmberParticles } from './EmberParticles';
import { PointsGuide } from './PointsGuide';

export function ChampionshipStage({ events, loading, onNavigate }: { events: CampusEvent[]; loading: boolean; onNavigate: (route: AppRoute) => void }) {
  const primary = events[0];
  return <div className="championship-stage centered-championship">
    <section className="campus-hero" aria-labelledby="championship-title">
      <img className="campus-arena" src="/assets/brand/srusti-student-arena.webp" width="1536" height="1024" alt="College players competing on mobile phones in a championship arena" fetchPriority="high" />
      <div className="arena-scrim" aria-hidden="true" />
      <EmberParticles density={16} />
      <div className="stage-container hero-content">
        <div className="hero-identity animate-stage-enter">
          <h1 id="championship-title" className="srusti-title" aria-label="Srusti e-Sports">
            <span>SRUSTI</span>
            <span className="esports-wordmark"><img src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.webp" alt="" width="1400" height="500" /></span>
          </h1>
          <p className="championship-subtitle">Campus LAN Championship 2026</p>
          <p className="championship-eligibility">Age criteria 16–22</p>
        </div>
        <div className="hero-bottom animate-stage-delay-1">
          <div className="match-day-strip">
            <span><CalendarDays aria-hidden="true" /><time dateTime={EVENT_ENTRY_ISO}>13th December 2026</time></span>
            <span><Clock3 aria-hidden="true" />ENTRY 9:30 AM IST</span>
            <a className="campus-map-link" href={ACADEMY_MAP_URL} target="_blank" rel="noopener noreferrer">
              <MapPin aria-hidden="true" /><span>{ACADEMY_NAME}</span>
            </a>
          </div>
          <div className="hero-actions">
            <a className="arena-button primary" href="#events">Register your squad <ArrowRight aria-hidden="true" /></a>
            <a className="hero-explore" href="#events">Explore tournaments</a>
          </div>
          <p className="hero-price"><strong>₹{primary?.baseFee ?? 299}</strong> per team</p>
        </div>
      </div>
    </section>
    <section id="events" className="stage-container battlegrounds" aria-labelledby="battleground-title">
      <div className="battleground-heading"><span aria-hidden="true" /><h2 id="battleground-title" tabIndex={-1}>Choose your battleground</h2><span aria-hidden="true" /></div>
      <div className="battleground-grid" aria-busy={loading}>
        {events.map((event, index) => <article key={event.id} className="battleground-card animate-stage-delay-2">
          <img src={getEventBannerUrl(event.slug, event.gameTitle)} alt="" className="battleground-art" loading="lazy" />
          <div className="battleground-overlay" aria-hidden="true" />
          <div className="battleground-copy">
            <span className="game-number">0{index + 1} / CAMPUS LAN</span>
            <h3>{event.gameTitle}</h3>
            <p className="game-title">{event.title.replace(/2k26/gi, '2026').replace(' — Free Fire', '')}</p>
            <p className="game-prize"><Trophy aria-hidden="true" /> ₹{event.prizePoolTotal.toLocaleString('en-IN')} <span>prize pool</span></p>
            <p className="game-entry">₹{event.baseFee} / team · {event.maxTeams} squad slots</p><p className="game-roster">4 players + optional substitute</p>
            <div className="game-actions">
              <button className="arena-button secondary" onClick={() => onNavigate({ page: 'event', slug: event.slug })}>View rulebook</button>
              <button className="arena-button primary" disabled={!event.isOpen || loading} onClick={() => onNavigate({ page: 'register', slug: event.slug })}>{!event.isOpen ? 'Closed' : loading ? 'Loading…' : 'Register squad'}<ArrowRight aria-hidden="true" /></button>
            </div>
          </div>
        </article>)}
      </div>
      <PointsGuide events={events} onViewTeams={() => onNavigate({ page: 'live' })} />
      <a className="arena-button secondary mt-4" href="/tournament-guide">Explore tournament guide <ArrowRight aria-hidden="true" /></a>
    </section>
  </div>;
}
