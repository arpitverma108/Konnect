'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// ─────────────────────────────────────────────
// FIX 4.3: Strict rate limit on login endpoint
// Max 10 login attempts per 15 min per IP
// ─────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────
// 🚫 PUBLIC REGISTER — DISABLED (FIX 3.4)
// Returns 403 for all self-registration attempts.
// ─────────────────────────────────────────────
router.post('/register', authController.publicRegister);

// ─────────────────────────────────────────────
// 🔐 LOGIN (with dedicated brute-force rate limit)
// ─────────────────────────────────────────────
router.post('/login', loginLimiter, authController.login);

// ─────────────────────────────────────────────
// 🔄 REFRESH TOKEN
// ─────────────────────────────────────────────
router.post('/refresh', authController.refreshToken);

// ─────────────────────────────────────────────
// 🚪 LOGOUT
// ─────────────────────────────────────────────
router.post('/logout', authMiddleware, authController.logout);

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