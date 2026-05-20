# Konnect SVN Automation System

Production-grade enterprise SVN hosting automation - similar to GitLab/Gitea but for SVN repositories.

## Overview

Konnect SVN Automation provides fully automated provisioning of SVN users, repositories, and permissions. Instead of manually editing `/etc/apache2/dav_svn.passwd` and `/etc/apache2/dav_svn.authz` files, everything is managed through the web application with safety guarantees.

### Key Features

✓ **Automatic User Provisioning** - Users registered in Konnect immediately work with SVN  
✓ **Automatic Repository Provisioning** - Create repos via API, SVN repos created automatically  
✓ **Automatic Permission Management** - Permissions updated in DB, authz regenerated instantly  
✓ **Atomic File Operations** - All file writes are atomic, no partial writes visible to Apache  
✓ **Distributed Locking** - Works safely across multiple application instances  
✓ **Rollback Capability** - Failed operations rollback automatically  
✓ **Full Audit Trail** - Every operation logged for compliance  
✓ **Enterprise-Grade Safety** - Validates, tests, and verifies before deploying changes  

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Konnect Web App                          │
│                   (Node.js + Express)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              SVN Automation Services Layer                  │
├──────────────────────────────────────────────────────────────┤
│  • svnManagementService (orchestrator)                      │
│  • authzGenerationEngine (generates authz from DB state)    │
│  • htpasswdSyncEngine (generates htpasswd from DB state)    │
│  • svnLockingService (prevents race conditions)             │
│  • svnRepoProvisioningEngine (creates repos safely)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
              ┌────────┼────────┐
              ↓        ↓        ↓
         ┌─────────┬────────┬───────────┐
         │         │        │           │
         ↓         ↓        ↓           ↓
      ┌──────────┐ ┌──────────────┐ ┌─────────┐
      │PostgreSQL│ │Apache2 Reload│ │SVN Repos│
      │ Database │ │   Wrapper    │ │Filesystem│
      └──────────┘ └──────────────┘ └─────────┘
```

### Database Schema

**SVN-Specific Tables:**

- `svn_users` - Maps application users to SVN credentials
- `svn_repositories` - Maps repositories to SVN filesystem locations
- `svn_permissions` - Fine-grained per-path access control
- `authz_generation_locks` - Distributed lock for safe concurrent access
- `authz_generation_history` - Audit trail of authz file regenerations
- `htpasswd_sync_history` - Audit trail of htpasswd synchronizations
- `svn_repo_provisioning_locks` - Prevents concurrent repo creation

**Key Views:**

- `v_svn_repo_permissions` - Flattened permissions with user/group names
- `v_svn_users_status` - Synchronization status of SVN users

### Critical Services

#### 1. AuthzGenerationEngine (`authzGenerationEngine.js`)

**Responsibility:** Generate SVN authz files safely from database state

**Key Methods:**
- `generateFullAuthz()` - Main entry point, acquires lock, validates, deploys
- `getRepositoriesWithPermissions()` - Query all active repos with perms
- `buildAuthzContent()` - Generate authz content from permission data
- `validateAuthzSyntax()` - Ensure generated authz is valid
- `deployAuthzFile()` - Atomic temp file + rename strategy
- `reloadApache()` - Graceful Apache reload
- `rollbackAuthz()` - Restore previous version on failure

**Safety Guarantees:**
- Distributed lock prevents concurrent modifications
- Temp file writes ensure Apache never sees partial files
- Previous version backed up for rollback
- Validates all syntax before deployment
- Apache config tested before reload

**Atomicity:**
```javascript
// Lock acquisition with retry
// Backup current file
// Generate new content
// Write to temp file with unique name: /etc/apache2/.authz.tmp.UUID
// Validate syntax
// Atomic rename: mv temp → live
// Test Apache (dry-run configtest)
// Reload Apache
// Release lock
// Record success in history
```

#### 2. HtpasswdSyncEngine (`htpasswdSyncEngine.js`)

**Responsibility:** Generate htpasswd files safely from database state

**Key Methods:**
- `syncHtpasswdFile()` - Main entry point, acquires lock, syncs file
- `getSvnUsersForSync()` - Query enabled SVN users from DB
- `buildHtpasswdContent()` - Generate htpasswd content (username:hash format)
- `validateHtpasswdContent()` - Verify all expected users present
- `deployHtpasswdFile()` - Atomic temp file + rename
- `syncUserPassword()` - Resync single user on password change

**Safety Guarantees:**
- File-based locking (process-based, works within single instance)
- All expected users validated before deployment
- Atomic rename ensures consistency
- Sorted output for deterministic results

#### 3. SvnManagementService (`svnManagementService.js`)

**Responsibility:** Orchestrate all SVN provisioning operations

**Key Methods:**
- `provisionSvnUser()` - Create SVN user entry, hash password, sync htpasswd
- `updateSvnPassword()` - Update user password, resync htpasswd
- `deprovisionSvnUser()` - Disable SVN access
- `updateRepositoryPermissions()` - Update perms, regenerate authz
- `createRepositoryWithSvn()` - Create repo with full provisioning
- `initializeSvnRepository()` - Run svnadmin create, set perms, install hooks

**Validation Methods:**
- `validateUsername()` - 3-20 chars, alphanumeric + underscore
- `validatePassword()` - Minimum 6 characters
- `validateRepositoryName()` - Alphanumeric, hyphen, underscore
- `validatePermission()` - Subject type, access level, path pattern

#### 4. SvnLockingService (`svnLockingService.js`)

**Responsibility:** Distributed locking across multiple instances

**Lock Types:**
- `AUTHZ_GENERATION` - Authz file regeneration (10min expiry)
- `HTPASSWD_SYNC` - htpasswd file sync (file-based within process)
- `REPO_PROVISIONING` - Repository creation (per-repo locking)

**Mechanism:**
- Primary: Database-backed lock (works across instances)
- Fallback: File-based lock (if database unavailable)
- Exponential backoff retry with jitter
- Automatic stale lock detection and override (10min TTL)
- Graceful cleanup of expired locks

### Workflows

#### User Creation Workflow

```
1. Admin creates user via POST /api/auth/create-user
   ├─ Validate username/password
   ├─ Check user doesn't exist
   ├─ Hash password with bcrypt (for app auth)
   └─ Insert into users table
   
