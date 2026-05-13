'use strict';

const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const apacheMD5 = require('apache-md5');

const apacheCfg = require('../config/apache');
const authzService = require('./authzService');
const logger = require('../config/logger');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);


// ───────────── READ HTPASSWD ─────────────

async function readHtpasswd() {
  const filePath = apacheCfg.htpasswdPath;

  try {
    const content = await fs.readFile(filePath, 'utf8');

    const map = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const [user, hash] = trimmed.split(':');
      map[user] = hash;
    }

    return map;

  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}


// ───────────── WRITE HTPASSWD ─────────────

async function writeHtpasswd(map) {
  const filePath = apacheCfg.htpasswdPath;

  let content = '';
  for (const user in map) {
    content += `${user}:${map[user]}\n`;
  }

  await fs.writeFile(filePath, content, 'utf8');

  // ✅ SAFE LOG
  logger.debug("htpasswd file updated successfully");
}


// ───────────── CREATE USER ─────────────

async function createUser(db, { username, password, email, fullName }) {

  if (!username || !password) {
    const err = new Error('Username and password required');
    err.statusCode = 400;
    throw err;
  }

  // 1. Hash for DB
  const dbHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // 2. Read htpasswd
  const map = await readHtpasswd();

  if (map[username]) {
    const err = new Error(`User '${username}' already exists`);
    err.statusCode = 409;
    throw err;
  }

  // 3. Add Apache user
  map[username] = apacheMD5(password);

  // 4. Write file
  await writeHtpasswd(map);

  // 5. Insert DB
  let user;
  try {
    const result = await db.query(
      `INSERT INTO users (username, password_hash, email, full_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [username, dbHash, email || null, fullName || null]
    );

    user = result.rows[0];

  } catch (err) {
    // rollback file if DB fails
    const map2 = await readHtpasswd();
    delete map2[username];
    await writeHtpasswd(map2);
    throw err;
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
  const map = await readHtpasswd();

  if (!map[username]) {
    const err = new Error(`User '${username}' not found`);
    err.statusCode = 404;
    throw err;
  }

  map[username] = apacheMD5(newPassword);
  await writeHtpasswd(map);

  logger.info(`Password reset for user: ${username}`);
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

  const map = await readHtpasswd();
  delete map[username];
  await writeHtpasswd(map);

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