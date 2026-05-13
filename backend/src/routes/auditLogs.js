'use strict';

const express = require('express');
const router = express.Router();

const db = require('../config/database');
const wrap = require('../middleware/asyncWrapper');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// ─────────────────────────────────────────────
// 🔥 GET ADMIN/USER-ACTION AUDIT LOGS
//    GET /api/audit-logs?limit=20&page=1&search=&user=
//
//    Supports BOTH ?page= (frontend) and ?offset= (direct API callers)
// ─────────────────────────────────────────────

router.get(
  '/',
  auth,
  authorize('admin', 'super_admin'),
  wrap(async (req, res) => {

    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);

    // Accept both ?page= (frontend convention) and ?offset= (API convention)
    let offset;
    if (req.query.page !== undefined) {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      offset = (page - 1) * limit;
    } else {
      offset = Math.max(parseInt(req.query.offset) || 0, 0);
    }

    const search = req.query.search || '';
    const user   = req.query.user   || '';

    const values = [];
    let where = 'WHERE 1=1';
    let idx = 1;

    if (search) {
      where += ` AND al.action ILIKE '%' || $${idx++} || '%'`;
      values.push(search);
    }

    if (user) {
      where += ` AND u.username ILIKE '%' || $${idx++} || '%'`;
      values.push(user);
    }

    const { rows } = await db.query(`
      SELECT
        al.id,
        al.action,
        al.entity,
        al.entity_id,
        al.created_at,
        u.username,
        u.role AS user_role
      FROM admin_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...values, limit, offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) AS total
      FROM admin_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${where}
    `, values);

    res.json({
      total:  parseInt(countResult.rows[0].total, 10),
      limit,
      offset,
      data:   rows,
    });
  })
);

// ─────────────────────────────────────────────
// 🔥 GET COMMIT AUTHORS (filter dropdown)
//    GET /api/audit-logs/commits/authors?repoId=
//    ⚠️  Must be defined BEFORE /commits/:repoId/:revision
// ─────────────────────────────────────────────

router.get(
  '/commits/authors',
  auth,
  authorize('admin', 'super_admin'),
  wrap(async (req, res) => {
    const { repoId } = req.query;
    let query = `SELECT DISTINCT author FROM activity WHERE author IS NOT NULL`;
    const values = [];

    if (repoId) {
      query += ` AND repo_id = $1`;
      values.push(repoId);
    }

    query += ` ORDER BY author`;
    const { rows } = await db.query(query, values);
    res.json(rows.map(r => r.author));
  })
);

// ─────────────────────────────────────────────
// 🔥 GET COMMIT AUDIT LOGS (who committed what files + message)
//    GET /api/audit-logs/commits?repoId=&author=&search=&from=&to=&limit=20&page=1
// ─────────────────────────────────────────────

router.get(
  '/commits',
  auth,
  authorize('admin', 'super_admin'),
  wrap(async (req, res) => {

    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);

    let offset;
    if (req.query.page !== undefined) {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      offset = (page - 1) * limit;
    } else {
      offset = Math.max(parseInt(req.query.offset) || 0, 0);
    }

    const repoId = req.query.repoId || null;
    const author = req.query.author || '';
    const search = req.query.search || '';
    const from   = req.query.from   || null;
    const to     = req.query.to     || null;

    const values = [];
    let where = 'WHERE 1=1';
    let idx = 1;

    if (repoId) {
      where += ` AND a.repo_id = $${idx++}`;
      values.push(repoId);
    }

    if (author) {
      where += ` AND a.author ILIKE '%' || $${idx++} || '%'`;
      values.push(author);
    }

    if (search) {
      where += ` AND a.message ILIKE '%' || $${idx++} || '%'`;
      values.push(search);
    }

    if (from) {
      where += ` AND a.committed_at >= $${idx++}`;
      values.push(from);
    }

    if (to) {
      where += ` AND a.committed_at <= $${idx++}`;
      values.push(to);
    }

    const { rows } = await db.query(`
      SELECT
        a.id,
        a.revision,
        a.author,
        a.message,
        a.committed_at,
        a.paths_changed,
        r.id   AS repo_id,
        r.name AS repo_name
      FROM activity a
      JOIN repositories r ON r.id = a.repo_id
      ${where}
      ORDER BY a.committed_at DESC, a.revision DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...values, limit, offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) AS total
      FROM activity a
      JOIN repositories r ON r.id = a.repo_id
      ${where}
    `, values);

    const parseFiles = (p) => {
      try {
        if (!p) return [];
        const parsed = typeof p === 'string' ? JSON.parse(p) : p;
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch { return []; }
    };

    res.json({
      total:  parseInt(countResult.rows[0].total, 10),
      limit,
      offset,
      data: rows.map(r => ({
        id:            r.id,
        revision:      r.revision,
        author:        r.author,
        message:       r.message,
        committed_at:  r.committed_at,
        repo_id:       r.repo_id,
        repo_name:     r.repo_name,
        files_changed: parseFiles(r.paths_changed),
      })),
    });
  })
);

// ─────────────────────────────────────────────
// 🔥 GET SINGLE COMMIT DETAIL (with diff)
//    GET /api/audit-logs/commits/:repoId/:revision
// ─────────────────────────────────────────────

router.get(
  '/commits/:repoId/:revision',
  auth,
  authorize('admin', 'super_admin'),
  wrap(async (req, res) => {

    const { repoId, revision } = req.params;
    const rev = parseInt(revision, 10);

    if (isNaN(rev) || rev < 0) {
      return res.status(400).json({ error: 'Invalid revision number' });
    }

    const { rows } = await db.query(`
      SELECT a.*, r.name AS repo_name, r.disk_path
      FROM activity a
      JOIN repositories r ON r.id = a.repo_id
      WHERE a.repo_id = $1 AND a.revision = $2
    `, [repoId, rev]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    const commit = rows[0];

    let diff = '';
    try {
      const svnSvc = require('../services/svnService');
      diff = await svnSvc.getRevisionDiff(commit.disk_path, rev);
    } catch (_) {}

    const parseFiles = (p) => {
      try {
        if (!p) return [];
        const parsed = typeof p === 'string' ? JSON.parse(p) : p;
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch { return []; }
    };

    res.json({
      id:            commit.id,
      revision:      commit.revision,
      author:        commit.author,
      message:       commit.message,
      committed_at:  commit.committed_at,
      repo_id:       commit.repo_id,
      repo_name:     commit.repo_name,
      files_changed: parseFiles(commit.paths_changed),
      diff,
    });
  })
);

module.exports = router;