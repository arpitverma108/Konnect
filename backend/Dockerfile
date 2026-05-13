# ─────────────────────────────────────────────────────────
# SVNBridge Backend — Production Dockerfile
# FIX 4.1: Runs as non-root user, uses alpine base,
#           adds health check, excludes sensitive files.
# ─────────────────────────────────────────────────────────

FROM node:18-alpine

WORKDIR /app

# Install only production dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy application source (NOT node_modules, .env, or .git)
COPY src/ ./src/
COPY server.js ./
COPY scripts/ ./scripts/

# FIX 4.1: Run as a non-root user to limit blast radius of container escape
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

# FIX 4.1: Health check so the container manager knows when the app is ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]