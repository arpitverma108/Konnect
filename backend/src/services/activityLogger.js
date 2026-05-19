'use strict';

const logger = require('../config/logger');
const { ACTIVITY_TYPES, EVENT_CATEGORIES, EVENT_SEVERITY, EVENT_ICONS } = require('../constants/activityTypes');

/**
 * Log a structured activity event.
 *
 * @param {object} db         - PostgreSQL pool
 * @param {object} opts
 * @param {string} opts.event_type  - From ACTIVITY_TYPES
 * @param {number} opts.user_id     - Acting user's DB id
 * @param {string} opts.action      - Human-readable description
 * @param {string} opts.entity      - Entity type (user, repository, permission…)
 * @param {number} opts.entity_id   - Entity DB id
 * @param {number} opts.repo_id     - Repository id (optional)
 * @param {object} opts.metadata    - Extra key/value data (optional)
 */
async function logActivity(db, opts = {}) {
  const {
    event_type,
    user_id,
    action,
    entity,
    entity_id,
    repo_id,
    metadata = {},
  } = opts;

  try {
    await db.query(
      `INSERT INTO activity (
        event_type, user_id, action, entity, entity_id, repo_id, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        event_type,
        user_id   || null,
        action,
        entity    || null,
        entity_id || null,
        repo_id   || null,
        JSON.stringify(metadata),
      ]
    );
  } catch (err) {
    logger.error(`Failed to log activity: ${err.message}`);
  }
}

/**
 * Format a single activity row for API responses.
 * Enriches with category, severity, icon, and a canonical `actor` field.
 */
function formatActivityForResponse(row) {
  if (!row) return null;

  const eventType = row.event_type || 'unknown';
  const metadata  = typeof row.metadata === 'string'
    ? (row.metadata ? JSON.parse(row.metadata) : {})
    : (row.metadata || {});

  // `actor` — the human-readable name of who performed the action.
  // Prefer the joined username; fall back to the SVN author field; then metadata.
  const actor = row.username || row.author || metadata.username || null;

  return {
    id:         row.id,
    event_type: eventType,
    action:     row.action || row.message || 'System activity',
    entity:     row.entity,
    entity_id:  row.entity_id,
    category:   EVENT_CATEGORIES[eventType] || 'System',
    severity:   EVENT_SEVERITY[eventType]   || 'info',
    icon:       EVENT_ICONS[eventType]      || 'Activity',

    // Canonical actor field — use this on the frontend instead of inferring
    actor,

    // Structured filter-friendly fields
    repo_name:  row.repo_name || null,
    repo_id:    row.repo_id   || null,
    user_id:    row.user_id   || null,

    // Legacy / SVN-specific fields kept for backwards compatibility
    author:       row.author,
    repo:         row.repo_name,
    revision:     row.revision,
    message:      row.action || row.message,
    committed_at: row.committed_at,
    created_at:   row.created_at,
    paths_changed: row.paths_changed,

    metadata,
  };
}

// ─── Shared SELECT fragment ───────────────────────────────────────────────────
// Joins users and repositories so every formatter gets actor + repo_name.
const BASE_SELECT = `
  SELECT
    a.*,
    r.name       AS repo_name,
    u.username   AS username
  FROM activity a
  LEFT JOIN repositories r ON r.id = a.repo_id
  LEFT JOIN users        u ON u.id = a.user_id
`;

// Canonical ordering: non-SVN events only have created_at; SVN events also
// have committed_at.  Prefer committed_at when present, else created_at.
const ORDER_BY = `ORDER BY COALESCE(a.committed_at, a.created_at) DESC, a.id DESC`;

// ─── Public helpers ───────────────────────────────────────────────────────────

async function getFormattedGlobalActivity(db, { limit = 50, offset = 0 } = {}) {
  const { rows } = await db.query(
    `${BASE_SELECT} ${ORDER_BY} LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map(formatActivityForResponse);
}

async function getFormattedRepoActivity(db, repoId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await db.query(
    `${BASE_SELECT} WHERE a.repo_id = $1 ${ORDER_BY} LIMIT $2 OFFSET $3`,
    [repoId, limit, offset]
  );
  return rows.map(formatActivityForResponse);
}

/**
 * Filtered activity feed.
 *
 * Supported filters:
 *   actor      – matches username (via user_id JOIN) OR svn author field
 *   repo       – repo_id (integer)
 *   repo_name  – repository name string (case-insensitive substring)
 *   eventType  – exact event_type string
 *   entity     – entity type string
 *   from / to  – ISO timestamp bounds (inclusive) applied to created_at/committed_at
 */
async function getFilteredActivity(db, filters = {}, { limit = 50, offset = 0 } = {}) {
  const { actor, repo, repo_name, eventType, entity, from, to } = filters;

  let query = `${BASE_SELECT} WHERE 1=1`;
  const values = [];
  let idx = 1;

  // Actor filter — match username from users JOIN OR the legacy author column
  if (actor) {
    query += ` AND (u.username ILIKE '%' || $${idx} || '%' OR a.author ILIKE '%' || $${idx} || '%')`;
    values.push(actor);
    idx++;
  }

  if (repo) {
    query += ` AND a.repo_id = $${idx++}`;
    values.push(repo);
  }

  if (repo_name) {
    query += ` AND r.name ILIKE '%' || $${idx++} || '%'`;
    values.push(repo_name);
  }

  if (eventType) {
    query += ` AND a.event_type = $${idx++}`;
    values.push(eventType);
  }

  if (entity) {
    query += ` AND a.entity = $${idx++}`;
    values.push(entity);
  }

  if (from) {
    query += ` AND COALESCE(a.committed_at, a.created_at) >= $${idx++}`;
    values.push(from);
  }

  if (to) {
    query += ` AND COALESCE(a.committed_at, a.created_at) <= $${idx++}`;
    values.push(to);
  }

  query += ` ${ORDER_BY} LIMIT $${idx++} OFFSET $${idx++}`;
  values.push(limit, offset);

  const { rows } = await db.query(query, values);
  return rows.map(formatActivityForResponse);
}

module.exports = {
  logActivity,
  formatActivityForResponse,
  getFormattedGlobalActivity,
  getFormattedRepoActivity,
  getFilteredActivity,
  ACTIVITY_TYPES,
  EVENT_CATEGORIES,
  EVENT_SEVERITY,
  EVENT_ICONS,
};