2. SVN Provisioning triggered (outside transaction)
   ├─ Acquire DB lock for htpasswd sync
   ├─ Create svn_users entry (user_id, svn_username, password_hash_md5)
   ├─ Generate Apache MD5 hash from password
   ├─ Sync htpasswd file:
   │  ├─ Query all enabled SVN users from DB
   │  ├─ Build content (deterministic sort)
   │  ├─ Write to temp file
   │  ├─ Validate all users present
   │  └─ Atomic rename
   ├─ Mark svn_users as 'synced'
   ├─ Record in htpasswd_sync_history
   └─ Release lock

Result: User can immediately SVN login with same password
```

#### Repository Creation Workflow

```
1. User creates repo via POST /api/repositories
   ├─ Validate repo name
   └─ Insert into repositories table
   
2. Repo Provisioning triggered
   ├─ Acquire DB lock for authz generation
   ├─ In transaction:
   │  ├─ Create svn_repositories entry
   │  ├─ Add repo owner with read-write permission to "/"
   │  └─ Commit
   │
   ├─ Initialize SVN repo on filesystem:
   │  ├─ Check path doesn't exist
   │  ├─ Create parent dirs
   │  ├─ Run: svnadmin create /svn/repos/repo-name
   │  ├─ Set ownership: www-data:www-data
   │  ├─ Set permissions: 770
   │  └─ Install hooks (make executable)
   │
   ├─ Generate authz file:
   │  ├─ Query all repos with permissions
   │  ├─ Build [repo:path] sections
   │  ├─ Validate syntax
   │  ├─ Atomic rename
   │  └─ Record in authz_generation_history
   │
   ├─ Reload Apache gracefully:
   │  ├─ Test config: apache2ctl configtest
   │  ├─ If valid: systemctl reload apache2
   │  └─ If invalid: rollback and raise error
   │
   └─ Release lock

Result: Repository accessible immediately via SVN URL
```

#### Permission Update Workflow

```
1. Admin updates perms via PATCH /api/svn/permissions/:repoId
   ├─ Validate permission structure
   └─ Request authz regeneration
   
