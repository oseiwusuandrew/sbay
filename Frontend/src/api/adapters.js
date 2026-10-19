/**
 * Adapters that translate backend documents into the shape the existing
 * React pages already expect.
 *
 * Why bother:
 *   - Pages were originally written against a flat mock shape with
 *     string ids (`t1`, `s1`), `image`, `sellerId`, `categoryId`, etc.
 *   - The backend returns Mongo documents with `_id`, populated nested
 *     `seller`, `images[]`, `category`, etc.
 *
 * Keeping the translation in one file means we can swap mock → real
 * data without changing every page.
 */

const placeholderImg =
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=70';

/** Map a Mongo Product to the frontend's flat product shape. */
export function adaptProduct(p) {
  if (!p) return null;
  const seller = typeof p.seller === 'object' && p.seller ? p.seller : null;
  const images = Array.isArray(p.images) && p.images.length ? p.images : [placeholderImg];
  return {
    id: p._id,
    _id: p._id,
    title: p.title,
    description: p.description || '',
    price: p.price,
    discountPrice: p.discountPrice,
    stock: p.stock ?? 0,
    condition: p.condition || '',
    tag: (p.condition || '').toUpperCase(),
    badge: p.badge,
    categoryId: p.category,
    category: p.category,
    school: p.school || seller?.sellerProfile?.location || '',
    city: p.city || '',
    campus: [p.school, p.city].filter(Boolean).join(' '),
    location: p.location || seller?.sellerProfile?.location || seller?.location || '',
    universityId: p.school?.toLowerCase?.() || 'other',
    image: images[0],
    images,
    sellerId: seller?._id || p.seller,
    sellerName: seller?.sellerProfile?.storeName || seller?.name,
    sellerVerified: seller?.verified,
    sellerAvatar: seller?.avatar,
    views: p.views,
    sold: p.sold,
    status: p.status,
    createdAt: p.createdAt,
  };
}

/** Map a Mongo User (seller) to the frontend seller card shape. */
export function adaptSeller(u) {
  if (!u) return null;
  const sp = u.sellerProfile || {};
  return {
    id: u._id,
    _id: u._id,
    name: sp.storeName || u.name,
    realName: u.name,
    email: u.email,
    role: u.role,
    avatar: u.avatar,
    bio: sp.bio || '',
    tagline: sp.bio || '',
    rating: sp.rating ?? 0,
    reviews: sp.reviewCount ?? 0,
    verified: !!u.verified,
    location: sp.location || u.location || '',
    university: sp.location || u.location || '',
    createdAt: u.createdAt,
    subscription: u.subscription,
    verification: u.verification,
  };
}

export function adaptUser(u) {
  if (!u) return null;
  return {
    id: u._id,
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatar: u.avatar,
    phone: u.phone,
    location: u.location,
    verified: !!u.verified,
    verification: u.verification,
    restricted: u.restricted,
    sellerProfile: u.sellerProfile,
    payout: u.payout,
    subscription: u.subscription,
    paymentMethods: u.paymentMethods || [],
    onboardingFeePaid: !!u.onboardingFeePaid,
    onboardingPaidAt: u.onboardingPaidAt,
    createdAt: u.createdAt,
  };
}

const STATUS_DESCRIPTION = {
  pending:    'Awaiting seller confirmation',
  processing: 'Seller is preparing your order',
  shipped:    'On the way to you',
  delivered:  'Marked delivered — confirm receipt to release payment',
  completed:  'Completed — payment released to seller',
  canceled:   'Order was canceled',
};

/** Map a Mongo Order document to the frontend's flat order shape. */
export function adaptOrder(o, currentUserId) {
  if (!o) return null;
  const buyer  = typeof o.buyer  === 'object' && o.buyer  ? o.buyer  : null;
  const seller = typeof o.seller === 'object' && o.seller ? o.seller : null;
  const firstItem = o.items?.[0];
  const isMine = currentUserId && (buyer?._id === currentUserId || o.buyer === currentUserId);
  const total = o.total ?? o.subtotal ?? (firstItem ? firstItem.price * firstItem.qty : 0);
  return {
    id: o.invoiceNumber || o._id,
    _id: o._id,
    invoiceNumber: o.invoiceNumber,
    buyerId:  isMine ? 'me' : (buyer?._id || o.buyer),
    sellerId: currentUserId && (seller?._id === currentUserId || o.seller === currentUserId)
              ? 'me' : (seller?._id || o.seller),
    buyerName:  buyer?.name  || 'Buyer',
    sellerName: seller?.sellerProfile?.storeName || seller?.name || 'Seller',
    buyerLocation: buyer?.location || '',
    title: firstItem?.title || 'Order',
    image: firstItem?.image || placeholderImg,
    price: firstItem?.price ?? total,
    qty:   firstItem?.qty   ?? 1,
    items: o.items || [],
    subtotal: o.subtotal,
    fee: o.fee,
    feePct: o.feePct,
    total,
    method: o.method || 'escrow',
    status: o.status,
    eta: STATUS_DESCRIPTION[o.status] || '',
    placedAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
    escrow: o.escrow,
    payment: o.payment,
    timeline: o.timeline,
    buyerConfirmedReceipt: o.buyerConfirmedReceipt,
    sellerConfirmedDelivery: o.sellerConfirmedDelivery,
    deliveryLocation: o.deliveryLocation,
  };
}

/** Map a Mongo Chat document to the frontend chat-list shape. */
export function adaptChat(c, currentUserRole) {
  if (!c) return null;
  const buyer  = typeof c.buyer  === 'object' && c.buyer  ? c.buyer  : null;
  const seller = typeof c.seller === 'object' && c.seller ? c.seller : null;
  // The API says which side the viewer is on; a seller can also be the
  // buyer in someone else's shop, so the account role isn't enough.
  const viewerRole = c.viewerRole || currentUserRole;
  const isSeller = viewerRole === 'seller';
  const other = isSeller ? buyer : seller;
  const firstOrder = Array.isArray(c.orders) && typeof c.orders[0] === 'object' ? c.orders[0] : null;
  return {
    id: c._id,
    _id: c._id,
    sellerId: seller?._id || c.seller,
    buyerId:  buyer?._id  || c.buyer,
    name: isSeller
      ? (buyer?.name || 'Buyer')
      : (seller?.sellerProfile?.storeName || seller?.name || 'Seller'),
    avatar: other?.avatar,
    buyerName: buyer?.name,
    buyerLocation: buyer?.location || '',
    productId: firstOrder?.items?.[0]?.product,
    productTitle: firstOrder?.items?.[0]?.title,
    productImage: firstOrder?.items?.[0]?.image,
    last: c.lastMessagePreview || '',
    time: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : '',
    unread: isSeller ? c.unreadBySeller : c.unreadByBuyer,
    closed: c.closed,
    orders: c.orders,
    viewerRole,
  };
}

/** Map a Mongo Message to a flat chat-message shape. */
export function adaptMessage(m, currentUserId) {
  if (!m) return null;
  const senderId = typeof m.sender === 'object' ? m.sender?._id : m.sender;
  return {
    id: m._id,
    from: senderId === currentUserId ? 'me' : 'them',
    text: m.text,
    time: m.createdAt
      ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
    senderId,
    readAt: m.readAt,
  };
}
