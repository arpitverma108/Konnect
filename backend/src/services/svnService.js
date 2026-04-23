'use strict';

const { execFile }  = require('child_process');
const { promisify } = require('util');
const path          = require('path');
const fse           = require('fs-extra');
const xml2js        = require('xml2js');
const apacheCfg     = require('../config/apache');
const logger        = require('../config/logger');

const execFileAsync = promisify(execFile);

// ─── Helpers ─────────────────────────────────────

function svnadmin(...args) {
  return execFileAsync(apacheCfg.svnadmin, args);
}

function svn(...args) {
  return execFileAsync(apacheCfg.svn, args);
}

function toFileUrl(diskPath) {
  return `file://${diskPath}`;
}

// ─── REPO CREATION ───────────────────────────────

async function createRepository(repoPath) {
  await svnadmin('create', repoPath);
  logger.info(`Repository created at ${repoPath}`);
}

async function createStandardLayout(repoPath) {
  const repoUrl = toFileUrl(repoPath);

  await svn(
    'mkdir',
    '--parents',
    `${repoUrl}/trunk`,
    `${repoUrl}/branches`,
    `${repoUrl}/tags`,
    '-m',
    'Initialize standard layout'
  );

  console.log('✅ Layout created');
}

// 🔥 VERY IMPORTANT FUNCTION
async function createInitialCommit(repoPath) {
  try {
    const repoUrl = toFileUrl(repoPath);

    const tempDir = '/tmp/konnect_init';
    await fse.ensureDir(tempDir);

    const readme = path.join(tempDir, 'README.md');
    await fse.writeFile(readme, '# Initial Commit\n');

    await svn(
      'import',
      tempDir,
      `${repoUrl}/trunk`,
      '-m',
      'Initial commit'
    );

    await fse.remove(tempDir);

    console.log('✅ Initial commit created');

  } catch (err) {
    console.error('❌ Initial commit failed:', err.stderr || err.message);
    throw err;
  }
}

// ─── BRANCH & TAG ───────────────────────────────

async function createBranch(repoUrl, branchName) {
  await svn(
    'copy',
    `${repoUrl}/trunk`,
    `${repoUrl}/branches/${branchName}`,
    '-m',
    `Create branch ${branchName}`
  );
}

async function createTag(repoUrl, tagName) {
  await svn(
    'copy',
    `${repoUrl}/trunk`,
    `${repoUrl}/tags/${tagName}`,
    '-m',
    `Create tag ${tagName}`
  );
}

// ─── OTHER FUNCTIONS ─────────────────────────────

async function deleteRepository(repoPath) {
  await fse.remove(repoPath);
}

async function verifyRepository(repoPath) {
  try {
    await svnadmin('verify', '--quiet', repoPath);
    return true;
  } catch {
    return false;
  }
}

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
  if (!xml) return [];
  const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
  const entries = parsed?.log?.logentry;
  const list = Array.isArray(entries) ? entries : [entries];

  return list.map(entry => ({
    revision: parseInt(entry.$.revision, 10),
    author: entry.author || '',
    date: entry.date || null,
    message: entry.msg || ''
  }));
}

async function getYoungestRevision(repoPath) {
  try {
    const { stdout } = await svnadmin('youngest', repoPath);
    return parseInt(stdout.trim(), 10);
  } catch {
    return 0;
  }
}

async function getDiskUsage(repoPath) {
  return 0;
}

// 📂 LIST FILES
async function listFiles(url) {
  return svn('list', url);
}
// 📄 GET FILE CONTENT
async function getFileContent(url) {
  return svn('cat', url);
}

// 📜 GET COMMIT HISTORY
async function getCommitHistory(url, limit = 20) {
  const { stdout } = await svn(
    'log',
    url,
    '--limit',
    limit.toString(),
    '--xml'
  );

  // Parse XML → JSON (simple parsing)
  const commits = [];

  const entries = stdout.split('<logentry').slice(1);

  entries.forEach(entry => {
    const revision = entry.match(/revision="(\d+)"/)?.[1];
    const author = entry.match(/<author>(.*?)<\/author>/)?.[1];
    const date = entry.match(/<date>(.*?)<\/date>/)?.[1];
    const message = entry.match(/<msg>(.*?)<\/msg>/)?.[1];

    commits.push({
      revision,
      author,
      date,
      message
    });
  });

  return commits;
}

// ─── EXPORTS ─────────────────────────────────────

module.exports = {
  createRepository,
  createStandardLayout,
  createInitialCommit, // ✅ FIXED (IMPORTANT)
  deleteRepository,
  verifyRepository,
  getLog,
  getYoungestRevision,
  getDiskUsage,
  createBranch,
  createTag,
  listFiles,
  getFileContent,
  getCommitHistory,
};