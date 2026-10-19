import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { Settings } from '../models/Settings.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// In-memory cache for catalog meta (schools + categories). Avoids full-scan on every request.
let catalogCache = { data: null, at: 0 };
const CATALOG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export function invalidateCatalogCache() { catalogCache = { data: null, at: 0 }; homeFeedCache = { data: null, at: 0 }; }

// In-memory cache for the combined home feed.
let homeFeedCache = { data: null, at: 0 };
const HOME_FEED_CACHE_TTL = 60 * 1000; // 1 minute

// Joining words stay lowercase mid-name: "University of Ghana", not "Of".
const MINOR_WORDS = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'on', '&']);

function toTitleCase(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text === text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part, i) => (i > 0 && MINOR_WORDS.has(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactTextFilter(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return undefined;
  return new RegExp(`^${escapeRegex(text)}$`, 'i');
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isDuplicateListing(existing, incoming) {
  return (
    normalizeText(existing.title) === normalizeText(incoming.title) &&
    normalizeText(existing.description) === normalizeText(incoming.description) &&
    normalizeNumber(existing.price) === normalizeNumber(incoming.price) &&
    normalizeNumber(existing.discountPrice) === normalizeNumber(incoming.discountPrice) &&
    normalizeText(existing.category) === normalizeText(incoming.category) &&
    normalizeText(existing.condition) === normalizeText(incoming.condition) &&
    normalizeText(existing.location) === normalizeText(incoming.location) &&
    normalizeText(existing.school) === normalizeText(incoming.school) &&
    normalizeText(existing.city) === normalizeText(incoming.city)
  );
}

async function findDuplicateListing(sellerId, candidate, excludeId) {
  const filter = {
    seller: sellerId,
    status: { $ne: 'removed' },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const existingListings = await Product.find(filter)
    .select('title description price discountPrice category condition location school city');

  return existingListings.find((item) => isDuplicateListing(item, candidate));
}

/** GET /api/products/catalog — DB-driven categories and school groups. */
export const listCatalogMeta = asyncHandler(async (_req, res) => {
  // Serve from cache if fresh
  if (catalogCache.data && Date.now() - catalogCache.at < CATALOG_CACHE_TTL) {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json(catalogCache.data);
  }

  const items = await Product.find({ status: 'active' })
    .select('school city category seller location')
    .populate('seller', 'verification.university')
    .lean();

  const categories = new Map();
  const schools = new Map();

  for (const item of items) {
    const categoryRaw = String(item.category || '').trim();
    const categoryKey = categoryRaw.toLowerCase();
    const sellerUni = item.seller?.verification?.university || '';
    const schoolRaw = String(item.school || sellerUni || '').trim();
    const schoolKey = schoolRaw ? schoolRaw.toLowerCase() : 'others';
    const cityRaw = String(item.city || '').trim();
    const locationRaw = String(item.location || '').trim();

    if (categoryRaw) {
      const currentCategory = categories.get(categoryKey) || {
        id: categoryKey,
        label: toTitleCase(categoryRaw),
        count: 0,
      };
      currentCategory.count += 1;
      categories.set(categoryKey, currentCategory);
    }

    const currentSchool = schools.get(schoolKey) || {
      id: schoolKey,
      label: schoolRaw ? toTitleCase(schoolRaw) : 'Others',
      city: cityRaw || '',
      count: 0,
      categories: new Map(),
      locations: schoolKey === 'others' ? new Map() : undefined, // Track locations for "Others"
    };

    currentSchool.count += 1;
    if (cityRaw && !currentSchool.city) currentSchool.city = cityRaw;

    // For "Others" category, track locations
    if (schoolKey === 'others' && locationRaw) {
      if (!currentSchool.locations) currentSchool.locations = new Map();
      const locKey = locationRaw.toLowerCase();
      const currentLocation = currentSchool.locations.get(locKey) || {
        id: locKey,
        label: toTitleCase(locationRaw),
        count: 0,
        categories: new Map(),
      };
      currentLocation.count += 1;
      
      // Add category to location
      if (categoryRaw) {
        const locCategory = currentLocation.categories.get(categoryKey) || {
          id: categoryKey,
          label: toTitleCase(categoryRaw),
          count: 0,
        };
        locCategory.count += 1;
        currentLocation.categories.set(categoryKey, locCategory);
      }
      
      currentSchool.locations.set(locKey, currentLocation);
    }

    if (categoryRaw) {
      const currentSchoolCategory = currentSchool.categories.get(categoryKey) || {
        id: categoryKey,
        label: toTitleCase(categoryRaw),
        count: 0,
      };
      currentSchoolCategory.count += 1;
      currentSchool.categories.set(categoryKey, currentSchoolCategory);
    }

    schools.set(schoolKey, currentSchool);
  }

  const result = {
    total: items.length,
    categories: Array.from(categories.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    schools: Array.from(schools.values()).map((school) => ({
      id: school.id,
      label: school.label,
      city: school.city,
      count: school.count,
      categories: Array.from(school.categories.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      locations: school.locations 
        ? Array.from(school.locations.values()).map((loc) => ({
            id: loc.id,
            label: loc.label,
            count: loc.count,
            categories: Array.from(loc.categories.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
          })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        : undefined,
    })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };

  // Store in cache
  catalogCache = { data: result, at: Date.now() };
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json(result);
});

/** Lightweight select list for product list queries — omit heavy fields. */
const LIST_SELECT = '-description -removedReason -removedBy -__v';

/** GET /api/products/home — combined feed: trending + recent + sellers in one call. */
export const getHomeFeed = asyncHandler(async (_req, res) => {
  // Serve from cache if fresh
  if (homeFeedCache.data && Date.now() - homeFeedCache.at < HOME_FEED_CACHE_TTL) {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return res.json(homeFeedCache.data);
  }

  const [trending, recent] = await Promise.all([
    Product.find({ status: 'active' })
      .sort({ views: -1 })
      .limit(12)
      .select(LIST_SELECT)
      .populate('seller', 'name avatar sellerProfile verified location')
      .lean(),
    Product.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(12)
      .select(LIST_SELECT)
      .populate('seller', 'name avatar sellerProfile verified location')
      .lean(),
  ]);

  // Extract unique verified sellers from all fetched products
  const seen = new Set();
  const sellers = [];
  for (const p of [...trending, ...recent]) {
    const s = p.seller;
    if (!s || seen.has(String(s._id))) continue;
    seen.add(String(s._id));
    if (s.verified) sellers.push(s);
    if (sellers.length >= 8) break;
  }

  const result = { trending, recent, sellers };
  homeFeedCache = { data: result, at: Date.now() };

  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  res.json(result);
});

/** GET /api/products — public list with filters, search, pagination. */
export const listProducts = asyncHandler(async (req, res) => {
  const {
    q, category, seller, school, city, location,
    minPrice, maxPrice, condition,
    sort = 'recent', page = 1, limit = 24,
  } = req.query;

  const filter = { status: 'active' };
  if (category) filter.category = exactTextFilter(category);
  if (seller) filter.seller = seller;
  if (location) filter.location = exactTextFilter(location);
  if (school) {
    // Match products where school field matches OR seller's university matches
    const schoolRegex = new RegExp(`^${school.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const sellersWithUni = await User.find({ 'verification.university': schoolRegex }).select('_id').lean();
    const sellerIds = sellersWithUni.map((s) => s._id);
    filter.$or = [
      { school: exactTextFilter(school) },
      { school: { $in: ['', null] }, seller: { $in: sellerIds } },
    ];
  }
  if (city) filter.city = exactTextFilter(city);
  if (condition) filter.condition = exactTextFilter(condition);
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (q) {
    // Substring match so partial words work ("iph" → iPhone); $text only
    // matched whole stemmed words. Every term must appear somewhere.
    const terms = String(q).trim().split(/\s+/).filter(Boolean).slice(0, 6);
    const termClauses = terms.map((t) => {
      const rx = new RegExp(escapeRegex(t), 'i');
      return { $or: [{ title: rx }, { category: rx }, { description: rx }] };
    });
    if (termClauses.length) {
      filter.$and = [...(filter.$and || []), ...termClauses];
    }
  }

  const sortMap = {
    recent:    { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc:{ price: -1 },
    popular:   { views: -1 },
  };

  const lim = Math.min(Number(limit) || 24, 60);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(sortMap[sort] || sortMap.recent)
      .skip(skip).limit(lim)
      .select(LIST_SELECT)
      .populate('seller', 'name avatar sellerProfile verified location')
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  res.json({ items, total, page: Number(page), limit: lim });
});

/**
 * GET /api/products/:id — single listing + bumps view count.
 * Hidden (moderated) listings are only visible to their owner and
 * admins; the owner's own visits don't inflate the view counter.
 */
export const getProduct = asyncHandler(async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, status: { $ne: 'removed' } })
    .populate('seller', 'name avatar sellerProfile verified location createdAt');
  if (!p) throw new HttpError(404, 'Product not found');

  const viewerId = req.user?._id?.toString();
  const isOwner = viewerId && p.seller?._id?.toString() === viewerId;
  if (p.status === 'hidden' && !isOwner && req.user?.role !== 'admin') {
    throw new HttpError(404, 'Product not found');
  }

  if (!isOwner) {
    await Product.updateOne({ _id: p._id }, { $inc: { views: 1 } });
    p.views = (p.views || 0) + 1;
  }
  res.json({ product: p });
});

/** POST /api/products — sellers only. */
export const createProduct = asyncHandler(async (req, res) => {
  const seller = req.user;
  if (seller.role !== 'seller') throw new HttpError(403, 'Only sellers can create listings');

  // The onboarding fee used to be enforced only by the React page.
  const settings = await Settings.getSingleton();
  if (Number(settings.sellerOnboardingFee || 0) > 0 && !seller.onboardingFeePaid) {
    throw new HttpError(402, 'Please pay the one-time seller onboarding fee before listing items.');
  }

  const {
    title, description, price, discountPrice,
    stock, condition, category, images, location, school, city,
  } = req.body;

  // If category is "Other" or no school is provided, location is mandatory
  const normalizedCategory = String(category || '').trim().toLowerCase();
  const normalizedSchool = String(school || seller.verification?.university || '').trim();
  const isOtherCategory = normalizedCategory === 'other' || normalizedCategory === 'others';
  const hasNoSchool = !normalizedSchool;

  if ((isOtherCategory || hasNoSchool) && !location) {
    throw new HttpError(400, 'Location is required when listing under "Other" category or without a school affiliation.');
  }

  const candidate = {
    title,
    description,
    price,
    discountPrice,
    category,
    condition,
    location,
    school,
    city,
  };

  const duplicate = await findDuplicateListing(req.user._id, candidate);
  if (duplicate) {
    return res.status(409).json({ error: 'You already have this exact product listed. Please edit the existing listing instead.' });
  }

  const product = await Product.create({
    seller: seller._id,
    title, description,
    price, discountPrice,
    stock: stock ?? 1,
    status: stock === 0 ? 'sold_out' : 'active',
    condition, category,
    images: Array.isArray(images) ? images : [],
    location: location || seller.sellerProfile?.location || seller.location,
    school: school || seller.verification?.university || '',
    city,
  });

  invalidateCatalogCache();
  res.status(201).json({ product });
});

/** PATCH /api/products/:id — seller may only edit their own. */
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  if (product.seller.toString() !== req.user._id.toString()) {
    throw new HttpError(403, 'You can only edit your own listings');
  }

  const allowed = [
    'title', 'description', 'price', 'discountPrice', 'stock',
    'condition', 'category', 'images', 'location', 'school', 'city',
  ];
  for (const k of allowed) {
    if (req.body[k] !== undefined) product[k] = req.body[k];
  }
  const duplicate = await findDuplicateListing(req.user._id, {
    title: product.title,
    description: product.description,
    price: product.price,
    discountPrice: product.discountPrice,
    category: product.category,
    condition: product.condition,
    location: product.location,
    school: product.school,
    city: product.city,
  }, product._id);
  if (duplicate) {
    throw new HttpError(409, 'You already have this exact product listed. Please edit the existing listing instead.');
  }
  if (product.stock > 0 && product.status === 'sold_out') product.status = 'active';
  if (product.stock === 0 && product.status === 'active') product.status = 'sold_out';
  await product.save();

  invalidateCatalogCache();
  res.json({ product });
});

/** DELETE /api/products/:id — soft delete, sets status='removed'. */
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  if (product.seller.toString() !== req.user._id.toString()) {
    throw new HttpError(403, 'You can only delete your own listings');
  }
  product.status = 'removed';
  await product.save();
  invalidateCatalogCache();
  res.json({ ok: true });
});

/** GET /api/products/mine — seller's own listings (any status). */
export const myListings = asyncHandler(async (req, res) => {
  const items = await Product.find({ seller: req.user._id, status: { $ne: 'removed' } })
    .sort({ createdAt: -1 });
  res.json({ items });
});

/** GET /api/products/mine/stats - seller aggregate listing metrics. */
export const myListingStats = asyncHandler(async (req, res) => {
  const [stats] = await Product.aggregate([
    { $match: { seller: req.user._id, status: { $ne: 'removed' } } },
    {
      $group: {
        _id: '$seller',
        listings: { $sum: 1 },
        activeListings: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        views: { $sum: { $ifNull: ['$views', 0] } },
        sold: { $sum: { $ifNull: ['$sold', 0] } },
      },
    },
  ]);

  res.json({
    stats: {
      listings: stats?.listings || 0,
      activeListings: stats?.activeListings || 0,
      views: stats?.views || 0,
      sold: stats?.sold || 0,
    },
  });
});
