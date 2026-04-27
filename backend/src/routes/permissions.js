'use strict';

const express = require('express');
const Joi = require('joi');

const router = express.Router();

const db = require('../config/database');
const validate = require('../middleware/validate');
const wrap = require('../middleware/asyncWrapper');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const checkPermission = require('../middleware/checkPermission');

const authzSvc = require('../services/authzService');
const permSvc = require('../services/permissionService');

// ✅ FIXED REDIS IMPORT
const { redis, isRedisAvailable } = require('../config/redis');

// ─── HELPERS ─────────────────────────────────

const normalizePath = (p) => {
  if (!p) return '/';
  if (!p.startsWith('/')) p = '/' + p;
  return p.replace(/\/+$/, '') || '/';
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
  path: Joi.string().min(1).max(512).default('/'),
  subjectType: Joi.string().valid('user', 'group').required(),
  subjectId: Joi.number().integer().required(),
  permission: Joi.string().valid('r', 'rw', '').required(),
});

// ─────────────────────────────────────────────
// 🔥 GET PERMISSIONS
// ─────────────────────────────────────────────

router.get(
  '/repo/:repoId',
  auth,
  authorize("admin", "super_admin"),
  wrap(async (req, res) => {

    const repoId = Number(req.params.repoId);

    if (!(await ensureRepoExists(db, repoId))) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const { rows } = await db.query(`
      SELECT p.*,
        CASE p.subject_type
          WHEN 'user' THEN u.username
          WHEN 'group' THEN g.name
        END AS subject_name
      FROM permissions p
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

    try {
      await client.query('BEGIN');

      const repoId = Number(req.params.repoId);

      if (!(await ensureRepoExists(client, repoId))) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Repository not found" });
      }

      let { path, subjectType, subjectId, permission } = req.body;
      path = normalizePath(path);

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
        INSERT INTO permissions (repo_id, path, subject_type, subject_id, permission)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (repo_id, path, subject_type, subject_id)
        DO UPDATE SET permission = EXCLUDED.permission
        RETURNING *
      `, [repoId, path, subjectType, subjectId, permission]);

      // 🧾 Audit log
      await client.query(
        "INSERT INTO admin_logs (user_id, action, entity) VALUES ($1,$2,$3)",
        [req.user.id, `Updated permission ${subjectType}:${subjectId} on repo ${repoId}`, "permission"]
      );

      // ⚙️ Rebuild SVN config
      await authzSvc.rebuildAuthzFile(client);

      await client.query('COMMIT');

      // 🔥 SAFE CACHE INVALIDATION
      if (isRedisAvailable()) {
        await permSvc.clearRepoPermissionCache(repoId);
      }

      return res.status(201).json(rows[0]);

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Permission POST error:', err.message);
      return res.status(500).json({ error: "Permission update failed" });
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

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        "DELETE FROM permissions WHERE id=$1 RETURNING repo_id",
        [req.params.id]
      );

      if (!rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Permission not found" });
      }

      const repoId = rows[0].repo_id;

      // 🧾 Audit log
      await client.query(
        "INSERT INTO admin_logs (user_id, action, entity) VALUES ($1,$2,$3)",
        [req.user.id, `Deleted permission ${req.params.id}`, "permission"]
      );

      await authzSvc.rebuildAuthzFile(client);

      await client.query('COMMIT');

      // 🔥 SAFE CACHE INVALIDATION
      if (isRedisAvailable()) {
        await permSvc.clearRepoPermissionCache(repoId);
      }

      return res.json({ message: "Permission deleted" });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Permission DELETE error:', err.message);
      return res.status(500).json({ error: "Delete failed" });
    } finally {
      client.release();
    }
  })
);

module.exports = router;