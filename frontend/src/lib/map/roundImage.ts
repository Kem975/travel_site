/** Load an image URL and crop it to a circle with a thin ring, for use as a
 *  MapLibre marker icon (map.addImage). Returns null on failure (falls back to a dot). */
export async function roundImage(url: string, size = 52): Promise<ImageData | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('image load failed'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // cover-fit
    const ratio = img.width / img.height;
    let dw = size;
    let dh = size;
    let dx = 0;
    let dy = 0;
    if (ratio > 1) {
      dh = size;
      dw = size * ratio;
      dx = -(dw - size) / 2;
    } else {
      dw = size;
      dh = size / ratio;
      dy = -(dh - size) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();

    return ctx.getImageData(0, 0, size, size);
  } catch {
    return null;
  }
}
