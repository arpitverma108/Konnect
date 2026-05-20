const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');
const logger = require('../config/logger');

const LOCK_TYPES = {
  AUTHZ_GENERATION: 'authz_generation',
  HTPASSWD_SYNC: 'htpasswd_sync',
  REPO_PROVISIONING: 'repo_provisioning'
};

const LOCK_DEFAULTS = {
  timeout: 5000, // 5s to acquire lock
  expiry: 600000, // 10 min lock expiry
  retryDelay: 50 // initial retry delay
};

// Distributed lock using database (works across multiple instances)
class DistributedLock {
  constructor(lockType, resourceId = null) {
    this.lockType = lockType;
    this.resourceId = resourceId;
    this.lockId = uuidv4();
    this.acquired = false;
    this.holder = `${process.env.NODE_ENV}:${process.pid}:${require('os').hostname()}`;
  }

  async acquire(timeout = LOCK_DEFAULTS.timeout, expiry = LOCK_DEFAULTS.expiry) {
    const startTime = Date.now();
    let retryDelay = LOCK_DEFAULTS.retryDelay;

    while (Date.now() - startTime < timeout) {
      try {
        const table = this.lockType === 'repo_provisioning'
          ? 'svn_repo_provisioning_locks'
          : 'authz_generation_locks';

        const expiresAt = new Date(Date.now() + expiry);

        // Try to insert lock (will fail if lock exists for this resource)
        const result = await db.query(
          `INSERT INTO ${table} (lock_id, repository_id, expires_at, holder)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING
           RETURNING lock_id`,
          [this.lockId, this.resourceId, expiresAt, this.holder]
        );

        if (result.rows.length > 0) {
          this.acquired = true;
          logger.info(`Lock acquired: ${this.lockType}`, { lockId: this.lockId });
          return true;
        }

        // Lock exists - check if it's expired
        const existingLock = await db.query(
          `SELECT lock_id, expires_at FROM ${table}
           WHERE ${this.resourceId ? 'repository_id' : 'lock_id'} = $1
           ORDER BY created_at DESC LIMIT 1`,
          [this.resourceId || this.lockId]
        );

        if (existingLock.rows.length > 0 && new Date(existingLock.rows[0].expires_at) < new Date()) {
          // Stale lock - override it
          await db.query(
            `DELETE FROM ${table}
             WHERE lock_id = $1`,
            [existingLock.rows[0].lock_id]
          );
          // Retry immediately
          continue;
        }

        // Exponential backoff with jitter
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay = Math.min(retryDelay * 2, 1000); // max 1s
      } catch (error) {
        logger.error(`Lock acquisition error: ${this.lockType}`, { error });
        // Fallback to file-based lock on DB error
        return this.acquireFileLock();
      }
    }

    throw new Error(`Failed to acquire lock for ${this.lockType} after ${timeout}ms`);
  }

  async acquireFileLock() {
    const lockFile = path.join('/var/lock', `konnect-${this.lockType}.lock`);
    try {
      // Try to create lock file exclusively (O_EXCL)
      await fs.open(lockFile, 'wx').then(handle => handle.close());
      this.acquired = true;
      this.lockFile = lockFile;
      logger.info(`File lock acquired: ${this.lockType}`, { lockFile });
      return true;
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw new Error(`File lock exists: ${lockFile}`);
      }
      throw error;
    }
  }

  async release() {
    if (!this.acquired) return false;

    try {
      const table = this.lockType === 'repo_provisioning'
        ? 'svn_repo_provisioning_locks'
        : 'authz_generation_locks';

      await db.query(
        `DELETE FROM ${table} WHERE lock_id = $1`,
        [this.lockId]
      );

      if (this.lockFile) {
        await fs.unlink(this.lockFile);
      }

      this.acquired = false;
      logger.info(`Lock released: ${this.lockType}`, { lockId: this.lockId });
      return true;
    } catch (error) {
      logger.error(`Error releasing lock: ${this.lockType}`, { error });
      return false;
    }
  }

  async withLock(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      await this.release();
    }
  }
}

// Cleanup stale locks
async function cleanupStaleLocks() {
  try {
    const result = await db.query(
      `DELETE FROM authz_generation_locks
       WHERE expires_at < NOW()
       RETURNING lock_id`
    );

    const repoResult = await db.query(
      `DELETE FROM svn_repo_provisioning_locks
       WHERE expires_at < NOW()
       RETURNING lock_id`
    );

    const total = result.rows.length + repoResult.rows.length;
    if (total > 0) {
      logger.info(`Cleaned up ${total} stale locks`);
    }
  } catch (error) {
    logger.error('Error cleaning up stale locks', { error });
  }
}

module.exports = {
  DistributedLock,
  LOCK_TYPES,
  LOCK_DEFAULTS,
  cleanupStaleLocks
};
