// apache.js
'use strict';

const path = require('path');

module.exports = {
  get reposRoot()    { return process.env.SVN_REPOS_ROOT; },
  get htpasswdPath() { return process.env.HTPASSWD_PATH; },
  get authzPath()    { return process.env.AUTHZ_PATH; },
  get reloadCmd()    { return process.env.APACHE_RELOAD_CMD || 'httpd -k graceful'; },

  // SVN binaries
  get svnadmin() { return process.env.SVNADMIN_PATH || 'svnadmin'; },
  get svnlook()  { return process.env.SVNLOOK_PATH  || 'svnlook'; },
  get svn()      { return process.env.SVN_PATH      || 'svn'; },

  // Hook names supported
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

  // Return the OS-appropriate hook file name
  hookFileName(hookName) {
    return process.platform === 'win32'
      ? `${hookName}.bat`
      : hookName;
  },
};
'use strict';

require('dotenv').config(); // ✅ VERY IMPORTANT

// Helper to ensure env values exist
function requiredEnv(name, defaultValue = '') {
const value = process.env[name];
if (!value && !defaultValue) {
console.warn(`⚠️ Missing ENV: ${name}`);
}
return value || defaultValue;
}

module.exports = {
// ─── PATHS ─────────────────────────────────────────────

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

// ─── SVN BINARIES ──────────────────────────────────────

svnadmin: requiredEnv('SVNADMIN_PATH', 'svnadmin'),
svnlook: requiredEnv('SVNLOOK_PATH', 'svnlook'),
svn: requiredEnv('SVN_PATH', 'svn'),

// ─── HOOKS ─────────────────────────────────────────────

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
