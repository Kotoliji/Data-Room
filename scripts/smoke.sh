#!/usr/bin/env sh
# End-to-end smoke test against a running stack: ./scripts/smoke.sh [base_url]
set -eu
B="${1:-http://localhost:8080}"
JAR="$(mktemp)"
CSRF="X-Requested-With: dataroom"
JSON="Content-Type: application/json"

step() { printf '%-40s' "$1"; }
ok() { echo "ok"; }
fail() { echo "FAIL: $1"; exit 1; }

step "health"
for i in $(seq 1 60); do curl -sf "$B/api/v1/health" >/dev/null && break; sleep 2; done
curl -sf "$B/api/v1/health" | grep -q '"ok"' && ok || fail "not healthy"

step "SPA served"
curl -sf "$B/s/anything" | grep -q '<div id="root">' && ok || fail "no index.html"

step "demo sign-in sets HttpOnly cookie"
curl -s -c "$JAR" -D - -o /dev/null -X POST "$B/api/v1/auth/login" -H "$JSON" \
  -d '{"email":"demo@acmecorp.dev","password":"DataRoomDemo2026"}' | grep -qi 'set-cookie: dr_session=.*HttpOnly' && ok || fail "no cookie"

step "seeded documents classified"
curl -sf -b "$JAR" "$B/api/v1/files" | grep -q '"status":"ready"' && ok || fail "no ready insights"

step "upload a file"
printf 'Lease renewal approved by the board.' > /tmp/smoke.txt
curl -sf -b "$JAR" -H "$CSRF" -F "files=@/tmp/smoke.txt" "$B/api/v1/files/upload" | grep -q 'smoke.txt' && ok || fail "upload"

step "full-text search"
sleep 2
curl -sf -b "$JAR" "$B/api/v1/files/search?q=renewal" | grep -q 'file_id' && ok || fail "search"

step "investor link + analytics"
ACCESS=$(curl -sf -X POST "$B/api/v1/public/shares/acme-investor-demo/unlock" -H "$JSON" -d '{"email":"smoke@test.dev"}' | sed 's/.*"access_token":"\([^"]*\)".*/\1/')
curl -sf -H "X-Share-Access: $ACCESS" "$B/api/v1/public/shares/acme-investor-demo/contents" | grep -q '"folders"' || fail "share contents"
LINK=$(curl -sf -b "$JAR" "$B/api/v1/shares" | sed 's/.*"id":\([0-9]*\).*/\1/' | head -1)
curl -sf -b "$JAR" "$B/api/v1/shares/$LINK/analytics" | grep -q '"viewers"' && ok || fail "analytics"

step "diligence + Q&A"
curl -sf -b "$JAR" "$B/api/v1/diligence" | grep -q '"checklist"' || fail "diligence"
curl -sf -b "$JAR" "$B/api/v1/questions?status=open" | grep -q '"open_count"' && ok || fail "questions"

step "CSRF header required"
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X POST "$B/api/v1/folders" -H "$JSON" -d '{"name":"x"}')
[ "$code" = "403" ] && ok || fail "expected 403, got $code"

step "logout ends the session"
curl -sf -b "$JAR" -c "$JAR" -X POST -H "$CSRF" "$B/api/v1/auth/logout" >/dev/null
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$B/api/v1/auth/me")
[ "$code" = "401" ] && ok || fail "expected 401, got $code"

rm -f "$JAR"
echo "smoke test passed"
