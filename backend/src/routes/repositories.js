'use strict';

const express = require('express');
const Joi = require('joi');
const path = require('path');

const router = express.Router();

const apacheCfg = require('../config/apache');
const db = require('../config/database');
const logger = require('../config/logger');

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

// ─── PATH VALIDATION HELPER ─────────────────────────────

function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }

  // Reject paths with .. sequences
  if (filePath.includes('..')) {
    throw new Error('Invalid file path: parent directory references not allowed');
  }

  // Reject paths with null bytes
  if (filePath.includes('\0')) {
    throw new Error('Invalid file path: null bytes not allowed');
  }

  // Only allow alphanumeric, dots, slashes, underscores, hyphens
  if (!/^[\w./_-]*$/.test(filePath)) {
    throw new Error('Invalid file path: invalid characters');
  }

  return filePath;
}

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

  // ✅ Get total count for pagination
  const { rows: countResult } = await db.query(`
    SELECT COUNT(DISTINCT r.id) as total
    FROM repositories r
    ${where}
  `, params);

  const total = parseInt(countResult[0]?.total || 0, 10);

  const diskUsageResults = await Promise.allSettled(rows.map(async (r) => {
    const size = await svnSvc.getDiskUsage(r.disk_path);
    return { ...r, size };
  }));

  const data = diskUsageResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // If disk usage fails, return repo with unknown size (-1)
      logger.warn(`Failed to get disk usage for repo ${rows[index].name}`);
      return { ...rows[index], size: -1 };
    }
  });

  res.json({ page, limit, count: data.length, total, data });
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
// 🔥 UPDATE REPO (NAME/DESCRIPTION)
// ─────────────────────────────────────────────

router.put(
  '/:id',
  auth,
  authorize("admin", "super_admin"),
  validate(createSchema),
  wrap(async (req, res) => {

    const { name, description } = req.body;
    const repoId = req.params.id;

    // Check repo exists
    const { rows: existing } = await db.query(
      'SELECT id, name FROM repositories WHERE id=$1',
      [repoId]
    );

    if (!existing.length) {
      return res.status(404).json({ error: "Repository not found" });
    }

    try {
      // Use ON CONFLICT to handle race conditions
      const { rows } = await db.query(`
        UPDATE repositories
        SET name = COALESCE($1, name),
            description = COALESCE($2, description)
        WHERE id=$3
          AND (name != COALESCE($1, name) OR $2 IS NOT NULL)
        ON CONFLICT (name) DO NOTHING
        RETURNING *
      `, [name || null, description || null, repoId]);

      if (!rows.length) {
        // Either no changes were made or name was taken
        const check = await db.query(
          'SELECT id FROM repositories WHERE name=$1 AND id!=$2',
          [name, repoId]
        );

        if (check.rows.length) {
          return res.status(409).json({ error: "Repository name already exists" });
        }

        // No actual changes
        const repo = await db.query(
          'SELECT * FROM repositories WHERE id=$1',
          [repoId]
        );
        return res.json(repo.rows[0]);
      }

      res.json(rows[0]);
    } catch (err) {
      logger.error('Repository update failed', {
        repoId,
        name,
        error: err.message,
        userId: req.user.id
      });
      res.status(500).json({ error: "Update failed" });
    }
  })
);

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

  let filePath = req.query.path;

  try {
    filePath = validateFilePath(filePath);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id=$1',
    [req.params.id]
  );

  if (!rows.length) return res.status(404).json({ error: "Not found" });

  try {
    const content = await svnSvc.getFileContent(rows[0].disk_path, filePath);
    res.json({ repo: rows[0].name, path: filePath, content });
  } catch (err) {
    res.status(404).json({ error: "File not found" });
  }
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
      logger.error('Repository creation failed', {
        error: err.message,
        stack: err.stack,
        userId: req.user.id
      });
      res.status(500).json({ error: "Repository creation failed" });
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
// 🔥 COMMIT DETAIL (WITH DIFF)
// ─────────────────────────────────────────────

