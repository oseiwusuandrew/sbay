import mongoose from 'mongoose';

/**
 * Seller plan. Editable from the admin panel; nothing about pricing is
 * hard-coded in the app.
 *
 *  - price:       GH₵ for 30 days, paid through Paystack (0 = free plan)
 *  - feePct:      service fee buyers pay on top of this seller's prices
 *  - maxListings: how many active listings the seller may have (null = no limit)
 *  - features:    extra lines shown on the plan card. Only list what the
 *                 platform actually does; the listing limit and fee are
 *                 shown automatically.
 */
const planSchema = new mongoose.Schema(
  {
    code:     { type: String, required: true, unique: true, lowercase: true, trim: true }, // 'free' | 'plus' | 'pro' | ...
    name:     { type: String, required: true, trim: true },
    tag:      { type: String, default: '' },
    price:    { type: Number, required: true, min: 0 },
    feePct:   { type: Number, required: true, min: 0, max: 100, default: 5 },
    maxListings: { type: Number, min: 1, default: null },
    features: { type: [String], default: [] },
    highlight:{ type: Boolean, default: false },
    active:   { type: Boolean, default: true },
    sortOrder:{ type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Plan = mongoose.model('Plan', planSchema);
