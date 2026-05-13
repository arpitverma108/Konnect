#!/usr/bin/env node
'use strict';

/**
 * SVN Activity Sync Script
 * Syncs SVN commit history to database
 * Usage: node scripts/syncActivity.js [repoId]
 */

require('dotenv').config({ path: './backend/.env' });

const db = require('./backend/src/config/database');
const activitySvc = require('./backend/src/services/activityService');
const logger = require('./backend/src/config/logger');

async function main() {
  try {
    logger.info('Starting activity sync...');

    // ✅ Query all repos from database (not hardcoded)
    const { rows: repos } = await db.query(
      'SELECT id, disk_path FROM repositories WHERE is_active = true'
    );

    if (!repos.length) {
      logger.info('No active repositories found');
      process.exit(0);
    }

    logger.info(`Found ${repos.length} repositories to sync`);

    // ✅ Sync each repository
    for (const repo of repos) {
      try {
        logger.info(`Syncing repo ${repo.id} at ${repo.disk_path}`);
        const result = await activitySvc.syncRepoActivity(
          db,
          repo.id,
          repo.disk_path,
          100  // limit: sync last 100 commits
        );

        logger.info(`✅ Synced repo ${repo.id}: ${result || 'updated'}`);
      } catch (err) {
        logger.error(`❌ Failed to sync repo ${repo.id}: ${err.message}`);
        // Continue with next repo even if one fails
      }
    }

    logger.info('✅ Activity sync completed');
    process.exit(0);

  } catch (err) {
    logger.error('❌ Sync script error:', err);
    process.exit(1);
  } finally {
    await db.end?.();
  }
}

// Run
main().catch(err => {
  console.error(err);
  process.exit(1);
});