router.get('/:id/commits/:revision', auth, wrap(async (req, res) => {

  const { id, revision } = req.params;

  const { rows } = await db.query(
    'SELECT id, name, disk_path FROM repositories WHERE id=$1',
    [id]
  );

  if (!rows.length) return res.status(404).json({ error: "Repository not found" });

  const repo = rows[0];
  const rev = parseInt(revision, 10);

  if (isNaN(rev) || rev < 0) {
    return res.status(400).json({ error: "Invalid revision number" });
  }

  // Get commit details from activity table
  const { rows: activity } = await db.query(
    'SELECT * FROM activity WHERE repo_id=$1 AND revision=$2',
    [id, rev]
  );

  if (!activity.length) {
    return res.status(404).json({ error: "Commit not found" });
  }

  const commit = activity[0];

  // Get diff for this revision
  let diff = '';
  try {
    const result = await svnSvc.getRevisionDiff(repo.disk_path, rev);
    diff = result;
  } catch (err) {
    console.error('Diff error:', err.message);
    diff = '';
  }

  res.json({
    repo: repo.name,
    revision: commit.revision,
    author: commit.author,
    date: commit.committed_at,
    message: commit.message,
    paths_changed: commit.paths_changed,
    diff: diff
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
// 🔥 CREATE BRANCH
// ─────────────────────────────────────────────

const branchSchema = Joi.object({
  branchName: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).min(1).max(64).required(),
  fromRevision: Joi.number().integer().optional().default('HEAD'),
  message: Joi.string().max(512).optional().default('Create branch')
});

router.post(
  '/:id/branches',
  auth,
  authorize("admin", "super_admin"),
  validate(branchSchema),
  wrap(async (req, res) => {

    const { rows } = await db.query(
      'SELECT * FROM repositories WHERE id=$1',
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const repo = rows[0];
    const { branchName, fromRevision, message } = req.body;

    try {
      const repoUrl = `file://${repo.disk_path}`;

      await svnSvc.createBranch(repo.disk_path, branchName, fromRevision, message);

      res.status(201).json({
        message: `Branch '${branchName}' created`,
        branch: branchName
      });
    } catch (err) {
      logger.error('Branch creation failed', {
        repoId: req.params.id,
        branchName,
        error: err.message,
        userId: req.user.id
      });
      res.status(500).json({ error: "Branch creation failed" });
    }
  })
);

// ─────────────────────────────────────────────
// 🔥 DELETE BRANCH
// ─────────────────────────────────────────────

router.delete(
  '/:id/branches/:branchName',
  auth,
  authorize("admin", "super_admin"),
  wrap(async (req, res) => {

    const { rows } = await db.query(
      'SELECT * FROM repositories WHERE id=$1',
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const repo = rows[0];
    const { branchName } = req.params;

    try {
      await svnSvc.deleteBranch(repo.disk_path, branchName);

      res.json({
        message: `Branch '${branchName}' deleted`
      });
    } catch (err) {
      logger.error('Branch deletion failed', {
        repoId: req.params.id,
        branchName,
        error: err.message,
        userId: req.user.id
      });
      res.status(500).json({ error: "Branch deletion failed" });
    }
  })
);

// ─────────────────────────────────────────────
// 🔥 CREATE TAG
// ─────────────────────────────────────────────

const tagSchema = Joi.object({
  tagName: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).min(1).max(64).required(),
  fromRevision: Joi.number().integer().optional().default('HEAD'),
  message: Joi.string().max(512).optional().default('Create tag')
});

router.post(
  '/:id/tags',
  auth,
  authorize("admin", "super_admin"),
  validate(tagSchema),
  wrap(async (req, res) => {

    const { rows } = await db.query(
      'SELECT * FROM repositories WHERE id=$1',
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const repo = rows[0];
    const { tagName, fromRevision, message } = req.body;

    try {
      await svnSvc.createTag(repo.disk_path, tagName, fromRevision, message);

      res.status(201).json({
        message: `Tag '${tagName}' created`,
        tag: tagName
      });
    } catch (err) {
      logger.error('Tag creation failed', {
        repoId: req.params.id,
        tagName,
        error: err.message,
        userId: req.user.id
      });
      res.status(500).json({ error: "Tag creation failed" });
    }
  })
);

// ─────────────────────────────────────────────
// 🔥 DELETE TAG
// ─────────────────────────────────────────────

router.delete(
  '/:id/tags/:tagName',
  auth,
  authorize("admin", "super_admin"),
  wrap(async (req, res) => {

    const { rows } = await db.query(
      'SELECT * FROM repositories WHERE id=$1',
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const repo = rows[0];
    const { tagName } = req.params;

    try {
      await svnSvc.deleteTag(repo.disk_path, tagName);

      res.json({
        message: `Tag '${tagName}' deleted`
      });
    } catch (err) {
      logger.error('Tag deletion failed', {
        repoId: req.params.id,
        tagName,
        error: err.message,
        userId: req.user.id
      });
      res.status(500).json({ error: "Tag deletion failed" });
    }
  })
);

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
