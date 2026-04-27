'use strict';

const express = require('express');
const Joi = require('joi');
const path = require('path');

const router = express.Router();

const apacheCfg = require('../config/apache');
const db = require('../config/database');

const validate = require('../middleware/validate');
const wrap = require('../middleware/asyncWrapper');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const svnSvc = require('../services/svnService');
const authzSvc = require('../services/authzService');

// ─── VALIDATION ─────────────────────────────

const createSchema = Joi.object({
  name: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).min(1).max(64).required(),
  description: Joi.string().max(512).optional().allow('')
});

// ─────────────────────────────────────────────
// 🔥 GET ALL REPOS
// ─────────────────────────────────────────────

router.get('/', auth, wrap(async (req, res) => {

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const search = req.query.search || "";
  const offset = (page - 1) * limit;

  let params = [search];
  let where = `WHERE r.name ILIKE '%' || $1 || '%'`;

  if (!['admin', 'super_admin'].includes(req.user.role)) {
    where += `
      AND r.id IN (
        SELECT repo_id FROM permissions
        WHERE 
          (subject_type = 'user' AND subject_id = $2)
          OR
          (subject_type = 'group' AND subject_id IN (
            SELECT group_id FROM group_members WHERE user_id = $2
          ))
      )
    `;
    params.push(req.user.id);
  }

  const { rows } = await db.query(`
    SELECT r.*, COUNT(a.id) AS commit_count
    FROM repositories r
    LEFT JOIN activity a ON a.repo_id = r.id
    ${where}
    GROUP BY r.id
    ORDER BY r.name
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  const data = await Promise.all(rows.map(async (r) => {
    const size = await svnSvc.getDiskUsage(r.disk_path);
    return { ...r, size };
  }));

  res.json({ page, limit, count: data.length, data });
}));

// ─────────────────────────────────────────────
// 🔥 GET SINGLE REPO
// ─────────────────────────────────────────────

router.get('/:id', auth, wrap(async (req, res) => {

  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id=$1',
    [req.params.id]
  );

  if (!rows.length) return res.status(404).json({ error: "Not found" });

  res.json(rows[0]);
}));

// ─────────────────────────────────────────────
// 🌳 TREE API
// ─────────────────────────────────────────────

router.get('/:id/tree', auth, wrap(async (req, res) => {

  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id=$1',
    [req.params.id]
  );

  if (!rows.length) return res.status(404).json({ error: "Not found" });

  const tree = await svnSvc.listFiles(rows[0].disk_path);

  res.json({ repo: rows[0].name, tree });
}));

// ─────────────────────────────────────────────
// 📄 FILE CONTENT
// ─────────────────────────────────────────────

router.get('/:id/file-content', auth, wrap(async (req, res) => {

  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: "File path required" });

  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id=$1',
    [req.params.id]
  );

  if (!rows.length) return res.status(404).json({ error: "Not found" });

  const content = await svnSvc.getFileContent(rows[0].disk_path, filePath);

  res.json({ repo: rows[0].name, path: filePath, content });
}));

// ─────────────────────────────────────────────
// 🔥 CREATE REPO
// ─────────────────────────────────────────────

router.post(
  '/',
  auth,
  authorize("admin", "super_admin"),
  validate(createSchema),
  wrap(async (req, res) => {

    const { name, description } = req.body;
    const diskPath = path.join(apacheCfg.reposRoot, name);

    const existing = await db.query(
      "SELECT id FROM repositories WHERE name=$1",
      [name]
    );

    if (existing.rows.length) {
      return res.status(400).json({ error: "Already exists" });
    }

    try {
      await svnSvc.createFullRepository(diskPath);

      const { rows } = await db.query(`
        INSERT INTO repositories (name, description, disk_path)
        VALUES ($1,$2,$3) RETURNING *
      `, [name, description || null, diskPath]);

      const repo = rows[0];

      await db.query(`
        INSERT INTO permissions (repo_id,path,subject_type,subject_id,permission)
        VALUES ($1,'/','user',$2,'rw')
      `, [repo.id, req.user.id]);

      await authzSvc.rebuildAuthzFile(db);

      res.status(201).json({ message: "Created", data: repo });

    } catch (err) {
      res.status(500).json({ error: "Create failed", details: err.message });
    }
  })
);

// ─────────────────────────────────────────────
// 🔥 COMMIT HISTORY (CURSOR PAGINATION)
// ─────────────────────────────────────────────

router.get('/:id/commits', auth, wrap(async (req, res) => {

  const repoId = req.params.id;

  const { rows } = await db.query(
    'SELECT id, name, disk_path FROM repositories WHERE id=$1',
    [repoId]
  );

  if (!rows.length) return res.status(404).json({ error: "Not found" });

  const repo = rows[0];

  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const cursor = req.query.cursor;

  let beforeDate = null;
  let beforeRev = null;

  if (cursor) {
    const [d, r] = cursor.split('|');
    beforeDate = d;
    beforeRev = r ? parseInt(r) : null;
  }

  const all = await svnSvc.getCommitHistory(repo.disk_path, limit + 10);

  let filtered = all;

  if (beforeDate) {
    filtered = all.filter(c =>
      (c.date < beforeDate) ||
      (c.date === beforeDate && c.revision < beforeRev)
    );
  }

  const pageItems = filtered.slice(0, limit);

  const nextCursor = pageItems.length
    ? `${pageItems[pageItems.length - 1].date}|${pageItems[pageItems.length - 1].revision}`
    : null;

  res.json({
    repo: repo.name,
    count: pageItems.length,
    nextCursor,
    commits: pageItems
  });
}));

// ─────────────────────────────────────────────
// 🌿 BRANCHES
// ─────────────────────────────────────────────

router.get('/:id/branches', auth, wrap(async (req, res) => {

  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id=$1',
    [req.params.id]
  );

  if (!rows.length) return res.status(404).json({ error: "Not found" });

  const files = await svnSvc.listFiles(rows[0].disk_path);

  const branches = files
    .filter(f => f.startsWith('branches/'))
    .map(f => f.replace('branches/', '').replace(/\/$/, ''));

  res.json({ branches });
}));

// ─────────────────────────────────────────────
// 🏷 TAGS
// ─────────────────────────────────────────────

router.get('/:id/tags', auth, wrap(async (req, res) => {

  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id=$1',
    [req.params.id]
  );

  if (!rows.length) return res.status(404).json({ error: "Not found" });

  const files = await svnSvc.listFiles(rows[0].disk_path);

  const tags = files
    .filter(f => f.startsWith('tags/'))
    .map(f => f.replace('tags/', '').replace(/\/$/, ''));

  res.json({ tags });
}));

// ─────────────────────────────────────────────
// 🔥 DELETE REPO
// ─────────────────────────────────────────────

router.delete('/:id', auth, authorize("super_admin"), wrap(async (req, res) => {

  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id=$1',
    [req.params.id]
  );

  if (!rows.length) return res.status(404).json({ error: "Not found" });

  await svnSvc.deleteRepository(rows[0].disk_path);
  await db.query('DELETE FROM repositories WHERE id=$1', [rows[0].id]);

  await authzSvc.rebuildAuthzFile(db);

  res.json({ message: "Deleted" });
}));

module.exports = router;