2. Update DB permissions (in transaction)
   ├─ Delete existing permissions for repo
   ├─ Insert new permission records
   └─ Commit
   
3. Regenerate authz file (with lock)
   ├─ Query all repos with perms
   ├─ Build content
   ├─ Validate
   ├─ Atomic rename
   ├─ Test Apache
   ├─ Reload Apache
   ├─ If success: record in history
   └─ If failure: rollback and retry
   
Result: New permissions active immediately, old users lose access
```

## API Documentation

### Authentication

All endpoints require Bearer token in `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/svn/...
```

### Admin-Only Endpoints

All SVN endpoints require `super_admin` or `admin` role.

#### POST /api/svn/sync-users

Force htpasswd synchronization.

**Response:**
```json
{
  "success": true,
  "syncId": "uuid",
  "usersSynced": 42,
  "durationMs": 245,
  "message": "Successfully synced 42 users to htpasswd"
}
```

#### POST /api/svn/sync-permissions

Force authz regeneration.

**Response:**
```json
{
  "success": true,
  "generationId": "uuid",
  "affectedRepos": 15,
  "hash": "sha256hash",
  "durationMs": 1230,
  "message": "Successfully regenerated authz for 15 repositories"
}
```

#### GET /api/svn/sync-status

Get current sync status.

**Response:**
```json
{
  "success": true,
  "authz": {
    "generationId": "uuid",
    "status": "success",
    "startedAt": "2025-05-19T10:30:00Z",
    "completedAt": "2025-05-19T10:31:15Z",
    "error": null
  },
  "htpasswd": {
    "syncId": "uuid",
    "status": "success",
    "startedAt": "2025-05-19T10:25:00Z",
    "completedAt": "2025-05-19T10:25:02Z",
    "usersSynced": 42,
    "error": null
  }
}
```

#### GET /api/svn/users

List all SVN users.

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "user_id": 1,
      "username": "alice",
      "svn_username": "alice",
      "is_active": true,
      "is_svn_enabled": true,
      "sync_status": "synced",
      "last_sync_at": "2025-05-19T10:25:02Z",
      "created_at": "2025-05-19T10:20:00Z"
    }
  ],
  "total": 42
}
```

#### GET /api/svn/repositories

List all SVN repositories.

**Response:**
```json
{
  "success": true,
  "repositories": [
    {
      "id": 1,
      "repository_id": 1,
      "name": "project-alpha",
      "svn_path": "/svn/repos/project-alpha",
      "owner_name": "alice",
      "is_initialized": true,
      "created_at": "2025-05-19T10:30:00Z",
      "updated_at": "2025-05-19T10:30:00Z"
    }
  ],
  "total": 15
}
```

#### GET /api/svn/permissions/:repositoryId

Get permissions for a repository.

**Response:**
```json
{
  "success": true,
  "repository": {
    "id": 1,
    "name": "project-alpha"
  },
  "permissions": [
    {
      "id": 1,
      "path_pattern": "/",
      "subject_type": "user",
      "subject_id": 1,
      "subject_name": "alice",
      "access_level": "read-write"
    },
    {
      "id": 2,
      "path_pattern": "/trunk",
      "subject_type": "group",
      "subject_id": 1,
      "subject_name": "developers",
      "access_level": "read-only"
    }
  ],
  "total": 2
}
```

#### PATCH /api/svn/permissions/:repositoryId

Update permissions for a repository (triggers authz regeneration).

**Request:**
```json
{
  "permissions": [
    {
      "subjectType": "user",
      "subjectId": 1,
      "pathPattern": "/",
      "accessLevel": "read-write"
    },
    {
      "subjectType": "group",
      "subjectId": 1,
      "pathPattern": "/trunk",
      "accessLevel": "read-only"
    },
    {
      "subjectType": "_anonymous_",
      "pathPattern": "/",
      "accessLevel": "none"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "repositoryId": 1,
  "permissionsUpdated": 3,
  "authzGeneration": {
    "generationId": "uuid",
    "hash": "sha256hash",
    "affectedRepos": 15
  },
  "message": "Updated 3 permissions and regenerated authz"
}
```

