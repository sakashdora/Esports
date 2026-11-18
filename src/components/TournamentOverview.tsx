import { ArrowRight, Trophy, ShieldCheck, Radio } from 'lucide-react';
import type { CampusEvent } from '../lib/defaultEvents';
import type { AppRoute } from './Navbar';

export function TournamentOverview({ events, onNavigate }: { events: CampusEvent[]; onNavigate: (route: AppRoute) => void }) {
  return <>
    <section className="stage-container overview-section" aria-labelledby="prizes-title">
      <div className="section-kicker">PLAY FOR THE PODIUM</div>
      <div className="battleground-heading"><span aria-hidden="true" /><h2 id="prizes-title">The championship rewards</h2><span aria-hidden="true" /></div>
      <p className="section-intro">₹{events.reduce((total, event) => total + event.prizePoolTotal, 0).toLocaleString('en-IN')} combined prize pool. A separate podium for each game.</p>
      <div className="overview-grid">{events.map(event => <article className="overview-panel" key={event.id}>
        <div className="overview-panel-heading"><Trophy aria-hidden="true" /><h3>{event.gameTitle}</h3><span>₹{event.prizePoolTotal.toLocaleString('en-IN')}</span></div>
        <ol className="prize-list">{event.prizeBreakdown.map(prize => <li key={prize.position}><div><strong>{prize.position}</strong><small>{prize.award}</small></div><b>₹{prize.cashPrize.toLocaleString('en-IN')}</b></li>)}</ol>
      </article>)}</div>
    </section>
    <section className="stage-container overview-section" aria-labelledby="format-title">
      <div className="section-kicker">KNOW YOUR ROUTE TO THE FINAL</div>
      <div className="battleground-heading"><span aria-hidden="true" /><h2 id="format-title">Tournament format</h2><span aria-hidden="true" /></div>
      <div className="overview-grid">{events.map(event => <article className="overview-panel" key={event.id}>
        <div className="overview-panel-heading"><h3>{event.gameTitle}</h3><span>{event.maxTeams} teams</span></div>
        <ol className="format-list">{event.rulesJson.stages.map(stage => <li key={stage.stageNumber}><b>{stage.stageNumber}</b><div><h4>{stage.name}</h4><p>{stage.formatAndTeams}</p><p>{stage.advancement}</p></div></li>)}</ol>
        <button type="button" className="arena-button secondary" onClick={() => onNavigate({page:'event',slug:event.slug})}>Full rulebook <ArrowRight aria-hidden="true" /></button>
      </article>)}</div>
    </section>
    <section className="stage-container overview-section" aria-labelledby="fair-play-title">
      <div className="overview-grid">
        <article className="overview-panel fair-play-panel"><div className="overview-panel-heading"><ShieldCheck aria-hidden="true" /><h2 id="fair-play-title">Eligibility &amp; fair play</h2></div>
          <p>{events[0]?.rulesJson.eligibilitySummary}</p>
          <ul><li>4 active players and 1 optional substitute; Player 1 is your IGL.</li><li>Mobile devices only. No emulators, scripts, cheats or unauthorized peripherals.</li><li>Use registered Character IDs and in-game names for every match.</li><li>Free Fire: each squad member must equip a different active skill.</li></ul>
        </article>
        <article className="overview-panel live-teams-panel"><Radio aria-hidden="true" /><div className="section-kicker">FOLLOW THE FIELD</div><h2>See who’s joining the arena</h2><p>Explore registered squads, verification status and confirmed group slots on the live team board.</p><button type="button" className="arena-button primary" onClick={() => onNavigate({page:'live'})}>View live teams <ArrowRight aria-hidden="true" /></button><small>Public listings show team and gaming names. Contact details and payment proofs stay off the public board.</small></article>
      </div>
    </section>
    <section className="stage-container overview-section faq-section" aria-labelledby="faq-title">
      <div className="battleground-heading"><span aria-hidden="true" /><h2 id="faq-title">Before you register</h2><span aria-hidden="true" /></div>
      {[
        ['How much does a team pay?', 'The entry fee is ₹299 per team. Lunch is optional and adds ₹100 once per team, for a total of ₹399. Choosing meals for more players does not increase the team lunch charge.'],
        ['Can our team skip lunch?', 'Yes. Leave all meal options unselected to pay only the ₹299 entry fee. If you choose lunch, record each participating player’s vegetarian or non-vegetarian preference.'],
        ['When should we arrive?', 'Campus entry is at 9:30 AM IST on 13 December 2026 at the SAMT Campus LAN Arena. Bring your college or institution ID and your mobile device.'],
        ['When is our slot confirmed?', 'After you submit your roster, payment screenshot and UTR, the team reviews the payment. A registration submission alone does not confirm a slot. Use Track status to check verification and any reupload request.'],
        ['What if our payment proof needs correction?', 'Open Track status using your team registration code and IGL phone number. If a reupload is requested, submit the corrected screenshot and transaction reference there.'],
      ].map(([question,answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
    </section>
  </>;
}
