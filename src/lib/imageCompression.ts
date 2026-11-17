/**
 * Compresses an uploaded image file in-browser via HTML5 Canvas
 * to stay well within Supabase Free 1 GB storage and 5 GB egress budgets
 * while preserving crisp legibility for 12-digit UTR & timestamp verification.
 */
export async function compressScreenshot(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload a valid image file (JPEG, PNG, or WebP).');
  }
  if (file.size <= 350 * 1024) {
    return file;
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode selected image.'));
      el.src = bitmapUrl;
    });

    const maxWidth = 1280;
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    if (!blob) return file;

    const cleanName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], cleanName, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