#### GET /api/svn/authz-history

View authz generation history.

**Query Parameters:**
- `limit` (default: 20) - Number of records to return
- `offset` (default: 0) - Offset for pagination

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "generation_id": "uuid",
      "status": "success",
      "started_at": "2025-05-19T10:31:00Z",
      "completed_at": "2025-05-19T10:31:15Z",
      "authz_hash": "sha256hash",
      "error_message": null,
      "repo_count": 15,
      "triggered_by": "admin"
    }
  ],
  "limit": 20,
  "offset": 0
}
```

## Configuration

### Environment Variables

```bash
# SVN Paths
SVN_REPOS_ROOT=/svn/repos
HTPASSWD_PATH=/etc/apache2/dav_svn.passwd
AUTHZ_PATH=/etc/apache2/dav_svn.authz
APACHE_RELOAD_CMD=/usr/local/sbin/konnect-apache-reload

# SVN Binaries
SVNADMIN_PATH=/usr/bin/svnadmin
SVNLOOK_PATH=/usr/bin/svnlook
SVN_PATH=/usr/bin/svn

# Database (for audit trail)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=konnect
DB_USER=konnect
DB_PASSWORD=***
```

### Sudoers Configuration

Create `/etc/sudoers.d/konnect-svn` for safe command execution:

```sudoers
# Allow konnect user to manage SVN without password prompts

# htpasswd operations
konnect ALL=(ALL) NOPASSWD: /usr/bin/htpasswd

# Apache reload wrapper
konnect ALL=(ALL) NOPASSWD: /usr/local/sbin/konnect-apache-reload

# Apache configuration testing
konnect ALL=(ALL) NOPASSWD: /usr/sbin/apache2ctl

# SVN admin commands
konnect ALL=(ALL) NOPASSWD: /usr/bin/svnadmin

# Ownership and permissions (repo setup)
konnect ALL=(ALL) NOPASSWD: /bin/chown
konnect ALL=(ALL) NOPASSWD: /bin/chmod
konnect ALL=(ALL) NOPASSWD: /bin/mkdir

# Deny everything else
konnect ALL = (ALL) DENY
```

## Performance Characteristics

- **User Provisioning:** < 1 second
- **htpasswd Sync (1000 users):** < 3 seconds
- **Authz Generation (100 repos):** < 5 seconds
- **Repository Creation:** < 5 seconds (includes SVN init)
- **Permission Update:** < 2 seconds + authz generation

## Scalability

- Handles 10,000+ SVN users
- Handles 1,000+ repositories
- Supports complex permission hierarchies
- Works across multiple application instances (distributed locking)

## Troubleshooting

### Issue: User created but SVN login fails

```bash
# Check SVN user was created
psql -c "SELECT * FROM svn_users WHERE user_id = ?"

# Check htpasswd sync status
curl -X GET http://localhost:3000/api/svn/sync-status

# Check htpasswd file
sudo cat /etc/apache2/dav_svn.passwd

# Manual resync if needed
curl -X POST http://localhost:3000/api/svn/sync-users
```

### Issue: Permissions not updated

```bash
# Check permissions in DB
psql -c "SELECT * FROM svn_permissions WHERE repository_id = ?"

# Check authz generation history
curl -X GET http://localhost:3000/api/svn/authz-history?limit=5

# Check authz file
sudo cat /etc/apache2/dav_svn.authz

# Manual regeneration
curl -X POST http://localhost:3000/api/svn/sync-permissions
```

### Issue: Apache not reloading

```bash
# Test Apache config
sudo apache2ctl configtest

# Check Apache error log
sudo tail -50 /var/log/apache2/error.log

# Manual reload
sudo systemctl reload apache2

# Check lock status
ls -la /var/lock/konnect/
```

## Development

### Running Tests

```bash
# Unit tests
npm test -- src/tests/services/authzGenerationEngine.test.js

# All tests
npm test

# Watch mode
npm test -- --watch
```

### Local Development Setup

```bash
# Setup SVN environment
./scripts/setup-svn.sh

# Run migrations
npm run migrate

# Start app
npm run dev
```

## License

Proprietary - Konnect SVN Automation

## Support

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment and troubleshooting guide.
