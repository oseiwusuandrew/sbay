/**
 * Centralised environment loader.
 *
 * Loads `.env` once on import and validates the variables we depend on.
 * The rest of the codebase imports `env` from here so we never read
 * `process.env.X` directly outside of this module — that gives us one
 * place to add validation, defaults, and type-coercion.
 */
import 'dotenv/config';

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k] || !process.env[k].trim());
if (missing.length) {
  // We refuse to boot if a required secret is missing — that's the whole
  // point of validation. Helps catch deployment misconfiguration early.
  // eslint-disable-next-line no-console
  console.error(`[env] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const num = (key, fallback) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) ? v : fallback;
};

export const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: num('PORT', 4000),

  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  MONGO_URI: process.env.MONGO_URI,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  BCRYPT_ROUNDS: num('BCRYPT_ROUNDS', 10),

  SEED_ADMIN_EMAIL: (process.env.SEED_ADMIN_EMAIL || '').toLowerCase(),
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || '',
  SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME || 'Platform Admin',

  // Mounted at this prefix; not the obvious "/admin".
  ADMIN_API_PREFIX: process.env.ADMIN_API_PREFIX || '/api/_panel/control',

  RATE_LIMIT_WINDOW_MS: num('RATE_LIMIT_WINDOW_MS', 60_000),
  RATE_LIMIT_MAX: num('RATE_LIMIT_MAX', 120),
  AUTH_RATE_LIMIT_MAX: num('AUTH_RATE_LIMIT_MAX', 10),

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',

  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
  PAYSTACK_CALLBACK_URL: process.env.PAYSTACK_CALLBACK_URL || 'http://localhost:5173/payment-success',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Dev-only: lets /api/orders/checkout create orders without Paystack.
  // Ignored when NODE_ENV=production.
  ENABLE_MOCK_CHECKOUT: process.env.ENABLE_MOCK_CHECKOUT === 'true',

  // Email configuration
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',
  EMAIL_HOST: process.env.EMAIL_HOST || '',
  EMAIL_PORT: num('EMAIL_PORT', 465),
  EMAIL_SECURE: process.env.EMAIL_SECURE !== 'false',

  // SMS configuration
  // Option 1: Twilio (Recommended - $15 free credits)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  
  // Option 2: Africa's Talking or Hubtel
  SMS_API_KEY: process.env.SMS_API_KEY || '',
  SMS_USERNAME: process.env.SMS_USERNAME || '',
  SMS_SENDER_ID: process.env.SMS_SENDER_ID || 'sBay',
});

export const isProd = env.NODE_ENV === 'production';
