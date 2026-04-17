
-- SVNBridge PostgreSQL Schema
-- Run: psql -U svnbridge_user -d svnbridge -f schema.sql

-- ───────────────────────────────────────────────────────────────────────────
-- Users
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(64)  UNIQUE NOT NULL,
  email       VARCHAR(255),
  full_name   VARCHAR(128),
  is_active   BOOLEAN      DEFAULT true,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────────
-- Groups
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(64)  UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Group memberships (many-to-many)
CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Repositories
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repositories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(128) UNIQUE NOT NULL,
  description TEXT,
  disk_path   VARCHAR(512) NOT NULL,
  is_active   BOOLEAN      DEFAULT true,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────────
-- Permissions
-- subject_type: 'user' | 'group'
-- permission:   'r' | 'rw' | '' (explicitly denied)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id           SERIAL PRIMARY KEY,
  repo_id      INTEGER     NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path         VARCHAR(512) DEFAULT '/',
  subject_type VARCHAR(8)  NOT NULL CHECK (subject_type IN ('user','group')),
  subject_id   INTEGER     NOT NULL,
  permission   VARCHAR(4)  NOT NULL CHECK (permission IN ('r','rw','')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (repo_id, path, subject_type, subject_id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Hooks
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hooks (
  id          SERIAL PRIMARY KEY,
  repo_id     INTEGER     NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  hook_name   VARCHAR(64) NOT NULL,
  content     TEXT        NOT NULL DEFAULT '',
  is_enabled  BOOLEAN     DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (repo_id, hook_name)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Activity / Commit Log
-- ───────────────────────────────────────────────────────────────────────────
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

-- ───────────────────────────────────────────────────────────────────────────
-- Indexes
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_permissions_repo   ON permissions(repo_id);
CREATE INDEX IF NOT EXISTS idx_permissions_subj   ON permissions(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_activity_repo      ON activity(repo_id);
CREATE INDEX IF NOT EXISTS idx_activity_committed ON activity(committed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hooks_repo         ON hooks(repo_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Auto-update updated_at on users
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_hooks_updated_at ON hooks;
CREATE TRIGGER trg_hooks_updated_at
  BEFORE UPDATE ON hooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
