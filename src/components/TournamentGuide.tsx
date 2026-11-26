import { ArrowDown, Trophy } from 'lucide-react';
import type { CampusEvent } from '../lib/defaultEvents';
import { EventScorecard } from './PointsGuide';
import { RulebookPoster, rulebookPosters } from './RulebookPoster';
import './TournamentGuide.css';

export default function TournamentGuide({ events }: { events: CampusEvent[] }) {
  return (
    <main className="tournament-guide">
      <header className="guide-cover">
        <div className="stage-container">
          <h1>Tournament guide</h1>
          <nav aria-label="Jump to a tournament">
            {events.map(event => <a key={event.id} href={`#${event.slug}`}>{event.gameTitle} <ArrowDown aria-hidden="true" /></a>)}
          </nav>
        </div>
      </header>
      <div className="stage-container">
        {events.map((event, index) => {
          const poster = rulebookPosters[event.slug];
          return (
            <section className="guide-chapter" key={event.id} id={event.slug} aria-labelledby={`title-${event.slug}`}>
              <h2 className={poster ? 'sr-only' : 'guide-game-title'} id={`title-${event.slug}`}>{event.title}</h2>
              <RulebookPoster event={event} loading={index === 0 ? 'eager' : 'lazy'} />
              <details className="guide-transcript" open={poster ? undefined : true}>
                <summary>Read {event.gameTitle} rules and scoring as text</summary>
                <p className="guide-maps">Maps · {event.rulesJson.mapPool.join(' / ')}</p>
                <div className="guide-columns">
                  <section>
                    <h3>Tournament flow</h3>
                    <ol className="guide-stages">
                      {event.rulesJson.stages.map(stage => (
                        <li key={stage.stageNumber}>
                          <span className="guide-stage-number" aria-hidden="true">{stage.stageNumber}</span>
                          <div>
                            <h4>{stage.name}</h4>
                            <strong>{stage.formatAndTeams}</strong>
                            <p>{stage.advancement}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <details className="guide-details">
                      <summary>Match fixtures</summary>
                      <ul>{event.rulesJson.fixtures.map(fixture => (
                        <li key={fixture.stage + fixture.matchId}>
                          <strong>{fixture.stage} · {fixture.matchId}</strong>
                          <p>{fixture.participants}</p><p>{fixture.scoring}</p>
                        </li>
                      ))}</ul>
                    </details>
                    <details className="guide-details">
                      <summary>Gameplay rules &amp; tiebreakers</summary>
                      <ul>{event.rulesJson.specialRules.map(rule => <li key={rule}>{rule}</li>)}</ul>
                      <h4>Tiebreak order</h4>
                      <ol>{event.rulesJson.tieBreaker.map(rule => <li key={rule}>{rule}</li>)}</ol>
                    </details>
                  </section>
                  <section>
                    <h3>Battle Royale scoring</h3>
                    <p className="guide-formula">Match score = placement points + elimination points.</p>
                    <EventScorecard event={event} />
                  </section>
                </div>
                <section className="guide-podium">
                  <h3><Trophy aria-hidden="true" /> ₹{event.prizePoolTotal.toLocaleString('en-IN')} prize pool</h3>
                  <ul>{event.prizeBreakdown.map(prize => (
                    <li key={prize.position}>
                      <span>{prize.position}</span>
                      <strong>₹{prize.cashPrize.toLocaleString('en-IN')}</strong>
                      <small>{prize.award}</small>
                    </li>
                  ))}</ul>
                </section>
              </details>
            </section>
          );
        })}
      </div>
    </main>
  );
}
