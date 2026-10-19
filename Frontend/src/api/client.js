import axios from 'axios';
import {
  adaptProduct, adaptSeller, adaptUser,
  adaptOrder, adaptChat, adaptMessage,
} from './adapters';

/**
 * Axios instances for sBay's public/user API and the obfuscated admin API.
 *
 * Token is loaded lazily from localStorage on every request so changes
 * propagate immediately after login/logout without us having to mutate
 * `axios.defaults` from the auth store.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const ADMIN_URL = import.meta.env.VITE_ADMIN_API || `${API_URL}/_panel/control`;

export const TOKEN_KEY = 'sbay.token';
export const SESSION_TOKEN_KEY = 'sbay.token.session';
export const REMEMBER_KEY = 'sbay.remember';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(SESSION_TOKEN_KEY);
export const setToken = (t, remember = true) => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  if (t) {
    if (remember) localStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.setItem(SESSION_TOKEN_KEY, t);
  }
};

function makeClient(baseURL) {
  const c = axios.create({ baseURL, timeout: 60000 });
  c.interceptors.request.use((cfg) => {
    const t = getToken();
    if (t) cfg.headers.Authorization = `Bearer ${t}`;
    return cfg;
  });
  // Auto-retry GET requests on timeout — up to 3 attempts with backoff
  c.interceptors.response.use(undefined, async (err) => {
    const config = err.config;
    const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
    const isRetryable = config && (config.method === 'get' || config.url === '/payments/verify') && isTimeout;
    if (isRetryable) {
      config._retryCount = (config._retryCount || 0) + 1;
      if (config._retryCount <= 3) {
        const delay = config._retryCount * 1500; // 1.5s, 3s, 4.5s
        await new Promise(r => setTimeout(r, delay));
        return c(config);
      }
    }
    return Promise.reject(err);
  });

  c.interceptors.response.use(
    (r) => r,
    (err) => {
      // Surface backend's `error` / `details` shape as the thrown message.
      const data = err.response?.data;
      if (data?.error) {
        const e = new Error(data.error);
        e.status = err.response.status;
        e.details = data.details;
        return Promise.reject(e);
      }
      // Better error messages for network issues
      if (!err.response) {
        if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
          const e = new Error('The server is taking longer than expected. Please try again in a moment.');
          e.isTimeout = true;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sbay:timeout-error'));
          }
          return Promise.reject(e);
        }
        if (err.code === 'ERR_NETWORK' || err.message.includes('Network Error')) {
          const e = new Error(navigator.onLine
            ? 'Unable to reach the server. Please try again.'
            : 'You are offline. Check your internet connection.');
          e.isNetworkError = true;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(
              navigator.onLine ? 'sbay:server-error' : 'sbay:network-error'
            ));
          }
          return Promise.reject(e);
        }
      }
      // CORS errors
      if (err.message.includes('CORS') || err.message.includes('blocked')) {
        return Promise.reject(new Error('Connection blocked. Please contact support.'));
      }
      return Promise.reject(err);
    }
  );
  return c;
}

export const api = makeClient(API_URL);
export const adminApi = makeClient(ADMIN_URL);

const NOTIFICATIONS = { Today: [], Yesterday: [] };
const cache = new Map();
const inflight = new Map(); // deduplicate concurrent requests for same key
const cached = async (key, ttlMs, fetcher, { force = false } = {}) => {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < ttlMs) return hit.value;
  // Deduplicate: if the same key is already being fetched, await that promise
  if (inflight.has(key)) return inflight.get(key);
  const promise = fetcher().then((value) => {
    cache.set(key, { at: Date.now(), value });
    inflight.delete(key);
    return value;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });
  inflight.set(key, promise);
  return promise;
};

/* ------------------------------------------------------------------
   `sbay` — same surface as before, now backed by real HTTP.
------------------------------------------------------------------ */
export const sbay = {
  async getUniversities() {
    const meta = await this.getCatalogMeta();
    return meta.schools.map((s) => ({
      id: s.id,
      label: s.label,
      active: true,
    }));
  },

  async getCatalogMeta({ force = false } = {}) {
    return cached('catalog-meta', 1_800_000, async () => {
      const { data } = await api.get('/products/catalog');
      return data;
    }, { force });
  },

  async getCategories() {
    const meta = await this.getCatalogMeta();
    return [
      { id: 'all', label: 'All Items', icon: 'ShoppingBag' },
      ...meta.categories.map((c) => ({
        id: c.id,
        label: c.label,
        icon: 'Tag',
        count: c.count,
      })),
    ];
  },

  async getHomeFeed() {
    return cached('home-feed', 600_000, async () => {
      const { data } = await api.get('/products/home');
      return {
        trending: data.trending.map(adaptProduct),
        recent: data.recent.map(adaptProduct),
        sellers: data.sellers.map(adaptSeller),
      };
    });
  },

  async getTrending() {
    // Try home feed cache first to avoid a separate call
    const hit = cache.get('home-feed');
    if (hit && Date.now() - hit.at < 600_000) return hit.value.trending;
    return cached('products-trending', 600_000, async () => {
      const { data } = await api.get('/products', { params: { sort: 'popular', limit: 12 } });
      return data.items.map(adaptProduct);
    });
  },

  async getRecent() {
    // Try home feed cache first to avoid a separate call
    const hit = cache.get('home-feed');
    if (hit && Date.now() - hit.at < 600_000) return hit.value.recent;
    return cached('products-recent', 600_000, async () => {
      const { data } = await api.get('/products', { params: { sort: 'recent', limit: 12 } });
      return data.items.map(adaptProduct);
    });
  },

  async getAllProducts(params = {}) {
    const { data } = await api.get('/products', { params });
    return data.items.map(adaptProduct);
  },

  async getProductsByCategory(catId) {
    const params = catId && catId !== 'all' ? { category: catId } : {};
    const { data } = await api.get('/products', { params });
    return data.items.map(adaptProduct);
  },

  async getProduct(id) {
    const { data } = await api.get(`/products/${id}`);
    return adaptProduct(data.product);
  },

  async getSellers() {
    // Try home feed cache first — avoids a redundant product fetch
    const hit = cache.get('home-feed');
    if (hit && Date.now() - hit.at < 600_000) return hit.value.sellers;
    // Fallback: derive from popular listings
    const { data } = await api.get('/products', { params: { sort: 'popular', limit: 30 } });
    const seen = new Set();
    const sellers = [];
    for (const p of data.items) {
      const s = p.seller;
      if (!s || seen.has(s._id)) continue;
      seen.add(s._id);
      sellers.push(adaptSeller(s));
      if (sellers.length >= 8) break;
    }
    return sellers;
  },

  async getSeller(id) {
    const { data } = await api.get(`/users/sellers/${id}`);
    const seller = adaptSeller(data.seller);
    seller.listings = (data.listings || []).map(adaptProduct);
    return seller;
  },

  async getSchoolTree({ force = false } = {}) {
    const meta = await this.getCatalogMeta({ force });
    const schools = meta.schools.map((school) => ({
      id: school.id,
      label: school.label,
      city: school.city || '',
      count: school.count || 0,
      categories: school.categories.map((c) => ({
        id: c.id,
        label: c.label,
        icon: 'Tag',
        count: c.count,
      })),
      locations: school.locations?.map((loc) => ({
        id: loc.id,
        label: loc.label,
        count: loc.count,
        categories: loc.categories.map((c) => ({
          id: c.id,
          label: c.label,
          icon: 'Tag',
          count: c.count,
        })),
      })) || undefined,
    }));
    if (meta.categories.length) {
      const known = new Set(schools.flatMap((school) => school.categories.map((c) => c.id)));
      const uncategorized = meta.categories.filter((c) => !known.has(c.id));
      if (uncategorized.length) {
        // Check if "others" already exists in schools
        const othersIdx = schools.findIndex(s => s.id === 'others');
        if (othersIdx === -1) {
          schools.push({
            id: 'others',
            label: 'Others',
            city: '',
            categories: uncategorized.map((c) => ({
              id: c.id,
              label: c.label,
              icon: 'Tag',
              count: c.count,
            })),
          });
        }
      }
    }
    return schools;
  },

  async getProductsByScope({ schoolId, location, categoryId } = {}) {
    const params = {};

    if (schoolId === 'others' && !location) {
      // "Others" = sellers who left school blank or set city/school as empty
      // We pass a special flag; the backend returns products with no school set.
      // If the backend doesn't support 'school=__none__', we do client-side filtering.
      const { data } = await api.get('/products');
      let items = data.items.map(adaptProduct);
      // Filter: products where school is blank/Others
      items = items.filter((p) => !p.school || p.school.trim() === '' || p.school.toLowerCase() === 'others');
      if (categoryId && categoryId !== 'all') {
        const catLower = categoryId.toLowerCase();
        items = items.filter((p) => (p.category || '').toLowerCase() === catLower);
      }
      return items;
    }

    if (schoolId && schoolId !== 'all' && schoolId !== 'others') {
      const meta = await this.getCatalogMeta();
      const school = meta.schools.find((s) => s.id === schoolId);
      params.school = school?.label || schoolId;
    }
    if (location && location !== 'all') {
      const meta = await this.getCatalogMeta();
      // Find the location label from the schools data
      const othersSchool = meta.schools.find(s => s.id === 'others');
      const loc = othersSchool?.locations?.find(l => l.id === location);
      params.location = loc?.label || location;
    }
    if (categoryId && categoryId !== 'all') params.category = categoryId;
    const { data } = await api.get('/products', { params });
    return data.items.map(adaptProduct);
  },


  /** Paged search with total count, for the search page. */
  async searchPage(params = {}) {
    const { data } = await api.get('/products', { params });
    return { items: data.items.map(adaptProduct), total: data.total ?? data.items.length };
  },

  async searchProducts(q, category = '') {
    const params = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (!q && !category) return this.getAllProducts();
    const { data } = await api.get('/products', { params });
    return data.items.map(adaptProduct);
  },


  /* ----- Chats ----- */
  async getChats() {
    const { data } = await api.get('/chats');
    return data.chats.map((c) => adaptChat(c, 'buyer'));
  },
  async getSellerChats() {
    const { data } = await api.get('/chats');
    return data.chats.map((c) => adaptChat(c, 'seller'));
  },
  async getMessages(chatId, currentUserId) {
    const { data } = await api.get(`/chats/${chatId}`);
    return data.messages.map((m) => adaptMessage(m, currentUserId));
  },
  async sendMessage(chatId, text) {
    const { data } = await api.post(`/chats/${chatId}/messages`, { text });
    return data.message;
  },
  async startChat(sellerId) {
    const { data } = await api.post('/chats/start', { sellerId });
    return data.chat;
  },

  /* ----- Seller Reviews ----- */
  async getSellerReviews(sellerId, page = 1) {
    const { data } = await api.get(`/users/sellers/${sellerId}/reviews`, { params: { page } });
    return data;
  },
  async submitReview(sellerId, { rating, text }) {
    const { data } = await api.post(`/users/sellers/${sellerId}/reviews`, { rating, text });
    return data;
  },

  /* ----- Plans / settings (public) ----- */
  async getPlans() {
    const { data } = await api.get('/plans');
    return data.plans;
  },
  async getPublicSettings() {
    const { data } = await api.get('/settings');
    return data.settings;
  },

  /* ----- Notifications — backend not implemented yet, return empty. ----- */
  async getNotifications() { return NOTIFICATIONS; },
};

