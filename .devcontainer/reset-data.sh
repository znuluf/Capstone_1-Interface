#!/usr/bin/env bash
# Drops the sample database (FPMS_Sample) and starts again, so the two sample farms are seeded fresh.
#
#   bash .devcontainer/reset-data.sh           reset FPMS_Sample only
#   bash .devcontainer/reset-data.sh --clean   reset the clean database (FPMS) instead
#   bash .devcontainer/reset-data.sh --schema  after the data model changed: drop BOTH databases and the generated
#                                              Initial migration, then rebuild the sample database
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
LOCAL_ENV="$ROOT/.devcontainer/local.env"
[ -f "$LOCAL_ENV" ] || { echo "Run bash .devcontainer/start-fpms.sh once first."; exit 1; }
set -a; . "$LOCAL_ENV"; set +a

mode="${1:-sample}"
case "$mode" in
  sample|"")  dbs=(FPMS_Sample); export SEED_SAMPLE_DATA=1 ;;
  --clean)    dbs=(FPMS);        export SEED_SAMPLE_DATA=0 ;;
  --schema)   dbs=(FPMS FPMS_Sample); export SEED_SAMPLE_DATA=1 ;;
  *) echo "Unknown option: $mode (use --clean or --schema)"; exit 1 ;;
esac

echo "This deletes all data in: ${dbs[*]}"
if [ -t 0 ]; then
  read -r -p "Type yes to continue: " answer
  [ "$answer" = "yes" ] || { echo "Cancelled."; exit 1; }
fi

pkill -f Capstone.Web.Host || true
pkill -f "ng serve" || true

(cd "$ROOT/aspnet-core/docker/sqlserver" && docker compose up -d) >/dev/null
for db in "${dbs[@]}"; do
  for _ in $(seq 1 30); do
    if (cd "$ROOT/aspnet-core/docker/sqlserver" && docker compose exec -T sqlserver /opt/mssql-tools18/bin/sqlcmd -C -b -S localhost -U sa -P "$SA_PASSWORD" \
      -Q "IF DB_ID('$db') IS NOT NULL BEGIN ALTER DATABASE [$db] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$db]; END") >/dev/null 2>&1; then
      echo "Dropped $db."
      continue 2
    fi
    sleep 2
  done
  echo "Could not drop $db (is SQL Server running?)."; exit 1
done

if [ "$mode" = "--schema" ]; then
  rm -rf "$ROOT/aspnet-core/src/Capstone.EntityFrameworkCore/Migrations"
  echo "Removed the generated Initial migration; a new one is made from the current model."
fi

exec bash "$ROOT/.devcontainer/start-fpms.sh"
