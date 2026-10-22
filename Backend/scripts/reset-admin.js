/**
 * Admin recovery: `npm run reset:admin`
 *
 * Sets the password of SEED_ADMIN_EMAIL to SEED_ADMIN_PASSWORD and makes
 * that account an unrestricted admin, creating it if it doesn't exist.
 * Unlike the boot-time seed, this overwrites an existing account, so use
 * it when the admin was never seeded, the password is lost, or the email
 * already belonged to a non-admin.
 *
 * Reads MONGO_URI, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (and optionally
 * SEED_ADMIN_NAME) from the environment or Backend/.env. The password is
 * never taken from argv, so it stays out of shell history.
 */

// env.js refuses to load without JWT_SECRET; this script never signs tokens.
process.env.JWT_SECRET ||= 'reset-admin-script-unused';

const { env } = await import('../src/config/env.js');
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { User } = await import('../src/models/User.js');

const email = env.SEED_ADMIN_EMAIL.trim();
const password = env.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('[reset-admin] Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD first.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('[reset-admin] SEED_ADMIN_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

await connectDB();

const passwordHash = await User.hashPassword(password);
const existing = await User.findOne({ email });

if (existing) {
  const before = existing.role;
  Object.assign(existing, {
    passwordHash, role: 'admin', verified: true,
    restricted: false, restrictReason: undefined, restrictedAt: undefined, restrictedBy: undefined,
  });
  await existing.save();
  console.log(`[reset-admin] Updated ${email}: password reset, role ${before} -> admin.`);
} else {
  await User.create({ name: env.SEED_ADMIN_NAME, email, passwordHash, role: 'admin', verified: true });
  console.log(`[reset-admin] Created admin ${email}.`);
}

await disconnectDB();
