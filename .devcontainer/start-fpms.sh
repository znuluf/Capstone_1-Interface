#!/usr/bin/env bash
# Starts SQL Server, migrates the database, then starts the API and Angular.
# Runs automatically when the Codespace starts; safe to run again by hand.
set -euo pipefail

export PATH="$PATH:$HOME/.dotnet/tools"
export DOTNET_NOLOGO=1 DOTNET_CLI_TELEMETRY_OPTOUT=1

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Secrets come from Codespaces secrets when set, otherwise they are generated once
# and kept in a git-ignored file.
LOCAL_ENV="$ROOT/.devcontainer/local.env"
if [ ! -f "$LOCAL_ENV" ]; then
  {
    echo "SA_PASSWORD=${SQL_SA_PASSWORD:-Sa$(openssl rand -hex 8)A1!}"
    echo "JWT_KEY=$(openssl rand -base64 48 | tr -d '/+=')"
    echo "ADMIN_PASSWORD=${ADMIN_INITIAL_PASSWORD:-Admin$(openssl rand -hex 6)A1!}"
  } > "$LOCAL_ENV"
  chmod 600 "$LOCAL_ENV"
fi
set -a; . "$LOCAL_ENV"; set +a

# URLs: a Codespace has its own forwarded addresses (they change for each new Codespace);
# anywhere else (a local machine or a local Dev Container) everything is on localhost.
if [ -n "${CODESPACE_NAME:-}" ]; then
  DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  API_URL="https://${CODESPACE_NAME}-44311.${DOMAIN}"
  WEB_URL="https://${CODESPACE_NAME}-4200.${DOMAIN}"
else
  API_URL="https://localhost:44311"
  WEB_URL="http://localhost:4200"
fi

# Two separate databases live in the same SQL Server: a clean one (FPMS: admin account only) and a sample one
# (FPMS_Sample: the gensan-semi sample farm). SEED_SAMPLE_DATA=1 selects the sample one; switch by running this
# script again with or without it. Both keep their data in the Docker volume.
export Seed__SimpleSampleData=false
if [ "${SEED_SAMPLE_DATA:-}" = "1" ]; then DB_NAME="FPMS_Sample"; export Seed__SampleData=true
elif [ "${SEED_SAMPLE_DATA:-}" = "simple" ]; then DB_NAME="FPMS_Simple"; export Seed__SampleData=false; export Seed__SimpleSampleData=true
else DB_NAME="FPMS"; export Seed__SampleData=false; fi
export Seed__DevelopmentData=false

# Environment variables override appsettings.json for the .NET apps.
export ConnectionStrings__Default="Server=localhost,1433;Database=${DB_NAME};User Id=sa;Password=${SA_PASSWORD};TrustServerCertificate=True"
export Authentication__JwtBearer__SecurityKey="$JWT_KEY"
export SystemAdmin__InitialPassword="$ADMIN_PASSWORD"
export App__CorsOrigins="$WEB_URL"
export App__ClientRootAddress="$WEB_URL/"
export App__ServerRootAddress="$API_URL/"

# SQL Server
printf 'MSSQL_SA_PASSWORD=%s\n' "$SA_PASSWORD" > aspnet-core/docker/sqlserver/.env
for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
docker info >/dev/null 2>&1 || { echo "Docker is not running."; exit 1; }
(cd aspnet-core/docker/sqlserver && docker compose up -d)