/* ------------------------------------------------------------------
   Auth wrappers — used by AuthContext.
------------------------------------------------------------------ */
export const authApi = {
  async register(payload) {
    const { data } = await api.post('/auth/register', payload);
    return { token: data.token, user: adaptUser(data.user) };
  },
  async login(payload) {
    const { data } = await api.post('/auth/login', payload);
    return { token: data.token, user: adaptUser(data.user) };
  },
  async me() {
    const { data } = await api.get('/auth/me');
    return adaptUser(data.user);
  },
  async updateMe(patch) {
    const { data } = await api.patch('/users/me', patch);
    return adaptUser(data.user);
  },
  async deleteMe() {
    const { data } = await api.delete('/users/me');
    return data;
  },
  async becomeSeller(payload) {
    const { data } = await api.post('/users/me/become-seller', payload);
    return adaptUser(data.user);
  },
  async changePassword(payload) {
    const { data } = await api.post('/auth/change-password', payload);
    return data;
  },
  async requestPasswordReset(email) {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },
  async resetPassword(payload) {
    const { data } = await api.post('/auth/reset-password', payload);
    return data;
  },
  async googleAuth(accessToken, role) {
    const { data } = await api.post('/auth/oauth/google', { accessToken, role });
    return { token: data.token, user: adaptUser(data.user) };
  },
  async addPaymentMethod(payload) {
    const { data } = await api.post('/users/me/payment-methods', payload);
    return adaptUser(data.user);
  },
  async removePaymentMethod(cardId) {
    const { data } = await api.delete(`/users/me/payment-methods/${cardId}`);
    return adaptUser(data.user);
  },
};

