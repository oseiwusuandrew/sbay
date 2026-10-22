import mongoose from 'mongoose';

/**
 * An uploaded picture (listing photo or avatar), stored once and served
 * from GET /api/images/:id with long-lived caching.
 *
 * Pictures used to be embedded in products and users as base64 data URLs,
 * which put every photo into every list response. Documents now hold the
 * short "/api/images/<id>" path instead.
 */
const imageSchema = new mongoose.Schema(
  {
    data:        { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size:        { type: Number, required: true },
    owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Image = mongoose.model('Image', imageSchema);
