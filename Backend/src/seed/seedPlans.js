import { Plan } from '../models/Plan.js';

/**
 * Default seller plans, inserted on first boot. Admins edit them from the
 * admin panel afterwards. The listing limit and buyer fee are shown on the
 * plan card automatically, so `features` holds only extra, real benefits.
 */
const DEFAULT_PLANS = [
  { code: 'free', name: 'Free', tag: 'To get started', price: 0, feePct: 7, maxListings: 5, features: [], sortOrder: 0 },
  {
    code: 'plus', name: 'Plus', tag: 'For regular sellers', price: 25, feePct: 5, maxListings: 50,
    features: ['Lower fee makes your prices more competitive'], highlight: true, sortOrder: 1,
  },
  {
    code: 'pro', name: 'Pro', tag: 'For shops', price: 75, feePct: 3, maxListings: null,
    features: ['Lowest fee for your buyers'], sortOrder: 2,
  },
];

// Feature lists from earlier versions promised things the platform never
// did (featured placement, custom URLs, 24/7 support). Plans still carrying
// one of these exact lists are corrected; plans an admin edited are left alone.
const LEGACY_FEATURES = {
  free: ['Up to 5 active listings', 'Basic profile', 'Standard support'],
  plus: ['Up to 50 listings', 'Featured weekly', 'Priority support', 'Verified badge eligibility'],
  pro: ['Unlimited listings', 'Top placement', '24/7 support', 'Verified badge', 'Custom store URL'],
};

export async function seedPlansIfNeeded() {
  const count = await Plan.countDocuments({});
  if (count === 0) {
    await Plan.insertMany(DEFAULT_PLANS.map((p) => ({ ...p, active: true })));
    // eslint-disable-next-line no-console
    console.log(`[seed] Inserted ${DEFAULT_PLANS.length} default subscription plans`);
    return;
  }

  for (const def of DEFAULT_PLANS) {
    const legacy = LEGACY_FEATURES[def.code];
    const plan = await Plan.findOne({ code: def.code });
    if (!plan || !legacy || JSON.stringify(plan.features) !== JSON.stringify(legacy)) continue;
    plan.features = def.features;
    if (plan.maxListings === null || plan.maxListings === undefined) plan.maxListings = def.maxListings;
    await plan.save();
    // eslint-disable-next-line no-console
    console.log(`[seed] Corrected the ${def.name} plan's feature list`);
  }
}
