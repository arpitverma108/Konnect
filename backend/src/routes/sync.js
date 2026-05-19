'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const db = require('../config/database');
const activitySvc = require('../services/activityService');
const logger = require('../config/logger');
const { logActivity, ACTIVITY_TYPES } = require('../services/activityLogger');

const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const wrap = require('../middleware/asyncWrapper');

const pLimit = require('p-limit');
const limit = pLimit(3); // max 3 repos processed concurrently

// ─────────────────────────────────────────────
// FIX 3.3: Dedicated rate limit for sync route.
// Prevents admins from hammering the CPU with repeated syncs.
// Max 1 call per 5 minutes.
// ─────────────────────────────────────────────
const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1,
  message: { error: 'Sync is rate limited. Please wait 5 minutes between sync calls.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────
// FIX 3.3: SYNC_SECRET check is now UNCONDITIONAL.
// The secret check runs BEFORE the role check so it acts as a
// secondary auth factor. This prevents any authenticated admin
// from triggering a full sync without also knowing the secret.
// ─────────────────────────────────────────────
router.post(
  '/',
  syncLimiter,                        // ← rate limit first
  (req, res, next) => {               // ← secret check BEFORE auth
    const headerSecret = req.headers['x-sync-secret'];
    if (!headerSecret || headerSecret !== process.env.SYNC_SECRET) {
      return res.status(403).json({ error: 'Invalid sync secret' });
    }
    next();
  },
  auth,
  authorize('admin', 'super_admin'),
  wrap(async (req, res) => {
    const startTime = Date.now();
    const { rows: repos } = await db.query(
      'SELECT id, disk_path FROM repositories'
    );

    if (!repos.length) {
      return res.json({ message: 'No repositories found' });
    }

    // Process repos with controlled concurrency
    const results = await Promise.allSettled(
      repos.map((repo) =>
        limit(() =>
          activitySvc.syncRepoActivity(db, repo.id, repo.disk_path, 50)
        )
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount  = results.filter(r => r.status === 'rejected').length;
    const duration = Date.now() - startTime;

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          `Sync failed for repo ${repos[index].id}: ${result.reason?.message || result.reason}`
        );
      }
    });

    logger.info(`Activity sync completed: ${successCount} success, ${failedCount} failed`);

    // 📊 Log sync activity
    await logActivity(db, {
      event_type: ACTIVITY_TYPES.SYNC_RUN,
      user_id: req.user.id,
      action: `Sync completed: ${successCount} repos synced, ${failedCount} failed`,
      entity: 'system',
      metadata: {
        repos_synced: successCount,
        repos_failed: failedCount,
        total_repos: repos.length,
        duration_ms: duration,
        status: failedCount === 0 ? 'success' : 'partial_failure',
      },
    });

    return res.json({
      message: 'Activity sync completed',
      total: repos.length,
      success: successCount,
      failed: failedCount,
    });
  })
);

module.exports = router;