# The repo does not keep its migrations: a brand-new Initial migration is generated here from the current model
# (the Migrations folder is git-ignored), so the database always matches this code.
if [ ! -d "$ROOT/aspnet-core/src/Capstone.EntityFrameworkCore/Migrations" ]; then
  # dotnet-ef comes from the repo's tool manifest (.config/dotnet-tools.json); restore it if it is not installed yet.
  (cd "$ROOT" && dotnet tool restore >/dev/null)
  (cd "$ROOT/aspnet-core" && dotnet ef migrations add Initial \
    --project src/Capstone.EntityFrameworkCore --startup-project src/Capstone.Web.Host)

  # A new Initial migration has a new ID, so databases built from an older one cannot be migrated
  # ("There is already an object named ..."). Drop both; the migrator below recreates and reseeds them.
  sqlcmd_q() {
    (cd "$ROOT/aspnet-core/docker/sqlserver" && docker compose exec -T sqlserver \
      /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$SA_PASSWORD" -b -Q "$1")
  }
  for _ in $(seq 1 30); do sqlcmd_q "SELECT 1" >/dev/null 2>&1 && break; sleep 2; done
  echo "Generated a new Initial migration; dropping the old FPMS and FPMS_Sample databases."
  for db in FPMS FPMS_Sample FPMS_Simple; do
    sqlcmd_q "IF DB_ID('$db') IS NOT NULL BEGIN ALTER DATABASE [$db] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$db]; END" \
      >/dev/null || { echo "Could not drop database $db."; exit 1; }
  done
fi

# Create/update the database and seed it. -q skips the prompt and exits with code 1 on
# failure, so we retry while SQL Server is still starting. SEED_SAMPLE_DATA=1 also adds the
# sample farm (gensan-semi) to FPMS_Sample.
cd "$ROOT/aspnet-core/src/Capstone.Migrator"
migrator_args=(-q)
migrated=0
for attempt in $(seq 1 12); do
  if dotnet run -- "${migrator_args[@]}" >/tmp/migrator.log 2>&1; then migrated=1; break; fi
  echo "Migration attempt $attempt failed; retrying in 10s..."
  sleep 10
done
[ "$migrated" = 1 ] || { echo "Migration failed. See /tmp/migrator.log"; exit 1; }

# The app expects read-committed snapshot isolation (a database setting that EF migrations do not create).
(cd "$ROOT/aspnet-core/docker/sqlserver" && docker compose exec -T sqlserver /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$SA_PASSWORD" \
  -Q "ALTER DATABASE [${DB_NAME}] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE") >/tmp/rcsi.log 2>&1 \
  || echo "Could not enable read-committed snapshot; see /tmp/rcsi.log"

# Stop anything left from a previous run
pkill -f Capstone.Web.Host || true
pkill -f "ng serve" || true

# API (background)
cd "$ROOT/aspnet-core/src/Capstone.Web.Host"
setsid nohup dotnet run >/tmp/api.log 2>&1 &

# Angular (background). The browser talks only to this URL; the Angular dev server
# forwards /api, /AbpUserConfiguration and /signalr to the API (see angular/proxy.conf.json).
cd "$ROOT/angular"
cat > src/assets/appconfig.json <<JSON
{
    "remoteServiceBaseUrl": "${WEB_URL}",
    "appBaseUrl": "${WEB_URL}",
    "localeMappings": [
        { "from": "pt-BR", "to": "pt" },
        { "from": "zh-CN", "to": "zh" },
        { "from": "he-IL", "to": "he" }
    ]
}
JSON
setsid nohup yarn start >/tmp/angular.log 2>&1 &

# Wait until both servers answer, so the URLs below work when they are printed.
wait_for() { # name url log
  for _ in $(seq 1 90); do
    curl -sk -o /dev/null "$2" && return 0
    sleep 2
  done
  echo "$1 did not start in time. See $3"
  return 1
}
wait_for "API" https://localhost:44311/health /tmp/api.log || true
wait_for "Angular" http://localhost:4200 /tmp/angular.log || true

echo "Database: ${DB_NAME}"
echo "App:     $WEB_URL"
echo "Swagger: $API_URL/swagger/index.html"
echo "Login:   admin / (see .devcontainer/local.env)"
if [ "${SEED_SAMPLE_DATA:-}" = "1" ]; then
  echo "Sample:  farm code gensan-semi, user owner, tech1 or tech2, password Fpms@2026"
fi
