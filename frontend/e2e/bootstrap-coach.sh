#!/usr/bin/env bash
#
# bootstrap-coach.sh — provision a disposable COACH-intent test user on PROD
# and emit the env the coach-journey spec needs.
#
# Mirrors bootstrap.sh, with the two differences that define the coach funnel:
#   - role='coach' at creation (what /signup?as=coach sends)
#   - NO phone — so the server-side welcome call can never dial a fake number
#     from a test run (Day-Zero's coach branch requires a phone).
#
# Email keeps the enatec.grp+e2e- prefix so `teardown.sh --all` sweeps these too.
#
# Usage:
#   eval "$(bash e2e/bootstrap-coach.sh)"
# Teardown: bash e2e/teardown.sh "$E2E_COACH_ID" "$E2E_COACH_EMAIL"
set -euo pipefail

API="${E2E_API_URL:-https://ivykeeps-api.fly.dev}"
FRONTEND="${E2E_BASE_URL:-https://www.ivykeeps.life}"
ORIGIN="$FRONTEND"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"')"
if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL not found in $ROOT_DIR/.env" >&2
  exit 1
fi

TS="$(date +%s)"
EMAIL="enatec.grp+e2e-coach-${TS}@gmail.com"

# 1. Create the coach-intent user (exactly what the signup form sends with ?as=coach).
CREATE_JSON="$(curl -s -X POST "$API/api/users" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
  -d "{\"firstName\":\"E2E\",\"lastName\":\"Coach\",\"email\":\"$EMAIL\",\"track\":\"fitness\",\"goal\":\"\",\"region\":\"GB\",\"currency\":\"GBP\",\"role\":\"coach\"}")"
USER_ID="$(printf '%s' "$CREATE_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')"
if [[ -z "$USER_ID" ]]; then echo "ERROR: coach create failed: $CREATE_JSON" >&2; exit 1; fi

# 2. Mint a real magic-link token.
curl -s -X POST "$API/api/auth/magic-link" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
  -d "{\"email\":\"$EMAIL\"}" >/dev/null

# 3. Read the freshest unused token back (read-only).
TOKEN="$(psql "$DATABASE_URL" -t -A -c \
  "SELECT token FROM magic_links WHERE email='$EMAIL' AND \"usedAt\" IS NULL ORDER BY \"createdAt\" DESC LIMIT 1;")"
if [[ -z "$TOKEN" ]]; then echo "ERROR: no magic-link token for $EMAIL" >&2; exit 1; fi

VERIFY_URL="$FRONTEND/auth/verify?token=$TOKEN"

echo "export E2E_COACH_ID='$USER_ID'"
echo "export E2E_COACH_EMAIL='$EMAIL'"
echo "export E2E_COACH_VERIFY_URL='$VERIFY_URL'"
