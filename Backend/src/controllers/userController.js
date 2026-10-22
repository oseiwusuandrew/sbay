import { User } from '../models/User.js';
import { Product, LIVE_LISTING } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { Review } from '../models/Review.js';
import { Chat } from '../models/Chat.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { emitToAdmins } from '../socket.js';

/** Update the current user's own profile. Role and restriction flags
 *  are NEVER editable here — those are admin-only. */
export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['name', 'avatar', 'phone', 'location'];
  const patch = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }

  if (req.user.role === 'seller') {
    if (req.body.sellerProfile) {
      patch.sellerProfile = {
        ...(req.user.sellerProfile?.toObject?.() || req.user.sellerProfile || {}),
        storeName: req.body.sellerProfile.storeName?.trim(),
        bio: req.body.sellerProfile.bio?.trim(),
        location: req.body.sellerProfile.location?.trim() || patch.location,
      };
    }
    if (req.body.payout) {
      const account = String(req.body.payout.account || '').replace(/\D/g, '');
      if (account.length < 9 || account.length > 15) {
        throw new HttpError(400, 'Enter a valid payout phone or account number.');
      }
      patch.payout = {
        method: req.body.payout.method || 'mtn-momo',
        account,
        accountName: req.body.payout.accountName?.trim() || req.user.name,
        network: req.body.payout.network?.trim(),
        updatedAt: new Date(),
      };
    }
  }

  const user = await User.findByIdAndUpdate(req.user._id, patch, { new: true, runValidators: true });
  res.json({ user });
});

/**
 * Apply to become a seller. Submission is queued for admin review —
 * the user is granted the `seller` role straight away (so they can
 * start setting up their store) but `verification.status` is set to
 * `pending`. Buyers see a "pending review" badge on the seller's
 * profile until an admin verifies them.
 */
export const becomeSeller = asyncHandler(async (req, res) => {
  const {
    storeName, bio, isStudent, university, occupation, businessReg, location, payout,
    idCardUrl, // base64 data URL — accepted for v1; replace with S3 in prod
  } = req.body;

  const user = await User.findById(req.user._id);
  if (user.role === 'admin') throw new HttpError(400, 'Admins cannot also be sellers');

  // If the seller claims student status, the ID card is mandatory so
  // the verification queue is meaningful. Reject early instead of
  // creating an un-actionable application row.
  if (isStudent && !idCardUrl) {
    throw new HttpError(400, 'Please attach a clear photo of your student ID.');
  }
  // Cap the inline image size to ~3 MB worth of base64 (≈ 4 MB of data URL)
  // so abusers can't blow up the user document.
  if (idCardUrl && typeof idCardUrl === 'string' && idCardUrl.length > 4_400_000) {
    throw new HttpError(413, 'Student ID image is too large. Please upload a smaller photo.');
  }

  user.role = 'seller';
  user.sellerProfile = {
    storeName: storeName?.trim(),
    bio: bio?.trim(),
    location: location?.trim(),
  };
  const payoutAccount = String(payout?.account || '').replace(/\D/g, '');
  if (payoutAccount.length < 9 || payoutAccount.length > 15) {
    throw new HttpError(400, 'Enter a valid payout phone or account number.');
  }
  user.payout = {
    method: payout?.method || 'mtn-momo',
    account: payoutAccount,
    accountName: payout?.accountName?.trim() || user.name,
    network: payout?.network?.trim(),
    updatedAt: new Date(),
  };
  user.verification = {
    status: 'pending',
    submittedAt: new Date(),
    isStudent: !!isStudent,
    university: university?.trim(),
    occupation: occupation?.trim(),
    businessReg: businessReg?.trim(),
    idCardUrl: isStudent ? idCardUrl : undefined,
    idCardUploadedAt: isStudent && idCardUrl ? new Date() : undefined,
  };
  user.verified = false;
  await user.save();

  // Notify all admins in real time so the verification queue refreshes.
  emitToAdmins('verification:new', {
    userId: user._id.toString(),
    name: user.name,
    storeName: user.sellerProfile?.storeName,
    isStudent: !!isStudent,
    message: `${user.name || user.email} submitted a seller application${isStudent ? ' with student ID' : ''}.`,
  });

  res.json({ user });
});

