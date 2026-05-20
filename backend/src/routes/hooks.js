'use strict';

const express    = require('express');
const Joi        = require('joi');
const router     = express.Router();

const db         = require('../config/database');
const validate   = require('../middleware/validate');
const wrap       = require('../middleware/asyncWrapper');
const hookSvc    = require('../services/hookService');
const activitySvc = require('../services/activityService');
const apacheCfg  = require('../config/apache');
const logger     = require('../config/logger');
const redis      = require('../config/redis');

const auth            = require('../middleware/auth');
const authorize       = require('../middleware/authorize');
const checkPermission = require('../middleware/checkPermission');

// ─────────────────────────────────────────────
// FIX 3.2 (IMPROVED): Two-layer hook content security
//
// Layer 1 — BLOCKLIST: catches the most obvious reverse-shell patterns,
//   including bypass tricks like escaped chars and alternate interpreters.
// Layer 2 — WARNING SCAN: flags other risky constructs and logs them,
//   but does not block (super_admin is trusted enough to use these).
//
// This is more robust than the original single-layer blocklist which
// could be bypassed with /bin/sh -c, node -e, eval, exec, etc.
// ─────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  // Network exfiltration
  { re: /\bcurl\b/i,                  reason: 'curl is not allowed in hooks' },
  { re: /\bwget\b/i,                  reason: 'wget is not allowed in hooks' },
  { re: /\bnc\b|\bnetcat\b/i,         reason: 'netcat is not allowed in hooks' },
  { re: /\bssh\b/i,                   reason: 'ssh is not allowed in hooks' },
  { re: /\btelnet\b/i,                reason: 'telnet is not allowed in hooks' },
  // Reverse shells
  { re: /\/dev\/tcp/i,                reason: '/dev/tcp reverse shell detected' },
  { re: /\/dev\/udp/i,                reason: '/dev/udp reverse shell detected' },
  { re: /bash\s+-[il]/i,             reason: 'interactive bash shell not allowed' },
  { re: /\bsocat\b/i,                 reason: 'socat is not allowed in hooks' },
  // Code execution via interpreters
  { re: /\bnode\s+-e\b/i,             reason: 'node -e code execution not allowed' },
  { re: /\bpython[23]?\s+-c\b/i,      reason: 'python -c code execution not allowed' },
  { re: /\bperl\s+-e\b/i,             reason: 'perl -e code execution not allowed' },
  { re: /\bruby\s+-e\b/i,             reason: 'ruby -e code execution not allowed' },
  { re: /\bphp\s+-r\b/i,              reason: 'php -r code execution not allowed' },
  // eval / exec builtins
  { re: /\beval\b/i,                  reason: 'eval is not allowed in hooks' },
  // Destructive filesystem ops
  { re: /\brm\s+-[a-z]*r[a-z]*f\b/i, reason: 'rm -rf is not allowed in hooks' },
  { re: /\bdd\s+if=/i,                reason: 'dd is not allowed in hooks' },
  { re: /\bmkfs\b/i,                  reason: 'mkfs is not allowed in hooks' },
  { re: /\bshred\b/i,                 reason: 'shred is not allowed in hooks' },
  { re: /\bchmod\s+[0-7]*7[0-7]*\s+\//i, reason: 'chmod 777 on root paths not allowed' },
  // Encoded/obfuscated payloads
  { re: /\bbase64\s+-d\b/i,           reason: 'base64 -d decoding not allowed (obfuscation risk)' },
  { re: /\\x[0-9a-f]{2}/i,            reason: 'hex-encoded characters not allowed' },
  { re: /\\u[0-9a-f]{4}/i,            reason: 'unicode-escaped characters not allowed' },
  // Nmap / port scanning
  { re: /\bnmap\b/i,                  reason: 'nmap is not allowed in hooks' },
];

