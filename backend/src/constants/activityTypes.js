'use strict';

/**
 * Activity Event Types
 * Used to categorize and filter activity feed entries
 */

const ACTIVITY_TYPES = {
  // SVN Commit Events
  COMMIT: 'commit',
  BRANCH_CREATE: 'branch_create',
  BRANCH_DELETE: 'branch_delete',
  TAG_CREATE: 'tag_create',
  TAG_DELETE: 'tag_delete',
  REPO_INIT: 'repo_init',

  // Repository Management
  REPO_CREATE: 'repo_create',
  REPO_DELETE: 'repo_delete',
  REPO_UPDATE: 'repo_update',

  // Permission Management
  PERMISSION_UPDATE: 'permission_update',
  PERMISSION_DELETE: 'permission_delete',

  // User Management
  USER_CREATE: 'user_create',
  USER_DELETE: 'user_delete',
  USER_ROLE_CHANGE: 'user_role_change',
  USER_PASSWORD_CHANGE: 'user_password_change',

  // Authentication
  AUTH_LOGIN: 'auth_login',
  AUTH_LOGOUT: 'auth_logout',

  // System Operations
  SYNC_RUN: 'sync_run',
  AUTHZ_REBUILD: 'authz_rebuild',
};

/**
 * Event categories for frontend rendering
 */
const EVENT_CATEGORIES = {
  commit: 'Repository',
  branch_create: 'Repository',
  branch_delete: 'Repository',
  tag_create: 'Repository',
  tag_delete: 'Repository',
  repo_init: 'Repository',
  repo_create: 'Repository',
  repo_delete: 'Repository',
  repo_update: 'Repository',
  permission_update: 'Security',
  permission_delete: 'Security',
  user_create: 'User Management',
  user_delete: 'User Management',
  user_role_change: 'User Management',
  user_password_change: 'User Management',
  auth_login: 'Authentication',
  auth_logout: 'Authentication',
  sync_run: 'System',
  authz_rebuild: 'System',
};

/**
 * Event severity levels for frontend rendering
 */
const EVENT_SEVERITY = {
  commit: 'info',
  branch_create: 'info',
  branch_delete: 'warning',
  tag_create: 'info',
  tag_delete: 'warning',
  repo_init: 'info',
  repo_create: 'info',
  repo_delete: 'critical',
  repo_update: 'info',
  permission_update: 'warning',
  permission_delete: 'warning',
  user_create: 'info',
  user_delete: 'warning',
  user_role_change: 'warning',
  user_password_change: 'info',
  auth_login: 'info',
  auth_logout: 'info',
  sync_run: 'info',
  authz_rebuild: 'warning',
};

/**
 * Event icons for frontend rendering
 */
const EVENT_ICONS = {
  commit: 'GitCommit',
  branch_create: 'GitBranch',
  branch_delete: 'GitBranch',
  tag_create: 'Tag',
  tag_delete: 'Tag',
  repo_init: 'Inbox',
  repo_create: 'FolderPlus',
  repo_delete: 'Trash2',
  repo_update: 'Edit3',
  permission_update: 'Lock',
  permission_delete: 'LockOpen',
  user_create: 'UserPlus',
  user_delete: 'UserX',
  user_role_change: 'Shield',
  user_password_change: 'Key',
  auth_login: 'LogIn',
  auth_logout: 'LogOut',
  sync_run: 'RefreshCw',
  authz_rebuild: 'Settings',
};

module.exports = {
  ACTIVITY_TYPES,
  EVENT_CATEGORIES,
  EVENT_SEVERITY,
  EVENT_ICONS,
};
