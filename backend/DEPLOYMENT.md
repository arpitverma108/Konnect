# Konnect SVN Automation - Deployment Guide

## Overview

This guide covers deploying the production-grade SVN automation system for Konnect. The system handles:

- **Automatic user provisioning** - Users created in Konnect are automatically synced to SVN
- **Automatic repository provisioning** - Repositories are automatically created on the filesystem with proper permissions
- **Automatic authz management** - SVN permissions are dynamically generated from the database
- **Atomic file operations** - All file writes are atomic with rollback capabilities
- **Distributed locking** - Prevents concurrent corruption across multiple instances

## Prerequisites

- Ubuntu 20.04 LTS or later
- Apache 2.4+ with mod_dav_svn
- PostgreSQL 12+
- Node.js 14+
- SVN 1.10+
- Root or sudo access for system configuration

## Architecture

```
User/Repository Creation
    ↓
Konnect Application (Node.js)
    ↓
SVN Management Services
├── User Provisioning → htpasswd Sync Engine
├── Repository Provisioning → SVN Init Engine
└── Permission Updates → Authz Generation Engine
    ↓
Database (PostgreSQL)
├── svn_users
├── svn_repositories
├── svn_permissions
└── authz_generation_history
    ↓
Apache (mod_dav_svn)
├── /etc/apache2/dav_svn.passwd (generated)
├── /etc/apache2/dav_svn.authz (generated)
└── /svn/repos/* (SVN repositories)
```

## Installation Steps

### 1. System Preparation

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install required packages
sudo apt-get install -y \
  subversion \
  apache2 \
  libapache2-mod-dav-svn \
  postgresql \
  postgresql-contrib \
  nodejs \
  npm \
  git

# Enable Apache modules
sudo a2enmod dav_svn
sudo a2enmod dav
sudo a2enmod auth_digest
sudo systemctl restart apache2
```

### 2. Create System User

```bash
# Create 'konnect' service user (if not exists)
sudo useradd -r -s /bin/bash -d /var/lib/konnect konnect
sudo mkdir -p /var/lib/konnect
sudo chown konnect:konnect /var/lib/konnect
```

### 3. Run Setup Script

```bash
cd /home/arihant/Desktop/arpit/Konnect/backend

# Make scripts executable
chmod +x scripts/setup-svn.sh

# Run setup
./scripts/setup-svn.sh
```

This will:
- Create SVN repository root directory
- Initialize htpasswd and authz files
- Install Apache reload wrapper
- Configure sudoers for konnect user
- Create lock directories

### 4. Database Setup

```bash
# Run migrations to create SVN tables
npm run migrate

# Or manually:
psql -U konnect -d konnect < src/db/schema.sql
```

### 5. Environment Configuration

Add to `.env`:

```bash
# SVN Configuration
SVN_REPOS_ROOT=/svn/repos
HTPASSWD_PATH=/etc/apache2/dav_svn.passwd
AUTHZ_PATH=/etc/apache2/dav_svn.authz
APACHE_RELOAD_CMD=/usr/local/sbin/konnect-apache-reload

# SVN Binary Paths
SVNADMIN_PATH=/usr/bin/svnadmin
SVNLOOK_PATH=/usr/bin/svnlook
SVN_PATH=/usr/bin/svn
```

### 6. Start Application

```bash
# Install dependencies
npm install

# Start with PM2
pm2 start ecosystem.config.js --name konnect

# Verify it's running
pm2 status
```

### 7. Update Apache Configuration

Edit `/etc/apache2/mods-enabled/dav_svn.conf`:

```apache
<Location /svn>
  DAV svn
  SVNParentPath /svn/repos
  
  # Authentication
  AuthType Basic
  AuthName "SVN Repository"
  AuthUserFile /etc/apache2/dav_svn.passwd
  
  # Authorization
  AuthzSVNAccessFile /etc/apache2/dav_svn.authz
  
  Require valid-user
</Location>
```

### 8. Test the Setup

```bash
# Test SVN access (should fail with 401 - no users yet)
svn ls http://localhost/svn/test

