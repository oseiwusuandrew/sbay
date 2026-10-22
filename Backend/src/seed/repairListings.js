import { Product } from '../models/Product.js';
import { User } from '../models/User.js';

/**
 * Keep listings consistent with their sellers' accounts. Runs on every boot
 * and is a no-op once the data is clean.
 *
 *  - Listings whose seller account no longer exists are removed. Older
 *    versions could delete an account and leave its listings public.
 *  - Listings of restricted sellers are marked suspended, and those of
 *    sellers in good standing are not, so the flag always matches the account.
 */
export async function repairListings() {
  const sellerIds = await Product.distinct('seller', { status: { $ne: 'removed' } });
  if (!sellerIds.length) return;

  const accounts = await User.find({ _id: { $in: sellerIds } }).select('_id restricted').lean();
  const existing = new Set(accounts.map((u) => String(u._id)));
  const orphanSellers = sellerIds.filter((id) => !existing.has(String(id)));
  const restricted = accounts.filter((u) => u.restricted).map((u) => u._id);

  const [orphans, suspended, restored] = await Promise.all([
    orphanSellers.length
      ? Product.updateMany(
        { seller: { $in: orphanSellers }, status: { $ne: 'removed' } },
        { $set: { status: 'removed', removedReason: 'Seller account deleted' } },
      )
      : { modifiedCount: 0 },
    Product.updateMany(
      { seller: { $in: restricted }, sellerSuspended: { $ne: true } },
      { $set: { sellerSuspended: true } },
    ),
    Product.updateMany(
      { seller: { $nin: restricted }, sellerSuspended: true },
      { $set: { sellerSuspended: false } },
    ),
  ]);

  const changed = orphans.modifiedCount + suspended.modifiedCount + restored.modifiedCount;
  if (changed) {
    // eslint-disable-next-line no-console
    console.log(`[repair] listings: ${orphans.modifiedCount} from deleted sellers removed, `
      + `${suspended.modifiedCount} suspended, ${restored.modifiedCount} restored`);
  }
}
