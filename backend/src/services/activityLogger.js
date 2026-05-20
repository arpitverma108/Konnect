'use strict';

const logger = require('../config/logger');
const { ACTIVITY_TYPES, EVENT_CATEGORIES, EVENT_SEVERITY, EVENT_ICONS } = require('../constants/activityTypes');

/**
 * Log a structured activity event
 * @param {object} db - PostgreSQL pool
 * @param {object} opts - Options
 * @param {string} opts.event_type - Event type from ACTIVITY_TYPES
 * @param {number} opts.user_id - ID of user performing action
 * @param {string} opts.action - Human-readable action description
 * @param {string} opts.entity - Entity type (user, repository, permission, etc.)
 * @param {number} opts.entity_id - Entity ID
 * @param {number} opts.repo_id - Repository ID (optional, for repo-related events)
 * @param {object} opts.metadata - Additional metadata (optional)
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
        user_id || null,
        action,
        entity || null,
        entity_id || null,
        repo_id || null,
        JSON.stringify(metadata),
      ]
    );
  } catch (err) {
    logger.error(`Failed to log activity: ${err.message}`);
  }
}

/**
 * Format activity for API response
 * Enrich with category, severity, icon, and ensures all fields are present
 */
function formatActivityForResponse(row) {
  if (!row) return null;

  const eventType = row.event_type || 'unknown';
  const metadata = typeof row.metadata === 'string' ? 
    (row.metadata ? JSON.parse(row.metadata) : {}) : 
    (row.metadata || {});

  return {
    id: row.id,
    event_type: eventType,
    action: row.action || row.message || 'System activity',
    entity: row.entity,
    entity_id: row.entity_id,
    category: EVENT_CATEGORIES[eventType] || 'System',
    severity: EVENT_SEVERITY[eventType] || 'info',
    icon: EVENT_ICONS[eventType] || 'Activity',
    
    // Legacy fields for backward compatibility
    author: row.author,
    repo: row.repo_name,
    repo_name: row.repo_name,
    repo_id: row.repo_id,
    revision: row.revision,
    message: row.action || row.message,
    committed_at: row.committed_at,
    created_at: row.created_at,
    paths_changed: row.paths_changed,
    
    // Extra metadata
    metadata,
  };
}

/**
 * Get formatted global activity feed
 */
async function getFormattedGlobalActivity(db, { limit = 50, offset = 0 } = {}) {
  const { rows } = await db.query(`
    SELECT 
      a.*,
      r.name AS repo_name,
      u.username AS username
    FROM activity a
    LEFT JOIN repositories r ON r.id = a.repo_id
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  return rows.map(formatActivityForResponse);
}

/**
 * Get formatted activity for a specific repository
 */
async function getFormattedRepoActivity(db, repoId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await db.query(`
    SELECT 
      a.*,
      r.name AS repo_name,
      u.username AS username
    FROM activity a
    LEFT JOIN repositories r ON r.id = a.repo_id
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.repo_id = $1
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT $2 OFFSET $3
  `, [repoId, limit, offset]);

  return rows.map(formatActivityForResponse);
}

/**
 * Filter activity by user and date range
 */
async function getFilteredActivity(db, filters = {}, { limit = 50, offset = 0 } = {}) {
  const { author, eventType, entity, from, to } = filters;
  
  let query = `
    SELECT 
      a.*,
      r.name AS repo_name,
      u.username AS username
    FROM activity a
    LEFT JOIN repositories r ON r.id = a.repo_id
    LEFT JOIN users u ON u.id = a.user_id
    WHERE 1=1
  `;
  const values = [];
  let idx = 1;

  if (author) {
    query += ` AND a.author ILIKE '%' || $${idx++} || '%'`;
    values.push(author);
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
    query += ` AND a.created_at >= $${idx++}`;
    values.push(from);
  }

  if (to) {
    query += ` AND a.created_at <= $${idx++}`;
    values.push(to);
  }

  query += ` ORDER BY a.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
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
