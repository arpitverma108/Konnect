'use strict';

const db = require('../config/database');

// ✅ FIXED REDIS IMPORT
const { redis, isRedisAvailable } = require('../config/redis');

const CACHE_TTL = 60; // seconds

// ─────────────────────────────────────────────
// 🔥 GET USER PERMISSIONS (CACHED)
// ─────────────────────────────────────────────

async function getUserPermissions(userId, repoId) {

  const cacheKey = `perm:${userId}:${repoId}`;

  // ✅ 1. Cache read (SAFE)
  if (isRedisAvailable()) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
  }

  // ✅ 2. Fetch from DB (FIXED BUG)
  const { rows } = await db.query(`
    SELECT DISTINCT permission
    FROM permissions
    WHERE repo_id = $1
      AND (
        (subject_type = 'user' AND subject_id = $2)
        OR
        (subject_type = 'group' AND subject_id IN (
          SELECT group_id FROM group_members WHERE user_id = $2
        ))
      )
  `, [repoId, userId]);

  const perms = rows.map(r => r.permission || '');

  // ✅ 3. Cache write
  if (isRedisAvailable()) {
    try {
      await redis.set(
        cacheKey,
        JSON.stringify(perms),
        'EX',
        CACHE_TTL
      );
    } catch {}
  }

  return perms;
}


// ─────────────────────────────────────────────
// 🔐 PERMISSION HELPERS
// ─────────────────────────────────────────────

function hasRead(perms = []) {
  return perms.includes('r') || perms.includes('rw');
}

function hasWrite(perms = []) {
  return perms.includes('rw');
}


// ─────────────────────────────────────────────
// 🧹 CACHE INVALIDATION
// ─────────────────────────────────────────────

async function clearRepoPermissionCache(repoId) {
  if (!isRedisAvailable()) return;

  try {
    const keys = await redis.keys(`perm:*:${repoId}`);
    
    if (keys.length) {
      // ✅ FIX: spread operator
      await redis.del(...keys);
    }
  } catch (err) {
    console.error("Cache clear error:", err.message);
  }
}


module.exports = {
  getUserPermissions,
  hasRead,
  hasWrite,
  clearRepoPermissionCache
};