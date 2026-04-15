// permissions.js
'use strict';

const express   = require('express');
const Joi       = require('joi');
const router    = express.Router();

const db        = require('../config/database');
const validate  = require('../middleware/validate');
const wrap      = require('../middleware/asyncWrapper');
const authzSvc  = require('../services/authzService');

// ─── Validation ──────────────────────────────────────────────────────────────

const permSchema = Joi.object({
  path:        Joi.string().min(1).max(512).default('/'),
  subjectType: Joi.string().valid('user', 'group').required(),
  subjectId:   Joi.number().integer().required(),
  permission:  Joi.string().valid('r', 'rw', '').required(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/permissions/repo/:repoId
router.get('/repo/:repoId', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT
       p.*,
       CASE p.subject_type
         WHEN 'user'  THEN u.username
         WHEN 'group' THEN g.name
       END AS subject_name
     FROM permissions p
     LEFT JOIN users  u ON p.subject_type = 'user'  AND u.id  = p.subject_id
     LEFT JOIN groups g ON p.subject_type = 'group' AND g.id  = p.subject_id
     WHERE p.repo_id = $1
     ORDER BY p.path, p.subject_type, subject_name`,
    [req.params.repoId]
  );
  res.json(rows);
}));

// POST /api/permissions/repo/:repoId
router.post('/repo/:repoId', validate(permSchema), wrap(async (req, res) => {
  const { path, subjectType, subjectId, permission } = req.body;
  const { rows } = await db.query(
    `INSERT INTO permissions (repo_id, path, subject_type, subject_id, permission)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (repo_id, path, subject_type, subject_id)
     DO UPDATE SET permission = EXCLUDED.permission
     RETURNING *`,
    [req.params.repoId, path, subjectType, subjectId, permission]
  );

  await authzSvc.rebuildAuthzFile(db);
  res.status(201).json(rows[0]);
}));

// DELETE /api/permissions/:permId
router.delete('/:permId', wrap(async (req, res) => {
  const { rows } = await db.query(
    'DELETE FROM permissions WHERE id = $1 RETURNING *',
    [req.params.permId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Permission not found' });
  await authzSvc.rebuildAuthzFile(db);
  res.json({ message: 'Permission removed' });
}));

// POST /api/permissions/rebuild-authz
router.post('/rebuild-authz', wrap(async (req, res) => {
  const content = await authzSvc.rebuildAuthzFile(db);
  res.json({ message: 'authz file rebuilt', preview: content });
}));

// GET /api/permissions/authz-preview
router.get('/authz-preview', wrap(async (req, res) => {
  const content = await authzSvc.getAuthzContent();
  res.json({ content });
}));

module.exports = router;
