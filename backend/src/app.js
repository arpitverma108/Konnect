'use strict';

const express       = require('express');
const cors          = require('cors');
const morgan        = require('morgan');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');

const errorHandler  = require('./middleware/errorHandler');

// Route imports
const repoRoutes        = require('./routes/repositories');
const userRoutes        = require('./routes/users');
const groupRoutes       = require('./routes/groups');
const permissionRoutes  = require('./routes/permissions');
const hookRoutes        = require('./routes/hooks');
const activityRoutes    = require('./routes/activity');
const dashboardRoutes   = require('./routes/dashboard');

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));

// ─── Logging (FIXED) ──────────────────────────────────────────────────────
app.use(morgan('combined')); // simple console logging

// ─── Body Parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/repositories', repoRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/groups',       groupRoutes);
app.use('/api/permissions',  permissionRoutes);
app.use('/api/hooks',        hookRoutes);
app.use('/api/activity',     activityRoutes);
app.use('/api/dashboard',    dashboardRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error Handler ────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;