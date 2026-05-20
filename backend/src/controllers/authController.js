'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const env = require('../config/env');
const logger = require('../config/logger');
const { logActivity, ACTIVITY_TYPES } = require('../services/activityLogger');
const svnManagementService = require('../services/svnManagementService');

const SECRET = env.JWT_SECRET;

// ─────────────────────────────────────────────
// 🔧 HELPER: Hash a refresh token for DB storage
// ─────────────────────────────────────────────
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─────────────────────────────────────────────
// 🔧 HELPER: Store refresh token in DB (FIX 3.1)
// ─────────────────────────────────────────────
async function storeRefreshToken(client, userId, token, expiresAt) {
  const tokenHash = hashToken(token);
  await client.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_hash) DO NOTHING`,
    [tokenHash, userId, expiresAt]
  );
}

// ─────────────────────────────────────────────
// 🔧 HELPER: Revoke a refresh token in DB (FIX 3.1 + 3.5)
// ─────────────────────────────────────────────
async function revokeRefreshToken(client, token) {
  const tokenHash = hashToken(token);
  await client.query(
    `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
    [tokenHash]
  );
}

// ─────────────────────────────────────────────
// 🔧 HELPER: Revoke ALL refresh tokens for a user (FIX 3.5)
// Used on password change to invalidate all sessions.
// ─────────────────────────────────────────────
async function revokeAllUserTokens(client, userId) {
  await client.query(
    `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`,
    [userId]
  );
}

