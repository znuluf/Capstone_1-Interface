#!/usr/bin/env bash
# Installs and builds everything that does not need the database, so a Codespace starts faster. Runs when the
# Codespace is created and again when its content is updated; a Codespaces prebuild runs it ahead of time.
# Safe to run again by hand.
set -euo pipefail

export DOTNET_NOLOGO=1 DOTNET_CLI_TELEMETRY_OPTOUT=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ROOT="$(git rev-parse --show-toplevel)"

# dotnet-ef from the repo's tool manifest (.config/dotnet-tools.json).
(cd "$ROOT" && dotnet tool restore)

# Restore and build the two projects the start script runs, so it can start them without building.
(cd "$ROOT/aspnet-core" && dotnet build src/Capstone.Migrator/Capstone.Migrator.csproj -v q -nologo \
  && dotnet build src/Capstone.Web.Host/Capstone.Web.Host.csproj -v q -nologo)

# Angular packages.
(cd "$ROOT/angular" && yarn install --frozen-lockfile --network-timeout 600000)

# Pull the SQL Server image now if Docker is already up (it may not be during a prebuild).
if docker info >/dev/null 2>&1; then
  (cd "$ROOT/aspnet-core/docker/sqlserver" && docker compose pull -q) || true
fi
