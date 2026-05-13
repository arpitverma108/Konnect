'use strict';

const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// ✅ Required for health API
const db = require('../config/database');
const redis = require('../config/redis');

const { execFile } = require('child_process');
const { promisify } = require('util');
const wrap = require('../middleware/asyncWrapper');
const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────
// ⚙️ SETTINGS API (SUPER ADMIN ONLY)
// ─────────────────────────────────────────────

router.get('/', auth, authorize('super_admin'), (req, res) => {
  res.json({
    svnRepoPath: process.env.SVN_REPO_PATH || null,
    htpasswdPath: process.env.HTPASSWD_PATH || null,
    authzPath: process.env.AUTHZ_PATH || null,
    apacheReloadCmd: process.env.APACHE_RELOAD_CMD || null
  });
});

// ─────────────────────────────────────────────
// 🩺 HEALTH API (PRODUCTION MONITORING)
// ─────────────────────────────────────────────

router.get('/health/detailed', auth, wrap(async (req, res) => {
  let dbStatus = 'down';
  let svnStatus = 'down';

  // ✅ Check Database
  try {
    await db.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    console.error('DB health check failed:', err.message);
  }

  // ✅ Check SVN
  try {
    await execFileAsync('svn', ['--version']);
    svnStatus = 'available';
  } catch (err) {
    console.error('SVN health check failed:', err.message);
  }

  const status = {
    db: dbStatus,
    redis: redis.isAvailable() ? 'connected' : 'unavailable',
    svn: svnStatus,
    timestamp: new Date().toISOString()
  };

  // Return 503 if critical service is down
  const isHealthy = dbStatus === 'connected' && svnStatus === 'available';
  const httpStatus = isHealthy ? 200 : 503;

  res.status(httpStatus).json(status);
}));

// ─────────────────────────────────────────────
// 📊 SYSTEM STATS API (for Settings page — replaces hardcoded frontend data)
// ─────────────────────────────────────────────

router.get('/system-stats', auth, authorize('admin', 'super_admin'), wrap(async (req, res) => {
  const [repoResult, userResult, groupResult, activeUserResult] = await Promise.all([
    db.query('SELECT COUNT(*) FROM repositories WHERE is_active = true'),
    db.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
    db.query('SELECT COUNT(*) FROM groups'),
    db.query("SELECT COUNT(*) FROM users WHERE is_active = true AND role != 'viewer'"),
  ]);

  // Check SVN tools
  let svnToolsStatus = 'unavailable';
  try {
    await execFileAsync('svn', ['--version', '--quiet']);
    svnToolsStatus = 'available';
  } catch (_) {}

  // Check DB
  let dbStatus = 'disconnected';
  let credentialStorage = 'unknown';
  try {
    await db.query('SELECT 1');
    dbStatus = 'connected';
    credentialStorage = 'protected'; // bcrypt is always used
  } catch (_) {}

  // Check Redis
  const redis = require('../config/redis');
  const redisStatus = redis.isAvailable() ? 'connected' : 'unavailable';

  res.json({
    system: {
      environment: process.env.NODE_ENV || 'production',
      repositories: parseInt(repoResult.rows[0].count, 10),
      users: parseInt(userResult.rows[0].count, 10),
      groups: parseInt(groupResult.rows[0].count, 10),
      activeAdmins: parseInt(activeUserResult.rows[0].count, 10),
    },
    svn: {
      repositoryStorage: process.env.SVN_REPO_PATH ? 'configured' : 'not_configured',
      svnTools: svnToolsStatus,
      repositoryAccess: 'managed_by_backend',
      repoPath: process.env.SVN_REPO_PATH || null,
    },
    auth: {
      authentication: 'enabled',
      authorization: 'active',
      permissionSync: 'automatic',
      bcryptEnabled: true,
    },
    database: {
      status: dbStatus,
      credentialStorage,
      passwordSecurity: 'bcrypt_enabled',
      redis: redisStatus,
    },
  });
}));

// ─────────────────────────────────────────────
// 🔄 SYNC STATUS API (shows last sync time)
// ─────────────────────────────────────────────

router.get('/sync-status', auth, authorize('admin', 'super_admin'), wrap(async (req, res) => {
  const { rows } = await db.query(`
    SELECT MAX(created_at) AS last_sync FROM activity
  `);

  res.json({
    lastSync: rows[0]?.last_sync || null,
    permissionSyncMode: 'automatic',
    apacheReloadEnabled: !!process.env.APACHE_RELOAD_CMD,
  });
}));

module.exports = router;