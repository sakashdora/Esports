import { X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

const ANNOUNCEMENT_KEY = 'srusti_welcome_poster_2026_seen';

export function shouldShowAnnouncement() {
  try { return sessionStorage.getItem(ANNOUNCEMENT_KEY) !== 'yes'; }
  catch { return true; }
}

export function dismissAnnouncement() {
  try { sessionStorage.setItem(ANNOUNCEMENT_KEY, 'yes'); }
  catch { /* The in-memory state still dismisses the notice when storage is unavailable. */ }
}

export function WelcomeAnnouncement({ onDismiss, onRegister }: {
  onDismiss: () => void;
  onRegister: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="welcome-announcement" aria-labelledby="welcome-title"
      aria-describedby="welcome-description"
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}>
      <header className="welcome-announcement-header">
        <h2 id="welcome-title">Srusti e-Sports · 2026</h2>
        <button type="button" className="welcome-dismiss" onClick={onDismiss} aria-label="Close announcement" autoFocus>
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      {imageFailed ? (
        <p className="welcome-image-fallback">Campus LAN Championship 2026 — BGMI &amp; Free Fire.<br />Hosted by SAMT &amp; SAGS. Media partner: Srusti Prasar.</p>
      ) : (
        <button type="button" className="welcome-poster-link" onClick={onRegister} aria-label="Register now — choose BGMI or Free Fire">
          <img src="/assets/brand/srusti-welcome-poster-2026.webp" width="1600" height="900"
            alt="Srusti Campus LAN Championship 2026. Hosted by SAMT and SAGS, with media partner Srusti Prasar. BGMI and Free Fire — register now."
            onError={() => setImageFailed(true)} />
        </button>
      )}
      <footer className="welcome-announcement-footer">
        <p id="welcome-description">13 December 2026 · Entry 9:30 AM IST<br />₹299 per team · Optional lunch ₹100 per team</p>
        <div className="welcome-announcement-actions">
          <button type="button" className="arena-button secondary" onClick={onDismiss}>Continue to website</button>
          <button type="button" className="arena-button primary" onClick={onRegister}>Register now →</button>
        </div>
      </footer>
    </dialog>
  );
}
