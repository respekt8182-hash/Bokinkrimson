#!/usr/bin/env sh
set -eu

echo "Applying Prisma migrations..."
npm run db:deploy

echo "Starting Next.js on 0.0.0.0:${PORT:-3000}..."
exec npm run start -- --hostname 0.0.0.0 --port "${PORT:-3000}"
