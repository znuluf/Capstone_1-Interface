#!/bin/sh
# Container start: check the settings, write the Angular runtime config, migrate the database, start the API.
set -eu

fail() { echo "fpms: $*" >&2; exit 1; }

[ -n "${ConnectionStrings__Default:-}" ] \
  || fail "ConnectionStrings__Default is not set (a SQL Server connection string; see docs/render.md)."
[ -n "${SystemAdmin__InitialPassword:-}" ] \
  || fail "SystemAdmin__InitialPassword is not set. Without it the admin account would get the development password."
jwt_key="${Authentication__JwtBearer__SecurityKey:-}"
[ "${#jwt_key}" -ge 32 ] \
  || fail "Authentication__JwtBearer__SecurityKey must be set to 32 or more characters."

# Public address: APP_URL if given, otherwise the one Render provides (https://<service>.onrender.com).
PORT="${PORT:-10000}"
URL="${APP_URL:-${RENDER_EXTERNAL_URL:-http://localhost:$PORT}}"
URL="${URL%/}"

# Render terminates HTTPS and forwards plain HTTP to $PORT. This overrides the localhost HTTPS endpoint
# in appsettings.json.
export Kestrel__Endpoints__Http__Url="http://0.0.0.0:$PORT"
# The browser loads the app and calls the API on the same address.
export App__ServerRootAddress="${App__ServerRootAddress:-$URL/}"
export App__ClientRootAddress="${App__ClientRootAddress:-$URL/}"
export App__CorsOrigins="${App__CorsOrigins:-$URL}"

cat > /app/wwwroot/assets/appconfig.production.json <<JSON
{
    "remoteServiceBaseUrl": "$URL",
    "appBaseUrl": "$URL",
    "localeMappings": [
        { "from": "pt-BR", "to": "pt" },
        { "from": "zh-CN", "to": "zh" },
        { "from": "he-IL", "to": "he" }
    ]
}
JSON

# Create or upgrade the database and seed it. Retries cover a database that is still waking up
# (for example a serverless Azure SQL database that paused).
attempts="${MIGRATE_ATTEMPTS:-6}"
n=1
cd /app/migrator
until dotnet Capstone.Migrator.dll -q; do
  [ "$n" -ge "$attempts" ] && fail "Database migration failed after $attempts attempts (see the log above)."
  echo "fpms: migration attempt $n failed; retrying in 15s..."
  n=$((n + 1))
  sleep 15
done

cd /app
echo "fpms: starting on port $PORT for $URL"
exec dotnet Capstone.Web.Host.dll
