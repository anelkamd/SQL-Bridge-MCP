# SQL Bridge MCP - Docker Image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies for building
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build TypeScript
RUN npm run build

# Remove dev dependencies and source files
RUN npm prune --production && \
    rm -rf src/ tsconfig.json

# Set environment variables (override at runtime)
ENV NODE_ENV=production \
    MYSQL_HOST=localhost \
    MYSQL_PORT=3306 \
    MYSQL_USER=sqlbridge \
    MYSQL_PASSWORD= \
    MYSQL_DATABASE=

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "import('./dist/db.js').then(m => m.testConnection()).then(ok => process.exit(ok ? 0 : 1))" || exit 1

# Run the server
CMD ["node", "dist/index.js"]

# Labels
LABEL org.opencontainers.image.title="SQL Bridge MCP" \
      org.opencontainers.image.description="Universal MCP server for MySQL databases" \
      org.opencontainers.image.vendor="SQL Bridge Contributors" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/anelkamd/sql-bridge-mcp"
