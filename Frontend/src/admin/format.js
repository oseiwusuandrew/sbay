/** Shared display helpers for the admin pages. */

/** True when the date falls within the last 24 hours (drives the NEW badge). */
export const isNew = (date) => !!date && Date.now() - new Date(date).getTime() < 24 * 3600 * 1000;
