'use strict';

require('dotenv').config();

const app = require('./src/app');
const { validateEnv } = require('./src/config/env');
const db = require('./src/config/database');

// Validate environment variables on startup
validateEnv();

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Test database connection
    await db.query('SELECT 1');
    console.log('✅ PostgreSQL connection established');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️ SIGTERM received — shutting down gracefully');
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️ SIGINT received — shutting down gracefully');
  await db.end();
  process.exit(0);
});

start();