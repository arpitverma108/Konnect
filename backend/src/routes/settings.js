'use strict';

const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// ✅ Required for health API
const db = require('../config/database');
const { isRedisAvailable } = require('../config/redis');

const { execFile } = require('child_process');
const { promisify } = require('util');
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

router.get('/health/detailed', async (req, res) => {
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

  res.json({
    db: dbStatus,
    redis: isRedisAvailable(),
    svn: svnStatus,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;