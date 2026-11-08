#!/usr/bin/env bash
# Runs the MCP tool code against a real Postgres (our migrations) behind PostgREST, in throwaway containers.
# Needs Docker. Uses its own containers, network and port, and removes them at the end.
set -euo pipefail
cd "$(dirname "$0")/.."
NET=sonorous-api-test; DB=sonorous-api-db; REST=sonorous-api-rest; PORT=54330
SECRET=test-secret-test-secret-test-secret-123456
cleanup() { docker rm -f "$DB" "$REST" >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; }
cleanup; trap cleanup EXIT
docker network create "$NET" >/dev/null
docker run -d --name "$DB" --network "$NET" -e POSTGRES_PASSWORD=test postgres:15-alpine >/dev/null
for _ in $(seq 1 40); do docker exec "$DB" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 0.5; done
sleep 1
run() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
run < supabase/tests/stub.sql
for f in supabase/migrations/*.sql; do run < "$f"; done
run -c "create role authenticator login noinherit password 'test'; grant anon, authenticated to authenticator; grant execute on function auth.uid(), auth.jwt() to authenticator;"
docker run -d --name "$REST" --network "$NET" -p "$PORT:3000" \
  -e PGRST_DB_URI="postgres://authenticator:test@$DB:5432/postgres" -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$SECRET" postgrest/postgrest:v12.2.3 >/dev/null
for _ in $(seq 1 40); do curl -s "http://localhost:$PORT/" >/dev/null 2>&1 && break; sleep 0.5; done
SONOROUS_TEST_REST_URL="http://localhost:$PORT" SONOROUS_TEST_JWT_SECRET="$SECRET" SONOROUS_TEST_DB_CONTAINER="$DB" \
  pnpm exec vitest run apps/web/lib/mcp/service.integration.test.ts
