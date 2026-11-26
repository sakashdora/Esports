import { ChevronDown, Crosshair, Trophy } from 'lucide-react';
import type { CampusEvent } from '../lib/defaultEvents';
import { getEventBannerUrl } from '../lib/eventArtwork';
import './PointsGuide.css';

const scoreBanners: Record<string, string> = {
  'kalinga-warriors-bgmi': '/assets/brand/kalinga-scoreboard.jpg',
  'kurukshetra-free-fire': '/assets/brand/kurukshetra-scoreboard.jpg',
};

export function PointsGuide({ events }: { events: CampusEvent[] }) {
  return (
    <details className="arena-scoring">
      <summary className="scoring-toggle">
        <span className="scoring-emblem"><Trophy aria-hidden="true" /></span>
        <strong>View points system</strong>
        <ChevronDown aria-hidden="true" className="scoring-chevron" />
      </summary>
      <div className="scoring-body">
        <p className="scoring-intro">
          In each Battle Royale match, your squad earns points for its finishing position and eliminations.
          Add your match scores to get your total for the stage.
        </p>
        <div className="scoring-grid">
          {events.map((event) => (
            <EventScorecard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </details>
  );
}

export function EventScorecard({ event }: { event: CampusEvent }) {
  const { slug, title, gameTitle, rulesJson } = event;
  return (
    <article className="scoring-panel">
      <img className="scoring-art" src={scoreBanners[slug] ?? getEventBannerUrl(slug, gameTitle)} alt={title} loading="lazy" />
      <div className="scoring-heading">
        <h3>{gameTitle}</h3>
        <span><Crosshair aria-hidden="true" />
          +{rulesJson.killPoints} {rulesJson.killPoints === 1 ? 'point' : 'points'} per elimination
        </span>
      </div>
      <table className="scoring-table" aria-label={`${gameTitle} placement points`}>
        <thead>
          <tr>
            <th scope="col" className="px-3 py-2">Squad placement</th>
            <th scope="col" className="px-3 py-2 text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {rulesJson.placementPoints.map(({ rank, points }) => (
            <tr key={rank}>
              <th scope="row" className="px-3 py-2 font-normal">{rank}</th>
              <td className="px-3 py-2 text-right font-semibold">{points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
