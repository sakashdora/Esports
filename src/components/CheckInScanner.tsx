import { Camera, ImageUp, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const deskButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50';
export const deskPrimary = `${deskButton} bg-[#233D8B] text-white hover:bg-[#192e70]`;
export const deskSecondary = `${deskButton} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;
export const deskInput = 'min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#233D8B] focus:outline-none focus:ring-1 focus:ring-[#233D8B]';

function frame(canvas: HTMLCanvasElement, source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, 1600 / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function CheckInScanner({ busy, onRead }: { busy: boolean; onRead: (value: string) => void }) {
  const [camera, setCamera] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!camera) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    const video = videoRef.current;
    if (!video) return;

    async function scan(video: HTMLVideoElement) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error();
        const { default: decode } = await import('jsqr');
        if (stopped) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        const canvas = document.createElement('canvas');
        const readFrame = () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
              const pixels = frame(canvas, video, video.videoWidth, video.videoHeight);
              const result = pixels && decode(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
              if (result?.data) {
                setCamera(false);
                onRead(result.data);
                return;
              }
            }
            timer = window.setTimeout(readFrame, 160);
          } catch {
            setError('The camera feed could not be read. Try uploading the QR image.');
            setCamera(false);
          }
        };
        readFrame();
      } catch {
        if (stopped) return;
        setError('Camera unavailable. Allow camera access or upload a QR image.');
        setCamera(false);
      }
    }

    void scan(video);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [camera, onRead]);

  async function readImage(file?: File) {
    if (!file) return;
    setCamera(false);
    setError('');
    if (file.size > 15 * 1024 * 1024) {
      setError('Choose a QR image under 15 MB.');
      return;
    }
    setReadingImage(true);
    let bitmap: ImageBitmap | undefined;
    try {
      const { default: decode } = await import('jsqr');
      bitmap = await createImageBitmap(file);
      const pixels = frame(document.createElement('canvas'), bitmap, bitmap.width, bitmap.height);
      const result = pixels && decode(pixels.data, pixels.width, pixels.height);
      if (!result?.data) throw new Error();
      onRead(result.data);
    } catch {
      setError('No QR code found. Try the original pass image or enter the Team ID.');
    } finally {
      bitmap?.close();
      setReadingImage(false);
    }
  }

  const unavailable = busy || readingImage;
  return (
    <section aria-labelledby="scanner-title" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 id="scanner-title" className="text-lg font-bold text-slate-950">Scan a team pass</h2>
      <div className="relative mt-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-[#101a32] text-center text-slate-200">
        {camera ? (
          <>
            <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-contain" aria-label="Live QR scanner camera" />
            <div aria-hidden="true" className="pointer-events-none z-10 aspect-square h-3/4 rounded-lg border-2 border-white/75" />
          </>
        ) : (
          <div className="px-5">
            <ScanLine aria-hidden="true" className="mx-auto h-10 w-10 text-[#eec36c]" strokeWidth={1.4} />
            <p className="mt-3 text-sm">Point your camera at the QR on the team’s pass.</p>
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className={deskPrimary} disabled={unavailable} onClick={() => { setError(''); setCamera(!camera); }}>
          <Camera className="h-4 w-4" aria-hidden="true" /> {camera ? 'Stop camera' : 'Start camera'}
        </button>
        <button type="button" className={deskSecondary} disabled={unavailable} onClick={() => fileRef.current?.click()}>
          <ImageUp className="h-4 w-4" aria-hidden="true" /> {readingImage ? 'Reading…' : 'Upload QR'}
        </button>
        <input ref={fileRef} className="hidden" type="file" accept="image/*" aria-label="Upload QR image" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          void readImage(file);
        }} />
      </div>
      <form className="mt-4" onSubmit={(event) => {
        event.preventDefault();
        if (!code.trim() || unavailable) return;
        setCamera(false);
        setError('');
        onRead(code);
        setCode('');
      }}>
        <label htmlFor="manual-team-id" className="text-sm font-semibold text-slate-700">Team ID</label>
        <div className="mt-1 flex gap-2">
          <input id="manual-team-id" placeholder="KW26-001" autoComplete="off" autoCapitalize="characters" spellCheck={false} className={`${deskInput} min-w-0`} value={code} onChange={(event) => setCode(event.target.value)} />
          <button className={`${deskSecondary} shrink-0 whitespace-nowrap`} disabled={!code.trim() || unavailable} type="submit">Look up</button>
        </div>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
