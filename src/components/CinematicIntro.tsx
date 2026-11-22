import { ArrowUpRight, Play } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EVENT_ENTRY_ISO } from '../lib/defaultEvents';
import { BGMI_BANNER_IMAGE, FREEFIRE_BANNER_IMAGE } from '../lib/eventArtwork';
import './cinematicIntro.css';

const INTRO_KEY = 'srusti_intro_seen_v6';
const REVEAL_DURATION = 760;

export function shouldShowIntro(): boolean {
  if (window.location.pathname !== '/' || window.location.hash || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try { return sessionStorage.getItem(INTRO_KEY) !== 'yes'; } catch { return true; }
}

export function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const [opening, setOpening] = useState(false);
  const finish = useCallback(() => {
    try { sessionStorage.setItem(INTRO_KEY, 'yes'); } catch { /* Storage is optional. */ }
    onComplete();
  }, [onComplete]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    enterRef.current?.focus({ preventScroll: true });
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => { if (motion.matches) finish(); };
    motion.addEventListener('change', onMotion);
    return () => motion.removeEventListener('change', onMotion);
  }, [finish]);

  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(finish, REVEAL_DURATION);
    return () => window.clearTimeout(timer);
  }, [finish, opening]);

  function enterArena() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
    } else {
      setOpening(true);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="cinematic-intro"
      data-opening={opening}
      aria-labelledby="intro-title"
      onCancel={(event) => { event.preventDefault(); finish(); }}
    >
      <div className="intro-worlds" aria-hidden="true">
        <div className="intro-world intro-world-bgmi">
          <img src={BGMI_BANNER_IMAGE} alt="" fetchPriority="high" />
        </div>
        <div className="intro-world intro-world-freefire">
          <img src={FREEFIRE_BANNER_IMAGE} alt="" fetchPriority="high" />
        </div>
      </div>
      <div className="intro-stage">
        <header className="intro-header">
          <img src="/assets/aistudio/Prospectus_2026_-_27_-_1_bb4cb47c.png" alt="Srusti Academy crest" width="40" height="43" />
          <button type="button" className="intro-skip" onClick={finish}>Skip intro <ArrowUpRight aria-hidden="true" /></button>
        </header>
        <div className="intro-masthead">
          <h1 id="intro-title" className="intro-title" aria-label="Srusti e-Sports">
            <span className="intro-srusti">SRUSTI</span>
            <span className="intro-esports">
              <img src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.webp" alt="" width="1400" height="475" />
            </span>
          </h1>
          <p className="intro-event-name">Campus LAN Championship 2026</p>
          <button ref={enterRef} type="button" className="intro-enter" onClick={enterArena} disabled={opening}>
            <Play aria-hidden="true" />
            <span>{opening ? 'Opening…' : 'Enter the arena'}</span>
          </button>
        </div>
        <footer className="intro-event">
          <div className="intro-game intro-game-bgmi">
            <strong>BGMI</strong>
            <span>Kalinga Warriors</span>
          </div>
          <time dateTime={EVENT_ENTRY_ISO}>13th December 2026</time>
          <div className="intro-game intro-game-freefire">
            <strong>Free Fire</strong>
            <span>Kurukshetra</span>
          </div>
        </footer>
      </div>
    </dialog>
  );
}

export function PageLoading() {
  return <div className="page-loading" role="status" aria-label="Loading your page"><span className="page-loading-orbit" aria-hidden="true" /><span>Loading…</span></div>;
}
