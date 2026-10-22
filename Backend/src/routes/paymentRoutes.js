import { Router } from 'express';
import { body } from 'express-validator';
import {
  quotePayment, initializePayment, verifyPayment, paystackWebhook,
  initializeOnboardingFee, verifyOnboardingFee, initializePlanPayment, verifyPlanPayment,
} from '../controllers/paymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post(
  '/quote',
  requireAuth,
  body('items').isArray({ min: 1 }).withMessage('Cart is empty'),
  body('items.*.productId').isMongoId().withMessage('Invalid product id'),
  body('items.*.qty').isInt({ min: 1, max: 1000 }).withMessage('Quantity must be a positive whole number'),
  validate,
  quotePayment
);

router.post(
  '/initialize',
  requireAuth,
  authLimiter,
  body('items').isArray({ min: 1 }).withMessage('Cart is empty'),
  body('items.*.productId').isMongoId().withMessage('Invalid product id'),
  body('items.*.qty').isInt({ min: 1, max: 1000 }).withMessage('Quantity must be a positive whole number'),
  body('deliveryLocation').isString().trim().notEmpty().withMessage('Delivery location is required').isLength({ max: 200 }),
  validate,
  initializePayment
);

router.post(
  '/verify',
  requireAuth,
  body('reference').isString().notEmpty().withMessage('Reference is required'),
  validate,
  verifyPayment
);

router.post('/webhook', paystackWebhook);

router.post('/onboarding/initialize', requireAuth, initializeOnboardingFee);
router.post(
  '/onboarding/verify',
  requireAuth,
  body('reference').isString().notEmpty().withMessage('Reference is required'),
  validate,
  verifyOnboardingFee
);

router.post(
  '/subscription/initialize',
  requireAuth,
  requireRole('seller'),
  body('plan').isString().trim().notEmpty().withMessage('Choose a plan'),
  validate,
  initializePlanPayment
);
router.post(
  '/subscription/verify',
  requireAuth,
  body('reference').isString().notEmpty().withMessage('Reference is required'),
  validate,
  verifyPlanPayment
);

export default router;