# Create a test user via Konnect API
curl -X POST http://localhost:3000/api/auth/create-user \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "TestPassword123",
    "email": "test@example.com",
    "role": "viewer"
  }'

# Now SVN authentication should work
svn ls http://testuser:TestPassword123@localhost/svn/
```

## Migration from Manual Setup

If you have an existing manual htpasswd/authz setup:

### Backup Current Setup

```bash
sudo cp /etc/apache2/dav_svn.passwd /etc/apache2/dav_svn.passwd.backup
sudo cp /etc/apache2/dav_svn.authz /etc/apache2/dav_svn.authz.backup
```

### Migrate Users

```bash
# Parse existing htpasswd file and create users in Konnect
# This is a one-time operation

# For each user in the old htpasswd, create them in Konnect:
curl -X POST http://localhost:3000/api/auth/create-user \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "existing_user",
    "password": "their_password",
    "role": "viewer"
  }'
```

### Trigger Full Sync

```bash
# This regenerates both htpasswd and authz from database
curl -X POST http://localhost:3000/api/svn/sync-users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

curl -X POST http://localhost:3000/api/svn/sync-permissions \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Operations

### Admin API Endpoints

All endpoints require `super_admin` or `admin` role.

#### Manual Sync Operations

```bash
# Force htpasswd sync
POST /api/svn/sync-users
Response: { syncId, usersSynced, durationMs }

# Force authz regeneration
POST /api/svn/sync-permissions
Response: { generationId, affectedRepos, hash, durationMs }

# Get current status
GET /api/svn/sync-status
Response: { authz: {...}, htpasswd: {...} }
```

#### Repository Management

```bash
# List SVN repositories
GET /api/svn/repositories
Response: { repositories: [...], total }

# Get permissions for repository
GET /api/svn/permissions/:repositoryId
Response: { repository, permissions, total }

# Update permissions (triggers authz regeneration)
PATCH /api/svn/permissions/:repositoryId
Body: { permissions: [{ subjectType, subjectId, pathPattern, accessLevel }] }
Response: { permissionsUpdated, authzGeneration }
```

#### History & Monitoring

```bash
# View authz generation history
GET /api/svn/authz-history?limit=20&offset=0

# View htpasswd sync history
GET /api/svn/htpasswd-history?limit=20&offset=0

# List all SVN users
GET /api/svn/users
```

### Permission Structure

Example permission update:

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
      "subjectId": 2,
      "pathPattern": "/trunk",
      "accessLevel": "read-only"
    },
    {
      "subjectType": "_anonymous_",
      "subjectId": null,
      "pathPattern": "/",
      "accessLevel": "none"
    }
  ]
}
```

Access levels: `none`, `read-only`, `read-write`

## Troubleshooting

### SVN User Not Appearing in htpasswd

```bash
# Check sync status
curl -X GET http://localhost:3000/api/svn/sync-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check svn_users table
psql -U konnect -d konnect -c "SELECT * FROM svn_users;"

# Manual resync
curl -X POST http://localhost:3000/api/svn/sync-users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Verify htpasswd file
sudo cat /etc/apache2/dav_svn.passwd
```

### Authz Not Updated

```bash
# Check generation history
curl -X GET http://localhost:3000/api/svn/authz-history?limit=10 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check permissions in database
psql -U konnect -d konnect -c "SELECT * FROM svn_permissions ORDER BY repository_id, path_pattern;"

# Manual regeneration
curl -X POST http://localhost:3000/api/svn/sync-permissions \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Verify authz file
sudo cat /etc/apache2/dav_svn.authz
```

### Apache Not Reloading

```bash
# Test configuration
sudo apache2ctl configtest

# Check Apache error log
sudo tail -f /var/log/apache2/error.log

# Manual reload
sudo systemctl reload apache2

# Check lock directory
ls -la /var/lock/konnect/
```

### Repository Creation Fails

```bash
# Check logs
pm2 logs konnect

# Verify permissions on /svn/repos
ls -la /svn/repos/

