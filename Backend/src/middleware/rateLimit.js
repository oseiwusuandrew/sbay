import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * General-purpose limiter applied to the whole API. Tuned to be
 * generous enough for SPA usage but to throttle obvious abuse.
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

/**
 * Tighter limiter for auth endpoints (register, login, password). The
 * intent is to make credential stuffing painful without blocking real
 * users on a flaky connection.
 */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Please try again shortly.' },
});

/** Even tighter limiter for the obscured admin login. */
export const adminAuthLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many admin login attempts.' },
});

/**
 * Admin write-path limiter — applied to mutation endpoints (delete user,
 * elevate admin, escrow refund, etc.). Generous for normal moderator
 * activity, restrictive enough to make automated scripted abuse loud.
 */
export const adminMutationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5-minute window
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many admin mutations in a short window — slow down.' },
});

/**
 * Customer-support submission limiter — applies to the public ticket
 * intake endpoint so a single IP can't flood the inbox.
 */
/** Photo uploads: generous for listing a few items, tight enough to stop storage abuse. */
export const imageUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many photo uploads. Please wait a few minutes and try again.' },
});

export const supportSubmitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10-minute window
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'You have sent too many support messages. Please wait a few minutes.' },
});
