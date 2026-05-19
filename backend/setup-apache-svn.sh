#!/bin/bash
# =============================================================================
# Konnect SVN Infrastructure Setup Script
# Installs and configures Apache + mod_dav_svn for TortoiseSVN compatibility
# Run as root (sudo bash setup-apache-svn.sh)
# =============================================================================

set -e

SVN_REPOS_PATH="/svn/repos"
SVN_PASSWD_FILE="/etc/apache2/dav_svn.passwd"
SVN_AUTHZ_FILE="/etc/apache2/dav_svn.authz"
APACHE_SVN_CONF="/etc/apache2/sites-available/svn.conf"
KONNECT_API_CONF="/etc/apache2/sites-available/konnect-api.conf"
SERVER_IP="10.0.1.150"

echo "============================================="
echo "  Konnect SVN Infrastructure Setup"
echo "============================================="

# ---------------------------------------------------------------------------
# 1. Install required packages
# ---------------------------------------------------------------------------
echo ""
echo "[1/8] Installing Apache, Subversion, and mod_dav_svn..."
apt-get update -qq
apt-get install -y apache2 subversion libapache2-mod-svn apache2-utils

echo "  ✅ Packages installed"

# ---------------------------------------------------------------------------
# 2. Enable required Apache modules
# ---------------------------------------------------------------------------
echo ""
echo "[2/8] Enabling Apache modules..."
a2enmod dav
a2enmod dav_svn
a2enmod auth_basic
a2enmod authn_file
a2enmod authz_svn

echo "  ✅ Modules enabled"

# ---------------------------------------------------------------------------
# 3. Create SVN repos parent directory
# ---------------------------------------------------------------------------
echo ""
echo "[3/8] Creating SVN repository root at ${SVN_REPOS_PATH}..."
mkdir -p "${SVN_REPOS_PATH}"
chown -R www-data:www-data "${SVN_REPOS_PATH}"
chmod -R 775 "${SVN_REPOS_PATH}"

echo "  ✅ Directory created"

# ---------------------------------------------------------------------------
# 4. Create a test/initial repository (only if none exist)
# ---------------------------------------------------------------------------
echo ""
echo "[4/8] Creating test repository..."
if [ ! -d "${SVN_REPOS_PATH}/testrepo" ]; then
    svnadmin create "${SVN_REPOS_PATH}/testrepo"
    chown -R www-data:www-data "${SVN_REPOS_PATH}/testrepo"
    echo "  ✅ testrepo created"
else
    echo "  ℹ️  testrepo already exists, skipping"
fi

# ---------------------------------------------------------------------------
# 5. Create Apache SVN virtual host config
# ---------------------------------------------------------------------------
echo ""
echo "[5/8] Writing Apache SVN configuration..."

cat > "${APACHE_SVN_CONF}" << 'EOF'
# =============================================================================
# Konnect SVN Server — Apache mod_dav_svn configuration
# Serves all SVN repositories at:  http://<server>/svn/<repo-name>
# =============================================================================

<VirtualHost *:80>
    ServerName svn.konnect.local
    ServerAlias 10.0.1.150

    # -------------------------------------------------------------------------
    # SVN repositories served at /svn/
    # -------------------------------------------------------------------------
    <Location /svn>
        DAV svn

        # All repositories under this parent path are automatically served
        SVNParentPath /svn/repos

        # --- Authentication ---
        AuthType Basic
        AuthName "Konnect SVN Repository"
        AuthUserFile /etc/apache2/dav_svn.passwd

        # --- Authorization (per-repo/path ACL) ---
        AuthzSVNAccessFile /etc/apache2/dav_svn.authz

        # Require valid login for all operations
        Require valid-user
    </Location>

    # -------------------------------------------------------------------------
    # Proxy API requests to Node.js backend (port 3000)
    # Keeps everything on the same IP, separating /svn from /api
    # -------------------------------------------------------------------------
    ProxyPass /api http://127.0.0.1:3000/api
    ProxyPassReverse /api http://127.0.0.1:3000/api

    ErrorLog ${APACHE_LOG_DIR}/svn-error.log
    CustomLog ${APACHE_LOG_DIR}/svn-access.log combined
</VirtualHost>
EOF

echo "  ✅ SVN vhost config written"

# ---------------------------------------------------------------------------
# 6. Enable proxy modules if not already enabled (for API passthrough)
# ---------------------------------------------------------------------------
a2enmod proxy proxy_http 2>/dev/null || true

# ---------------------------------------------------------------------------
# 7. Create passwd and authz files
# ---------------------------------------------------------------------------
echo ""
echo "[6/8] Creating SVN password and authorization files..."

# Create passwd file with a default admin entry
# The -c flag creates the file; will prompt for password
if [ ! -f "${SVN_PASSWD_FILE}" ]; then
    echo "  Creating ${SVN_PASSWD_FILE} — you will set the admin password now:"
    htpasswd -c "${SVN_PASSWD_FILE}" admin
else
    echo "  ℹ️  ${SVN_PASSWD_FILE} already exists, skipping creation"
fi

# Create authz file for fine-grained access control
if [ ! -f "${SVN_AUTHZ_FILE}" ]; then
    cat > "${SVN_AUTHZ_FILE}" << 'AUTHZ'
# =============================================================================
# Konnect SVN Authorization File
# Format:
#   [repo:/path]
#   user = r      (read-only)
#   user = rw     (read-write)
#   * = r         (everyone read-only)
#   * =           (no access for anonymous)
# =============================================================================

[groups]
admins = admin
developers = admin

# Default: admins get full access to all repos, root level
[/]
@admins = rw
* =

# Per-repo example (uncomment and customize):
# [testrepo:/]
# @developers = rw
# * =
AUTHZ
    echo "  ✅ ${SVN_AUTHZ_FILE} created"
else
    echo "  ℹ️  ${SVN_AUTHZ_FILE} already exists, skipping"
fi

chown www-data:www-data "${SVN_PASSWD_FILE}" "${SVN_AUTHZ_FILE}" 2>/dev/null || true
chmod 640 "${SVN_PASSWD_FILE}" "${SVN_AUTHZ_FILE}" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 8. Enable site and restart Apache
# ---------------------------------------------------------------------------
echo ""
echo "[7/8] Enabling site and restarting Apache..."
a2ensite svn.conf
a2dissite 000-default.conf 2>/dev/null || true
apache2ctl configtest && systemctl restart apache2

echo "  ✅ Apache restarted"

# ---------------------------------------------------------------------------
# Done — print summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo "  ✅ Setup Complete!"
echo "============================================="
echo ""
echo "  SVN Repos root : ${SVN_REPOS_PATH}"
echo "  Test repo URL  : http://${SERVER_IP}/svn/testrepo"
echo "  Passwd file    : ${SVN_PASSWD_FILE}"
echo "  Authz file     : ${SVN_AUTHZ_FILE}"
echo ""
echo "  ➡  TortoiseSVN checkout URL:"
echo "     http://${SERVER_IP}/svn/<repo-name>"
echo ""
echo "  ➡  To add a new user:"
echo "     sudo htpasswd ${SVN_PASSWD_FILE} <username>"
echo ""
echo "  ➡  To create a new repository:"
echo "     sudo svnadmin create ${SVN_REPOS_PATH}/<repo-name>"
echo "     sudo chown -R www-data:www-data ${SVN_REPOS_PATH}/<repo-name>"
echo ""
echo "  ➡  Then update ${SVN_AUTHZ_FILE} to grant access"
echo ""
