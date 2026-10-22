import { Plan } from '../models/Plan.js';

export const PERIOD_DAYS = 30;

/**
 * The plan a seller is on right now. A paid plan counts until the end of
 * its paid period; after that the seller is on Free, whatever the stored
 * record says. There is no automatic renewal: paying again extends it.
 */
export function effectivePlanCode(user, now = Date.now()) {
  const sub = user?.subscription;
  if (!sub?.plan || sub.plan === 'free') return 'free';
  if (sub.status === 'expired') return 'free';
  if (!sub.renewsAt || new Date(sub.renewsAt).getTime() < now) return 'free';
  return sub.plan;
}

/** The Plan document for a user, falling back to Free (or nothing if plans aren't seeded). */
export async function effectivePlan(user) {
  const code = effectivePlanCode(user);
  return (await Plan.findOne({ code }).lean()) || (code === 'free' ? null : Plan.findOne({ code: 'free' }).lean());
}

/**
 * Apply a successful plan payment. Idempotent per Paystack reference.
 * Paying for the plan you're already on extends it; a different plan
 * starts a fresh period today.
 */
export function applyPlanPayment(user, planCode, reference, now = new Date()) {
  const sub = user.subscription || {};
  if (sub.lastRef === reference) return false;
  const current = effectivePlanCode(user, now.getTime());
  const start = current === planCode && sub.renewsAt ? new Date(sub.renewsAt) : now;
  user.subscription = {
    plan: planCode,
    status: 'active',
    startedAt: current === planCode && sub.startedAt ? sub.startedAt : now,
    renewsAt: new Date(start.getTime() + PERIOD_DAYS * 864e5),
    lastRef: reference,
  };
  return true;
}
