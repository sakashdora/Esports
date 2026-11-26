import { Download, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';

export function TeamCheckInPass({ teamCode, iglPhone }: { teamCode: string; iglPhone: string }) {
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setQrUrl('');
    setError('');
    void (async () => {
      try {
        const response = await fetch('/api/registrations/check-in-pass', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamCode, iglPhone }), signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || 'The check-in QR is unavailable. Please try again.');
        }
        const png = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(png);
        setQrUrl(objectUrl);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to load the check-in QR.');
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [teamCode, iglPhone, attempt]);

  return (
    <section aria-labelledby="team-check-in" className="mt-6 grid items-center gap-5 rounded-lg border border-white/15 bg-[#11192d] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(245px,320px)] sm:p-6 print:border-slate-300 print:bg-white">
      <div>
        <div className="mb-3 inline-flex rounded-md border border-[#eec36c]/35 p-2 text-[#eec36c] print:hidden">
          <ScanLine className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 id="team-check-in" className="text-xl font-bold text-white print:text-slate-950">Team check-in pass</h3>
        <p className="mt-1 max-w-xs text-sm text-slate-300 print:text-slate-700">Show this QR and each participant’s college photo ID at campus entry.</p>
        {qrUrl && (
          <a href={qrUrl} download={`${teamCode}-check-in.png`} className="no-print mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#eec36c] px-4 py-2 text-sm font-bold text-[#11192d] hover:bg-[#ffe0a1]">
            <Download className="h-4 w-4" aria-hidden="true" /> Download QR
          </a>
        )}
        {error && (
          <div className="no-print mt-4 text-sm text-red-200">
            <p role="alert">{error}</p>
            <button type="button" onClick={() => setAttempt((current) => current + 1)} className="mt-2 font-semibold text-white underline underline-offset-4">Try again</button>
          </div>
        )}
      </div>
      {qrUrl ? (
        <img src={qrUrl} alt="Team check-in QR code with the Srusti crest" width="320" height="320" className="mx-auto h-auto w-full max-w-xs rounded-md bg-white [image-rendering:pixelated]" />
      ) : !error && (
        <div className="flex aspect-square w-full max-w-xs items-center justify-center justify-self-center rounded-md border border-white/15 bg-white/5 text-sm text-slate-300" role="status">Preparing QR…</div>
      )}
    </section>
  );
}
