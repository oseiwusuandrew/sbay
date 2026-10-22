import http from 'http';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { buildApp } from './app.js';
import { initSocket } from './socket.js';
import { seedAdminIfNeeded } from './seed/seedAdmin.js';
import { seedPlansIfNeeded } from './seed/seedPlans.js';
import { repairListings } from './seed/repairListings.js';
import { migrateInlineImages } from './seed/migrateImages.js';

async function runHousekeeping() {
  for (const [name, task] of [['repair', repairListings], ['migrate', migrateInlineImages]]) {
    try {
      await task();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[${name}] failed:`, err.message);
    }
  }
}

async function main() {
  // 1. Connect to MongoDB before we accept any HTTP traffic.
  await connectDB();
  // eslint-disable-next-line no-console
  console.log('[db] connected');

  // 2. First-boot seeds (admin user, default plans). No-ops if data exists.
  await seedAdminIfNeeded();
  await seedPlansIfNeeded();

  // 3. Build the Express app, wrap in HTTP server, attach Socket.IO.
  const app = buildApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://localhost:${env.PORT} (env=${env.NODE_ENV})`);

    // eslint-disable-next-line no-console
    console.log('[socket] Socket.IO attached');

    // 4. Housekeeping runs after the port is open: the host's health check
    // must not wait on it (moving many inline photos can take minutes).
    // Failures are logged and retried on the next start.
    runHousekeeping();
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n[server] received ${signal}, shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref(); // hard-exit if hang
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[boot] fatal:', err);
  process.exit(1);
});
