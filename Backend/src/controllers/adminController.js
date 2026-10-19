function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { Plan } from '../models/Plan.js';
import { Settings } from '../models/Settings.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { AuditLog } from '../models/AuditLog.js';
import { signAccessToken } from '../utils/jwt.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { audit } from '../utils/audit.js';
import { restoreStock } from './orderController.js';
import { invalidateCatalogCache } from './productController.js';

/* ----------------------- Admin Auth ----------------------- */

/**
 * POST {adminPrefix}/auth/login
 *
 * Same credential mechanism as the regular login, but ONLY admin
 * accounts succeed here. Non-admins receive the same vague 401 to
 * avoid leaking the existence of regular accounts via this endpoint.
 */
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || user.role !== 'admin') throw new HttpError(401, 'Invalid credentials');

  const ok = await user.checkPassword(password);
  if (!ok) throw new HttpError(401, 'Invalid credentials');
  if (user.restricted) throw new HttpError(403, 'Account is restricted');

  user.lastLoginAt = new Date();
  await user.save();

  const token = signAccessToken(user);
  audit(req, 'admin.login', { kind: 'user', id: user._id });
  res.json({ token, user });
});

/* ----------------------- Dashboard ------------------------ */

export const dashboard = asyncHandler(async (_req, res) => {
  const [
    userCount, buyerCount, sellerCount, adminCount,
    productCount, activeProductCount,
    orderCount, completedOrders,
    revenueAgg, escrowAgg, salesByDayAgg,
    pendingVerifications, restrictedCount,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'buyer' }),
    User.countDocuments({ role: 'seller' }),
    User.countDocuments({ role: 'admin' }),
    Product.countDocuments({ status: { $ne: 'removed' } }),
    Product.countDocuments({ status: 'active' }),
    Order.countDocuments({}),
    Order.countDocuments({ status: 'completed' }),
    Order.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, revenue: { $sum: '$total' }, fees: { $sum: '$fee' } } },
    ]),
    Order.aggregate([
      { $match: { 'escrow.status': 'held' } },
      { $group: { _id: null, held: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 3600e3) } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        orders: { $sum: 1 },
        gmv: { $sum: '$total' },
      } },
      { $sort: { _id: 1 } },
    ]),
    User.countDocuments({ 'verification.status': 'pending' }),
    User.countDocuments({ restricted: true }),
  ]);

  res.json({
    users: { total: userCount, buyers: buyerCount, sellers: sellerCount, admins: adminCount, restricted: restrictedCount },
    products: { total: productCount, active: activeProductCount },
    orders: { total: orderCount, completed: completedOrders },
    revenue: revenueAgg[0] || { revenue: 0, fees: 0 },
    escrow: escrowAgg[0] || { held: 0, count: 0 },
    salesByDay: salesByDayAgg,
    pendingVerifications,
  });
});

/* ----------------------- Users ------------------------ */

