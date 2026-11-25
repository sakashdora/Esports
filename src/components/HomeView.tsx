import { Check, ClipboardCheck, Monitor } from 'lucide-react';
import { TournamentOverview } from './TournamentOverview';
import type { CampusEvent } from '../lib/defaultEvents';
import { ChampionshipFooter } from './ChampionshipFooter';
import { ChampionshipStage } from './ChampionshipStage';
import type { AppRoute } from './Navbar';

interface HomeViewProps {
  events: CampusEvent[];
  loading: boolean;
  onNavigate: (next: AppRoute) => void;
}

export function HomeView({ events, loading, onNavigate }: HomeViewProps) {
  return <>
    <main className="championship-home approved-home">
      <ChampionshipStage events={events} loading={loading} onNavigate={onNavigate} />
      <TournamentOverview events={events} onNavigate={onNavigate} />
      <section className="stage-container match-day-help" aria-label="Prepare for match day">
        <article className="match-help-panel checklist-panel">
          <ClipboardCheck className="help-icon" aria-hidden="true" />
          <div><h2>Match day checklist</h2><ul>
            {['College ID required', 'Mobile devices only', 'Arrive at 9:30 AM'].map(item => <li key={item}><Check aria-hidden="true" />{item}</li>)}
          </ul></div>
        </article>
        <article className="match-help-panel tracking-panel">
          <Monitor className="help-icon" aria-hidden="true" />
          <div><h2>Already registered?</h2><p>Track your team status and payment verification.</p>
            <button type="button" className="arena-button secondary" onClick={() => onNavigate({ page: 'track' })}>Track status</button>
          </div>
        </article>
      </section>
    </main>
    <ChampionshipFooter onNavigate={onNavigate} />
  </>;
}
