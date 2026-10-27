#!/usr/bin/env bash
# FPMS full backup (D-22, AC-26): full SQL Server backup of the database into one timestamped folder, verified with CHECKSUM.
# Since D-30 the system stores no files (compliance records are database rows), so the database is the whole backup.
#
#   bash scripts/backup/backup.sh [backup-root]        default backup-root: ~/FPMS-backups
#
# Every run (success or failure) is recorded in FpmsBackupRuns for the System Administrator health page.
# Environment: see scripts/backup/lib.sh. Schedule: daily (see docs/runbook.md).
set -euo pipefail
. "$(dirname "$0")/lib.sh"
DEST_ROOT="${1:-$BACKUP_ROOT}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$DEST_ROOT/$STAMP"
job_guard $KIND_FULL

mkdir -p "$DEST"
echo "[$(date '+%H:%M:%S')] backing up database $DB …"
if [ "$MODE" = docker ]; then
  docker_backup_dir
  sqlcmd -Q "BACKUP DATABASE [$DB] TO DISK = N'/var/opt/mssql/backup/$DB-$STAMP.bak' WITH INIT, CHECKSUM, COMPRESSION, NAME = N'FPMS $STAMP'" >/dev/null
  sqlcmd -Q "RESTORE VERIFYONLY FROM DISK = N'/var/opt/mssql/backup/$DB-$STAMP.bak' WITH CHECKSUM"
  docker compose -f "$COMPOSE" cp "sqlserver:/var/opt/mssql/backup/$DB-$STAMP.bak" "$DEST/$DB.bak"
  docker compose -f "$COMPOSE" exec -T -u root sqlserver rm -f "/var/opt/mssql/backup/$DB-$STAMP.bak"
else
  sqlcmd -Q "BACKUP DATABASE [$DB] TO DISK = N'$DEST/$DB.bak' WITH INIT, CHECKSUM, COMPRESSION, NAME = N'FPMS $STAMP'"
  sqlcmd -Q "RESTORE VERIFYONLY FROM DISK = N'$DEST/$DB.bak' WITH CHECKSUM"
fi

( cd "$DEST" && shasum -a 256 "$DB.bak" > SHA256SUMS )
cat > "$DEST/manifest.txt" <<MANIFEST
FPMS backup $STAMP
database: $DB  (full backup, CHECKSUM verified)

created on: $(hostname)
MANIFEST
SIZE="$(file_size "$DEST/$DB.bak")"
trap - ERR
record_run $KIND_FULL "$JOB_STARTED" 1 "$STAMP/$DB.bak" "$SIZE" "verified with CHECKSUM"
echo "[$(date '+%H:%M:%S')] done: $DEST"
ls -lh "$DEST"