export const listUsers = asyncHandler(async (req, res) => {
  const { q, role, restricted, verified, page = 1, limit = 30, sort = 'recent' } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (restricted === 'true') filter.restricted = true;
  if (restricted === 'false') filter.restricted = false;
  if (verified === 'true') filter.verified = true;
  if (verified === 'false') filter.verified = false;
  if (q) {
    const escaped = escapeRegex(q);
    filter.$or = [
      { name:  { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }
  const lim = Math.min(Number(limit) || 30, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
  const sortMap = { recent: { createdAt: -1 }, oldest: { createdAt: 1 }, name: { name: 1 } };

  const [items, total] = await Promise.all([
    User.find(filter).sort(sortMap[sort] || sortMap.recent).skip(skip).limit(lim),
    User.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), limit: lim });
});

export const getUserDetail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');

  const [listings, orders, sales] = await Promise.all([
    Product.find({ seller: user._id }).sort({ createdAt: -1 }).limit(50),
    Order.find({ buyer: user._id }).sort({ createdAt: -1 }).limit(50),
    Order.find({ seller: user._id }).sort({ createdAt: -1 }).limit(50),
  ]);

  res.json({ user, listings, orders, sales });
});

export const verifyUser = asyncHandler(async (req, res) => {
  const { decision, reason } = req.body; // 'approved' | 'rejected'
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');

  if (decision === 'approved') {
    user.verified = true;
    user.verification.status = 'verified';
  } else if (decision === 'rejected') {
    user.verified = false;
    user.verification.status = 'rejected';
    user.verification.reason = reason;
  } else {
    throw new HttpError(400, 'decision must be "approved" or "rejected"');
  }
  user.verification.reviewedAt = new Date();
  user.verification.reviewedBy = req.user._id;
  await user.save();

  audit(req, 'user.verify', { kind: 'user', id: user._id }, { decision, reason });
  res.json({ user });
});

export const restrictUser = asyncHandler(async (req, res) => {
  const { restricted, reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (user.role === 'admin' && user._id.toString() === req.user._id.toString()) {
    throw new HttpError(400, 'You cannot restrict your own admin account.');
  }
  user.restricted = !!restricted;
  user.restrictReason = restricted ? (reason || 'Restricted by admin') : undefined;
  user.restrictedAt = restricted ? new Date() : undefined;
  user.restrictedBy = restricted ? req.user._id : undefined;
  await user.save();

  audit(req, restricted ? 'user.restrict' : 'user.unrestrict', { kind: 'user', id: user._id }, { reason });
  res.json({ user });
});

/* ----------------------- Admin Management ------------------------ */

export const listAdmins = asyncHandler(async (_req, res) => {
  const admins = await User.find({ role: 'admin' }).sort({ createdAt: 1 });
  res.json({ admins });
});

export const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const lowerEmail = email.toLowerCase();
  const existing = await User.findOne({ email: lowerEmail });

  // Elevate-existing mode: only email is supplied. The user must already
  // exist on the platform — admins are intentionally never created from
  // thin air without a verified email/password trail.
  if (existing) {
    if (existing.role === 'admin') throw new HttpError(409, 'User is already an admin');
    if (existing.restricted)       throw new HttpError(400, 'Cannot elevate a restricted user');
    existing.role = 'admin';
    existing.verified = true;
    await existing.save();
    audit(req, 'admin.elevate', { kind: 'user', id: existing._id });
    return res.status(200).json({ admin: existing });
  }

  // Create-fresh mode: full name + password required.
  if (!name || !password) {
    throw new HttpError(404, 'No user with that email. Provide name + password to create a fresh admin account.');
  }
  const passwordHash = await User.hashPassword(password);
  const admin = await User.create({
    name, email: lowerEmail, passwordHash, role: 'admin', verified: true,
  });
  audit(req, 'admin.create', { kind: 'user', id: admin._id });
  res.status(201).json({ admin });
});

/* ----------------------- User Deletion ------------------------ */

/**
 * DELETE /users/:id — soft-delete an account.
 *
 * We never hard-delete because every order, listing, and audit row
 * references this _id. Instead we anonymise PII, mark the account
 * deleted, and prevent further logins. The user's transactional
 * history is preserved for compliance / dispute resolution.
 */
export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    throw new HttpError(400, 'You cannot delete your own account from this surface.');
  }
  const target = await User.findById(req.params.id);
  if (!target) throw new HttpError(404, 'User not found');

  // Refuse to delete the last admin so the platform never locks itself out.
  if (target.role === 'admin') {
    const remaining = await User.countDocuments({ role: 'admin', _id: { $ne: target._id } });
    if (remaining < 1) throw new HttpError(400, 'Cannot delete the last admin.');
  }

  // The cascade below wipes orders on BOTH sides. If money is still held
  // in escrow for any of them, deleting would destroy the only record of
  // who is owed what — the other party would lose their purchase/payout.
  const heldOrders = await Order.countDocuments({
    $or: [{ buyer: target._id }, { seller: target._id }],
    'escrow.status': 'held',
  });
  if (heldOrders > 0) {
    throw new HttpError(409, `This user has ${heldOrders} order(s) with funds still in escrow. Release or refund them first.`);
  }

  // CASCADE DELETE: remove everything belonging to this user
  // 1. Delete all their products (hard delete)
  await Product.deleteMany({ seller: target._id });

  // 2. Delete all orders where they are buyer or seller
  await Order.deleteMany({ $or: [{ buyer: target._id }, { seller: target._id }] });

  // 3. Delete all chats and messages involving them
  const chats = await Chat.find({ $or: [{ buyer: target._id }, { seller: target._id }] }).select('_id');
  const chatIds = chats.map((c) => c._id);
  if (chatIds.length > 0) {
    await Message.deleteMany({ chat: { $in: chatIds } });
    await Chat.deleteMany({ _id: { $in: chatIds } });
  }

  // 4. Delete the user document itself
  await User.deleteOne({ _id: target._id });

  audit(req, 'user.delete', { kind: 'user', id: target._id, email: target.email, role: target.role });
  res.json({ ok: true, message: `User ${target.email} and all associated data permanently deleted.` });
});

