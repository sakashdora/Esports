import { ArrowUp, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import { EVENT_DATE_LABEL, EVENT_ENTRY_ISO } from '../lib/defaultEvents';
import type { AppRoute } from './Navbar';

const socialLinks = [
  { name: 'Facebook', Icon: Facebook, href: 'https://www.facebook.com/srustiacademyofmanagementandtechnology' },
  { name: 'Instagram', Icon: Instagram, href: 'https://www.instagram.com/srustiacademy/' },
  { name: 'YouTube', Icon: Youtube, href: 'https://www.youtube.com/@srustiacademyofmanagement' },
  { name: 'LinkedIn', Icon: Linkedin, href: 'https://www.linkedin.com/company/srusti-academy-of-management-and-technology/' },
];

export function ChampionshipFooter({ onNavigate }: { onNavigate: (next: AppRoute) => void }) {
  return (
    <footer className="college-footer">
      <div className="stage-container">
        <div className="footer-main">
          <div className="footer-brand">
            <div className="footer-academy">
              <img src="/assets/aistudio/Prospectus_2026_-_27_-_1_bb4cb47c.png" alt="" width="64" height="68" loading="lazy" />
              <h2>
                Srusti Academy of Management and Technology{' '}
                <span>(Autonomous)</span>
              </h2>
            </div>
            <nav aria-labelledby="footer-social-title">
              <h3 id="footer-social-title" className="footer-label">Follow us</h3>
              <ul className="footer-social-links">
                {socialLinks.map(({ name, Icon, href }) => (
                  <li key={name}>
                    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={name} title={name}>
                      <Icon aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <nav aria-labelledby="footer-links-title">
            <h2 id="footer-links-title" className="footer-label">Tournament links</h2>
            <ul className="footer-links">
              <li><a href="#events">Tournaments</a></li>
              <li><a href="#how-it-works">How it works</a></li>
              <li><button type="button" onClick={() => onNavigate({ page: 'live' })}>View registration counts</button></li>
              <li><button type="button" onClick={() => onNavigate({ page: 'track' })}>Track status</button></li>
            </ul>
          </nav>

          <section aria-labelledby="footer-contact-title">
            <h2 id="footer-contact-title" className="footer-label">Campus contact</h2>
            <address>
              <ul className="footer-contact">
                <li>
                  <MapPin aria-hidden="true" />
                  <span>38/1, Chandaka Industrial Estate, Near Infocity, Bhubaneswar, Odisha 751024, India</span>
                </li>
                <li>
                  <Phone aria-hidden="true" />
                  <div className="footer-phones">
                    <a href="tel:+919439015757">9439015757</a>
                    <a href="tel:+917749813707">7749813707</a>
                  </div>
                </li>
                <li>
                  <Mail aria-hidden="true" />
                  <a href="mailto:mail@srustiacademy.ac.in">mail@srustiacademy.ac.in</a>
                </li>
              </ul>
            </address>
          </section>
        </div>

        <div className="footer-event">
          <div className="footer-event-identity">
            <img src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.webp" alt="Srusti Esports" width="112" height="38" loading="lazy" />
            <div>
              <h2 className="footer-event-title">Campus LAN Championship 2026</h2>
              <time className="footer-event-date" dateTime={EVENT_ENTRY_ISO}>{EVENT_DATE_LABEL}</time>
            </div>
          </div>
          <div className="footer-credits">
            <div>
              <img src="/assets/aistudio/SAGSH_22e6af6f.png" alt="" width="40" height="40" loading="lazy" />
              <dl>
                <dt>Hosted by</dt>
                <dd>SAMT &amp; SAGS</dd>
              </dl>
            </div>
            <div>
              <img src="/assets/aistudio/SRUSTI_PRASAAR_-_BRAND_DESIGN_GUIDE_a91fc8eb.png" alt="" width="44" height="40" loading="lazy" />
              <dl>
                <dt>Media partner</dt>
                <dd>Srusti Prasaar</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-signoff">
        <div className="stage-container footer-bottom">
          <p>© 2026 Srusti Academy</p>
          <a href="#top">Back to top <ArrowUp aria-hidden="true" /></a>
        </div>
      </div>
    </footer>
  );
}
