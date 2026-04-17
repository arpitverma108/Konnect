'use strict';

const express    = require('express');
const Joi        = require('joi');
const router     = express.Router();

const auth       = require('../middleware/auth');
const db         = require('../config/database');
const validate   = require('../middleware/validate');
const wrap       = require('../middleware/asyncWrapper');
const userSvc    = require('../services/userService');

// ─── Validation ──────────────────────────────────────────────────────────────

const createSchema = Joi.object({
  username: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).min(2).max(64).required(),
  password: Joi.string().min(6).max(128).required(),
  email:    Joi.string().email().optional().allow('', null),
  fullName: Joi.string().max(128).optional().allow('', null),
});

const updateSchema = Joi.object({
  email:    Joi.string().email().optional().allow('', null),
  fullName: Joi.string().max(128).optional().allow('', null),
  isActive: Joi.boolean().optional(),
});

const passwordSchema = Joi.object({
  password: Joi.string().min(6).max(128).required(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/users
router.get('/', wrap(async (req, res) => {
  const users = await userSvc.listUsers(db);
  res.json(users);
}));

// POST /api/users
router.post('/', validate(createSchema), wrap(async (req, res) => {
  const user = await userSvc.createUser(db, req.body);
  res.status(201).json(user);
}));

// ✅ GET CURRENT USER (IMPORTANT)
router.get('/me', auth, wrap(async (req, res) => {
  console.log("🔥 ME ROUTE HIT");
  const user = await userSvc.getUserById(db, req.user.id);
  res.json(user);
}));

// ✅ ONLY NUMERIC ID ALLOWED (IMPORTANT FIX)
router.get('/:id(\\d+)', wrap(async (req, res) => {
  const user = await userSvc.getUserById(db, req.params.id);
  res.json(user);
}));

// PUT /api/users/:id
router.put('/:id(\\d+)', validate(updateSchema), wrap(async (req, res) => {
  const user = await userSvc.updateUser(db, req.params.id, req.body);
  res.json(user);
}));

// PUT /api/users/:id/password
router.put('/:id(\\d+)/password', validate(passwordSchema), wrap(async (req, res) => {
  const { rows } = await db.query('SELECT username FROM users WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });

  await userSvc.resetPassword(rows[0].username, req.body.password);
  res.json({ message: 'Password updated' });
}));

// DELETE /api/users/:id
router.delete('/:id(\\d+)', wrap(async (req, res) => {
  await userSvc.deleteUser(db, req.params.id);
  res.json({ message: 'User deleted' });
}));

module.exports = router;
