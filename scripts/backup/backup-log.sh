#!/usr/bin/env bash
# FPMS transaction-log backup (AC-26): run every 30 minutes. With the daily full backup this keeps data loss to 30 minutes.
# Needs the FULL recovery model (set by migration Fpms_StepF_BackupRuns) and at least one full backup.
#
#   bash scripts/backup/backup-log.sh [backup-root]      logs go to <backup-root>/logs/
set -euo pipefail
. "$(dirname "$0")/lib.sh"
DEST_ROOT="${1:-$BACKUP_ROOT}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$DEST_ROOT/logs"
job_guard $KIND_LOG
mkdir -p "$DEST"

if [ "$MODE" = docker ]; then
  docker_backup_dir
  sqlcmd -Q "BACKUP LOG [$DB] TO DISK = N'/var/opt/mssql/backup/$DB-$STAMP.trn' WITH INIT, CHECKSUM, COMPRESSION" >/dev/null
  docker compose -f "$COMPOSE" cp "sqlserver:/var/opt/mssql/backup/$DB-$STAMP.trn" "$DEST/$DB-$STAMP.trn"
  docker compose -f "$COMPOSE" exec -T -u root sqlserver rm -f "/var/opt/mssql/backup/$DB-$STAMP.trn"
else
  sqlcmd -Q "BACKUP LOG [$DB] TO DISK = N'$DEST/$DB-$STAMP.trn' WITH INIT, CHECKSUM, COMPRESSION" >/dev/null
fi
SIZE="$(file_size "$DEST/$DB-$STAMP.trn")"
trap - ERR
record_run $KIND_LOG "$JOB_STARTED" 1 "logs/$DB-$STAMP.trn" "$SIZE" ""
echo "log backup: $DEST/$DB-$STAMP.trn ($SIZE bytes)"