/* ----------------------- Student Verification Queue ------------------------ */

/**
 * GET /verification/students — list users who claim student status,
 * along with their submitted ID image (if any). Defaults to the
 * pending queue so the admin's first hit is always actionable.
 */
export const listStudentVerifications = asyncHandler(async (req, res) => {
  const { status = 'pending' } = req.query;
  const filter = {
    'verification.isStudent': true,
    'verification.idCardUrl': { $exists: true, $ne: null },
  };
  if (status) filter['verification.status'] = status;

  const users = await User.find(filter).sort({ 'verification.submittedAt': -1, createdAt: -1 }).limit(200);
  // Flatten to a verification-centric shape for the admin UI.
  const items = users.map((u) => ({
    _id: u._id,
    user: { _id: u._id, name: u.name, email: u.email },
    name: u.name,
    email: u.email,
    university: u.verification?.university,
    idCardUrl: u.verification?.idCardUrl,
    submittedAt: u.verification?.submittedAt,
    status: u.verification?.status || 'pending',
  }));
  res.json({ items });
});

/**
 * POST /verification/students/:id/decide — same shape as verifyUser
 * but additionally clears the ID image on rejection (so a rejected
 * applicant can re-submit a corrected card) and emits a more
 * specific audit row.
 */
export const decideStudentVerification = asyncHandler(async (req, res) => {
  const { decision, reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (!user.verification?.isStudent) throw new HttpError(400, 'User has not submitted a student application');

  if (decision === 'approved') {
    user.verified = true;
    user.verification.status = 'verified';
  } else if (decision === 'rejected') {
    user.verified = false;
    user.verification.status = 'rejected';
    user.verification.reason = reason;
    user.verification.idCardUrl = undefined; // allow re-upload
  } else {
    throw new HttpError(400, 'decision must be "approved" or "rejected"');
  }
  user.verification.reviewedAt = new Date();
  user.verification.reviewedBy = req.user._id;
  await user.save();

  audit(req, 'verification.student.decide', { kind: 'user', id: user._id }, { decision, reason });
  res.json({ user });
});

/* ----------------------- Notifications ------------------------ */

/**
 * GET /notifications — lightweight aggregator that surfaces actionable
 * items for the bell popover. Phase 1 derives notifications from the
 * existing data model (pending verifications, held escrow, new orders);
 * Phase 3 will replace it with a Socket.IO subscription that pushes
 * deltas in real time. Both shapes return the same JSON contract so
 * the UI doesn't change.
 */
export const listNotifications = asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 24 * 3600e3);
  const [pendingUsers, recentOrders, recentChats] = await Promise.all([
    User.find({
      'verification.status': 'pending',
      'verification.submittedAt': { $exists: true },
    }).sort({ 'verification.submittedAt': -1 }).limit(10),
    Order.find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 }).limit(10)
      .populate('buyer', 'name email'),
    Chat.find({ updatedAt: { $gte: since } })
      .sort({ updatedAt: -1 }).limit(5)
      .populate('buyer', 'name'),
  ]);

  const items = [];
  for (const u of pendingUsers) {
    items.push({
      id: `verif-${u._id}`,
      kind: u.verification?.isStudent ? 'verification' : 'verification',
      message: `${u.name} submitted a ${u.verification?.isStudent ? 'student ID' : 'seller'} application`,
      href:    u.verification?.isStudent ? '/admin/verification/students' : '/admin/verification/sellers',
      at:      u.verification?.submittedAt || u.createdAt,
    });
  }
  for (const o of recentOrders) {
    items.push({
      id: `order-${o._id}`,
      kind: 'order',
      message: `New order ${o.invoiceNumber || ''} from ${o.buyer?.name || 'a buyer'} — GH₵ ${Math.round(o.total)}`,
      href: '/admin/orders',
      at:   o.createdAt,
    });
  }
  for (const c of recentChats) {
    items.push({
      id: `chat-${c._id}-${new Date(c.updatedAt).getTime()}`,
      kind: 'chat',
      message: `Chat activity with ${c.buyer?.name || 'a buyer'}`,
      href: `/admin/chats?id=${c._id}`,
      at:   c.updatedAt,
    });
  }
  // Newest first, capped.
  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({ items: items.slice(0, 25) });
});

