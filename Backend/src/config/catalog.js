/**
 * The categories a listing can be filed under. One fixed list keeps the
 * Categories page tidy: free-text categories split the same goods across
 * "Books", "books" and "Textbook". Served to the app via /api/settings.
 * Listings created before this list existed keep their category.
 */
export const CATEGORIES = Object.freeze([
  'Textbooks',
  'Phones',
  'Laptops',
  'Electronics',
  'Fashion',
  'Shoes',
  'Beauty',
  'Hall Essentials',
  'Kitchen',
  'Stationery',
  'Sports',
  'Gaming',
  'Music',
  'Food',
  'Other',
]);

const lookup = new Map(CATEGORIES.map((c) => [c.toLowerCase(), c]));

/** The canonical spelling of a known category, or null. */
export const canonicalCategory = (value) => lookup.get(String(value || '').trim().toLowerCase()) || null;
