#!/usr/bin/env bash
# Applies the migrations to a throwaway Postgres container and runs supabase/tests/rls.sql.
# Needs Docker. Uses its own container and port, and removes it at the end.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=sonorous-db-test
PORT=54329
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test -p "$PORT:5432" postgres:15-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 40); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 0.5; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
run < supabase/tests/stub.sql
for f in supabase/migrations/*.sql; do echo "applying $f"; run < "$f"; done
run < supabase/tests/rls.sql
