import { useEffect, useRef } from 'react';
import { BGMI_POSTER_IMAGE, FREEFIRE_POSTER_IMAGE } from '../lib/eventArtwork';

const INTRO_KEY = 'srusti_intro_seen_v2';
const INTRO_DURATION = 5000;
export function shouldShowIntro(): boolean {
  if (window.location.pathname !== '/' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try { return sessionStorage.getItem(INTRO_KEY) !== 'yes'; } catch { return true; }
}

export function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const finish = () => {
      try { sessionStorage.setItem(INTRO_KEY, 'yes'); } catch { /* Storage is optional. */ }
      dialog?.close();
      onComplete();
    };
    const timer = window.setTimeout(finish, INTRO_DURATION);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => { if (motion.matches) finish(); };
    motion.addEventListener('change', onMotion);
    return () => { window.clearTimeout(timer); motion.removeEventListener('change', onMotion); dialog?.close(); };
  }, [onComplete]);
  const skip = () => {
    try { sessionStorage.setItem(INTRO_KEY, 'yes'); } catch { /* Storage is optional. */ }
    onComplete();
  };
  return <dialog ref={dialogRef} className="cinematic-intro" aria-labelledby="intro-title" onCancel={event => { event.preventDefault(); skip(); }}>
    <ArcadeLoadingScene intro />
    <button type="button" className="intro-skip" onClick={skip} autoFocus>Skip intro →</button>
  </dialog>;
}

function ArcadeLoadingScene({ intro = false }: { intro?: boolean }) {
  return <div className="arcade-scene">
    <div className="arcade-grid" aria-hidden="true" />
    <div className="arcade-scanlines" aria-hidden="true" />
    <div className="arcade-topline"><span>SRUSTI / CAMPUS LAN</span><span>EST. 2026</span></div>
    <div className="arcade-layout">
      <figure className="arcade-poster arcade-poster-left">
        <img src={BGMI_POSTER_IMAGE} alt="PUBG / BGMI battleground poster" width="896" height="1200" decoding="async" />
        <figcaption><span>01 / BATTLEGROUNDS</span><strong>PUBG · BGMI</strong></figcaption>
      </figure>
      <div className="arcade-center">
        <img className="arcade-crest" src="/assets/aistudio/Prospectus_2026_-_27_-_1_bb4cb47c.png" alt="Srusti Academy crest" width="52" height="55" />
        <p className="arcade-eyebrow">THE CAMPUS. THE SQUAD. THE GLORY.</p>
        <h2 id={intro ? 'intro-title' : undefined}>READY<span>PLAYER?</span></h2>
        <span className="intro-wordmark"><img src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.png" alt="Srusti e-Sports" width="1400" height="500" /></span>
        <div className="arcade-loading-label">{intro ? 'ENTERING THE ARENA' : 'LOADING YOUR PAGE'}<span aria-hidden="true">…</span></div>
        <div className="arcade-loader" aria-hidden="true"><span /></div>
        <p className="arcade-caption">Campus LAN Championship<br /><time dateTime="2026-12-13">13 December 2026</time></p>
      </div>
      <figure className="arcade-poster arcade-poster-right">
        <img src={FREEFIRE_POSTER_IMAGE} alt="Free Fire squad poster" width="896" height="1200" decoding="async" />
        <figcaption><span>02 / SURVIVAL ARENA</span><strong>FREE FIRE</strong></figcaption>
      </figure>
    </div>
    <div className="arcade-bottomline" aria-hidden="true"><span>COLLEGE PRIDE. GAME ON.</span><span>SRUSTI E-SPORTS / 2026</span></div>
  </div>;
}

export function PageLoading() {
  return <div className="page-loading arcade-page-loading" role="status" aria-label="Loading your page"><ArcadeLoadingScene /></div>;
}