export const notificationApi = {
  async mine() {
    const { data } = await api.get('/users/me/notifications');
    return data.items || [];
  },
};

/* ------------------------------------------------------------------
   Product/order wrappers — used by Sell page, Cart, OrdersContext.
------------------------------------------------------------------ */
export const productApi = {
  async create(payload)        { const { data } = await api.post('/products', payload); return adaptProduct(data.product); },
  async update(id, payload)    { const { data } = await api.patch(`/products/${id}`, payload); return adaptProduct(data.product); },
  async remove(id)             { await api.delete(`/products/${id}`); return true; },
  async mine()                 { const { data } = await api.get('/products/mine'); return data.items.map(adaptProduct); },
  async myStats()              { const { data } = await api.get('/products/mine/stats'); return data.stats || {}; },
};

export const paymentApi = {
  /** Exact breakdown the buyer will be charged (per-seller plan fees). */
  async quote(items) {
    const { data } = await api.post('/payments/quote', { items });
    return data;
  },
  async initialize(payload) {
    const { data } = await api.post('/payments/initialize', payload);
    return data;
  },
  async verify(reference) {
    const { data } = await api.post('/payments/verify', { reference });
    return data;
  },
  async initializeOnboarding() {
    const { data } = await api.post('/payments/onboarding/initialize');
    return data;
  },
  async verifyOnboarding(reference) {
    const { data } = await api.post('/payments/onboarding/verify', { reference });
    return data;
  },
};

export const orderApi = {
  async checkout(payload)      {
    const { data } = await api.post('/orders/checkout', payload);
    return (data.orders || []).map((o) => adaptOrder(o));
  },
  async mine(currentUserId)    {
    const { data } = await api.get('/orders/mine');
    return data.orders.map((o) => adaptOrder(o, currentUserId));
  },
  async sales(currentUserId)   {
    const { data } = await api.get('/orders/sales');
    return data.orders.map((o) => adaptOrder(o, currentUserId));
  },
  async get(id, currentUserId) {
    const { data } = await api.get(`/orders/${id}`);
    return adaptOrder(data.order, currentUserId);
  },
  async setStatus(id, status)  {
    const { data } = await api.patch(`/orders/${id}/status`, { status });
    return adaptOrder(data.order);
  },
  async confirmReceipt(id)     {
    const { data } = await api.post(`/orders/${id}/confirm-receipt`);
    return adaptOrder(data.order);
  },
  async cancel(id, reason)     {
    const { data } = await api.post(`/orders/${id}/cancel`, { reason });
    return adaptOrder(data.order);
  },
};
