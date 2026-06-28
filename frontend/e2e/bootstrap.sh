#!/usr/bin/env bash
#
# bootstrap.sh — provision a disposable test user on PROD and emit the env the
# Playwright suite needs. No email, no SMS, no destructive SQL:
#
#   1. POST /api/users  (with phone)         → create a fresh +alias user whose
#                                              phone is pre-set so onboarding's
#                                              verified-phone fast-path skips OTP
#   2. POST /api/auth/magic-link             → mint a real magic-link token row
#   3. SELECT token FROM magic_links         → read it back (read-only), build URL
#
# Usage:
#   eval "$(bash e2e/bootstrap.sh)"      # exports E2E_* into your shell
#   npm run test:e2e
#
# Then tear down with:  bash e2e/teardown.sh "$E2E_USER_ID" "$E2E_USER_EMAIL"
#
# Requires: curl, psql, and DATABASE_URL in the repo-root .env (read-only use).
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
EMAIL="enatec.grp+e2e-${TS}@gmail.com"
# Fake-but-valid E.164 UK mobile, unique per run (last 9 digits of the timestamp).
PHONE="+447${TS: -9}"

# 1. Create the user WITH a phone (persisted at creation — no UPDATE).
CREATE_JSON="$(curl -s -X POST "$API/api/users" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
  -d "{\"firstName\":\"E2E\",\"lastName\":\"Tester\",\"email\":\"$EMAIL\",\"phone\":\"$PHONE\",\"track\":\"fitness\",\"goal\":\"\",\"region\":\"GB\",\"currency\":\"GBP\"}")"
USER_ID="$(printf '%s' "$CREATE_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')"
if [[ -z "$USER_ID" ]]; then echo "ERROR: user create failed: $CREATE_JSON" >&2; exit 1; fi

# 2. Mint a real magic-link token.
curl -s -X POST "$API/api/auth/magic-link" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
  -d "{\"email\":\"$EMAIL\"}" >/dev/null

# 3. Read the freshest unused token back (read-only).
TOKEN="$(psql "$DATABASE_URL" -t -A -c \
  "SELECT token FROM magic_links WHERE email='$EMAIL' AND \"usedAt\" IS NULL ORDER BY \"createdAt\" DESC LIMIT 1;")"
if [[ -z "$TOKEN" ]]; then echo "ERROR: no magic-link token for $EMAIL" >&2; exit 1; fi

VERIFY_URL="$FRONTEND/auth/verify?token=$TOKEN"

# Emit as shell exports (consume with: eval "$(bash e2e/bootstrap.sh)")
echo "export E2E_USER_ID='$USER_ID'"
echo "export E2E_USER_EMAIL='$EMAIL'"
echo "export E2E_USER_PHONE='$PHONE'"
echo "export E2E_VERIFY_URL='$VERIFY_URL'"
echo "export E2E_BASE_URL='$FRONTEND'"
