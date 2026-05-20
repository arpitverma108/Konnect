'use strict';

/**
 * tests/user-create-logging.test.js
 *
 * Integration tests verifying that user creation events are logged and visible in:
 * - Activity page (/activity endpoint)
 * - Dashboard feed
 * - Audit logs with proper enrichment (category, icon, severity)
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

jest.mock('../src/config/apache', () => ({
  htpasswdPath: null,
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
  EVENT_CATEGORIES: {
    user_create: 'User Management',
  },
  EVENT_SEVERITY: {
    user_create: 'info',
  },
  EVENT_ICONS: {
    user_create: 'UserPlus',
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

function setupAuthMock(role = 'admin', tokenVersion = 0) {
  db.query.mockResolvedValueOnce({ rows: [{ token_version: tokenVersion, is_active: true }] });
}

describe('User Creation Event Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────
  // TEST 1: Verify logActivity is called during user creation
  // ─────────────────────────────────────────
  
  describe('POST /api/users logs user_create event', () => {
    it('should call logActivity with USER_CREATE event type', async () => {
      const token = makeToken({ role: 'admin' });
      setupAuthMock('admin');

      db.query
        .mockResolvedValueOnce({ rows: [] })              // no existing user
        .mockResolvedValueOnce({ rows: [{ id: 5, username: 'newuser', role: 'viewer' }] }); // insert result

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'newuser', password: 'securepass1' });

      expect(res.status).toBe(201);
      expect(logActivity).toHaveBeenCalled();
      
      const callArgs = logActivity.mock.calls[0];
      expect(callArgs[0]).toBe(db); // db object
      expect(callArgs[1]).toMatchObject({
        event_type: ACTIVITY_TYPES.USER_CREATE,
        user_id: 1, // admin user id from token
        entity: 'user',
        entity_id: 5,
      });
    });

    it('should include descriptive action message', async () => {
      const token = makeToken({ role: 'admin' });
      setupAuthMock('admin');

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 7, username: 'alice', role: 'admin' }] });

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'alice', password: 'securepass1', role: 'admin' });

      expect(res.status).toBe(201);
      
      const activityData = logActivity.mock.calls[0][1];
      expect(activityData.action).toMatch(/Created user account:.*alice.*role.*admin/i);
    });

    it('should include username and role in metadata', async () => {
      const token = makeToken({ role: 'super_admin' });
      setupAuthMock('super_admin');

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 10, username: 'bob', role: 'viewer' }] });

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          username: 'bob', 
          password: 'securepass1',
          email: 'bob@example.com',
          fullName: 'Bob Smith'
        });

      expect(res.status).toBe(201);
      
      const activityData = logActivity.mock.calls[0][1];
      expect(activityData.metadata).toMatchObject({
        username: 'bob',
        role: 'viewer',
        email: 'bob@example.com',
      });
    });
  });

  // ─────────────────────────────────────────
  // TEST 2: Verify user_create events appear in activity endpoints
  // ─────────────────────────────────────────
  
  describe('Activity endpoints return user_create events', () => {
    const adminToken = makeToken({ role: 'admin' });

    it('should return user_create events from /api/activity', async () => {
      const userCreateEvent = {
        id: 1,
        event_type: 'user_create',
        action: 'Created user account: testuser with role "viewer"',
        entity: 'user',
        entity_id: 42,
        category: 'User Management',
        severity: 'info',
        icon: 'UserPlus',
        repo_id: null,
        repo_name: null,
        created_at: new Date(),
      };

      db.query.mockResolvedValueOnce({ rows: [userCreateEvent], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?event_type=user_create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity).toHaveLength(1);
      
      const activity = response.body.activity[0];
      expect(activity.event_type).toBe('user_create');
      expect(activity.entity).toBe('user');
      expect(activity.entity_id).toBe(42);
    });

    it('should include proper enrichment fields', async () => {
      const userCreateEvent = {
        id: 2,
        event_type: 'user_create',
        action: 'Created user account: admin2 with role "admin"',
        entity: 'user',
        entity_id: 99,
        repo_id: null,
        repo_name: null,
        created_at: new Date(),
      };

      db.query.mockResolvedValueOnce({ rows: [userCreateEvent], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?event_type=user_create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const activity = response.body.activity[0];
      
      // Verify enrichment with category, severity, icon
      expect(activity.event_type).toBe('user_create');
      expect(activity.category).toBe('User Management');
      expect(activity.severity).toBe('info');
      expect(activity.icon).toBe('UserPlus');
    });

    it('should filter events by event_type user_create', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .get('/api/activity?event_type=user_create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify query was built with event_type filter
      const queryCall = db.query.mock.calls[0];
      expect(queryCall[0]).toContain('AND a.event_type');
      expect(queryCall[1]).toContain('user_create');
    });
  });

  // ─────────────────────────────────────────
  // TEST 3: Verify user_create works in mixed activity
  // ─────────────────────────────────────────
  
  describe('User_create in mixed activity feed', () => {
    const adminToken = makeToken({ role: 'admin' });

    it('should include user_create alongside other events', async () => {
      const mixedActivity = [
        {
          id: 1,
          event_type: 'commit',
          action: 'Commit message',
          entity: null,
          entity_id: null,
          revision: 100,
          author: 'john',
          created_at: new Date('2024-01-10'),
        },
        {
          id: 2,
          event_type: 'user_create',
          action: 'Created user account: newadmin with role "admin"',
          entity: 'user',
          entity_id: 50,
          revision: null,
          author: null,
          created_at: new Date('2024-01-15'),
        },
      ];

      db.query.mockResolvedValueOnce({ rows: mixedActivity, rowCount: 2 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(2);
      
      // Verify both events are present
      expect(response.body.activity).toHaveLength(2);
      
      const commitEvent = response.body.activity.find(a => a.event_type === 'commit');
      const userEvent = response.body.activity.find(a => a.event_type === 'user_create');
      
      expect(commitEvent).toBeDefined();
      expect(userEvent).toBeDefined();
      expect(userEvent.entity).toBe('user');
      expect(userEvent.entity_id).toBe(50);
    });
  });

  // ─────────────────────────────────────────
  // TEST 4: Verify activity fields are properly populated
  // ─────────────────────────────────────────
  
  describe('User_create event fields', () => {
    const adminToken = makeToken({ role: 'admin' });

    it('should have all required fields', async () => {
      const userCreateEvent = {
        id: 100,
        event_type: 'user_create',
        action: 'Created user account: finaltest with role "viewer"',
        entity: 'user',
        entity_id: 123,
        category: 'User Management',
        severity: 'info',
        icon: 'UserPlus',
        repo_id: null,
        repo_name: null,
        revision: null,
        author: null,
        created_at: new Date('2024-01-20T10:30:00Z'),
      };

      db.query.mockResolvedValueOnce({ rows: [userCreateEvent], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?event_type=user_create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const activity = response.body.activity[0];
      
      expect(activity).toHaveProperty('id', 100);
      expect(activity).toHaveProperty('event_type', 'user_create');
      expect(activity).toHaveProperty('action');
      expect(activity).toHaveProperty('entity', 'user');
      expect(activity).toHaveProperty('entity_id', 123);
      expect(activity).toHaveProperty('category', 'User Management');
      expect(activity).toHaveProperty('severity', 'info');
      expect(activity).toHaveProperty('icon', 'UserPlus');
      expect(activity).toHaveProperty('created_at');
    });
  });
});
