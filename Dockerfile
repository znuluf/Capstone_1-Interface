# One container for Render (or any Docker host): the API serves the Angular build from wwwroot, and the
# Migrator creates or upgrades the database each time the container starts. See docs/render.md.
# Build from the repository root: docker build -t fpms .

# --- Angular client --------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY angular/package.json angular/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY angular/ ./
RUN npx ng build --configuration production

# --- API and Migrator -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS api
ENV DOTNET_NOLOGO=1 DOTNET_CLI_TELEMETRY_OPTOUT=1
WORKDIR /src
COPY .config/dotnet-tools.json .config/
RUN dotnet tool restore
COPY aspnet-core/ aspnet-core/
COPY deploy/render/pin-initial-migration.sh /usr/local/bin/
WORKDIR /src/aspnet-core
# The repository does not keep migrations (they are git-ignored); like the Codespace start script and CI,
# generate a fresh Initial migration from the current model, then give it an id derived from its content so
# that rebuilding the same model never looks like a new migration to an existing database.
RUN dotnet ef migrations add Initial \
        --project src/Capstone.EntityFrameworkCore --startup-project src/Capstone.Web.Host \
 && sh /usr/local/bin/pin-initial-migration.sh src/Capstone.EntityFrameworkCore/Migrations
RUN dotnet publish src/Capstone.Web.Host -c Release -o /out/api \
 && dotnet publish src/Capstone.Migrator -c Release -o /out/migrator

# --- Runtime --------------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:9.0
ENV ASPNETCORE_ENVIRONMENT=Production DOTNET_NOLOGO=1 DOTNET_CLI_TELEMETRY_OPTOUT=1
WORKDIR /app
COPY --from=api /out/api ./
COPY --from=api /out/migrator ./migrator/
COPY --from=web /web/dist/browser ./wwwroot/
# Log to the console as well as the file, so the logs show up in the Render dashboard.
COPY deploy/render/log4net.config ./log4net.Production.config
COPY deploy/render/log4net.config ./migrator/log4net.config
COPY deploy/render/entrypoint.sh /usr/local/bin/fpms-entrypoint
RUN chmod 755 /usr/local/bin/fpms-entrypoint && chown -R "$APP_UID" /app
USER $APP_UID
# Render sets PORT (10000 by default); the entrypoint binds Kestrel to it.
EXPOSE 10000
ENTRYPOINT ["fpms-entrypoint"]
