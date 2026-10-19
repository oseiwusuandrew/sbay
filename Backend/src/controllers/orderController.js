import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Chat } from '../models/Chat.js';
import { reserveStock, restoreStock } from '../utils/stock.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { emitToUser } from '../socket.js';
import { sendOrderStatusEmail, sendSMS } from '../utils/email.js';
import { quoteCart } from '../utils/pricing.js';
import { notifyNewOrders, ghs } from '../utils/orderNotify.js';
import { env, isProd } from '../config/env.js';


// Sellers move an order forward through these steps, never backwards.
const SELLER_FLOW = ['pending', 'processing', 'shipped', 'delivered'];

function pushTimeline(order, actor, kind, detail) {
  order.timeline.push({ at: new Date(), actor, kind, detail });
}

/**
 * POST /api/orders/checkout — DEVELOPMENT ONLY.
 *
 * Creates paid, escrow-held orders without taking any money. The real
 * flow is /api/payments/initialize → Paystack → /api/payments/verify.
 * Left reachable in production, this let any signed-in user "buy"
 * anything for free, so it now only works outside production and only
 * when ENABLE_MOCK_CHECKOUT=true.
 */
export const checkout = asyncHandler(async (req, res) => {
  if (isProd || !env.ENABLE_MOCK_CHECKOUT) {
    throw new HttpError(404, 'Route not found');
  }

  const { items, payment } = req.body;
  const session = await mongoose.startSession();
  let orders = [];

  try {
    await session.withTransaction(async () => {
      orders = [];
      const quote = await quoteCart(items, req.user._id, { session });

      for (const group of quote.groups) {
        for (const { product, qty } of group.lines) {
          const updated = await reserveStock(product._id, qty, session);
          if (!updated) throw new HttpError(409, `Sorry — "${product.title}" just sold out.`);
        }

        const [order] = await Order.create([{
          buyer: req.user._id,
          seller: group.sellerId,
          items: group.lines.map(({ product, qty }) => ({
            product: product._id,
            title: product.title,
            image: product.images?.[0],
            price: product.price,
            qty,
            seller: product.seller,
          })),
          subtotal: group.subtotal,
          feePct: group.feePct,
          fee: group.fee,
          total: group.total,
          method: 'escrow',
          status: 'pending',
          escrow: { status: 'held', heldAt: new Date() },
          payment: {
            provider: 'sbay-mock',
            transactionId: `MOCK-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            cardBrand: payment?.brand,
            cardLast4: payment?.last4,
            paidAt: new Date(),
          },
          deliveryLocation: req.body.deliveryLocation || req.user.location,
          timeline: [{
            at: new Date(),
            actor: req.user._id,
            kind: 'created',
            detail: 'Order placed (mock payment); funds held in escrow.',
          }],
        }], { session });

        await Chat.findOneAndUpdate(
          { buyer: req.user._id, seller: group.sellerId },
          {
            $setOnInsert: { buyer: req.user._id, seller: group.sellerId },
            $set: { closed: false, closedAt: null, closedReason: null },
            $addToSet: { orders: order._id },
          },
          { upsert: true, new: true, session }
        );

        orders.push(order);
      }
    });
  } finally {
    session.endSession();
  }

  notifyNewOrders(orders).catch((e) => console.error('[orders] notify failed', e));
  res.status(201).json({ orders });
});

/** GET /api/orders/mine — buyer's own orders. */
export const myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ buyer: req.user._id })
    .sort({ createdAt: -1 })
    .populate('seller', 'name avatar sellerProfile');
  res.json({ orders });
});

/** GET /api/orders/sales — seller's incoming orders. */
export const mySales = asyncHandler(async (req, res) => {
  const orders = await Order.find({ seller: req.user._id })
    .sort({ createdAt: -1 })
    .populate('buyer', 'name avatar location phone');
  res.json({ orders });
});

/** GET /api/orders/:id — only buyer, seller, or admin may view. */
export const getOrder = asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id)
    .populate('buyer', 'name avatar location email')
    .populate('seller', 'name avatar sellerProfile email');
  if (!o) throw new HttpError(404, 'Order not found');
  const uid = req.user._id.toString();
  const allowed = (
    o.buyer?._id?.toString() === uid ||
    o.seller?._id?.toString() === uid ||
    req.user.role === 'admin'
  );
  if (!allowed) throw new HttpError(403, 'Forbidden');
  res.json({ order: o });
});

const STATUS_SMS = {
  processing: 'Your order is being prepared',
  shipped: 'Your order is on its way',
  delivered: 'Your order has been delivered! Please confirm receipt on sBay',
};

/**
 * PATCH /api/orders/:id/status — seller-driven status transitions.
 * Mark-delivered also flips `sellerConfirmedDelivery`.
 */
export const updateStatusBySeller = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const o = await Order.findById(req.params.id);
  if (!o) throw new HttpError(404, 'Order not found');
  if (o.seller.toString() !== req.user._id.toString()) {
    throw new HttpError(403, 'Only the seller can change this order');
  }
  if (['completed', 'canceled'].includes(o.status) || o.escrow?.status !== 'held') {
    throw new HttpError(409, 'Order is already finalised');
  }
  const from = SELLER_FLOW.indexOf(o.status);
  const to = SELLER_FLOW.indexOf(status);
  if (to < 1) {
    throw new HttpError(400, `Sellers may only set: ${SELLER_FLOW.slice(1).join(', ')}`);
  }
  if (to <= from) {
    throw new HttpError(409, `This order is already ${o.status}.`);
  }

  o.status = status;
  if (status === 'delivered') o.sellerConfirmedDelivery = true;
  pushTimeline(o, req.user._id, 'status', `Seller set status to ${status}`);
  await o.save();
  await maybeCloseChat(o);
  emitToUser(o.buyer.toString(), 'order:updated', { orderId: o._id, status: o.status, href: '/profile/orders' });

  const buyerUser = await User.findById(o.buyer);
  if (buyerUser) {
    await sendOrderStatusEmail(buyerUser, o, status).catch((err) =>
      console.error('Failed to send order status email:', err));
    if (buyerUser.phone) {
      await sendSMS(buyerUser.phone, `Order ${o.invoiceNumber}: ${STATUS_SMS[status]}`)
        .catch((err) => console.error('Failed to send SMS:', err));
    }
  }

  res.json({ order: o });
});

/**
 * POST /api/orders/:id/confirm-receipt — buyer confirms.
 * Releases escrow and marks order completed.
 */
export const buyerConfirmReceipt = asyncHandler(async (req, res) => {
  // Atomic flip so a double-tap can't release twice or race a cancel.
  const o = await Order.findOneAndUpdate(
    {
      _id: req.params.id,
      buyer: req.user._id,
      'escrow.status': 'held',
      status: { $nin: ['completed', 'canceled'] },
    },
    {
      $set: {
        buyerConfirmedReceipt: true,
        status: 'completed',
        'escrow.status': 'released',
        'escrow.releasedAt': new Date(),
        'escrow.releasedBy': req.user._id,
      },
      $push: {
        timeline: { at: new Date(), actor: req.user._id, kind: 'escrow', detail: 'Buyer confirmed receipt; escrow released to seller.' },
      },
    },
    { new: true }
  );
  if (!o) {
    const exists = await Order.findById(req.params.id).select('buyer');
    if (!exists) throw new HttpError(404, 'Order not found');
    if (exists.buyer.toString() !== req.user._id.toString()) {
      throw new HttpError(403, 'Only the buyer can confirm receipt');
    }
    throw new HttpError(409, 'This order has already been completed or canceled');
  }

  await maybeCloseChat(o);
  emitToUser(o.seller.toString(), 'order:updated', { orderId: o._id, status: o.status, href: '/seller-dashboard/sales' });

  const sellerUser = await User.findById(o.seller);
  if (sellerUser) {
    await sendOrderStatusEmail(sellerUser, o, 'completed').catch((err) =>
      console.error('Failed to send completion email to seller:', err));
    if (sellerUser.phone) {
      await sendSMS(
        sellerUser.phone,
        `Payment released! Order ${o.invoiceNumber} is complete. ${ghs(o.subtotal)} is now yours.`
      ).catch((err) => console.error('Failed to send SMS:', err));
    }
  }

  res.json({ order: o });
});

/**
 * POST /api/orders/:id/cancel — only valid before the order ships.
 * Restores stock and marks escrow refunded.
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw new HttpError(404, 'Order not found');
  const uid = req.user._id.toString();
  const isParty = o.buyer.toString() === uid || o.seller.toString() === uid;
  if (!isParty && req.user.role !== 'admin') throw new HttpError(403, 'Forbidden');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Order.findOneAndUpdate(
        { _id: req.params.id, status: { $in: ['pending', 'processing'] }, 'escrow.status': 'held' },
        {
          $set: {
            status: 'canceled',
            'escrow.status': 'refunded',
            'escrow.refundedAt': new Date(),
            'escrow.refundedBy': req.user._id,
            'escrow.reason': req.body?.reason || 'Order canceled',
          },
          $push: {
            timeline: { at: new Date(), actor: req.user._id, kind: 'status', detail: 'Order canceled and stock restored.' },
          },
        },
        { new: true, session }
      );
      if (!updated) {
        throw new HttpError(409, 'This order can no longer be canceled — it has already shipped or been finalised.');
      }
      for (const it of updated.items) {
        await restoreStock(it.product, it.qty, session);
      }
    });
  } finally {
    session.endSession();
  }

  const result = await Order.findById(req.params.id);
  await maybeCloseChat(result);

  const [buyerUser, sellerUser] = await Promise.all([
    User.findById(result.buyer),
    User.findById(result.seller),
  ]);
  const other = (u) => u && u._id.toString() !== uid;
  if (other(buyerUser)) emitToUser(buyerUser._id.toString(), 'order:updated', { orderId: result._id, status: 'canceled', href: '/profile/orders' });
  if (other(sellerUser)) emitToUser(sellerUser._id.toString(), 'order:updated', { orderId: result._id, status: 'canceled', href: '/seller-dashboard/sales' });

  if (buyerUser) {
    await sendOrderStatusEmail(buyerUser, result, 'canceled').catch((err) =>
      console.error('Failed to send cancellation email to buyer:', err));
    if (buyerUser.phone) {
      await sendSMS(buyerUser.phone, `Order ${result.invoiceNumber} has been canceled. Your payment will be refunded.`)
        .catch((err) => console.error('Failed to send SMS:', err));
    }
  }
  if (sellerUser) {
    await sendOrderStatusEmail(sellerUser, result, 'canceled').catch((err) =>
      console.error('Failed to send cancellation email to seller:', err));
    if (sellerUser.phone) {
      await sendSMS(sellerUser.phone, `Order ${result.invoiceNumber} has been canceled. The buyer will be refunded.`)
        .catch((err) => console.error('Failed to send SMS:', err));
    }
  }

  res.json({ order: result });
});

/**
 * Close the buyer↔seller chat once every linked order is finished:
 * either dual-confirmed (delivered + received) or canceled. The chat
 * reopens automatically when a fresh order is placed.
 */
async function maybeCloseChat(order) {
  const chat = await Chat.findOne({ buyer: order.buyer, seller: order.seller });
  if (!chat || chat.closed) return;
  const linked = await Order.find({ _id: { $in: chat.orders } })
    .select('status buyerConfirmedReceipt sellerConfirmedDelivery');
  if (linked.length === 0) return;
  const allDone = linked.every((o) =>
    o.status === 'canceled' || (o.buyerConfirmedReceipt && o.sellerConfirmedDelivery));
  const anyDelivered = linked.some((o) => o.status !== 'canceled');
  if (allDone) {
    chat.closed = true;
    chat.closedAt = new Date();
    chat.closedReason = anyDelivered ? 'All orders completed' : 'All orders canceled';
    await chat.save();
  }
}
