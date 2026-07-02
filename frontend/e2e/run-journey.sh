#!/usr/bin/env bash
# One-shot: wait out any auth rate-limit, bootstrap a fresh prod user, run the
# consumer journey (mobile), then emit teardown ids. Used by the agent only.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."   # frontend/

WAIT="${1:-0}"
if [[ "$WAIT" -gt 0 ]]; then
  echo "waiting ${WAIT}s for auth rate-limit window to clear..."
  sleep "$WAIT"
fi

eval "$(bash e2e/bootstrap.sh)"
echo "BOOTSTRAPPED user=$E2E_USER_ID email=$E2E_USER_EMAIL"
echo "TEARDOWN_ID=$E2E_USER_ID"
echo "TEARDOWN_EMAIL=$E2E_USER_EMAIL"

E2E_VERIFY_URL="$E2E_VERIFY_URL" E2E_USER_PHONE="$E2E_USER_PHONE" E2E_USER_EMAIL="$E2E_USER_EMAIL" \
  npx playwright test consumer-journey --project=mobile 2>&1
echo "JOURNEY_EXIT=$?"
