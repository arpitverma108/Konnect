'use strict';

const { execFile }  = require('child_process');
const { promisify } = require('util');
const fse           = require('fs-extra');
const path          = require('path');

const apacheCfg     = require('../config/apache');
const logger        = require('../config/logger');

const execFileAsync = promisify(execFile);


// ─── APACHE RELOAD (PRODUCTION SAFE) ─────────────

async function reloadApache() {
  const cmd = apacheCfg.reloadCmd;

  logger.info(`Reloading Apache: ${cmd}`);

  const parts = cmd.split(/\s+/);
  const bin   = parts[0];
  const args  = parts.slice(1);

  try {
    const { stdout, stderr } = await execFileAsync(bin, args);

    if (stdout) logger.debug(`Apache stdout: ${stdout}`);
    if (stderr) logger.warn(`Apache stderr: ${stderr}`);

    logger.info('Apache reloaded successfully');

  } catch (err) {
    // 🔥 CRITICAL FIX → THROW ERROR
    logger.error('Apache reload failed:', err.message);

    throw new Error('Apache reload failed'); // ✅ IMPORTANT
  }
}


// ─── VIRTUAL HOST CONFIG ─────────────────────────

function generateVirtualHostConfig({ reposRoot, htpasswdPath, authzPath }) {

  const normalize = (p) => p.replace(/\\/g, '/');

  return `# SVNBridge — Auto-generated Apache SVN config

<Location /svn>
    DAV svn
    SVNParentPath "${normalize(reposRoot)}"

    AuthType Basic
    AuthName "SVN Repository"
    AuthUserFile "${normalize(htpasswdPath)}"

    AuthzSVNAccessFile "${normalize(authzPath)}"
    Require valid-user
</Location>
`;
}


// ─── WRITE CONFIG ───────────────────────────────

async function writeVirtualHostConfig() {

  const confPath = apacheCfg.authzPath.replace(/authz$/, 'svnbridge.conf');

  const content = generateVirtualHostConfig({
    reposRoot:    apacheCfg.reposRoot,
    htpasswdPath: apacheCfg.htpasswdPath,
    authzPath:    apacheCfg.authzPath,
  });

  await fse.ensureFile(confPath);
  await fse.writeFile(confPath, content, 'utf8');

  logger.info(`VirtualHost config written: ${confPath}`);

  return confPath;
}


// ─── APPLY CONFIG (BEST PRACTICE) ───────────────

async function applyApacheConfig() {
  try {
    await writeVirtualHostConfig();
    await reloadApache(); // 🔥 if this fails → error thrown

    logger.info('Apache config applied successfully');

  } catch (error) {
    logger.error('Failed to apply Apache config:', error.message);
    throw error; // propagate
  }
}


// ─── EXPORTS ────────────────────────────────────

module.exports = {
  reloadApache,
  generateVirtualHostConfig,
  writeVirtualHostConfig,
  applyApacheConfig
};