# Check konnect user can sudo svnadmin
sudo -l -U konnect

# Try manual repo creation
sudo /usr/bin/svnadmin create /svn/repos/test-repo
sudo chown -R www-data:www-data /svn/repos/test-repo
sudo chmod 770 /svn/repos/test-repo
```

## Monitoring

### Logs

Monitor Konnect application logs:

```bash
pm2 logs konnect

# Or check specific log file
tail -f /var/log/konnect/app.log
```

### Database Audit Trail

```bash
# Check recent sync operations
psql -U konnect -d konnect -c \
  "SELECT * FROM authz_generation_history ORDER BY created_at DESC LIMIT 20;"

# Check recent htpasswd syncs
psql -U konnect -d konnect -c \
  "SELECT * FROM htpasswd_sync_history ORDER BY created_at DESC LIMIT 20;"

# Check admin actions
psql -U konnect -d konnect -c \
  "SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 20;"
```

### Health Check

```bash
curl http://localhost:3000/api/health
# Response: { status: "ok", timestamp: "..." }
```

## Scaling

For multiple Konnect instances:

1. **Database Lock** - Uses distributed locking (all instances compete fairly)
2. **File System** - All instances write to same `/etc/apache2/` files (atomic operations guarantee safety)
3. **SVN Repos** - Typically on shared storage or synced filesystem

Recommendations:
- Use PostgreSQL with connection pooling
- Use shared storage for `/etc/apache2/` and `/svn/repos/` OR
- Sync files across instances with rsync/NFS

## Backup & Recovery

### Daily Backup

```bash
#!/bin/bash
# /usr/local/bin/backup-konnect.sh

BACKUP_DIR=/backups/konnect
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump konnect | gzip > $BACKUP_DIR/konnect-db-$DATE.sql.gz

# Backup SVN repos (if local)
tar czf $BACKUP_DIR/svn-repos-$DATE.tar.gz /svn/repos/

# Backup config files
tar czf $BACKUP_DIR/svn-config-$DATE.tar.gz \
  /etc/apache2/dav_svn.passwd \
  /etc/apache2/dav_svn.authz

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/konnect-db-$DATE.sql.gz"
```

Add to crontab:

```bash
0 2 * * * /usr/local/bin/backup-konnect.sh
```

### Recovery

```bash
# Restore database
gunzip < /backups/konnect/konnect-db-YYYYMMDD-HHMMSS.sql.gz | psql konnect

# Restore SVN repos
tar xzf /backups/konnect/svn-repos-YYYYMMDD-HHMMSS.tar.gz -C /

# Restore config
tar xzf /backups/konnect/svn-config-YYYYMMDD-HHMMSS.tar.gz -C /

# Reload Apache
sudo systemctl reload apache2
```

## Security Hardening

### Filesystem Permissions

```bash
# SVN repositories (group readable for Apache)
sudo chmod 770 /svn/repos
sudo chown www-data:www-data /svn/repos

# htpasswd file (restricted)
sudo chmod 640 /etc/apache2/dav_svn.passwd
sudo chown www-data:www-data /etc/apache2/dav_svn.passwd

# authz file (restricted)
sudo chmod 640 /etc/apache2/dav_svn.authz
sudo chown www-data:www-data /etc/apache2/dav_svn.authz

# Lock directory
sudo chmod 755 /var/lock/konnect
sudo chown konnect:konnect /var/lock/konnect
```

### Network Security

- Restrict `/api/svn/*` endpoints to admin users only
- Use HTTPS for all connections
- Implement API rate limiting (already configured in app.js)
- Consider IP whitelisting for admin operations

### Access Control

- Only `super_admin` and `admin` roles can modify SVN settings
- Users cannot modify their own SVN permissions
- All operations logged to `admin_logs` table

## Support

For issues or questions:
1. Check logs: `pm2 logs konnect`
2. Check database audit trail: authz_generation_history, htpasswd_sync_history
3. Review troubleshooting section above
4. Check SVN repository integrity: `svnadmin verify /svn/repos/repo-name`

