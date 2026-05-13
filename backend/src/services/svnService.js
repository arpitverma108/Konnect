'use strict';

const { execFile }  = require('child_process');
const { promisify } = require('util');
const path          = require('path');
const fse           = require('fs-extra');
const xml2js        = require('xml2js');

const apacheCfg     = require('../config/apache');
const env           = require('../config/env');
const logger        = require('../config/logger');

const execFileAsync = promisify(execFile);

// ─── HELPERS ─────────────────────────

function svnadmin(...args) {
  return execFileAsync(apacheCfg.svnadmin, args);
}

function svn(...args) {
  return execFileAsync(apacheCfg.svn, args);
}

function svnlook(...args) {
  return execFileAsync('svnlook', args);
}

function toFileUrl(diskPath) {
  return `file://${diskPath}`;
}

// ─────────────────────────────────────
// 🔥 STEP 7 FIX: STANDARD LAYOUT
// ─────────────────────────────────────

async function createStandardLayout(repoPath) {
  const repoUrl = toFileUrl(repoPath);

  try {
    await svn(
      'mkdir',
      `${repoUrl}/trunk`,
      `${repoUrl}/branches`,
      `${repoUrl}/tags`,
      '-m',
      'Initialize standard layout'
    );

    logger.info(`Standard layout created for ${repoPath}`);
  } catch (err) {
    logger.error('Standard layout creation failed:', err.message);
    throw err;
  }
}

// ─── REPO CREATION ───────────────────

async function createRepository(repoPath) {
  try {
    await svnadmin('create', repoPath);

    const hookPath = path.join(repoPath, 'hooks', 'post-commit');

    const hookContent = `#!/bin/bash
curl -s -X POST "${env.SYNC_WEBHOOK_URL}" > /dev/null 2>&1
`;

    await fse.writeFile(hookPath, hookContent);
    await fse.chmod(hookPath, 0o755);

    logger.info(`Repository created: ${repoPath}`);
  } catch (err) {
    logger.error('Repo creation failed:', err.message);
    throw err;
  }
}

// ─── INITIAL COMMIT (UPDATED FLOW) ───────────

async function createInitialCommit(repoPath) {
  const repoUrl = toFileUrl(repoPath);
  const tempDir = `/tmp/konnect_${Date.now()}`;

  try {
    await fse.ensureDir(tempDir);

    await fse.writeFile(
      path.join(tempDir, 'README.md'),
      '# Initial Commit\n'
    );

    // ✅ Import into trunk (NOW EXISTS)
    await svn(
      'import',
      tempDir,
      `${repoUrl}/trunk`,
      '-m',
      'Initial commit'
    );

  } catch (err) {
    logger.error('Initial commit failed:', err.message);
    throw err;
  } finally {
    await fse.remove(tempDir).catch(() => {});
  }
}

// ─── 🔥 FINAL FLOW FUNCTION (USE THIS) ───────

async function createFullRepository(repoPath) {
  try {
    await createRepository(repoPath);
    await createStandardLayout(repoPath);   // ✅ FIX ADDED
    await createInitialCommit(repoPath);

    logger.info(`Full repository setup complete: ${repoPath}`);
  } catch (err) {
    logger.error('Full repo creation failed:', err.message);
    throw err;
  }
}

// ─── DELETE REPO ─────────────────────

async function deleteRepository(repoPath) {
  try {
    await fse.remove(repoPath);
  } catch (err) {
    logger.error('Delete repo failed:', err.message);
    throw err;
  }
}

// ─── FILE LIST ───────────────────────

async function listFiles(repoPath) {
  try {
    const { stdout } = await svnlook('tree', repoPath);

    return stdout
      .split('\n')
      .filter(line => line.trim() !== '');
  } catch (err) {
    logger.error('List files error:', err.message);
    throw err;
  }
}

// ─── FILE CONTENT ────────────────────

async function getFileContent(repoPath, filePath) {
  try {
    const { stdout } = await svnlook('cat', repoPath, filePath);
    return stdout;
  } catch (err) {
    logger.error('File read error:', err.message);
    throw new Error('File not found');
  }
}

// ─── COMMIT HISTORY ──────────────────

