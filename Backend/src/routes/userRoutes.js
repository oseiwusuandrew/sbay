import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  updateMe, becomeSeller, getSellerById,
  addPaymentMethod, removePaymentMethod, myNotifications,
  getSellerReviews, createReview, deleteMyAccount, resubmitVerification,
} from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.patch(
  '/me',
  requireAuth,
  body('name').optional().isString().isLength({ min: 2, max: 80 }),
  body('avatar').optional().isString().isLength({ max: 1_500_000 }),
  body('phone').optional().isString().isLength({ max: 30 }),
  body('location').optional().isString().isLength({ max: 120 }),
  body('sellerProfile').optional().isObject(),
  body('payout').optional().isObject(),
  validate,
  updateMe
);

router.get('/me/notifications', requireAuth, myNotifications);
router.delete('/me', requireAuth, deleteMyAccount);

router.post(
  '/me/become-seller',
  requireAuth,
  body('storeName').isString().trim().isLength({ min: 2, max: 80 }),
  body('bio').optional().isString().isLength({ max: 2000 }),
  body('isStudent').optional().isBoolean(),
  body('university').optional().isString().isLength({ max: 120 }),
  body('occupation').optional().isString().isLength({ max: 120 }),
  body('businessReg').optional().isString().isLength({ max: 80 }),
  body('location').optional().isString().isLength({ max: 120 }),
  body('payout').isObject().withMessage('Payout account is required'),
  body('payout.method').optional().isIn(['mtn-momo', 'vodafone-cash', 'airteltigo-money', 'bank']),
  body('payout.account').isString().trim().isLength({ min: 9, max: 30 }).withMessage('Enter a valid payout phone or account number'),
  body('payout.accountName').optional().isString().trim().isLength({ max: 80 }),
  body('payout.network').optional().isString().trim().isLength({ max: 40 }),
  // Inline base64 data-URL student ID. Validation cap is generous; the
  // controller enforces the byte budget more strictly.
  body('idCardUrl').optional().isString().isLength({ max: 6_000_000 }),
  validate,
  becomeSeller
);

router.post(
  '/me/verification',
  requireAuth,
  requireRole('seller'),
  body('isStudent').isBoolean(),
  body('university').optional().isString().isLength({ max: 120 }),
  body('occupation').optional().isString().isLength({ max: 120 }),
  body('businessReg').optional().isString().isLength({ max: 80 }),
  body('idCardUrl').optional().isString().isLength({ max: 6_000_000 }),
  validate,
  resubmitVerification
);

router.post(
  '/me/payment-methods',
  requireAuth,
  body('brand').isString().isLength({ max: 30 }),
  body('last4').isString().isLength({ min: 2, max: 6 }),
  body('holder').optional().isString().isLength({ max: 80 }),
  body('expiry').optional().isString().isLength({ max: 7 }),
  body('method').optional().isIn(['card', 'momo']),
  validate,
  addPaymentMethod
);

router.delete(
  '/me/payment-methods/:cardId',
  requireAuth,
  param('cardId').isMongoId(),
  validate,
  removePaymentMethod
);

router.get(
  '/sellers/:id',
  param('id').isMongoId(),
  validate,
  getSellerById
);

router.get(
  '/sellers/:id/reviews',
  param('id').isMongoId(),
  validate,
  getSellerReviews
);

router.post(
  '/sellers/:id/reviews',
  requireAuth,
  param('id').isMongoId(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('text').isString().trim().isLength({ min: 1, max: 2000 }),
  validate,
  createReview
);

export default router;
