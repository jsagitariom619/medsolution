#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
mkdir -p "$tmp_dir/bin"

cat > "$tmp_dir/bin/psql" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$PGUSER" == 'supabase_read_only_user.lirfjvsqpetdfryywefq' ]]
[[ "$PGHOST" == 'db-1.example.pooler.supabase.com' ]]
[[ "$PGSSLMODE" == 'require' ]]
[[ ! "${SUPABASE_DB_URL_RO+x}" == 'x' ]]
[[ "$(stat -c '%a' "$PGPASSFILE")" == '600' ]]
grep -Fq "$TEST_EXPECTED_CREDENTIAL" "$PGPASSFILE"
printf '%s\n' "$PGPASSFILE" > "$TEST_PASSFILE_PATH"
if [[ "$TEST_EXPECT_JIT" == '1' ]]; then
  [[ "${PGOPTIONS:-}" == '-c jit=on' ]]
else
  [[ ! "${PGOPTIONS+x}" == 'x' ]]
fi
printf 'ok|temp=false\n'
MOCK

cat > "$tmp_dir/bin/pg_dump" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "${1:-}" == '--version' ]]; then
  echo 'pg_dump (PostgreSQL) 17.11'
  exit 0
fi
[[ "$PGUSER" == 'supabase_read_only_user.lirfjvsqpetdfryywefq' ]]
[[ ! "${SUPABASE_DB_URL_RO+x}" == 'x' ]]
[[ "$(stat -c '%a' "$PGPASSFILE")" == '600' ]]
grep -Fq "$TEST_EXPECTED_CREDENTIAL" "$PGPASSFILE"
if [[ "$TEST_EXPECT_JIT" == '1' ]]; then
  [[ "${PGOPTIONS:-}" == '-c jit=on' ]]
else
  [[ ! "${PGOPTIONS+x}" == 'x' ]]
fi
for arg in "$@"; do
  case "$arg" in
    --file=*) : > "${arg#--file=}" ;;
  esac
done
MOCK
chmod 700 "$tmp_dir/bin/psql" "$tmp_dir/bin/pg_dump"

run_case() {
  local mode="$1" credential="$2" query="$3" expected_jit="$4"
  local passfile_path="$tmp_dir/${mode}.passfile-path"
  local output
  rm -f "$passfile_path"
  output="$(PATH="$tmp_dir/bin:$PATH" \
  RUNNER_TEMP="$tmp_dir" \
  TEST_EXPECTED_CREDENTIAL="$credential" \
  TEST_EXPECT_JIT="$expected_jit" \
  TEST_PASSFILE_PATH="$passfile_path" \
  SUPABASE_DB_URL_RO="postgresql://supabase_read_only_user.lirfjvsqpetdfryywefq:${credential}@db-1.example.pooler.supabase.com:5432/postgres?sslmode=require${query}" \
    bash "$repo_root/scripts/backup/export.sh" --preflight)"
  [[ "$output" != *"$credential"* ]]
  [[ -s "$passfile_path" ]]
  local generated_passfile
  generated_passfile="$(<"$passfile_path")"
  [[ ! -e "$generated_passfile" ]]
}

run_case jit synthetic-jit-token '&options=-c%20jit%3Don' 1
run_case password synthetic-db-password '' 0
if SUPABASE_DB_URL_RO='postgresql://supabase_read_only_user.lirfjvsqpetdfryywefq:synthetic-token@db-1.example.pooler.supabase.com:5432/postgres?sslmode=require&options=-c%20jit%3Don&options=-c%20jit%3Don' \
  bash "$repo_root/scripts/backup/export.sh" --preflight >/dev/null 2>&1; then
  echo 'Preflight accepted duplicate JIT options.' >&2
  exit 1
fi
echo 'Synthetic backup preflight credential/PGOPTIONS checks passed; no network connection was used.'
