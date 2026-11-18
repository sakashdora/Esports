import { ArrowRight, CalendarDays, Clock3, MapPin, Trophy, Pause, Play } from 'lucide-react';
import { useState } from 'react';
import { EVENT_ENTRY_ISO, type CampusEvent } from '../lib/defaultEvents';
import { getEventBannerUrl } from '../lib/eventArtwork';
import type { AppRoute } from './Navbar';
import { EmberParticles } from './EmberParticles';
import { HeroCountdown } from './HeroCountdown';

export function ChampionshipStage({ events, loading, onNavigate }: { events: CampusEvent[]; loading: boolean; onNavigate: (route: AppRoute) => void }) {
  const [motionPaused, setMotionPaused] = useState(false);
  const primary = events[0];
  return <div className={`championship-stage centered-championship ${motionPaused ? 'motion-paused' : ''}`}>
    <section className="campus-hero" aria-labelledby="championship-title">
      <img className="campus-arena" src="/assets/brand/srusti-student-arena.png" alt="College players competing on mobile phones in a championship arena" fetchPriority="high" />
      <div className="arena-scrim" aria-hidden="true" />
      <div className="energy-ribbon ribbon-blue" aria-hidden="true" />
      <div className="energy-ribbon ribbon-red" aria-hidden="true" />
      {!motionPaused && <EmberParticles density={32} />}
      <div className="stage-container hero-content">
        <div className="hero-identity animate-stage-enter">
          <div className="hero-organizer"><img className="hero-college-crest" src="/assets/aistudio/Prospectus_2026_-_27_-_1_bb4cb47c.png" alt="Srusti Academy of Management and Technology crest" width="100" height="104" /><p className="stage-eyebrow">Srusti Academy of Management &amp; Technology</p></div>
          <h1 id="championship-title" className="srusti-title" aria-label="Srusti e-Sports">
            <span>SRUSTI</span>
            <span className="esports-wordmark"><img src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.png" alt="" width="1400" height="500" /><i aria-hidden="true" /></span>
          </h1>
          <p className="championship-subtitle">Campus LAN Championship 2026</p>

          <HeroCountdown deadlineText={EVENT_ENTRY_ISO} />
        </div>
        <div className="hero-bottom animate-stage-delay-1">
          <div className="match-day-strip">
            <span><CalendarDays aria-hidden="true" /><time dateTime={EVENT_ENTRY_ISO}>13 DECEMBER 2026</time></span>
            <span><Clock3 aria-hidden="true" />ENTRY 9:30 AM IST</span>
            <span><MapPin aria-hidden="true" />SAMT CAMPUS LAN ARENA</span>
          </div>
          <div className="hero-actions">
            <a className="arena-button primary" href="#events">Register your squad <ArrowRight aria-hidden="true" /></a>
            <a className="arena-button secondary" href="#events">Explore tournaments</a>
            <div className="hero-price"><strong>₹{primary?.baseFee ?? 299}<small> / team</small></strong><span>Optional lunch +₹{primary?.lunchFee ?? 100} / team</span></div>
          </div>
        </div>
      </div>
      <button className="motion-control" type="button" aria-pressed={motionPaused} onClick={() => setMotionPaused(value => !value)}>{motionPaused ? <Play /> : <Pause />} {motionPaused ? 'Resume effects' : 'Pause effects'}</button>
    </section>
    <section id="events" className="stage-container battlegrounds" aria-labelledby="battleground-title">
      <div className="battleground-heading"><span aria-hidden="true" /><h2 id="battleground-title">Choose your battleground</h2><span aria-hidden="true" /></div>
      <div className="battleground-grid" aria-busy={loading}>
        {events.map((event, index) => <article key={event.id} className="battleground-card animate-stage-delay-2">
          <img src={getEventBannerUrl(event.slug, event.gameTitle)} alt="" className="battleground-art" loading="lazy" />
          <div className="battleground-overlay" aria-hidden="true" />
          <div className="battleground-copy">
            <span className="game-number">0{index + 1} / CAMPUS LAN</span>
            <h3>{event.gameTitle}</h3>
            <p className="game-title">{event.title.replace(' (2K26)', '').replace(' — Free Fire', '')}</p>
            <p className="game-prize"><Trophy aria-hidden="true" /> ₹{event.prizePoolTotal.toLocaleString('en-IN')} <span>prize pool</span></p>
            <p className="game-entry">₹{event.baseFee} / team · {event.maxTeams} squad slots</p><p className="game-roster">4 players + optional substitute</p>
            <div className="game-actions">
              <button className="arena-button secondary" onClick={() => onNavigate({ page: 'event', slug: event.slug })}>View rules</button>
              <button className="arena-button primary" disabled={!event.isOpen || loading} onClick={() => onNavigate({ page: 'register', slug: event.slug })}>{!event.isOpen ? 'Closed' : loading ? 'Loading…' : 'Register squad'}<ArrowRight aria-hidden="true" /></button>
            </div>
          </div>
        </article>)}
      </div>
    </section>
  </div>;
}
