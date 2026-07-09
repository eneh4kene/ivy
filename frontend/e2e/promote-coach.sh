#!/usr/bin/env bash
#
# promote-coach.sh — flip a disposable E2E user's tier to COACH, standing in for
# the Stripe subscription webhook (the e2e suite never drives real checkout —
# same policy as the consumer journey). Guarded to e2e test users only.
#
# Usage: bash e2e/promote-coach.sh <userId>
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"')"

USER_ID="${1:-}"
if [[ -z "$USER_ID" ]]; then echo "Usage: promote-coach.sh <userId>" >&2; exit 1; fi

# The email LIKE guard makes this script incapable of touching a real user.
UPDATED="$(psql "$DATABASE_URL" -t -A -c \
  "UPDATE users SET \"subscriptionTier\"='COACH', \"subscriptionStatus\"='active' \
   WHERE id='$USER_ID' AND email LIKE 'enatec.grp+e2e-%' RETURNING id;")"
if [[ -z "$UPDATED" ]]; then echo "ERROR: no e2e user with id $USER_ID" >&2; exit 1; fi
echo "Promoted $USER_ID to COACH" >&2
