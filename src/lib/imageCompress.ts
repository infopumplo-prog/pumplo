// Zmenšení fotky před uploadem: delší strana max `maxPx`, JPEG. Fotka z mobilu
// má 3–6 MB, po zmenšení na 1600 px kolem 300 kB.
export function compressImageToJpeg(file: Blob, maxPx = 1600, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    img.onerror = () => { cleanup(); reject(new Error('image_decode')); };
    img.onload = () => {
      try {
        const scale = Math.min(1, maxPx / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) { cleanup(); reject(new Error('canvas')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => { cleanup(); if (b) resolve(b); else reject(new Error('toBlob')); }, 'image/jpeg', quality);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    img.src = url;
  });
}