// Patterns to WARN about but not block (logged for audit purposes)
const WARN_PATTERNS = [
  /\$\(.*\)/,           // subshell substitution  $(...)
  /`[^`]+`/,            // backtick subshell
  /\bexec\b/i,          // exec builtin
  /\b\/bin\/sh\b/i,     // explicit /bin/sh calls
  /\b\/usr\/bin\//i,    // direct binary paths
];

function scanHookContent(content) {
  const allowedKonnectHook = typeof hookSvc.postCommitHookUrl === 'function'
    ? hookSvc.postCommitHookUrl()
    : process.env.HOOK_WEBHOOK_URL;
  const normalizedContent = String(content || '');
  const isKonnectPostCommitHook =
    allowedKonnectHook &&
    normalizedContent.includes(allowedKonnectHook) &&
    normalizedContent.includes('X-Sync-Secret');

  for (const { re, reason } of BLOCKED_PATTERNS) {
    if (isKonnectPostCommitHook && reason === 'curl is not allowed in hooks') {
      continue;
    }

    if (re.test(content)) {
      return { blocked: true, reason };
    }
  }
  const warnings = WARN_PATTERNS
    .filter(re => re.test(content))
    .map(re => re.toString());
  return { blocked: false, warnings };
}

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

const postCommitSchema = Joi.object({
  repo_id: Joi.number().integer().positive().optional(),
  repo_path: Joi.string().max(1024).when('repo_id', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  revision: Joi.number().integer().min(0).required(),
  author: Joi.string().allow('', null).max(128).optional(),
  message: Joi.string().allow('', null).max(10000).optional(),
  committed_at: Joi.string().allow('', null).max(128).optional(),
  paths_changed: Joi.alternatives().try(
    Joi.string().allow('', null),
    Joi.array().items(Joi.object({
      action: Joi.string().allow('').max(8),
      path: Joi.string().allow('').max(2048),
    }))
  ).optional(),
});

// ─── Routes ──────────────────────────────────

// Public: hook type templates
router.get('/templates', (req, res) => {
  res.json(Object.keys(hookSvc.TEMPLATES));
});

// SVN post-commit ingestion. This is called by repository hook scripts, not by browsers.
router.post(
  '/svn/post-commit',
  validate(postCommitSchema),
  wrap(async (req, res) => {
    const headerSecret = req.headers['x-sync-secret'];
    if (!headerSecret || headerSecret !== process.env.SYNC_SECRET) {
      return res.status(403).json({ error: 'Invalid sync secret' });
    }

    const activity = await activitySvc.recordCommitFromHook(db, req.body);

    if (redis.isAvailable()) {
      await Promise.allSettled([
        redis.delPattern('activity:*'),
      ]);
    }

    logger.info('SVN post-commit hook ingested', {
      repo_id: activity.repo_id,
      revision: activity.revision,
      author: activity.author,
    });

    res.status(202).json({
      message: 'Commit recorded',
      activity_id: activity.id,
      repo_id: activity.repo_id,
      revision: activity.revision,
    });
  })
);

// Get all hooks for a repo
router.get(
  '/repo/:repoId',
  auth,
  checkPermission('read'),
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

// Get single hook
router.get(
  '/repo/:repoId/:hookName',
  auth,
  checkPermission('read'),
  wrap(async (req, res) => {
    await getRepo(req.params.repoId);

    const hook = await hookSvc.getHook(db, req.params.repoId, req.params.hookName);

    if (!hook) {
      return res.status(404).json({ error: 'Hook not found' });
    }

    res.json(hook);
  })
);

// Save hook — FIX 3.2: super_admin only + improved two-layer content scan
router.put(
  '/repo/:repoId/:hookName',
  auth,
  checkPermission('write'),
  authorize('super_admin'),
  validate(saveHookSchema),
  wrap(async (req, res) => {
    const { content } = req.body;
    const logger = require('../config/logger');

    // FIX 3.2: Two-layer security scan
    const scan = scanHookContent(content);

    if (scan.blocked) {
      logger.warn(`Hook save BLOCKED for repo ${req.params.repoId} by user ${req.user.username}: ${scan.reason}`);
      return res.status(400).json({
        error: `Hook content rejected: ${scan.reason}`,
      });
    }

    if (scan.warnings && scan.warnings.length > 0) {
      // Log for audit but allow super_admin to proceed
      logger.warn(`Hook save WARNING for repo ${req.params.repoId} by user ${req.user.username}. Patterns: ${scan.warnings.join(', ')}`);
    }

    const repo = await getRepo(req.params.repoId);

    const hook = await hookSvc.saveHook(
      db,
      repo.id,
      req.params.hookName,
      content,
      repo.disk_path
    );

    res.json(hook);
  })
);

// Toggle hook — super_admin only
router.post(
  '/repo/:repoId/:hookName/toggle',
  auth,
  checkPermission('write'),
  authorize('super_admin'),
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

// Delete hook — super_admin only
router.delete(
  '/repo/:repoId/:hookName',
  auth,
  checkPermission('write'),
  authorize('super_admin'),
  wrap(async (req, res) => {
    const repo = await getRepo(req.params.repoId);

    await hookSvc.deleteHook(db, repo.id, req.params.hookName, repo.disk_path);

    res.json({ message: 'Hook deleted' });
  })
);

module.exports = router;
