'use strict';

const express   = require('express');
const Joi       = require('joi');
const bcrypt    = require('bcryptjs');
const router    = express.Router();

const db        = require('../config/database');
const validate  = require('../middleware/validate');
const wrap      = require('../middleware/asyncWrapper');
const auth      = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const env       = require('../config/env');

// ─── CONSTANTS ─────────────────────────────

const allowedRoles = ['viewer', 'admin', 'super_admin'];

// ─── VALIDATION ─────────────────────────────

const createSchema = Joi.object({
  username: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).min(2).max(64).required(),
  password: Joi.string().min(8).max(128).required(),
  email:    Joi.string().email().optional().allow('', null),
  fullName: Joi.string().max(128).optional().allow('', null),
  role:     Joi.string().valid(...allowedRoles).optional()
});

const updateSchema = Joi.object({
  email:    Joi.string().email().optional().allow('', null),
  fullName: Joi.string().max(128).optional().allow('', null),
  isActive: Joi.boolean().optional(),
  role:     Joi.string().valid(...allowedRoles).optional()
});

const passwordSchema = Joi.object({
  password: Joi.string().min(8).max(128).required(),
});

// ─── GET ALL USERS ─────────────────────────

router.get(
  '/',
  auth,
  authorize("admin","super_admin"),
  wrap(async (req, res) => {

    const page   = parseInt(req.query.page) || 1;
    const limit  = Math.min(parseInt(req.query.limit) || 10, 50);
    const search = req.query.search || '';

    const offset = (page - 1) * limit;

    const { rows } = await db.query(
      `SELECT id, username, email, full_name, role, is_active, created_at
       FROM users
       WHERE username ILIKE '%' || $1 || '%'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [search, limit, offset]
    );

    const totalResult = await db.query(
      `SELECT COUNT(*) FROM users WHERE username ILIKE '%' || $1 || '%'`,
      [search]
    );

    res.json({
      page,
      limit,
      total: parseInt(totalResult.rows[0].count),
      data: rows
    });
  })
);

// ─── GET CURRENT USER ─────────────────────────

router.get(
  '/me',
  auth,
  wrap(async (req, res) => {

    const { rows } = await db.query(
      `SELECT id, username, email, full_name, role 
       FROM users WHERE id=$1`,
      [req.user.id]
    );

    res.json(rows[0]);
  })
);

// ─── CREATE USER (FIXED 🔥) ─────────────────────────

router.post(
  '/',
  auth,
  authorize("admin","super_admin"),
  validate(createSchema),
  wrap(async (req, res) => {

    const { username, password, email, fullName, role } = req.body;

    const existing = await db.query(
      "SELECT 1 FROM users WHERE username=$1",
      [username]
    );

    if (existing.rows.length) {
      return res.status(400).json({ error: "User already exists" });
    }

    // 🔐 ROLE CONTROL
    let finalRole = 'viewer';

    if (req.user.role === 'super_admin') {
      finalRole = role || 'viewer';
    }
    else if (req.user.role === 'admin') {

      if (role === 'super_admin') {
        return res.status(403).json({
          error: "Admin cannot create super_admin"
        });
      }

      finalRole = role === 'admin' ? 'admin' : 'viewer';
    }

    const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const { rows } = await db.query(`
      INSERT INTO users (username, email, full_name, password_hash, role)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id, username, role
    `, [username, email || null, fullName || null, hash, finalRole]);

    res.status(201).json(rows[0]);
  })
);

// ─── UPDATE USER (FIXED 🔥) ─────────────────────────

router.put(
  '/:id',
  auth,
  authorize("admin","super_admin"),
  validate(updateSchema),
  wrap(async (req, res) => {

    const userId = req.params.id;

    const existing = await db.query(
      "SELECT role FROM users WHERE id=$1",
      [userId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    let finalRole = existing.rows[0].role;

    if (req.body.role) {

      if (!allowedRoles.includes(req.body.role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      if (req.user.role === 'super_admin') {
        finalRole = req.body.role;
      }
      else if (req.user.role === 'admin') {

        if (req.body.role === 'super_admin') {
          return res.status(403).json({
            error: "Admin cannot assign super_admin"
          });
        }

        finalRole = req.body.role;
      }
    }

    const { rows } = await db.query(
      `UPDATE users 
       SET email     = COALESCE($1, email),
           full_name = COALESCE($2, full_name),
           is_active = COALESCE($3, is_active),
           role      = $4
       WHERE id=$5
       RETURNING id, username, role`,
      [req.body.email, req.body.fullName, req.body.isActive, finalRole, userId]
    );

    res.json(rows[0]);
  })
);

// ─── CHANGE PASSWORD ─────────────────────────

router.put(
  '/:id/password',
  auth,
  validate(passwordSchema),
  wrap(async (req, res) => {

    if (req.user.id != req.params.id && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const hash = await bcrypt.hash(req.body.password, env.BCRYPT_ROUNDS);

    await db.query(
      "UPDATE users SET password_hash=$1 WHERE id=$2",
      [hash, req.params.id]
    );

    res.json({ message: "Password updated" });
  })
);

// ─── DELETE USER ─────────────────────────

router.delete(
  '/:id',
  auth,
  authorize("super_admin"),
  wrap(async (req, res) => {

    const { rows } = await db.query(
      "DELETE FROM users WHERE id=$1 RETURNING username",
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted" });
  })
);

module.exports = router;