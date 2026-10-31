#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_REF='lirfjvsqpetdfryywefq'
EXPECTED_ROLE="supabase_read_only_user.${PROJECT_REF}"
MODE='export'
out_dir=''
if [[ "${1:-}" == '--preflight' ]]; then
  MODE='preflight'
  [[ $# -eq 1 ]] || { echo 'Usage: export.sh --preflight' >&2; exit 2; }
else
  out_dir="${1:?Usage: export.sh OUTPUT_DIRECTORY | --preflight}"
  [[ $# -eq 1 ]] || { echo 'Usage: export.sh OUTPUT_DIRECTORY | --preflight' >&2; exit 2; }
fi

if [[ -z "${SUPABASE_DB_URL_RO:-}" ]]; then
  echo 'The protected read-only database connection secret is not configured.' >&2
  exit 2
fi
if ! command -v pg_dump >/dev/null || ! command -v psql >/dev/null || ! command -v python3 >/dev/null; then
  echo 'PostgreSQL 17 client tools and Python 3 are required.' >&2
  exit 2
fi
pg_major="$(pg_dump --version | sed -E 's/.* ([0-9]+)\..*/\1/')"
[[ "$pg_major" == '17' ]] || { echo 'pg_dump 17 is required.' >&2; exit 2; }

# Use the exact Session Pooler URI copied from Supabase Dashboard → Connect.
# Parse it without ever echoing or passing the password in a command argument.
pgpass_file="$(mktemp "${RUNNER_TEMP:-/tmp}/medsolution-pgpass.XXXXXX")"
chmod 600 "$pgpass_file"
error_file="$(mktemp "${RUNNER_TEMP:-/tmp}/medsolution-pgerror.XXXXXX")"
cleanup() {
  rm -f "$pgpass_file" "$error_file"
}
trap cleanup EXIT
if ! python3 - "$pgpass_file" "$EXPECTED_ROLE" <<'PY' 2>/dev/null
import sys
import os
from urllib.parse import unquote, urlsplit, parse_qs

uri = os.environ.get('SUPABASE_DB_URL_RO', '')
passfile, expected_user = sys.argv[1:]
try:
    parsed = urlsplit(uri)
    host = parsed.hostname or ''
    port = parsed.port
    username = unquote(parsed.username or '')
    password = unquote(parsed.password or '')
    database = unquote(parsed.path.lstrip('/'))
    query = parse_qs(parsed.query)
except Exception:
    sys.exit(1)

if parsed.scheme not in ('postgres', 'postgresql'):
    sys.exit(1)
if not host.endswith('.pooler.supabase.com') or port != 5432:
    sys.exit(1)
if username != expected_user or database != 'postgres' or not password:
    sys.exit(1)
if query.get('sslmode', ['require'])[0] not in ('require', 'verify-ca', 'verify-full'):
    sys.exit(1)
if any(ord(char) < 32 or ord(char) == 127 for char in password):
    sys.exit(1)

def pgpass_escape(value):
    return value.replace('\\', '\\\\').replace(':', '\\:').replace('\n', '').replace('\r', '')

with open(passfile, 'w', encoding='utf-8') as f:
    f.write(':'.join(map(pgpass_escape, (host, str(port), database, username, password))) + '\n')
PY
then
  echo 'Connection secret must be the project Session Pooler URI from Dashboard → Connect: custom role, port 5432, TLS enabled.' >&2
  exit 2
fi

export PGPASSFILE="$pgpass_file"
export PGHOST PGPORT PGUSER PGDATABASE PGSSLMODE PGCONNECT_TIMEOUT
PGHOST="$(python3 - <<'PY' 2>/dev/null
from urllib.parse import urlsplit
import sys
import os
print(urlsplit(os.environ.get('SUPABASE_DB_URL_RO', '')).hostname or '')
PY
)"
PGPORT='5432'
PGUSER="$EXPECTED_ROLE"
PGDATABASE='postgres'
PGSSLMODE='require'
PGCONNECT_TIMEOUT='15'

# Query only role/catalog metadata. This does not read clinical table rows.
preflight_sql="
WITH role_check AS (
  SELECT r.oid, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication,
         r.rolbypassrls, r.rolconfig
  FROM pg_roles r WHERE r.rolname = current_user
), checks AS (
  SELECT
    current_user = '${EXPECTED_ROLE}' AS expected_identity,
    (SELECT rolbypassrls FROM role_check) AS bypass_rls,
    (SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication FROM role_check) AS least_privilege_flags,
    COALESCE((SELECT 'default_transaction_read_only=on' = ANY(rolconfig) FROM role_check), false) AS read_only_default,
    EXISTS (
      SELECT 1 FROM pg_auth_members m JOIN pg_roles granted ON granted.oid = m.roleid
      WHERE m.member = (SELECT oid FROM role_check) AND granted.rolname = 'pg_read_all_data'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_auth_members m JOIN pg_roles granted ON granted.oid = m.roleid
      WHERE m.member = (SELECT oid FROM role_check) AND granted.rolname <> 'pg_read_all_data'
    ) AS only_required_read_role,
    NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','p','v','m','f','S')
        AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
        AND (has_table_privilege(current_user, c.oid, 'INSERT')
          OR has_table_privilege(current_user, c.oid, 'UPDATE')
          OR has_table_privilege(current_user, c.oid, 'DELETE')
          OR has_table_privilege(current_user, c.oid, 'TRUNCATE'))
    ) AS no_relation_writes,
    NOT EXISTS (
      SELECT 1 FROM pg_namespace n
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
        AND has_schema_privilege(current_user, n.oid, 'CREATE')
    ) AS no_schema_create,
    (SELECT count(*) = 0 FROM pg_largeobject_metadata) AS no_unreadable_large_objects
)
SELECT CASE WHEN bool_and(v) THEN 'ok' ELSE 'fail' END
FROM checks CROSS JOIN LATERAL (VALUES
  (expected_identity), (bypass_rls), (least_privilege_flags),
  (read_only_default), (only_required_read_role), (no_relation_writes), (no_schema_create),
  (no_unreadable_large_objects)
) AS requirements(v);
"
if ! result="$(psql -X -w -v ON_ERROR_STOP=1 -Atqc "$preflight_sql" 2>"$error_file")" || [[ "$result" != 'ok' ]]; then
  echo 'Database preflight failed: connection, identity, read-only privileges, RLS bypass, or large-object access could not be verified.' >&2
  exit 1
fi

# Exercise pg_dump's catalog access without exporting clinical rows. Keep detailed
# PostgreSQL diagnostics private because some drivers can echo connection details.
schema_probe="$(mktemp "${RUNNER_TEMP:-/tmp}/medsolution-schema-probe.XXXXXX")"
if ! pg_dump --schema-only --file="$schema_probe" 2>"$error_file"; then
  rm -f "$schema_probe"
  echo 'Database preflight failed: PostgreSQL 17 could not read the complete schema metadata.' >&2
  exit 1
fi
rm -f "$schema_probe"

if [[ "$MODE" == 'preflight' ]]; then
  echo 'Session Pooler authentication, read-only role checks, and schema-only export access verified; no clinical rows were exported.'
  exit 0
fi

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_PUBLIC_KEY:-}" ]]; then
  echo 'The protected Supabase Storage API secrets are not configured.' >&2
  exit 2
fi
mkdir -p "$out_dir/db" "$out_dir/storage/objects"

# One complete logical database dump preserves every database schema, table,
# function, trigger, policy, extension declaration, sequence, and row. Credentials
# are not part of a database dump; globals are recorded separately without hashes.
if ! pg_dump --file="$out_dir/db/database.sql" 2>"$error_file"; then
  echo 'Database export failed. PostgreSQL diagnostics were suppressed to avoid exposing connection details.' >&2
  exit 1
fi

if ! psql -X -w -v ON_ERROR_STOP=1 --csv -c \
  "SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls, rolconnlimit, rolvaliduntil FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY rolname" \
  > "$out_dir/db/roles.csv" 2>"$error_file"; then
  echo 'Role metadata export failed; no password hashes are exported.' >&2
  exit 1
fi
if ! psql -X -w -v ON_ERROR_STOP=1 --csv -c \
  "SELECT granted.rolname AS granted_role, member_role.rolname AS member_role, grantor_role.rolname AS grantor_role, m.admin_option FROM pg_auth_members m JOIN pg_roles granted ON granted.oid=m.roleid JOIN pg_roles member_role ON member_role.oid=m.member JOIN pg_roles grantor_role ON grantor_role.oid=m.grantor ORDER BY granted.rolname, member_role.rolname" \
  > "$out_dir/db/role-memberships.csv" 2>"$error_file"; then
  echo 'Role membership export failed.' >&2
  exit 1
fi

# Storage object bytes are separate from pg_dump. Export them through the Storage
# API and the currently authorized policies; no service_role key is accepted.
if ! node scripts/backup/export-storage.mjs "$out_dir/storage" 2>"$error_file"; then
  echo 'Storage object export failed. Detailed API errors were suppressed.' >&2
  exit 1
fi

cat > "$out_dir/README.txt" <<'EOF'
MedSolution logical backup produced by the manually dispatched GitHub Actions workflow.
database.sql is a full logical pg_dump from PostgreSQL 17, including managed database
schemas and their data. roles.csv and role-memberships.csv record role metadata and
memberships without password hashes; login credentials must be re-established during
recovery. Storage object bytes are separately exported under storage/objects, with
keys and metadata in storage-manifest.json. Keep the complete package encrypted.
Supabase platform secrets, Auth signing keys, Storage encryption keys, and platform
configuration are not included. Validate managed-schema restoration in an isolated
Supabase-compatible environment before claiming a complete platform recovery.
EOF

(cd "$out_dir" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
echo 'Database and Storage exports completed; plaintext is confined to the ephemeral runner.'
