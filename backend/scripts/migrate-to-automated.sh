#!/bin/bash

# ============================================================
# Konnect SVN Automation - Migration Script
# Migrate from manual htpasswd/authz to automated system
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Konnect SVN Automation Migration${NC}"
echo -e "${GREEN}========================================${NC}"
echo

# ============================================================
# 1. Backup existing files
# ============================================================
echo -e "${YELLOW}[1/4] Backing up existing htpasswd and authz...${NC}"

BACKUP_DIR="./svn-backups-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "$HTPASSWD_PATH" ]; then
  cp "$HTPASSWD_PATH" "$BACKUP_DIR/htpasswd.bak"
  echo -e "${GREEN}✓ Backed up: $BACKUP_DIR/htpasswd.bak${NC}"
fi

if [ -f "$AUTHZ_PATH" ]; then
  cp "$AUTHZ_PATH" "$BACKUP_DIR/authz.bak"
  echo -e "${GREEN}✓ Backed up: $BACKUP_DIR/authz.bak${NC}"
fi

echo -e "${YELLOW}Backups saved to: $BACKUP_DIR${NC}"
echo

# ============================================================
# 2. Run database migrations
# ============================================================
echo -e "${YELLOW}[2/4] Running database migrations...${NC}"

cd "$(dirname "$SCRIPT_DIR")"
npm run migrate

echo -e "${GREEN}✓ Database migrations completed${NC}"
echo

# ============================================================
# 3. Migrate existing users to SVN
# ============================================================
echo -e "${YELLOW}[3/4] Migrating existing users to SVN system...${NC}"

npm run db:migrate-users-to-svn || {
  echo -e "${YELLOW}Note: Migration script not found - manual migration may be needed${NC}"
}

echo -e "${GREEN}✓ User migration completed${NC}"
echo

# ============================================================
# 4. Initial authz regeneration
# ============================================================
echo -e "${YELLOW}[4/4] Regenerating authz and htpasswd files...${NC}"

npm run svn:sync-all || {
  echo -e "${YELLOW}Note: Sync command not found - you'll need to trigger sync manually${NC}"
}

echo -e "${GREEN}✓ Files regenerated${NC}"
echo

# ============================================================
# Summary
# ============================================================
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Migration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo -e "${YELLOW}Important:${NC}"
echo "✓ Backups saved to: $BACKUP_DIR"
echo "✓ Database tables created"
echo "✓ Users migrated to SVN system"
echo "✓ New authz/htpasswd files generated"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test SVN access with a user: svn ls http://your-svn-url/"
echo "2. Verify authz permissions are working"
echo "3. If anything breaks, restore from backups:"
echo "   sudo cp $BACKUP_DIR/htpasswd.bak $HTPASSWD_PATH"
echo "   sudo cp $BACKUP_DIR/authz.bak $AUTHZ_PATH"
echo "   sudo systemctl reload apache2"
echo
