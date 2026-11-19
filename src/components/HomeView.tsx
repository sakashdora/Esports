import { Check, ClipboardCheck, CreditCard, Monitor, ShieldCheck, Users, Utensils } from 'lucide-react';
import { TournamentOverview } from './TournamentOverview';
import type { CampusEvent } from '../lib/defaultEvents';
import { ChampionshipStage } from './ChampionshipStage';
import type { AppRoute } from './Navbar';

interface HomeViewProps {
  events: CampusEvent[];
  loading: boolean;
  onNavigate: (next: AppRoute) => void;
}

const steps = [
  { icon: Users, title: 'Build your squad', detail: 'Form a team of 4 players, with an optional substitute.' },
  { icon: Utensils, title: 'Choose optional lunch', detail: 'Add lunch for ₹100 per team, only if your squad wants it.' },
  { icon: CreditCard, title: 'Pay & submit proof', detail: 'Pay your team fee and upload the UPI payment proof.' },
  { icon: ShieldCheck, title: 'Get verified', detail: 'Administrators verify your payment and confirm your registration.' },
];

export function HomeView({ events, loading, onNavigate }: HomeViewProps) {
  return <main className="championship-home approved-home">
    <ChampionshipStage events={events} loading={loading} onNavigate={onNavigate} />
    <section id="how-it-works" className="stage-container road-section" aria-labelledby="road-title">
      <div className="battleground-heading"><span aria-hidden="true" /><h2 id="road-title">Your road to the arena</h2><span aria-hidden="true" /></div>
      <ol className="road-steps">
        {steps.map(({ icon: Icon, title, detail }, index) => <li key={title}>
          <Icon aria-hidden="true" />
          <h3><span>0{index + 1}</span> {title}</h3>
          <p>{detail}</p>
        </li>)}
      </ol>
    </section>
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
    <footer className="college-footer">
      <div className="stage-container">
        <div className="footer-college"><img src="/assets/aistudio/Prospectus_2026_-_27_-_1_bb4cb47c.png" alt="Srusti college crest" width="46" height="48" /><span>Srusti Academy of Management &amp; Technology</span></div>
        <p>Campus LAN Championship 2026</p>
        <button type="button" onClick={() => onNavigate({ page: 'live' })}>View live teams</button>
      </div>
    </footer>
  </main>;
}
