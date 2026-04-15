// apacheService.js
'use strict';

const { execFile }  = require('child_process');
const { promisify } = require('util');
const fse           = require('fs-extra');
const path          = require('path');
const apacheCfg     = require('../config/apache');
const logger        = require('../config/logger');

const execFileAsync = promisify(execFile);

/**
 * Reload Apache HTTP Server.
 * On Windows this runs 'httpd -k graceful'.
 * On Linux this is typically 'systemctl reload apache2'.
 */
async function reloadApache() {
  const cmd = apacheCfg.reloadCmd;
  logger.info(`Reloading Apache: ${cmd}`);

  // Split command into binary + args (e.g. "httpd -k graceful" -> ['httpd', '-k', 'graceful'])
  const parts = cmd.split(/\s+/);
  const bin   = parts[0];
  const args  = parts.slice(1);

  try {
    const { stdout, stderr } = await execFileAsync(bin, args);
    if (stdout) logger.debug('Apache reload stdout:', stdout);
    if (stderr) logger.debug('Apache reload stderr:', stderr);
  } catch (err) {
    // Don't throw — log warning but continue (Apache may not be installed yet)
    logger.warn('Apache reload failed (non-fatal):', err.message);
  }
}

/**
 * Generate the Apache VirtualHost snippet (svnbridge.conf).
 * This file is included from httpd.conf via:
 *   Include "C:/svn-data/conf/svnbridge.conf"
 */
function generateVirtualHostConfig({ reposRoot, htpasswdPath, authzPath }) {
  // Normalise slashes for Apache (it works with forward slashes on Windows too)
  const normalise = p => p.replace(/\\/g, '/');

  return `# SVNBridge — Auto-generated Apache SVN config
# Include this file from httpd.conf:
#   Include "${normalise(process.env.AUTHZ_PATH?.replace(/conf\/authz$/, 'conf/svnbridge.conf') || '')}"

<Location /svn>
    DAV svn
    SVNParentPath "${normalise(reposRoot)}"

    AuthType Basic
    AuthName "SVN Repository"
    AuthUserFile "${normalise(htpasswdPath)}"

    AuthzSVNAccessFile "${normalise(authzPath)}"
    Require valid-user
</Location>
`;
}

/**
 * Write the VirtualHost config to disk (next to authz/htpasswd).
 */
async function writeVirtualHostConfig() {
  const confPath = apacheCfg.authzPath.replace(/authz$/, 'svnbridge.conf');
  const content  = generateVirtualHostConfig({
    reposRoot:    apacheCfg.reposRoot,
    htpasswdPath: apacheCfg.htpasswdPath,
    authzPath:    apacheCfg.authzPath,
  });
  await fse.ensureFile(confPath);
  await fse.writeFile(confPath, content, 'utf8');
  logger.info(`VirtualHost config written: ${confPath}`);
  return confPath;
}

module.exports = { reloadApache, generateVirtualHostConfig, writeVirtualHostConfig };
