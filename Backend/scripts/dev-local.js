/**
 * Local sandbox: `npm run dev:local`
 *
 * Boots the real API against a throwaway in-memory MongoDB replica set
 * (orders use transactions, which need a replica set) and seeds it with
 * sample sellers, listings and accounts. Nothing persists between runs
 * and no real database or payment provider is touched.
 *
 * Seeded logins (password for all: sbay-dev-pass):
 *   buyer@sbay.test   — buyer with a completed + an in-flight order
 *   ama@sbay.test     — verified seller (Ama's Corner)
 *   kojo@sbay.test    — verified seller (Kojo Tech)
 *   admin@sbay.test   — admin (/admin)
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const PASSWORD = 'sbay-dev-pass';

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
const uri = replSet.getUri('sbay');

Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: process.env.PORT || '4000',
  MONGO_URI: uri,
  JWT_SECRET: 'local-dev-only-secret-not-for-production',
  CORS_ORIGINS: '',
  SEED_ADMIN_EMAIL: 'admin@sbay.test',
  SEED_ADMIN_PASSWORD: PASSWORD,
  SEED_ADMIN_NAME: 'sBay Admin',
  FRONTEND_URL: 'http://localhost:5173',
  PAYSTACK_CALLBACK_URL: 'http://localhost:5173/payment-success',
  ENABLE_MOCK_CHECKOUT: 'true',
});

const { connectDB } = await import('../src/config/db.js');
const { User } = await import('../src/models/User.js');
const { Product } = await import('../src/models/Product.js');
const { Order } = await import('../src/models/Order.js');
const { Chat } = await import('../src/models/Chat.js');
const { Message } = await import('../src/models/Message.js');
const { Review } = await import('../src/models/Review.js');
const { seedPlansIfNeeded } = await import('../src/seed/seedPlans.js');

await connectDB();
await seedPlansIfNeeded();

const img = (id) => `https://images.unsplash.com/${id}?w=900&q=70&auto=format&fit=crop`;
const hash = await User.hashPassword(PASSWORD);

const [ama, kojo, buyer] = await User.create([
  {
    name: 'Ama Owusu', email: 'ama@sbay.test', passwordHash: hash, role: 'seller',
    phone: '0244000001', location: 'Greater Accra, Legon', verified: true,
    verification: { status: 'verified', isStudent: true, university: 'University of Ghana', submittedAt: new Date() },
    sellerProfile: { storeName: "Ama's Corner", bio: 'Pre-loved textbooks, hall essentials and fashion. Pickup at Akuafo Hall.', location: 'Legon', rating: 4.8, reviewCount: 2 },
    payout: { method: 'mtn-momo', account: '0244000001', accountName: 'Ama Owusu' },
  },
  {
    name: 'Kojo Mensah', email: 'kojo@sbay.test', passwordHash: hash, role: 'seller',
    phone: '0244000002', location: 'Ashanti, Kumasi', verified: true,
    verification: { status: 'verified', isStudent: true, university: 'KNUST', submittedAt: new Date() },
    sellerProfile: { storeName: 'Kojo Tech', bio: 'Laptops, phones and accessories — all tested, 7-day returns.', location: 'KNUST', rating: 4.5, reviewCount: 1 },
    payout: { method: 'vodafone-cash', account: '0204000002', accountName: 'Kojo Mensah' },
  },
  {
    name: 'Esi Boateng', email: 'buyer@sbay.test', passwordHash: hash, role: 'buyer',
    phone: '0244000003', location: 'Greater Accra, East Legon',
  },
]);

const listings = [
  [ama, 'Introduction to Economics (Mankiw, 8th ed.)', 'Textbooks', 85, 140, 'Like New', 2, 'photo-1544947950-fa07a98d237f', 'University of Ghana'],
  [ama, 'Organic Chemistry study pack + past questions', 'Textbooks', 40, null, 'Slightly Used', 5, 'photo-1532012197267-da84d127e765', 'University of Ghana'],
  [ama, 'Kente-print tote bag', 'Fashion', 65, 90, 'Brand New', 8, 'photo-1590874103328-eac38a683ce7', 'University of Ghana'],
  [ama, 'Rechargeable desk lamp', 'Hall Essentials', 120, null, 'Like New', 3, 'photo-1507473885765-e6ed057f782c', 'University of Ghana'],
  [ama, 'Mini fridge (50L) — perfect for hall', 'Hall Essentials', 950, 1300, 'Slightly Used', 1, 'photo-1571175443880-49e1d25b2bc5', 'University of Ghana'],
  [ama, 'White sneakers, size 42', 'Fashion', 220, 350, 'Like New', 1, 'photo-1549298916-b41d501d3772', 'University of Ghana'],
  [kojo, 'MacBook Air M1, 8GB/256GB', 'Electronics', 7800, 9500, 'Like New', 1, 'photo-1517336714731-489689fd1ca8', 'KNUST'],
  [kojo, 'iPhone 12, 128GB, unlocked', 'Phones', 4200, null, 'Slightly Used', 2, 'photo-1591337676887-a217a6970a8a', 'KNUST'],
  [kojo, 'Noise-cancelling headphones', 'Electronics', 650, 900, 'Brand New', 4, 'photo-1505740420928-5e560c06d30e', 'KNUST'],
  [kojo, 'Scientific calculator (fx-991ES Plus)', 'Electronics', 180, null, 'Brand New', 10, 'photo-1564466809058-bf4114d55352', 'KNUST'],
  [kojo, '20,000mAh power bank', 'Electronics', 210, 280, 'Brand New', 6, 'photo-1609091839311-d5365f9ff1c5', 'KNUST'],
  [kojo, 'Mechanical keyboard (RGB)', 'Electronics', 480, null, 'Like New', 0, 'photo-1587829741301-dc798b83add3', 'KNUST'],
];

const products = await Product.create(listings.map(
  ([seller, title, category, price, compareAt, condition, stock, photo, school], i) => ({
    seller: seller._id,
    title,
    description: `${title}. ${condition} condition. Message me after ordering to arrange pickup or delivery on campus.`,
    category,
    price,
    discountPrice: compareAt || undefined,
    condition,
    stock,
    status: stock === 0 ? 'sold_out' : 'active',
    images: [img(photo)],
    school,
    city: school === 'KNUST' ? 'Kumasi' : 'Accra',
    location: school === 'KNUST' ? 'KNUST, Kumasi' : 'Legon, Accra',
    views: 40 + ((i * 37) % 260),
    createdAt: new Date(Date.now() - i * 5 * 3600e3),
  })
));

// One completed and one in-flight order for the buyer, with a chat.
const book = products[0];
const headphones = products[8];
const mkOrder = (seller, product, status, extra = {}) => ({
  buyer: buyer._id,
  seller: seller._id,
  items: [{ product: product._id, title: product.title, image: product.images[0], price: product.price, qty: 1, seller: seller._id }],
  subtotal: product.price,
  feePct: 5,
  fee: Math.round(product.price * 5) / 100,
  total: product.price + Math.round(product.price * 5) / 100,
  status,
  escrow: { status: status === 'completed' ? 'released' : 'held', heldAt: new Date() },
  payment: { provider: 'sbay-mock', transactionId: `SEED-${product._id}`, paidAt: new Date() },
  deliveryLocation: buyer.location,
  timeline: [{ at: new Date(), actor: buyer._id, kind: 'created', detail: 'Seeded order' }],
  ...extra,
});
const [done, inflight] = await Order.create([
  mkOrder(ama, book, 'completed', { buyerConfirmedReceipt: true, sellerConfirmedDelivery: true }),
  mkOrder(kojo, headphones, 'shipped'),
]);
await Review.create({ seller: ama._id, reviewer: buyer._id, order: done._id, rating: 5, text: 'Book was exactly as described and Ama met me at the library. Smooth!' });

const chat = await Chat.create({
  buyer: buyer._id, seller: kojo._id, orders: [inflight._id],
  lastMessageAt: new Date(), lastMessagePreview: 'On my way to Unity Hall now 🚶', unreadByBuyer: 1,
});
await Message.create([
  { chat: chat._id, sender: buyer._id, text: 'Hi Kojo! When can you drop the headphones?' },
  { chat: chat._id, sender: kojo._id, text: 'On my way to Unity Hall now 🚶' },
]);

console.log(`\n[dev-local] in-memory MongoDB ready (${uri})`);
console.log(`[dev-local] seeded ${products.length} listings · logins use password "${PASSWORD}"`);
console.log('[dev-local]   buyer@sbay.test · ama@sbay.test · kojo@sbay.test · admin@sbay.test\n');

// Boot the real server (it re-uses the mongoose connection above).
await import('../src/server.js');

const stop = async () => { await replSet.stop().catch(() => {}); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
