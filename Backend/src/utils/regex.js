/** Escape user input for safe use inside a RegExp (search filters). */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
