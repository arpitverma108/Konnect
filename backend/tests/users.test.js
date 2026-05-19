'use strict';

/**
 * tests/users.test.js
 *
 * Integration tests for /api/users routes.
 * Covers: list, create, update, password change, delete.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');

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
  htpasswdPath: null, // disable htpasswd syncing in tests
  hookNames:    [],
  hookFileName: (name) => name,
}));

jest.mock('../src/services/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(undefined),
  formatActivityForResponse: jest.fn((row) => row),
  getFormattedGlobalActivity: jest.fn(),
  getFormattedRepoActivity: jest.fn(),
  getFilteredActivity: jest.fn(),
  ACTIVITY_TYPES: {
    COMMIT: 'commit',
    USER_CREATE: 'user_create',
    USER_DELETE: 'user_delete',
    USER_ROLE_CHANGE: 'user_role_change',
    USER_PASSWORD_CHANGE: 'user_password_change',
  },
}));

const app = require('../src/app');
const db  = require('../src/config/database');
const { logActivity, ACTIVITY_TYPES } = require('../src/services/activityLogger');

const JWT_SECRET = 'test-secret-32-characters-long!!';

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 1, username: 'adminuser', role: 'admin', tokenVersion: 0, ...overrides },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function mockClient(queryImpl) {
  const client = {
    query:   queryImpl || jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  };
  return client;
}

// Auth middleware always passes with a valid token.
// We mock db.query for the token_version check first.
function setupAuthMock(role = 'admin', tokenVersion = 0) {
  db.query.mockResolvedValueOnce({ rows: [{ token_version: tokenVersion, is_active: true }] });
}

// ─── GET /api/users ───────────────────────────────────────────────────────

describe('GET /api/users', () => {
  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('should return 403 for viewer role', async () => {
    const token = makeToken({ role: 'viewer' });
    db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return paginated users for admin', async () => {
    const token = makeToken({ role: 'admin' });
    setupAuthMock('admin');

    db.query
      .mockResolvedValueOnce({ rows: [
        { id: 1, username: 'alice', role: 'admin', is_active: true },
        { id: 2, username: 'bob',   role: 'viewer', is_active: true },
      ]})
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });
});

// ─── POST /api/users ──────────────────────────────────────────────────────

describe('POST /api/users', () => {
  it('should reject creating super_admin by an admin', async () => {
    const token = makeToken({ role: 'admin' });
    setupAuthMock('admin');

    // No existing user
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'hacker', password: 'password123', role: 'super_admin' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot create super_admin/i);
  });

  it('should return 400 for duplicate username', async () => {
    const token = makeToken({ role: 'admin' });
    setupAuthMock('admin');

    // Existing user found
    db.query.mockResolvedValueOnce({ rows: [{ id: 99 }] });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'existinguser', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('should create a user with viewer role by default', async () => {
    const token = makeToken({ role: 'admin' });
    setupAuthMock('admin');

    db.query
      .mockResolvedValueOnce({ rows: [] })              // no existing user
      .mockResolvedValueOnce({ rows: [{ id: 5, username: 'newbie', role: 'viewer' }] }); // insert result

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newbie', password: 'securepass1' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('viewer');
    
    // Verify user creation was logged
    expect(logActivity).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        event_type: ACTIVITY_TYPES.USER_CREATE,
        user_id: 1, // admin user from token
        action: expect.stringContaining('newbie'),
        entity: 'user',
        entity_id: 5,
        metadata: expect.objectContaining({
          username: 'newbie',
          role: 'viewer',
        }),
      })
    );
  });
});

// ─── PUT /api/users/:id/password ─────────────────────────────────────────

describe('PUT /api/users/:id/password', () => {
  it('should return 403 when a viewer tries to change another user\'s password', async () => {
    const token = makeToken({ id: 10, role: 'viewer' });
    db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });

    const res = await request(app)
      .put('/api/users/99/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'newpassword123' });

    expect(res.status).toBe(403);
  });

  it('should allow a user to change their own password', async () => {
    const token = makeToken({ id: 5, role: 'viewer' });
    db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });

    // getUser query
    db.query.mockResolvedValueOnce({ rows: [{ username: 'testuser' }] });

    const client = mockClient(jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // UPDATE users (token_version++)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // UPDATE refresh_tokens (revoke all)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT
    );
    db.connect.mockResolvedValueOnce(client);

    const res = await request(app)
      .put('/api/users/5/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/invalidated/i);

    // Verify the DB transaction ran (BEGIN + UPDATE + COMMIT minimum)
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');

    // Confirm token_version increment was part of the UPDATE call
    const updateCall = client.query.mock.calls.find(
      args => typeof args[0] === 'string' && args[0].includes('token_version = token_version + 1')
    );
    expect(updateCall).toBeDefined();
  });

  it('should reject password shorter than 8 characters', async () => {
    const token = makeToken({ id: 5, role: 'viewer' });
    db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });

    const res = await request(app)
      .put('/api/users/5/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'short' });

    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────

describe('DELETE /api/users/:id', () => {
  it('should return 403 for admin role (only super_admin can delete)', async () => {
    const token = makeToken({ role: 'admin' });
    setupAuthMock('admin');

    const res = await request(app)
      .delete('/api/users/2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 when user does not exist', async () => {
    const token = makeToken({ role: 'super_admin' });
    db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });
    db.query.mockResolvedValueOnce({ rows: [] }); // user not found

    const res = await request(app)
      .delete('/api/users/999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ─── Integration: USER_CREATE events in activity feed ──────────────────────

describe('User creation events in activity feed', () => {
  it('should log user_create event with proper fields', async () => {
    const token = makeToken({ role: 'admin' });
    setupAuthMock('admin');

    db.query
      .mockResolvedValueOnce({ rows: [] })              // no existing user
      .mockResolvedValueOnce({ rows: [{ id: 10, username: 'testuser', role: 'admin' }] }); // insert result

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'testuser', password: 'securepass123', role: 'admin' });

    expect(res.status).toBe(201);

    // Verify logActivity was called with USER_CREATE event
    expect(logActivity).toHaveBeenCalled();
    const call = logActivity.mock.calls[logActivity.mock.calls.length - 1];
    const activityData = call[1];

    expect(activityData.event_type).toBe(ACTIVITY_TYPES.USER_CREATE);
    expect(activityData.action).toContain('testuser');
    expect(activityData.entity).toBe('user');
    expect(activityData.entity_id).toBe(10);
    expect(activityData.metadata.username).toBe('testuser');
    expect(activityData.metadata.role).toBe('admin');
  });

  it('should include email in activity metadata when provided', async () => {
    const token = makeToken({ role: 'super_admin' });
    setupAuthMock('super_admin');

    db.query
      .mockResolvedValueOnce({ rows: [] })              // no existing user
      .mockResolvedValueOnce({ rows: [{ id: 15, username: 'emailuser', role: 'viewer' }] }); // insert result

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ 
        username: 'emailuser', 
        password: 'securepass123',
        email: 'test@example.com',
        fullName: 'Test User'
      });

    expect(res.status).toBe(201);

    // Verify activity includes email metadata
    expect(logActivity).toHaveBeenCalled();
    const call = logActivity.mock.calls[logActivity.mock.calls.length - 1];
    const activityData = call[1];

    expect(activityData.metadata.email).toBe('test@example.com');
  });
});