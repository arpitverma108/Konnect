-- ============================================================
-- SVNBridge - PRODUCTION DB SCHEMA (v2 - Security Hardened)
-- ============================================================

-- ================================
-- USERS (Auth + RBAC)
-- ================================
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(64)  UNIQUE NOT NULL,
  email         VARCHAR(255),
  full_name     VARCHAR(128),

  password_hash TEXT NOT NULL,

  role          VARCHAR(20) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('super_admin', 'admin', 'viewer')),

  is_active     BOOLEAN      DEFAULT true,

  -- FIX 3.5: token_version used to invalidate all sessions on password change
  token_version INTEGER      NOT NULL DEFAULT 0,

  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ================================
-- REFRESH TOKENS (FIX 3.1)
-- Stores hashed refresh tokens in DB so they are revocable
-- even when Redis is unavailable.
-- ================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  token_hash  TEXT UNIQUE NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ================================
-- GROUPS
-- ================================
CREATE TABLE IF NOT EXISTS groups (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(64)  UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ================================
-- GROUP MEMBERS
-- ================================
CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- ================================
-- REPOSITORIES
-- ================================
CREATE TABLE IF NOT EXISTS repositories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(128) UNIQUE NOT NULL,
  description TEXT,
  disk_path   VARCHAR(512) NOT NULL,
  is_active   BOOLEAN      DEFAULT true,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ================================
-- PERMISSIONS
-- ================================
CREATE TABLE IF NOT EXISTS permissions (
  id           SERIAL PRIMARY KEY,
  repo_id      INTEGER     NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path         VARCHAR(512) DEFAULT '/',

  subject_type VARCHAR(8)  NOT NULL
               CHECK (subject_type IN ('user','group')),

  subject_id   INTEGER     NOT NULL,

  permission   VARCHAR(4)  NOT NULL
               CHECK (permission IN ('r','rw','')),

  role         VARCHAR(20)
               CHECK (role IN ('owner','maintainer','developer','viewer')),

  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (repo_id, path, subject_type, subject_id)
);

ALTER TABLE permissions
  ADD COLUMN IF NOT EXISTS role VARCHAR(20);

ALTER TABLE permissions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'permissions_role_check'
  ) THEN
    ALTER TABLE permissions
      ADD CONSTRAINT permissions_role_check
      CHECK (role IN ('owner','maintainer','developer','viewer'));
  END IF;
END $$;

-- ================================
-- HOOKS
-- ================================
CREATE TABLE IF NOT EXISTS hooks (
  id          SERIAL PRIMARY KEY,
  repo_id     INTEGER     NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  hook_name   VARCHAR(64) NOT NULL,
  content     TEXT        NOT NULL DEFAULT '',
  is_enabled  BOOLEAN     DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (repo_id, hook_name)
);

-- ================================
-- ACTIVITY (Extended for structured events)
-- ================================
CREATE TABLE IF NOT EXISTS activity (
  id            SERIAL PRIMARY KEY,
  repo_id       INTEGER     REFERENCES repositories(id) ON DELETE CASCADE,
  revision      INTEGER,
  author        VARCHAR(64),
  message       TEXT,
  committed_at  TIMESTAMPTZ,
  paths_changed JSONB,
  
  -- Structured event fields
  event_type    VARCHAR(50) DEFAULT 'commit',
  action        TEXT,
  entity        VARCHAR(50),
  entity_id     INTEGER,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata      JSONB DEFAULT '{}',
  
  created_at    TIMESTAMPTZ DEFAULT NOW()

);

