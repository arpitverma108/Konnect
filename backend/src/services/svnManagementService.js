const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const logger = require('../config/logger');
const hookSvc = require('./hookService');
const env = require('../config/env');
const authzGenerationEngine = require('./authzGenerationEngine');
const htpasswdSyncEngine = require('./htpasswdSyncEngine');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execFileAsync = promisify(execFile);

function getDbClient() {
  return typeof db.getClient === 'function' ? db.getClient() : db.connect();
}

class SvnManagementService {
  /**
   * Provision a new SVN user
   * Creates svn_users entry, generates password hash, syncs to htpasswd
   */
  async provisionSvnUser(userId, password = null) {
    logger.info('Provisioning SVN user', { userId });

    const client = await getDbClient();
    let transactionOpen = false;

    try {
      await client.query('BEGIN');
      transactionOpen = true;

      // Get user details
      const userResult = await client.query(
        'SELECT username FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error(`User not found or inactive: ${userId}`);
      }

      const { username } = userResult.rows[0];

      // Validate username for SVN
      this.validateUsername(username);

      // Generate MD5 password hash (for Apache)
      const passwordHash = this.generateApacheMD5(password || this.generateTemporaryPassword());

      // Check if SVN user already exists
      const existingResult = await client.query(
        'SELECT id FROM svn_users WHERE user_id = $1',
        [userId]
      );

      let svnUserId;

      if (existingResult.rows.length === 0) {
        // Create new SVN user
        const insertResult = await client.query(
          `INSERT INTO svn_users
           (user_id, svn_username, password_hash_md5, is_svn_enabled, sync_status)
           VALUES ($1, $2, $3, true, 'pending')
           RETURNING id`,
          [userId, username, passwordHash]
        );

        svnUserId = insertResult.rows[0].id;
        logger.debug('Created svn_users entry', { svnUserId });

      } else {
        // Update existing
        svnUserId = existingResult.rows[0].id;
        await client.query(
          `UPDATE svn_users
           SET password_hash_md5 = $1, sync_status = 'pending', is_svn_enabled = true
           WHERE id = $2`,
          [passwordHash, svnUserId]
        );

        logger.debug('Updated existing svn_users entry', { svnUserId });
      }

      await client.query('COMMIT');
      transactionOpen = false;

      // Sync to htpasswd (outside transaction)
      try {
        await htpasswdSyncEngine.syncHtpasswdFile(userId);

        // Mark as synced
        await db.query(
          `UPDATE svn_users SET sync_status = 'synced', last_sync_at = NOW()
           WHERE id = $1`,
          [svnUserId]
        );

        logger.info('SVN user provisioned successfully', { userId, svnUserId });

        return {
          success: true,
          svnUserId,
          svnUsername: username,
          message: 'SVN user provisioned'
        };

      } catch (syncError) {
        // Mark as failed but don't rollback user creation
        await db.query(
          `UPDATE svn_users SET sync_status = 'failed'
           WHERE id = $1`,
          [svnUserId]
        );

        throw new Error(`SVN user created but htpasswd sync failed: ${syncError.message}`);
      }

    } catch (error) {
      if (transactionOpen) {
        await client.query('ROLLBACK');
      }
      logger.error('SVN user provisioning failed', { userId, error: error.message });
      throw error;

    } finally {
      client.release();
    }
  }