export const removeAdmin = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    throw new HttpError(400, 'You cannot remove yourself.');
  }
  const remainingAdmins = await User.countDocuments({ role: 'admin' });
  if (remainingAdmins <= 1) throw new HttpError(400, 'Cannot remove the last remaining admin.');

  const target = await User.findOne({ _id: req.params.id, role: 'admin' });
  if (!target) throw new HttpError(404, 'Admin not found');

  // We demote rather than delete — preserves audit history.
  target.role = 'buyer';
  await target.save();
  audit(req, 'admin.remove', { kind: 'user', id: target._id });
  res.json({ ok: true });
});

/* ----------------------- Products ------------------------ */

export const listAllProducts = asyncHandler(async (req, res) => {
  const { status, q, sellerId, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (sellerId) filter.seller = sellerId;
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };
  const lim = Math.min(Number(limit) || 30, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).populate('seller', 'name email'),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total });
});

export const moderateProduct = asyncHandler(async (req, res) => {
  const { action, reason } = req.body; // 'hide' | 'unhide' | 'remove'
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  if (action === 'hide')   product.status = 'hidden';
  else if (action === 'unhide') product.status = product.stock > 0 ? 'active' : 'sold_out';
  else if (action === 'remove') { product.status = 'removed'; product.removedReason = reason; product.removedBy = req.user._id; }
  else throw new HttpError(400, 'Invalid action');
  await product.save();
  invalidateCatalogCache(); // otherwise a hidden listing lingers on the home feed
  audit(req, `product.${action}`, { kind: 'product', id: product._id }, { reason });
  res.json({ product });
});

/* ----------------------- Orders & Escrow ------------------------ */

export const listAllOrders = asyncHandler(async (req, res) => {
  const { status, escrowStatus, q, sellerId, buyerId, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (escrowStatus) filter['escrow.status'] = escrowStatus;
  if (sellerId) filter.seller = sellerId;
  if (buyerId)  filter.buyer  = buyerId;
  if (q) filter.invoiceNumber = { $regex: escapeRegex(q), $options: 'i' };
  const lim = Math.min(Number(limit) || 30, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 }).skip(skip).limit(lim)
      .populate('buyer', 'name email location')
      .populate('seller', 'name email')
      .populate('items.product', 'title images price category'),
    Order.countDocuments(filter),
  ]);
  res.json({ items, total });
});

// Escrow transitions are compare-and-set on `escrow.status: 'held'` so two
// admins (or an admin and the buyer) can't release and refund the same order.
export const releaseEscrow = asyncHandler(async (req, res) => {
  const o = await Order.findOneAndUpdate(
    { _id: req.params.id, 'escrow.status': 'held' },
    {
      $set: {
        'escrow.status': 'released',
        'escrow.releasedAt': new Date(),
        'escrow.releasedBy': req.user._id,
        status: 'completed',
      },
      $push: { timeline: { at: new Date(), actor: req.user._id, kind: 'escrow', detail: 'Escrow released by admin' } },
    },
    { new: true }
  );
  if (!o) {
    if (!(await Order.exists({ _id: req.params.id }))) throw new HttpError(404, 'Order not found');
    throw new HttpError(409, 'Escrow is not in a held state');
  }
  audit(req, 'escrow.release', { kind: 'order', id: o._id });
  res.json({ order: o });
});

export const refundEscrow = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const o = await Order.findOneAndUpdate(
    { _id: req.params.id, 'escrow.status': 'held' },
    {
      $set: {
        'escrow.status': 'refunded',
        'escrow.refundedAt': new Date(),
        'escrow.refundedBy': req.user._id,
        'escrow.reason': reason,
        status: 'canceled',
      },
      $push: { timeline: { at: new Date(), actor: req.user._id, kind: 'escrow', detail: `Escrow refunded by admin: ${reason}` } },
    },
    { new: true }
  );
  if (!o) {
    if (!(await Order.exists({ _id: req.params.id }))) throw new HttpError(404, 'Order not found');
    throw new HttpError(409, 'Escrow is not in a held state');
  }
  for (const it of o.items) {
    await restoreStock(it.product, it.qty);
  }
  invalidateCatalogCache();
  audit(req, 'escrow.refund', { kind: 'order', id: o._id }, { reason });
  res.json({ order: o });
});

