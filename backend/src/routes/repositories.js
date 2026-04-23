'use strict';

const apacheCfg   = require('../config/apache'); // ✅ FIXED (use apache.js)
const express     = require('express');
const Joi         = require('joi');
const path        = require('path');
const router      = express.Router();

const db          = require('../config/database');
const validate    = require('../middleware/validate');
const wrap        = require('../middleware/asyncWrapper');
const auth        = require('../middleware/auth');

const svnSvc      = require('../services/svnService');
const activitySvc = require('../services/activityService');
const authzSvc    = require('../services/authzService');

// ─── Validation schemas ─────────────────────────────

const createSchema = Joi.object({
  name:        Joi.string().alphanum().min(1).max(64).required(),
  description: Joi.string().max(512).optional().allow('')
});

const updateSchema = Joi.object({
  description: Joi.string().max(512).optional().allow(''),
  is_active:   Joi.boolean().optional(),
});

// ─── GET ALL REPOSITORIES ───────────────────────────

router.get('/', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*,
       (SELECT COUNT(*) FROM activity a WHERE a.repo_id = r.id) AS commit_count
     FROM repositories r
     ORDER BY r.name`
  );
  res.json(rows);
}));

// ─── CREATE REPOSITORY (🔥 FULL FIX) ─────────────────

router.post('/', auth, validate(createSchema), wrap(async (req, res) => {
  const { name, description } = req.body;
  const diskPath = path.join(apacheCfg.reposRoot, name);

  try {
    // 1. Create repo
    await svnSvc.createRepository(diskPath);

    // 2. Create trunk/branches/tags
    await svnSvc.createStandardLayout(diskPath);

    // 3. 🔥 VERY IMPORTANT: initial commit
    await svnSvc.createInitialCommit(diskPath);

    // 4. Save in DB
    const { rows } = await db.query(
      `INSERT INTO repositories (name, description, disk_path)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description || null, diskPath]
    );

    // 5. Permissions rebuild
    await authzSvc.rebuildAuthzFile(db);

    res.status(201).json(rows[0]);

  } catch (error) {
    console.error("Repo creation error:", error);

    await svnSvc.deleteRepository(diskPath).catch(() => {});

    res.status(500).json({
      error: 'Failed to create repository',
      details: error.message
    });
  }
}));

// ─── GET SINGLE REPO ────────────────────────────────

router.get('/:id(\\d+)', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*,
       (SELECT COUNT(*) FROM activity a WHERE a.repo_id = r.id) AS commit_count
     FROM repositories r
     WHERE r.id = $1`,
    [req.params.id]
  );

  if (!rows[0]) return res.status(404).json({ error: 'Repository not found' });

  const repo = rows[0];
  repo.svn_url = `${apacheCfg.baseUrl}/${repo.name}`;
  repo.youngest_revision =
    await svnSvc.getYoungestRevision(repo.disk_path).catch(() => 0);

  res.json(repo);
}));

// ─── DELETE REPO ───────────────────────────────────

router.delete('/:id(\\d+)', auth, wrap(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );

  if (!rows[0]) return res.status(404).json({ error: 'Repository not found' });

  const repo = rows[0];

  await svnSvc.deleteRepository(repo.disk_path);
  await db.query('DELETE FROM repositories WHERE id = $1', [req.params.id]);
  await authzSvc.rebuildAuthzFile(db);

  res.json({ message: `Repository '${repo.name}' deleted` });
}));

// ─── CREATE BRANCH ─────────────────────────────────

router.post('/:id/branch', auth, wrap(async (req, res) => {
  const { name } = req.body;

  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );

  const repo = rows[0];
  const repoUrl = `${apacheCfg.baseUrl}/${repo.name}`;

  await svnSvc.createBranch(repoUrl, name);

  res.json({ message: `Branch '${name}' created` });
}));

// ─── CREATE TAG ────────────────────────────────────

router.post('/:id/tag', auth, wrap(async (req, res) => {
  const { name } = req.body;

  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );

  const repo = rows[0];
  const repoUrl = `${apacheCfg.baseUrl}/${repo.name}`;

  await svnSvc.createTag(repoUrl, name);

  res.json({ message: `Tag '${name}' created` });
}));
// 📂 FILE BROWSER
router.get('/:id/files', wrap(async (req, res) => {
  const { path: filePath = '' } = req.query;

  // 1. Get repo
  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  const repo = rows[0];

  // 2. Build SVN URL
  const baseUrl = `${apacheCfg.baseUrl}/${repo.name}`;
  const targetPath = filePath ? `${baseUrl}/${filePath}` : baseUrl;

  try {
    // 3. Run svn list
    const { stdout } = await svnSvc.listFiles(targetPath);

    // 4. Parse output
    const files = stdout
      .split('\n')
      .filter(Boolean)
      .map(item => ({
        name: item.replace('/', ''),
        type: item.endsWith('/') ? 'dir' : 'file'
      }));

    res.json(files);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list files' });
  }
}));
// 📄 FILE CONTENT API
router.get('/:id/file-content', wrap(async (req, res) => {
  const { path: filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  const repo = rows[0];

  const fileUrl = `${apacheCfg.baseUrl}/${repo.name}/${filePath}`;

  const { stdout } = await svnSvc.getFileContent(fileUrl);

  res.json({ content: stdout });
}));

// 📜 COMMIT HISTORY API
// 📜 COMMIT HISTORY API
router.get('/:id/commits', wrap(async (req, res) => {
  const limit = parseInt(req.query.limit || '20');

  // 1. Get repo
  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  const repo = rows[0];

  const repoUrl = `${apacheCfg.baseUrl}/${repo.name}`;

  console.log("📜 Fetching commits from:", repoUrl);

  try {
    const commits = await svnSvc.getCommitHistory(repoUrl, limit);

    res.json({
      total: commits.length,
      commits
    });

  } catch (err) {
    console.error("❌ Commit error:", err);
    res.status(500).json({ error: 'Failed to fetch commits' });
  }
}));
// 🌿 LIST BRANCHES
router.get('/:id/branches', wrap(async (req, res) => {
  // 1. Get repo
  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  const repo = rows[0];

  // 2. Build URL
  const url = `${apacheCfg.baseUrl}/${repo.name}/branches`;

  console.log("🌿 Fetching branches from:", url);

  try {
    const { stdout } = await svnSvc.listFiles(url);

    const branches = stdout
      .split('\n')
      .filter(Boolean)
      .map(b => b.replace('/', ''));

    res.json(branches);

  } catch (err) {
    console.error("❌ Branch error:", err);
    res.json([]); // return empty instead of crash
  }
}));
// 🏷️ LIST TAGS
router.get('/:id/tags', wrap(async (req, res) => {
  // 1. Get repo
  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  const repo = rows[0];

  // 2. Build URL
  const url = `${apacheCfg.baseUrl}/${repo.name}/tags`;

  console.log("🏷️ Fetching tags from:", url);

  try {
    const { stdout } = await svnSvc.listFiles(url);

    const tags = stdout
      .split('\n')
      .filter(Boolean)
      .map(t => t.replace('/', ''));

    res.json(tags);

  } catch (err) {
    console.error("❌ Tag error:", err);
    res.json([]);
  }
}));

// ✅ MUST BE LAST
module.exports = router;