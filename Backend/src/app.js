import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

import { env, isProd } from './config/env.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/error.js';
import { HttpError } from './utils/httpError.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import supportRoutes from './routes/supportRoutes.js';

export function buildApp() {
  const app = express();

  // ---- Security & hardening ----------------------------------------
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // honour X-Forwarded-For when behind a proxy
  app.use(helmet());
  app.use(compression());
  app.use(express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      if (req.originalUrl?.includes('/payments/webhook')) req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());                // strip $ / . from req bodies
  app.use(hpp());                          // HTTP parameter pollution

  // CORS — strict allowlist driven by env in production. In development,
  // any localhost / 127.0.0.1 origin is allowed regardless of port so
  // Vite can pick 5173, 5174, etc. without breaking the dev experience.
  const corsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true);              // server-side / curl
      if (env.CORS_ORIGINS.length === 0) return cb(null, true); // dev catch-all
      if (env.CORS_ORIGINS.includes(origin)) return cb(null, true);
      // Dev-mode escape hatch: any localhost origin is fine
      if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      return cb(new HttpError(403, `CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };
  app.use(cors(corsOptions));
  // Explicitly handle preflight for all routes
  app.options('*', cors(corsOptions));

  if (!isProd) app.use(morgan('dev'));

  // ---- Health ------------------------------------------------------
  app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // ---- API ---------------------------------------------------------
  app.use('/api', generalLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/chats', chatRoutes);
  app.use('/api', publicRoutes);                       // /api/plans, /api/settings
  app.use('/api/support', supportRoutes);              // public support ticket submission

  // Admin API mounted at obscured prefix from env.
  app.use(env.ADMIN_API_PREFIX, adminRoutes);

  // ---- 404 + error handler -----------------------------------------
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
