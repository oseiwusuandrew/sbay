import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { isDataUrl, storeDataUrl } from '../utils/media.js';

const INLINE = /^data:image\//;

/** Store one value if it is an inline picture; anything unreadable is dropped. */
async function convert(value, owner) {
  if (!isDataUrl(value)) return value;
  try {
    return await storeDataUrl(value, owner);
  } catch {
    return '';
  }
}

/**
 * Move pictures embedded as base64 (listing photos, avatars, and the photo
 * copied onto past orders) into the image store. Runs on every boot and
 * only touches documents that still hold inline pictures.
 */
export async function migrateInlineImages() {
  let products = 0;
  let users = 0;
  let orders = 0;

  for await (const p of Product.find({ images: INLINE }).select('images seller').cursor()) {
    const images = [];
    for (const v of p.images) images.push(await convert(v, p.seller));
    await Product.updateOne({ _id: p._id }, { $set: { images: images.filter(Boolean) } });
    products += 1;
  }

  for await (const u of User.find({ avatar: INLINE }).select('avatar').cursor()) {
    await User.updateOne({ _id: u._id }, { $set: { avatar: await convert(u.avatar, u._id) } });
    users += 1;
  }

  for await (const o of Order.find({ 'items.image': INLINE }).select('items seller').cursor()) {
    const set = {};
    for (const [i, item] of o.items.entries()) {
      if (isDataUrl(item.image)) set[`items.${i}.image`] = await convert(item.image, o.seller);
    }
    await Order.updateOne({ _id: o._id }, { $set: set });
    orders += 1;
  }

  if (products || users || orders) {
    // eslint-disable-next-line no-console
    console.log(`[migrate] moved inline pictures to the image store: ${products} listings, ${users} avatars, ${orders} orders`);
  }
}
