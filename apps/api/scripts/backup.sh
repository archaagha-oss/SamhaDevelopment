#!/usr/bin/env bash
#
# backup.sh — Samha CRM database backup
#
# Dumps the production MySQL/MariaDB database, compresses it, optionally
# uploads to S3, and prunes local + remote copies past the retention window.
#
# Designed to run from cron on the cPanel host:
#   0 2 * * * cd /home/<user>/apps/api && ./scripts/backup.sh >> logs/backup.log 2>&1
#
# Required env (typically read from apps/api/.env via the source line below):
#   DATABASE_URL                — mysql://user:pass@host:port/dbname
# Optional:
#   BACKUP_DIR                  — local backup folder (default ./backups)
#   BACKUP_RETENTION_DAYS       — local prune window (default 7)
#   BACKUP_S3_BUCKET            — if set, upload + S3 retention
#   BACKUP_S3_PREFIX            — key prefix in the bucket (default "samha-backups")
#   BACKUP_S3_RETENTION_DAYS    — S3 prune window (default 30)
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION  — for aws cli
#
# Exits non-zero on failure so cron / monitoring picks it up. Writes a status
# line at the end so log greps can confirm a backup succeeded.

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load .env if present (BACKUP_* and DATABASE_URL may live there).
if [[ -f "${API_ROOT}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "${API_ROOT}/.env"; set +a
fi

# ── Sanity checks ─────────────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 2
fi
if ! command -v mysqldump >/dev/null 2>&1; then
  echo "ERROR: mysqldump not found in PATH" >&2
  exit 2
fi

# ── Parse DATABASE_URL (mysql://user:pass@host:port/db?args) ──────────────
# Use a perl one-liner for reliable URL parsing rather than fragile regex.
read -r DB_USER DB_PASS DB_HOST DB_PORT DB_NAME < <(
  perl -e '
    use URI;
    my $u = URI->new($ENV{DATABASE_URL});
    my $userinfo = $u->userinfo // "";
    my ($user, $pass) = split /:/, $userinfo, 2;
    my $port = $u->port // 3306;
    my $path = $u->path // "";
    $path =~ s{^/}{};
    print join(" ", $user // "", $pass // "", $u->host // "", $port, $path), "\n";
  ' 2>/dev/null
)

if [[ -z "${DB_USER:-}" || -z "${DB_HOST:-}" || -z "${DB_NAME:-}" ]]; then
  # Perl URI module not installed — fall back to bash regex (works for the
  # straightforward DATABASE_URL shape used in production).
  if [[ "${DATABASE_URL}" =~ mysql://([^:]+):([^@]*)@([^:/]+)(:([0-9]+))?/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[5]:-3306}"
    DB_NAME="${BASH_REMATCH[6]}"
  else
    echo "ERROR: could not parse DATABASE_URL" >&2
    exit 2
  fi
fi

# ── Paths ─────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-${API_ROOT}/backups}"
mkdir -p "${BACKUP_DIR}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="${BACKUP_DIR}/samha-${DB_NAME}-${TS}.sql.gz"

# ── Dump ──────────────────────────────────────────────────────────────────
echo "[backup ${TS}] dumping ${DB_NAME}@${DB_HOST}:${DB_PORT} → ${DUMP_FILE}"

# --single-transaction: consistent snapshot without table locks (InnoDB).
# --routines + --triggers: include stored programs.
# --hex-blob: safe binary encoding for Document/payment receipt blobs.
# --set-gtid-purged=OFF: avoid GTID metadata that breaks restore on a fresh DB.
# Password passed via env to avoid leaking on argv (visible to ps).
MYSQL_PWD="${DB_PASS}" \
mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --hex-blob \
  --quick \
  --set-gtid-purged=OFF \
  -h "${DB_HOST}" \
  -P "${DB_PORT}" \
  -u "${DB_USER}" \
  "${DB_NAME}" \
  | gzip -9 > "${DUMP_FILE}"

DUMP_BYTES="$(wc -c < "${DUMP_FILE}")"
echo "[backup ${TS}] wrote ${DUMP_BYTES} bytes to ${DUMP_FILE}"

# ── Optional S3 upload ────────────────────────────────────────────────────
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "WARN: BACKUP_S3_BUCKET set but aws CLI not found; skipping upload" >&2
  else
    PREFIX="${BACKUP_S3_PREFIX:-samha-backups}"
    S3_KEY="${PREFIX}/${TS}/$(basename "${DUMP_FILE}")"
    echo "[backup ${TS}] uploading to s3://${BACKUP_S3_BUCKET}/${S3_KEY}"
    aws s3 cp "${DUMP_FILE}" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" \
      --only-show-errors \
      --storage-class STANDARD_IA
    echo "[backup ${TS}] S3 upload OK"
  fi
fi

# ── Local retention ───────────────────────────────────────────────────────
RETAIN_DAYS="${BACKUP_RETENTION_DAYS:-7}"
echo "[backup ${TS}] pruning local backups older than ${RETAIN_DAYS} days"
find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'samha-*.sql.gz' \
  -mtime +"${RETAIN_DAYS}" -print -delete || true

# ── S3 retention (optional) ───────────────────────────────────────────────
if [[ -n "${BACKUP_S3_BUCKET:-}" ]] && command -v aws >/dev/null 2>&1; then
  S3_RETAIN_DAYS="${BACKUP_S3_RETENTION_DAYS:-30}"
  CUTOFF_EPOCH="$(date -u -d "${S3_RETAIN_DAYS} days ago" +%s 2>/dev/null \
                  || date -u -v-"${S3_RETAIN_DAYS}d" +%s)"
  echo "[backup ${TS}] pruning S3 backups older than ${S3_RETAIN_DAYS} days"
  aws s3 ls "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-samha-backups}/" \
    --recursive 2>/dev/null \
    | awk '{print $1" "$2" "$4}' \
    | while read -r d t key; do
        # Skip empty / header lines
        [[ -z "${key:-}" ]] && continue
        OBJ_EPOCH="$(date -u -d "${d} ${t}" +%s 2>/dev/null || true)"
        [[ -z "${OBJ_EPOCH:-}" ]] && continue
        if (( OBJ_EPOCH < CUTOFF_EPOCH )); then
          echo "  - deleting s3://${BACKUP_S3_BUCKET}/${key}"
          aws s3 rm "s3://${BACKUP_S3_BUCKET}/${key}" --only-show-errors || true
        fi
      done
fi

echo "[backup ${TS}] OK ${DB_NAME} ${DUMP_BYTES}b"