async function getCommitHistory(repoPath, limit = 20) {
  try {
    const repoUrl = toFileUrl(repoPath);

    // Use --verbose to get paths changed per revision
    const { stdout } = await svn(
      'log',
      repoUrl,
      '--limit',
      limit.toString(),
      '--xml',
      '--verbose'
    );

    if (!stdout) return [];

    const parsed = await xml2js.parseStringPromise(stdout, {
      explicitArray: false
    });

    const entries = parsed?.log?.logentry;
    if (!entries) return [];

    const list = Array.isArray(entries) ? entries : [entries];

    return list.map(entry => {
      // Parse changed paths from verbose log
      let paths = [];
      try {
        const rawPaths = entry.paths?.path;
        if (rawPaths) {
          const pathList = Array.isArray(rawPaths) ? rawPaths : [rawPaths];
          paths = pathList.map(p => ({
            path:   typeof p === 'string' ? p : (p._ || p),
            action: p.$ ? p.$.action : 'M',
          }));
        }
      } catch (_) {}

      return {
        revision:      parseInt(entry.$.revision, 10),
        author:        entry.author || '',
        date:          entry.date   || '',
        message:       entry.msg    || '',
        paths_changed: paths,
      };
    });

  } catch (err) {
    logger.error('Commit history error:', err.message);
    throw err;
  }
}

// ─── BACKWARD COMPAT ─────────────────

async function getLog(repoPath, limit = 20) {
  return getCommitHistory(repoPath, limit);
}

// ─── REVISION DIFF ──────────────────────

async function getRevisionDiff(repoPath, revision) {
  try {
    const repoUrl = toFileUrl(repoPath);

    const { stdout } = await svn(
      'diff',
      `${repoUrl}@${revision - 1}`,
      `${repoUrl}@${revision}`
    );

    return stdout;
  } catch (err) {
    logger.error('Diff error:', err.message);
    return '';
  }
}

// ─── CREATE BRANCH ──────────────────────

async function createBranch(repoPath, branchName, fromRevision = 'HEAD', message = 'Create branch') {
  try {
    const repoUrl = toFileUrl(repoPath);

    await svn(
      'copy',
      `${repoUrl}/trunk@${fromRevision}`,
      `${repoUrl}/branches/${branchName}`,
      '-m',
      message
    );

    logger.info(`Branch '${branchName}' created from ${fromRevision}`);
  } catch (err) {
    logger.error('Create branch error:', err.message);
    throw err;
  }
}

// ─── DELETE BRANCH ──────────────────────

async function deleteBranch(repoPath, branchName) {
  try {
    const repoUrl = toFileUrl(repoPath);

    await svn(
      'remove',
      `${repoUrl}/branches/${branchName}`,
      '-m',
      `Delete branch '${branchName}'`
    );

    logger.info(`Branch '${branchName}' deleted`);
  } catch (err) {
    logger.error('Delete branch error:', err.message);
    throw err;
  }
}

// ─── CREATE TAG ─────────────────────────

async function createTag(repoPath, tagName, fromRevision = 'HEAD', message = 'Create tag') {
  try {
    const repoUrl = toFileUrl(repoPath);

    await svn(
      'copy',
      `${repoUrl}/trunk@${fromRevision}`,
      `${repoUrl}/tags/${tagName}`,
      '-m',
      message
    );

    logger.info(`Tag '${tagName}' created from ${fromRevision}`);
  } catch (err) {
    logger.error('Create tag error:', err.message);
    throw err;
  }
}

// ─── DELETE TAG ─────────────────────────

async function deleteTag(repoPath, tagName) {
  try {
    const repoUrl = toFileUrl(repoPath);

    await svn(
      'remove',
      `${repoUrl}/tags/${tagName}`,
      '-m',
      `Delete tag '${tagName}'`
    );

    logger.info(`Tag '${tagName}' deleted`);
  } catch (err) {
    logger.error('Delete tag error:', err.message);
    throw err;
  }
}

// ─── DISK USAGE ──────────────────────

async function getDiskUsage(repoPath) {
  try {
    const { stdout } = await execFileAsync('du', ['-sb', repoPath]);
    return parseInt(stdout.split('\t')[0], 10);
  } catch (err) {
    logger.error('Disk usage error:', err.message);
    return 0;
  }
}

// ─── EXPORTS ─────────────────────────

module.exports = {
  createRepository,
  createStandardLayout,   // ✅ NEW
  createInitialCommit,
  createFullRepository,   // ✅ USE THIS IN ROUTES
  deleteRepository,
  listFiles,
  getFileContent,
  getCommitHistory,
  getLog,
  getRevisionDiff,        // ✅ NEW
  createBranch,           // ✅ NEW
  deleteBranch,           // ✅ NEW
  createTag,              // ✅ NEW
  deleteTag,              // ✅ NEW
  getDiskUsage
};