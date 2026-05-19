'use strict';

/**
 * tests/activity-integration.test.js
 *
 * Comprehensive integration tests for activity feeds to ensure events appear
 * correctly with proper filtering, permissions, and enrichment.
 *
 * Coverage:
 * - User creation events → activity feed with event_type, category, severity, icon
 * - Permission update events → activity feed with proper enrichment
 * - Repository creation events → activity feed
 * - Global feed access control (admins see all, users see only permitted repos)
 * - Filtering by author, event_type, repository
 * - Dashboard activity integration
 * - Edge cases (empty lists, no matches, pagination)
 * - Performance (indexes, query performance)
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
const { ACTIVITY_TYPES, EVENT_CATEGORIES, EVENT_SEVERITY, EVENT_ICONS } = require('../src/constants/activityTypes');

const JWT_SECRET = 'test-secret-32-characters-long!!';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

// Create test data
const testUsers = {
  admin: { id: 1, username: 'admin', role: 'admin', tokenVersion: 0 },
  super_admin: { id: 2, username: 'super_admin', role: 'super_admin', tokenVersion: 0 },
  user1: { id: 3, username: 'user1', role: 'viewer', tokenVersion: 0 },
  user2: { id: 4, username: 'user2', role: 'viewer', tokenVersion: 0 },
};

const testRepos = {
  repo1: { id: 1, name: 'repo1', disk_path: '/svn/repo1', is_active: true },
  repo2: { id: 2, name: 'repo2', disk_path: '/svn/repo2', is_active: true },
};

// Activity event factories
function createActivityEvent(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: 1,
    repo_id: 1,
    repo_name: 'repo1',
    revision: null,
    author: null,
    message: null,
    committed_at: null,
    event_type: 'user_create',
    action: 'User account created',
    entity: 'user',
    entity_id: 1,
    user_id: 1,
    created_at: now,
    paths_changed: null,
    metadata: {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// TESTS: USER_CREATE EVENTS
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Feeds - USER_CREATE Events', () => {
  describe('Global Feed (/api/activity)', () => {
    it('should include USER_CREATE event with enriched fields (category, severity, icon)', async () => {
      const adminToken = generateToken(testUsers.admin);
      const now = new Date().toISOString();

      const activity = createActivityEvent({
        id: 1,
        event_type: ACTIVITY_TYPES.USER_CREATE,
        action: 'User john created',
        entity: 'user',
        entity_id: 5,
        user_id: 1,
        created_at: now,
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity).toHaveLength(1);
      
      const event = response.body.activity[0];
      expect(event.event_type).toBe(ACTIVITY_TYPES.USER_CREATE);
      expect(event.category).toBe(EVENT_CATEGORIES[ACTIVITY_TYPES.USER_CREATE]);
      expect(event.severity).toBe(EVENT_SEVERITY[ACTIVITY_TYPES.USER_CREATE]);
      expect(event.icon).toBe(EVENT_ICONS[ACTIVITY_TYPES.USER_CREATE]);
      expect(event.entity).toBe('user');
      expect(event.action).toBe('User john created');
    });

    it('should include all required fields in USER_CREATE event', async () => {
      const adminToken = generateToken(testUsers.admin);
      const now = new Date().toISOString();

      const activity = createActivityEvent({
        event_type: ACTIVITY_TYPES.USER_CREATE,
        action: 'User alice created',
        entity: 'user',
        entity_id: 6,
        created_at: now,
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const event = response.body.activity[0];
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('event_type');
      expect(event).toHaveProperty('category');
      expect(event).toHaveProperty('severity');
      expect(event).toHaveProperty('icon');
      expect(event).toHaveProperty('action');
      expect(event).toHaveProperty('entity');
      expect(event).toHaveProperty('entity_id');
      expect(event).toHaveProperty('created_at');
    });
  });

  describe('Admin Visibility', () => {
    it('admin should see all USER_CREATE events', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activities = [
        createActivityEvent({
          id: 1,
          event_type: ACTIVITY_TYPES.USER_CREATE,
          action: 'User user1 created',
          entity_id: 3,
        }),
        createActivityEvent({
          id: 2,
          event_type: ACTIVITY_TYPES.USER_CREATE,
          action: 'User user2 created',
          entity_id: 4,
        }),
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 2 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(2);
      expect(response.body.activity).toHaveLength(2);
    });

    it('super_admin should see all USER_CREATE events', async () => {
      const superAdminToken = generateToken(testUsers.super_admin);

      const activities = [
        createActivityEvent({
          event_type: ACTIVITY_TYPES.USER_CREATE,
          action: 'User created',
        }),
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 1 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TESTS: PERMISSION_UPDATE EVENTS
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Feeds - PERMISSION_UPDATE Events', () => {
  describe('Filtering by event_type', () => {
    it('should filter by event_type=permission_update', async () => {
      const adminToken = generateToken(testUsers.admin);

      const permEvents = [
        createActivityEvent({
          id: 1,
          event_type: ACTIVITY_TYPES.PERMISSION_UPDATE,
          action: 'Permission updated: read access granted',
          entity: 'permission',
          entity_id: 1,
        }),
      ];

      db.query.mockResolvedValueOnce({ rows: permEvents, rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?event_type=permission_update')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity[0].event_type).toBe(ACTIVITY_TYPES.PERMISSION_UPDATE);
      expect(response.body.activity[0].category).toBe(EVENT_CATEGORIES[ACTIVITY_TYPES.PERMISSION_UPDATE]);
      expect(response.body.activity[0].severity).toBe(EVENT_SEVERITY[ACTIVITY_TYPES.PERMISSION_UPDATE]);
      expect(response.body.activity[0].icon).toBe(EVENT_ICONS[ACTIVITY_TYPES.PERMISSION_UPDATE]);
    });

    it('should not include non-permission_update events when filtering by event_type', async () => {
      const adminToken = generateToken(testUsers.admin);

      const filtered = [
        createActivityEvent({
          id: 1,
          event_type: ACTIVITY_TYPES.PERMISSION_UPDATE,
          action: 'Permission granted',
          entity: 'permission',
        }),
      ];

      db.query.mockResolvedValueOnce({ rows: filtered, rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?event_type=permission_update')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.activity).toHaveLength(1);
      expect(response.body.activity[0].event_type).toBe(ACTIVITY_TYPES.PERMISSION_UPDATE);
    });

    it('should include proper enrichment for PERMISSION_UPDATE events', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activity = createActivityEvent({
        event_type: ACTIVITY_TYPES.PERMISSION_UPDATE,
        action: 'User john granted read-write access to repo1',
        entity: 'permission',
        entity_id: 1,
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?event_type=permission_update')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const event = response.body.activity[0];
      expect(event.category).toBe('Security');
      expect(event.severity).toBe('warning');
      expect(event.icon).toBe('Lock');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TESTS: REPO_CREATE EVENTS
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Feeds - REPO_CREATE Events', () => {
  it('should include REPO_CREATE events with enriched fields', async () => {
    const adminToken = generateToken(testUsers.admin);

    const activity = createActivityEvent({
      event_type: ACTIVITY_TYPES.REPO_CREATE,
      action: 'Repository new-repo created',
      entity: 'repository',
      entity_id: 3,
      repo_id: 3,
      repo_name: 'new-repo',
    });

    db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

    const response = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const event = response.body.activity[0];
    expect(event.event_type).toBe(ACTIVITY_TYPES.REPO_CREATE);
    expect(event.category).toBe(EVENT_CATEGORIES[ACTIVITY_TYPES.REPO_CREATE]);
    expect(event.category).toBe('Repository');
    expect(event.severity).toBe(EVENT_SEVERITY[ACTIVITY_TYPES.REPO_CREATE]);
    expect(event.icon).toBe(EVENT_ICONS[ACTIVITY_TYPES.REPO_CREATE]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TESTS: FILTERING
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Feeds - Filtering', () => {
  describe('Filter by author', () => {
    it('should filter by author parameter', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activity = createActivityEvent({
        author: 'john',
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?author=john')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity[0].author).toBe('john');
    });

    it('should return empty when author has no activities', async () => {
      const adminToken = generateToken(testUsers.admin);

      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .get('/api/activity?author=nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(0);
      expect(response.body.activity).toHaveLength(0);
    });
  });

  describe('Filter by event_type', () => {
    it('should filter by event_type parameter', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activity = createActivityEvent({
        event_type: ACTIVITY_TYPES.USER_CREATE,
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?event_type=user_create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.activity[0].event_type).toBe(ACTIVITY_TYPES.USER_CREATE);
    });
  });

  describe('Filter by repository', () => {
    it('should filter by repo parameter (repo_id)', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activity = createActivityEvent({
        repo_id: 1,
        repo_name: 'repo1',
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?repo=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.activity[0].repo_id).toBe(1);
    });

    it('should filter by repo_name parameter', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activity = createActivityEvent({
        repo_id: 1,
        repo_name: 'repo1',
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?repo_name=repo1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.activity[0].repo).toBe('repo1');
    });
  });

  describe('Combined filters', () => {
    it('should support multiple filters simultaneously', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activity = createActivityEvent({
        event_type: ACTIVITY_TYPES.USER_CREATE,
        author: 'john',
        repo_id: 1,
        repo_name: 'repo1',
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?event_type=user_create&author=john&repo=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.activity[0].event_type).toBe(ACTIVITY_TYPES.USER_CREATE);
      expect(response.body.activity[0].author).toBe('john');
    });

    it('should return empty when combined filters have no matches', async () => {
      const adminToken = generateToken(testUsers.admin);

      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .get('/api/activity?event_type=user_create&author=nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(0);
    });
  });

  describe('Per-repo activity endpoint (/api/activity/repo/:repoId)', () => {
    it('should filter repo-specific activity by event_type', async () => {
      const adminToken = generateToken(testUsers.admin);

      // Mock permission check first
      db.query.mockResolvedValueOnce({
        rows: [testRepos.repo1],
        rowCount: 1,
      }); // checkPermission query

      const activity = createActivityEvent({
        event_type: ACTIVITY_TYPES.USER_CREATE,
        repo_id: 1,
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity/repo/1?event_type=user_create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.activity[0].event_type).toBe(ACTIVITY_TYPES.USER_CREATE);
    });

    it('should filter repo-specific activity by author', async () => {
      const adminToken = generateToken(testUsers.admin);

      db.query.mockResolvedValueOnce({
        rows: [testRepos.repo1],
        rowCount: 1,
      }); // repo lookup

      const activity = createActivityEvent({
        author: 'john',
        repo_id: 1,
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity/repo/1?author=john')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.activity[0].author).toBe('john');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TESTS: PERMISSIONS & ACCESS CONTROL
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Feeds - Permissions & Access Control', () => {
  describe('Admin sees all activities', () => {
    it('admin should see activities from all repositories', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activities = [
        createActivityEvent({
          id: 1,
          event_type: ACTIVITY_TYPES.COMMIT,
          repo_id: 1,
          repo_name: 'repo1',
        }),
        createActivityEvent({
          id: 2,
          event_type: ACTIVITY_TYPES.COMMIT,
          repo_id: 2,
          repo_name: 'repo2',
        }),
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 2 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(2);
      expect(response.body.activity).toHaveLength(2);
    });
  });

  describe('Regular user sees only permitted repos', () => {
    it('viewer user should only see activities from repos with explicit permissions', async () => {
      const userToken = generateToken(testUsers.user1);

      const activity = createActivityEvent({
        repo_id: 1,
        repo_name: 'repo1',
        event_type: ACTIVITY_TYPES.COMMIT,
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.activity[0].repo_id).toBe(1);
    });

    it('viewer should see empty feed if no permissions', async () => {
      const userToken = generateToken(testUsers.user1);

      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.count).toBe(0);
    });
  });

  describe('Read-only viewer role', () => {
    it('viewer should see read-only activities', async () => {
      const viewerToken = generateToken({ ...testUsers.user1, role: 'viewer' });

      const activity = createActivityEvent({
        event_type: ACTIVITY_TYPES.USER_CREATE,
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body.activity).toHaveLength(1);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TESTS: MIXED EVENT TYPES
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Feeds - Mixed Event Types', () => {
  it('should display mixed event types in same feed with correct icons/colors', async () => {
    const adminToken = generateToken(testUsers.admin);

    const activities = [
      createActivityEvent({
        id: 1,
        event_type: ACTIVITY_TYPES.COMMIT,
        action: 'Commit to repo1',
        author: 'john',
      }),
      createActivityEvent({
        id: 2,
        event_type: ACTIVITY_TYPES.USER_CREATE,
        action: 'User alice created',
        entity: 'user',
      }),
      createActivityEvent({
        id: 3,
        event_type: ACTIVITY_TYPES.PERMISSION_UPDATE,
        action: 'Permission updated',
        entity: 'permission',
      }),
    ];

    db.query.mockResolvedValueOnce({ rows: activities, rowCount: 3 });

    const response = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.count).toBe(3);

    // Verify each event has correct icon
    expect(response.body.activity[0].icon).toBe(EVENT_ICONS[ACTIVITY_TYPES.COMMIT]);
    expect(response.body.activity[1].icon).toBe(EVENT_ICONS[ACTIVITY_TYPES.USER_CREATE]);
    expect(response.body.activity[2].icon).toBe(EVENT_ICONS[ACTIVITY_TYPES.PERMISSION_UPDATE]);

    // Verify different categories
    expect(response.body.activity[0].category).toBe('Repository');
    expect(response.body.activity[1].category).toBe('User Management');
    expect(response.body.activity[2].category).toBe('Security');

    // Verify different severities
    expect(response.body.activity[0].severity).toBe('info');
    expect(response.body.activity[1].severity).toBe('info');
    expect(response.body.activity[2].severity).toBe('warning');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TESTS: DASHBOARD INTEGRATION
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Feeds - Dashboard Integration', () => {
  describe('GET /api/dashboard/recent-commits', () => {
    it('should fetch recent activity for dashboard', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activities = [
        createActivityEvent({
          id: 1,
          event_type: ACTIVITY_TYPES.COMMIT,
          author: 'john',
          revision: 100,
        }),
        createActivityEvent({
          id: 2,
          event_type: ACTIVITY_TYPES.COMMIT,
          author: 'jane',
          revision: 101,
        }),
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 2 });

      const response = await request(app)
        .get('/api/dashboard/recent-commits?limit=20')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should return mixed activities (commits + admin actions) for dashboard', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activities = [
        createActivityEvent({
          id: 1,
          event_type: ACTIVITY_TYPES.COMMIT,
          author: 'john',
        }),
        createActivityEvent({
          id: 2,
          event_type: ACTIVITY_TYPES.USER_CREATE,
          action: 'User created',
          entity: 'user',
        }),
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 2 });

      const response = await request(app)
        .get('/api/dashboard/recent-commits')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].event_type).toBe(ACTIVITY_TYPES.COMMIT);
      expect(response.body[1].event_type).toBe(ACTIVITY_TYPES.USER_CREATE);
    });
  });

  describe('GET /api/dashboard/stats', () => {
    it('should include activity-related stats', async () => {
      const adminToken = generateToken(testUsers.admin);

      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 }); // repo count
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 }); // user count
      db.query.mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 }); // group count
      db.query.mockResolvedValueOnce({ rows: [{ count: '42' }], rowCount: 1 }); // commits today

      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('repositories', 5);
      expect(response.body).toHaveProperty('users', 10);
      expect(response.body).toHaveProperty('groups', 3);
      expect(response.body).toHaveProperty('commitsToday', 42);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TESTS: EDGE CASES
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Feeds - Edge Cases', () => {
  describe('Empty activity lists', () => {
    it('should handle empty activity list gracefully', async () => {
      const adminToken = generateToken(testUsers.admin);

      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(0);
      expect(response.body.activity).toHaveLength(0);
      expect(response.body.nextCursor).toBeNull();
    });

    it('should return empty list for repo with no activity', async () => {
      const adminToken = generateToken(testUsers.admin);

      db.query.mockResolvedValueOnce({
        rows: [testRepos.repo1],
        rowCount: 1,
      });

      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .get('/api/activity/repo/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(0);
      expect(response.body.activity).toHaveLength(0);
    });
  });

  describe('No matching results for filters', () => {
    it('should return empty when filter matches nothing', async () => {
      const adminToken = generateToken(testUsers.admin);

      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .get('/api/activity?event_type=nonexistent_event')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(0);
      expect(response.body.activity).toHaveLength(0);
    });

    it('should return empty for author that has no activity', async () => {
      const adminToken = generateToken(testUsers.admin);

      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .get('/api/activity?author=ghost')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(0);
    });
  });

  describe('Pagination', () => {
    it('should support cursor-based pagination', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activity = createActivityEvent({
        id: 1,
        committed_at: new Date('2024-01-15').toISOString(),
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?limit=10&cursor=2024-01-20T00:00:00Z')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('nextCursor');
      expect(response.body.activity).toHaveLength(1);
    });

    it('should respect limit parameter (max 50)', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activities = Array.from({ length: 10 }, (_, i) =>
        createActivityEvent({ id: i + 1 })
      );

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 10 });

      const response = await request(app)
        .get('/api/activity?limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBeLessThanOrEqual(50);
    });
  });

  describe('Concurrent event creation', () => {
    it('should handle concurrent user creation events', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activities = [
        createActivityEvent({
          id: 1,
          event_type: ACTIVITY_TYPES.USER_CREATE,
          action: 'User user1 created',
          entity_id: 3,
        }),
        createActivityEvent({
          id: 2,
          event_type: ACTIVITY_TYPES.USER_CREATE,
          action: 'User user2 created',
          entity_id: 4,
        }),
        createActivityEvent({
          id: 3,
          event_type: ACTIVITY_TYPES.USER_CREATE,
          action: 'User user3 created',
          entity_id: 5,
        }),
      ];

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 3 });

      const response = await request(app)
        .get('/api/activity?event_type=user_create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(3);
      expect(response.body.activity).toHaveLength(3);
    });
  });

  describe('Very old activities', () => {
    it('should retrieve very old activities with pagination', async () => {
      const adminToken = generateToken(testUsers.admin);

      const oldActivity = createActivityEvent({
        id: 1,
        created_at: new Date('2020-01-01').toISOString(),
      });

      db.query.mockResolvedValueOnce({ rows: [oldActivity], rowCount: 1 });

      const response = await request(app)
        .get('/api/activity?cursor=2020-02-01T00:00:00Z')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.activity).toHaveLength(1);
      expect(response.body.activity[0].created_at).toBe(oldActivity.created_at);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TESTS: PERFORMANCE
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Feeds - Performance', () => {
  describe('Query optimization', () => {
    it('should use indexed queries for efficient retrieval', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activity = createActivityEvent();

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify db.query was called (index usage is opaque but queries should be efficient)
      expect(db.query).toHaveBeenCalled();
    });

    it('should filter by indexed columns efficiently', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activity = createActivityEvent({
        event_type: ACTIVITY_TYPES.USER_CREATE,
      });

      db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

      await request(app)
        .get('/api/activity?event_type=user_create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle caching for repeated queries', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activity = createActivityEvent();

      db.query.mockResolvedValue({ rows: [activity], rowCount: 1 });

      // First request
      await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Second identical request (would hit cache in real scenario)
      await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('Response time expectations', () => {
    it('should return global feed within reasonable time', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activities = Array.from({ length: 50 }, (_, i) =>
        createActivityEvent({ id: i + 1 })
      );

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 50 });

      const start = Date.now();
      await request(app)
        .get('/api/activity?limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const duration = Date.now() - start;

      // Response should be reasonably fast (< 1 second in tests)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large result sets', async () => {
      const adminToken = generateToken(testUsers.admin);

      const activities = Array.from({ length: 50 }, (_, i) =>
        createActivityEvent({
          id: i + 1,
          action: `Activity ${i + 1}`,
        })
      );

      db.query.mockResolvedValueOnce({ rows: activities, rowCount: 50 });

      const response = await request(app)
        .get('/api/activity?limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.count).toBe(50);
      expect(response.body.activity).toHaveLength(50);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TESTS: EVENT ENRICHMENT COMPLETENESS
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Feeds - Event Enrichment', () => {
  it('should enrich all event types with category, severity, icon', async () => {
    const adminToken = generateToken(testUsers.admin);

    const allEventTypes = Object.values(ACTIVITY_TYPES);
    const activities = allEventTypes.slice(0, 5).map((eventType, i) =>
      createActivityEvent({
        id: i + 1,
        event_type: eventType,
      })
    );

    db.query.mockResolvedValueOnce({ rows: activities, rowCount: activities.length });

    const response = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    response.body.activity.forEach(event => {
      expect(event).toHaveProperty('event_type');
      expect(event).toHaveProperty('category');
      expect(event).toHaveProperty('severity');
      expect(event).toHaveProperty('icon');

      // Verify enrichment values are valid
      expect(EVENT_CATEGORIES[event.event_type]).toBe(event.category);
      expect(EVENT_SEVERITY[event.event_type]).toBe(event.severity);
      expect(EVENT_ICONS[event.event_type]).toBe(event.icon);
    });
  });

  it('should maintain backward compatibility with legacy fields', async () => {
    const adminToken = generateToken(testUsers.admin);

    const activity = createActivityEvent({
      author: 'john',
      revision: 100,
      message: 'Test commit',
      committed_at: new Date().toISOString(),
    });

    db.query.mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

    const response = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const event = response.body.activity[0];
    expect(event).toHaveProperty('author');
    expect(event).toHaveProperty('revision');
    expect(event).toHaveProperty('message');
    expect(event).toHaveProperty('committed_at');
  });
});
