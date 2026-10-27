# Architecture

## System overview
Capstone is one ASP.NET Core Web API (ASP.NET Boilerplate v10.2.0 on .NET 9) and one Angular 19.2.1 single-page client. Both run on a farm-office PC and are reached over the farm LAN through HTTPS, from separate origins; no Internet is needed. A single SQL Server database holds every farm's data:
- Each farm is an ABP tenant.
- Every farm-owned row carries `TenantId` (called FarmId in the docs), and ABP's data filter adds it to every query.
- This makes the single-farm Phase 1 deployment SaaS-ready without schema changes.

Users sign in with a farm code and receive a JWT. There are three roles:
- **Farm Owner** and **Farm Technician** work inside their farm.
- **System Administrator** is a host account for setup, reference data, health and account recovery. It never reads farm records.

The production model:
- **Pond preparation:** a pond with a preparation round becomes Prepared.
- **Fry delivery:** one delivery starts one Production Cycle.
- **Batches:** one per Prepared pond.
- **Records on each batch:** feeding sessions, logs and harvests.
- **Sales:** sale lines point to harvest grade lines.

Feed and additives are tracked by a stock movement ledger. Derived values such as pond status, indicators, totals and payment status are computed on read, never stored. Full detail is in [docs/Capstone-Planning.md](docs/Capstone-Planning.md), Sections 2, 5 and 6.

## Components
### Frontend
Responsibilities:
- One page per screen in the navigation of spec Section 3, with role-filtered menus and breadcrumbs.
- Input checks that mirror the API's validation catalog: min, max and step, date limits, and searchable pickers of active same-farm records. Inline warnings for GAqP ranges, stock shortfalls and density.
- Formatting:
  - display: farm date order and 12/24-hour time, ₱, units and decimals
  - CSV exports and print pages: file names follow the fixed patterns
- Per-user form drafts in localStorage.
- A "Switch user" button for handing over a shared tablet (no idle logout, DEC-37).
- No business rules beyond input checks: the API re-validates everything.
- Zoneless change detection: pages use signals or the shared page base that refreshes after each API response, and detail pages reload when the route id changes.

Location:
- `angular/src/app/fpms/` (feature pages)
- `angular/src/shared/fpms/` (FPMS API client, page base, formatting helpers, shared components)
- `angular/src/account/` (sign-in with Farm code, farm registration, forced password change)

Communicates with: the Capstone API only, through ABP service proxies (`/api/services/app/{Service}/{Method}`). abp-ng2-module adds `Authorization: Bearer <token>`.

### API
Responsibilities:
- **Authentication:** the template's TokenAuth (4-hour token, security-stamp check per request). The tenant is resolved from the token. Permission checks use `Farm.{Area}.{Action}` / `System.{Area}` attributes.
- **Business rules:**
  - pond status precedence
  - Mark Prepared
  - Create Batch (Stocking): delivery allocation, cycle start, generated codes
  - one open batch per pond
  - batch and cycle lifecycle with Close actions
  - void with reversing stock movements
  - sold kg per grade line
  - computed indicators (`IndicatorCalculator`)
- **Validation:** every Reject and Warn rule in spec Section 5.
- **Generated records:** stock usage, codes and receipt numbers, written in the same transaction as their source.
- **Background workers:** permit expiry check, request-audit purge, backup freshness, disk and certificate checks.
- **Notifications** through ABP. **Audit log and entity history.**
- **Health endpoint and CSV export** (with the formula-injection guard).

Location:
- `aspnet-core/src/Capstone.Core/`: entities, domain services, rules, permission names, localization.
- `aspnet-core/src/Capstone.Application/`: application services and DTOs by subject area, background workers.
- `aspnet-core/src/Capstone.Web.Core/`: TokenAuth, security-stamp check.
- `aspnet-core/src/Capstone.Web.Host/`: hosting, configuration, `/health`, Swagger (Development only).

Communicates with: the Angular client; SQL Server through EF Core; the server's file system, read-only, for disk space and certificate expiry. Backups run outside the app.

### Database
Technology: SQL Server (Development: Docker inside GitHub Codespaces; Production: SQL Server Express). EF Core migrations. Read-committed snapshot on.

Stores:
- **ABP tables:** tenants, users, roles, permissions, audit logs, entity changes, notifications.
- **Farm and permits:** FarmProfile, PermitCategory, PermitPreset, PermitRecord.
- **Ponds:** PondNamePrefix, Pond, PondModification, PondPreparationRound, PondPreparationEntry.
- **Hatchery and stock:** Hatchery, HatcheryCertificate, FryDelivery, FryDeliveryStatusChange, InventoryItem, InventoryLot, StockMovement.
- **Production:** ProductionCycle, ShrimpBatch, BatchFailure, ProductionLog with WaterQualityMeasurement, GrowthSamplingDetail, ChemicalApplication and MortalityDetail; FeedingSession.
- **Harvest and sales:** SizeGrade, Harvest, HarvestGradeLine, Buyer, Sale, SaleLine, SalePayment.
- **Support:** NumberSequence, BackupRun (written by the backup scripts).
- **Host reference data:** ParameterDefinition.

Accessed through: EF Core via ABP repositories (`IRepository<TEntity, Guid>`) in `Capstone.EntityFrameworkCore`. Raw SQL is used only for row locks (`WITH (UPDLOCK, ROWLOCK)`). `Capstone.Migrator` applies migrations.

