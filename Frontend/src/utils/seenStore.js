/**
 * "Already seen" notification ids, persisted per storage key so the bell
 * badge doesn't resurrect old items after a reload. Shared by the admin
 * and user notification hooks.
 */
export function readSeen(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set(); }
}

export function writeSeen(key, set, cap = 500) {
  // Keep only the most recent ids so storage doesn't grow unbounded.
  try { localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-cap))); }
  catch { /* storage full or blocked — badge just resets */ }
}
