'use strict';

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fse = require('fs-extra');
const dayjs = require('dayjs');

const apacheCfg = require('../config/apache');
const { reloadApache } = require('./apacheService');
const logger = require('../config/logger');

const execFileAsync = promisify(execFile);

const ROLE_TO_AUTHZ = Object.freeze({
  owner: 'rw',
  maintainer: 'rw',
  developer: 'rw',
  viewer: 'r',
});

const VALID_NAME = /^[A-Za-z0-9._@-]+$/;
const VALID_REPO = /^[A-Za-z0-9._-]+$/;

function normalizeSvnPath(input = '/') {
  let value = String(input || '/').trim();
  if (!value.startsWith('/')) value = `/${value}`;
  value = value.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';

  if (value.includes('\0') || value.includes('..') || /[\r\n[\]=]/.test(value)) {
    throw new Error(`Invalid SVN authz path: ${input}`);
  }

  return value;
}

function assertSafeIdentifier(value, label, regex = VALID_NAME) {
  if (!value || !regex.test(value) || /[\r\n[\]=,\s]/.test(value)) {
    throw new Error(`Invalid ${label} in authz input`);
  }
}

function permissionFor(row) {
  if (row.role && ROLE_TO_AUTHZ[row.role]) return ROLE_TO_AUTHZ[row.role];
  if (['r', 'rw', ''].includes(row.permission)) return row.permission;
  throw new Error(`Invalid permission value for authz input`);
}