-- Add new columns to existing activity table if they don't exist
ALTER TABLE activity
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT 'commit',
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS entity VARCHAR(50),
  ADD COLUMN IF NOT EXISTS entity_id INTEGER,
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add indexes for efficient event querying
CREATE INDEX IF NOT EXISTS idx_activity_event_type ON activity(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity(entity, entity_id);

-- ================================
-- ADMIN LOGS (IMPORTANT)
-- ================================
CREATE TABLE IF NOT EXISTS admin_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      VARCHAR(50),
  entity_id   INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- INDEXES
-- ================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_permissions_repo   ON permissions(repo_id);
CREATE INDEX IF NOT EXISTS idx_permissions_subj   ON permissions(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_permissions_repo_path ON permissions(repo_id, path);
CREATE INDEX IF NOT EXISTS idx_permissions_repo_role ON permissions(repo_id, role);

CREATE INDEX IF NOT EXISTS idx_activity_repo      ON activity(repo_id);
CREATE INDEX IF NOT EXISTS idx_activity_committed ON activity(committed_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_author    ON activity(author);

-- Partial unique index: only enforce uniqueness where BOTH repo_id AND revision
-- are non-NULL (i.e. SVN commits).  System events (user_create, login, sync…)
-- have NULL repo_id/revision and must NOT be blocked by a uniqueness constraint.
-- We DROP the old blanket constraint first in case this schema is applied to an
-- existing DB; the DO NOTHING is a no-op on a fresh install.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'activity_repo_id_revision_key'
  ) THEN
    ALTER TABLE activity DROP CONSTRAINT activity_repo_id_revision_key;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_svn_unique
  ON activity (repo_id, revision)
  WHERE repo_id IS NOT NULL AND revision IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hooks_repo         ON hooks(repo_id);

-- ================================
-- AUTHZ GENERATION JOBS
-- Tracks regenerated SVN authz state. Useful for production audit,
-- monitoring, and recovery after reload failures.
-- ================================
CREATE TABLE IF NOT EXISTS authz_generation_jobs (
  id            BIGSERIAL PRIMARY KEY,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','success','failed')),
  reason        TEXT,
  requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authz_jobs_status_created
  ON authz_generation_jobs(status, created_at DESC);

-- ================================
-- READABLE ID VIEWS
-- These views keep application compatibility with existing id columns while
-- giving humans explicit names like user_id, repository_id, permission_id.
-- ================================
CREATE OR REPLACE VIEW v_users AS
SELECT
  id AS user_id,
  username,
  email,
  full_name,
  role AS platform_role,
  is_active,
  created_at,
  updated_at
FROM users;

CREATE OR REPLACE VIEW v_repositories AS
SELECT
  id AS repository_id,
  name AS repository_name,
  description,
  disk_path,
  is_active,
  created_at
FROM repositories;

CREATE OR REPLACE VIEW v_groups AS
SELECT
  id AS group_id,
  name AS group_name,
  description,
  created_at
FROM groups;

CREATE OR REPLACE VIEW v_repository_permissions AS
SELECT
  p.id AS permission_id,
  p.repo_id AS repository_id,
  r.name AS repository_name,
  p.path AS svn_path,
  p.subject_type,
  CASE WHEN p.subject_type = 'user' THEN p.subject_id END AS user_id,
  CASE WHEN p.subject_type = 'group' THEN p.subject_id END AS group_id,
  CASE p.subject_type
    WHEN 'user' THEN u.username
    WHEN 'group' THEN g.name
  END AS subject_name,
  p.role AS repository_role,
  p.permission AS svn_access,
  p.created_at,
  p.updated_at
FROM permissions p
JOIN repositories r ON r.id = p.repo_id
LEFT JOIN users u ON p.subject_type = 'user' AND u.id = p.subject_id
LEFT JOIN groups g ON p.subject_type = 'group' AND g.id = p.subject_id;

-- ================================
-- UPDATED_AT TRIGGER
-- ================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at'
      AND pg_get_function_arguments(p.oid) = ''
  ) THEN
    CREATE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

-- USERS trigger
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- HOOKS trigger
DROP TRIGGER IF EXISTS trg_hooks_updated_at ON hooks;
CREATE TRIGGER trg_hooks_updated_at
  BEFORE UPDATE ON hooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- PERMISSIONS trigger
DROP TRIGGER IF EXISTS trg_permissions_updated_at ON permissions;
CREATE TRIGGER trg_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================
-- CLEANUP EXPIRED REFRESH TOKENS (run periodically via cron)
-- ================================
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true;

-- ============================================================
-- SVN AUTOMATION TABLES (Enterprise-Grade Provisioning)
-- ============================================================

-- ================================
-- SVN_USERS (SVN Authentication)
-- Extends users table with SVN-specific data
-- ================================
CREATE TABLE IF NOT EXISTS svn_users (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  svn_username       VARCHAR(64) NOT NULL UNIQUE,
  password_hash_md5  TEXT NOT NULL, -- Apache MD5 format for htpasswd
  last_sync_at       TIMESTAMPTZ,
  sync_status        VARCHAR(20) DEFAULT 'pending'
                     CHECK (sync_status IN ('pending', 'synced', 'failed')),
  is_svn_enabled     BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_svn_users_user_id ON svn_users(user_id);
CREATE INDEX IF NOT EXISTS idx_svn_users_svn_username ON svn_users(svn_username);
CREATE INDEX IF NOT EXISTS idx_svn_users_sync_status ON svn_users(sync_status);
CREATE INDEX IF NOT EXISTS idx_svn_users_enabled ON svn_users(is_svn_enabled);

-- ================================
-- SVN_REPOSITORIES (SVN Repository Metadata)
-- Extends repositories table with SVN-specific data
-- ================================
CREATE TABLE IF NOT EXISTS svn_repositories (
  id                 SERIAL PRIMARY KEY,
  repository_id      INTEGER NOT NULL UNIQUE REFERENCES repositories(id) ON DELETE CASCADE,
  svn_path           VARCHAR(512) NOT NULL UNIQUE,
  owner_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_initialized     BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_svn_repositories_repo_id ON svn_repositories(repository_id);
CREATE INDEX IF NOT EXISTS idx_svn_repositories_owner_id ON svn_repositories(owner_id);
CREATE INDEX IF NOT EXISTS idx_svn_repositories_path ON svn_repositories(svn_path);

-- ================================
-- SVN_PERMISSIONS (Fine-Grained Access Control)
-- Per-path, per-subject (user/group) access control
-- ================================
CREATE TABLE IF NOT EXISTS svn_permissions (
  id                 SERIAL PRIMARY KEY,
  repository_id      INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  subject_type       VARCHAR(20) NOT NULL
                     CHECK (subject_type IN ('user', 'group', '_anonymous_')),
  subject_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  -- For group-based permissions, subject_id references group ID (not enforced by FK to avoid ambiguity)
  path_pattern       VARCHAR(512) DEFAULT '/',
  access_level       VARCHAR(20) NOT NULL DEFAULT 'none'
                     CHECK (access_level IN ('none', 'read-only', 'read-write')),
  inherited_from_group BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (repository_id, path_pattern, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_svn_permissions_repo ON svn_permissions(repository_id);
CREATE INDEX IF NOT EXISTS idx_svn_permissions_subject ON svn_permissions(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_svn_permissions_path ON svn_permissions(path_pattern);
CREATE INDEX IF NOT EXISTS idx_svn_permissions_access ON svn_permissions(access_level);

-- ================================
-- AUTHZ_GENERATION_LOCKS (Distributed Concurrency Control)
-- Prevents concurrent authz regeneration (critical for safety)
-- ================================
CREATE TABLE IF NOT EXISTS authz_generation_locks (
  id                 SERIAL PRIMARY KEY,
  lock_id            UUID NOT NULL UNIQUE,
  acquired_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL,
  holder             VARCHAR(255), -- Node identifier for debugging
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authz_locks_lock_id ON authz_generation_locks(lock_id);
CREATE INDEX IF NOT EXISTS idx_authz_locks_expires ON authz_generation_locks(expires_at);

-- ================================
-- AUTHZ_GENERATION_HISTORY (Audit Trail)
-- Records all authz file regenerations for audit + recovery
-- ================================
CREATE TABLE IF NOT EXISTS authz_generation_history (
  id                 SERIAL PRIMARY KEY,
  generation_id      UUID NOT NULL UNIQUE,
  started_at         TIMESTAMPTZ NOT NULL,
  completed_at       TIMESTAMPTZ,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'success', 'failed', 'rolled_back')),
  authz_hash         VARCHAR(64), -- SHA256 of generated file
  error_message      TEXT,
  affected_repos     INTEGER[] DEFAULT '{}',
  triggered_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authz_history_id ON authz_generation_history(generation_id);
CREATE INDEX IF NOT EXISTS idx_authz_history_status ON authz_generation_history(status);
CREATE INDEX IF NOT EXISTS idx_authz_history_created ON authz_generation_history(created_at DESC);

-- ================================
-- HTPASSWD_SYNC_HISTORY (htpasswd Synchronization Audit)
-- Tracks all htpasswd file synchronizations
-- ================================
CREATE TABLE IF NOT EXISTS htpasswd_sync_history (
  id                 SERIAL PRIMARY KEY,
  sync_id            UUID NOT NULL UNIQUE,
  started_at         TIMESTAMPTZ NOT NULL,
  completed_at       TIMESTAMPTZ,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'success', 'failed')),
  users_synced       INTEGER DEFAULT 0,
  users_failed       TEXT[] DEFAULT '{}',
  error_message      TEXT,
  triggered_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_htpasswd_sync_id ON htpasswd_sync_history(sync_id);
CREATE INDEX IF NOT EXISTS idx_htpasswd_sync_status ON htpasswd_sync_history(status);
CREATE INDEX IF NOT EXISTS idx_htpasswd_sync_created ON htpasswd_sync_history(created_at DESC);

-- ================================
-- SVN_REPO_PROVISIONING_LOCKS (Repository Provisioning Locks)
-- Prevents concurrent repository creation from corrupting filesystem
-- ================================
CREATE TABLE IF NOT EXISTS svn_repo_provisioning_locks (
  id                 SERIAL PRIMARY KEY,
  repository_id      INTEGER NOT NULL UNIQUE REFERENCES repositories(id) ON DELETE CASCADE,
  lock_id            UUID NOT NULL UNIQUE,
  acquired_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL,
  holder             VARCHAR(255),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_svn_repo_locks_repo_id ON svn_repo_provisioning_locks(repository_id);
CREATE INDEX IF NOT EXISTS idx_svn_repo_locks_expires ON svn_repo_provisioning_locks(expires_at);

-- ================================
-- VIEWS FOR SVN MANAGEMENT
-- ================================

-- View: Flattened SVN repository permissions with user/group names
CREATE OR REPLACE VIEW v_svn_repo_permissions AS
SELECT
  p.id AS permission_id,
  p.repository_id,
  r.name AS repository_name,
  r.disk_path,
  p.path_pattern,
  p.subject_type,
  p.subject_id,
  CASE
    WHEN p.subject_type = 'user' THEN u.username
    WHEN p.subject_type = 'group' THEN g.name
    WHEN p.subject_type = '_anonymous_' THEN '_anonymous_'
  END AS subject_name,
  p.access_level,
  p.inherited_from_group,
  p.created_at,
  p.updated_at
FROM svn_permissions p
JOIN repositories r ON r.id = p.repository_id
LEFT JOIN users u ON p.subject_type = 'user' AND u.id = p.subject_id
LEFT JOIN groups g ON p.subject_type = 'group' AND p.subject_id = g.id;

-- View: SVN users with synchronized status
CREATE OR REPLACE VIEW v_svn_users_status AS
SELECT
  su.id AS svn_user_id,
  u.id AS user_id,
  u.username,
  su.svn_username,
  u.is_active,
  su.is_svn_enabled,
  su.sync_status,
  su.last_sync_at,
  CASE
    WHEN NOT u.is_active THEN 'user_disabled'
    WHEN NOT su.is_svn_enabled THEN 'svn_disabled'
    WHEN su.sync_status = 'synced' THEN 'ready'
    ELSE su.sync_status
  END AS effective_status
FROM svn_users su
JOIN users u ON u.id = su.user_id;

-- ================================
-- TRIGGER: Update svn_users.updated_at
-- ================================
DROP TRIGGER IF EXISTS trg_svn_users_updated_at ON svn_users;
CREATE TRIGGER trg_svn_users_updated_at
  BEFORE UPDATE ON svn_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: Update svn_repositories.updated_at
DROP TRIGGER IF EXISTS trg_svn_repositories_updated_at ON svn_repositories;
CREATE TRIGGER trg_svn_repositories_updated_at
  BEFORE UPDATE ON svn_repositories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: Update svn_permissions.updated_at
DROP TRIGGER IF EXISTS trg_svn_permissions_updated_at ON svn_permissions;
CREATE TRIGGER trg_svn_permissions_updated_at
  BEFORE UPDATE ON svn_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
