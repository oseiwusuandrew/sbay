import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  adminLogin, dashboard,
  listUsers, getUserDetail, verifyUser, restrictUser, deleteUser,
  listAdmins, createAdmin, removeAdmin,
  listAllProducts, moderateProduct,
  listAllOrders, releaseEscrow, refundEscrow,
  listAllPlans, upsertPlan, deletePlan,
  getSettings, updateSettings,
  listAuditLog, salesReport,
  listAllChats, getAdminChat, closeChat,
  listStudentVerifications, decideStudentVerification,
  listNotifications,
} from '../controllers/adminController.js';
import {
  listTickets, replyTicket, closeTicket,
} from '../controllers/supportController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { adminAuthLimiter, adminMutationLimiter } from '../middleware/rateLimit.js';

const router = Router();

/* ---- Admin login (public, but obscured prefix + rate limited) ---- */
router.post(
  '/auth/login',
  adminAuthLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isString().notEmpty(),
  validate,
  adminLogin
);

/* ---- Everything below requires an admin JWT ---- */
router.use(requireAuth, requireAdmin);

router.get('/dashboard', dashboard);

/* Users */
router.get('/users', listUsers);
router.get('/users/:id', param('id').isMongoId(), validate, getUserDetail);
router.post(
  '/users/:id/verify',
  adminMutationLimiter,
  param('id').isMongoId(),
  body('decision').isIn(['approved', 'rejected']),
  body('reason').optional().isString().isLength({ max: 500 }),
  validate, verifyUser
);
router.post(
  '/users/:id/restrict',
  adminMutationLimiter,
  param('id').isMongoId(),
  body('restricted').isBoolean(),
  body('reason').optional().isString().isLength({ max: 500 }),
  validate, restrictUser
);
router.delete(
  '/users/:id',
  adminMutationLimiter,
  param('id').isMongoId(),
  validate, deleteUser
);

/* Admin management */
router.get('/admins', listAdmins);
router.post(
  '/admins',
  adminMutationLimiter,
  body('email').isEmail().normalizeEmail(),
  // name + password are only required when creating a fresh admin from scratch.
  // Elevate-existing-by-email mode validates these in the controller.
  body('name').optional().isString().trim().isLength({ min: 2, max: 80 }),
  body('password').optional().isString().isLength({ min: 10 }).withMessage('Admin passwords must be at least 10 characters'),
  validate, createAdmin
);
router.delete('/admins/:id', adminMutationLimiter, param('id').isMongoId(), validate, removeAdmin);

/* Products */
router.get('/products', listAllProducts);
router.post(
  '/products/:id/moderate',
  adminMutationLimiter,
  param('id').isMongoId(),
  body('action').isIn(['hide', 'unhide', 'remove']),
  body('reason').optional().isString().isLength({ max: 500 }),
  validate, moderateProduct
);

/* Orders & escrow */
router.get('/orders', listAllOrders);
router.post(
  '/orders/:id/release-escrow',
  adminMutationLimiter,
  param('id').isMongoId(), validate, releaseEscrow
);
router.post(
  '/orders/:id/refund-escrow',
  adminMutationLimiter,
  param('id').isMongoId(),
  body('reason').isString().isLength({ min: 2, max: 500 }),
  validate, refundEscrow
);

/* Subscription plans */
router.get('/plans', listAllPlans);
router.post(
  '/plans',
  adminMutationLimiter,
  body('code').isString().trim().isLength({ min: 2, max: 30 }),
  body('name').isString().trim().isLength({ min: 2, max: 60 }),
  body('price').isFloat({ min: 0 }),
  body('feePct').isFloat({ min: 0, max: 100 }),
  body('maxListings').optional({ values: 'falsy' }).isInt({ min: 1, max: 100000 }),
  body('features').optional().isArray(),
  validate, upsertPlan
);
router.delete('/plans/:id', param('id').isMongoId(), validate, deletePlan);

/* Settings */
router.get('/settings', getSettings);
router.patch(
  '/settings',
  adminMutationLimiter,
  body('platformName').optional().isString().isLength({ max: 60 }),
  body('defaultEscrowFeePct').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('sellerOnboardingFee').optional().isFloat({ min: 0, max: 100000 }).toFloat(),
  body('supportEmail').optional({ values: 'falsy' }).isEmail(),
  body('announcement').optional().isString().isLength({ max: 500 }),
  body('maintenanceMode').optional().isBoolean(),
  validate, updateSettings
);

/* Reports & audit */
router.get('/audit', listAuditLog);
router.get(
  '/reports/sales',
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  validate, salesReport
);

/* Notifications (bell popover) */
router.get('/notifications', listNotifications);

/* Student verification queue */
router.get('/verification/students', listStudentVerifications);
router.post(
  '/verification/students/:id/decide',
  adminMutationLimiter,
  param('id').isMongoId(),
  body('decision').isIn(['approved', 'rejected']),
  body('reason').optional().isString().isLength({ max: 500 }),
  validate, decideStudentVerification
);

/* Support inbox */
router.get('/support/tickets', listTickets);
router.post(
  '/support/tickets/:id/reply',
  adminMutationLimiter,
  param('id').isMongoId(),
  body('body').isString().trim().isLength({ min: 1, max: 4000 }),
  validate, replyTicket
);
router.post(
  '/support/tickets/:id/close',
  adminMutationLimiter,
  param('id').isMongoId(),
  validate, closeTicket
);

/* Chats moderation */
router.get('/chats', listAllChats);
router.get('/chats/:id', param('id').isMongoId(), validate, getAdminChat);
router.post(
  '/chats/:id/close',
  adminMutationLimiter,
  param('id').isMongoId(),
  body('reason').optional().isString().isLength({ max: 200 }),
  validate, closeChat
);

export default router;
