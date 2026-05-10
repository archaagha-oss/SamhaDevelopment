#!/usr/bin/env bash
#
# restore.sh — Samha CRM database restore (drill or recovery)
#
# Restores a backup created by ./backup.sh into a target database. Designed
# for two situations:
#   1. Monthly drill: restore latest backup into a sandbox DB and run
#      verification queries — use ./scripts/restore.sh drill
#   2. Recovery: restore a specific backup into the production DB after a
#      catastrophic failure. Requires --force to actually run against prod.
#
# Usage:
#   ./scripts/restore.sh drill                          # latest backup -> samha_drill
#   ./scripts/restore.sh drill <backup-file.sql.gz>     # specific file
#   ./scripts/restore.sh recover <backup> --force       # production restore
#
# Safety:
#   - Default mode is "drill". Recovery requires explicit --force.
#   - Drill DB defaults to samha_drill (NOT the prod schema).
#   - Asks for typed confirmation before destroying any non-drill DB.

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${API_ROOT}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "${API_ROOT}/.env"; set +a
fi

MODE="${1:-drill}"
BACKUP_PATH="${2:-}"
FORCE=""
for arg in "$@"; do
  [[ "${arg}" == "--force" ]] && FORCE="1"
done

if [[ "${MODE}" != "drill" && "${MODE}" != "recover" ]]; then
  echo "Usage: $0 (drill|recover) [backup-file] [--force]" >&2
  exit 2
fi

# ── Find backup ────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-${API_ROOT}/backups}"
if [[ -z "${BACKUP_PATH}" || "${BACKUP_PATH}" == "--force" ]]; then
  BACKUP_PATH="$(ls -1t "${BACKUP_DIR}"/samha-*.sql.gz 2>/dev/null | head -1 || true)"
  if [[ -z "${BACKUP_PATH}" ]]; then
    echo "ERROR: no backup files found in ${BACKUP_DIR}" >&2
    exit 2
  fi
  echo "Using latest backup: ${BACKUP_PATH}"
fi
if [[ ! -f "${BACKUP_PATH}" ]]; then
  echo "ERROR: backup file not found: ${BACKUP_PATH}" >&2
  exit 2
fi

# ── Parse DATABASE_URL for host/user/pass ────────────────────────────────
if [[ "${DATABASE_URL:-}" =~ mysql://([^:]+):([^@]*)@([^:/]+)(:([0-9]+))?/([^?]+) ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASS="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[5]:-3306}"
  PROD_DB="${BASH_REMATCH[6]}"
else
  echo "ERROR: could not parse DATABASE_URL" >&2
  exit 2
fi

# ── Pick target DB ─────────────────────────────────────────────────────────
if [[ "${MODE}" == "drill" ]]; then
  TARGET_DB="${RESTORE_DRILL_DB:-samha_drill}"
else
  TARGET_DB="${PROD_DB}"
  if [[ -z "${FORCE}" ]]; then
    echo "ERROR: recovery mode requires --force (target: ${TARGET_DB})" >&2
    exit 2
  fi
  echo "WARNING: about to OVERWRITE production DB '${TARGET_DB}' on ${DB_HOST}"
  echo "Type the DB name to confirm:"
  read -r CONFIRM
  if [[ "${CONFIRM}" != "${TARGET_DB}" ]]; then
    echo "Confirmation mismatch; aborting" >&2
    exit 2
  fi
fi

# ── (Re)create the target DB ──────────────────────────────────────────────
echo "Recreating ${TARGET_DB} on ${DB_HOST}:${DB_PORT}"
MYSQL_PWD="${DB_PASS}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" \
  -e "DROP DATABASE IF EXISTS \`${TARGET_DB}\`; CREATE DATABASE \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# ── Restore ────────────────────────────────────────────────────────────────
echo "Restoring ${BACKUP_PATH} → ${TARGET_DB}"
gunzip -c "${BACKUP_PATH}" | \
  MYSQL_PWD="${DB_PASS}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" "${TARGET_DB}"

echo
echo "Restore complete. Running verification queries..."
echo

# ── Verification queries (sanity-check the restore) ───────────────────────
MYSQL_PWD="${DB_PASS}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" "${TARGET_DB}" <<'SQL'
SELECT 'Lead'    AS table_name, COUNT(*) AS rows FROM Lead
UNION ALL SELECT 'Deal',     COUNT(*) FROM Deal
UNION ALL SELECT 'Unit',     COUNT(*) FROM Unit
UNION ALL SELECT 'Payment',  COUNT(*) FROM Payment
UNION ALL SELECT 'Activity', COUNT(*) FROM Activity
UNION ALL SELECT 'User',     COUNT(*) FROM User;

SELECT 'Latest Activity' AS info, MAX(createdAt) AS at FROM Activity;
SELECT 'Latest Payment'  AS info, MAX(createdAt) AS at FROM Payment;
SELECT 'Active deals'    AS info, COUNT(*)       AS rows FROM Deal WHERE isActive = 1;
SQL

echo
echo "Restore + verification OK."
