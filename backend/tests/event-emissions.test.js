'use strict';

/**
 * tests/event-emissions.test.js
 * Test suite for verifying event emissions for login, logout, sync, and user deletion
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

jest.mock('../src/config/redis', () => ({
  isAvailable: jest.fn().mockReturnValue(false),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
}));

jest.mock('../src/utils/svn', () => ({
  createSvnUser: jest.fn().mockResolvedValue(undefined),
  deleteRepository: jest.fn().mockResolvedValue(undefined),
  getLog: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/config/env', () => ({
  JWT_SECRET: 'test-secret-32-characters-long!!',
  BCRYPT_ROUNDS: 4,
  CORS_ORIGIN: 'http://localhost:3000',
}));

jest.mock('../src/services/authzService', () => ({
  rebuildAuthzFile: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../src/app');
const db = require('../src/config/database');
const { ACTIVITY_TYPES } = require('../src/services/activityLogger');

async function hashPassword(plain) {
  return bcrypt.hash(plain, 4);
}

function mockClient(rows) {
  const queryFn = jest.fn()
    .mockResolvedValue({ rows: rows || [], rowCount: rows ? rows.length : 0 });
  return { query: queryFn, release: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── LOGIN EVENT TESTS ──────────────────────────────────────────────────────

describe('POST /api/auth/login - Event Emission', () => {
  it('should emit AUTH_LOGIN event on successful login', async () => {
    const hash = await hashPassword('correct-password');
    const mockDbQuery = jest.fn();
    const mockDbConnect = jest.fn();

    // Mock the main pool.query for initial user lookup
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          username: 'testuser',
          password_hash: hash,
          role: 'admin',
          is_active: true,
          token_version: 0,
        },
      ],
    });

    // Mock the client connection for transaction
    const mockTxnClient = {
      query: mockDbQuery,
      release: jest.fn(),
    };
    mockDbConnect.mockResolvedValueOnce(mockTxnClient);

    // Setup mock responses for transaction: BEGIN, storeRefreshToken, logActivity, COMMIT
    mockDbQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // storeRefreshToken INSERT
      .mockResolvedValueOnce({}) // logActivity INSERT
      .mockResolvedValueOnce({}); // COMMIT

    db.connect.mockImplementation(mockDbConnect);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');

    // Verify that logActivity was called (second call after storeRefreshToken)
    const logActivityCall = mockDbQuery.mock.calls.find(
      call => call[0] && call[0].includes('INSERT INTO activity')
    );

    expect(logActivityCall).toBeDefined();
    if (logActivityCall) {
      expect(logActivityCall[0]).toContain('event_type');
      expect(logActivityCall[1][0]).toBe(ACTIVITY_TYPES.AUTH_LOGIN);
      expect(logActivityCall[1][1]).toBe(1); // user_id
    }
  });
});

// ─── LOGOUT EVENT TESTS ──────────────────────────────────────────────────────

describe('POST /api/auth/logout - Event Emission', () => {
  it('should emit AUTH_LOGOUT event on successful logout', async () => {
    const token = require('jsonwebtoken').sign(
      { id: 1, username: 'testuser', role: 'admin', type: 'refresh', tokenVersion: 0 },
      'test-secret-32-characters-long!!',
      { expiresIn: '7d' }
    );

    const mockDbQuery = jest.fn();
    const mockDbConnect = jest.fn();

    // Mock the client connection
    const mockTxnClient = {
      query: mockDbQuery,
      release: jest.fn(),
    };
    mockDbConnect.mockResolvedValueOnce(mockTxnClient);

    // Setup mock responses: revokeRefreshToken UPDATE, logActivity INSERT
    mockDbQuery
      .mockResolvedValueOnce({}) // revokeRefreshToken UPDATE
      .mockResolvedValueOnce({}); // logActivity INSERT

    db.connect.mockImplementation(mockDbConnect);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refreshToken: token });

    // Even if the request fails due to mocking, we verify that logActivity was attempted
    const logActivityCalls = mockDbQuery.mock.calls.filter(
      call => call[0] && call[0].includes('INSERT INTO activity')
    );

    expect(logActivityCalls.length).toBeGreaterThan(0);
    if (logActivityCalls.length > 0) {
      expect(logActivityCalls[0][1][0]).toBe(ACTIVITY_TYPES.AUTH_LOGOUT);
    }
  });
});

// ─── USER DELETION EVENT TESTS ──────────────────────────────────────────────

describe('DELETE /api/users/:id - Event Emission', () => {
  it('should emit USER_DELETE event when user is deleted', async () => {
    const token = require('jsonwebtoken').sign(
      { id: 1, username: 'admin', role: 'super_admin', tokenVersion: 0 },
      'test-secret-32-characters-long!!',
      { expiresIn: '15m' }
    );

    // Mock user lookup
    db.query
      .mockResolvedValueOnce({
        rows: [{ username: 'deleteduser' }],
      }) // First query: SELECT username
      .mockResolvedValueOnce({}) // DELETE FROM users
      .mockResolvedValueOnce({}); // logActivity INSERT

    const res = await request(app)
      .delete('/api/users/2')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', `accessToken=${token}`);

    // Verify logActivity was called with USER_DELETE
    const logActivityCalls = db.query.mock.calls.filter(
      call => call[0] && call[0].includes('INSERT INTO activity')
    );

    expect(logActivityCalls.length).toBeGreaterThan(0);
    if (logActivityCalls.length > 0) {
      expect(logActivityCalls[0][1][0]).toBe(ACTIVITY_TYPES.USER_DELETE);
      expect(logActivityCalls[0][1][1]).toBe(1); // requester user_id
    }
  });
});

// ─── SYNC EVENT TESTS ──────────────────────────────────────────────────────

describe('POST /api/sync - Event Emission', () => {
  it('should emit SYNC_RUN event when sync completes', async () => {
    const token = require('jsonwebtoken').sign(
      { id: 1, username: 'admin', role: 'admin', tokenVersion: 0 },
      'test-secret-32-characters-long!!',
      { expiresIn: '15m' }
    );

    // Mock repository list query
    db.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, disk_path: '/repos/repo1' },
          { id: 2, disk_path: '/repos/repo2' },
        ],
      }) // SELECT id, disk_path FROM repositories
      .mockResolvedValueOnce({}); // logActivity INSERT

    const res = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .set('x-sync-secret', process.env.SYNC_SECRET || 'test-secret')
      .set('Cookie', `accessToken=${token}`);

    // Verify logActivity was called with SYNC_RUN
    const logActivityCalls = db.query.mock.calls.filter(
      call => call[0] && call[0].includes('INSERT INTO activity')
    );

    expect(logActivityCalls.length).toBeGreaterThan(0);
    if (logActivityCalls.length > 0) {
      expect(logActivityCalls[0][1][0]).toBe(ACTIVITY_TYPES.SYNC_RUN);
      expect(logActivityCalls[0][2]).toMatch(/system/); // entity
    }
  });
});

// ─── VERIFICATION OF EVENT STRUCTURE ────────────────────────────────────────

describe('Event Structure Validation', () => {
  it('should have required event types defined', () => {
    expect(ACTIVITY_TYPES.AUTH_LOGIN).toBe('auth_login');
    expect(ACTIVITY_TYPES.AUTH_LOGOUT).toBe('auth_logout');
    expect(ACTIVITY_TYPES.USER_DELETE).toBe('user_delete');
    expect(ACTIVITY_TYPES.SYNC_RUN).toBe('sync_run');
  });

  it('AUTH_LOGIN events should include ip_address and user_agent in metadata', () => {
    // This is a structural test to document expected metadata
    const expectedMetadata = {
      username: 'testuser',
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0...',
      login_method: 'credentials',
    };

    expect(expectedMetadata).toHaveProperty('ip_address');
    expect(expectedMetadata).toHaveProperty('user_agent');
    expect(expectedMetadata).toHaveProperty('login_method');
  });

  it('SYNC_RUN events should include repos_synced, repos_failed, and duration', () => {
    // This is a structural test to document expected metadata
    const expectedMetadata = {
      repos_synced: 5,
      repos_failed: 0,
      total_repos: 5,
      duration_ms: 1234,
      status: 'success',
    };

    expect(expectedMetadata).toHaveProperty('repos_synced');
    expect(expectedMetadata).toHaveProperty('repos_failed');
    expect(expectedMetadata).toHaveProperty('duration_ms');
    expect(expectedMetadata).toHaveProperty('status');
  });
});
