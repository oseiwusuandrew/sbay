import express, { Router } from 'express';
import { param } from 'express-validator';
import mongoose from 'mongoose';
import { Image } from '../models/Image.js';
import { requireAuth } from '../middleware/auth.js';
import { imageUploadLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { storeDataUrl } from '../utils/media.js';

const router = Router();

/**
 * POST /api/images — { dataUrl } → { url }. The app resizes photos before
 * uploading, so a 3 MB cap leaves plenty of room. This route has its own
 * body limit; the app-wide JSON limit stays small.
 */
router.post(
  '/',
  imageUploadLimiter,
  requireAuth,
  express.json({ limit: '5mb' }),
  asyncHandler(async (req, res) => {
    const url = await storeDataUrl(req.body?.dataUrl, req.user._id);
    res.status(201).json({ url });
  })
);

/** GET /api/images/:id — the picture itself. Ids never change content, so cache for a year. */
router.get(
  '/:id',
  param('id').isMongoId(),
  validate,
  asyncHandler(async (req, res) => {
    const img = await Image.findById(new mongoose.Types.ObjectId(req.params.id)).lean();
    if (!img) throw new HttpError(404, 'Image not found');
    res.set({
      'Content-Type': img.contentType,
      'Content-Length': img.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Helmet defaults to same-origin; the web app runs on another origin.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.end(img.data.buffer ? Buffer.from(img.data.buffer) : img.data);
  })
);

export default router;
