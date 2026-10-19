import crypto from 'crypto';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { PaymentSession } from '../models/PaymentSession.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Settings } from '../models/Settings.js';
import { Chat } from '../models/Chat.js';
import { AuditLog } from '../models/AuditLog.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { emitToAdmins } from '../socket.js';
import { env } from '../config/env.js';
import { quoteCart, toPesewas } from '../utils/pricing.js';
import { notifyNewOrders } from '../utils/orderNotify.js';

const PAYSTACK_API = 'https://api.paystack.co';
const PAYSTACK_TIMEOUT_MS = 15000;

async function paystackRequest(path, { method = 'GET', body } = {}) {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new HttpError(503, 'Payments are not configured yet. Please try again later.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS);
  try {
    const resp = await fetch(`${PAYSTACK_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    return await resp.json();
  } catch {
    throw new HttpError(504, 'Payment provider is taking too long to respond. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

const paystackPost = (path, body) => paystackRequest(path, { method: 'POST', body });
const paystackGet = (path) => paystackRequest(path);

/**
 * A successful Paystack transaction only counts if it paid what this
 * session asked for, in cedis. Without this check a tampered or reused
 * reference could fulfil a large cart with a small payment.
 */
function paidInFull(paymentSession, data) {
  if (!data || data.status !== 'success') return false;
  if (String(data.currency || 'GHS').toUpperCase() !== 'GHS') return false;
  return Number(data.amount) >= Number(paymentSession.amountPesewas || 0);
}

/**
 * Atomically fulfills a PaymentSession into real Orders: reserves stock,
 * creates one escrow-held order per seller and opens buyer↔seller chats.
 * Called by both verifyPayment (user redirect) and paystackWebhook.
 */
async function fulfillPaymentSession(paymentSession, paystackData) {
  const mongoSession = await mongoose.startSession();
  let orders = [];

  try {
    await mongoSession.withTransaction(async () => {
      orders = [];
      const quote = await quoteCart(
        paymentSession.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        paymentSession.buyer,
        { session: mongoSession },
      );
      // A seller may have raised a price after the buyer was charged.
      if (quote.totalPesewas > Number(paystackData?.amount ?? paymentSession.amountPesewas)) {
        throw new HttpError(409, 'A price in your cart changed while you were paying.');
      }

      for (const group of quote.groups) {
        for (const { product, qty } of group.lines) {
          const updated = await Product.findOneAndUpdate(
            { _id: product._id, status: 'active', stock: { $gte: qty } },
            { $inc: { stock: -qty, sold: qty } },
            { new: true, session: mongoSession },
          );
          if (!updated) throw new HttpError(409, `"${product.title}" sold out before your payment completed.`);
          if (updated.stock === 0) {
            updated.status = 'sold_out';
            await updated.save({ session: mongoSession });
          }
        }

        const [order] = await Order.create([{
          buyer: paymentSession.buyer,
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
            provider: 'paystack',
            transactionId: paystackData?.reference || paymentSession.reference,
            cardBrand: paystackData?.authorization?.brand,
            cardLast4: paystackData?.authorization?.last4,
            paidAt: paystackData?.paid_at ? new Date(paystackData.paid_at) : new Date(),
          },
          deliveryLocation: paymentSession.deliveryLocation,
          timeline: [{
            at: new Date(),
            actor: paymentSession.buyer,
            kind: 'created',
            detail: 'Order placed via Paystack; funds held in escrow.',
          }],
        }], { session: mongoSession });

        await Chat.findOneAndUpdate(
          { buyer: paymentSession.buyer, seller: group.sellerId },
          {
            $setOnInsert: { buyer: paymentSession.buyer, seller: group.sellerId },
            $set: { closed: false, closedAt: null, closedReason: null },
            $addToSet: { orders: order._id },
          },
          { upsert: true, new: true, session: mongoSession },
        );

        orders.push(order);
      }

      paymentSession.status = 'paid';
      paymentSession.orders = orders.map((o) => o._id);
      paymentSession.paystackData = paystackData;
      await paymentSession.save({ session: mongoSession });
    });
  } finally {
    mongoSession.endSession();
  }

  return orders;
}

/**
 * The buyer was charged but we could not turn the payment into orders
 * (usually: the item sold out mid-payment). Park the session so it is
 * never retried into a double-sale, and leave a durable record for an
 * admin to refund — PaymentSessions expire after 24h, audit rows don't.
 */
async function flagForRefund(paymentSession, paystackData, reason) {
  await PaymentSession.updateOne(
    { _id: paymentSession._id },
    { $set: { status: 'needs_refund', failureReason: reason, paystackData } },
  );
  await AuditLog.create({
    actor: paymentSession.buyer,
    action: 'payment.needs_refund',
    target: { kind: 'payment', id: paymentSession._id },
    detail: {
      reference: paymentSession.reference,
      amountPesewas: paymentSession.amountPesewas,
      items: paymentSession.items,
      reason,
    },
  }).catch((e) => console.error('[payments] failed to write refund audit row', e.message));
  emitToAdmins('payment:needs_refund', {
    reference: paymentSession.reference,
    message: `A paid checkout (${paymentSession.reference}) could not be fulfilled and needs a refund: ${reason}`,
  });
}

/**
 * Shared by verify + webhook once Paystack has confirmed the charge.
 * Returns the created orders, or throws an HttpError the caller can show.
 */
async function settle(paymentSession, paystackData, source) {
  if (!paidInFull(paymentSession, paystackData)) {
    await PaymentSession.updateOne({ _id: paymentSession._id }, { $set: { status: 'failed' } });
    throw new HttpError(400, 'Payment was not completed for the full amount. No order was created.');
  }

  try {
    const orders = await fulfillPaymentSession(paymentSession, paystackData);
    notifyNewOrders(orders, { source }).catch((e) => console.error('[payments] notify failed', e));
    return orders;
  } catch (err) {
    if (err instanceof HttpError && err.status < 500) {
      await flagForRefund(paymentSession, paystackData, err.message);
      throw new HttpError(409, `${err.message} You were charged, so our team has been alerted and will refund you in full.`);
    }
    // Infrastructure error (DB hiccup): release the claim so a retry or
    // the webhook can try again.
    await PaymentSession.updateOne({ _id: paymentSession._id }, { $set: { status: 'pending' } });
    throw err;
  }
}

/**
 * POST /api/payments/quote
 * Exact checkout breakdown (per-seller plan fees) without charging.
 */
export const quotePayment = asyncHandler(async (req, res) => {
  const quote = await quoteCart(req.body.items, req.user._id);
  res.json({
    subtotal: quote.subtotal,
    fee: quote.fee,
    total: quote.total,
    groups: quote.groups.map((g) => ({
      sellerId: g.sellerId, subtotal: g.subtotal, feePct: g.feePct, fee: g.fee, total: g.total,
    })),
  });
});

/**
 * POST /api/payments/initialize
 *
 * Validates the cart and creates a Paystack hosted payment page.
 * Stock is NOT reduced yet — only reserved after payment is confirmed.
 */
export const initializePayment = asyncHandler(async (req, res) => {
  const { items, deliveryLocation } = req.body;
  if (!deliveryLocation?.trim()) throw new HttpError(400, 'Delivery location is required');

  const quote = await quoteCart(items, req.user._id);
  const reference = `SBAY-${Date.now()}-${nanoid(8)}`;

  const paystackRes = await paystackPost('/transaction/initialize', {
    email: req.user.email,
    amount: quote.totalPesewas,
    reference,
    currency: 'GHS',
    callback_url: env.PAYSTACK_CALLBACK_URL,
    metadata: {
      type: 'checkout',
      buyer_id: req.user._id.toString(),
      buyer_name: req.user.name,
      item_count: items.length,
      cancel_action: env.PAYSTACK_CALLBACK_URL.replace('/payment-success', '/payment-failed'),
    },
  });

  if (!paystackRes?.status || !paystackRes.data?.authorization_url) {
    throw new HttpError(502, paystackRes?.message || 'Could not initialize payment. Please try again.');
  }

  await PaymentSession.create({
    reference,
    buyer: req.user._id,
    items: items.map((it) => ({ productId: it.productId, qty: it.qty })),
    deliveryLocation: deliveryLocation.trim(),
    amountPesewas: quote.totalPesewas,
  });

  res.json({ authorization_url: paystackRes.data.authorization_url, reference, total: quote.total });
});

/**
 * POST /api/payments/verify
 *
 * Called by the frontend after Paystack redirects back. Verifies the
 * transaction, then atomically creates orders and reduces stock.
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const { reference } = req.body;
  if (!reference) throw new HttpError(400, 'Payment reference is required');

  // Already fulfilled (page refresh, or the webhook won the race).
  const existingPaid = await PaymentSession.findOne({ reference, buyer: req.user._id, status: 'paid' }).populate('orders');
  if (existingPaid?.orders?.length > 0) {
    return res.json({ orders: existingPaid.orders });
  }

  // Atomically claim the session to prevent a race with the webhook.
  const session = await PaymentSession.findOneAndUpdate(
    { reference, buyer: req.user._id, status: 'pending' },
    { $set: { status: 'processing' } },
    { new: true },
  );

  if (!session) {
    const ps = await PaymentSession.findOne({ reference, buyer: req.user._id });
    if (!ps) throw new HttpError(404, 'Payment session not found');
    if (ps.status === 'failed') throw new HttpError(400, 'This payment was not successful. No funds were charged.');
    if (ps.status === 'needs_refund') {
      throw new HttpError(409, `${ps.failureReason || 'This order could not be completed.'} Our team will refund you in full.`);
    }
    // 'processing' — the webhook is mid-fulfilment; the client polls.
    return res.json({ orders: [], pending: true });
  }

  let paystackRes;
  try {
    paystackRes = await paystackGet(`/transaction/verify/${encodeURIComponent(reference)}`);
  } catch (err) {
    // Couldn't reach Paystack — the charge may still have succeeded.
    await PaymentSession.updateOne({ _id: session._id }, { $set: { status: 'pending' } });
    throw err;
  }

  const data = paystackRes?.data;
  if (data?.status === 'abandoned' || data?.status === 'ongoing' || data?.status === 'pending') {
    // Buyer hasn't finished paying (e.g. MoMo prompt still open).
    await PaymentSession.updateOne({ _id: session._id }, { $set: { status: 'pending' } });
    return res.json({ orders: [], pending: true });
  }
  if (!paystackRes?.status || data?.status !== 'success') {
    await PaymentSession.updateOne({ _id: session._id }, { $set: { status: 'failed' } });
    throw new HttpError(400, 'Payment was not completed. No funds were charged.');
  }

  const orders = await settle(session, data, 'verify');
  res.json({ orders });
});

/**
 * POST /api/payments/webhook
 *
 * Paystack server-to-server events — a reliability fallback so a buyer
 * who closed the tab before the redirect still gets their order.
 * req.rawBody is captured in app.js for signature verification.
 */
export const paystackWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  if (!signature || !req.rawBody || !env.PAYSTACK_SECRET_KEY) return res.status(400).end();

  const hash = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(req.rawBody)
    .digest('hex');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(String(signature), 'hex'))) {
      return res.status(400).end();
    }
  } catch { return res.status(400).end(); }

  res.sendStatus(200);

  const { event, data } = req.body || {};
  if (event !== 'charge.success' || !data?.reference) return;

  const session = await PaymentSession.findOneAndUpdate(
    { reference: data.reference, status: 'pending' },
    { $set: { status: 'processing' } },
    { new: true },
  );
  if (!session) return; // unknown, already paid, or being verified right now

  try {
    await settle(session, data, 'webhook');
  } catch (err) {
    console.error('[payments] webhook fulfilment failed:', err.message);
  }
});

/* --- Seller onboarding fee ----------------------------------- */

export const initializeOnboardingFee = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  const feeGhs = Number(settings.sellerOnboardingFee || 0);
  if (feeGhs <= 0) throw new HttpError(400, 'No onboarding fee is currently configured.');
  if (req.user.onboardingFeePaid) throw new HttpError(409, 'Onboarding fee already paid.');

  const reference = `SBAY-OB-${req.user._id}-${Date.now()}`;
  const paystackRes = await paystackPost('/transaction/initialize', {
    email: req.user.email,
    amount: toPesewas(feeGhs),
    reference,
    currency: 'GHS',
    callback_url: `${env.FRONTEND_URL || 'https://sbaygh.com'}/sell?onboarding_ref=${reference}`,
    metadata: { type: 'onboarding_fee', userId: req.user._id.toString() },
  });
  if (!paystackRes?.status || !paystackRes.data?.authorization_url) {
    throw new HttpError(502, paystackRes?.message || 'Could not start the payment. Please try again.');
  }
  res.json({ authorization_url: paystackRes.data.authorization_url, reference });
});

export const verifyOnboardingFee = asyncHandler(async (req, res) => {
  const { reference } = req.body;
  if (!reference) throw new HttpError(400, 'Payment reference is required.');
  if (req.user.onboardingFeePaid) return res.json({ user: req.user });

  const result = await paystackGet(`/transaction/verify/${encodeURIComponent(reference)}`);
  const data = result?.data;
  if (!result?.status || data?.status !== 'success') {
    throw new HttpError(402, 'Payment was not successful. Please try again.');
  }
  const meta = data.metadata || {};
  if (meta.type !== 'onboarding_fee' || meta.userId !== req.user._id.toString()) {
    throw new HttpError(403, 'Payment reference does not match your account.');
  }
  // Must have paid the fee that was asked for — the setting can't be
  // dodged by replaying a cheaper (older) onboarding reference.
  const settings = await Settings.getSingleton();
  if (String(data.currency || 'GHS').toUpperCase() !== 'GHS'
      || Number(data.amount) < toPesewas(settings.sellerOnboardingFee)) {
    throw new HttpError(402, 'The amount paid does not match the current onboarding fee.');
  }

  req.user.onboardingFeePaid = true;
  req.user.onboardingPaidAt = new Date();
  req.user.onboardingRef = reference;
  await req.user.save();
  res.json({ user: req.user });
});
