-- ============================================================
-- KONNECT / SVNBridge - FINAL PRODUCTION DB SCHEMA
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

  role          VARCHAR(20) NOT NULL DEFAULT 'admin'
                CHECK (role IN ('super_admin', 'admin', 'viewer')),

  is_active     BOOLEAN      DEFAULT true,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

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

  created_at   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (repo_id, path, subject_type, subject_id)
);

-- NOTE:
-- subject_id refers to users.id OR groups.id (polymorphic design)

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
-- ACTIVITY
-- ================================
CREATE TABLE IF NOT EXISTS activity (
  id            SERIAL PRIMARY KEY,
  repo_id       INTEGER     NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  revision      INTEGER     NOT NULL,
  author        VARCHAR(64),
  message       TEXT,
  committed_at  TIMESTAMPTZ,
  paths_changed JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (repo_id, revision)
);

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

CREATE INDEX IF NOT EXISTS idx_activity_repo      ON activity(repo_id);
CREATE INDEX IF NOT EXISTS idx_activity_committed ON activity(committed_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_author    ON activity(author);

CREATE INDEX IF NOT EXISTS idx_hooks_repo         ON hooks(repo_id);

-- ================================
-- UPDATED_AT TRIGGER
-- ================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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