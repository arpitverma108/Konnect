'use strict';

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// ─────────────────────────────────────────────
// 🌍 PUBLIC REGISTER (ONLY VIEWER)
// ─────────────────────────────────────────────
router.post('/register', authController.publicRegister);

// ─────────────────────────────────────────────
// 🔐 LOGIN
// ─────────────────────────────────────────────
router.post('/login', authController.login);

// ─────────────────────────────────────────────
// 🔐 CREATE USER (ADMIN / SUPER ADMIN)
// ─────────────────────────────────────────────
router.post(
  '/create-user',
  authMiddleware,
  authorize('admin', 'super_admin'),
  authController.createUser
);

module.exports = router;