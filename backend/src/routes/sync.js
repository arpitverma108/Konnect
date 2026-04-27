'use strict';

const express = require('express');
const router = express.Router();

const db = require('../config/database');
const activitySvc = require('../services/activityService');
const logger = require('../config/logger');

const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Limit concurrency to avoid CPU spike
const pLimit = require('p-limit');
const limit = pLimit(3); // max 3 repos processed at once

// 🔥 SYNC ACTIVITY API (SECURED)
router.post(
  '/',
  auth,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      // 🔐 Optional: Allow webhook/cron using secret
      const syncSecret = process.env.SYNC_SECRET;
      if (syncSecret) {
        const headerSecret = req.headers['x-sync-secret'];
        if (!headerSecret || headerSecret !== syncSecret) {
          return res.status(403).json({ error: 'Invalid sync secret' });
        }
      }

      const { rows: repos } = await db.query(
        'SELECT id, disk_path FROM repositories'
      );

      if (!repos.length) {
        return res.json({ message: 'No repositories found' });
      }

      // ⚡ Process repos with controlled concurrency
      const results = await Promise.allSettled(
        repos.map((repo) =>
          limit(() =>
            activitySvc.syncRepoActivity(
              db,
              repo.id,
              repo.disk_path,
              50
            )
          )
        )
      );

      // 📊 Summary
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;

      // 🪵 Log failures (important for debugging)
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(
            `Sync failed for repo ${repos[index].id}: ${result.reason?.message || result.reason}`
          );
        }
      });

      logger.info(`Activity sync completed: ${successCount} success, ${failedCount} failed`);

      return res.json({
        message: 'Activity sync completed',
        total: repos.length,
        success: successCount,
        failed: failedCount
      });

    } catch (error) {
      logger.error('Sync route error:', error);

      return res.status(500).json({
        error: 'Activity sync failed'
      });
    }
  }
);

module.exports = router;