'use strict';

const { Pool } = require('pg');

const isProd = process.env.NODE_ENV === 'production';

// 🔐 SSL config (required on many cloud providers like Render/Heroku/RDS)
const sslConfig = isProd
  ? { rejectUnauthorized: false } // adjust if you have proper CA certs
  : false;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'svnbridge',
  user: process.env.DB_USER || 'svnbridge_user',
  password: process.env.DB_PASSWORD || '',

  // 🔥 Pool tuning
  max: parseInt(process.env.DB_POOL_MAX || '20', 10), // max clients
  idleTimeoutMillis: 30000,       // close idle clients after 30s
  connectionTimeoutMillis: 5000,  // fail fast if DB not reachable

  ssl: sslConfig,
});

// ✅ When a new client connects
pool.on('connect', () => {
  console.log('✅ PostgreSQL client connected');
});

// ❌ Unexpected errors on idle clients
pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL error:', err);
});

// 🧪 Optional: quick health check (can be used in /health endpoint)
async function healthCheck() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    client.release();
  }
}

// 🧹 Graceful shutdown (important for PM2 / Docker / prod)
async function shutdown() {
  try {
    await pool.end();
    console.log('🛑 PostgreSQL pool closed');
  } catch (err) {
    console.error('Error during pool shutdown:', err);
  }
}

// Handle process signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = pool;
module.exports.healthCheck = healthCheck;