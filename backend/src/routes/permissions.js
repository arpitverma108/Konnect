'use strict';

const express = require('express');
const Joi = require('joi');

const router = express.Router();

const db = require('../config/database');
const validate = require('../middleware/validate');
const wrap = require('../middleware/asyncWrapper');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const authzSvc = require('../services/authzService');
const permSvc = require('../services/permissionService');
const { logActivity, ACTIVITY_TYPES } = require('../services/activityLogger');

// ✅ FIXED REDIS IMPORT
const redis = require('../config/redis');

// ─── HELPERS ─────────────────────────────────

const ROLE_TO_PERMISSION = {
  owner: 'rw',
  maintainer: 'rw',
  developer: 'rw',
  viewer: 'r',
};

const PERMISSION_TO_ROLE = {
  rw: 'developer',
  r: 'viewer',
  '': null,
};

const parsePositiveInt = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const err = new Error(`Invalid ${label}`);
    err.statusCode = 400;
    throw err;
  }
  return parsed;
};

const normalizeRepositoryPath = (p) => {
  const value = !p ? '/' : String(p).trim();
  if (value !== '/') {
    const err = new Error('Konnect currently supports repository-level SVN permissions only. Use path "/".');
    err.statusCode = 400;
    throw err;
  }
  return '/';
};

async function ensureRepoExists(client, repoId) {
  const { rows } = await client.query(
    "SELECT id FROM repositories WHERE id=$1",
    [repoId]
  );
  return rows.length > 0;
}

// ─── VALIDATION ──────────────────────────────

const permSchema = Joi.object({
  path: Joi.string().valid('/').default('/'),
  subjectType: Joi.string().valid('user', 'group').required(),
  subjectId: Joi.number().integer().required(),
  role: Joi.string().valid('owner', 'maintainer', 'developer', 'viewer'),
  permission: Joi.string().valid('r', 'rw', ''),
}).or('role', 'permission');

// ─────────────────────────────────────────────
// 🔥 AUTHZ ADMIN OPERATIONS
// ─────────────────────────────────────────────

router.get(
  '/authz',
  auth,
  authorize("admin", "super_admin"),
  wrap(async (_req, res) => {
    const content = await authzSvc.getAuthzContent();
    res.type('text/plain').send(content);
  })
);

router.post(
  '/rebuild',
  auth,
  authorize("admin", "super_admin"),
  wrap(async (req, res) => {
    const content = await authzSvc.rebuildAuthzFile(db, {
      requestedByUserId: req.user.id,
      reason: 'manual API rebuild',
    });
    res.json({
      message: 'Authz rebuilt and Apache reloaded',
      bytes: Buffer.byteLength(content, 'utf8'),
    });
  })
);

// ─────────────────────────────────────────────
// 🔥 GET PERMISSIONS
// ─────────────────────────────────────────────

router.get(
  '/repo/:repoId',
  auth,
  authorize("admin", "super_admin"),
  wrap(async (req, res) => {

    const repoId = Number(req.params.repoId);
    parsePositiveInt(repoId, 'repository id');

    if (!(await ensureRepoExists(db, repoId))) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const { rows } = await db.query(`
      SELECT
        p.id,
        p.id AS permission_id,
        p.repo_id,
        p.repo_id AS repository_id,
        r.name AS repository_name,
        p.path,
        p.path AS svn_path,
        p.subject_type,
        p.subject_id,
        CASE WHEN p.subject_type = 'user' THEN p.subject_id END AS user_id,
        CASE WHEN p.subject_type = 'group' THEN p.subject_id END AS group_id,
        p.permission,
        p.permission AS svn_access,
        p.role,
        COALESCE(
          p.role,
          CASE p.permission
            WHEN 'rw' THEN 'developer'
            WHEN 'r' THEN 'viewer'
            ELSE NULL
          END
        ) AS effective_role,
        p.created_at,
        CASE p.subject_type
          WHEN 'user' THEN u.username
          WHEN 'group' THEN g.name
        END AS subject_name
      FROM permissions p
      JOIN repositories r ON r.id = p.repo_id
      LEFT JOIN users u ON p.subject_type='user' AND u.id=p.subject_id
      LEFT JOIN groups g ON p.subject_type='group' AND g.id=p.subject_id
      WHERE p.repo_id=$1
      ORDER BY p.id DESC
      LIMIT $2 OFFSET $3
    `, [repoId, limit, offset]);

    return res.json({
      page,
      limit,
      count: rows.length,
      data: rows
    });
  })
);

// ─────────────────────────────────────────────
// 🔥 CREATE / UPDATE PERMISSION
// ─────────────────────────────────────────────

