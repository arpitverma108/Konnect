'use strict';

const bcrypt = require('bcrypt');

const appDb = require('../config/database');
const authzService = require('./authzService');
const logger = require('../config/logger');
const svnManagementService = require('./svnManagementService');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);


// ───────────── CREATE USER ─────────────

async function createUser(db, { username, password, email, fullName }) {

  if (!username || !password) {
    const err = new Error('Username and password required');
    err.statusCode = 400;
    throw err;
  }

  // 1. Hash for DB
  const dbHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const existing = await db.query('SELECT 1 FROM users WHERE username = $1', [username]);
  if (existing.rows.length) {
    const err = new Error(`User '${username}' already exists`);
    err.statusCode = 409;
    throw err;
  }

  const result = await db.query(
    `INSERT INTO users (username, password_hash, email, full_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [username, dbHash, email || null, fullName || null]
  );

  const user = result.rows[0];

  try {
    await svnManagementService.provisionSvnUser(user.id, password);
    user.svnProvisioning = { success: true };
  } catch (err) {
    user.svnProvisioning = { success: false, error: err.message };
    logger.error('SVN provisioning failed during user creation', {
      userId: user.id,
      username,
      error: err.message,
    });
  }

  logger.info(`User created: ${username}`);
  return user;
}


// ───────────── OTHER FUNCTIONS ─────────────

async function listUsers(db) {
  const result = await db.query(
    `SELECT u.*,
            COALESCE(json_agg(g.name) FILTER (WHERE g.name IS NOT NULL), '[]') AS groups
     FROM users u
     LEFT JOIN group_members gm ON gm.user_id = u.id
     LEFT JOIN groups g ON g.id = gm.group_id
     GROUP BY u.id
     ORDER BY u.username`
  );
  return result.rows;
}

async function getUserById(db, id) {
  const result = await db.query(
    `SELECT u.*,
            COALESCE(json_agg(g.name) FILTER (WHERE g.name IS NOT NULL), '[]') AS groups
     FROM users u
     LEFT JOIN group_members gm ON gm.user_id = u.id
     LEFT JOIN groups g ON g.id = gm.group_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [id]
  );

  if (!result.rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  return result.rows[0];
}

async function updateUser(db, id, { email, fullName, isActive }) {
  const result = await db.query(
    `UPDATE users
     SET email     = COALESCE($1, email),
         full_name = COALESCE($2, full_name),
         is_active = COALESCE($3, is_active)
     WHERE id = $4
     RETURNING *`,
    [email, fullName, isActive, id]
  );

  if (!result.rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  return result.rows[0];
}

async function resetPassword(username, newPassword) {
  const { rows } = await appDb.query(
    'SELECT id FROM users WHERE username = $1',
    [username]
  );

  if (!rows[0]) {
    const err = new Error(`User '${username}' not found`);
    err.statusCode = 404;
    throw err;
  }

  await svnManagementService.updateSvnPassword(rows[0].id, newPassword);

  logger.info(`SVN password reset for user: ${username}`);
}

async function deleteUser(db, id) {
  const { rows } = await db.query(
    'SELECT username FROM users WHERE id = $1',
    [id]
  );

  if (!rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const { username } = rows[0];

  await svnManagementService.deprovisionSvnUser(id);
  await db.query('DELETE FROM users WHERE id = $1', [id]);
  await authzService.rebuildAuthzFile(db);

  logger.info(`User deleted: ${username}`);
}

module.exports = {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  resetPassword,
  deleteUser,
};