  /**
   * Update SVN user password
   */
  async updateSvnPassword(userId, newPassword) {
    logger.info('Updating SVN password', { userId });

    // Validate password strength
    this.validatePassword(newPassword);

    try {
      // Generate new MD5 hash
      const passwordHash = this.generateApacheMD5(newPassword);

      // Update in database
      const result = await db.query(
        `UPDATE svn_users
         SET password_hash_md5 = $1, sync_status = 'pending'
         WHERE user_id = $2
         RETURNING id`,
        [passwordHash, userId]
      );

      if (result.rows.length === 0) {
        logger.warn('SVN user missing during password update; provisioning now', { userId });
        return await this.provisionSvnUser(userId, newPassword);
      }

      const svnUserId = result.rows[0].id;

      // Sync to htpasswd
      await htpasswdSyncEngine.syncHtpasswdFile(userId);

      // Mark as synced
      await db.query(
        `UPDATE svn_users SET sync_status = 'synced', last_sync_at = NOW()
         WHERE id = $1`,
        [svnUserId]
      );

      logger.info('SVN password updated', { userId });

      return {
        success: true,
        message: 'Password updated'
      };

    } catch (error) {
      logger.error('Failed to update SVN password', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Deprovision SVN user (disable SVN access)
   */
  async deprovisionSvnUser(userId) {
    logger.info('Deprovisioning SVN user', { userId });

    try {
      // Mark as disabled
      await db.query(
        `UPDATE svn_users
         SET is_svn_enabled = false, sync_status = 'pending'
         WHERE user_id = $1`,
        [userId]
      );

      // Resync htpasswd to remove user
      await htpasswdSyncEngine.syncHtpasswdFile(userId);

      logger.info('SVN user deprovisioned', { userId });

      return {
        success: true,
        message: 'SVN access disabled'
      };

    } catch (error) {
      logger.error('Failed to deprovision SVN user', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update repository permissions and regenerate authz
   */
  async updateRepositoryPermissions(repositoryId, permissionUpdates) {
    logger.info('Updating repository permissions', { repositoryId, updateCount: permissionUpdates.length });

    const client = await getDbClient();

    try {
      await client.query('BEGIN');

      // Validate repository exists
      const repoResult = await client.query(
        'SELECT id FROM repositories WHERE id = $1 AND is_active = true',
        [repositoryId]
      );

      if (repoResult.rows.length === 0) {
        throw new Error(`Repository not found: ${repositoryId}`);
      }

      // Delete existing permissions for this repo
      await client.query(
        'DELETE FROM svn_permissions WHERE repository_id = $1',
        [repositoryId]
      );

      // Insert new permissions
      for (const perm of permissionUpdates) {
        // Validate permission structure
        this.validatePermission(perm);

        await client.query(
          `INSERT INTO svn_permissions
           (repository_id, subject_type, subject_id, path_pattern, access_level)
           VALUES ($1, $2, $3, $4, $5)`,
          [repositoryId, perm.subjectType, perm.subjectId, perm.pathPattern, perm.accessLevel]
        );
      }

      await client.query('COMMIT');

      logger.debug('Permissions updated in database', { repositoryId });

      // Regenerate authz
      const result = await authzGenerationEngine.generateFullAuthz();

      logger.info('Repository permissions updated', { repositoryId, affectedRepos: result.affectedRepos.length });

      return {
        success: true,
        repositoryId,
        permissionsUpdated: permissionUpdates.length,
        authzGeneration: result
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update repository permissions', { repositoryId, error: error.message });
      throw error;

    } finally {
      client.release();
    }
  }

  /**
   * Create repository with full SVN provisioning
   */
  async createRepositoryWithSvn(repositoryId, ownerId, repositoryName) {
    logger.info('Creating repository with SVN provisioning', { repositoryId, ownerId });

    const client = await getDbClient();

    try {
      await client.query('BEGIN');

      // Validate inputs
      this.validateRepositoryName(repositoryName);

      // Check repository exists
      const repoResult = await client.query(
        'SELECT id, disk_path FROM repositories WHERE id = $1',
        [repositoryId]
      );

      if (repoResult.rows.length === 0) {
        throw new Error(`Repository not found: ${repositoryId}`);
      }

      const { disk_path: diskPath } = repoResult.rows[0];

      // Create SVN repository metadata entry
      const svnPath = path.join(env.SVN_REPOS_ROOT, repositoryName);

      const svnRepoResult = await client.query(
        `INSERT INTO svn_repositories
         (repository_id, svn_path, owner_id, is_initialized)
         VALUES ($1, $2, $3, false)
         RETURNING id`,
        [repositoryId, svnPath, ownerId]
      );

      const svnRepoId = svnRepoResult.rows[0].id;

      // Add owner with full read-write permission
      await client.query(
        `INSERT INTO svn_permissions
         (repository_id, subject_type, subject_id, path_pattern, access_level)
         VALUES ($1, 'user', $2, '/', 'read-write')`,
        [repositoryId, ownerId]
      );

      await client.query('COMMIT');

      logger.debug('SVN repository metadata created', { svnRepoId });

      // Initialize SVN repository on filesystem (outside transaction)
      try {
        await this.initializeSvnRepository(repositoryName, svnPath);
        logger.debug('SVN repository initialized on filesystem', { svnPath });

      } catch (initError) {
        // Mark repository as failed
        await db.query(
          `UPDATE svn_repositories SET is_initialized = false
           WHERE id = $1`,
          [svnRepoId]
        );

        throw new Error(`SVN initialization failed: ${initError.message}`);
      }

      // Mark as initialized
      await db.query(
        `UPDATE svn_repositories SET is_initialized = true
         WHERE id = $1`,
        [svnRepoId]
      );

      // Regenerate authz to include this repository
      const authzResult = await authzGenerationEngine.generateFullAuthz(ownerId);

      logger.info('Repository created with SVN provisioning', {
        repositoryId,
        svnPath,
        authzGeneration: authzResult.generationId
      });

      return {
        success: true,
        repositoryId,
        svnRepoId,
        svnPath,
        authzGeneration: authzResult
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Repository creation with SVN provisioning failed', {
        repositoryId,
        error: error.message
      });
      throw error;

    } finally {
      client.release();
    }
  }

  /**
   * Initialize SVN repository on filesystem
   */
  async initializeSvnRepository(repoName, svnPath) {
    logger.debug('Initializing SVN repository', { repoName, svnPath });

    try {
      // Check if path already exists
      try {
        await fs.access(svnPath);
        throw new Error(`SVN repository path already exists: ${svnPath}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      // Create parent directory
      const parentDir = path.dirname(svnPath);
      try {
        await fs.mkdir(parentDir, { recursive: true });
      } catch {
        // ignore if already exists
      }

      // Run svnadmin create
      await execFileAsync(env.SVNADMIN_PATH || 'svnadmin', ['create', svnPath], {
        timeout: 30000
      });

      logger.debug('SVN repository created with svnadmin', { svnPath });

      // Set ownership and permissions (www-data should own it)
      // Note: This requires proper sudoers configuration
      try {
        await execFileAsync('chown', ['-R', 'www-data:www-data', svnPath], {
          timeout: 10000
        });

        await execFileAsync('chmod', ['-R', '777', svnPath], {
          timeout: 10000
        });

        logger.debug('SVN repository permissions set', { svnPath });

      } catch (permError) {
        logger.warn('Failed to set permissions, may need sudo', { svnPath, error: permError.message });
      }

      // Install hooks
      await this.installSvnHooks(svnPath);

      logger.info('SVN repository fully initialized', { svnPath });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Install SVN hooks (pre-commit, post-commit, etc.)
   */
  async installSvnHooks(svnPath) {
    logger.debug('Installing SVN hooks', { svnPath });

    const hooksDir = path.join(svnPath, 'hooks');

    try {
      const postCommit = process.platform === 'win32'
        ? hookSvc.generatePostCommitHook().windows
        : hookSvc.generatePostCommitHook().unix;
      await hookSvc.deployHook(svnPath, 'post-commit', postCommit, true);

      // Make hooks executable
      const hooks = ['pre-commit', 'post-commit', 'start-commit'];

      for (const hook of hooks) {
        const hookPath = path.join(hooksDir, hook);

        try {
          // Check if hook exists (it's created by svnadmin create)
          const stats = await fs.stat(hookPath);

          // Make executable
          await fs.chmod(hookPath, 0o755);

        } catch (error) {
          if (error.code !== 'ENOENT') {
            logger.warn(`Hook not found: ${hook}`, { svnPath });
          }
        }
      }

      logger.debug('SVN hooks installed', { svnPath });

    } catch (error) {
      logger.warn('Error installing SVN hooks', { svnPath, error: error.message });
    }
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  validateUsername(username) {
    // 3-20 alphanumeric + underscore
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      throw new Error('Invalid username format (3-20 chars, alphanumeric + underscore)');
    }
  }

  validatePassword(password) {
    // Minimum 6 characters
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
  }

  validateRepositoryName(name) {
    // Alphanumeric, hyphen, underscore - no spaces or special chars
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
      throw new Error('Invalid repository name (alphanumeric, hyphen, underscore only)');
    }
  }

  validatePermission(perm) {
    if (!['user', 'group', '_anonymous_'].includes(perm.subjectType)) {
      throw new Error('Invalid subject type');
    }

    if (!['none', 'read-only', 'read-write'].includes(perm.accessLevel)) {
      throw new Error('Invalid access level');
    }

    if (!perm.pathPattern || typeof perm.pathPattern !== 'string') {
      throw new Error('Invalid path pattern');
    }

    if (perm.subjectType !== '_anonymous_' && !perm.subjectId) {
      throw new Error('Subject ID required for non-anonymous permissions');
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate Apache {SHA} password hash
   * Apache {SHA} format = "{SHA}" + base64(SHA1(password))
   * No salt — this matches what htpasswd -s produces and what Apache/mod_dav_svn validates.
   */
  generateApacheMD5(password) {
    const hash = crypto.createHash('sha1').update(password).digest();
    return '{SHA}' + hash.toString('base64');
  }

  /**
   * Generate temporary password
   */
  generateTemporaryPassword() {
    return crypto.randomBytes(8).toString('hex');
  }
}

module.exports = new SvnManagementService();
