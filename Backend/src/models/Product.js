import mongoose from 'mongoose';

/**
 * Product (a.k.a. listing).
 *
 * `stock` is decremented atomically at order time using
 * `findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })`.
 * If the document did not match (someone else just bought the last unit),
 * the update returns null and we reject the order. This is the canonical
 * answer to the "two users buy the last item simultaneously" race —
 * MongoDB's atomic update is the arbiter.
 */
const productSchema = new mongoose.Schema(
  {
    seller:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title:      { type: String, required: true, trim: true, maxlength: 140 },
    description:{ type: String, default: '', maxlength: 5000 },

    price:      { type: Number, required: true, min: 0 },         // GH₵
    discountPrice: { type: Number, min: 0 },                       // optional compare-at

    stock:      { type: Number, required: true, min: 0, default: 1 },
    sold:       { type: Number, default: 0, min: 0 },

    condition:  { type: String, enum: ['Brand New', 'Like New', 'Slightly Used', 'Used · Fair'], default: 'Brand New' },
    category:   { type: String, required: true, trim: true, index: true },

    images:     { type: [String], default: [] },

    // Seller-set delivery / meet-up location, surfaced on the product card
    // so buyers can judge logistics before opening the listing.
    location:   { type: String, trim: true, index: true },
    school:     { type: String, trim: true },
    city:       { type: String, trim: true },

    // Lifecycle. Admins can hide listings without deleting them.
    status: {
      type: String,
      enum: ['active', 'sold_out', 'hidden', 'removed'],
      default: 'active',
      index: true,
    },
    removedReason: String,
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Set while the seller's account is restricted. Kept separate from
    // `status` so lifting the restriction restores exactly what was there.
    sellerSuspended: { type: Boolean, default: false, index: true },

    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ title: 'text', description: 'text', category: 'text' });

// Compound indexes for common query patterns (speeds up sorted listing pages)
productSchema.index({ status: 1, createdAt: -1 });  // recent active products
productSchema.index({ status: 1, views: -1 });      // popular active products
productSchema.index({ status: 1, school: 1, category: 1 }); // category page filtering

/**
 * What the public may see: active listings from sellers in good standing.
 * Spread it into every public query (`{ ...LIVE_LISTING, category }`) so
 * there is one definition of "visible".
 */
export const LIVE_LISTING = Object.freeze({ status: 'active', sellerSuspended: { $ne: true } });

export const Product = mongoose.model('Product', productSchema);
