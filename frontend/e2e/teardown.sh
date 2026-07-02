#!/usr/bin/env bash
#
# teardown.sh — hard-delete a disposable E2E user (and its magic-link rows) from
# PROD. User FK relations cascade; magic_links key on email, so they're cleared
# explicitly.
#
# Usage:
#   bash e2e/teardown.sh "$E2E_USER_ID" "$E2E_USER_EMAIL"
#   bash e2e/teardown.sh --all          # sweep every enatec.grp+e2e-* test user
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"')"

if [[ "${1:-}" == "--all" ]]; then
  echo "Sweeping all enatec.grp+e2e-* test users…" >&2
  psql "$DATABASE_URL" -q -c \
    "DELETE FROM magic_links WHERE email LIKE 'enatec.grp+e2e-%';"
  psql "$DATABASE_URL" -q -c \
    "DELETE FROM users WHERE email LIKE 'enatec.grp+e2e-%';"
  echo "Done." >&2
  exit 0
fi

USER_ID="${1:-}"
USER_EMAIL="${2:-}"
if [[ -z "$USER_ID" ]]; then echo "Usage: teardown.sh <userId> [email] | --all" >&2; exit 1; fi

[[ -n "$USER_EMAIL" ]] && psql "$DATABASE_URL" -q -c \
  "DELETE FROM magic_links WHERE email='$USER_EMAIL';"
psql "$DATABASE_URL" -q -c "DELETE FROM users WHERE id='$USER_ID';"
echo "Deleted user $USER_ID" >&2
