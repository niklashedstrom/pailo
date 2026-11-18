#!/usr/bin/env bash
# Proves the M2b migration moves households to app members correctly.
# LOCAL ONLY: it resets the local database twice. Never point it at the cloud.
#   npm run check:m2b-move
set -euo pipefail
cd "$(dirname "$0")/.."
psql_local() { docker exec -i supabase_db_pailo psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

# Everything up to, but not including, the M2b migration.
supabase db reset --last 1 >/dev/null 2>&1
[ "$(psql_local -Atc "select max(version) from supabase_migrations.schema_migrations")" = 20261117000100 ] || { echo "Expected the M2b migration to be the last one." >&2; exit 1; }
psql_local < scripts/sql/m2b-move-before.sql
supabase migration up --local >/dev/null 2>&1
out=$(psql_local -At -F ' ' < scripts/sql/m2b-move-after.sql)
echo "$out"
supabase db reset >/dev/null 2>&1
if [ "$(grep -c ' ok$' <<<"$out")" -ne 9 ]; then
  echo "The move to app members is wrong." >&2
  exit 1
fi
echo "The move to app members is right."
