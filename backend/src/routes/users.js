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
const logger    = require('../config/logger');
const svnManagementService = require('../services/svnManagementService');
const { revokeAllUserTokens } = require('../controllers/authController'); // FIX N1: moved to top
const { logActivity, ACTIVITY_TYPES } = require('../services/activityLogger');

// ─── CONSTANTS ─────────────────────────────

const allowedRoles = ['viewer', 'admin', 'super_admin'];

// ─── VALIDATION ─────────────────────────────

const createSchema = Joi.object({
  username: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).min(2).max(64).required(),
  password: Joi.string().min(8).max(128).required(),
  email:    Joi.string().email().optional().allow('', null),
  fullName: Joi.string().max(128).optional().allow('', null),
  role:     Joi.string().valid(...allowedRoles).optional(),
});

const updateSchema = Joi.object({
  email:    Joi.string().email().optional().allow('', null),
  fullName: Joi.string().max(128).optional().allow('', null),
  isActive: Joi.boolean().optional(),
  role:     Joi.string().valid(...allowedRoles).optional(),
});

// ─── GET ALL USERS ─────────────────────────

router.get(
  '/',
  auth,
  authorize('admin', 'super_admin'),
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
      data: rows,
    });
  })
);

// ─── GET CURRENT USER ─────────────────────────

