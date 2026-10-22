import { User } from '../models/User.js';
import { signAccessToken } from '../utils/jwt.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { emitToAdmins } from '../socket.js';
import { env } from '../config/env.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../utils/email.js';
import crypto from 'crypto';
import validator from 'validator';
import { assertPassword } from '../utils/password.js';
import { normalizePhone } from '../utils/phone.js';

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function frontendUrl() {
  const firstAllowed = env.CORS_ORIGINS?.[0];
  return (process.env.FRONTEND_URL || firstAllowed || 'http://localhost:5173').replace(/\/$/, '');
}

/**
 * Public sign-up. Always creates a `buyer`. Becoming a seller happens
 * later through `/api/users/me/become-seller`. Admins are NEVER created
 * via this endpoint — only via the seed script or by another admin.
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, location, role } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new HttpError(409, 'An account with this email already exists');
  assertPassword(password, { email, name });

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    phone: normalizePhone(phone),
    location: location?.trim(),
    role: 'buyer',
  });

  const token = signAccessToken(user);

  // Send welcome email
  await sendWelcomeEmail(user).catch(err => {
    console.error('Failed to send welcome email:', err);
    // Don't fail registration if email fails
  });

  emitToAdmins('user:new', {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    message: `${user.name} just joined sBay.`,
  });

  res.status(201).json({ token, user });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw new HttpError(401, 'Invalid email or password');

  const ok = await user.checkPassword(password);
  if (!ok) throw new HttpError(401, 'Invalid email or password');

  if (user.restricted) throw new HttpError(403, 'Account is restricted', { reason: user.restrictReason });

  user.lastLoginAt = new Date();
  await user.save();

  const token = signAccessToken(user);
  res.json({ token, user });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');
  const ok = await user.checkPassword(currentPassword);
  if (!ok) throw new HttpError(400, 'Current password is incorrect');
  assertPassword(newPassword, user);
  if (await user.checkPassword(newPassword)) throw new HttpError(400, 'Choose a password you are not already using.');
  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();
  res.json({ ok: true });
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+resetPasswordTokenHash +resetPasswordExpiresAt');

  // Always return ok so attackers cannot enumerate accounts.
  if (!user) return res.json({ ok: true });

  const token = crypto.randomBytes(32).toString('hex');
  user.resetPasswordTokenHash = hashResetToken(token);
  user.resetPasswordExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const resetUrl = `${frontendUrl()}/forgot-password?token=${token}&email=${encodeURIComponent(user.email)}`;
  await sendPasswordResetEmail(user, resetUrl);

  res.json({
    ok: true,
    ...(env.NODE_ENV === 'production' ? {} : { resetUrl }),
  });
});

export const resetPasswordWithToken = asyncHandler(async (req, res) => {
  const { email, token, newPassword } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +resetPasswordTokenHash +resetPasswordExpiresAt');
  if (!user || !user.resetPasswordTokenHash || !user.resetPasswordExpiresAt) {
    throw new HttpError(400, 'Reset link is invalid or expired.');
  }
  if (user.resetPasswordExpiresAt.getTime() < Date.now()) {
    throw new HttpError(400, 'Reset link is invalid or expired.');
  }
  if (hashResetToken(token) !== user.resetPasswordTokenHash) {
    throw new HttpError(400, 'Reset link is invalid or expired.');
  }
  assertPassword(newPassword, user);

  user.passwordHash = await User.hashPassword(newPassword);
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();

  res.json({ ok: true });
});

export const googleAuth = asyncHandler(async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken || typeof accessToken !== 'string') throw new HttpError(400, 'Google access token is required');

  let info;
  try {
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) throw new Error('userinfo fetch failed');
    info = await resp.json();
  } catch {
    throw new HttpError(401, 'Invalid Google access token');
  }
  if (!info?.email) throw new HttpError(400, 'Google account has no email');
  if (!info.email_verified) throw new HttpError(400, 'Your Google email is not verified. Please verify it first.');

  const { sub: googleId, name, picture } = info;
  const email = info.email.toLowerCase();
  // Email sign-ups are stored via express-validator's normalizeEmail
  // (which strips dots from Gmail addresses), so look up both forms or a
  // returning user gets a duplicate account / duplicate-key error.
  const normalized = validator.normalizeEmail(email) || email;

  // NOTE: the client-sent `role` is ignored. Becoming a seller must go
  // through /users/me/become-seller (payout details, verification and the
  // onboarding fee) — the frontend routes sellers there after sign-in.
  let user = await User.findOne({ $or: [{ googleId }, { email: { $in: [email, normalized] } }] });

  if (user) {
    if (user.restricted) throw new HttpError(403, 'Account is restricted', { reason: user.restrictReason });
    if (!user.googleId) {
      user.googleId = googleId;
      if (!user.avatar && picture) user.avatar = picture;
    }
    user.lastLoginAt = new Date();
    await user.save();
  } else {
    user = await User.create({
      name: name?.trim() || email.split('@')[0],
      email: normalized,
      googleId,
      avatar: picture || undefined,
      role: 'buyer',
    });
    
    // Send welcome email for new Google sign-ups
    await sendWelcomeEmail(user).catch(err => {
      console.error('Failed to send welcome email:', err);
    });
    
    emitToAdmins('user:new', {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      message: `${user.name} just joined sBay via Google.`,
    });
  }

  const token = signAccessToken(user);
  res.json({ token, user });
});
