// activity.js
'use strict';

const express      = require('express');
const router       = express.Router();

const db           = require('../config/database');
const wrap         = require('../middleware/asyncWrapper');
const activitySvc  = require('../services/activityService');

// GET /api/activity?limit=50&offset=0
router.get('/', wrap(async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50',  10), 200);
  const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);
  const rows   = await activitySvc.getGlobalActivity(db, { limit, offset });
  res.json(rows);
}));

// GET /api/activity/repo/:repoId
router.get('/repo/:repoId', wrap(async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50',  10), 200);
  const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);
  const rows   = await activitySvc.getRepoActivity(db, req.params.repoId, { limit, offset });
  res.json(rows);
}));

module.exports = router;
