#!/bin/sh
set -e

echo "===================================================="
echo "🚀 Starting Employee Leave Management System..."
echo "===================================================="

wait_for_postgres() {
  echo "⏳ Waiting for PostgreSQL to be ready..."

  # Extract DB_HOST and DB_PORT from DATABASE_URL if available
  if [ -n "$DATABASE_URL" ]; then
    # Extract host: everything between @ and : (or / if no port)
    DB_HOST_DERIVED=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:/]*\).*/\1/p')
    DB_PORT_DERIVED=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    DB_HOST="${DB_HOST:-$DB_HOST_DERIVED}"
    DB_PORT="${DB_PORT:-${DB_PORT_DERIVED:-5432}}"
  fi

  TARGET_HOST="${DB_HOST:-postgres}"
  TARGET_PORT="${DB_PORT:-5432}"

  echo "   Target DB: ${TARGET_HOST}:${TARGET_PORT}"

  max_attempts=30
  attempt=0
  until nc -z -w 2 "$TARGET_HOST" "$TARGET_PORT" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
      echo "❌ PostgreSQL did not become ready at ${TARGET_HOST}:${TARGET_PORT} in time."
      echo "   Troubleshooting hints:"
      echo "   - If running with Docker Compose: ensure the 'postgres' service is running ('docker compose up')."
      echo "   - If running standalone 'docker run': pass your DB URL via -e DATABASE_URL=... or set -e SKIP_DB_WAIT=true."
      exit 1
    fi
    echo "   Waiting for PostgreSQL... (attempt $attempt/$max_attempts - waiting for DB initial startup)"
    sleep 2
  done
  echo "✅ PostgreSQL is reachable!"
}

# Wait for DB if DATABASE_URL or DB_HOST is set
if [ -n "$DATABASE_URL" ] || [ -n "$DB_HOST" ]; then
  wait_for_postgres
fi

# Run Database Seeder / Schema Creation
echo ""
echo "🌱 Initializing database schema & default seeds..."
(cd /app/backend && python3 -c "from app.seed import seed_database; seed_database()") || {
  echo "⚠️  Database initialization check completed with notice (continuing)."
}

echo ""
echo "✅ Initialization complete!"
echo "🎯 Starting production unified server..."
echo ""

exec node /app/server.js

