'use strict';

/**
 * tests/auth.test.js
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

jest.mock('../src/services/svnManagementService', () => ({
  provisionSvnUser: jest.fn().mockResolvedValue({ success: true }),
  updateSvnPassword: jest.fn().mockResolvedValue({ success: true }),
  deprovisionSvnUser: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../src/config/env', () => ({
  JWT_SECRET:    'test-secret-32-characters-long!!',
  BCRYPT_ROUNDS: 4,
  CORS_ORIGIN:   'http://localhost:3000',
}));

const app = require('../src/app');
const db  = require('../src/config/database');

const JWT_SECRET = 'test-secret-32-characters-long!!';

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

// ─── Registration ──────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('should return 403 — self-registration is disabled', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newuser', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/disabled/i);
  });
});

// ─── Login ────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('should return 401 for wrong password', async () => {
    const hash = await hashPassword('correct-password');
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'testuser', password_hash: hash, role: 'viewer', is_active: true, token_version: 0 }],
    });
    db.connect.mockResolvedValueOnce(mockClient([]));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('should return tokens on successful login', async () => {
    const hash = await hashPassword('correct-password');
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'testuser', password_hash: hash, role: 'admin', is_active: true, token_version: 0 }],
    });
    db.connect.mockResolvedValueOnce(mockClient([]));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.username).toBe('testuser');
  });

  it('should return 401 for inactive user (filtered by SQL WHERE is_active=true)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'inactiveuser', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('should return 401 for non-existent user', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'doesntmatter' });

    expect(res.status).toBe(401);
  });
});

// Rate limit test last — hammers the endpoint which affects shared state

describe('POST /api/auth/login — rate limiting', () => {
  it('should enforce login rate limit after 10 attempts', async () => {
    db.query.mockResolvedValue({ rows: [] });
    db.connect.mockResolvedValue(mockClient([]));

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ username: 'nobody', password: 'badpass' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'badpass' });

    expect(res.status).toBe(429);
  });
});

// ─── Refresh ──────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('should return 400 when no refresh token provided', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('should return 401 for a garbage/invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'totally.invalid.token' });
    expect(res.status).toBe(401);
  });

  it('should return 401 when token hash not found in DB', async () => {
    const token = jwt.sign(
      { id: 1, username: 'testuser', type: 'refresh', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Controller does pool.connect() then client.query() for the token lookup
    db.connect.mockResolvedValueOnce(mockClient([])); // no rows = not found

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: token });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/not found or expired/i);
  });

  it('should return 401 when token is revoked in DB', async () => {
    const token = jwt.sign(
      { id: 1, username: 'testuser', type: 'refresh', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    db.connect.mockResolvedValueOnce(mockClient([
      { revoked: true, id: 1, username: 'testuser', role: 'viewer', token_version: 0, is_active: true }
    ]));

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: token });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Token has been revoked/i);
  });

  it('should return a new access token for a valid token', async () => {
    const token = jwt.sign(
      { id: 1, username: 'testuser', type: 'refresh', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    db.connect.mockResolvedValueOnce(mockClient([
      { revoked: false, id: 1, username: 'testuser', role: 'viewer', token_version: 0, is_active: true }
    ]));

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: token });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('should return 401 when token_version mismatch (password was changed)', async () => {
    const token = jwt.sign(
      { id: 1, username: 'testuser', type: 'refresh', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // DB has version 1 (password changed after token was issued)
    db.connect.mockResolvedValueOnce(mockClient([
      { revoked: false, id: 1, username: 'testuser', role: 'viewer', token_version: 1, is_active: true }
    ]));

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: token });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Session invalidated/i);
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('should return 401 without auth header', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'sometoken' });

    expect(res.status).toBe(401);
  });

  it('should return 400 when refresh token missing from body', async () => {
    const accessToken = jwt.sign(
      { id: 1, username: 'testuser', role: 'viewer', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // auth middleware: 1 db.query
    db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });
    // logout handler: pool.connect()
    db.connect.mockResolvedValueOnce(mockClient([]));

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Refresh token required/i);
  });

  it('should successfully log out with valid tokens', async () => {
    const accessToken = jwt.sign(
      { id: 1, username: 'testuser', role: 'viewer', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { id: 1, username: 'testuser', type: 'refresh', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });
    db.connect.mockResolvedValueOnce(mockClient([]));

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });
});
