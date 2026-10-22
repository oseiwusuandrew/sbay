/** Where the API lives. Shared by the HTTP client and the data adapters. */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

/**
 * Pictures stored by the API come back as "/api/images/<id>" paths; turn
 * them into absolute URLs. Anything else (https links, data URLs, local
 * assets like /no-photo.svg) is returned unchanged.
 */
export function mediaUrl(value) {
  if (typeof value !== 'string' || !value) return value;
  return value.startsWith('/api/images/') ? `${API_ORIGIN}${value}` : value;
}
