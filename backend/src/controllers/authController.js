'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { createSvnUser } = require("../utils/svn");
const env = require('../config/env');
const logger = require('../config/logger');

const SECRET = env.JWT_SECRET;

// ─────────────────────────────────────────────
// 🔍 VALIDATION
// ─────────────────────────────────────────────
const validateUser = (user) => {
  if (!user.username || user.username.length < 3) {
    return "Username must be at least 3 characters";
  }

  if (!user.password || user.password.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (user.email && !/^\S+@\S+\.\S+$/.test(user.email)) {
    return "Invalid email format";
  }

  return null;
};

// ─────────────────────────────────────────────
// 🌍 PUBLIC REGISTER → ALWAYS VIEWER
// ─────────────────────────────────────────────
exports.publicRegister = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { username, email, password, full_name } = req.body;

    const error = validateUser({ username, password, email });
    if (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error });
    }

    const existing = await client.query(
      "SELECT 1 FROM users WHERE username=$1",
      [username]
    );

    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "User already exists" });
    }

    const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const result = await client.query(
      `INSERT INTO users (username, email, full_name, password_hash, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [username, email || null, full_name || null, hash, 'viewer'] // 🔥 FIXED
    );

    await createSvnUser(username, password);

    await client.query(
      "INSERT INTO admin_logs (user_id, action, entity) VALUES ($1,$2,$3)",
      [result.rows[0].id, `Public register ${username}`, "user"]
    );

    await client.query('COMMIT');

    res.json({ message: "User registered successfully" });

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error("PUBLIC REGISTER ERROR", { error: err.message });

    res.status(500).json({ error: "Registration failed" });

  } finally {
    client.release();
  }
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
      "SELECT 1 FROM users WHERE username=$1",
      [username]
    );

    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "User already exists" });
    }

    // 🔐 ROLE CONTROL LOGIC
    let finalRole = 'viewer';

    if (req.user.role === 'super_admin') {
      finalRole = role || 'viewer'; // full access
    } 
    else if (req.user.role === 'admin') {

      if (role === 'super_admin') {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: "Admin cannot create super_admin"
        });
      }

      finalRole = role === 'admin' ? 'admin' : 'viewer';
    } 
    else {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: "Not allowed to create users"
      });
    }

    const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const result = await client.query(
      `INSERT INTO users (username, email, full_name, password_hash, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [username, email || null, full_name || null, hash, finalRole]
    );

    await createSvnUser(username, password);

    await client.query(
      "INSERT INTO admin_logs (user_id, action, entity) VALUES ($1,$2,$3)",
      [req.user.id, `Created user ${username} (${finalRole})`, "user"]
    );

    await client.query('COMMIT');

    res.json({
      message: "User created successfully",
      role: finalRole
    });

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error("CREATE USER ERROR", { error: err.message });

    res.status(500).json({ error: "Failed to create user" });

  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// 🔐 LOGIN
// ─────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username=$1 AND is_active=true',
      [username]
    );

    const user = result.rows[0];

    // 🔐 Prevent timing attacks
    const fakeHash = "$2a$10$7EqJtq98hPqEX7fNZaFWoOHi5s9k9s5k5k5k5k5k5k5k5k5k5k5k";
    const passwordHash = user ? user.password_hash : fakeHash;

    const valid = await bcrypt.compare(password, passwordHash);

    if (!user || !valid) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    logger.error("LOGIN ERROR", { error: err.message });

    res.status(500).json({
      error: "Login failed"
    });
  }
};