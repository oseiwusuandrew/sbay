import { api } from '../api/client';

/**
 * Downscale an image file and re-encode it as a JPEG data URL. Phone photos
 * are often 4-12 MB; this brings them to a few hundred KB before they
 * leave the device.
 */
export function resizeImage(file, maxSize = 512, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image format is not supported.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Resize a photo and upload it. Resolves to the stored path
 * ("/api/images/<id>"); show it with mediaUrl() from api/config.
 */
export async function uploadPhoto(file, { maxSize = 1600, quality = 0.82 } = {}) {
  const dataUrl = await resizeImage(file, maxSize, quality);
  const { data } = await api.post('/images', { dataUrl });
  return data.url;
}
