'use strict';
require('dotenv').config();

const env = require('./config/env'); // validates env once
const express       = require('express');
const cors          = require('cors');
const morgan        = require('morgan');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');

const errorHandler  = require('./middleware/errorHandler');

// Route imports
const authRoutes        = require('./routes/auth');
const settingsRoutes    = require('./routes/settings');
const auditLogsRoutes   = require('./routes/auditLogs');
const syncRoutes        = require('./routes/sync');
const repoRoutes        = require('./routes/repositories');
const userRoutes        = require('./routes/users');
const groupRoutes       = require('./routes/groups');
const permissionRoutes  = require('./routes/permissions');
const hookRoutes        = require('./routes/hooks');
const activityRoutes    = require('./routes/activity');
const dashboardRoutes   = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const svnRoutes         = require('./routes/svn');

const app = express();

// ─── Security ──────────────────────────────────────────────────────────────
app.use(helmet());

// FIX 4.2: Trust proxy so X-Forwarded-Proto works for HTTPS redirect detection
// Set to '1' if behind a single reverse proxy (nginx/apache) — adjust as needed.
app.set('trust proxy', 1);

// FIX 4.2: HTTPS redirect middleware (when running behind a reverse proxy)
// Uncomment the block below if Node.js is not behind TLS termination:
//
// app.use((req, res, next) => {
//   if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
//     return res.redirect(301, 'https://' + req.headers.host + req.url);
//   }
//   next();
// });

app.use(cors({ origin: env.CORS_ORIGIN }));

// ─── Logging ──────────────────────────────────────────────────────────────
// NOTE: Use 'combined' format in production — it logs the client IP and User-Agent.
app.use(morgan('combined'));

// ─── Body Parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Global Rate Limiting ─────────────────────────────────────────────────
// FIX 4.3: General API rate limit (300 req / 15 min per IP).
// The /api/auth/login endpoint gets a STRICTER 10/15min limit
// defined in routes/auth.js itself — applied before this one.
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

// ─── Debug: Who Am I (verify JWT payload) ────────────────────────────────
// GET /api/whoami with Authorization: Bearer <token>
// Shows exactly what req.user contains — use this to debug 401s
const authMw = require("./middleware/auth");
const wrapMw = require("./middleware/asyncWrapper");
app.get("/api/whoami", authMw, wrapMw(async (req, res) => {
  res.json({
    user:    req.user,
    role:    req.user?.role,
    isAdmin: ["admin", "super_admin"].includes(req.user?.role),
  });
}));

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/audit-logs',    auditLogsRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/repositories',  repoRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/groups',        groupRoutes);
app.use('/api/permissions',   permissionRoutes);
app.use('/api/hooks',         hookRoutes);
app.use('/api/activity',      activityRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/auth',          authRoutes);
app.use('/api/sync',          syncRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/svn',           svnRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error Handler ────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;