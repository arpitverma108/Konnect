'use strict';

const Redis = require('ioredis');

let client = null;
let isAvailable = false;

// 🔁 Fallback (safe no-op if Redis is down)
const fallback = {
  get: async () => null,
  set: async () => null,
  del: async () => null,
  keys: async () => [],
};

try {
  client = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,

    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('⚠️ Redis retry limit reached, disabling Redis');
        return null; // stop retrying
      }
      return Math.min(times * 200, 2000);
    }
  });

  // ✅ When Redis is ready
  client.on('ready', () => {
    isAvailable = true;
    console.log('✅ Redis ready');
  });

  // ❌ On error
  client.on('error', (err) => {
    isAvailable = false;
    console.error('❌ Redis error:', err.message);
  });

  // ⚠️ On disconnect
  client.on('end', () => {
    isAvailable = false;
    console.warn('⚠️ Redis disconnected');
  });

} catch (err) {
  console.error('❌ Redis initialization failed:', err.message);
}

// 🧠 Safe Redis wrapper
const redis = {

  // 🔍 GET (safe JSON parse)
  async get(key) {
    try {
      if (!isAvailable || !client) return fallback.get(key);

      const data = await client.get(key);
      if (!data) return null;

      // 🔥 SAFE PARSE (fixes "Unexpected token o")
      try {
        return JSON.parse(data);
      } catch {
        return data; // already plain string/object
      }

    } catch (err) {
      console.error('Redis GET error:', err.message);
      return null;
    }
  },

  // 💾 SET (safe stringify + TTL fix)
  async set(key, value, ttl = 300) {
    try {
      if (!isAvailable || !client) return fallback.set(key, value);

      // 🔥 FIX: force TTL to valid number
      const safeTTL = Number(ttl) || 300;

      return await client.set(
        key,
        JSON.stringify(value), // always stringify here
        'EX',
        safeTTL
      );

    } catch (err) {
      console.error('Redis SET error:', err.message);
      return null;
    }
  },

  // ❌ DELETE
  async del(key) {
    try {
      if (!isAvailable || !client) return fallback.del(key);

      return await client.del(key);

    } catch (err) {
      console.error('Redis DEL error:', err.message);
      return null;
    }
  },

  // 🔎 KEYS (use carefully in production)
  async keys(pattern) {
    try {
      if (!isAvailable || !client) return fallback.keys(pattern);

      return await client.keys(pattern);

    } catch (err) {
      console.error('Redis KEYS error:', err.message);
      return [];
    }
  },

  // 🧹 DELETE BY PATTERN (NEW - useful for cache invalidation)
  async delPattern(pattern) {
    try {
      if (!isAvailable || !client) return;

      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }

    } catch (err) {
      console.error('Redis DEL PATTERN error:', err.message);
    }
  },

  // 📊 Status check
  isAvailable() {
    return isAvailable;
  }
};

module.exports = redis;