'use strict';

const express    = require('express');
const Joi        = require('joi');
const router     = express.Router();

const db         = require('../config/database');
const validate   = require('../middleware/validate');
const wrap       = require('../middleware/asyncWrapper');
const hookSvc    = require('../services/hookService');
const apacheCfg  = require('../config/apache');

const auth       = require('../middleware/auth');
const authorize  = require('../middleware/authorize');
const checkPermission = require('../middleware/checkPermission'); // 🔥 IMPORTANT


// ─── Helpers ─────────────────────────────────

async function getRepo(id) {
  const { rows } = await db.query(
    'SELECT * FROM repositories WHERE id = $1',
    [id]
  );

  if (!rows[0]) {
    const err = new Error('Repository not found');
    err.statusCode = 404;
    throw err;
  }

  return rows[0];
}


// ─── Validation ──────────────────────────────

const saveHookSchema = Joi.object({
  content: Joi.string().allow('').required(),
});

const toggleSchema = Joi.object({
  isEnabled: Joi.boolean().required(),
});


// ─── Routes ──────────────────────────────────

// ✅ Public: templates
router.get('/templates', (req, res) => {
  res.json(Object.keys(hookSvc.TEMPLATES));
});


// 🔐 Get all hooks (READ PERMISSION REQUIRED)
router.get(
  '/repo/:repoId',
  auth,
  checkPermission('read'), // 🔥 ADDED
  wrap(async (req, res) => {

    await getRepo(req.params.repoId);

    const hooks = await hookSvc.listHooks(db, req.params.repoId);

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
  })
);


// 🔐 Get single hook (READ PERMISSION REQUIRED)
router.get(
  '/repo/:repoId/:hookName',
  auth,
  checkPermission('read'), // 🔥 ADDED
  wrap(async (req, res) => {

    await getRepo(req.params.repoId);

    const hook = await hookSvc.getHook(
      db,
      req.params.repoId,
      req.params.hookName
    );

    if (!hook) {
      return res.status(404).json({ error: 'Hook not found' });
    }

    res.json(hook);
  })
);


// 🔒 Save hook (WRITE PERMISSION REQUIRED)
router.put(
  '/repo/:repoId/:hookName',
  auth,
  checkPermission('write'), // 🔥 ADDED
  authorize('admin', 'super_admin'),
  validate(saveHookSchema),
  wrap(async (req, res) => {

    const repo = await getRepo(req.params.repoId);

    const hook = await hookSvc.saveHook(
      db,
      repo.id,
      req.params.hookName,
      req.body.content,
      repo.disk_path
    );

    res.json(hook);
  })
);


// 🔒 Toggle hook (WRITE PERMISSION REQUIRED)
router.post(
  '/repo/:repoId/:hookName/toggle',
  auth,
  checkPermission('write'), // 🔥 ADDED
  authorize('admin', 'super_admin'),
  validate(toggleSchema),
  wrap(async (req, res) => {

    const repo = await getRepo(req.params.repoId);

    const hook = await hookSvc.toggleHook(
      db,
      repo.id,
      req.params.hookName,
      req.body.isEnabled,
      repo.disk_path
    );

    res.json(hook);
  })
);


// 🔒 Delete hook (WRITE PERMISSION REQUIRED)
router.delete(
  '/repo/:repoId/:hookName',
  auth,
  checkPermission('write'), // 🔥 ADDED
  authorize('admin', 'super_admin'),
  wrap(async (req, res) => {

    const repo = await getRepo(req.params.repoId);

    await hookSvc.deleteHook(
      db,
      repo.id,
      req.params.hookName,
      repo.disk_path
    );

    res.json({ message: 'Hook deleted' });
  })
);


module.exports = router;