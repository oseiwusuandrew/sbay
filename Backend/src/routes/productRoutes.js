import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  listCatalogMeta, listProducts, getProduct, getHomeFeed, createProduct,
  updateProduct, deleteProduct, myListings, myListingStats,
} from '../controllers/productController.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/catalog', listCatalogMeta);
router.get('/home', getHomeFeed);
router.get('/', query('seller').optional().isMongoId(), validate, listProducts);

router.get('/mine', requireAuth, requireRole('seller'), myListings);
router.get('/mine/stats', requireAuth, requireRole('seller'), myListingStats);

router.get('/:id', optionalAuth, param('id').isMongoId(), validate, getProduct);

router.post(
  '/',
  requireAuth, requireRole('seller'),
  body('title').isString().trim().isLength({ min: 3, max: 140 }),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('price').isFloat({ min: 0 }),
  body('discountPrice').optional().isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0, max: 100000 }),
  body('condition').optional().isIn(['Brand New', 'Like New', 'Slightly Used', 'Used · Fair']),
  body('category').isString().trim().isLength({ min: 2, max: 60 }),
  body('images').optional().isArray({ max: 6 }),
  body('location').optional().isString().isLength({ max: 120 }),
  validate,
  createProduct
);

router.patch(
  '/:id',
  requireAuth, requireRole('seller'),
  param('id').isMongoId(),
  body('title').optional().isString().trim().isLength({ min: 3, max: 140 }),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('price').optional().isFloat({ min: 0 }),
  body('discountPrice').optional().isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0, max: 100000 }),
  body('condition').optional().isIn(['Brand New', 'Like New', 'Slightly Used', 'Used · Fair']),
  body('category').optional().isString().trim().isLength({ min: 2, max: 60 }),
  body('images').optional().isArray({ max: 6 }),
  body('location').optional().isString().isLength({ max: 120 }),
  validate,
  updateProduct
);

router.delete(
  '/:id',
  requireAuth, requireRole('seller'),
  param('id').isMongoId(), validate,
  deleteProduct
);

export default router;