/* ----------------------- Plans (subscription pricing) ------------------------ */

export const listAllPlans = asyncHandler(async (_req, res) => {
  const plans = await Plan.find({}).sort({ sortOrder: 1, price: 1 });
  res.json({ plans });
});

export const upsertPlan = asyncHandler(async (req, res) => {
  const { code, name, tag, price, feePct, features, highlight, active, sortOrder } = req.body;
  const plan = await Plan.findOneAndUpdate(
    { code: code.toLowerCase() },
    { code: code.toLowerCase(), name, tag, price, feePct, features, highlight, active, sortOrder },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  audit(req, 'plan.upsert', { kind: 'plan', id: plan._id }, { code, price, feePct });
  res.json({ plan });
});

export const deletePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findByIdAndDelete(req.params.id);
  if (!plan) throw new HttpError(404, 'Plan not found');
  audit(req, 'plan.delete', { kind: 'plan', id: plan._id });
  res.json({ ok: true });
});

/* ----------------------- Settings ------------------------ */

export const getSettings = asyncHandler(async (_req, res) => {
  const settings = await Settings.getSingleton();
  res.json({ settings });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const allowed = ['platformName', 'defaultEscrowFeePct', 'sellerOnboardingFee', 'supportEmail', 'announcement', 'maintenanceMode'];
  const settings = await Settings.getSingleton();
  for (const k of allowed) {
    if (req.body[k] !== undefined) settings[k] = req.body[k];
  }
  await settings.save();
  audit(req, 'settings.update', { kind: 'settings' }, req.body);
  res.json({ settings });
});

/* ----------------------- Audit log ------------------------ */

export const listAuditLog = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, action } = req.query;
  const filter = {};
  if (action) filter.action = action;
  const lim = Math.min(Number(limit) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).populate('actor', 'name email'),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ items, total });
});

/* ----------------------- Reports ------------------------ */

export const salesReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const match = { status: 'completed' };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to)   match.createdAt.$lte = new Date(to);
  }
  const [byDay, bySeller, byCategory] = await Promise.all([
    Order.aggregate([
      { $match: match },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          gmv: { $sum: '$total' }, fees: { $sum: '$fee' }, orders: { $sum: 1 },
        } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: match },
      { $group: { _id: '$seller', gmv: { $sum: '$total' }, orders: { $sum: 1 } } },
      { $sort: { gmv: -1 } }, { $limit: 20 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'seller' } },
      { $unwind: '$seller' },
      { $project: { gmv: 1, orders: 1, sellerName: '$seller.name', sellerEmail: '$seller.email' } },
    ]),
    Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } },
      { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$p.category', gmv: { $sum: { $multiply: ['$items.price', '$items.qty'] } }, units: { $sum: '$items.qty' } } },
      { $sort: { gmv: -1 } },
    ]),
  ]);
  res.json({ byDay, bySeller, byCategory });
});

/* ----------------------- Chat moderation ------------------------ */

export const listAllChats = asyncHandler(async (req, res) => {
  const { closed, sellerId, buyerId, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (closed === 'true') filter.closed = true;
  if (closed === 'false') filter.closed = false;
  if (sellerId) filter.seller = sellerId;
  if (buyerId)  filter.buyer  = buyerId;
  const lim = Math.min(Number(limit) || 30, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
  const [items, total] = await Promise.all([
    Chat.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(lim)
      .populate('buyer', 'name email').populate('seller', 'name email'),
    Chat.countDocuments(filter),
  ]);
  res.json({ items, total });
});

export const getAdminChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id)
    .populate('buyer', 'name email').populate('seller', 'name email')
    .populate('orders');
  if (!chat) throw new HttpError(404, 'Chat not found');
  const messages = await Message.find({ chat: chat._id }).sort({ createdAt: 1 }).populate('sender', 'name role');
  res.json({ chat, messages });
});

export const closeChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  if (!chat) throw new HttpError(404, 'Chat not found');
  chat.closed = true;
  chat.closedAt = new Date();
  chat.closedReason = req.body?.reason || 'Closed by admin';
  await chat.save();
  audit(req, 'chat.close', { kind: 'chat', id: chat._id });
  res.json({ chat });
});
