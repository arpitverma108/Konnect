'use strict';

const express = require('express');
const router  = express.Router();

const db              = require('../config/database');
const wrap            = require('../middleware/asyncWrapper');
const auth            = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const redis           = require('../config/redis');
const {
  formatActivityForResponse,
  EVENT_CATEGORIES,
  EVENT_SEVERITY,
  EVENT_ICONS,
} = require('../services/activityLogger');

// ─────────────────────────────────────────────────────────────────────────────
// Shared SELECT — joins users so we get actor names for non-SVN events
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVITY_SELECT = `
  SELECT
    a.id,
    a.repo_id,
    r.name        AS repo_name,
    a.revision,
    a.author,
    u.username    AS username,
    a.message,
    a.committed_at,
    a.event_type,
    a.action,
    a.entity,
    a.entity_id,
    a.user_id,
    a.metadata,
    a.created_at,
    a.paths_changed
  FROM activity a
  LEFT JOIN repositories r ON r.id = a.repo_id
  LEFT JOIN users        u ON u.id = a.user_id
`;

// Ordering that works for both SVN (committed_at) and system events (created_at only)
const ACTIVITY_ORDER = `ORDER BY COALESCE(a.committed_at, a.created_at) DESC, a.id DESC`;

function formatRow(r) {
  const eventType = r.event_type || 'commit';
  // Canonical actor — username from user_id JOIN wins over legacy SVN author
  const actor     = r.username || r.author || null;

  return {
    id:           r.id,
    event_type:   eventType,
    category:     EVENT_CATEGORIES[eventType] || 'Repository',
    severity:     EVENT_SEVERITY[eventType]   || 'info',
    icon:         EVENT_ICONS[eventType]      || 'GitCommit',

    // Structured filter fields — frontend should use these directly
    actor,
    repo:         r.repo_name || null,
    repo_name:    r.repo_name || null,
    repo_id:      r.repo_id   || null,
    user_id:      r.user_id   || null,

    revision:     r.revision,
    // `message` is the human-readable action description
    message:      r.action || r.message?.slice(0, 200) || null,
    committed_at: r.committed_at,
    created_at:   r.created_at,
    entity:       r.entity,
    entity_id:    r.entity_id,
    files_changed: r.paths_changed,
    metadata:     (typeof r.metadata === 'string'
                    ? (r.metadata ? JSON.parse(r.metadata) : {})
                    : (r.metadata || {})),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/activity/repo/:repoId — per-repo activity
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/repo/:repoId',
  auth,
  checkPermission('read'),
  wrap(async (req, res) => {
    const { repoId } = req.params;
    const limit  = Math.min(parseInt(req.query.limit) || 10, 50);
    const cursor = req.query.cursor; // ISO timestamp
    const { actor, from, to, event_type } = req.query;

    const cacheKey = `activity:repo:${req.user.id}:${repoId}:${cursor || 'first'}:${actor || ''}:${from || ''}:${to || ''}:${event_type || ''}`;
    if (redis.isAvailable()) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return res.json(cached);
      } catch {}
    }

    const repo = await db.query('SELECT id, name FROM repositories WHERE id=$1', [repoId]);
    if (!repo.rows.length) return res.status(404).json({ error: 'Repository not found' });

    let query  = `${ACTIVITY_SELECT} WHERE a.repo_id = $1`;
    const values = [repoId];
    let index    = 2;

    // actor filter — match username OR svn author
    if (actor) {
      query += ` AND (u.username ILIKE '%' || $${index} || '%' OR a.author ILIKE '%' || $${index} || '%')`;
      values.push(actor);
      index++;
    }
    if (event_type) { query += ` AND a.event_type = $${index++}`;                              values.push(event_type); }
    if (from)       { query += ` AND COALESCE(a.committed_at, a.created_at) >= $${index++}`;   values.push(from); }
    if (to)         { query += ` AND COALESCE(a.committed_at, a.created_at) <= $${index++}`;   values.push(to); }
    if (cursor)     { query += ` AND COALESCE(a.committed_at, a.created_at) < $${index++}`;    values.push(cursor); }

    query += ` ${ACTIVITY_ORDER} LIMIT $${index}`;
    values.push(limit);

    const { rows } = await db.query(query, values);
    const lastRow  = rows[rows.length - 1];
    const nextCursor = lastRow
      ? (lastRow.committed_at || lastRow.created_at)
      : null;

    const response = {
      repository: repo.rows[0].name,
      count:      rows.length,
      nextCursor,
      activity:   rows.map(formatRow),
    };

    if (redis.isAvailable()) {
      try { await redis.set(cacheKey, response, 60); } catch {}
    }

    res.json(response);
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/activity — global activity feed
//
// Supports filters: actor, event_type, repo (id), repo_name, cursor (ISO ts)
//
// Admins see ALL events (including non-SVN events like user_create, login…).
// Regular users see only events for repositories they have permission on.
// Non-SVN events (user_create, login, etc.) are only shown to admins because
// they are not scoped to any repository.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  auth,
  wrap(async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit) || 10, 50);
    const cursor = req.query.cursor;
    const { actor, event_type, repo, repo_name } = req.query;

    const cacheKey = `activity:global:${req.user.id}:${cursor || 'first'}:${actor || ''}:${event_type || ''}:${repo || ''}:${repo_name || ''}`;
    if (redis.isAvailable()) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return res.json(cached);
      } catch {}
    }

    const isAdminOrAbove = ['admin', 'super_admin'].includes(req.user.role);

    let query;
    let values;
    let index;

    if (isAdminOrAbove) {
      // Admins see everything — repo_id may be NULL for system events
      query  = `${ACTIVITY_SELECT} WHERE 1=1`;
      values = [];
      index  = 1;
    } else {
      // Regular users: only events for repos they have explicit permission on.
      // Non-repo events (repo_id IS NULL) are excluded — they are admin-only.
      query = `
        ${ACTIVITY_SELECT}
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

    // actor — match the joined username OR legacy SVN author column
    if (actor) {
      query += ` AND (u.username ILIKE '%' || $${index} || '%' OR a.author ILIKE '%' || $${index} || '%')`;
      values.push(actor);
      index++;
    }

    if (event_type) {
      query += ` AND a.event_type = $${index++}`;
      values.push(event_type);
    }

    if (repo) {
      query += ` AND a.repo_id = $${index++}`;
      values.push(repo);
    }

    if (repo_name) {
      query += ` AND r.name ILIKE '%' || $${index++} || '%'`;
      values.push(repo_name);
    }

    // Cursor pagination — works for both SVN (committed_at) and system events (created_at)
    if (cursor) {
      query += ` AND COALESCE(a.committed_at, a.created_at) < $${index++}`;
      values.push(cursor);
    }

    query += ` ${ACTIVITY_ORDER} LIMIT $${index}`;
    values.push(limit);

    const { rows } = await db.query(query, values);
    const lastRow    = rows[rows.length - 1];
    const nextCursor = lastRow
      ? (lastRow.committed_at || lastRow.created_at)
      : null;

    const response = {
      count:      rows.length,
      nextCursor,
      activity:   rows.map(formatRow),
    };

    if (redis.isAvailable()) {
      try { await redis.set(cacheKey, response, 30); } catch {}
    }

    res.json(response);
  })
);

module.exports = router;