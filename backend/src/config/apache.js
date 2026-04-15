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
