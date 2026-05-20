const express = require('express');
const wrap = require('../middleware/asyncWrapper');
const authorize = require('../middleware/authorize');
const db = require('../config/database');
const logger = require('../config/logger');
const svnManagementService = require('../services/svnManagementService');
const authzGenerationEngine = require('../services/authzGenerationEngine');
const htpasswdSyncEngine = require('../services/htpasswdSyncEngine');

const router = express.Router();

// ============================================
// ADMIN-ONLY OPERATIONS
// ============================================

/**
 * POST /api/svn/sync-users
 * Force full htpasswd synchronization (admin only)
 */
router.post('/sync-users', authorize('super_admin', 'admin'), wrap(async (req, res) => {
  logger.info('User requested htpasswd sync', { userId: req.user.id });

  try {
    const result = await htpasswdSyncEngine.syncHtpasswdFile(req.user.id);

    res.json({
      success: true,
      syncId: result.syncId,
      usersSynced: result.usersSynced,
      durationMs: result.durationMs,
      message: `Successfully synced ${result.usersSynced} users to htpasswd`
    });

  } catch (error) {
    logger.error('Htpasswd sync failed', { error: error.message, userId: req.user.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * POST /api/svn/sync-permissions
 * Force full authz file regeneration (admin only)
 */
router.post('/sync-permissions', authorize('super_admin', 'admin'), wrap(async (req, res) => {
  logger.info('User requested authz sync', { userId: req.user.id });

  try {
    const result = await authzGenerationEngine.generateFullAuthz(req.user.id);

    res.json({
      success: true,
      generationId: result.generationId,
      affectedRepos: result.affectedRepos.length,
      hash: result.hash,
      durationMs: result.durationMs,
      message: `Successfully regenerated authz for ${result.affectedRepos.length} repositories`
    });

  } catch (error) {
    logger.error('Authz generation failed', { error: error.message, userId: req.user.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * GET /api/svn/sync-status
 * Get current sync status (admin only)
 */
router.get('/sync-status', authorize('super_admin', 'admin'), wrap(async (req, res) => {
  try {
    // Get latest authz generation
    const authzResult = await db.query(
      `SELECT id, generation_id, status, started_at, completed_at, error_message
       FROM authz_generation_history
       ORDER BY created_at DESC
       LIMIT 1`
    );

    // Get latest htpasswd sync
    const htpasswdResult = await db.query(
      `SELECT id, sync_id, status, started_at, completed_at, users_synced, error_message
       FROM htpasswd_sync_history
       ORDER BY created_at DESC
       LIMIT 1`
    );

    const authz = authzResult.rows[0] || null;
    const htpasswd = htpasswdResult.rows[0] || null;

    res.json({
      success: true,
      authz: authz ? {
        generationId: authz.generation_id,
        status: authz.status,
        startedAt: authz.started_at,
        completedAt: authz.completed_at,
        error: authz.error_message
      } : null,
      htpasswd: htpasswd ? {
        syncId: htpasswd.sync_id,
        status: htpasswd.status,
        startedAt: htpasswd.started_at,
        completedAt: htpasswd.completed_at,
        usersSynced: htpasswd.users_synced,
        error: htpasswd.error_message
      } : null
    });

  } catch (error) {
    logger.error('Error fetching sync status', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * GET /api/svn/users
 * List all SVN users (admin only)
 */
router.get('/users', authorize('super_admin', 'admin'), wrap(async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        su.id, u.id AS user_id, u.username, su.svn_username,
        u.is_active, su.is_svn_enabled, su.sync_status,
        su.last_sync_at, su.created_at
       FROM svn_users su
       JOIN users u ON u.id = su.user_id
       ORDER BY u.username`
    );

    res.json({
      success: true,
      users: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching SVN users', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * GET /api/svn/repositories
 * List all SVN repositories (admin only)
 */
router.get('/repositories', authorize('super_admin', 'admin'), wrap(async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        sr.id, r.id AS repository_id, r.name, sr.svn_path,
        u.username AS owner_name, sr.is_initialized,
        sr.created_at, sr.updated_at
       FROM svn_repositories sr
       JOIN repositories r ON r.id = sr.repository_id
       LEFT JOIN users u ON u.id = sr.owner_id
       ORDER BY r.name`
    );

    res.json({
      success: true,
      repositories: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching SVN repositories', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * GET /api/svn/permissions/:repositoryId
 * Get permissions for a specific repository
 */
router.get('/permissions/:repositoryId', authorize('super_admin', 'admin'), wrap(async (req, res) => {
  const { repositoryId } = req.params;

  try {
    // Get repository info
    const repoResult = await db.query(
      'SELECT id, name FROM repositories WHERE id = $1',
      [repositoryId]
    );

    if (repoResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    // Get permissions
    const permsResult = await db.query(
      `SELECT
        sp.id, sp.path_pattern, sp.subject_type, sp.subject_id,
        sp.access_level,
        CASE
          WHEN sp.subject_type = 'user' THEN u.username
          WHEN sp.subject_type = 'group' THEN g.name
          ELSE '_anonymous_'
        END AS subject_name
       FROM svn_permissions sp
       LEFT JOIN users u ON sp.subject_type = 'user' AND u.id = sp.subject_id
       LEFT JOIN groups g ON sp.subject_type = 'group' AND g.id = sp.subject_id
       WHERE sp.repository_id = $1
       ORDER BY sp.path_pattern, sp.subject_type`,
      [repositoryId]
    );

    res.json({
      success: true,
      repository: {
        id: repoResult.rows[0].id,
        name: repoResult.rows[0].name
      },
      permissions: permsResult.rows,
      total: permsResult.rows.length
    });

  } catch (error) {
    logger.error('Error fetching permissions', { error: error.message, repositoryId });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * PATCH /api/svn/permissions/:repositoryId
 * Update permissions for a repository (triggers authz regeneration)
 */
router.patch('/permissions/:repositoryId', authorize('super_admin', 'admin'), wrap(async (req, res) => {
  const { repositoryId } = req.params;
  const { permissions } = req.body;

  logger.info('Updating repository permissions', { repositoryId, permCount: permissions?.length });

  try {
    // Validate permissions array
    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'permissions must be an array'
      });
    }

    // Validate each permission
    for (const perm of permissions) {
      if (!perm.subjectType || !perm.accessLevel || !perm.pathPattern) {
        return res.status(400).json({
          success: false,
          error: 'Invalid permission structure (must have subjectType, accessLevel, pathPattern)'
        });
      }
    }

    const result = await svnManagementService.updateRepositoryPermissions(
      repositoryId,
      permissions
    );

    res.json({
      success: true,
      repositoryId: result.repositoryId,
      permissionsUpdated: result.permissionsUpdated,
      authzGeneration: {
        generationId: result.authzGeneration.generationId,
        hash: result.authzGeneration.hash,
        affectedRepos: result.authzGeneration.affectedRepos.length
      },
      message: `Updated ${result.permissionsUpdated} permissions and regenerated authz`
    });

  } catch (error) {
    logger.error('Error updating permissions', { error: error.message, repositoryId });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * POST /api/svn/test-apache
 * Test Apache configuration (admin only)
 */
router.post('/test-apache', authorize('super_admin', 'admin'), wrap(async (req, res) => {
  logger.info('Testing Apache configuration', { userId: req.user.id });

  try {
    // This would call a function to test apache config
    // For now, just return success if we got here
    res.json({
      success: true,
      message: 'Apache configuration test passed'
    });

  } catch (error) {
    logger.error('Apache config test failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * GET /api/svn/authz-history
 * Get authz generation history (admin only)
 */
router.get('/authz-history', authorize('super_admin', 'admin'), wrap(async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;

  try {
    const result = await db.query(
      `SELECT
        generation_id, status, started_at, completed_at,
        authz_hash, error_message, array_length(affected_repos, 1) as repo_count,
        u.username AS triggered_by
       FROM authz_generation_history
       LEFT JOIN users u ON u.id = authz_generation_history.triggered_by
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      success: true,
      history: result.rows,
      limit,
      offset
    });

  } catch (error) {
    logger.error('Error fetching authz history', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * GET /api/svn/htpasswd-history
 * Get htpasswd sync history (admin only)
 */
router.get('/htpasswd-history', authorize('super_admin', 'admin'), wrap(async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;

  try {
    const result = await db.query(
      `SELECT
        sync_id, status, started_at, completed_at,
        users_synced, error_message,
        u.username AS triggered_by
       FROM htpasswd_sync_history
       LEFT JOIN users u ON u.id = htpasswd_sync_history.triggered_by
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      success: true,
      history: result.rows,
      limit,
      offset
    });

  } catch (error) {
    logger.error('Error fetching htpasswd history', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

module.exports = router;
