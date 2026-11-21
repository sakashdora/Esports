import { ArrowUp } from 'lucide-react';
import { EVENT_DATE_LABEL, EVENT_ENTRY_ISO } from '../lib/defaultEvents';
import type { AppRoute } from './Navbar';

export function ChampionshipFooter({ onNavigate }: { onNavigate: (next: AppRoute) => void }) {
  return (
    <footer className="college-footer">
      <div className="stage-container">
        <div className="footer-main">
          <div>
            <p className="footer-wordmark">
              <span>Srusti</span>
              <img src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.webp" alt="e-Sports" width="112" height="38" loading="lazy" />
            </p>
            <h2 className="footer-event-title">Campus LAN Championship 2026</h2>
            <time className="footer-event-date" dateTime={EVENT_ENTRY_ISO}>{EVENT_DATE_LABEL}</time>
          </div>

          <dl className="footer-credits">
            <div>
              <dt className="footer-label">Hosted by</dt>
              <dd>
                <div className="footer-credit-logos">
                  <img src="/assets/aistudio/Prospectus_2026_-_27_-_1_bb4cb47c.png" alt="" width="42" height="44" loading="lazy" />
                  <img src="/assets/aistudio/SAGSH_22e6af6f.png" alt="" width="42" height="44" loading="lazy" />
                </div>
                SAMT &amp; SAGS
              </dd>
            </div>
            <div>
              <dt className="footer-label">Media partner</dt>
              <dd>
                <div className="footer-credit-logos">
                  <img src="/assets/aistudio/SRUSTI_PRASAAR_-_BRAND_DESIGN_GUIDE_a91fc8eb.png" alt="" width="48" height="44" loading="lazy" />
                </div>
                Srusti Prasar
              </dd>
            </div>
          </dl>

          <nav aria-labelledby="footer-links-title">
            <h2 id="footer-links-title" className="footer-label">Tournament links</h2>
            <ul className="footer-links">
              <li><a href="#events">Tournaments</a></li>
              <li><a href="#how-it-works">How it works</a></li>
              <li><button type="button" onClick={() => onNavigate({ page: 'live' })}>View live teams</button></li>
              <li><button type="button" onClick={() => onNavigate({ page: 'track' })}>Track status</button></li>
            </ul>
          </nav>
        </div>

        <div className="footer-bottom">
          <p>Srusti Academy of Management &amp; Technology</p>
          <a href="#top">Back to top <ArrowUp aria-hidden="true" /></a>
        </div>
      </div>
    </footer>
  );
}
