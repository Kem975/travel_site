// Downscale + re-encode to WebP in the browser before upload (PLAN_REVIEW E1/E3):
// smaller payloads over weak connections, and EXIF orientation baked into pixels.
export type CompressedImage = { blob: Blob; filename: string };

export async function compressImage(file: File, maxDim = 2400, quality = 0.82): Promise<CompressedImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return { blob: file, filename: file.name };
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) {
      return { blob: file, filename: file.name };
    }
    return { blob, filename: file.name.replace(/\.[^.]+$/, '') + '.webp' };
  } catch {
    // Decode failed (e.g. HEIC in some browsers) — send the original; the server validates.
    return { blob: file, filename: file.name };
  }
}
