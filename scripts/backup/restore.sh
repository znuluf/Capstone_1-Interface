#!/usr/bin/env bash
# FPMS restore (D-22): restores a backup folder made by backup.sh.
#
#   bash scripts/backup/restore.sh <backup-folder> [target-database] [--logs <log-folder>] [--stopat 'YYYY-MM-DD HH:MM:SS']
#
# With --logs, the full backup is restored first and then every transaction-log backup in the folder that was made after it
# (the log chain), in order, so only the last 30 minutes at most are lost. --stopat restores to a point in time, in the SQL Server's
# local time (for example just before a mistake was made). Without --logs the database comes back as of the full backup.
#
# Defaults restore over the live database (CapstoneDb). Stop the API first.
# To rehearse safely, give another database name (restore-check.sh does this).
# Backups made before D-30 also contain documents.tgz; it is checked but no longer restored (no files are used).
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$PWD"
SRC="${1:?backup folder required}"
shift
TARGET_DB="${FPMS_DB:-CapstoneDb}"
LOGS=""; STOPAT=""
if [ $# -gt 0 ] && [[ "$1" != --* ]]; then TARGET_DB="$1"; shift; fi
while [ $# -gt 0 ]; do
  case "$1" in
    --logs) LOGS="${2:?--logs needs a folder}"; shift 2 ;;
    --stopat) STOPAT="${2:?--stopat needs a time}"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

MODE="${FPMS_SQL_MODE:-docker}"
COMPOSE="$ROOT/aspnet-core/docker/sqlserver/docker-compose.yml"
BAK="$(ls "$SRC"/*.bak | head -1)"

if [ -z "${MSSQL_SA_PASSWORD:-}" ] && [ -f "$ROOT/aspnet-core/docker/sqlserver/.env" ]; then
  MSSQL_SA_PASSWORD="$(grep -E '^MSSQL_SA_PASSWORD=' "$ROOT/aspnet-core/docker/sqlserver/.env" | head -1 | cut -d= -f2- | tr -d '"' )"
fi
: "${MSSQL_SA_PASSWORD:?Set MSSQL_SA_PASSWORD}"

sqlcmd() {
  if [ "$MODE" = docker ]; then
    docker compose -f "$COMPOSE" exec -T -e SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" sqlserver /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -b "$@"
  else
    SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" command sqlcmd -C -S localhost -U sa -b "$@"
  fi
}

echo "checking archive integrity …"
( cd "$SRC" && shasum -a 256 -c SHA256SUMS )

if [ "$MODE" = docker ]; then
  docker compose -f "$COMPOSE" exec -T -u root sqlserver bash -c 'mkdir -p /var/opt/mssql/backup && chown mssql /var/opt/mssql/backup'
  docker compose -f "$COMPOSE" cp "$BAK" "sqlserver:/var/opt/mssql/backup/restore.bak"
  docker compose -f "$COMPOSE" exec -T -u root sqlserver chown mssql /var/opt/mssql/backup/restore.bak
  FILE=/var/opt/mssql/backup/restore.bak
  DATA_DIR=/var/opt/mssql/data
else
  FILE="$BAK"
  DATA_DIR="${FPMS_SQL_DATA_DIR:?Set FPMS_SQL_DATA_DIR to the SQL Server data folder}"
fi

# Logical file names inside the backup, so the restore can move them to new physical files.
LOGICAL="$(sqlcmd -h -1 -W -s '|' -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'$FILE'" | awk -F'|' 'NF>2 {print $1"|"$3}')"
DATA_NAME="$(echo "$LOGICAL" | awk -F'|' '$2=="D"{print $1; exit}')"
LOG_NAME="$(echo "$LOGICAL" | awk -F'|' '$2=="L"{print $1; exit}')"

RECOVERY="RECOVERY"
[ -n "$LOGS" ] && RECOVERY="NORECOVERY"
echo "restoring database into [$TARGET_DB] …"
sqlcmd -Q "IF DB_ID(N'$TARGET_DB') IS NOT NULL ALTER DATABASE [$TARGET_DB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
RESTORE DATABASE [$TARGET_DB] FROM DISK = N'$FILE' WITH REPLACE, CHECKSUM, $RECOVERY,
  MOVE N'$DATA_NAME' TO N'$DATA_DIR/$TARGET_DB.mdf', MOVE N'$LOG_NAME' TO N'$DATA_DIR/${TARGET_DB}_log.ldf';"

if [ -n "$LOGS" ]; then
  # Only logs made after the full backup belong to its chain; SQL Server skips the ones that do not fit, so offer them all in order.
  STOP_CLAUSE=""
  [ -n "$STOPAT" ] && STOP_CLAUSE=", STOPAT = '$STOPAT'"
  applied=0
  for trn in $(ls "$LOGS"/*.trn 2>/dev/null | sort); do
    if [ "$MODE" = docker ]; then
      docker compose -f "$COMPOSE" cp "$trn" "sqlserver:/var/opt/mssql/backup/restore.trn"
      docker compose -f "$COMPOSE" exec -T -u root sqlserver chown mssql /var/opt/mssql/backup/restore.trn
      LFILE=/var/opt/mssql/backup/restore.trn
    else
      LFILE="$trn"
    fi
    if sqlcmd -Q "RESTORE LOG [$TARGET_DB] FROM DISK = N'$LFILE' WITH CHECKSUM, NORECOVERY$STOP_CLAUSE" >/dev/null 2>&1; then
      applied=$((applied+1))
    else
      echo "skipped $(basename "$trn") (before the full backup, or after the stop time)"
    fi
  done
  echo "applied $applied log backup(s)"
  sqlcmd -Q "RESTORE DATABASE [$TARGET_DB] WITH RECOVERY;"
  [ "$MODE" = docker ] && docker compose -f "$COMPOSE" exec -T -u root sqlserver rm -f /var/opt/mssql/backup/restore.trn
fi
sqlcmd -Q "ALTER DATABASE [$TARGET_DB] SET MULTI_USER;"

if [ "$MODE" = docker ]; then
  docker compose -f "$COMPOSE" exec -T -u root sqlserver rm -f /var/opt/mssql/backup/restore.bak
fi

echo "restore complete: database [$TARGET_DB]"
