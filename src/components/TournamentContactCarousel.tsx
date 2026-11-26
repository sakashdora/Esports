import { Phone } from 'lucide-react';
import { TOURNAMENT_CONTACTS } from '../lib/academy';

export function TournamentContactCarousel() {
  return (
    <section className="contact-carousel" aria-label="For game queries">
      <div className="contact-carousel-viewport">
        <div className="contact-carousel-track">
          {[false, true].map((repeated) => (
            <ul key={String(repeated)} className="contact-carousel-group" role="list" aria-hidden={repeated || undefined}>
              <li className="contact-carousel-label">If you have any query</li>
              {TOURNAMENT_CONTACTS.map(({ game, phone, href }) => (
                <li key={game}>
                  <a
                    className="contact-call"
                    href={href}
                    aria-label={`Call for ${game} queries at ${phone}`}
                    tabIndex={repeated ? -1 : undefined}
                    onFocus={({ currentTarget }) => {
                      if (currentTarget.matches(':focus-visible')) {
                        currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
                      }
                    }}
                  >
                    <Phone aria-hidden="true" />
                    <strong>{game}</strong>
                    <span className="contact-number">{phone}</span>
                  </a>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
