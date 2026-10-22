import { Image } from '../models/Image.js';
import { HttpError } from './httpError.js';

export const IMAGE_PATH = '/api/images/';
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:image/');

/** Decode a base64 image data URL, refusing anything that isn't a small picture. */
export function decodeDataUrl(dataUrl) {
  const m = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ''));
  if (!m || !TYPES.has(m[1].toLowerCase())) {
    throw new HttpError(400, 'Please upload a JPEG, PNG, WebP or GIF image.');
  }
  const data = Buffer.from(m[2], 'base64');
  if (!data.length) throw new HttpError(400, 'That image is empty.');
  if (data.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'That image is too large. The limit is 3 MB.');
  return { data, contentType: m[1].toLowerCase() };
}

/** Store a data URL and return the path it is served from. */
export async function storeDataUrl(dataUrl, owner) {
  const { data, contentType } = decodeDataUrl(dataUrl);
  const img = await Image.create({ data, contentType, size: data.length, owner });
  return `${IMAGE_PATH}${img._id}`;
}

/**
 * Accept the image values a client may send for a listing or avatar:
 * our own image paths, http(s) URLs, or (older clients) data URLs, which
 * are stored and replaced by their path. Anything else is rejected.
 */
export async function normalizeImage(value, owner) {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new HttpError(400, 'Invalid image');
  if (isDataUrl(value)) return storeDataUrl(value, owner);
  // The app shows our images by full URL; keep only the path so a change of
  // API domain never breaks stored pictures.
  const ours = /^https?:\/\/[^/]+(\/api\/images\/[a-f\d]{24})$/i.exec(value);
  if (ours) return ours[1];
  if (value.startsWith(IMAGE_PATH) || /^https:\/\//i.test(value) || /^http:\/\/localhost[:/]/i.test(value)) {
    return value.slice(0, 2048);
  }
  throw new HttpError(400, 'Invalid image');
}

export function normalizeImages(values, owner) {
  if (!Array.isArray(values)) return Promise.resolve([]);
  return Promise.all(values.filter(Boolean).slice(0, 6).map((v) => normalizeImage(v, owner)));
}
