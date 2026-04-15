// svnService.js
'use strict';

const { execFile }  = require('child_process');
const { promisify } = require('util');
const path          = require('path');
const fse           = require('fs-extra');
const xml2js        = require('xml2js');
const apacheCfg     = require('../config/apache');
const logger        = require('../config/logger');

const execFileAsync = promisify(execFile);

// ─── Helpers ────────────────────────────────────────────────────────────────

function svnadmin(...args) {
  logger.debug('svnadmin', { args });
  return execFileAsync(apacheCfg.svnadmin, args);
}

function svn(...args) {
  logger.debug('svn', { args });
  return execFileAsync(apacheCfg.svn, args);
}

// Convert a disk path to a file:/// URL (cross-platform)
function toFileUrl(diskPath) {
  const normalised = diskPath.replace(/\\/g, '/');
  return `file:///${normalised.replace(/^\//, '')}`;
}

// ─── Repository Operations ───────────────────────────────────────────────────

/**
 * Create a new SVN repository on disk.
 * @param {string} repoPath - Absolute path where the repo should be created.
 */
async function createRepository(repoPath) {
  await svnadmin('create', repoPath);
  logger.info(`Repository created at ${repoPath}`);
}

/**
 * Create trunk / branches / tags directories inside the repository.
 * Uses file:// protocol so Apache doesn't need to be running.
 * @param {string} repoPath - Absolute path to the SVN repository.
 */
async function createStandardLayout(repoPath) {
  const repoUrl = toFileUrl(repoPath);
  await svn(
    'mkdir',
    '--parents',
    `${repoUrl}/trunk`,
    `${repoUrl}/branches`,
    `${repoUrl}/tags`,
    '-m', 'Initialize standard layout (trunk/branches/tags)'
  );
  logger.info(`Standard layout created for ${repoPath}`);
}

/**
 * Delete a repository from disk.
 * @param {string} repoPath - Absolute path to the repository.
 */
async function deleteRepository(repoPath) {
  await fse.remove(repoPath);
  logger.info(`Repository deleted: ${repoPath}`);
}

/**
 * Verify that a path is a valid SVN repository (svnadmin verify).
 * @param {string} repoPath
 * @returns {boolean}
 */
async function verifyRepository(repoPath) {
  try {
    await svnadmin('verify', '--quiet', repoPath);
    return true;
  } catch {
    return false;
  }
}

// ─── SVN Log ─────────────────────────────────────────────────────────────────

/**
 * Get SVN commit log for a repository.
 * Returns parsed JS objects.
 * @param {string} repoPath
 * @param {number} limit
 * @returns {Array}
 */
async function getLog(repoPath, limit = 50) {
  const repoUrl = toFileUrl(repoPath);
  const { stdout } = await svn(
    'log', '--xml', '--verbose',
    '-l', String(limit),
    repoUrl
  );
  return parseSvnLogXml(stdout);
}

async function parseSvnLogXml(xml) {
  if (!xml || xml.trim() === '') return [];
  const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
  const entries = parsed?.log?.logentry;
  if (!entries) return [];
  const list = Array.isArray(entries) ? entries : [entries];
  return list.map(entry => ({
    revision:    parseInt(entry.$.revision, 10),
    author:      entry.author || '',
    date:        entry.date   || null,
    message:     entry.msg    || '',
    paths:       normalisePaths(entry.paths),
  }));
}

function normalisePaths(paths) {
  if (!paths) return [];
  const items = paths.path;
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];
  return list.map(p => ({
    action: p.$.action,
    path:   p._,
  }));
}

// ─── Youngest Revision ───────────────────────────────────────────────────────

async function getYoungestRevision(repoPath) {
  try {
    const { stdout } = await svnadmin('youngest', repoPath);
    return parseInt(stdout.trim(), 10);
  } catch {
    return 0;
  }
}

// ─── Disk Usage ──────────────────────────────────────────────────────────────

async function getDiskUsage(repoPath) {
  try {
    const stat = await fse.stat(repoPath);
    // For a real disk-usage, we'd walk the dir; return a basic check for now
    return stat.isDirectory() ? await dirSize(repoPath) : 0;
  } catch {
    return 0;
  }
}

async function dirSize(dir) {
  const files = await fse.readdir(dir, { withFileTypes: true });
  let size = 0;
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      size += await dirSize(full);
    } else {
      const st = await fse.stat(full);
      size += st.size;
    }
  }
  return size;
}

module.exports = {
  createRepository,
  createStandardLayout,
  deleteRepository,
  verifyRepository,
  getLog,
  getYoungestRevision,
  getDiskUsage,
};
