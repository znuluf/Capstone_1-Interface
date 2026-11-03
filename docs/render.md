# Deploying to Render

FPMS runs on Render as **one Docker web service**. The root `Dockerfile` builds the Angular app and the API into one image. At each start, the container:

1. checks the required settings;
2. writes the Angular runtime config (`assets/appconfig.production.json`) with the service's public address;
3. runs the Migrator to create or upgrade the database and seed it;
4. starts the API, which serves the Angular app, the API, SignalR and `/health` on the same address.

Render does not offer SQL Server, so the database must be hosted somewhere else (see [Database](#database)).

| File | Purpose |
| :---- | :---- |
| `Dockerfile` | Builds Angular (Node 22) and the API and Migrator (.NET 9 SDK), then the runtime image (ASP.NET 9). |
| `.dockerignore` | Keeps `node_modules`, `bin`/`obj`, secrets and local migrations out of the build. |
| `render.yaml` | Optional Blueprint that creates the service with the settings below. |
| `deploy/render/entrypoint.sh` | Container start (steps 1 to 4). |
| `deploy/render/pin-initial-migration.sh` | Gives the generated Initial migration a content-based id (see [Model changes](#model-changes)). |
| `deploy/render/log4net.config` | Logs to the console (Render's log view) and to a file. |

## Database

You need a SQL Server database that Render can reach over the internet. Two options:

- **Azure SQL Database (recommended).** The free offer (serverless, General Purpose) is enough for a capstone demo. Read-committed snapshot, which the app expects, is on by default. In the server's **Networking** page, allow public access and add Render's outbound IP addresses for your region (Render dashboard → your service → **Connect** → **Outbound**). Use the ADO.NET connection string:
  `Server=tcp:<server>.database.windows.net,1433;Database=<db>;User ID=<user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=60;`
  A serverless database pauses when idle and takes up to a minute to wake. The container retries the migration 6 times, 15 seconds apart, and the connection timeout above covers the first request.
- **Another SQL Server you control** (2019 or later). Turn on read-committed snapshot once: `ALTER DATABASE [<db>] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE`.

Running SQL Server itself on Render (as a private service with a disk) needs at least 2 GB of memory, which means a paid plan; it is not covered here.

## Create the service

**Option A: the "New Web Service" form**

| Field | Value |
| :---- | :---- |
| Language | Docker |
| Branch | `feature/lists-toolbar` (or whichever branch has these files) |
| Root Directory | leave empty |
| Dockerfile Path | leave as the default (`./Dockerfile`) |
| Docker Build Context Directory | leave as the default (`.`) |
| Health Check Path | `/health` |
| Pre-Deploy Command, Docker Command | leave empty (the container migrates the database itself) |

Environment variables:

| Key | Value |
| :---- | :---- |
| `ConnectionStrings__Default` | The SQL Server connection string. |
| `SystemAdmin__InitialPassword` | Password for the first sign-in as `admin` (8+ characters with upper case, lower case and a digit). You are asked to change it at first sign-in. |
| `Authentication__JwtBearer__SecurityKey` | A random string of 32+ characters. Use **Generate** in the form. Changing it signs everyone out. |

Optional:

| Key | Effect |
| :---- | :---- |
| `Seed__SampleData` = `true` | Also seed the sample farm (farm code `gensan-semi`, users `owner`, `tech1`, `tech2`, password `Fpms@2026`). Use a separate database from real data. |
| `APP_URL` | The public address, if it is not the `onrender.com` address (for example a custom domain). |

**Option B: Blueprint.** Render dashboard → **New** → **Blueprint** → choose this repository and branch. Render reads `render.yaml`, generates the JWT key and asks for the connection string and the initial admin password. Edit `render.yaml` first if you want a different plan, region or branch.

## After the first deploy

Open `https://<service>.onrender.com`, sign in as `admin` with the initial password and choose a new one. `https://<service>.onrender.com/health` answers `Healthy` when the database is reachable; Render uses it to decide whether a deploy succeeded.

If the deploy fails, the log says which step failed: a missing setting (`fpms: ... is not set`), the database (`Database migration failed`), or the API.

## Model changes

The repository does not keep EF migrations (see the README). The image generates a fresh `Initial` migration at build time and names it after a hash of its content:

- **Same model, new deploy:** same name, the database is left alone.
- **Changed model** (a new column, index or table): a new name. The Migrator then tries to create every table again, fails with "There is already an object named ...", and the deploy fails while the previous version keeps running (on paid plans). Reset the database (drop and recreate it, or point `ConnectionStrings__Default` at a new empty database) and deploy again. **This deletes the data**, as resetting the Codespace database does.

## Limits of this setup

- **Free plan:** the service stops after 15 minutes without traffic, and the next visit takes about a minute to start it again.
- **No persistent disk:** log files and ASP.NET data-protection keys are lost on each deploy or restart. Sign-ins survive (they use the JWT key). Use the Render log view for logs.
- **Backups:** the scripts in `scripts/backup/` and the runbook are for the farm server. A hosted database has its own backups (Azure SQL keeps point-in-time backups automatically).
- **Health page:** disk space and certificate checks describe the container, not a farm PC, so expect warnings there.
