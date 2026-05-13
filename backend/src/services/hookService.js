// hookService.js
'use strict';

const path      = require('path');
const fse       = require('fs-extra');
const apacheCfg = require('../config/apache');
const logger    = require('../config/logger');

// Hook script templates
const TEMPLATES = {
  'pre-commit': {
    unix: `#!/bin/bash
# pre-commit hook — runs before each commit
# REPOS is the path to the repository
# TXN is the name of the transaction about to be committed

REPOS="$1"
TXN="$2"
SVNLOOK="${process.env.SVNLOOK_PATH || 'svnlook'}"

# --- Example: Block direct commits to trunk ---
# CHANGED=$($SVNLOOK changed -t "$TXN" "$REPOS")
# if echo "$CHANGED" | grep -qE '^[AUMDR].* trunk/'; then
#   echo "ERROR: Direct commits to trunk are not allowed." >&2
#   echo "ERROR: Please use a branch and merge into trunk." >&2
#   exit 1
# fi

# --- Example: Require non-empty commit message ---
MSG=$($SVNLOOK log -t "$TXN" "$REPOS")
if [ -z "$(echo $MSG | tr -d '[:space:]')" ]; then
  echo "ERROR: Commit message cannot be empty." >&2
  exit 1
fi

exit 0
`,
    windows: `@echo off
REM pre-commit hook — Windows version
SET REPOS=%1
SET TXN=%2
SET SVNLOOK="${process.env.SVNLOOK_PATH || 'svnlook'}"

REM Check for non-empty commit message
FOR /F "delims=" %%M IN ('%SVNLOOK% log -t %TXN% %REPOS%') DO SET MSG=%%M
IF "%MSG%"=="" (
  echo ERROR: Commit message cannot be empty. 1>&2
  exit /b 1
)

exit /b 0
`,
  },
  'post-commit': {
    unix: `#!/bin/bash
# post-commit hook — runs after each successful commit
REPOS="$1"
REV="$2"
SVNLOOK="${process.env.SVNLOOK_PATH || 'svnlook'}"

# Add post-commit actions here (e.g. email notifications, CI triggers)
# AUTHOR=$($SVNLOOK author -r "$REV" "$REPOS")
# MSG=$($SVNLOOK log -r "$REV" "$REPOS")
# echo "Committed r$REV by $AUTHOR: $MSG"

exit 0
`,
    windows: `@echo off
REM post-commit hook — Windows version
SET REPOS=%1
SET REV=%2
exit /b 0
`,
  },
  'pre-revprop-change': {
    unix: `#!/bin/bash
# pre-revprop-change — runs before a revision property is changed
REPOS="$1"
REV="$2"
USER="$3"
PROPNAME="$4"
ACTION="$5"

if [ "$ACTION" = "M" ] && [ "$PROPNAME" = "svn:log" ]; then
  exit 0
fi

echo "ERROR: Changing revision properties (other than svn:log) is not allowed." >&2
exit 1
`,
    windows: `@echo off
SET REPOS=%1
SET REV=%2
SET USER=%3
SET PROPNAME=%4
SET ACTION=%5

IF "%ACTION%"=="M" IF "%PROPNAME%"=="svn:log" exit /b 0
echo ERROR: Changing revision properties is not allowed. 1>&2
exit /b 1
`,
  },
};

// ─── Hook file operations ─────────────────────────────────────────────────────

function hookFilePath(repoPath, hookName) {
  const fileName = apacheCfg.hookFileName(hookName);
  return path.join(repoPath, 'hooks', fileName);
}

/**
 * List all hooks stored in DB for a repository.
 */
async function listHooks(db, repoId) {
  const { rows } = await db.query(
    'SELECT * FROM hooks WHERE repo_id = $1 ORDER BY hook_name',
    [repoId]
  );
  return rows;
}

/**
 * Get a specific hook from DB (or return template).
 */
async function getHook(db, repoId, hookName) {
  const { rows } = await db.query(
    'SELECT * FROM hooks WHERE repo_id = $1 AND hook_name = $2',
    [repoId, hookName]
  );
  if (rows[0]) return rows[0];

  // Return template content if exists
  const tpl = TEMPLATES[hookName];
  if (tpl) {
    return {
      repo_id:    repoId,
      hook_name:  hookName,
      content:    process.platform === 'win32' ? tpl.windows : tpl.unix,
      is_enabled: false,
    };
  }
  return null;
}

/**
 * Save/update a hook in DB and deploy to filesystem.
 */
async function saveHook(db, repoId, hookName, content, repoPath) {
  // Upsert in DB
  const { rows } = await db.query(
    `INSERT INTO hooks (repo_id, hook_name, content, is_enabled)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (repo_id, hook_name)
     DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
     RETURNING *`,
    [repoId, hookName, content]
  );

  // Deploy to filesystem
  await deployHook(repoPath, hookName, content, true);

  return rows[0];
}

/**
 * Toggle a hook enabled/disabled.
 * Disabling removes execute permission (Unix) or renames (Windows).
 */
async function toggleHook(db, repoId, hookName, isEnabled, repoPath) {
  const { rows } = await db.query(
    `UPDATE hooks SET is_enabled = $1 WHERE repo_id = $2 AND hook_name = $3 RETURNING *`,
    [isEnabled, repoId, hookName]
  );
  if (!rows[0]) {
    const err = new Error('Hook not found');
    err.statusCode = 404;
    throw err;
  }

  const filePath = hookFilePath(repoPath, hookName);
  if (await fse.pathExists(filePath)) {
    if (process.platform !== 'win32') {
      // On Unix: toggle executable bit
      const mode = isEnabled ? 0o755 : 0o644;
      await fse.chmod(filePath, mode);
    }
  }
  return rows[0];
}

/**
 * Delete a hook from DB and filesystem.
 */
async function deleteHook(db, repoId, hookName, repoPath) {
  await db.query('DELETE FROM hooks WHERE repo_id = $1 AND hook_name = $2', [repoId, hookName]);
  const filePath = hookFilePath(repoPath, hookName);
  await fse.remove(filePath);
}

/**
 * Internal: write hook file to hooks/ directory.
 */
async function deployHook(repoPath, hookName, content, executable = true) {
  const filePath = hookFilePath(repoPath, hookName);
  await fse.ensureFile(filePath);
  await fse.writeFile(filePath, content, 'utf8');
  if (process.platform !== 'win32' && executable) {
    await fse.chmod(filePath, 0o755);
  }
  logger.info(`Hook deployed: ${filePath}`);
}

module.exports = {
  listHooks,
  getHook,
  saveHook,
  toggleHook,
  deleteHook,
  TEMPLATES,
};
