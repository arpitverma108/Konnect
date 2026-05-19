'use strict';

/**
 * tests/activity.test.js
 * Tests for activity endpoints with filters
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

jest.mock('../src/config/redis', () => ({
  isAvailable: jest.fn().mockReturnValue(false),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
}));

jest.mock('../src/config/env', () => ({
  JWT_SECRET: 'test-secret-32-characters-long!!',
  BCRYPT_ROUNDS: 4,
  CORS_ORIGIN: 'http://localhost:3000',
}));

const app = require('../src/app');
const db = require('../src/config/database');

const JWT_SECRET = 'test-secret-32-characters-long!!';

function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

function mockClient(rows) {
  const queryFn = jest
    .fn()
    .mockResolvedValue({ rows: rows || [], rowCount: rows ? rows.length : 0 });
  return { query: queryFn, release: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Activity Endpoints', () => {
  const adminUser = { id: 1, username: 'admin', role: 'admin' };
  const adminToken = generateToken(adminUser);

  const regularUser = { id: 2, username: 'user1', role: 'viewer' };
  const regularToken = generateToken(regularUser);

  describe('GET /api/activity (global activity feed)', () => {
    it('should return activity for admin user', async () => {
      const activities = [
        {
          id: 1,
          repo_id: 1,
          repo_name: 'repo1',
          revision: 100,
          author: 'john',
          message: 'Initial commit',
          committed_at: new Date(),
          event_type: 'commit',
          action: 'Committed code',
          entity: 'commit',
          entity_id: 100,
          created_at: new Date(),
        },
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity).toHaveLength(1);
      expect(response.body.activity[0].event_type).toBe('commit');
      expect(response.body.activity[0].author).toBe('john');
      expect(response.body.activity[0].category).toBe('Repository');
    });

    it('should filter by author', async () => {
      const activities = [
        {
          id: 1,
          repo_id: 1,
          repo_name: 'repo1',
          revision: 100,
          author: 'john',
          message: 'John commit',
          committed_at: new Date(),
          event_type: 'commit',
          action: null,
          entity: null,
          entity_id: null,
          created_at: new Date(),
        },
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?author=john')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity[0].author).toBe('john');

      // Verify the query was called with author filter
      const callArgs = db.query.mock.calls[0];
      expect(callArgs[0]).toContain('AND a.author');
      expect(callArgs[1]).toContain('john');
    });

    it('should filter by event_type', async () => {
      const activities = [
        {
          id: 1,
          repo_id: 1,
          repo_name: 'repo1',
          revision: null,
          author: null,
          message: null,
          committed_at: new Date(),
          event_type: 'user_create',
          action: 'User created',
          entity: 'user',
          entity_id: 2,
          created_at: new Date(),
        },
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?event_type=user_create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity[0].event_type).toBe('user_create');
      expect(response.body.activity[0].category).toBe('User Management');

      // Verify the query was called with event_type filter
      const callArgs = db.query.mock.calls[0];
      expect(callArgs[0]).toContain('AND a.event_type');
      expect(callArgs[1]).toContain('user_create');
    });

    it('should filter by repo (by ID)', async () => {
      const activities = [
        {
          id: 1,
          repo_id: 5,
          repo_name: 'special-repo',
          revision: 100,
          author: 'john',
          message: 'commit',
          committed_at: new Date(),
          event_type: 'commit',
          action: null,
          entity: null,
          entity_id: null,
          created_at: new Date(),
        },
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?repo=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity[0].repo_id).toBe(5);

      // Verify the query was called with repo filter
      const callArgs = db.query.mock.calls[0];
      expect(callArgs[0]).toContain('AND a.repo_id');
      expect(callArgs[1]).toContain(5);
    });

    it('should filter by repo_name', async () => {
      const activities = [
        {
          id: 1,
          repo_id: 5,
          repo_name: 'special-repo',
          revision: 100,
          author: 'john',
          message: 'commit',
          committed_at: new Date(),
          event_type: 'commit',
          action: null,
          entity: null,
          entity_id: null,
          created_at: new Date(),
        },
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?repo_name=special-repo')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity[0].repo).toBe('special-repo');

      // Verify the query was called with repo_name filter
      const callArgs = db.query.mock.calls[0];
      expect(callArgs[0]).toContain('AND r.name');
      expect(callArgs[1]).toContain('special-repo');
    });

    it('should support multiple filters combined', async () => {
      const activities = [
        {
          id: 1,
          repo_id: 5,
          repo_name: 'special-repo',
          revision: 100,
          author: 'john',
          message: 'commit',
          committed_at: new Date(),
          event_type: 'commit',
          action: null,
          entity: null,
          entity_id: null,
          created_at: new Date(),
        },
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?author=john&event_type=commit&repo_name=special-repo')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);

      // Verify all filters were applied
      const callArgs = db.query.mock.calls[0];
      expect(callArgs[0]).toContain('AND a.author');
      expect(callArgs[0]).toContain('AND a.event_type');
      expect(callArgs[0]).toContain('AND r.name');
    });

    it('should include structured response fields', async () => {
      const activities = [
        {
          id: 1,
          repo_id: 1,
          repo_name: 'repo1',
          revision: 100,
          author: 'john',
          message: null,
          committed_at: new Date('2024-01-15'),
          event_type: 'permission_update',
          action: 'Permission changed',
          entity: 'permission',
          entity_id: 1,
          created_at: new Date(),
        },
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const activity = response.body.activity[0];
      expect(activity.id).toBe(1);
      expect(activity.actor).toBeUndefined(); // actor field is from username, this is author
      expect(activity.author).toBe('john');
      expect(activity.repo_name).toBe('repo1');
      expect(activity.repo).toBe('repo1');
      expect(activity.event_type).toBe('permission_update');
      expect(activity.category).toBe('Security');
      expect(activity.severity).toBe('warning');
      expect(activity.icon).toBe('Lock');
    });
  });

  describe('GET /api/activity/repo/:repoId (per-repo activity)', () => {
    it('should return activity for a specific repository with event_type filter', async () => {
      const repoId = 5;
      const repo = { id: repoId, name: 'my-repo' };
      const activities = [
        {
          id: 1,
          repo_id: repoId,
          revision: 100,
          author: 'john',
          message: 'commit message',
          committed_at: new Date(),
          paths_changed: null,
          event_type: 'commit',
          action: null,
          entity: null,
          entity_id: null,
          created_at: new Date(),
        },
      ];

      db.query
        .mockResolvedValueOnce({ rows: [repo], rowCount: 1 }) // getRepo
        .mockResolvedValueOnce({ rows: activities, rowCount: 1 }); // getActivity

      const response = await request(app)
        .get(`/api/activity/repo/${repoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.repository).toBe('my-repo');
      expect(response.body.count).toBe(1);
      expect(response.body.activity[0].event_type).toBe('commit');
    });

    it('should filter repo activity by event_type', async () => {
      const repoId = 5;
      const repo = { id: repoId, name: 'my-repo' };
      const activities = [
        {
          id: 2,
          repo_id: repoId,
          revision: null,
          author: 'admin',
          message: null,
          committed_at: new Date(),
          paths_changed: null,
          event_type: 'repo_update',
          action: 'Repository updated',
          entity: 'repository',
          entity_id: repoId,
          created_at: new Date(),
        },
      ];

      db.query
        .mockResolvedValueOnce({ rows: [repo], rowCount: 1 })
        .mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get(`/api/activity/repo/${repoId}?event_type=repo_update`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity[0].event_type).toBe('repo_update');

      // Verify event_type filter was applied
      const callArgs = db.query.mock.calls[1];
      expect(callArgs[0]).toContain('AND event_type');
      expect(callArgs[1]).toContain('repo_update');
    });

    it('should filter repo activity by author', async () => {
      const repoId = 5;
      const repo = { id: repoId, name: 'my-repo' };
      const activities = [
        {
          id: 1,
          repo_id: repoId,
          revision: 100,
          author: 'alice',
          message: 'Alice commit',
          committed_at: new Date(),
          paths_changed: null,
          event_type: 'commit',
          action: null,
          entity: null,
          entity_id: null,
          created_at: new Date(),
        },
      ];

      db.query
        .mockResolvedValueOnce({ rows: [repo], rowCount: 1 })
        .mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get(`/api/activity/repo/${repoId}?author=alice`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity[0].author).toBe('alice');

      // Verify author filter was applied
      const callArgs = db.query.mock.calls[1];
      expect(callArgs[0]).toContain('AND author');
      expect(callArgs[1]).toContain('alice');
    });

    it('should support combining author and event_type filters', async () => {
      const repoId = 5;
      const repo = { id: repoId, name: 'my-repo' };
      const activities = [
        {
          id: 1,
          repo_id: repoId,
          revision: 100,
          author: 'john',
          message: 'John commit',
          committed_at: new Date(),
          paths_changed: null,
          event_type: 'commit',
          action: null,
          entity: null,
          entity_id: null,
          created_at: new Date(),
        },
      ];

      db.query
        .mockResolvedValueOnce({ rows: [repo], rowCount: 1 })
        .mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get(`/api/activity/repo/${repoId}?author=john&event_type=commit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);

      // Verify both filters were applied
      const callArgs = db.query.mock.calls[1];
      expect(callArgs[0]).toContain('AND author');
      expect(callArgs[0]).toContain('AND event_type');
    });

    it('should return 404 for non-existent repository', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await request(app)
        .get('/api/activity/repo/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should include proper response fields', async () => {
      const repoId = 5;
      const repo = { id: repoId, name: 'my-repo' };
      const activities = [
        {
          id: 1,
          repo_id: repoId,
          revision: 100,
          author: 'john',
          message: 'commit message',
          committed_at: new Date('2024-01-15'),
          paths_changed: JSON.stringify(['file1.js', 'file2.js']),
          event_type: 'commit',
          action: null,
          entity: null,
          entity_id: null,
          created_at: new Date(),
        },
      ];

      db.query
        .mockResolvedValueOnce({ rows: [repo], rowCount: 1 })
        .mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get(`/api/activity/repo/${repoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const activity = response.body.activity[0];
      expect(activity.id).toBe(1);
      expect(activity.event_type).toBe('commit');
      expect(activity.category).toBe('Repository');
      expect(activity.severity).toBe('info');
      expect(activity.icon).toBe('GitCommit');
      expect(activity.revision).toBe(100);
      expect(activity.author).toBe('john');
    });
  });

  describe('Permission-based filtering', () => {
    it('should restrict regular user activity to permitted repos', async () => {
      // For regular users, activity is filtered by permissions
      // This test verifies the permissions subquery is used
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      // Verify the query includes the permissions subquery for regular users
      const callArgs = db.query.mock.calls[0];
      expect(callArgs[0]).toContain('WHERE a.repo_id IN');
      expect(callArgs[0]).toContain('permissions');
    });
  });
});
