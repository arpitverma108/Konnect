// userService.js
'use strict';

const { execFile }  = require('child_process');
const { promisify } = require('util');
const fse           = require('fs-extra');
const bcrypt        = require('bcrypt');
const apacheCfg     = require('../config/apache');
const authzService  = require('./authzService');
const logger        = require('../config/logger');

const execFileAsync = promisify(execFile);
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// ─── htpasswd file helpers ────────────────────────────────────────────────────

/**
 * Read the htpasswd file and return a map of { username: hash }.
 */
async function readHtpasswd() {
  const htpasswdPath = apacheCfg.htpasswdPath;
  try {
    const content = await fse.readFile(htpasswdPath, 'utf8');
    const map = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      map[trimmed.slice(0, colonIdx)] = trimmed.slice(colonIdx + 1);
    }
    return map;
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

/**
 * Write the htpasswd map back to file atomically.
 */
async function writeHtpasswd(map) {
  const htpasswdPath = apacheCfg.htpasswdPath;
  const tmp = htpasswdPath + '.tmp';
  const lines = Object.entries(map).map(([u, h]) => `${u}:${h}`).join('\n');
  await fse.ensureFile(htpasswdPath);
  await fse.writeFile(tmp, lines + '\n', 'utf8');
  await fse.move(tmp, htpasswdPath, { overwrite: true });
}

// ─── User CRUD ────────────────────────────────────────────────────────────────

/**
 * Create a user in the DB and add to htpasswd.
 */
async function createUser(db, { username, password, email, fullName }) {
  // 1. Hash password (never stored in DB)
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // 2. Write to htpasswd
  const map = await readHtpasswd();
  if (map[username]) {
    const err = new Error(`User '${username}' already exists in htpasswd`);
    err.statusCode = 409;
    throw err;
  }
  map[username] = hash;
  await writeHtpasswd(map);

  // 3. Insert into DB
  let user;
  try {
    const result = await db.query(
      `INSERT INTO users (username, email, full_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [username, email || null, fullName || null]
    );
    user = result.rows[0];
  } catch (err) {
    // Roll back htpasswd entry on DB failure
    const map2 = await readHtpasswd();
    delete map2[username];
    await writeHtpasswd(map2);
    throw err;
  }

  logger.info(`User created: ${username}`);
  return user;
}

/**
 * List all users.
 */
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

/**
 * Get a single user by id.
 */
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

/**
 * Update user metadata (email / full_name / is_active).
 */
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

/**
 * Reset a user's password in htpasswd only.
 */
async function resetPassword(username, newPassword) {
  const map = await readHtpasswd();
  if (!map[username]) {
    const err = new Error(`User '${username}' not found in htpasswd`);
    err.statusCode = 404;
    throw err;
  }
  map[username] = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await writeHtpasswd(map);
  logger.info(`Password reset for user: ${username}`);
}

/**
 * Delete a user — removes from htpasswd, DB, permissions, and groups.
 * Rebuilds authz file after.
 */
async function deleteUser(db, id) {
  // Fetch username first
  const { rows } = await db.query('SELECT username FROM users WHERE id = $1', [id]);
  if (!rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  const { username } = rows[0];

  // Remove from htpasswd
  const map = await readHtpasswd();
  delete map[username];
  await writeHtpasswd(map);

  // DB cascade handles group_members and permissions (ON DELETE CASCADE)
  await db.query('DELETE FROM users WHERE id = $1', [id]);

  // Rebuild authz
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
