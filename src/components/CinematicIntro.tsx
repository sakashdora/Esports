import { useEffect, useRef } from 'react';
import { EmberParticles } from './EmberParticles';

const INTRO_KEY = 'srusti_intro_seen_v1';
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
    const timer = window.setTimeout(finish, 1800);
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
    <div className="intro-light intro-light-blue" aria-hidden="true" />
    <div className="intro-light intro-light-red" aria-hidden="true" />
    <EmberParticles density={20} />
    <div className="intro-brand">
      <img className="intro-crest" src="/assets/aistudio/Prospectus_2026_-_27_-_1_bb4cb47c.png" alt="Srusti Academy crest" width="68" height="72" />
      <p className="intro-eyebrow">SRUSTI ACADEMY PRESENTS</p>
      <h2 id="intro-title">THE ARENA AWAITS.</h2>
      <span className="intro-wordmark"><img src="/assets/aistudio/SRUSTI_ESPORTS_f3d0bc97.png" alt="Srusti e-Sports" /></span>
      <p className="intro-caption">Campus LAN Championship · 13 December 2026</p>
      <span className="intro-sweep" aria-hidden="true" />
    </div>
    <button type="button" className="intro-skip" onClick={skip} autoFocus>Skip intro →</button>
  </dialog>;
}

export function PageLoading() {
  return <div className="page-loading" role="status"><span className="page-loading-orbit" aria-hidden="true" /><strong>SRUSTI E-SPORTS</strong><span>Loading your page…</span></div>;
}
