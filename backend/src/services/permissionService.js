'use strict';

const db = require('../config/database');

// ✅ FIXED REDIS IMPORT - plain object import, not destructured
const redis = require('../config/redis');

const CACHE_TTL = 60; // seconds

// ─────────────────────────────────────────────
// 🔥 GET USER PERMISSIONS (CACHED)
// ─────────────────────────────────────────────

async function getUserPermissions(userId, repoId) {

  const cacheKey = `perm:${userId}:${repoId}`;

  // ✅ 1. Cache read (SAFE)
  if (redis.isAvailable()) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached;  // ✅ Already parsed by redis.get(), no JSON.parse needed
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

  // ✅ 3. Cache write - correct 3-arg signature (key, value, ttl)
  if (redis.isAvailable()) {
    try {
      await redis.set(cacheKey, perms, CACHE_TTL);  // ✅ TTL as 3rd arg, no 'EX'
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
  if (!redis.isAvailable()) return;

  try {
    // ✅ For production: use SCAN to avoid blocking Redis event loop
    // For small datasets: direct KEYS + DEL is acceptable
    // This implementation uses KEYS for simplicity but is production-safe for <10k keys
    const keys = await redis.keys(`perm:*:${repoId}`);

    if (keys.length) {
      // Delete all matching keys
      await redis.del(keys);
    }

    // ✅ NOTE: For large-scale production with millions of keys,
    // consider using SCAN stream:
    // const stream = client.scanStream({ match: pattern, count: 100 });
    // stream.on('data', keys => client.del(...keys));

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