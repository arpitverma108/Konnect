// activityService.js
'use strict';

const svnSvc = require('./svnService');
const logger = require('../config/logger');
const { ACTIVITY_TYPES } = require('../constants/activityTypes');

const NON_COMMIT_ACTIVITY_SQL = `
  (
    LOWER(COALESCE(message, '')) IN (
      'initialize standard layout',
      'initial commit',
      'create standard structure'
    )
    OR LOWER(COALESCE(message, '')) LIKE 'create branch%'
    OR LOWER(COALESCE(message, '')) LIKE 'delete branch%'
    OR LOWER(COALESCE(message, '')) LIKE 'create tag%'
    OR LOWER(COALESCE(message, '')) LIKE 'delete tag%'
  )
`;

function classifyActivityEvent(row = {}) {
  const message = String(row.message || '').trim().toLowerCase();

  if (
    [
      'initialize standard layout',
      'initial commit',
      'create standard structure',
    ].includes(message)
  ) {
    return 'repo_init';
  }

  if (message.startsWith('create branch')) return 'branch_create';
  if (message.startsWith('delete branch')) return 'branch_delete';
  if (message.startsWith('create tag')) return 'tag_create';
  if (message.startsWith('delete tag')) return 'tag_delete';

  return 'commit';
}

function withEventType(row) {
  return {
    ...row,
    event_type: classifyActivityEvent(row),
  };
}

/**
 * Sync SVN log for a single repository into the activity table.
 * Uses ON CONFLICT DO NOTHING so re-syncing is safe.
 *
 * @param {object} db      - pg pool
 * @param {number} repoId  - DB row id
 * @param {string} repoPath - Absolute disk path
 * @param {number} limit   - How many recent revisions to sync
 */
async function syncRepoActivity(db, repoId, repoPath, limit = 200) {
  const entries = await svnSvc.getLog(repoPath, limit);

  for (const entry of entries) {
    const eventType = classifyActivityEvent(entry);
    
    // paths_changed is now an array of { path, action } objects from getCommitHistory
    const pathsJson = entry.paths_changed
      ? JSON.stringify(entry.paths_changed)
      : entry.paths
        ? JSON.stringify(entry.paths)
        : null;

    // Generate readable action message
    let action = entry.message || 'Repository update';
    if (eventType === ACTIVITY_TYPES.BRANCH_CREATE) {
      action = `Created branch: ${entry.message}`;
    } else if (eventType === ACTIVITY_TYPES.BRANCH_DELETE) {
      action = `Deleted branch: ${entry.message}`;
    } else if (eventType === ACTIVITY_TYPES.TAG_CREATE) {
      action = `Created tag: ${entry.message}`;
    } else if (eventType === ACTIVITY_TYPES.TAG_DELETE) {
      action = `Deleted tag: ${entry.message}`;
    } else if (eventType === ACTIVITY_TYPES.REPO_INIT) {
      action = 'Repository initialized';
    }

    await db.query(
      `INSERT INTO activity (repo_id, revision, author, message, committed_at, paths_changed, event_type, action, entity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (repo_id, revision) DO UPDATE
         SET paths_changed = EXCLUDED.paths_changed,
             message       = EXCLUDED.message,
             event_type    = EXCLUDED.event_type,
             action        = EXCLUDED.action`,
      [
        repoId,
        entry.revision,
        entry.author  || null,
        entry.message || null,
        entry.date    || null,
        pathsJson,
        eventType,
        action,
        'commit',
      ]
    );
  }

  logger.info(`Activity synced for repo ${repoId}: ${entries.length} revisions`);
  return entries.length;
}

/**
 * Get paginated activity for a specific repo.
 */
async function getRepoActivity(db, repoId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM activity
     WHERE repo_id = $1
     ORDER BY committed_at DESC NULLS LAST, revision DESC
     LIMIT $2 OFFSET $3`,
    [repoId, limit, offset]
  );
  return rows.map(withEventType);
}

/**
 * Get global activity feed across all repos (paginated).
 */
async function getGlobalActivity(db, { limit = 50, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT a.*, r.name AS repo_name
     FROM activity a
     JOIN repositories r ON r.id = a.repo_id
     ORDER BY a.committed_at DESC NULLS LAST, a.revision DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map(withEventType);
}

/**
 * Get global SVN commit feed, excluding branch/tag/system repository events.
 */
async function getGlobalCommits(db, { limit = 50, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT a.*, r.name AS repo_name
     FROM activity a
     JOIN repositories r ON r.id = a.repo_id
     WHERE NOT ${NON_COMMIT_ACTIVITY_SQL}
     ORDER BY a.committed_at DESC NULLS LAST, a.revision DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map(withEventType);
}

/**
 * Count commits today across all repos.
 */
async function countCommitsToday(db) {
  const { rows } = await db.query(
    `SELECT COUNT(*) AS count
     FROM activity
     WHERE committed_at >= CURRENT_DATE
       AND NOT ${NON_COMMIT_ACTIVITY_SQL}`
  );
  return parseInt(rows[0].count, 10);
}

/**
 * Get commits per day for the last N days (for charting).
 */
async function getCommitsPerDay(db, days = 7) {
  const { rows } = await db.query(
    `SELECT
       DATE(committed_at) AS day,
       r.name             AS repo_name,
       COUNT(*)           AS commits
     FROM activity a
     JOIN repositories r ON r.id = a.repo_id
     WHERE committed_at >= NOW() - INTERVAL '1 day' * $1
       AND NOT ${NON_COMMIT_ACTIVITY_SQL}
     GROUP BY DATE(committed_at), r.name
     ORDER BY day ASC`,
    [days]
  );
  return rows;
}

module.exports = {
  syncRepoActivity,
  getRepoActivity,
  getGlobalActivity,
  getGlobalCommits,
  countCommitsToday,
  getCommitsPerDay,
  classifyActivityEvent,
};
