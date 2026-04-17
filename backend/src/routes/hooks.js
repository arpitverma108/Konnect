// hooks.js
'use strict';

const express    = require('express');
const Joi        = require('joi');
const router     = express.Router();

const db         = require('../config/database');
const validate   = require('../middleware/validate');
const wrap       = require('../middleware/asyncWrapper');
const hookSvc    = require('../services/hookService');
const apacheCfg  = require('../config/apache');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getRepo(id) {
  const { rows } = await db.query('SELECT * FROM repositories WHERE id = $1', [id]);
  if (!rows[0]) {
    const err = new Error('Repository not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
}

// ─── Validation ──────────────────────────────────────────────────────────────

const saveHookSchema = Joi.object({
  content: Joi.string().allow('').required(),
});

const toggleSchema = Joi.object({
  isEnabled: Joi.boolean().required(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/hooks/templates — available hook templates
router.get('/templates', (req, res) => {
  res.json(Object.keys(hookSvc.TEMPLATES));
});

// GET /api/hooks/repo/:repoId
router.get('/repo/:repoId', wrap(async (req, res) => {
  await getRepo(req.params.repoId);
  const hooks = await hookSvc.listHooks(db, req.params.repoId);

  // Augment with all supported hook names (so UI shows all slots)
  const hookMap = {};
  for (const h of hooks) hookMap[h.hook_name] = h;
  const all = apacheCfg.hookNames.map(name => hookMap[name] || {
    repo_id:    parseInt(req.params.repoId, 10),
    hook_name:  name,
    content:    '',
    is_enabled: false,
    id:         null,
  });
  res.json(all);
}));

// GET /api/hooks/repo/:repoId/:hookName
router.get('/repo/:repoId/:hookName', wrap(async (req, res) => {
  const repo = await getRepo(req.params.repoId);
  const hook = await hookSvc.getHook(db, req.params.repoId, req.params.hookName);
  if (!hook) return res.status(404).json({ error: 'Hook not found' });
  res.json(hook);
}));

// PUT /api/hooks/repo/:repoId/:hookName
router.put('/repo/:repoId/:hookName', validate(saveHookSchema), wrap(async (req, res) => {
  const repo = await getRepo(req.params.repoId);
  const hook = await hookSvc.saveHook(
    db,
    repo.id,
    req.params.hookName,
    req.body.content,
    repo.disk_path
  );
  res.json(hook);
}));

// POST /api/hooks/repo/:repoId/:hookName/toggle
router.post('/repo/:repoId/:hookName/toggle', validate(toggleSchema), wrap(async (req, res) => {
  const repo = await getRepo(req.params.repoId);
  const hook = await hookSvc.toggleHook(
    db,
    repo.id,
    req.params.hookName,
    req.body.isEnabled,
    repo.disk_path
  );
  res.json(hook);
}));

// DELETE /api/hooks/repo/:repoId/:hookName
router.delete('/repo/:repoId/:hookName', wrap(async (req, res) => {
  const repo = await getRepo(req.params.repoId);
  await hookSvc.deleteHook(db, repo.id, req.params.hookName, repo.disk_path);
  res.json({ message: 'Hook deleted' });
}));

module.exports = router;
