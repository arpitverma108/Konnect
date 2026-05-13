'use strict';

/**
 * tests/sync.test.js
 * Validates FIX 3.3: unconditional SYNC_SECRET check and rate limiting.
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = 'test-secret-32-characters-long!!';

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
  SYNC_SECRET:   'my-sync-secret-value',
}));

jest.mock('../src/config/apache', () => ({
  htpasswdPath: null,
  hookNames:    [],
  hookFileName: (name) => name,
}));

process.env.SYNC_SECRET = 'my-sync-secret-value';

const request = require('supertest');
const app = require('../src/app');
const db  = require('../src/config/database');

function makeToken(role = 'admin') {
  return jwt.sign(
    { id: 1, username: 'admin', role, tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/sync — SYNC_SECRET check (FIX 3.3)', () => {
  it('should return 403 with no X-Sync-Secret header', async () => {
    const res = await request(app).post('/api/sync').send();
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/sync secret/i);
  });

  it('should return 403 with wrong X-Sync-Secret', async () => {
    const res = await request(app)
      .post('/api/sync')
      .set('X-Sync-Secret', 'wrong-secret')
      .send();
    expect(res.status).toBe(403);
  });

  it('should return 401 with correct secret but no auth token', async () => {
    const res = await request(app)
      .post('/api/sync')
      .set('X-Sync-Secret', 'my-sync-secret-value')
      .send();
    expect(res.status).toBe(401);
  });

  it('should return 403 when viewer tries to sync (wrong role)', async () => {
    const token = makeToken('viewer');
    db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });

    const res = await request(app)
      .post('/api/sync')
      .set('X-Sync-Secret', 'my-sync-secret-value')
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(403);
  });

  it('should return 200 or a valid response for admin with correct secret', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ token_version: 0, is_active: true }] });
    db.query.mockResolvedValueOnce({ rows: [] }); // no repos → controller returns its own message

    const res = await request(app)
      .post('/api/sync')
      .set('X-Sync-Secret', 'my-sync-secret-value')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send();

    // Controller returns 200 regardless of whether repos exist
    expect(res.status).toBe(200);
    // Accept either "synced" or "No repositories found" — both are valid 200 responses
    expect(res.body).toHaveProperty('message');
  });
});

describe('POST /api/sync — rate limiting', () => {
  it('should enforce 1-per-5min rate limit on same IP after repeated calls', async () => {
    // Use unique IPs to avoid bleeding from other tests
    // First call with correct secret should pass (or fail auth — either way not 429)
    const res1 = await request(app)
      .post('/api/sync')
      .set('X-Forwarded-For', '10.99.99.1')
      .set('X-Sync-Secret', 'my-sync-secret-value')
      .send();

    expect([401, 200, 403]).toContain(res1.status); // not 429

    // Second call from same IP immediately
    const res2 = await request(app)
      .post('/api/sync')
      .set('X-Forwarded-For', '10.99.99.1')
      .set('X-Sync-Secret', 'my-sync-secret-value')
      .send();

    expect(res2.status).toBe(429);
  });
});