async function withDirectoryLock(lockDir, fn, options = {}) {
  const timeoutMs = options.timeoutMs || 15000;
  const staleMs = options.staleMs || 120000;
  const start = Date.now();

  while (true) {
    try {
      await fs.mkdir(lockDir, { recursive: false, mode: 0o700 });
      await fs.writeFile(path.join(lockDir, 'owner'), `${process.pid}\n${new Date().toISOString()}\n`);
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;

      try {
        const stat = await fs.stat(lockDir);
        if (Date.now() - stat.mtimeMs > staleMs) {
          await fse.remove(lockDir);
          continue;
        }
      } catch {
        continue;
      }

      if (Date.now() - start > timeoutMs) {
        const error = new Error('Timed out waiting for authz generation lock');
        error.statusCode = 409;
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  try {
    return await fn();
  } finally {
    await fse.remove(lockDir);
  }
}

async function fsyncFile(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function fsyncDirectory(dirPath) {
  try {
    const handle = await fs.open(dirPath, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (err) {
    logger.debug(`Skipping directory fsync for ${dirPath}: ${err.message}`);
  }
}

async function atomicReplaceFile(targetPath, content) {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const tmpPath = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);

  await fse.ensureDir(dir);
  await fs.writeFile(tmpPath, content, { encoding: 'utf8', mode: 0o640 });
  await fsyncFile(tmpPath);
  await fs.rename(tmpPath, targetPath);
  await fsyncDirectory(dir);
}

function internalValidateAuthz(content) {
  let currentSection = null;
  const seenSections = new Set();

  for (const [index, rawLine] of content.split(/\n/).entries()) {
    const lineNo = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const section = line.match(/^\[([^\]]+)]$/);
    if (section) {
      currentSection = section[1];
      if (seenSections.has(currentSection)) {
        throw new Error(`Duplicate authz section [${currentSection}] at line ${lineNo}`);
      }
      seenSections.add(currentSection);
      continue;
    }

    if (!currentSection) {
      throw new Error(`Authz entry outside a section at line ${lineNo}`);
    }

    if (!line.includes('=')) {
      throw new Error(`Invalid authz assignment at line ${lineNo}`);
    }

    const [subject, rawAccess] = line.split('=').map(v => v.trim());
    if (!subject) throw new Error(`Missing authz subject at line ${lineNo}`);

    if (currentSection === 'groups') {
      assertSafeIdentifier(subject, `group name at line ${lineNo}`);

      const members = rawAccess
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);

      for (const member of members) {
        assertSafeIdentifier(member, `group member at line ${lineNo}`);
      }

      continue;
    }

    if (!['', 'r', 'rw'].includes(rawAccess)) {
      throw new Error(`Invalid authz access "${rawAccess}" at line ${lineNo}`);
    }
  }
}

async function validateWithSvnauthz(content) {
  const dir = path.dirname(apacheCfg.authzPath);
  const tmpPath = path.join(dir, `.authz-validate.${process.pid}.${Date.now()}.tmp`);

  await fs.writeFile(tmpPath, content, { encoding: 'utf8', mode: 0o600 });
  try {
    await execFileAsync(apacheCfg.svnauthz, ['validate', tmpPath], { timeout: 10000 });
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.warn(`svnauthz not found at ${apacheCfg.svnauthz}; using internal authz validation only`);
      return;
    }

    const detail = err.stderr || err.stdout || err.message;
    throw new Error(`svnauthz validation failed: ${detail}`);
  } finally {
    await fse.remove(tmpPath);
  }
}

async function validateAuthz(content) {
  internalValidateAuthz(content);
  await validateWithSvnauthz(content);
}

async function loadAuthzRows(db) {
  const { rows: groups } = await db.query(`
    SELECT g.name,
      COALESCE(string_agg(u.username, ', ' ORDER BY u.username), '') AS members
    FROM groups g
    LEFT JOIN group_members gm ON gm.group_id = g.id
    LEFT JOIN users u ON u.id = gm.user_id AND u.is_active = true
    GROUP BY g.name
    ORDER BY g.name
  `);

  const { rows: perms } = await db.query(`
    SELECT
      r.name AS repo_name,
      COALESCE(p.path, '/') AS path,
      p.subject_type,
      p.permission,
      p.role,
      CASE p.subject_type
        WHEN 'user' THEN u.username
        WHEN 'group' THEN g2.name
      END AS subject_name
    FROM permissions p
    JOIN repositories r ON r.id = p.repo_id AND r.is_active = true
    LEFT JOIN users u ON p.subject_type = 'user' AND u.id = p.subject_id AND u.is_active = true
    LEFT JOIN groups g2 ON p.subject_type = 'group' AND g2.id = p.subject_id
    WHERE
      (p.subject_type = 'user' AND u.id IS NOT NULL)
      OR
      (p.subject_type = 'group' AND g2.id IS NOT NULL)
    ORDER BY r.name, p.path, p.subject_type, subject_name
  `);

  return { groups, perms };
}

async function createAuthzJob(db, options = {}) {
  try {
    const { rows } = await db.query(`
      INSERT INTO authz_generation_jobs
        (status, reason, requested_by_user_id, started_at)
      VALUES ('running', $1, $2, NOW())
      RETURNING id
    `, [
      options.reason || 'manual rebuild',
      options.requestedByUserId || null,
    ]);

    return rows[0]?.id || null;
  } catch (err) {
    if (err.code !== '42P01') {
      logger.warn(`Unable to create authz generation job: ${err.message}`);
    }
    return null;
  }
}

async function finishAuthzJob(db, jobId, status, errorMessage = null) {
  if (!jobId) return;

  try {
    await db.query(`
      UPDATE authz_generation_jobs
      SET status = $2,
          error_message = $3,
          finished_at = NOW()
      WHERE id = $1
    `, [jobId, status, errorMessage]);
  } catch (err) {
    logger.warn(`Unable to finish authz generation job ${jobId}: ${err.message}`);
  }
}

function renderAuthz({ groups, perms }) {
  const lines = [
    '### GENERATED BY KONNECT - DO NOT EDIT ###',
    `### Updated: ${dayjs().toISOString()} ###`,
    '',
    '[groups]',
  ];

  for (const group of groups) {
    assertSafeIdentifier(group.name, 'group name');
    const members = String(group.members || '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);

    for (const username of members) {
      assertSafeIdentifier(username, 'username');
    }

    lines.push(`${group.name} = ${members.join(', ')}`);
  }

  const sections = new Map();

  for (const perm of perms) {
    assertSafeIdentifier(perm.repo_name, 'repository name', VALID_REPO);
    assertSafeIdentifier(perm.subject_name, 'permission subject');

    const svnPath = normalizeSvnPath(perm.path);
    const key = `${perm.repo_name}:${svnPath}`;
    const subject = perm.subject_type === 'group'
      ? `@${perm.subject_name}`
      : perm.subject_name;
    const access = permissionFor(perm);

    if (!sections.has(key)) sections.set(key, []);
    sections.get(key).push(`${subject} = ${access}`);
  }

  lines.push('', '[/]', '* =');

  for (const [section, entries] of sections.entries()) {
    lines.push('', `[${section}]`, ...entries);
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Rebuild the authz file from DB state and safely reload Apache.
 */
async function rebuildAuthzFile(db, options = {}) {
  return withDirectoryLock(apacheCfg.authzLockDir, async () => {
    const authzPath = apacheCfg.authzPath;
    const backupPath = `${authzPath}.bak`;
    const jobId = await createAuthzJob(db, options);

    logger.info('Starting authz rebuild');

    try {
      const rows = await loadAuthzRows(db);
      const content = renderAuthz(rows);

      await fse.ensureDir(path.dirname(authzPath));
      await validateAuthz(content);
      await fse.ensureFile(authzPath);
      const previous = await fse.readFile(authzPath, 'utf8').catch(() => '');

      await fs.writeFile(backupPath, previous, { encoding: 'utf8', mode: 0o640 });
      await fsyncFile(backupPath).catch(err => logger.warn(`Backup fsync failed: ${err.message}`));
      await atomicReplaceFile(authzPath, content);

      try {
        await reloadApache();
      } catch (err) {
        logger.error(`Apache reload failed after authz update; restoring previous authz: ${err.message}`);
        await atomicReplaceFile(authzPath, previous);

        try {
          await reloadApache();
        } catch (restoreErr) {
          logger.error(`Apache reload failed after authz rollback: ${restoreErr.message}`);
        }

        throw err;
      }

      await finishAuthzJob(db, jobId, 'success');
      logger.info(`Authz file rebuilt and Apache reloaded: ${authzPath}`);
      return content;

    } catch (err) {
      await finishAuthzJob(db, jobId, 'failed', err.message);
      throw err;
    }
  });
}

/**
 * Get current authz file content
 */
async function getAuthzContent() {
  try {
    return await fse.readFile(apacheCfg.authzPath, 'utf8');
  } catch {
    return '';
  }
}

module.exports = {
  ROLE_TO_AUTHZ,
  normalizeSvnPath,
  renderAuthz,
  rebuildAuthzFile,
  getAuthzContent,
  validateAuthz,
};
