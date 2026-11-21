import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

const RELOAD_KEY = 'srusti_chunk_reload_at';

/** After a redeploy, an open tab still points at page files that no longer exist. */
function isStaleDeploymentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|importing a module script failed|ChunkLoadError|Loading chunk/i.test(message);
}

/**
 * Keeps one broken page from blanking the whole site. A stale tab (old build after a deploy)
 * reloads itself once automatically; anything else shows a clear way to recover.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isStaleDeploymentError(error)) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        // One automatic reload per minute, so a genuinely missing file cannot loop forever.
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // Storage unavailable: fall through to the manual button.
      }
    }
    console.error('Page error:', error instanceof Error ? error.message : error, info.componentStack?.split('\n')[1]?.trim());
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center bg-[#0D0A09] px-6 py-16 text-center text-neutral-100">
        <h1 className="font-display text-3xl font-bold uppercase">Something went wrong</h1>
        <p className="mt-3 max-w-md text-sm text-neutral-400">
          This page could not be shown. Your registration details are safe. Reload to try again, or
          go back to the home page.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-10 rounded-md bg-[#D41B14] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B41510]"
          >
            Reload page
          </button>
          <a
            href="/"
            className="inline-flex min-h-10 items-center rounded-md border border-white/20 px-5 py-2.5 text-sm font-medium text-neutral-200 hover:bg-white/5"
          >
            Go to home page
          </a>
        </div>
      </main>
    );
  }
}
