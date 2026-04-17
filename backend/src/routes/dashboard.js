// dashboard.js
'use strict';

const express     = require('express');
const router      = express.Router();

const db          = require('../config/database');
const wrap        = require('../middleware/asyncWrapper');
const activitySvc = require('../services/activityService');

// GET /api/dashboard/stats
router.get('/stats', wrap(async (req, res) => {
  const [repoCount, userCount, groupCount, commitsToday] = await Promise.all([
    db.query('SELECT COUNT(*) FROM repositories WHERE is_active = true'),
    db.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
    db.query('SELECT COUNT(*) FROM groups'),
    activitySvc.countCommitsToday(db),
  ]);

  res.json({
    repositories:  parseInt(repoCount.rows[0].count, 10),
    users:         parseInt(userCount.rows[0].count, 10),
    groups:        parseInt(groupCount.rows[0].count, 10),
    commitsToday,
  });
}));

// GET /api/dashboard/recent-commits?limit=20
router.get('/recent-commits', wrap(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const rows  = await activitySvc.getGlobalActivity(db, { limit, offset: 0 });
  res.json(rows);
}));

// GET /api/dashboard/commits-chart?days=7
router.get('/commits-chart', wrap(async (req, res) => {
  const days = Math.min(parseInt(req.query.days || '7', 10), 90);
  const rows = await activitySvc.getCommitsPerDay(db, days);
  res.json(rows);
}));

module.exports = router;
