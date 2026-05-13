'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const pool = require('../config/database');

// ─────────────────────────────────────────────
// AUTH MIDDLEWARE
// FIX 3.5: Validates token_version against DB.
// If password was changed after this token was issued, the token is rejected.
// ─────────────────────────────────────────────
module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1️⃣ Check header exists + correct format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2️⃣ Extract token
  const token = authHeader.split(' ')[1];

  try {
    // 3️⃣ Verify JWT signature + expiry
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // 4️⃣ FIX 3.5: Validate token_version against the DB.
    //    If admin changed a user's password, token_version increments,
    //    immediately invalidating all old tokens for that user.
    if (decoded.tokenVersion !== undefined) {
      const { rows } = await pool.query(
        'SELECT token_version, is_active FROM users WHERE id = $1',
        [decoded.id]
      );

      if (!rows.length || !rows[0].is_active) {
        return res.status(401).json({ error: 'User account not found or disabled' });
      }

      if (rows[0].token_version !== decoded.tokenVersion) {
        return res.status(401).json({ error: 'Session invalidated. Please log in again.' });
      }
    }

    // 5️⃣ Attach user to request
    req.user = decoded;

    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};