## Data flow
Example: a technician records an AM feeding session that draws from a feed lot.
1. **The user** (a Farm Technician) opens Operations, chooses the cycle and pond, ticks AM, enters 12.5 kg and picks lot "STARTER-0425".
2. **The frontend** sends `POST /api/services/app/FeedingSession/Save` with the batch ID, feed date, session AM, the lot lines (lot ID and kg), and a client-generated `ClientRequestId`.
3. **The API validates:**
   - JWT, security stamp and `Farm.Logs.Create`
   - the batch belongs to the current farm and is Stocked
   - the lots belong to the farm
   - kg > 0 and ≤ 1,000
   - feed date not in the future (server clock)
   - the `ClientRequestId` was not used before (if it was, the API returns the original session)
4. **The data layer**, in one transaction:
   - inserts the FeedingSession, or updates the existing AM session for that batch and day; on update, it writes reversing movements for the old lot lines
   - writes one Usage StockMovement per lot line, linked to the session
   - unique indexes filtered on `IsDeleted = 0` guarantee one AM session per batch per day
5. **The API returns** the session, the batch's updated cumulative feed and FCR to date, and warnings:
   - lot stock below zero
   - lot expired
   - more than 3× the 7-day average
6. **The frontend** shows the session in the batch history with the recorder, the warnings with icon and text, and the refreshed indicators. It then deletes the saved draft.

Example: Create Batch (Stocking) starts a cycle.
1. **The user** (Owner or Technician) opens Production Cycles → Create Batch (Stocking).
2. **The stepper** lists only Received deliveries not used by a cycle, and only Prepared grow-out ponds without an open batch. The user allocates PL per pond, enters batch details and pre-stocking water quality (DO, temperature, pH, salinity required), then confirms on the review step.
3. **The frontend** sends `POST /api/services/app/ProductionCycle/CreateBatches` with the delivery, the allocations and details, and a `ClientRequestId`.
4. **The API validates** the permission, farm ownership, pond and delivery states, and the date rules. Then, in one transaction:
   - locks the FryDelivery row (`UPDLOCK`) and checks Σ allocations ≤ PL received
   - locks the NumberSequence row and generates the cycle code and batch codes
   - creates the Active cycle, the Stocked batches (with pond area snapshots) and the pre-stocking logs
   - sets `UsedAt` on each pond's preparation round
5. **The API returns** the cycle with its batches and any warnings (density outside the farming-system range, readings outside GAqP ranges).
6. **The frontend** opens the cycle page; the ponds show In production because their status is computed.

## External services
- **None at run time.** No third-party API, email, SMS, payment or analytics.
- **Scheduled OS jobs** (Task Scheduler or cron), outside the app:
  - **Jobs:** full backup daily, log backup every 30 minutes, weekly `DBCC CHECKDB`, weekly encrypted off-site archive.
  - **Results:** each job writes a row to BackupRun. If a job fails or is late, the app's backup-freshness worker raises an alert on the health page and a banner for Owners.
- **Local certificate authority:** issues the server's HTTPS certificate (1 year). The renewal script is in the runbook; the health page alerts 30 days before expiry.
- **Server time sync** (Windows Time or chrony): if it fails, the health page shows the server time so drift can be noticed.

## Boundaries and rules
- **Where business logic lives:**
  - All rules are in `Capstone.Core` and `Capstone.Application`.
  - Indicator formulas exist once (`IndicatorCalculator`), as do pond rules (`PondSystemRules`) and the pond status precedence.
  - Controllers and Angular components hold no business rules.
- **Authentication and farm scope:**
  - Every endpoint requires a JWT, except sign-in and farm registration (and registration only while it is switched on).
  - The farm always comes from the token, never from client input.
  - The tenant data filter is never disabled except in reviewed System Administrator host code.
  - Host code never loads farm-owned entities.
  - Permissions are static and granted in code; there is no role editing.
- **Data integrity:**
  - No hard deletes: void with a reason. Every unique index is filtered on `IsDeleted = 0`.
  - Stock movements are never edited; corrections are reversing movements.
  - Generated records and numbers are written in the same transaction as their source.
  - Cross-row checks lock the parent row.
  - RowVersion on ShrimpBatch, ProductionCycle, FryDelivery, Harvest and Sale.
  - Closed batches and cycles are read-only in the API.
- **Never exposed to the client:** password hashes, the JWT signing key, connection strings, server paths, stack traces (users see an error reference instead), other farms' data, and any farm data to the System Administrator.
- **Time:**
  - Stored in UTC (`datetime2`); farm-local dates use `date` / `DateOnly`.
  - The server clock is the only clock; farm time comes only from FarmProfile.TimeZone (Asia/Manila).
- **Performance and security:**
  - p95 < 500 ms for ordinary API calls and < 3 s for reports, with two years of data and 5 users.
  - Lists are paginated on the server (25 rows by default, 100 at most); reports cover at most 24 months.
  - HTTPS only and LAN only.
  - CSV exports escape formula characters.
  - Do not log credentials or request payloads.

## Open architecture questions
- **None blocking.** All decisions are in decisions.md (DEC-01 to DEC-48).
- **To confirm with the adviser or partner farm, without architecture impact:**
  - water-quality recommendation texts
  - retention periods (DEC-26)
  - thresholds marked † in spec Section 5
  - structured pond-preparation fields
- New questions are raised as Proposed decisions in decisions.md before implementation.
