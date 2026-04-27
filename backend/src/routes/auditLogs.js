'use strict';

const express = require('express');
const router = express.Router();

const db = require('../config/database');
const wrap = require('../middleware/asyncWrapper');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// 🔥 GET AUDIT LOGS (ADMIN ONLY)
router.get(
  '/',
  auth,
  authorize('admin', 'super_admin'),
  wrap(async (req, res) => {

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const { rows } = await db.query(`
      SELECT 
        al.id,
        al.action,
        al.entity,
        al.created_at,
        u.username
      FROM admin_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      count: rows.length,
      data: rows
    });
  })
);

module.exports = router;