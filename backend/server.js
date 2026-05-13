'use strict';

require('dotenv').config();
require('./src/config/env'); // validates env automatically

const app  = require('./src/app');
const db   = require('./src/config/database');
const cron = require('node-cron'); // FIX N2: cleanup expired refresh tokens

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// FIX N2: Scheduled cleanup of expired/revoked refresh tokens.
// Runs every day at 03:00 AM server time.
// Without this the refresh_tokens table grows forever.
// ─────────────────────────────────────────────
function startTokenCleanupJob() {
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await db.query(
        `DELETE FROM refresh_tokens
         WHERE expires_at < NOW() OR revoked = true`
      );
      console.log(`[cron] Cleaned up ${result.rowCount} expired/revoked refresh tokens`);
    } catch (err) {
      console.error('[cron] Token cleanup failed:', err.message);
    }
  });

  console.log('✅ Token cleanup cron job scheduled (daily at 03:00)');
}

async function start() {
  try {
    await db.query('SELECT 1');
    console.log('✅ PostgreSQL connection established');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Start scheduled jobs after server is listening
    startTokenCleanupJob();

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();