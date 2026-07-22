#!/bin/sh
set -e

# Initialize SQLite DB if not exists
if [ ! -f /app/dev.db ]; then
  echo "→ Creating database..."
  bunx prisma db push --accept-data-loss 2>/dev/null || bunx prisma db push
  echo "→ Seeding test data..."
  bun run prisma/seed.ts 2>/dev/null || echo "  (seed skipped — may already exist)"
fi

echo "→ Starting server..."
exec "$@"
