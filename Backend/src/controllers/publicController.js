import { Plan } from '../models/Plan.js';
import { Settings } from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { CATEGORIES } from '../config/catalog.js';

/** GET /api/plans — public so the pricing page can render without auth. */
export const listPlans = asyncHandler(async (_req, res) => {
  const plans = await Plan.find({ active: true }).sort({ sortOrder: 1, price: 1 });
  res.json({ plans });
});

/** GET /api/settings/public — non-sensitive platform config. */
export const publicSettings = asyncHandler(async (_req, res) => {
  const s = await Settings.getSingleton();
  res.json({
    settings: {
      platformName: s.platformName,
      defaultEscrowFeePct: s.defaultEscrowFeePct,
      sellerOnboardingFee: s.sellerOnboardingFee,
      supportEmail: s.supportEmail,
      announcement: s.announcement,
      maintenanceMode: s.maintenanceMode,
    },
    categories: CATEGORIES,
  });
});