// ─────────────────────────────────────────────
// 🔍 VALIDATION
// ─────────────────────────────────────────────
const validateUser = (user) => {
  if (!user.username || user.username.length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (!user.password || user.password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (user.email && !/^\S+@\S+\.\S+$/.test(user.email)) {
    return 'Invalid email format';
  }
  return null;
};

// ─────────────────────────────────────────────
// 🚫 PUBLIC REGISTER — DISABLED (FIX 3.4)
// Self-registration is disabled for corporate datacenter.
// Use POST /api/auth/create-user (admin only) instead.
// ─────────────────────────────────────────────
exports.publicRegister = async (req, res) => {
  return res.status(403).json({
    error: 'Self-registration is disabled. Contact your administrator to create an account.',
  });
};

// ─────────────────────────────────────────────
// 🔐 CREATE USER (ADMIN / SUPER ADMIN)
// ─────────────────────────────────────────────
exports.createUser = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { username, email, password, role, full_name } = req.body;

    const error = validateUser({ username, password, email });
    if (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error });
    }

    const existing = await client.query(
      'SELECT 1 FROM users WHERE username=$1',
      [username]
    );

    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User already exists' });
    }

    // 🔐 ROLE CONTROL LOGIC
    let finalRole = 'viewer';

    if (req.user.role === 'super_admin') {
      finalRole = role || 'viewer';
    } else if (req.user.role === 'admin') {
      if (role === 'super_admin') {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Admin cannot create super_admin' });
      }
      finalRole = role === 'admin' ? 'admin' : 'viewer';
    } else {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not allowed to create users' });
    }

    const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const result = await client.query(
      `INSERT INTO users (username, email, full_name, password_hash, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [username, email || null, full_name || null, hash, finalRole]
    );

    const userId = result.rows[0].id;

    await client.query(
      'INSERT INTO admin_logs (user_id, action, entity) VALUES ($1,$2,$3)',
      [req.user.id, `Created user ${username} (${finalRole})`, 'user']
    );

    await client.query('COMMIT');

    let svnProvisioning = { success: true };
    try {
      await svnManagementService.provisionSvnUser(userId, password);
    } catch (svnError) {
      svnProvisioning = { success: false, error: svnError.message };
      logger.error('SVN provisioning failed during user creation', { userId, error: svnError.message });
    }

    res.json({ message: 'User created successfully', role: finalRole, svnProvisioning });

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('CREATE USER ERROR', { error: err.message });
    res.status(500).json({ error: 'Failed to create user' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// 🔐 LOGIN
// FIX 3.1: Refresh token now stored in DB (not just Redis)
// FIX 3.5: token_version included in JWT payload
// ─────────────────────────────────────────────
exports.login = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username=$1 AND is_active=true',
      [username]
    );

    const user = result.rows[0];

    // 🔐 Prevent timing attacks with a fake hash
    const fakeHash = '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi5s9k9s5k5k5k5k5k5k5k5k5k5k5k';
    const passwordHash = user ? user.password_hash : fakeHash;

    const valid = await bcrypt.compare(password, passwordHash);

    if (!user || !valid) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // FIX 3.5: include token_version so password changes invalidate old tokens
    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        tokenVersion: user.token_version,  // ← FIX 3.5
      },
      SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        type: 'refresh',
        tokenVersion: user.token_version,  // ← FIX 3.5
      },
      SECRET,
      { expiresIn: '7d' }
    );

    // FIX 3.1: persist hashed refresh token in DB
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storeRefreshToken(client, user.id, refreshToken, refreshExpiry);

    // 📊 Log login activity
    const userAgent = req.get('user-agent') || 'unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    await logActivity(pool, {
      event_type: ACTIVITY_TYPES.AUTH_LOGIN,
      user_id: user.id,
      action: `User logged in`,
      entity: 'user',
      entity_id: user.id,
      metadata: {
        username: user.username,
        ip_address: ipAddress,
        user_agent: userAgent,
        login_method: 'credentials',
      },
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('LOGIN ERROR', { error: err.message });
    res.status(500).json({ error: 'Login failed' });
  } finally {
    
    if (client) client.release(); 

  }
};

// ─────────────────────────────────────────────
// ✅ REFRESH TOKEN
// FIX 3.1: Validates against DB (Redis-independent revocation)
// FIX 3.5: Validates token_version against DB
// ─────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  const client = await pool.connect();

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Step 1: Verify JWT signature + expiry
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Step 2: Check DB — FIX 3.1 (DB-durable revocation, no Redis dependency)
    const tokenHash = hashToken(refreshToken);
    const { rows } = await client.query(
      `SELECT rt.revoked, u.id, u.username, u.role, u.token_version, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Refresh token not found or expired' });
    }

    const row = rows[0];

    if (row.revoked) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    if (!row.is_active) {
      return res.status(401).json({ error: 'User account is disabled' });
    }

    // FIX 3.5: Validate token_version — rejects tokens issued before a password change
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== row.token_version) {
      return res.status(401).json({ error: 'Session invalidated. Please log in again.' });
    }

    // Also check Redis blacklist if available (belt-and-suspenders)
    const redis = require('../config/redis');
    if (redis.isAvailable()) {
      const isBlacklisted = await redis.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
    }

    // Step 3: Issue new access token
    const newAccessToken = jwt.sign(
      {
        id: row.id,
        username: row.username,
        role: row.role,
        tokenVersion: row.token_version,
      },
      SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      accessToken: newAccessToken,
      refreshToken,  // client continues using the same refresh token
    });

  } catch (err) {
    logger.error('REFRESH TOKEN ERROR', { error: err.message });
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// ✅ LOGOUT / TOKEN REVOCATION
// FIX 3.1: Revokes in DB (durable even if Redis is down)
// ─────────────────────────────────────────────
exports.logout = async (req, res) => {
  const client = await pool.connect();

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // FIX 3.1: Revoke in DB
    await revokeRefreshToken(client, refreshToken);

    // 📊 Log logout activity
    const userAgent = req.get('user-agent') || 'unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    await logActivity(pool, {
      event_type: ACTIVITY_TYPES.AUTH_LOGOUT,
      user_id: req.user.id,
      action: `User logged out`,
      entity: 'user',
      entity_id: req.user.id,
      metadata: {
        username: req.user.username,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });

    // Also blacklist in Redis if available (belt-and-suspenders for immediate access token invalidation)
    const redis = require('../config/redis');
    if (redis.isAvailable()) {
      const decoded = jwt.decode(refreshToken);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.set(`blacklist:${refreshToken}`, '1', ttl);
        }
      }
    }

    logger.info(`User ${req.user ? req.user.username : 'unknown'} logged out`);

    res.json({ message: 'Logged out successfully' });

  } catch (err) {
    logger.error('LOGOUT ERROR', { error: err.message });
    res.status(500).json({ error: 'Logout failed' });
  } finally {
    client.release();
  }
};

// Export helpers for use in users route (password change)
exports.revokeAllUserTokens = revokeAllUserTokens;
