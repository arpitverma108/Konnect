'use strict';

const express = require('express');
const router = express.Router();

const db = require('../config/database');
const wrap = require('../middleware/asyncWrapper');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// ✅ FIXED REDIS IMPORT
const { redis, isRedisAvailable } = require('../config/redis');

// ─────────────────────────────────────────────
// 🔥 GET ACTIVITY BY REPO
// ─────────────────────────────────────────────

router.get(
  '/repo/:repoId',
  auth,
  checkPermission('read'),
  wrap(async (req, res) => {

    const { repoId } = req.params;

    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const cursor = req.query.cursor;
    const { author, from, to } = req.query;

    const cacheKey = `activity:${req.user.id}:${repoId}:${cursor || 'first'}:${author || ''}:${from || ''}:${to || ''}`;

    // ✅ Cache (SAFE)
    if (isRedisAvailable()) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
      } catch {}
    }

    // ✅ Check repo exists
    const repo = await db.query(
      'SELECT id, name FROM repositories WHERE id=$1',
      [repoId]
    );

    if (!repo.rows.length) {
      return res.status(404).json({ error: "Repository not found" });
    }

    // ✅ Query
    let query = `
      SELECT revision, author, message, committed_at, paths_changed
      FROM activity
      WHERE repo_id = $1
    `;

    const values = [repoId];
    let index = 2;

    if (author) {
      query += ` AND author = $${index++}`;
      values.push(author);
    }

    if (from) {
      query += ` AND committed_at >= $${index++}`;
      values.push(from);
    }

    if (to) {
      query += ` AND committed_at <= $${index++}`;
      values.push(to);
    }

    if (cursor) {
      query += ` AND committed_at < $${index++}`;
      values.push(cursor);
    }

    query += `
      ORDER BY committed_at DESC, revision DESC
      LIMIT $${index}
    `;

    values.push(limit);

    const { rows } = await db.query(query, values);

    const nextCursor = rows.length
      ? rows[rows.length - 1].committed_at
      : null;

    const response = {
      repository: repo.rows[0].name,
      count: rows.length,
      nextCursor,
      activity: rows.map(r => ({
        revision: r.revision,
        author: r.author,
        short_message: r.message?.slice(0, 100),
        committed_at: r.committed_at,
        files_changed: r.paths_changed
      }))
    };

    // ✅ Cache write
    if (isRedisAvailable()) {
      try {
        await redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
      } catch {}
    }

    res.json(response);
  })
);

// ─────────────────────────────────────────────
// 🔥 GLOBAL ACTIVITY (FIXED PERMISSION BUG)
// ─────────────────────────────────────────────

router.get(
  '/',
  auth,
  wrap(async (req, res) => {

    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const cursor = req.query.cursor;

    const cacheKey = `activity:global:${req.user.id}:${cursor || 'first'}`;

    // ✅ Cache read
    if (isRedisAvailable()) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
      } catch {}
    }

    let query = `
      SELECT DISTINCT
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

    const values = [req.user.id];
    let index = 2;

    if (cursor) {
      query += ` AND a.committed_at < $${index++}`;
      values.push(cursor);
    }

    query += `
      ORDER BY a.committed_at DESC, a.revision DESC
      LIMIT $${index}
    `;

    values.push(limit);

    const { rows } = await db.query(query, values);

    const nextCursor = rows.length
      ? rows[rows.length - 1].committed_at
      : null;

    const response = {
      count: rows.length,
      nextCursor,
      activity: rows.map(r => ({
        repo: r.repo_name,
        revision: r.revision,
        author: r.author,
        short_message: r.message?.slice(0, 100),
        committed_at: r.committed_at
      }))
    };

    // ✅ Cache write
    if (isRedisAvailable()) {
      try {
        await redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
      } catch {}
    }

    res.json(response);
  })
);

module.exports = router;