router.get(
  '/me',
  auth,
  wrap(async (req, res) => {
    const { rows } = await db.query(
      `SELECT id, username, email, full_name, role FROM users WHERE id=$1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  })
);


// ─── GET SINGLE USER BY ID ───────────────────
// GET /api/users/:id
// Accessible by: admin, super_admin (to view any user)
//                any authenticated user (to view their own profile)

router.get(
  '/:id',
  auth,
  wrap(async (req, res) => {
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Non-admins can only fetch their own profile
    const isAdminOrAbove = ['admin', 'super_admin'].includes(req.user.role);
    if (!isAdminOrAbove && req.user.id !== targetId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await db.query(
      'SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE id=$1',
      [targetId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  })
);

// ─── CREATE USER ─────────────────────────────

router.post(
  '/',
  auth,
  authorize('admin', 'super_admin'),
  validate(createSchema),
  wrap(async (req, res) => {
    const { username, password, email, fullName, role } = req.body;

    const existing = await db.query(
      'SELECT 1 FROM users WHERE username=$1',
      [username]
    );

    if (existing.rows.length) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // 🔐 ROLE CONTROL
    let finalRole = 'viewer';

    if (req.user.role === 'super_admin') {
      finalRole = role || 'viewer';
    } else if (req.user.role === 'admin') {
      if (role === 'super_admin') {
        return res.status(403).json({ error: 'Admin cannot create super_admin' });
      }
      finalRole = role === 'admin' ? 'admin' : 'viewer';
    }

    const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const { rows } = await db.query(`
      INSERT INTO users (username, email, full_name, password_hash, role)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id, username, role
    `, [username, email || null, fullName || null, hash, finalRole]);

    // 📊 Log user creation — both structured activity and admin audit log
    const newUserId = rows[0].id;
    const action = `Created user account: ${username} with role "${finalRole}"`;

    await logActivity(db, {
      event_type: ACTIVITY_TYPES.USER_CREATE,
      user_id: req.user.id,
      action,
      entity: 'user',
      entity_id: newUserId,
      metadata: {
        username,
        role: finalRole,
        email: email || null,
      },
    });

    // Also write to admin_logs so the event appears in the Audit Logs page
    await db.query(
      'INSERT INTO admin_logs (user_id, action, entity, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, action, 'user', newUserId]
    );

    let svnProvisioning = { success: true };
    try {
      await svnManagementService.provisionSvnUser(newUserId, password);
    } catch (err) {
      svnProvisioning = { success: false, error: err.message };
      logger.error('SVN provisioning failed during user creation', {
        userId: newUserId,
        username,
        error: err.message,
      });
    }

    res.status(201).json({
      ...rows[0],
      svnProvisioning,
    });
  })
);

// ─── UPDATE USER ─────────────────────────────────────────────────────────────
//
// PUT /api/users/:id
//
// Role-change hierarchy (mirrors password-change rules):
// ┌─────────────────┬──────────────────────────────────────────────────────────┐
// │ Who is calling  │ What role changes they can make                          │
// ├─────────────────┼──────────────────────────────────────────────────────────┤
// │ admin           │ Can update profile (email/fullName/isActive) of          │
// │                 │ viewer-role users ONLY                                    │
// │                 │ Can change a viewer → viewer or viewer → admin           │
// │                 │ CANNOT touch any admin or super_admin user at all        │
// │                 │ CANNOT assign the super_admin role to anyone             │
// │                 │ CANNOT change their own role                             │
// ├─────────────────┼──────────────────────────────────────────────────────────┤
// │ super_admin     │ Can update any user's profile and role                   │
// │                 │ Can assign any role (viewer/admin/super_admin)           │
// │                 │ CANNOT change their own role (prevents accidental        │
// │                 │ self-demotion — must be done by another super_admin)     │
// └─────────────────┴──────────────────────────────────────────────────────────┘
//
// ─────────────────────────────────────────────────────────────────────────────

router.put(
  '/:id',
  auth,
  authorize('admin', 'super_admin'),
  validate(updateSchema),
  wrap(async (req, res) => {
    const requesterId   = req.user.id;
    const requesterRole = req.user.role;
    const targetId      = parseInt(req.params.id, 10);
    const isSelfUpdate  = requesterId === targetId;

    // ── 1. Fetch the target user ────────────────────────────────────────────
    const { rows: existing } = await db.query(
      'SELECT id, username, role, is_active FROM users WHERE id = $1',
      [targetId]
    );

    if (!existing.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const target = existing[0];

    // ── 2. Role-change permission rules ────────────────────────────────────
    const incomingRole = req.body.role;  // may be undefined if not changing role

    if (isSelfUpdate && incomingRole && incomingRole !== target.role) {
      // Nobody can change their own role — prevents accidental self-demotion
      // and stops an admin from promoting themselves to super_admin.
      return res.status(403).json({
        error: 'You cannot change your own role.',
      });
    }

    if (!isSelfUpdate) {
      if (requesterRole === 'admin') {
        // Admin can only touch viewer-role users
        if (target.role !== 'viewer') {
          return res.status(403).json({
            error: `Admin cannot update a user with role "${target.role}". Only viewer accounts may be updated by an admin.`,
          });
        }

        // Admin cannot assign super_admin or demote to an equal/higher role
        if (incomingRole && incomingRole === 'super_admin') {
          return res.status(403).json({
            error: 'Admin cannot assign the super_admin role.',
          });
        }

      } else if (requesterRole === 'super_admin') {
        // super_admin can update anyone — no extra restrictions for others
        // (self-update is already blocked above for role changes)
      }
    }

    // ── 3. Resolve the final role ───────────────────────────────────────────
    let finalRole = target.role; // keep existing role by default

    if (incomingRole) {
      if (!allowedRoles.includes(incomingRole)) {
        return res.status(400).json({ error: 'Invalid role.' });
      }
      finalRole = incomingRole;
    }

    // ── 4. Persist changes ─────────────────────────────────────────────────
    const { rows } = await db.query(
      `UPDATE users
       SET email     = COALESCE($1, email),
           full_name = COALESCE($2, full_name),
           is_active = COALESCE($3, is_active),
           role      = $4
       WHERE id = $5
       RETURNING id, username, email, full_name, role, is_active`,
      [req.body.email ?? null, req.body.fullName ?? null, req.body.isActive ?? null, finalRole, targetId]
    );

    // ── 5. Audit log (only if role actually changed) ───────────────────────
    if (incomingRole && incomingRole !== target.role) {
      const action = `Changed role of user "${target.username}" from "${target.role}" to "${incomingRole}"`;
      await db.query(
        'INSERT INTO admin_logs (user_id, action, entity, entity_id) VALUES ($1,$2,$3,$4)',
        [requesterId, action, 'user', targetId]
      );

      // 📊 Log structured activity
      await logActivity(db, {
        event_type: ACTIVITY_TYPES.USER_ROLE_CHANGE,
        user_id: requesterId,
        action,
        entity: 'user',
        entity_id: targetId,
        metadata: {
          username: target.username,
          old_role: target.role,
          new_role: incomingRole,
        },
      });

      logger.info(action);
    }

    res.json(rows[0]);
  })
);

// ─── CHANGE PASSWORD ─────────────────────────────────────────────────────────
//
// PUT /api/users/:id/password
//
// Permission matrix:
// ┌─────────────────┬──────────────────────────────────────────────────────────┐
// │ Who is calling  │ What they can do                                         │
// ├─────────────────┼──────────────────────────────────────────────────────────┤
// │ Any user        │ Change their OWN password — must supply old_password      │
// │ (self-change)   │                                                           │
// ├─────────────────┼──────────────────────────────────────────────────────────┤
// │ admin           │ Change password of viewer-role users ONLY                │
// │                 │ Does NOT need the target's old password                   │
// │                 │ CANNOT change another admin's or super_admin's password   │
// │                 │ CANNOT change their own password via this privilege path  │
// │                 │ (must use the self-change path with old_password)         │
// ├─────────────────┼──────────────────────────────────────────────────────────┤
// │ super_admin     │ Change password of ANY user (viewer, admin, other         │
// │                 │ super_admins)                                             │
// │                 │ Does NOT need the target's old password                   │
// │                 │ MUST supply their own old_password when changing their    │
// │                 │ own password (self-change path)                           │
// └─────────────────┴──────────────────────────────────────────────────────────┘
//
// Request body variants:
//   Self-change  (any role, target id == own id):
//     { old_password: "...", new_password: "..." }
//
//   Admin forcing viewer password:
//     { new_password: "..." }          (no old_password needed)
//
//   super_admin forcing anyone's password:
//     { new_password: "..." }          (no old_password needed)
// ─────────────────────────────────────────────────────────────────────────────

const changePasswordSchema = Joi.object({
  old_password: Joi.string().max(128).optional(),
  new_password: Joi.string().min(8).max(128).required(),
});

router.put(
  '/:id/password',
  auth,
  validate(changePasswordSchema),
  wrap(async (req, res) => {
    const requesterId = req.user.id;
    const requesterRole = req.user.role;
    const targetId = parseInt(req.params.id, 10);
    const isSelfChange = requesterId === targetId;

    const { old_password, new_password } = req.body;

    // ── 1. Fetch the target user ────────────────────────────────────────────
    const { rows: targetRows } = await db.query(
      'SELECT id, username, role, password_hash, is_active FROM users WHERE id = $1',
      [targetId]
    );

    if (!targetRows.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const target = targetRows[0];

    if (!target.is_active) {
      return res.status(403).json({ error: 'Target account is disabled.' });
    }

    // ── 2. Apply permission rules ───────────────────────────────────────────

    if (isSelfChange) {
      // ── 2a. Self-change: everyone must verify their old password ──────────
      if (!old_password) {
        return res.status(400).json({
          error: 'old_password is required when changing your own password.',
        });
      }

      const valid = await bcrypt.compare(old_password, target.password_hash);
      if (!valid) {
        return res.status(403).json({ error: 'Current password is incorrect.' });
      }

    } else {
      // ── 2b. Changing someone else's password ─────────────────────────────

      if (requesterRole === 'super_admin') {
        // super_admin can change anyone's password — no old_password required.
        // (They already authenticated via their own JWT.)

      } else if (requesterRole === 'admin') {
        // admin can only change viewer passwords.
        if (target.role !== 'viewer') {
          return res.status(403).json({
            error: `Admin cannot change the password of a user with role "${target.role}". Only viewer passwords may be changed by an admin.`,
          });
        }
        // admin does not need the viewer's old password.

      } else {
        // Regular viewer trying to change someone else's password — denied.
        return res.status(403).json({
          error: 'You do not have permission to change another user\'s password.',
        });
      }
    }

    // ── 3. Hash the new password ────────────────────────────────────────────
    const newHash = await bcrypt.hash(new_password, env.BCRYPT_ROUNDS);

    // ── 4. Persist inside a transaction ────────────────────────────────────
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Increment token_version → all existing JWTs for this user become invalid
      await client.query(
        `UPDATE users
         SET password_hash = $1,
             token_version  = token_version + 1
         WHERE id = $2`,
        [newHash, targetId]
      );

      // Revoke all active DB-backed refresh tokens for this user
      await revokeAllUserTokens(client, targetId);

      // Audit log
      const action = isSelfChange
        ? `${req.user.username} changed their own password`
        : `Changed password for user "${target.username}"`;

      await client.query(
        'INSERT INTO admin_logs (user_id, action, entity, entity_id) VALUES ($1,$2,$3,$4)',
        [requesterId, action, 'user', targetId]
      );

      // 📊 Log structured activity
      await logActivity(db, {
        event_type: ACTIVITY_TYPES.USER_PASSWORD_CHANGE,
        user_id: requesterId,
        action,
        entity: 'user',
        entity_id: targetId,
        metadata: {
          username: target.username,
          is_self_change: isSelfChange,
        },
      });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // ── 5. Update SVN password through the SVN management workflow ─────────
    try {
      await svnManagementService.updateSvnPassword(targetId, new_password);
    } catch (err) {
      logger.error('SVN password synchronization failed', {
        userId: targetId,
        username: target.username,
        error: err.message,
      });
    }

    logger.info(`Password changed for user ${target.username} (id=${targetId}) by ${req.user.username}`);

    res.json({
      message: isSelfChange
        ? 'Password updated. All existing sessions have been invalidated.'
        : `Password for "${target.username}" updated. Their existing sessions have been invalidated.`,
    });
  })
);

// ─── DELETE USER ─────────────────────────────

router.delete(
  '/:id',
  auth,
  authorize('super_admin'),
  wrap(async (req, res) => {
    const { rows: userRows } = await db.query(
      'SELECT username FROM users WHERE id=$1',
      [req.params.id]
    );

    if (!userRows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetId = parseInt(req.params.id, 10);
    const { username } = userRows[0];

    try {
      await svnManagementService.deprovisionSvnUser(targetId);
    } catch (err) {
      logger.error('SVN deprovisioning failed during user deletion', {
        userId: targetId,
        username,
        error: err.message,
      });
      return res.status(500).json({
        error: 'User was not deleted because SVN deprovisioning failed',
        details: err.message,
      });
    }

    await db.query('DELETE FROM users WHERE id=$1', [targetId]);

    // 📊 Log user deletion activity
    await logActivity(db, {
      event_type: ACTIVITY_TYPES.USER_DELETE,
      user_id: req.user.id,
      action: `Deleted user account: ${username}`,
      entity: 'user',
      entity_id: targetId,
      metadata: {
        username,
      },
    });

    res.json({ message: 'User deleted' });
  })
);

module.exports = router;
