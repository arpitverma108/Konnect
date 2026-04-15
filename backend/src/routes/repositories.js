// repositories.js
'use strict';

const express     = require('express');
const Joi         = require('joi');
const path        = require('path');
const router      = express.Router();

const db          = require('../config/database');
const apacheCfg   = require('../config/apache');
const validate    = require('../middleware/validate');
const wrap        = require('../middleware/asyncWrapper');
const svnSvc      = require('../services/svnService');
const activitySvc = require('../services/activityService');
const authzSvc    = require('../services/authzService');

// ─── Validation schemas ──────────────────────────────────────────────────────

const createSchema = Joi.object({
  name:                 Joi.string().alphanum().min(1).max(64).required(),
  description:          Joi.string().max(512).optional().allow(''),
  createStandardLayout: Joi.boolean().default(true),
});

const updateSchema = Joi.object({
  description: Joi.string().max(512).optional().allow(''),
  is_active:   Joi.boolean().optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/repositories
router.get('/', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*,
       (SELECT COUNT(*) FROM activity a WHERE a.repo_id = r.id) AS commit_count
     FROM repositories r
     ORDER BY r.name`
  );
  res.json(rows);
}));

// POST /api/repositories
router.post('/', validate(createSchema), wrap(async (req, res) => {
  const { name, description, createStandardLayout } = req.body;
  const diskPath = path.join(apacheCfg.reposRoot, name);

  // 1. Create SVN repo on disk
  await svnSvc.createRepository(diskPath);

  // 2. Optionally create trunk/branches/tags
  if (createStandardLayout) {
    await svnSvc.createStandardLayout(diskPath);
  }

  // 3. Insert into DB
  const { rows } = await db.query(
    `INSERT INTO repositories (name, description, disk_path)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, description || null, diskPath]
  );

  // 4. Rebuild authz to include new repo entry
  await authzSvc.rebuildAuthzFile(db);

  res.status(201).json(rows[0]);
}));

// GET /api/repositories/:id
router.get('/:id', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*,
       (SELECT COUNT(*) FROM activity a WHERE a.repo_id = r.id) AS commit_count
     FROM repositories r
     WHERE r.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Repository not found' });

  // Add SVN URL info
  const repo = rows[0];
  repo.svn_url = `http://localhost/svn/${repo.name}`;
  repo.youngest_revision = await svnSvc.getYoungestRevision(repo.disk_path).catch(() => 0);

  res.json(repo);
}));

// PUT /api/repositories/:id
router.put('/:id', validate(updateSchema), wrap(async (req, res) => {
  const { description, is_active } = req.body;
  const { rows } = await db.query(
    `UPDATE repositories
     SET description = COALESCE($1, description),
         is_active   = COALESCE($2, is_active)
     WHERE id = $3
     RETURNING *`,
    [description, is_active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Repository not found' });
  res.json(rows[0]);
}));

// DELETE /api/repositories/:id
router.delete('/:id', wrap(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Repository not found' });

  const repo = rows[0];

  // Delete from disk
  await svnSvc.deleteRepository(repo.disk_path);

  // Delete from DB (cascades to permissions, hooks, activity)
  await db.query('DELETE FROM repositories WHERE id = $1', [req.params.id]);

  // Rebuild authz
  await authzSvc.rebuildAuthzFile(db);

  res.json({ message: `Repository '${repo.name}' deleted` });
}));

// GET /api/repositories/:id/log
router.get('/:id/log', wrap(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Repository not found' });

  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  const log   = await svnSvc.getLog(rows[0].disk_path, limit);
  res.json(log);
}));

// POST /api/repositories/:id/sync-activity
router.post('/:id/sync-activity', wrap(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Repository not found' });

  const limit = Math.min(parseInt(req.query.limit || '200', 10), 1000);
  const count = await activitySvc.syncRepoActivity(db, rows[0].id, rows[0].disk_path, limit);
  res.json({ synced: count });
}));

module.exports = router;