router.post(
  '/repo/:repoId',
  auth,
  authorize("admin", "super_admin"),
  validate(permSchema),
  wrap(async (req, res) => {

    const client = await db.connect();
    let committed = false;

    try {
      await client.query('BEGIN');

      const repoId = parsePositiveInt(req.params.repoId, 'repository id');

      if (!(await ensureRepoExists(client, repoId))) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Repository not found" });
      }

      let { path, subjectType, subjectId, permission, role } = req.body;
      path = normalizeRepositoryPath(path);
      permission = role ? ROLE_TO_PERMISSION[role] : permission;
      role = role || PERMISSION_TO_ROLE[permission];

      // 🔐 Validate subject
      if (subjectType === "user") {
        const user = await client.query(
          "SELECT id FROM users WHERE id=$1",
          [subjectId]
        );
        if (!user.rows.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: "User not found" });
        }
      }

      if (subjectType === "group") {
        const group = await client.query(
          "SELECT id FROM groups WHERE id=$1",
          [subjectId]
        );
        if (!group.rows.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: "Group not found" });
        }
      }

      const { rows } = await client.query(`
        INSERT INTO permissions (repo_id, path, subject_type, subject_id, permission, role)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (repo_id, path, subject_type, subject_id)
        DO UPDATE SET
          permission = EXCLUDED.permission,
          role = EXCLUDED.role
        RETURNING *
      `, [repoId, path, subjectType, subjectId, permission, role || null]);

      // Get repository and subject details for readable message
      const repoRes = await client.query('SELECT name FROM repositories WHERE id=$1', [repoId]);
      const repoName = repoRes.rows[0]?.name || `repo_${repoId}`;
      
      let subjectName = `${subjectType}_${subjectId}`;
      if (subjectType === 'user') {
        const userRes = await client.query('SELECT username FROM users WHERE id=$1', [subjectId]);
        subjectName = userRes.rows[0]?.username || `user_${subjectId}`;
      } else if (subjectType === 'group') {
        const groupRes = await client.query('SELECT name FROM groups WHERE id=$1', [subjectId]);
        subjectName = groupRes.rows[0]?.name || `group_${subjectId}`;
      }

      const roleDisplay = role || 'default';
      const action = `Updated permissions for ${subjectType} "${subjectName}" on repository "${repoName}" to role "${roleDisplay}"`;

      // 🧾 Audit log (keep for backward compatibility)
      await client.query(
        "INSERT INTO admin_logs (user_id, action, entity) VALUES ($1,$2,$3)",
        [req.user.id, action, "permission"]
      );

      // 📊 Structured activity log
      await logActivity(db, {
        event_type: ACTIVITY_TYPES.PERMISSION_UPDATE,
        user_id: req.user.id,
        action,
        entity: 'permission',
        entity_id: rows[0].id,
        repo_id: repoId,
        metadata: {
          subject_type: subjectType,
          subject_id: subjectId,
          role,
          permission,
        },
      });

      await client.query('COMMIT');
      committed = true;

      try {
        await authzSvc.rebuildAuthzFile(db, {
          requestedByUserId: req.user.id,
          reason: `permission upsert for repository ${repoId}`,
        });
      } catch (err) {
        console.error('Authz rebuild failed after permission commit:', err.message);
        return res.status(503).json({
          error: "Permission saved, but SVN authz reload failed",
          code: "AUTHZ_REBUILD_FAILED",
        });
      }

      // 🔥 SAFE CACHE INVALIDATION
      if (redis.isAvailable()) {
        await permSvc.clearRepoPermissionCache(repoId);
      }

      return res.status(201).json(rows[0]);

    } catch (err) {
      if (!committed) {
        try {
          await client.query('ROLLBACK');
        } catch {}
      }
      console.error('Permission POST error:', err.message);
      return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Permission update failed" });
    } finally {
      client.release();
    }
  })
);

// ─────────────────────────────────────────────
// 🔥 DELETE PERMISSION
// ─────────────────────────────────────────────

router.delete(
  '/:id',
  auth,
  authorize("admin", "super_admin"),
  wrap(async (req, res) => {

    const client = await db.connect();
    let committed = false;

    try {
      await client.query('BEGIN');

      const permissionId = parsePositiveInt(req.params.id, 'permission id');

      const { rows } = await client.query(
        "DELETE FROM permissions WHERE id=$1 RETURNING repo_id, subject_type, subject_id",
        [permissionId]
      );

      if (!rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Permission not found" });
      }

      const repoId = rows[0].repo_id;
      const { subject_type, subject_id } = rows[0];

      // Get readable names for activity message
      const repoRes = await client.query('SELECT name FROM repositories WHERE id=$1', [repoId]);
      const repoName = repoRes.rows[0]?.name || `repo_${repoId}`;
      
      let subjectName = `${subject_type}_${subject_id}`;
      if (subject_type === 'user') {
        const userRes = await client.query('SELECT username FROM users WHERE id=$1', [subject_id]);
        subjectName = userRes.rows[0]?.username || `user_${subject_id}`;
      } else if (subject_type === 'group') {
        const groupRes = await client.query('SELECT name FROM groups WHERE id=$1', [subject_id]);
        subjectName = groupRes.rows[0]?.name || `group_${subject_id}`;
      }

      const action = `Deleted permissions for ${subject_type} "${subjectName}" on repository "${repoName}"`;

      // 🧾 Audit log (keep for backward compatibility)
      await client.query(
        "INSERT INTO admin_logs (user_id, action, entity) VALUES ($1,$2,$3)",
        [req.user.id, action, "permission"]
      );

      // 📊 Structured activity log
      await logActivity(db, {
        event_type: ACTIVITY_TYPES.PERMISSION_DELETE,
        user_id: req.user.id,
        action,
        entity: 'permission',
        entity_id: permissionId,
        repo_id: repoId,
        metadata: {
          subject_type,
          subject_id,
        },
      });

      await client.query('COMMIT');
      committed = true;

      try {
        await authzSvc.rebuildAuthzFile(db, {
          requestedByUserId: req.user.id,
          reason: `permission delete for repository ${repoId}`,
        });
      } catch (err) {
        console.error('Authz rebuild failed after permission delete:', err.message);
        return res.status(503).json({
          error: "Permission deleted, but SVN authz reload failed",
          code: "AUTHZ_REBUILD_FAILED",
        });
      }

      // 🔥 SAFE CACHE INVALIDATION
      if (redis.isAvailable()) {
        await permSvc.clearRepoPermissionCache(repoId);
      }

      return res.json({ message: "Permission deleted" });

    } catch (err) {
      if (!committed) {
        try {
          await client.query('ROLLBACK');
        } catch {}
      }
      console.error('Permission DELETE error:', err.message);
      return res.status(500).json({ error: "Delete failed" });
    } finally {
      client.release();
    }
  })
);

module.exports = router;
