'use strict';

const express = require('express');
const router = express.Router();

const db = require('../config/database');
const wrap = require('../middleware/asyncWrapper');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const redis = require('../config/redis');

// ─────────────────────────────────────────────
// GET /api/activity/repo/:repoId
// Per-repo activity — uses checkPermission for access control
// ─────────────────────────────────────────────

router.get(
  '/repo/:repoId',
  auth,
  checkPermission('read'),
  wrap(async (req, res) => {

    const { repoId } = req.params;
    const limit  = Math.min(parseInt(req.query.limit) || 10, 50);
    const cursor = req.query.cursor;
    const { author, from, to } = req.query;

    const cacheKey = `activity:${req.user.id}:${repoId}:${cursor || 'first'}:${author || ''}:${from || ''}:${to || ''}`;

    if (redis.isAvailable()) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return res.json(cached);
      } catch {}
    }

    const repo = await db.query(
      'SELECT id, name FROM repositories WHERE id=$1',
      [repoId]
    );

    if (!repo.rows.length) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    let query = `
      SELECT revision, author, message, committed_at, paths_changed
      FROM activity
      WHERE repo_id = $1
    `;

    const values = [repoId];
    let index = 2;

    if (author) { query += ` AND author = $${index++}`; values.push(author); }
    if (from)   { query += ` AND committed_at >= $${index++}`; values.push(from); }
    if (to)     { query += ` AND committed_at <= $${index++}`; values.push(to); }
    if (cursor) { query += ` AND committed_at < $${index++}`; values.push(cursor); }

    query += ` ORDER BY committed_at DESC, revision DESC LIMIT $${index}`;
    values.push(limit);

    const { rows } = await db.query(query, values);

    const nextCursor = rows.length ? rows[rows.length - 1].committed_at : null;

    const response = {
      repository:  repo.rows[0].name,
      count:       rows.length,
      nextCursor,
      activity: rows.map(r => ({
        revision:      r.revision,
        author:        r.author,
        short_message: r.message?.slice(0, 100),
        committed_at:  r.committed_at,
        files_changed: r.paths_changed,
      })),
    };

    if (redis.isAvailable()) {
      try { await redis.set(cacheKey, response, 60); } catch {}
    }

    res.json(response);
  })
);

// ─────────────────────────────────────────────
// GET /api/activity?limit=50&cursor=
// Global activity feed
//
// BUG FIX: The original query filtered activity through the permissions
// table using a subquery. This returned 0 rows for super_admin and admin
// users because those roles have no rows in the permissions table —
// permissions are only added for regular users/groups.
//
// FIX: admin + super_admin bypass the permissions filter entirely and
// see ALL activity. Regular users still go through the permissions subquery.
// ─────────────────────────────────────────────

router.get(
  '/',
  auth,
  wrap(async (req, res) => {

    const limit  = Math.min(parseInt(req.query.limit) || 10, 50);
    const cursor = req.query.cursor;

    const cacheKey = `activity:global:${req.user.id}:${cursor || 'first'}`;

    if (redis.isAvailable()) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return res.json(cached);
      } catch {}
    }

    const isAdminOrAbove = ['admin', 'super_admin'].includes(req.user.role);

    // Build query — admins see everything, viewers see only permitted repos
    let query;
    let values;
    let index;

    if (isAdminOrAbove) {
      // ✅ Admins/super_admins: no permission filter, see all repos
      query = `
        SELECT
          a.repo_id,
          r.name AS repo_name,
          a.revision,
          a.author,
          a.message,
          a.committed_at
        FROM activity a
        JOIN repositories r ON r.id = a.repo_id
      `;
      values = [];
      index  = 1;

    } else {
      // Regular users: filter by repos they have explicit permission on
      query = `
        SELECT
          a.repo_id,
          r.name AS repo_name,
          a.revision,
          a.author,
          a.message,
          a.committed_at
        FROM activity a
        JOIN repositories r ON r.id = a.repo_id
        WHERE a.repo_id IN (
          SELECT repo_id FROM permissions
          WHERE
            (subject_type = 'user' AND subject_id = $1)
            OR
            (subject_type = 'group' AND subject_id IN (
              SELECT group_id FROM group_members WHERE user_id = $1
            ))
        )
      `;
      values = [req.user.id];
      index  = 2;
    }

    if (cursor) {
      query += (values.length ? ' AND' : ' WHERE') + ` a.committed_at < $${index++}`;
      values.push(cursor);
    }

    query += ` ORDER BY a.committed_at DESC, a.revision DESC LIMIT $${index}`;
    values.push(limit);

    const { rows } = await db.query(query, values);

    const nextCursor = rows.length ? rows[rows.length - 1].committed_at : null;

    const response = {
      count: rows.length,
      nextCursor,
      activity: rows.map(r => ({
        repo:          r.repo_name,
        revision:      r.revision,
        author:        r.author,
        short_message: r.message?.slice(0, 100),
        committed_at:  r.committed_at,
      })),
    };

    if (redis.isAvailable()) {
      try { await redis.set(cacheKey, response, 30); } catch {}
    }

    res.json(response);
  })
);

module.exports = router;