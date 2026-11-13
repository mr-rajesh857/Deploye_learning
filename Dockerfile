# syntax=docker/dockerfile:1
# =============================================================================
# Stage 1: Build Next.js Frontend
# =============================================================================
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# Bake relative API URL into client bundle for single-URL routing
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build

# =============================================================================
# Stage 2: Production Unified Image (FastAPI + Next.js Single URL)
# =============================================================================
FROM python:3.11-slim AS production

WORKDIR /app

# Configure Environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    PORT=3000 \
    BACKEND_PORT=8000 \
    BACKEND_HOST=127.0.0.1

# Install system runtime tools (netcat for postgres wait check, curl for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    netcat-openbsd \
    postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install Node.js 20 runtime directly from official node image
COPY --from=node:20-slim /usr/local /usr/local

# Install backend Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend application source
COPY backend ./backend

# Copy frontend source and production build
COPY frontend/package*.json ./frontend/
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY frontend/next.config.mjs ./frontend/

# Copy unified server runner and entrypoint
COPY server.js ./server.js
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose unified application port (serves both UI and /api endpoints)
EXPOSE 3000

# Health check targeting unified URL
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]

