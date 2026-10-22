import { Product } from '../models/Product.js';
import { Plan } from '../models/Plan.js';
import { Settings } from '../models/Settings.js';
import { User } from '../models/User.js';
import { HttpError } from './httpError.js';

/** Round a GH₵ amount to whole pesewas. */
export const toPesewas = (ghs) => Math.round(Number(ghs || 0) * 100);
export const fromPesewas = (p) => Math.round(p) / 100;

/**
 * Price a cart exactly the way orders will be created from it.
 *
 * The cart is split into one group per seller, and each group's service
 * fee uses that seller's plan feePct (falling back to the platform
 * default). Initialize, fulfillment and the checkout preview all call
 * this, so the amount Paystack charges always equals the sum of the
 * order totals the buyer later sees.
 *
 * Validates availability and ownership but does NOT reserve stock.
 */
export async function quoteCart(items, buyerId, { session } = {}) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Cart is empty');

  // Merge duplicate lines so the same product can't dodge the stock check.
  const merged = new Map();
  for (const it of items) {
    if (!Number.isInteger(it.qty) || it.qty < 1) {
      throw new HttpError(400, 'Quantity must be a positive whole number');
    }
    const id = String(it.productId);
    merged.set(id, (merged.get(id) || 0) + it.qty);
  }

  const products = await Product.find({ _id: { $in: [...merged.keys()] } }).session(session || null);
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const settings = await Settings.getSingleton();
  const groups = new Map();

  for (const [id, qty] of merged) {
    const product = productMap.get(id);
    if (!product) throw new HttpError(404, 'One of the items in your cart no longer exists');
    if (product.status !== 'active' || product.sellerSuspended) {
      throw new HttpError(409, `"${product.title}" is no longer available`);
    }
    if (buyerId && product.seller.toString() === buyerId.toString()) {
      throw new HttpError(400, 'You cannot buy your own listing');
    }
    if (product.stock < qty) {
      throw new HttpError(409, product.stock > 0
        ? `Only ${product.stock} of "${product.title}" left`
        : `"${product.title}" is sold out`);
    }
    const sid = product.seller.toString();
    if (!groups.has(sid)) groups.set(sid, { sellerId: sid, lines: [] });
    groups.get(sid).lines.push({ product, qty });
  }

  // Resolve each seller's plan fee in one round-trip.
  const sellers = await User.find({ _id: { $in: [...groups.keys()] } })
    .select('subscription').session(session || null);
  const planCodes = [...new Set(sellers.map((s) => s.subscription?.plan).filter(Boolean))];
  const plans = planCodes.length
    ? await Plan.find({ code: { $in: planCodes } }).session(session || null)
    : [];
  const planFee = new Map(plans.map((p) => [p.code, p.feePct]));
  const sellerFee = new Map(sellers.map((s) => [
    s._id.toString(),
    planFee.get(s.subscription?.plan) ?? settings.defaultEscrowFeePct,
  ]));

  let subtotalP = 0;
  let feeP = 0;
  const quoted = [];
  for (const g of groups.values()) {
    const feePct = Number(sellerFee.get(g.sellerId) ?? settings.defaultEscrowFeePct) || 0;
    const gSubP = g.lines.reduce((s, l) => s + toPesewas(l.product.price) * l.qty, 0);
    const gFeeP = Math.round(gSubP * feePct / 100);
    subtotalP += gSubP;
    feeP += gFeeP;
    quoted.push({
      sellerId: g.sellerId,
      lines: g.lines,
      feePct,
      subtotal: fromPesewas(gSubP),
      fee: fromPesewas(gFeeP),
      total: fromPesewas(gSubP + gFeeP),
    });
  }

  return {
    groups: quoted,
    subtotal: fromPesewas(subtotalP),
    fee: fromPesewas(feeP),
    total: fromPesewas(subtotalP + feeP),
    totalPesewas: subtotalP + feeP,
  };
}
