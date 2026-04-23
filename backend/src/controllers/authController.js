const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
 

const { createSvnUser } = require("../utils/svn"); 

// Use secret from .env
const SECRET = process.env.JWT_SECRET;

// REGISTER
exports.register = async (req, res) => {
  try {

    // ✅ MULTIPLE USERS SUPPORT
    if (Array.isArray(req.body)) {
      for (const user of req.body) {

        if (!user.password) continue; // safety

        const existing = await pool.query(
          "SELECT * FROM users WHERE username = $1",
          [user.username]
        );

        if (existing.rows.length > 0) {
          console.log(`User ${user.username} already exists`);
          continue;
        }

        const hashed = await bcrypt.hash(user.password, 10);

        await pool.query(
          "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
          [user.username, user.email, hashed]
        );

        await createSvnUser(user.username, user.password);
      }

      return res.json({ message: "Multiple users processed" });
    }

    // ✅ SINGLE USER (existing code)
    const { username, email, password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password required" });
    }

    const existing = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: `User ${username} already exists`
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
      [username, email, hashed]
    );

    await createSvnUser(username, password);

    return res.json({
      message: "User created in DB + SVN"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username=$1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token
    });

  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};