'use strict';

require('dotenv').config();

// Helper
function requiredEnv(name, defaultValue = '') {
  const value = process.env[name];
  if (!value && !defaultValue) {
    console.warn(`⚠️ Missing ENV: ${name}`);
  }
  return value || defaultValue;
}

module.exports = {

  // 🔥 ADD THIS (MOST IMPORTANT FIX)
  baseUrl: requiredEnv('SVN_BASE_URL', 'http://localhost/svn'),

  // ─── PATHS ─────────────────────────────
  reposRoot: requiredEnv('SVN_REPOS_ROOT', '/svn/repos'),

  htpasswdPath: requiredEnv(
    'HTPASSWD_PATH',
    '/etc/apache2/dav_svn.passwd'
  ),

  authzPath: requiredEnv(
    'AUTHZ_PATH',
    '/etc/apache2/dav_svn.authz'
  ),

  reloadCmd: requiredEnv(
    'APACHE_RELOAD_CMD',
    'sudo service apache2 reload'
  ),

  // ─── SVN BINARIES ─────────────────────
  svnadmin: requiredEnv('SVNADMIN_PATH', 'svnadmin'),
  svnlook: requiredEnv('SVNLOOK_PATH', 'svnlook'),
  svn: requiredEnv('SVN_PATH', 'svn'),

  // ─── HOOKS ────────────────────────────
  hookNames: [
    'pre-commit',
    'post-commit',
    'pre-revprop-change',
    'post-revprop-change',
    'pre-lock',
    'post-lock',
    'pre-unlock',
    'post-unlock',
  ],

  hookFileName(hookName) {
    return process.platform === 'win32'
      ? `${hookName}.bat`
      : hookName;
  },
};