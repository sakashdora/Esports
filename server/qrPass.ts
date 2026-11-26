import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import QRCode from 'qrcode';

const crestAsset = 'assets/brand/srusti-academy-crest.png';
const scale = 10;
let cachedCrest: PNG | undefined;

function getCrest() {
  if (cachedCrest) return cachedCrest;
  const moduleRoot = fileURLToPath(new URL('../', import.meta.url));
  const source = [process.cwd(), moduleRoot].flatMap((root) => ['public', 'dist'].map((directory) => path.join(root, directory, crestAsset)))
    .find((file) => fs.existsSync(file));
  if (!source) throw new Error('The check-in crest asset is unavailable.');
  cachedCrest = PNG.sync.read(fs.readFileSync(source));
  return cachedCrest;
}

export async function renderBrandedQr(encoded: string, errorCorrectionLevel: 'H' | 'M'): Promise<Buffer> {
  const qr = PNG.sync.read(await QRCode.toBuffer(encoded, {
    errorCorrectionLevel, margin: 4, scale,
    color: { dark: '#0F1930', light: '#FFFFFF' },
  }));
  const crest = getCrest();
  // Limit the knockout to a small, module-aligned center area to leave the finder patterns and quiet zone intact.
  const dataModules = qr.width / scale - 8;
  const patchModules = Math.max(5, 2 * Math.floor(dataModules * 0.063) + 1);
  const patchSize = patchModules * scale;
  const offset = (qr.width - patchSize) / 2;
  const ratio = (patchSize - 10) / Math.max(crest.width, crest.height);
  const width = Math.round(crest.width * ratio);
  const height = Math.round(crest.height * ratio);
  const left = Math.floor((patchSize - width) / 2);
  const top = Math.floor((patchSize - height) / 2);

  for (let y = 0; y < patchSize; y++) {
    for (let x = 0; x < patchSize; x++) {
      const pixel = ((offset + y) * qr.width + offset + x) * 4;
      qr.data.fill(255, pixel, pixel + 4);
      if (x < left || x >= left + width || y < top || y >= top + height) continue;
      const sx = Math.min(crest.width - 1, Math.floor((x - left + 0.5) / ratio));
      const sy = Math.min(crest.height - 1, Math.floor((y - top + 0.5) / ratio));
      const color = (sy * crest.width + sx) * 4;
      const alpha = crest.data[color + 3] / 255;
      for (let channel = 0; channel < 3; channel++) {
        qr.data[pixel + channel] = Math.round(255 + (crest.data[color + channel] - 255) * alpha);
      }
    }
  }
  return PNG.sync.write(qr);
}