/** Public seller profile view (with a slice of their listings). */
export const getSellerById = asyncHandler(async (req, res) => {
  const seller = await User.findOne({ _id: req.params.id, role: 'seller', restricted: false });
  if (!seller) throw new HttpError(404, 'Seller not found');

  const [listings, reviewSummary] = await Promise.all([
    Product.find({ ...LIVE_LISTING, seller: seller._id })
      .sort({ createdAt: -1 })
      .limit(24),
    Review.aggregate([
      { $match: { seller: seller._id } },
      {
        $group: {
          _id: '$seller',
          rating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const summary = reviewSummary[0] || { rating: seller.sellerProfile?.rating || 0, reviewCount: seller.sellerProfile?.reviewCount || 0 };
  seller.sellerProfile = {
    ...(seller.sellerProfile?.toObject?.() || seller.sellerProfile || {}),
    rating: Number(summary.rating || 0),
    reviewCount: Number(summary.reviewCount || 0),
  };

  res.json({ seller, listings });
});

export const getSellerReviews = asyncHandler(async (req, res) => {
  const seller = await User.findOne({ _id: req.params.id, role: 'seller', restricted: false }).select('_id name avatar sellerProfile');
  if (!seller) throw new HttpError(404, 'Seller not found');

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const [items, total, summary, byStar] = await Promise.all([
    Review.find({ seller: seller._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reviewer', 'name avatar'),
    Review.countDocuments({ seller: seller._id }),
    Review.aggregate([
      { $match: { seller: seller._id } },
      {
        $group: {
          _id: '$seller',
          rating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]),
    Review.aggregate([
      { $match: { seller: seller._id } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  const stats = summary[0] || { rating: 0, reviewCount: 0 };
  // Count per star (5 → 1) for the rating breakdown bars.
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: byStar.find((b) => b._id === star)?.count || 0,
  }));
  res.json({
    seller: {
      _id: seller._id,
      name: seller.name,
      avatar: seller.avatar,
      sellerProfile: {
        ...(seller.sellerProfile?.toObject?.() || seller.sellerProfile || {}),
        rating: Number(stats.rating || 0),
        reviewCount: Number(stats.reviewCount || 0),
      },
    },
    items,
    page,
    limit,
    total,
    rating: Number(stats.rating || 0),
    distribution,
  });
});

export const createReview = asyncHandler(async (req, res) => {
  const seller = await User.findOne({ _id: req.params.id, role: 'seller', restricted: false });
  if (!seller) throw new HttpError(404, 'Seller not found');

  const rating = Number(req.body.rating);
  const text = String(req.body.text || '').trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, 'Rating must be between 1 and 5');
  }
  if (!text) {
    throw new HttpError(400, 'Review text is required');
  }

  const eligibleOrder = await Order.findOne({
    buyer: req.user._id,
    seller: seller._id,
    status: { $in: ['delivered', 'completed'] },
  }).sort({ updatedAt: -1 });

  if (!eligibleOrder) {
    throw new HttpError(403, 'You can only review a seller after a completed order');
  }

  let review = await Review.findOne({
    seller: seller._id,
    reviewer: req.user._id,
  });

  const wasExisting = !!review;
  if (review) {
    review.rating = rating;
    review.text = text;
    review.order = eligibleOrder._id;
    await review.save();
  } else {
    review = await Review.create({
      seller: seller._id,
      reviewer: req.user._id,
      order: eligibleOrder._id,
      rating,
      text,
    });
  }

  const aggregate = await Review.aggregate([
    { $match: { seller: seller._id } },
    {
      $group: {
        _id: '$seller',
        rating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);
  const stats = aggregate[0] || { rating: 0, reviewCount: 0 };

  seller.sellerProfile = {
    ...(seller.sellerProfile?.toObject?.() || seller.sellerProfile || {}),
    rating: Number(stats.rating || 0),
    reviewCount: Number(stats.reviewCount || 0),
  };
  await seller.save();

  await review.populate('reviewer', 'name avatar');

  res.status(wasExisting ? 200 : 201).json({
    review,
    rating: Number(stats.rating || 0),
    reviewCount: Number(stats.reviewCount || 0),
  });
});

export const myNotifications = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 14 * 24 * 3600e3);
  const uid = req.user._id;
  const isSeller = req.user.role === 'seller';

  const [orders, chats] = await Promise.all([
    Order.find(isSeller ? { seller: uid, createdAt: { $gte: since } } : { buyer: uid, updatedAt: { $gte: since } })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate('buyer', 'name')
      .populate('seller', 'name sellerProfile'),
    Chat.find(isSeller ? { seller: uid } : { buyer: uid })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(20)
      .populate('buyer', 'name')
      .populate('seller', 'name sellerProfile'),
  ]);

  const items = [];
  for (const o of orders) {
    items.push({
      id: `order-${o._id}-${new Date(o.updatedAt || o.createdAt).getTime()}`,
      type: 'order',
      title: isSeller ? 'New order activity' : 'Order update',
      body: isSeller
        ? `${o.buyer?.name || 'A buyer'} placed or updated ${o.invoiceNumber}.`
        : `${o.invoiceNumber} is now ${o.status}.`,
      href: isSeller ? '/seller-dashboard/sales' : '/profile/orders',
      at: o.updatedAt || o.createdAt,
    });
  }

  for (const c of chats) {
    const unread = isSeller ? c.unreadBySeller : c.unreadByBuyer;
    if (!unread) continue;
    const other = isSeller ? c.buyer?.name : (c.seller?.sellerProfile?.storeName || c.seller?.name);
    items.push({
      id: `chat-${c._id}-${new Date(c.lastMessageAt || c.updatedAt).getTime()}`,
      type: 'message',
      title: 'New message',
      body: `${other || 'Someone'} sent you a message.`,
      href: `/chat/${c._id}`,
      at: c.lastMessageAt || c.updatedAt,
    });
  }

  if (isSeller && req.user.verification?.status && req.user.verification.status !== 'verified') {
    items.push({
      id: `verification-${req.user.verification.status}`,
      type: 'verification',
      title: 'Seller verification',
      body: req.user.verification.status === 'pending'
        ? 'Your seller verification is still under review.'
        : 'Your seller verification needs attention.',
      href: '/seller-dashboard',
      at: req.user.verification.reviewedAt || req.user.verification.submittedAt || req.user.updatedAt,
    });
  }

  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({ items: items.slice(0, 30) });
});

/** Add a saved payment method (mock, no PCI data). */
export const addPaymentMethod = asyncHandler(async (req, res) => {
  const { brand, last4, holder, expiry, method } = req.body;
  const user = await User.findById(req.user._id);
  user.paymentMethods.push({ brand, last4, holder, expiry, method });
  await user.save();
  res.status(201).json({ user });
});

export const removePaymentMethod = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.paymentMethods.id(req.params.cardId)?.deleteOne();
  await user.save();
  res.json({ user });
});

/**
 * DELETE /api/users/me — self-delete account.
 * Sellers can only delete if they have no pending/processing orders.
 * Anonymises PII, hides listings, keeps data for audit trail.
 */
export const deleteMyAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new HttpError(404, 'Account not found');

  if (user.role === 'seller') {
    const pendingOrders = await Order.countDocuments({
      seller: user._id,
      status: { $in: ['pending', 'processing', 'shipped'] },
    });
    if (pendingOrders > 0) {
      throw new HttpError(409, `You have ${pendingOrders} pending order(s). Complete or cancel them before deleting your account.`);
    }
    await Product.updateMany(
      { seller: user._id, status: { $ne: 'removed' } },
      { $set: { status: 'removed', removedReason: 'Account deleted by owner' } },
    );
  }

  user.name = 'Deleted User';
  user.email = `deleted_${user._id}@sbay.local`;
  user.phone = '';
  user.avatar = '';
  user.location = '';
  user.restricted = true;
  user.restrictReason = 'Self-deleted';
  user.restrictedAt = new Date();
  user.paymentMethods = [];
  if (user.sellerProfile) {
    user.sellerProfile.storeName = 'Deleted Store';
    user.sellerProfile.bio = '';
  }
  if (user.payout) {
    user.payout.account = '';
    user.payout.accountName = '';
  }
  await user.save();

  res.json({ ok: true, message: 'Your account has been deleted.' });
});
