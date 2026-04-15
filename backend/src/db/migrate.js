'use strict';

/**
 * Simple migration runner — reads schema.sql and executes it.
 * For a production system, use a proper migration tool like db-migrate or Flyway.
 */

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const db      = require('../config/database');
const logger  = require('../config/logger');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  logger.info('Running database migrations...');
  try {
    await db.query(sql);
    logger.info('Migrations complete.');
  } catch (err) {
    logger.error('Migration failed:', err.message);
    throw err;
  } finally {
    await db.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
