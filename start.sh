#!/bin/sh
set -e

echo "==> Running prisma db push..."
npx prisma db push --accept-data-loss

echo "==> Starting server..."
exec node dist/index.js
