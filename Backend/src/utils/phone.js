import { HttpError } from './httpError.js';

/**
 * Ghanaian mobile numbers, stored one way: "0241234567". Accepts the
 * forms people type: "024 123 4567", "+233 24 123 4567", "233241234567",
 * "241234567". Returns '' for an empty value; throws for anything else.
 */
export function normalizePhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233')) digits = digits.slice(3);
  if (digits.length === 9) digits = `0${digits}`;
  if (!/^0[2-5]\d{8}$/.test(digits)) {
    throw new HttpError(400, 'Enter a Ghanaian phone number, e.g. 024 123 4567.');
  }
  return digits;
}
