// activityService.js
'use strict';

const svnSvc = require('./svnService');
const logger = require('../config/logger');

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
    await db.query(
      `INSERT INTO activity (repo_id, revision, author, message, committed_at, paths_changed)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (repo_id, revision) DO NOTHING`,
      [
        repoId,
        entry.revision,
        entry.author  || null,
        entry.message || null,
        entry.date    || null,
        JSON.stringify(entry.paths),
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
  return rows;
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
  return rows;
}

/**
 * Count commits today across all repos.
 */
async function countCommitsToday(db) {
  const { rows } = await db.query(
    `SELECT COUNT(*) AS count
     FROM activity
     WHERE committed_at >= CURRENT_DATE`
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
     WHERE committed_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(committed_at), r.name
     ORDER BY day ASC`
  );
  return rows;
}

module.exports = {
  syncRepoActivity,
  getRepoActivity,
  getGlobalActivity,
  countCommitsToday,
  getCommitsPerDay,
};
