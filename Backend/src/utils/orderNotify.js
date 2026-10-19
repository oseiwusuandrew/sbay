import { User } from '../models/User.js';
import { emitToAdmins, emitToUser } from '../socket.js';
import { sendOrderStatusEmail, sendNewOrderEmail, sendSMS } from './email.js';

const ghs = (n) => `GH₵ ${Number(n || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;

/**
 * Fan out "new order" notifications (socket, email, SMS) to admins,
 * sellers and buyers. Every channel is best-effort: a failed email
 * must never fail the request that created the order.
 */
export async function notifyNewOrders(orders, { source = 'checkout' } = {}) {
  if (!orders?.length) return;

  emitToAdmins('order:new', {
    count: orders.length,
    total: orders.reduce((s, o) => s + (o.total || 0), 0),
    message: `${orders.length} new order${orders.length === 1 ? '' : 's'} ${source === 'webhook' ? 'arrived via webhook' : 'just came in'}.`,
  });

  for (const o of orders) {
    const [sellerUser, buyerUser] = await Promise.all([
      User.findById(o.seller),
      User.findById(o.buyer),
    ]);

    if (sellerUser) {
      emitToUser(sellerUser._id.toString(), 'order:new', { orderId: o._id });
      await sendNewOrderEmail(sellerUser, o).catch((err) =>
        console.error('Failed to send new order email to seller:', err));
      if (sellerUser.phone) {
        await sendSMS(
          sellerUser.phone,
          `New order ${o.invoiceNumber}! ${ghs(o.subtotal)} is held in escrow for you. Open sBay to process it.`
        ).catch((err) => console.error('Failed to send SMS to seller:', err));
      }
    }

    if (buyerUser) {
      emitToUser(buyerUser._id.toString(), 'order:new', { orderId: o._id });
      await sendOrderStatusEmail(buyerUser, o, 'pending').catch((err) =>
        console.error('Failed to send order confirmation to buyer:', err));
      if (buyerUser.phone) {
        await sendSMS(
          buyerUser.phone,
          `Order ${o.invoiceNumber} placed successfully! Total: ${ghs(o.total)}. Track it on sBay.`
        ).catch((err) => console.error('Failed to send SMS to buyer:', err));
      }
    }
  }
}

export { ghs };
