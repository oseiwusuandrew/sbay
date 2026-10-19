import { Product } from '../models/Product.js';

/**
 * Atomically reserve `qty` units of a product. Returns the updated
 * product or null if there isn't enough stock. This is the answer to
 * the "two users buy the last unit at the same time" race — Mongo's
 * findOneAndUpdate is atomic, so exactly one of the two updates
 * matches the `stock >= qty` predicate; the other gets null.
 * A listing that reaches zero is flipped to sold_out in the same session.
 */
export async function reserveStock(productId, qty, session) {
  const p = await Product.findOneAndUpdate(
    { _id: productId, status: 'active', stock: { $gte: qty } },
    { $inc: { stock: -qty, sold: qty } },
    { new: true, session }
  );
  if (p && p.stock === 0) {
    p.status = 'sold_out';
    await p.save({ session });
  }
  return p;
}

/** Put units back on the shelf; a sold-out listing becomes buyable again. */
export async function restoreStock(productId, qty, session) {
  const p = await Product.findOneAndUpdate(
    { _id: productId },
    { $inc: { stock: qty, sold: -qty } },
    { new: true, session }
  );
  if (!p) return p;
  let dirty = false;
  if (p.status === 'sold_out' && p.stock > 0) { p.status = 'active'; dirty = true; }
  if (p.sold < 0) { p.sold = 0; dirty = true; }
  if (dirty) await p.save({ session });
  return p;
}
