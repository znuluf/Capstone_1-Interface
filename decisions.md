# Technical Decisions

Decision IDs match Appendix A of [docs/Capstone-Planning.md](docs/Capstone-Planning.md) (v2.6). Do not reverse an Accepted decision without adding a new decision that supersedes it, and update the spec at the same time.

All decisions below were accepted on 2026-10-22 by the capstone development team. The full write-ups cover choices about architecture, database, authentication, hosting, APIs, libraries and security; the rest are summarized in the index.

## Index

| ID | Decision | Status |
| :---- | :---- | :---- |
| DEC-01 | Local on-premise MVP with a SaaS-ready multi-tenant model | Accepted (full write-up) |
| DEC-02 | JWT Bearer authentication and framework password hashing | Accepted (full write-up) |
| DEC-03 | SQL Server: Docker/OrbStack in development, Express in production | Accepted (full write-up) |
| DEC-04 | ASP.NET Boilerplate v10.2.0 template, generated as Capstone | Accepted (full write-up) |
| DEC-05 | Accept ABP and .NET 9 end-of-support risk for the capstone | Accepted risk (full write-up) |
| DEC-06 | Roles: Farm Owner, Farm Technician; restricted System Administrator; no developer production accounts | Accepted (full write-up) |
| DEC-07 | Angular client served from its own origin; template antiforgery unchanged | Accepted (full write-up) |
| DEC-08 | One fry delivery → one Production Cycle → batches (one per pond) → logs and harvests | Accepted (full write-up) |
| DEC-09 | Pond-level preparation; only Prepared ponds can be stocked; Create Batch (Stocking) stepper | Accepted (full write-up) |
| DEC-10 | Batch Stocked → Harvested / Failed → Closed; cycle Active → Closed | Accepted (full write-up); amended by DEC-64 (reopening, cycle outcome) |
| DEC-11 | Transport mode and time processed per batch; hatchery, batch number, PL age, PL received per delivery | Accepted |
| DEC-12 | GAqP ranges as reference data: flag with recommendations, never block | Accepted (full write-up); notifications part superseded by DEC-49; host-only ranges superseded by DEC-58 |
| DEC-13 | Daily logs: cycle → pond selection; AM/PM feeding; chemical and supplement application; three mortality causes | Accepted |
| DEC-14 | Asia/Manila for display, day boundaries and DOC (stocking day = 0); UTC storage | Accepted |
| DEC-15 | Transaction mechanism = inventory movement ledger; lot-based cost; no financial ledger | Accepted (full write-up); kept by DEC-67 and DEC-68 |
| DEC-16 | Sales keep prices and payments; dispatch receipt is internal, not a BIR receipt | Accepted |
| DEC-17 | Farm-level farming system with pond override; unusual combinations warn | Accepted; refined by DEC-52 and DEC-65 |
| DEC-18 | Permits and Licenses as reference records, no files; required presets remind on the dashboard | Accepted (full write-up) |
| DEC-19 | Structured farm address; optional total farm area | Accepted |
| DEC-20 | Ponds set up first; pond names from prefix plus number | Accepted |
| DEC-21 | Technicians may use Create Batch and edit their own entries until the batch is Closed | Accepted |
| DEC-22 | Hosting: farm-office PC on a UPS, LAN-only HTTPS with a local CA | Accepted (full write-up) |
| DEC-23 | Backups (superseded by DEC-36) | Superseded |
| DEC-24 | Pond Wi-Fi walk test; printable log sheets are P2 | Accepted |
| DEC-25 | System Administrator custody and account recovery | Accepted |
| DEC-26 | Retention periods | Accepted (confirm with adviser) |
| DEC-27 | Performance: two-year single-farm dataset, 5 users, p95 < 500 ms | Accepted |
| DEC-28 | Pilot: one deployment plus a second test farm | Accepted |
| DEC-29 | Scope: manuscript Table 6 with the P1/P2 split as revised by the panel | Accepted |
| DEC-30 | Terminology follows the manuscript's use-case names | Accepted |
| DEC-31 | No production protocols or "Today's tasks" | Accepted |
| DEC-32 | Free-text pond preparation; no post-production logging; no permit check in batch creation | Accepted |
| DEC-33 | Technicians can update fry delivery status | Accepted |
| DEC-34 | Schema in third normal form | Accepted (full write-up); "no row when not fed" revised by DEC-50 |
| DEC-35 | One validation and integrity catalog; void instead of delete | Accepted (full write-up) |
| DEC-36 | Backups: 30-minute data-loss target, 2-hour restore target | Accepted (full write-up) |
| DEC-37 | Shared-device security | Accepted (full write-up) |
| DEC-38 | Concurrency: read-committed snapshot and parent-row locks | Accepted (full write-up) |
| DEC-39 | Operations: time sync, services, health page, runbook, rollback by restore | Accepted |
| DEC-40 | Pagination, report range, audit retention, enums with explicit fixed values, CSV export, visible version | Accepted |
| DEC-41 | Naming and formatting conventions enforced by tooling | Accepted |
| DEC-42 | Fixed file-name patterns; limited configurable settings | Accepted |
| DEC-43 | Expert review fixes (soft-delete-aware indexes, generated codes, one-way stock links, and others) | Accepted (full write-up) |
| DEC-44 | Template hardening | Accepted (full write-up) |
| DEC-45 | Spec follows the existing code where sound (permissions, enums, notifications, password, lockout) | Accepted |
| DEC-46 | Reference and setup data details settled during migration step B | Accepted (full write-up) |
| DEC-47 | Production model details settled during migration step C | Accepted (full write-up); cycle outcome added by DEC-64 |
| DEC-48 | Operations details settled during migration step D | Accepted (full write-up) |
| DEC-49 | Entry-triggered checks warn inline and in summaries; notify only for time-triggered events | Accepted (full write-up) |
| DEC-50 | Daily log completeness: Not fed sessions, Daily log status, Close Batch blank-day list, no late-entry cutoff | Accepted (full write-up); amended by DEC-66 |
| DEC-51 | Reject logs dated after the Total harvest (salvage excepted) | Accepted (full write-up) |
| DEC-52 | Batch snapshots of farming system and construction; density bands as reference data | Accepted (full write-up); amended by DEC-65 |
| DEC-53 | Estimated survival % on growth sampling drives biomass | Accepted (full write-up); confirm with adviser |
| DEC-54 | One farm-wide daily feeding sheet; pond-first operations | Accepted, provisional (full write-up) |
| DEC-55 | Step E: sale transport details, dead-at-harvest count, BFAR number on the receipt | Accepted (full write-up) |
| DEC-56 | Water ranges and density bands from PNS/BAFS 197:2025 | Accepted 2026-10-26; adviser to confirm values |
| DEC-57 | Treatment record with withdrawal period (banned-substance list dropped) | Accepted 2026-10-26, warning only; banned list dropped 2026-10-26 |
| DEC-58 | Owner-editable Farm Standards (values, not protocols) | Accepted 2026-10-26 |
| DEC-59 | PL health certificate on the delivery; dead-at-stocking count | Accepted 2026-10-26 |
| DEC-60 | Top-up stocking and several deliveries per batch | Rejected 2026-10-26 (one delivery, one stocking per pond) |
| DEC-61 | Feeding sessions per day configurable | Waiting on the partner farm (AM/PM stays) |
| DEC-62 | Health milestone hints by DOC (display only) | Accepted 2026-10-26 |
| DEC-63 | Stocking window and Finish stocking | Accepted (full write-up) |
| DEC-64 | Owner reopening of batches and cycles; cycle outcome at closing | Accepted (full write-up) |
| DEC-65 | Farming systems, construction types and density bands per construction type | Accepted (full write-up) |
| DEC-66 | Logs within the batch's life; recorded time always shown | Accepted (full write-up) |
| DEC-67 | Harvest and sales options (ungraded grade, buyer's accepted kg, not-sold entries, due dates) | Accepted (full write-up) |
| DEC-68 | Inventory and indicator rules (pack sizes, lot pre-selection, cost and revenue) | Accepted (full write-up) |
| DEC-69 | Batch log calendar and closing with blank days | Accepted (full write-up) |
| DEC-70 | Optional SFSC number on the fry delivery | Accepted (full write-up) |
| DEC-71 | Optional time of feeding on a feeding session | Accepted (full write-up) |
| DEC-72 | Trace report for one batch | Accepted (full write-up) |
| DEC-73 | Flagged stock lots shown at Close Batch and on the trace report | Accepted (full write-up) |
| DEC-74 | BFAR Shrimp Grow-out Farm Certification as a required permit preset | Accepted (full write-up) |
| DEC-75 | Suggested farm code and usernames, editable before saving; unique indexes on both | Accepted (full write-up) |
| DEC-76 | No stocking window; Finish stocking prompts from the next day | Accepted (full write-up); amends DEC-63 |
| DEC-77 | A pond's construction type is fixed at creation; ponds are archived, never deleted | Accepted (full write-up); extends DEC-35 |
| DEC-78 | The Farm Owner can change the farm code; old codes stay reserved and point to the new one | Accepted (full write-up); extends DEC-75 |
| DEC-79 | A missing SFSC number is warned at stocking and at sale, and listed at Close Batch and on the trace report | Accepted; settles the hold under DEC-70 |
| DEC-84 | Trace report for one harvest lot code | Proposed (full write-up); built on `feature/lot-trace` (from `feature/harvest-tally`), not run |
| DEC-83 | Harvest lot code YY-A-LL-FF-PP-HH (year, area, barangay or municipality, farm, pond, harvest) | Proposed (full write-up); format from the adviser; built on `feature/harvest-tally`, not run |
| DEC-82 | Pricing by count and by price table, a size grade per crate, and a printable tally sheet | Proposed (full write-up); built on `feature/harvest-tally`, not run |
| DEC-81 | The buyer on the harvest, and tally sheet entry that saves a harvest and its sale together | Proposed (full write-up); built on `feature/harvest-tally`, not run; buyer profiles deferred |
| DEC-80 | Harvest tally sheet: optional crate tally with farm container presets and ABW sample on the harvest; base-ABW pricing on a sale line | Proposed (full write-up); built on `feature/harvest-tally`, not run; pricing terms need the partner farm |

---

## Decision DEC-01: Local on-premise MVP with a SaaS-ready multi-tenant model

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The capstone is piloted at one partner farm without reliable Internet, but the product could later serve many farms as a cloud service.

### Options considered
1. Cloud SaaS now: multi-farm from day one, but needs Internet the farm lacks, and hosting costs.
2. Single-farm app with no tenancy: simplest, but a later SaaS move means a schema rewrite.
3. Local deployment with a multi-tenant data model: works on the LAN and keeps FarmId on every row.

### Decision
Option 3. One on-premise deployment at the partner farm. Every farm-owned entity implements `IMustHaveTenant` (TenantId = FarmId), and ABP's data filter scopes every query.

### Why
It fits the farm's connectivity, and the template's tenancy gives SaaS readiness at almost no cost.

### Consequences
Positive:
- No schema rewrite for Phase 2.
- Farm isolation is testable now with two farms.

Negative:
- The team owns the server's security, TLS, backups and updates.

### Revisit when
Phase 2 starts, or the farm gets reliable Internet.

### Related links
- Spec Sections 1, 2 and 5; DEC-22, DEC-28

---

## Decision DEC-02: JWT Bearer authentication and framework password hashing

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The API serves an Angular client from another origin and may later serve a cloud deployment.

### Options considered
1. Cookie sessions: simple for same-origin apps, but need CSRF handling and differ from the template.
2. JWT Bearer tokens (template TokenAuth): stateless, built in, and carry over to the cloud.
3. Custom authentication: full control, but high security risk.

### Decision
Option 2. Every endpoint uses JWT Bearer tokens (4 hours, with a security-stamp check per DEC-37). Passwords are hashed only by ASP.NET Core Identity. Plaintext passwords, custom hashing and cookie-only sessions are rejected.

### Why
It is the template default, avoids writing security code ourselves, and needs no change for Phase 2.

### Consequences
Positive:
- One authentication model everywhere.

Negative:
- There are no refresh tokens, so staff sign in again after 4 hours.
- The signing key and HTTPS must be configured correctly.

### Revisit when
A refresh-token or single-sign-on requirement appears.

### Related links
- Spec Section 2, "Authentication and roles"; DEC-37, DEC-44

---

## Decision DEC-03: SQL Server, Docker/OrbStack in development and Express in production

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The team develops on macOS, which has no native SQL Server. The farm needs a free production database.

### Options considered
1. SQL Server in Docker via OrbStack for development, SQL Server Express in production: same engine everywhere, no cost.
2. Azure SQL or a shared remote server: needs Internet and money.
3. PostgreSQL or SQLite in development: native on Mac, but behaves differently from production.

### Decision
Option 1. Development uses a pinned SQL Server image in `aspnet-core/docker/sqlserver/` with the SA password in `.env`. Production uses SQL Server Express.

### Why
Identical SQL dialect and migrations in both environments, at no cost.

### Consequences
Positive:
- Migrations and query plans match production.

Negative:
- The image runs under x86-64 emulation on Apple Silicon.
- Express caps a database at 10 GB (estimated use: under 2 GB after 5 years) and has no SQL Agent, so backups are scheduled by the OS (DEC-36).

### Revisit when
The database approaches 7 GB, or Phase 2 moves to the cloud.

### Related links
- README "Run locally"; spec Section 6, "Scalability"

---

## Decision DEC-04: ASP.NET Boilerplate v10.2.0 template, generated as Capstone

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The team needs auth, tenancy, permissions, auditing and a layered solution without building them.

### Options considered
1. ASP.NET Boilerplate v10.2.0 (.NET 9, Angular 19.2.1): free, and includes all of the above.
2. ASP.NET Zero: richer, but a paid license.
3. Plain ASP.NET Core and Angular: no framework lock-in, but everything built by hand.

### Decision
Option 1, generated as `Capstone` (projects `Capstone.*`), with abp-ng2-module, zoneless Angular, and the template hardening in DEC-44.

### Why
It provides the infrastructure the spec needs and is what the team has.

### Consequences
Positive:
- A faster start on proven framework features.

Negative:
- The template's defaults must be hardened (DEC-44).
- The framework has reached end of support (DEC-05).

### Revisit when
Phase 2 planning.

### Related links
- https://github.com/aspnetboilerplate/aspnetboilerplate
- https://aspnetboilerplate.com/Pages/Documents/Zero/Startup-Template-Angular

---

## Decision DEC-05: Accept ABP and .NET 9 end-of-support risk for the capstone

Status: Accepted risk
Date: 2026-10-22
Owners: Capstone development team

### Context
ASP.NET Boilerplate support ended in May 2026, and .NET 9 support ends on 10 November 2026.

### Options considered
1. Accept the risk for the capstone and upgrade later: no schedule impact.
2. Retarget to .NET 10 LTS now: supported until November 2028, but untested with this template.
3. Switch frameworks: long-term support, but major rework.

### Decision
Option 1. Pin all versions, apply the final .NET 9 patches, and keep the server LAN-only with no Internet exposure.

### Why
The capstone timeline cannot absorb a framework migration, and LAN-only exposure limits the security impact.

### Consequences
Positive:
- No delay.

Negative:
- No security patches after 10 November 2026; this must be resolved before any Internet exposure.

### Revisit when
Phase 2, before any Internet-facing deployment, or when a critical vulnerability affects .NET 9 or ABP.

### Related links
- https://devblogs.microsoft.com/dotnet/dotnet-8-9-end-of-support/

---

## Decision DEC-06: Roles, and a restricted System Administrator

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The manuscript limits users to farm staff, but someone must install the system and recover a locked-out Owner (there is no email reset).

### Options considered
1. Only farm roles: nobody can recover a farm whose only Owner is locked out.
2. Developers as full-access users: breaks farm data privacy.
3. Farm roles plus a restricted host-level System Administrator.

### Decision
Option 3. Static roles are FarmOwner, FarmTechnician and SystemAdministrator, with permissions granted in code and no role editing.

The System Administrator handles:
- installation
- farm activation and the registration switch
- reference data (water-quality ranges and recommendations)
- the health page and the security and error logs
- account recovery

It cannot read farm production, stock, sales or permit records. Developers have no personal production accounts.

### Why
It gives recovery and maintenance without exposing farm data.

### Consequences
Positive:
- A safe recovery path.
- A clean platform-operator role for Phase 2.

Negative:
- Host code must never load farm-owned entities, which needs dedicated tests (AC-21).

### Revisit when
Phase 2 SaaS operations.

### Related links
- DEC-25, DEC-44; spec permissions table

---

## Decision DEC-07: Angular client served from its own origin

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The template adds cookie-based antiforgery validation to API actions. On the same origin, the browser sends cookies and the template's sign-in call fails its antiforgery check.

### Options considered
1. Serve the client from its own origin, listed in `App:CorsOrigins`.
2. Serve the client from the API host and add the XSRF header to sign-in.
3. Turn off antiforgery validation.

### Decision
Option 1, in both development (port 4200 vs the API port) and production (two sites on the farm PC).

### Why
No code change, the template's configuration stays intact, and it matches a future SaaS layout.

### Consequences
Positive:
- Sign-in and API calls work as tested.

Negative:
- Two sites and two certificates to configure; CORS must list the client origin.

### Revisit when
A deployment needs one address behind a reverse proxy.

### Related links
- Spec Section 2, "Hosting"

---

## Decision DEC-08: One fry delivery → one Production Cycle → batches

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The manuscript defines a cycle as rearing shrimp from one fry source batch. The panel asked for multiple batches per cycle and multiple batches on the same day.

### Options considered
1. One cycle = one pond: simplest, but contradicts the definitions.
2. One cycle per fry delivery, with one batch per pond.
3. One cycle per hatchery with several deliveries: more flexible, but weakens traceability to a single source.

### Decision
Option 2. A FryDelivery starts exactly one ProductionCycle. Each ShrimpBatch is that delivery's share in one pond and records transport mode, time processed and stocking count. Logs, feeding sessions and harvests belong to the batch; cycle and pond come from the batch.

### Why
Daily data and indicators are per pond, and batches with the same genetic source can be compared.

### Consequences
Positive:
- Clear traceability from sale back to grade, harvest, batch, pond, delivery and hatchery.

Negative:
- A second delivery, even from the same hatchery, starts a new cycle.

### Revisit when
The partner farm models nursery-to-grow-out transfers.

### Related links
- Spec "Core definitions"; DEC-09, DEC-10, DEC-11

---

## Decision DEC-09: Pond-level preparation and the Create Batch (Stocking) stepper

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The panel required that unprepared ponds never receive fry, that the source is chosen before initializing, and that the process is continuous with a review step.

### Options considered
1. Keep batch-level preparation and block stocking until the pond is marked Prepared.
2. Prepare on the pond, then use a stepper that creates the cycle and its batches in one save.

### Decision
Option 2.

**Preparation:** preparation rounds hold free-text entries, and Mark Prepared needs at least one entry.

**The stepper:**
- Steps: fry source → Prepared ponds with PL allocation → batch details with pre-stocking water quality → review → create.
- The first creation from a delivery starts the cycle; later creations add batches to it.
- Each round gets `UsedAt` when its batch is stocked.

### Why
It matches the panel's required order with one transaction and no empty "Planned" state.

### Consequences
Positive:
- A pond cannot receive fry unless it is Prepared.
- One guided flow.

Negative:
- A pond's previous batch must be Closed before it can be stocked again; the stepper explains this.

### Revisit when
The farm wants to plan cycles in advance.

### Related links
- Spec Journeys 2 and 3; AC-07 to AC-10

---

## Decision DEC-10: Batch and cycle lifecycle

Status: Accepted; amended by DEC-64 (2026-10-26): the Owner can reopen a Closed batch or cycle with a reason, and the cycle outcome is recorded at closing. "No reopening" below no longer applies.
Date: 2026-10-22
Owners: Capstone development team

### Context
The manuscript's use cases include Close Batch and Close Production Cycle. Records must lock so final indicators stay fixed.

### Options considered
1. Lock only at cycle close.
2. Close each batch, then close the cycle.

### Decision
Option 2.
- **Batch:** Stocked → Harvested (after a Total harvest) or Failed (Declare Batch Failure) → Closed by the Owner.
- **Cycle:** Active → Closed, when every batch is Closed.
- Closed records are read-only. Sales and payments can still be recorded. There is no reopening in Phase 1.

### Why
Corrections stay possible until the Owner is satisfied, and each pond can be released independently.

### Consequences
Positive:
- Final FCR, survival and ABW never change after Close Batch.

Negative:
- Owners must remember to close batches; the dashboard lists Harvested and Failed batches awaiting closing.

### Revisit when
The adviser requires reopening with an audit trail.

### Related links
- AC-15 to AC-17

---

## Decision DEC-12: GAqP ranges flag with recommendations, never block

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The manuscript cites GAqP (PNS/BAFS 197:2017) optimal ranges, and the panel asked for recommendations when values go beyond thresholds. A bad reading is real data.

### Options considered
1. Reject out-of-range readings: loses real problem data.
2. Save and flag, show a recommendation, and reject only physically impossible values.
3. Save after a confirmation dialog: extra friction at the ponds.

### Decision
Option 2. The ranges are host reference data:

| Parameter | Optimal range |
| :---- | :---- |
| DO | 5.0–9.0 ppm |
| Temperature | 28–32 °C |
| pH | 7.0–8.3 |
| Salinity | 15–35 ppt |
| TAN | < 0.03 ppm |
| Nitrite | < 1.0 ppm |
| Alkalinity | > 100 ppm |
| Nitrate | recorded only |

Each parameter has low-side and high-side recommendation texts, reviewed by the adviser. Alerts are grouped as one per pond per day. `IsOutOfRange` is stored with each reading.

### Why
Alerts are only useful if the bad readings are saved.

### Consequences
Positive:
- Complete history with timely advice.

Negative:
- The recommendation texts need adviser review before release.
- A strict TAN limit may produce frequent alerts.

### Revisit when
The adviser supplies different ranges, or GAqP is revised.

### Related links
- Spec Section 5, water-quality table

---

## Decision DEC-15: Inventory movement ledger with lot-based cost

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
Manuscript Objective 2 requires a transaction mechanism. The team removed the financial bookkeeping ledger. Feed and additives must be traceable by lot.

### Options considered
1. A stored quantity per item, updated in place: unexplainable when wrong.
2. A movement ledger per lot with a moving-average cost: back-dated receipts rewrite past costs.
3. A movement ledger per lot, with cost taken from each lot's receipt price.

### Decision
Option 3.
- Quantity on hand = Σ a lot's movements (receipt, usage, adjustment).
- Usage links one way to its source (feeding session or chemical application), so one session can draw from several lots.
- Usage cost = quantity × the lot's unit cost.
- A shortfall warns but does not block.
- Movements are never edited; corrections are reversing movements.
- There is no financial ledger.

### Why
Every balance and cost is explainable and exact, and field logging is never blocked.

### Consequences
Positive:
- Lot traceability and exact batch costs.

Negative:
- Negative balances can occur and need Owner reconciliation.

### Revisit when
The farm wants bookkeeping or FIFO valuation.

### Related links
- AC-11, AC-22

---

## Decision DEC-18: Permits and Licenses as reference records without files

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The panel asked for multiple uploads, but hard copies stay in the farm office, and file storage adds backup and upload-security work.

### Options considered
1. Files with an approval step.
2. Files without approval.
3. Reference records only (no files), with attachments deferred.

### Decision
Option 3.
- Each record holds: category, preset or custom title, reference number, agency, issue date, expiry date or perpetual, and the hard copy's location.
- Records can be renewed and archived, never deleted.
- Expiry reminders are sent.
- Required presets show on the dashboard only and never block stocking.
- File attachments are P2.

### Why
It keeps what the farm needs without file infrastructure.

### Consequences
Positive:
- Backups are database-only.
- There is no upload attack surface.

Negative:
- The response to the panel must explain the deferral.
- Inspectors see the hard copy, not a scan.

### Revisit when
The adviser or panel insists, or a regulator requires digital copies.

### Related links
- AC-05; roadmap "Later"

---

## Decision DEC-22: Hosting on a farm-office PC

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
Phase 1 must work without Internet and survive frequent power interruptions.

### Options considered
1. A dedicated farm-office PC on the LAN.
2. A team laptop brought to the farm: not always available.
3. A cloud VM: needs Internet.

### Decision
Option 1:

| Item | Choice |
| :---- | :---- |
| Hardware | 8–16 GB RAM, SSD, on a UPS with shutdown software; BIOS set to power on after AC loss |
| Operating system | Windows 11 Pro or Ubuntu LTS |
| Database | SQL Server Express |
| Services | API and client as auto-starting services |
| Network | LAN only, fixed IP, no port forwarding |
| HTTPS | A 1-year server certificate from a local root CA installed on farm devices |
| Clock | Automatic time sync |
| Recovery | A standby machine for restores |

### Why
Always-on service on the LAN at low cost.

### Consequences
Positive:
- Works during Internet and power interruptions.

Negative:
- Every new device needs the root certificate.
- Certificates must be renewed yearly (the health page alerts).

### Revisit when
Phase 2.

### Related links
- DEC-36, DEC-39; spec Section 6

---

## Decision DEC-34: Schema in third normal form

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The earlier schema copied keys, used AM/PM repeating columns, and stored derived values that could drift from their sources.

### Options considered
1. Keep the denormalized fields for convenience.
2. Third normal form, with derived values computed on read and documented exceptions.

### Decision
Option 2.
- **Computed on read:** pond status, totals, payment status, ABW and indicators.
- **Rows instead of columns:** AM/PM feeding becomes session rows; the quantity used lives only on stock movements.
- **History tables:** payments, certificates and delivery status changes.
- **Links:** sale lines point to harvest grade lines; size grades are a farm table.
- **Allowed snapshots:** pond area at stocking, water-quality flags, lot unit cost, and generated codes.

### Why
One source of truth per fact, so nothing drifts.

### Consequences
Positive:
- Fewer integrity bugs, and easier offline sync in Phase 2.

Negative:
- Indicators are computed per request. At this scale that is fine; a cache would be rebuildable from source.

### Revisit when
Reports exceed the 3-second target.

### Related links
- Spec Section 5, "Allowed snapshots and caches"

---

## Decision DEC-35: One validation and integrity catalog; void instead of delete

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
Rules were scattered, and deleting production records breaks traceability and stock.

### Options considered
1. Rules decided per screen, with hard deletes allowed.
2. One catalog (Reject, Warn, Info) enforced in the API and repeated on screen; void with a reason and reversing stock movements.

### Decision
Option 2.
- The catalog in spec Section 5 covers general input rules, field limits and thresholds, lifecycle guards, edits and voids, concurrency, and database constraints.
- Only Owners void.
- Values marked † are team defaults to confirm.

### Why
It gives consistent behavior and complete history.

### Consequences
Positive:
- Every rule is testable (AC-20).

Negative:
- More tests to write.
- Some thresholds need adviser confirmation.

### Revisit when
The adviser revises a threshold.

### Related links
- AC-20, AC-22

---

## Decision DEC-36: Backups, at most 30 minutes of data lost and service back within 2 hours

Status: Accepted (supersedes DEC-23)
Date: 2026-10-22
Owners: Capstone development team

### Context
A single server PC could fail, and daily backups alone could lose a day of logs. SQL Server Express has no SQL Agent and no backup encryption.

### Options considered
1. Daily full backups only: up to 24 hours lost.
2. Full recovery model with daily full and 30-minute log backups, OS-scheduled, plus a standby machine.

### Decision
Option 2.

| Item | Choice |
| :---- | :---- |
| Schedule | Full backup daily at 01:00 and a log backup every 30 minutes, using `sqlcmd` scripts on Task Scheduler or cron, made `WITH CHECKSUM` |
| Copies | To an external drive at once; a weekly AES-256 archive kept off-site |
| Retention | 14 days of backups on the drive and 8 weekly copies off-site |
| Checks | Weekly `DBCC CHECKDB`; a monthly timed restore to a cold standby machine |
| Monitoring | Results are written to BackupRun and shown on the health page |

File names follow DEC-42.

### Why
It meets realistic targets without paid features.

### Consequences
Positive:
- At most 30 minutes of data lost, and service back within 2 hours.

Negative:
- Needs a standby machine and an off-site routine kept by the Owner.

### Revisit when
Phase 2 moves to managed cloud backups.

### Related links
- AC-24, AC-26; spec Section 6, "Reliability"

---

## Decision DEC-37: Shared-device security

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
Technicians share tablets at the ponds. The template issues 1-day tokens and does not refresh them.

### Options considered
1. Template defaults: logs get recorded under the wrong person, and stolen tokens stay valid for a day.
2. Shorter tokens, a server-side revocation check, and per-user drafts (a 15-minute idle logout was part of this option until the amendment below).

### Decision
Option 2.
- **Sessions:** a 4-hour JWT. No idle logout (amended 22 Oct 2026: the team removed it; a user hands over a tablet with "Switch user").
- **Revocation:** a security-stamp check on every request, so deactivating a user or resetting a password ends their sessions at once.
- **Passwords:** at least 8 characters with an uppercase letter, a lowercase letter, and a digit; lockout after 5 failures for 15 minutes.
- **Tablet screen:** a "Switch user" button, and the signed-in name always shown.
- **Drafts:** per-user form drafts in localStorage, kept for up to 24 hours.

### Why
Correct attribution and limited exposure on shared devices.

### Consequences
Positive:
- Entries are recorded under the right person.

Negative:
- Staff sign in more often.
- Without idle logout, a tablet left signed in keeps that user's session for up to 4 hours; entries made by someone else are recorded under the signed-in user.

### Revisit when
Devices become personal, refresh tokens are added, or wrong-person entries are seen at the farm (then reintroduce an idle logout).

### Related links
- AC-25; DEC-44

---

## Decision DEC-38: Read-committed snapshot and parent-row locks

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
Reports must not block saves at the ponds. Some rules span rows, so two users could both pass the same check at once.

### Options considered
1. Default locking: reports block writers, and write skew is possible.
2. Read-committed snapshot, plus `UPDLOCK` on parent rows for checks that span rows, plus unique indexes for single-row rules.

### Decision
Option 2.
- **Read-committed snapshot:** enabled outside a transaction (`suppressTransaction: true` or the Migrator).
- **Row locks:** FryDelivery (allocation), HarvestGradeLine (sold kg) and NumberSequence (codes and receipt numbers) are locked with `FromSqlRaw … WITH (UPDLOCK, ROWLOCK)` inside the ABP unit of work.
- **RowVersion:** on ShrimpBatch, ProductionCycle, FryDelivery, Harvest and Sale.

### Why
Consistent reads, no blocking, and no over-allocation.

### Consequences
Positive:
- AC-23 holds under concurrent use.

Negative:
- Raw SQL for the locks must be reviewed carefully.

### Revisit when
Phase 2 moves to a different database or isolation model.

### Related links
- AC-23; spec "Concurrency and duplicates"

---

## Decision DEC-43: Expert review fixes

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
A full-stack review of spec v2.1 found designs that would fail or misbehave on ABP, EF Core or SQL Server.

### Options considered
1. Fix them during coding.
2. Fix them in the spec before coding.

### Decision
Option 2.
- **Unique indexes** are filtered on `IsDeleted = 0`, with explicit void fields.
- **Generated codes** (pond, cycle, batch, dispatch receipt) are stored once, using a locked NumberSequence. They are not cross-table computed columns.
- **Stock movements** link one way to their source.
- **Preparation rounds** get `UsedAt`.
- **Read-committed snapshot** is enabled outside a transaction.
- **Entity history** is enabled for the listed entities.
- **Background workers** run the scheduled checks.
- **Notifications** use the existing farm notification tables, with grouped water-quality alerts (DEC-45).
- **Cost** is taken from each lot.
- **CSV exports** escape formula characters.
- **Individual buyers** get a privacy notice.
- **Pond status** follows a defined precedence.
- **Angular pages** are zoneless-safe.
- **Column types:** `DateOnly` for farm dates and `datetime2` for timestamps.

### Why
These are cheap to fix on paper and costly once code exists.

### Consequences
Positive:
- Fewer rewrites.

Negative:
- None identified.

### Revisit when
Implementation finds a framework limitation.

### Related links
- Spec v2.2 changes; test checkpoint "Review fixes"

---

## Decision DEC-44: Template hardening

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
The generated template ships defaults that conflict with the spec and with basic security.

### Options considered
1. Keep the defaults and work around them.
2. Change them in Milestones 1 and 2.

### Decision
Option 2.

**Remove:**
- the Default tenant and the `admin`/`123qwe` passwords
- tenant user self-registration
- role editing and the template's host pages (replaced by System Administration)

**Change:**
- the "Change tenant" dialog becomes a Farm code field on the sign-in form
- the token becomes 4 hours
- the password policy (upper, lower, digit) and lockout (15 minutes) are already in place
- `Clock.Provider` is UTC, with FarmProfile.TimeZone as the only farm time zone (the ABP timing setting is unused)

**Limit and enable:**
- Swagger in Development only
- entity history for the listed entities

### Why
Every default left in place is either a security hole or a behavior the spec forbids.

### Consequences
Positive:
- A secure baseline that matches the spec.

Negative:
- Template upgrades must reapply these changes, but none are planned (DEC-05).

### Revisit when
The template is regenerated or upgraded.

### Related links
- Spec Section 2, "Template hardening"; roadmap Milestone 2

---

## Decision DEC-46: Reference and setup data details (migration step B)

Status: Accepted
Date: 2026-10-22
Owners: Capstone development team

### Context
Building step B showed details the spec left open: how a prefix's initials become a pond code when two prefixes share initials, what happens to the pond's old free-text name, when a hatchery short code may change, and how existing farms get the new permit categories.

### Options considered
1. Derive everything on the fly from names.
2. Store the short codes, keep the old data, and change existing farms only where it is safe.

### Decision
Option 2.
- **Pond prefixes** store a short code (1–6 letters, unique per farm), suggested from the initials and fixed once created. Pond code = short code + two-digit number ("GP-03"). The pond's name is not stored: it is the prefix name plus the number ("Grow-out Pond 3"). The number defaults to the next free one; prefix and number are fixed after creation.
- **Existing ponds** keep their codes. A code that already reads short code + number gets that prefix; any other gets a "Pond" (P) prefix and the next number. The old free-text name moves into the pond's notes ("Former name: …").
- **Hatchery short codes** are generated from the name's initials for existing hatcheries (a duplicate gets its last letter replaced) and can change only until a cycle uses the hatchery, because cycle codes include it.
- **Permits and Licenses**: existing farms' categories are renamed to the spec names and the missing categories are added with their presets, but existing presets stay in their category (no records move). New farms get the spec layout.
- **Size grades** are seeded with 30/40 to 100/120 plus any label already used on harvest lines.
- **Recommendation texts** are seeded as drafts for the adviser to review; the System Administrator edits them.
- **NumberSequence** takes numbers with one `MERGE … WITH (HOLDLOCK)` statement in the caller's transaction.

### Why
Codes that never change, no lost data, and no record moved without the Owner knowing.

### Consequences
Positive:
- Pond and cycle codes stay stable and readable.

Negative:
- An existing farm's permit presets may sit in an older category until the Owner moves them.
- A pond converted to the "Pond" prefix keeps a code like "P-01", which does not match its new name.

### Revisit when
The team wants existing ponds or presets renamed or moved; that is an Owner edit, not a migration.

### Related links
- Spec Section 5 (PondNamePrefix, Pond, Hatchery, PermitCategory, SizeGrade, NumberSequence); docs/gap-analysis.md conversions 8, 11, 12, 14

---

## Decision DEC-47: Production model details (migration step C)

Status: Accepted
Date: 2026-10-23
Owners: Capstone development team

### Context
Step C replaced Planned cycles and batches with fry deliveries, pond preparation rounds and the Create Batch (Stocking) stepper. Existing data and some code names needed rules the spec left open.

### Options considered
1. Rename everything to the spec's names and rebuild existing data by hand.
2. Keep the code's names where nothing user-visible changes, convert existing data by fixed rules, and keep old codes.

### Decision
Option 2.
- **Names in code:** the batch entity stays `PondBatch` (table `FpmsPondBatches`); screens say "Batch". The stocking count stays `PlCountStocked`.
- **Existing cycles** each get a fry delivery with the same id, status Received, PL received = Σ stocked, PL age and batch number from the old batch fields (the cycle code when missing or duplicated). Old cycle and batch codes are kept; new ones are generated ("2026-11-SBH-01", "-A").
- **Planned batches** are voided (soft-deleted, kept as history). Their preparation logs became the pond's open preparation round; preparation logs of stocked batches became used rounds. A Planned cycle left with no batch is voided too.
- **Failed cycles** become Active, or Closed when every batch is closed; batch failure fields moved to BatchFailure (reason "no reason given" when it was empty).
- **Pond area snapshot** for existing batches comes from the stored density when it differs from the current pond area, else the pond area. Transport mode = Other, time processed = not recorded.
- **Corrections:** Harvested and Failed batches accept new logs (corrections and notes) until Close Batch. Pond preparation can no longer be logged on a batch.
- **Mark Harvested** stays as a separate Owner action until step E makes the Total harvest do it.
- **PL age** may be empty only on converted deliveries; new deliveries require it.

### Why
No data is lost, codes printed on earlier records stay valid, and the change is limited to what users see.

### Consequences
Positive:
- Existing records keep working under the new model, and the conversion is repeatable.

Negative:
- Converted cycles have one delivery each even if the farm really received several.
- Records attached to a voided Planned batch are hidden with it; restore from backup if any are needed.

### Revisit when
The team wants the code names to match the spec exactly, or a farm reports a converted delivery that should be split.

### Related links
- Spec Section 5 (Production, Hatchery, fry, and stock); docs/gap-analysis.md conversions 1–3

---

## Decision DEC-48: Operations details (migration step D)

Status: Accepted
Date: 2026-10-23
Owners: Capstone development team

### Context
Step D replaced feeding rounds with AM/PM feeding sessions, treatments with chemical and supplement applications, and the seven mortality causes with three. Existing logs needed conversion rules, and a few behaviors the spec describes needed concrete choices.

### Options considered
1. Drop the old detail tables and keep only what maps cleanly.
2. Convert by fixed rules, keep the old detail tables as read-only archives, and keep the original values in text where the new model has no field.

### Decision
Option 2.
- **Feeding rounds → sessions (conversion 4):** a round before 12:00 farm time becomes AM, otherwise PM. Several rounds of one batch, day and session merge into one session; their usage movements (and reversals) move to the session, so feed totals and FCR do not change. Round number, method and tray fields are not carried over; adjustment notes and log notes become the session's notes. The old feeding logs are hidden with the void reason "Converted to a feeding session (step D)". `FpmsFeedingConversion_Archived` keeps the movement-to-log map.
- **Treatments → chemical and supplement applications (conversion 5):** the reason starts with the old intervention type ("Probiotic: …"); dosage and outcome are added to the log notes. Water pumping and water exchange without a product become general notes.
- **Mortality causes (conversion 6):** Disease keeps its disease name (WSSV, AHPND/EMS, "Other disease" or "Not specified"); Water quality stays; Stress, Cannibalism, Predation, Unknown and Other become Others with the old cause as the description.
- **Lot cost (conversion 10):** a lot's unit cost is its first receipt's unit cost; usage and adjustment movements carry their lot's cost; the moving average is dropped.
- **Archives:** the old tables are renamed `FpmsFeedingDetails_Archived` and `FpmsTreatmentDetails_Archived`, not dropped.
- **Feeding sessions:**
  - Their stock movements are timed 06:00 (AM) or 16:00 (PM) farm time on the feeding day.
  - Saving a session that already exists corrects it: the old usage is reversed and the new lots are drawn.
  - A Technician corrects only sessions they recorded.
  - One page, Operations → Feeding, records every pond of a cycle for a day; the batch page links to it.
- **Void:** Owners only, with a required reason; the reason is saved before the soft delete, because ABP reloads the row when it soft-deletes it. A voided session or log can be entered again.
- **Water-quality alerts:** one notification per pond per farm day; the dashboard groups that day's out-of-range readings of a pond into one row with Low/High labels.
- **Operations choice:** each user's last cycle and pond are remembered in the browser.
- **Drafts (AC-25):** log, feeding and preparation forms keep a browser draft keyed by farm and user, deleted on save, on discard, or after 24 hours. The harvest form gets one in step E.
- **Preparation entries** now carry a ClientRequestId (a step C omission); existing entries get a generated one.
- **Integrity:**
  - One reading per parameter per log (unique index).
  - A usage movement has a log or a feeding session as its source, never both (check constraint).
  - A rejected log saves nothing: all Reject rules are checked before the first write.

### Why
No feed, cost or health record is lost; indicators computed before and after the conversion match (the reference batch keeps FCR 1.2 and survival 71.25%).

### Consequences
Positive:
- Feeding entry matches the farm's AM/PM practice and supports several lots per session.
- The lot ledger names each movement's source (for example "PM feeding, 2026-10-22").

Negative:
- Feeding method and tray-check values are only in the archive table.
- Converted feeding sessions created from rounds after 12:00 that were really morning feeds (late entries) are labeled PM.

### Revisit when
The technician confirms structured fields for feeding (method, tray checks) or preparation, or the farm needs more than two feeding sessions a day.

### Related links
- Spec Section 5 (FeedingSession, StockMovement, ChemicalApplication, MortalityDetail); Section 6 (form drafts); docs/gap-analysis.md conversions 4–6 and 10

---

## Decision DEC-49: Entry-triggered checks warn inline; notify only for time-triggered events

Status: Accepted
Date: 2026-10-25
Owners: Capstone development team
Supersedes: the water-quality and stock notification parts of DEC-12 and the spec's Notifications row

### Context
Every record is logged by hand. The person entering a reading already sees the inline flag and recommendation. A notification repeats it, and for a late entry it arrives days after the fact.

### Options considered
1. Keep notifications for every flagged entry (current step D build).
2. Warn inline at entry, count in dashboard summaries and reports, and notify only for events nobody types: permit expiry and operational alerts.

### Decision
Option 2. Entry-triggered: water quality out of range, high mortality, feeding spikes, expired lot used, density outside its band, stock below zero. Time-triggered (notified): permit expiry; backup, disk and certificate alerts. Low stock and lots expiring soon are dashboard lists.

### Consequences
Positive:
- No stale alerts from late entries; fewer notifications to ignore.
- The panel's request for recommendations beyond thresholds is still met inline.

Negative:
- The step D grouped water-quality notifications are retired (code change in step F).
- Owners must look at the dashboard and reports to see entry-triggered problems.

---

## Decision DEC-50: Daily log completeness and late entry

Status: Accepted; amended by DEC-66 (2026-10-26): entries must fall within the batch's life, and histories always show the recorded time
Date: 2026-10-25
Owners: Capstone development team
Revises: DEC-34 ("a session that was not fed has no row")

### Context
With manual logging, a missing feeding row can mean "not fed" or "not logged yet". Staff may log at the end of the day, week or later.

### Decision
- FeedingSession gets Status (Fed, NotFed). NotFed has no stock movement.
- Daily records (AM and PM feeding; water quality once a day) appear in a **Daily log status** view as logged, Not fed or blank. Blank is neutral, never "overdue". Event records (mortality, growth sampling, chemicals, harvest) show the time since the last log instead.
- Close Batch lists blank feeding and water days before the confirmation.
- Late entry has no cutoff while the batch is not Closed. No late badge.
- This is a status view, not the "Today's tasks" removed by DEC-31: nothing is scheduled or assigned.

### Consequences
Positive:
- Owners can see gaps; closing too early is caught.

Negative:
- One more choice in the feeding sheet; a schema change to FeedingSession.

---

## Decision DEC-51: Reject logs dated after the Total harvest

Status: Accepted
Date: 2026-10-25
Owners: Capstone development team

### Context
Harvested batches accept corrections until Close Batch, so a late entry could be dated after the Total harvest and count feed in a finished batch's FCR.

### Decision
Reject any log or feeding session dated after the batch's Total harvest date. Salvage records of a Failed batch are exempt.

### Consequences
Positive: final indicators cannot be distorted by misdated entries.
Negative: an entry with a wrong date must be corrected before saving.

---

## Decision DEC-52: Batch snapshots and density bands as reference data

Status: Accepted; amended by DEC-65 (2026-10-26): bands per construction type (no Earthen/Lined grouping); flag values Within, Below, Above
Date: 2026-10-25
Owners: Capstone development team
Refines: DEC-17 and the density rule of DEC-35

### Context
Farming system and construction type are read live from the pond and farm. An upgraded pond (for example earthen to HDPE-lined) would change how old batches are judged, which contradicts the rule already applied to pond area and water flags.

### Decision
- ShrimpBatch stores FarmingSystemAtStocking, ConstructionTypeAtStocking and DensityFlag (Within, Below, Above, BetweenBands) at stocking.
- Density bands move to host reference data (DensityBand: farming system, construction group Earthen or Lined, min and max PL/m², source). Seeded with the manuscript bands until DEC-56 is decided.
- Warning only, never block. A major rebuild may also be recorded by retiring the pond and creating a new one.

### Consequences
Positive: history is stable; bands can follow PNS/BAFS 197:2025 without code changes.
Negative: a migration backfills existing batches from current pond values (best available).

---

## Decision DEC-53: Estimated survival drives remaining population and biomass

Status: Accepted (confirm the method with the adviser)
Date: 2026-10-25
Owners: Capstone development team

### Context
Remaining population was stocking count minus logged mortality minus harvested pieces. Most dead shrimp are never seen, so remaining population and biomass are overstated and FCR to date looks better than it is. InitialSurvivalEstimatePct was collected but unused.

### Decision
GrowthSamplingDetail gets EstimatedSurvivalPct (optional). With an estimate, remaining = StockingCount × latest estimate − mortality logged after that sample − pieces harvested after it. Without one, the old formula applies. The batch shows which basis is used. Final survival (from harvested pieces) is unchanged.

### Consequences
Positive: more realistic biomass and FCR to date.
Negative: depends on staff estimates; the reference batch test must cover both bases.

---

## Decision DEC-54: One farm-wide daily feeding sheet; pond-first operations

Status: Accepted, provisional (revisit after partner-farm feedback)
Date: 2026-10-25
Owners: Capstone development team

### Context
The feeding sheet is one page per cycle and day. With two deliveries running, a technician walking every pond opens two sheets. Technicians think in ponds, not cycles.

### Decision
One daily sheet lists every open batch on the farm, grouped by pond, with the cycle and batch code shown. Operations choose the pond first. A logged cell shows kg, lot, who and when, and opens for editing only on request.

### Consequences
Positive: one morning round, one page; overwriting another person's entry needs a deliberate Edit.
Negative: changes the step D feeding page and Journey 4.

---

## Decision DEC-55: Step E additions (transport, dead at harvest, BFAR number)

Status: Accepted
Date: 2026-10-25
Owners: Capstone development team

### Context
PNS/BAFS 338:2022 and 135:2025 (8.4.2.6) expect transport details and a Local Transport Permit for shipments; the Shrimp Farmers' Manual form records mortalities during harvest.

### Decision
Sale gets optional Transporter, DriverName, PlateNo, LoadedAt, Destination, LocalTransportPermitNo and TemperatureNote. Harvest gets optional DeadAtHarvest. The dispatch receipt prints the farm's BFAR registration number from a current permit record.

### Consequences
Positive: covers the traceability transport gap while step E is open.
Negative: more optional fields; permit numbers are typed, not validated.

---

## Decision DEC-56: Water ranges and density bands from PNS/BAFS 197:2025

Status: Accepted 2026-10-26 as defaults (verify values against the PDF; adviser sign-off). Nitrate 0.6–1.2 ppm is added from the same table; TAN and nitrate flag only high values.
Date: 2026-10-25

DEC-12 cites PNS/BAFS 197:2017, now replaced. Proposed vannamei values (Annex B): DO ≥ 4 ppm; temperature 25–30 °C; pH 7.5–9.0; salinity 15–25 ppt; unionized ammonia ≤ 0.2 ppm (total 0.1–1.0); nitrite ≤ 0.5 ppm; alkalinity 100–200 ppm. Density (Annex C): extensive 1–30; semi-intensive 40–60; intensive 70–90 (earthen) or 100–140 (lined) PL/m². Data-only change via ParameterDefinition and DensityBand; stored flags keep history.

---

## Decision DEC-57: Treatment record with withdrawal period and banned-substance list

Status: Accepted 2026-10-26, warning only. Amended 2026-10-26: the banned-substance list and its warning are dropped (not needed for the pilot); the item's active ingredient stays as plain information.
Date: 2026-10-25

PNS/BAFS 135:2025 (9.12, 9.13, Annex A), 338:2022 and the explanatory manual expect dosage, duration, withdrawal compliance and prescription control. Proposal: InventoryItem gets ActiveIngredient and DefaultWithdrawalDays; ChemicalApplication gets a structured type, Dosage, Method, EndDate, WithdrawalDays (prefilled) and PrescriptionRef; safe harvest date computed on read; a host BannedSubstance list seeded from 135:2025 Annex A warns on a matching ingredient; harvest before a safe harvest date warns. Not a protocol (DEC-31 stands).

---

## Decision DEC-58: Owner-editable Farm Standards

Status: Accepted 2026-10-26. Also holds the DEC-63 stocking window and the buyer weight-difference threshold (DEC-67).
Date: 2026-10-25

One settings page with values, not workflows: farm overrides of water ranges, density bands and an optional per-pond design maximum density, feeding and mortality thresholds, which alert lists show, expiring-soon days. Defaults from the standards with the source shown, "Reset to standard", and a "differs from standard" badge. Changes apply forward only; Owners edit, Technicians read. Offered as a step in the onboarding checklist. Supersedes DEC-12's host-only ranges if accepted.

---

## Decision DEC-59: PL health certificate on the delivery; dead-at-stocking count

Status: Accepted 2026-10-26
Date: 2026-10-25

FryDelivery gets PlHealthCertificateNo and an optional TransportPermitNo; ShrimpBatch gets an optional DeadAtStocking count (Shrimp Farmers' Manual stocking form).

---

## Decision DEC-60: Top-up stocking and several deliveries per batch

Status: Rejected 2026-10-26: the partner farm stocks each pond once from one delivery; no nursery transfers (DEC-63)
Date: 2026-10-25

The manual's form separates initial, replenishment and additional stocking. DEC-08 allows one delivery per cycle and one stocking event per batch. If the farm tops up ponds, add a stocking table (batch, delivery, count, date, timing) and revise DEC-08. Decide after the farm answers.

---

## Decision DEC-61: Feeding sessions per day

Status: Waiting on the partner farm (2026-10-26); AM/PM stays until it answers
Date: 2026-10-25

The roadmap reports most farms feed about four times a day; the system records AM and PM. Making sessions per day configurable changes the FeedingSession key. Decide after the farm answers.

---

## Decision DEC-62: Health milestone hints by DOC

Status: Accepted 2026-10-26, display only (scope permitting)
Date: 2026-10-25

Show hints such as "PCR test suggested around DOC 30, 45, 60, 75" (Shrimp Farmers' Manual) on the batch timeline. Display only: no tasks, no overdue state (DEC-31 stands). A lab-result log may follow later.

---

## Decision DEC-63: Stocking window and Finish stocking

Status: Accepted
Date: 2026-10-26
Owners: Capstone development team
Amends: DEC-09 (Journey 3 "same day or later"); settles DEC-60

### Context
A fry delivery is often split across several ponds, but each pond is stocked once, with a hand count, and there are no nursery transfers or top-ups. Logging is manual and often happens at the end of the day or later, so checks against today's date would block honest entries. Mixing up an older delivery with a new one is the real risk. PL left over in a delivery was never accounted for.

### Options considered
1. Leave stocking open-ended ("same day or later"), as v2.5 does.
2. Limit stocking relative to today's date.
3. Limit stocking relative to the delivery's received date, and close the delivery explicitly.

### Decision
Option 3.
- **Stocking window:** a stocking date must fall between the delivery's received date and the end of the stocking window. The window is a Farm Standards setting, default 1 day †, range 0–3. It is checked against the delivery's date, never against today.
- **Delivery picker:** lists only Received, open deliveries, newest first, each with its received date ("6 days ago") and PL left. Deliveries past their window are hidden behind "Show older deliveries".
- **Review step:** names the delivery and its received date, with a confirmation tick.
- **Finish stocking:** the Owner records any PL not stocked, with a reason: dead on arrival, discarded, returned, or count difference (FryDeliveryShortfall). After that, PL received = Σ stocking counts + Σ not stocked, and the delivery can't be used again.
- **Dashboard:** a delivery still open after its window shows "Finish stocking" on the Owner's dashboard.

### Why
- Late entry keeps working.
- A mismatched delivery is caught by its own dates.
- Every PL received is accounted for.

### Consequences
Positive:
- The PL received always adds up.
- An old delivery can't be picked by mistake.

Negative:
- One more Owner action per delivery.
- The default window needs confirming with the partner farm.

### Revisit when
The partner farm reports stocking more than a day after arrival.

### Related links
- Spec Journey 3, AC-08 to AC-10, rules catalog (Stocking)

---

## Decision DEC-64: Owner reopening and cycle outcome

Status: Accepted
Date: 2026-10-26
Owners: Capstone development team
Amends: DEC-10, DEC-47

### Context
Errors are sometimes found after Close Batch. DEC-10 allowed no reopening, which leaves wrong final indicators in place. A cycle in which every pond failed was closed exactly like a successful one.

### Options considered
1. Never editable.
2. The Owner reopens with a reason.
3. Corrections as separate adjustment entries.

### Decision
Option 2.
- **Who and how:** the Owner can reopen a Closed batch or cycle with a required reason (ReopenEvent). The reopening is shown in the record's history and the activity log.
- **Batch:** a reopened batch returns to Failed if it has a BatchFailure, otherwise to Harvested. Re-closing recomputes the final indicators.
- **Cycle first:** a batch in a Closed cycle can be reopened only after the cycle is reopened.
- **Cycle outcome:** at Close Production Cycle the Owner confirms the outcome, Completed or Failed. It is pre-selected as Failed when every batch failed, and the Owner can change it. The outcome is a field, not a new status.

### Why
Corrections stay possible with an audit trail, and reports can tell failed cycles from completed ones without automatic decisions.

### Consequences
Positive:
- Fixable mistakes.
- Clearer reports.

Negative:
- Indicators of a reopened batch can change; reports show the latest values.

### Related links
- AC-16, AC-17

---

## Decision DEC-65: Farming systems, construction types and density bands

Status: Accepted
Date: 2026-10-26
Owners: Capstone development team
Amends: DEC-17, DEC-52; uses DEC-56

### Context
The density bands in PNS/BAFS 197:2025 Annex C cover extensive, semi-intensive and intensive culture, with earthen and lined values for intensive. v2.5 also had a super-intensive farming system and an "Other" construction type with no band. It also grouped concrete and HDPE-lined ponds together and treated densities between bands as information only.

### Decision
- **Farming systems:** Extensive, Semi-intensive and Intensive. Super-intensive is removed.
- **Construction types:** Earthen, Concrete and HDPE-lined. Other is removed.
- **Bands:** one row per farming system and construction type (DensityBand, host defaults, each with its source; farm overrides via DEC-58). The defaults are 1–30 (extensive), 40–60 (semi-intensive), and 70–90 (intensive, earthen) or 100–140 (intensive, concrete or HDPE-lined).
- **Density check:** density = counted PL ÷ pond area at stocking, shown live in the stepper. Outside the pond's band it warns and is stored as DensityFlag Below or Above; a density between two systems' bands is simply outside and warns. It never blocks.
- **Pond warning rule:** extensive in a concrete pond, or extensive in an HDPE-lined pond.

### Why
Every pond lands in a band from the current standard. Stocking is often entered after the fact, so a block would force false counts.

### Consequences
Positive:
- Density warnings match the standard.

Negative:
- Existing ponds or farms set to super-intensive or Other must be reassigned in a reviewed migration.

### Revisit when
The adviser gives separate values for concrete ponds, or bands for another system.

---

## Decision DEC-66: Logs within the batch's life; recorded time shown

Status: Accepted
Date: 2026-10-26
Owners: Capstone development team
Amends: DEC-50

### Context
Logs and feeding sessions could be dated before the batch was stocked, which would count feed and mortality that don't belong to it. A "late entry" label was considered but contradicts DEC-50's "no late badge", and the right threshold is unknown.

### Decision
- **Date limits:** reject a log or feeding session dated before the batch's stocking date. DEC-51 already rejects dates after the Total harvest.
- **Recorded time:** every history shows the event date together with when and by whom it was recorded, for example "Oct 20 · recorded Oct 27, 9:10 AM by Ana".
- **No late label:** DEC-50's "no late badge, no cutoff" stays.

### Consequences
Positive:
- Indicators can't include entries from outside the batch's life.
- The Owner can see what was entered late without a threshold.

Negative:
- A mistyped date must be fixed before saving.

---

## Decision DEC-67: Harvest and sales options

Status: Accepted (defaults pending partner-farm answers)
Date: 2026-10-26
Owners: Capstone development team
Keeps: DEC-15, DEC-16

### Context
The team could not yet confirm how the partner farm grades, weighs, prices and collects payment. Each option was chosen so that it costs nothing if unused and works either way.

### Decision
- **Ungraded shrimp:** an "Ungraded / mixed" size grade (no count range) is seeded, so an ungraded remainder can be sold. Its pieces are estimated from ABW.
- **Buyer re-weighing:** SaleLine.BuyerAcceptedKg is optional. When filled, the amount due and revenue use it, and the receipt and report show the difference from farm kg. A difference above 10% † warns.
- **Harvest not sold:** HarvestDisposal records kg and a reason (staff or home use, given away, spoiled or lost, other). Σ sold kg + Σ not-sold kg ≤ the harvest's total kg, and Close Batch lists kg neither sold nor accounted for.
- **Price:** stays required on the sale and editable afterwards. A price set later by the buyer is an edit.
- **Credit:** Sale.DueDate is optional. An unpaid or partly paid sale past its due date shows Overdue.
- **DEC-15 kept:** cost results are labeled "margin over feed, chemicals and PL".

### Consequences
Positive:
- Harvested kg can be fully accounted for.
- Real-world buyer practices fit without new workflows.

Negative:
- More optional fields.
- Revenue and FCR use different weights by design: buyer kg for revenue, farm kg for FCR.

### Revisit when
The partner farm answers the sales questions in roadmap.md.

---

## Decision DEC-68: Inventory and indicator rules

Status: Accepted
Date: 2026-10-26
Owners: Capstone development team
Keeps: DEC-15, DEC-53

### Decision
- **Lot pre-selection:** the earliest-expiring lot with stock is pre-selected on feeding and chemical forms, and staff can change it.
- **Pack size:** InventoryItem.PackSize is optional, for example 25 kg per bag. A receipt can be entered in packs and is stored in the base unit.
- **Survival:** survival = harvested pieces ÷ stocking count (the hand count of PL actually stocked). Dead at stocking (DEC-59) is shown separately.
- **Delivery cost:** the whole delivery cost is shared by stocking count, including PL recorded as not stocked (DEC-63).
- **Revenue and FCR:** revenue uses the buyer's accepted kg when filled; FCR and yield use farm-weighed harvest kg.
- **Warnings only:** an expired lot and negative stock warn, because late entry often logs usage before the receipt.

### Consequences
Positive:
- Less spoiled feed.
- Faster receipts.
- Cost reflects everything the farm paid for.

Negative:
- Pack sizes must be set per item.

---

## Decision DEC-69: Batch log calendar and closing with blank days

Status: Accepted 2026-10-27 (the calendar is built on branch feature/batch-log-calendar; not yet built or run on a machine with .NET)
Date: 2026-10-27
Owners: Capstone development team
Amends: DEC-50

### Context
DEC-50's Daily log status view shows only the last 1 to 31 days of open batches, and Close Batch lists blank days once, at the end. Nobody can see a batch's whole record at a glance, and closed batches cannot be reviewed for gaps. Close Batch only warns, so a batch can be closed with missing days and then becomes read-only. Staff at the ponds may enter paper sheets later because of weak Wi-Fi (printable log sheets), so a hard rule has a cost.

### Decision
- **Log calendar:** the Batch detail page shows one square per farm-local day from the stocking date to the end of culture (Total harvest date, failure date or today), in week columns like a contribution calendar. It also works for Closed batches.
- **Colour:** amber when none of the three daily records is in; light to dark green for 1, 2 or all 3 of AM feeding, PM feeding and water quality. Not fed counts as logged. Gaps are amber on purpose, so they stand out.
- **Event markers:** a dot on days with a mortality, growth sampling or chemical entry. These are event records, so they never count as missing.
- **Click through:** an open batch's day opens the feeding sheet for that batch and date. Closed batches are not clickable.
- **Source of truth:** the per-day status comes from the same service as Close Batch (DEC-50). No new tables. New endpoint: Batch.GetLogCalendar.
- **Still a status view:** blank stays neutral, never "overdue". Nothing is scheduled or assigned, so DEC-31 stands.
- **Closing with blank days:** unchanged. Close Batch keeps DEC-50's rule: it lists the blank days and still allows closing. Blocking, or blocking with an Owner override and reason, was considered and rejected because staff may enter paper sheets later when Wi-Fi at the ponds is weak. Can be revisited after partner-farm feedback.

### Consequences
Positive:
- Owners can see every gap in a batch's life and find them before closing.
- Closed batches can be reviewed after the fact.
- No new data to enter and no schema change.

Negative:
- A long cycle shows many squares and scrolls sideways on a phone.
- A day link only opens the feeding sheet; a missing water-quality entry is added from the Logbook.
- A batch can still be closed with blank days; the calendar and the Close Batch list only warn.

---


## Decision DEC-70: Optional SFSC number on the fry delivery

Status: Accepted 2026-10-31 (branch feature/sfsc-feeding-time-trace; backend built and 224 of 224 tests passed in a Codespace on 2026-10-31; screens not yet checked). The adviser and partner farm should confirm that the certificate is still issued and checked.
Date: 2026-10-31
Owners: Capstone development team
Builds on: DEC-59

### Context
BFAR FAO 225-1 s.2007 requires a grow-out farm to hold a Shrimp Fry Source Certification (SFSC) for its fry. The SFSC states the farm registration number, operator, location, pond area, stocking density and stocking date. The order says that without it the final shrimp product can be confiscated. The 2026 draft BFAR Administrative Circular (marked "draft for pubcon", not in force) keeps the rule in Sec. 10(g) and would add a Domestic Transport Permit for in-country PL movement (Sec. 9(h)). The repository had no SFSC field. The delivery held the PL health certificate and transport permit numbers (DEC-59); the hatchery held its accreditation number.

### Options considered
1. Do nothing: the farm keeps the paper SFSC and traceability to the certificate is lost.
2. An optional text field on the delivery, shown on the batch page, the trace report and the dispatch receipt. Same pattern as DEC-59.
3. A full certificate record with issue date, expiry and a scan. More than the rule needs; no file attachments are planned.

### Decision
Option 2. `FryDelivery.SfscNo` (text, up to 100 characters, optional, not validated). It is entered on Log Fries and Edit delivery, shown on the Batch detail page, printed on the dispatch receipt (the distinct SFSC numbers of the deliveries behind the sold batches), listed in the delivery CSV export and shown on the trace report (DEC-72). The delivery's "Transport permit no." is relabelled "Transport permit (DTP/LTP)". Never required and never blocking (flag-never-block).

### Consequences
Positive:
- Closes the FAO 225-1 gap with one nullable column and no new table.
- An inspection or recall can follow a harvest back to its fry certificate.

Negative:
- The number is typed by hand and not checked.
- If the draft circular is never issued, or the region does not ask for the SFSC, the field stays empty.
- Migrations are generated per Codespace, so the new column appears in the next generated Initial migration.

### Open question: enforcing the SFSC (on hold, 2026-10-31)
FAO 225-1 requires the farm to hold the certificate, but the field stays optional because of flag-never-block and because the paper often reaches the farm after the fry. Today a missing SFSC is silent. Options, lightest first, none built:
1. Warn at stocking when the delivery has no SFSC.
2. Warn at sale when a sold batch's delivery has no SFSC (the point where confiscation becomes a risk).
3. List "SFSC not recorded" at Close Batch and mark it on the trace report.
4. A dashboard list of deliveries still missing an SFSC.
5. A Farm Standards switch, "Require SFSC before stocking" (warn when off, block when on). This is the only option that blocks and would need its own decision as an exception to flag-never-block.

Where the SFSC lives: it stays on the fry delivery, not under Permits and Licenses. It is one hatchery-issued certificate per shipment with no meaningful expiry, and its value is the link to the delivery, batch, harvest and sale. A permit record has no such link and its expiry and renewal features do not fit.

Related, now done: the farm's own BFAR Farm Certification belongs under Permits and Licenses and was added as a required preset (DEC-74).

The team's lean is 1 to 3, adding 5 only if the region checks the SFSC strictly. Waiting on:
- Adviser: is the SFSC still checked in the region and by whom; is a warning enough or should a farm be able to block stocking; is the draft circular (which keeps the rule) expected soon.
- Partner farm: does an SFSC come with every delivery, and with the fry or later; who keeps it; has a buyer, processor or BFAR asked for it.
- Adviser and partner farm: does the farm hold an FAO 225-1 accreditation (Farm Certification) today, with what number and expiry; should the preset stay required (DEC-74)?

---

## Decision DEC-71: Optional time of feeding on a feeding session

Status: Accepted 2026-10-31 (branch feature/sfsc-feeding-time-trace; backend built and 224 of 224 tests passed in a Codespace on 2026-10-31; screens not yet checked)
Date: 2026-10-31
Owners: Capstone development team
Related: DEC-50, DEC-61, DEC-66

### Context
PNS/BAFS 338:2022 Annex B asks the grow-out feeding log for the time of feeding. `FeedingSession` stored the feed date and AM or PM only. The entry's recorded time is when it was saved, which is wrong when staff log late, and late logging is allowed (DEC-66). DEC-61 (more feeding sessions per day) is waiting on the partner farm and would change the session key; this change does not.

### Options considered
1. Leave AM/PM only and treat the recorded time as an approximation: wrong for late entries.
2. An optional time of day typed by the user on each session; AM/PM stays the key.
3. Make sessions per day configurable now: larger change, waiting on the farm.

### Decision
Option 2. `FeedingSession.FedAtTime` is optional text in farm-local 24-hour "HH:mm" (a malformed value is rejected with a message; a blank is fine). It is entered per Fed session on the feeding sheet ("Time fed (optional)"), ignored and cleared for Not fed sessions, saved again when a session is corrected, shown in the session history and the feeding CSV export. AM/PM and the typed time are not cross-checked, so a 1 pm feeding marked AM saves as typed. A blank time still counts as logged on the log calendar and in Close Batch (DEC-50, DEC-69). The session key and the one-session-per-AM/PM rule are unchanged. Stock movement times stay at the fixed 06:00 and 16:00.

### Consequences
Positive:
- Closes the 338:2022 feeding-time gap for farms that enter it, correct for late entries.
- One nullable column, no key change.

Negative:
- One more optional field at the ponds.
- The time is stored as text so it passes through the API without a time-type converter.

---

## Decision DEC-72: Trace report for one batch

Status: Accepted 2026-10-31 (branch feature/sfsc-feeding-time-trace; backend built and 224 of 224 tests passed in a Codespace on 2026-10-31; screens not yet checked). The adviser should confirm that a per-batch sheet is enough for an inspection.
Date: 2026-10-31
Owners: Capstone development team
Related: DEC-55, DEC-57, DEC-59, DEC-67, DEC-70, DEC-71

### Context
PNS/BAFS 338:2022 asks for one step back and one step forward. The links already exist in the data (hatchery, delivery, cycle, batch, feeding and chemical lots, harvest grade, sale, buyer), but no screen showed the chain, so an inspection, a buyer complaint or a recall meant opening many screens.

### Options considered
1. No report; open each screen.
2. A read-only trace sheet per batch, reached from the Batch detail page.
3. Also a reverse lookup from a feed or chemical lot to the batches that used it.

### Decision
Option 2. A new Owner report, "Trace" on the Batch detail page (`/app/reports/trace/:id`, service `Trace.GetBatchTrace`, permission Farm.Reports). It shows: the fry source (hatchery, accreditation, hatchery batch number, delivery, PL health certificate, SFSC, transport permit); the pond and stocking snapshot (DEC-52); feed lots with supplier, lot, first and last day fed and kg; chemical and supplement applications with lot, supplier, quantity, reason, dosage, method, withdrawal days and earliest safe harvest date; each harvest with its size grades; each sale with buyer, receipt, grade, farm kg, buyer's accepted kg and transport details; not-sold entries; and the harvested, sold, not-sold and not-accounted-for kg. It is printable. No table is added and nothing is written. Missing optional data shows "Not recorded". Voided logs, feeding sessions and sales are not listed (the activity log keeps them). The lot-to-batch reverse lookup (option 3) is a follow-up.

### Consequences
Positive:
- One sheet answers an inspection or recall question for a batch, without new data entry.
- Reads existing records in the tenant, so farm isolation holds.

Negative:
- A long cycle produces a long sheet; feed is grouped by lot, not listed per session.
- Feeding time appears only in the feeding history; the trace sheet shows the session counts.
- Not yet run against real data; the spec's reference batch should be used to check the figures.

---


## Decision DEC-73: Flagged stock lots shown at Close Batch and on the trace report

Status: Accepted 2026-10-31 (branch feature/sfsc-feeding-time-trace; backend built and 224 of 224 tests passed in a Codespace on 2026-10-31; screens not yet checked)
Date: 2026-10-31
Owners: Capstone development team
Related: DEC-49, DEC-69, DEC-72

### Context
A feeding or chemical application that uses more than a lot has on hand still saves, takes the lot below zero and flags it for reconciliation (flag-never-block). The flag showed only on the dashboard stock list and the Stock page, and DEC-49 sends no notification for entry checks, so a flagged lot could stay unnoticed while batches were closed and traced.

### Options considered
1. Leave it on the dashboard and Stock page only.
2. List flagged lots at Close Batch and mark them on the trace report.
3. A badge on the Stock menu item.
4. A time-triggered Owner reminder when a lot stays flagged for N days.

### Decision
Option 2. Close Batch lists the feed and chemical lots the batch drew from that are still flagged, beside the blank-day and not-accounted-for kg warnings, and still allows closing. The trace report marks a flagged lot "stock not reconciled". Read-only: no new table. Options 3 and 4 are left for later; option 4 would fit DEC-49 as a † threshold in Farm Standards.

### Consequences
Positive:
- The flag appears where records are checked, with no new notification.
- A trace sheet no longer presents a lot's kg as reliable when its stock is flagged.

Negative:
- A flag cleared later removes the warning, so the sheet reflects the current flag, not the state at the time of the feeding.
- A lot flagged for another batch's shortfall also shows here if this batch drew from it.

---

## Decision DEC-74: BFAR Shrimp Grow-out Farm Certification as a required permit preset

Status: Accepted 2026-10-31 (merged to main via PR #1)
Date: 2026-10-31
Owners: Capstone development team
Related: DEC-18, DEC-70

### Context
BFAR FAO 225-1 s.2007 requires grow-out farms to be accredited, valid for 3 years. The 2026 draft BFAR Administrative Circular (marked "draft for pubcon", not in force) replaces this with a Farm Certification (FC) through GAqP certification against the PNS for penaeid shrimp grow-out, valid 3 years with yearly monitoring and verification (Sec. 10). The farm's own certification belongs under Permits and Licenses; the SFSC does not (DEC-70). The system had no preset for it.

### Options considered
1. Leave it to a custom title.
2. A seeded preset, not required.
3. A seeded preset marked required, so the dashboard reminds the Owner when no current record exists.

### Decision
Option 3. Add "BFAR Shrimp Grow-out Farm Certification (GAqP)" (default agency "BFAR Regional Office XII") to the "Fisheries (BFAR)" category, marked required. It follows DEC-18: a reminder on the dashboard, never a block, no file attachment; expiry and renewal use the existing Permits and Licenses features. New farms get it at registration. The seed adds missing presets by name, so an existing farm gets it the next time the seed runs. Owners can switch off Required per farm if the farm is not under this rule.

### Consequences
Positive:
- The farm's certification is tracked with its number and 3-year expiry, with expiry reminders.
- Farms that lack a current record are reminded on the dashboard.

Negative:
- The rule's status is unconfirmed: FAO 225-1 is in force but the draft circular is not, and whether the partner farm holds an accreditation is a question for the adviser. A farm not under the rule sees a reminder it can switch off.
- Yearly monitoring under the draft is not tracked; only the certificate's own expiry is.
- Preset and required-permit counts in tests change (15 presets, 4 required).

## Decision DEC-75: Suggested farm code and usernames, editable before saving

Status: Accepted 2026-11-02 (merged to main; built and 245 of 245 tests passed in GitHub Actions; screens not yet checked by hand)
Date: 2026-11-02
Owners: Capstone development team
Related: DEC-06, DEC-44

### Context
The farm code and every username were typed by hand: the farm code and Owner username on the Register page, staff usernames on Farm › Users. The team wants them created automatically. A review of the schema found that the template's indexes on `AbpTenants.TenancyName` and on `AbpUsers` (TenantId, NormalizedUserName) are not unique, so only the application checked for duplicates, although the spec lists the farm code as unique. Generated values make a clash more likely: two farms with the same name, or two staff with the same name, get the same suggestion.

### Options considered
1. Keep typing by hand.
2. Generate the values on save, with no way to change them.
3. Suggest the values on the form; the person can change them before saving.

Farm code format: built from the farm name, or a running number (`FARM-0001`). Username format: first initial and surname, or surname and a number.

### Decision
Option 3, with the farm code built from the farm name and the username from first initial and surname.

- Farm code: the first two words of the farm name that are not filler words (The, And, Of, Farm, Shrimp, Prawn, Aquafarm, Pond, Inc., Corp. and similar), in capitals, joined by a hyphen, at most 16 characters; accents removed; `F-` in front when it would start with a digit. When taken by any farm (case ignored, deleted farms included), `-2`, `-3` and so on, staying within 20 characters. Example: "GenSan Semi-Intensive Shrimp Farm" gives `GENSAN-SEMI`.
- Username: first letter of the first name and the whole surname, lower case, letters only, accents removed ("Juan Dela Cruz" gives `jdelacruz`). When taken in the same farm, `2`, `3` and so on. Usernames are unique within a farm only, since sign-in asks for the farm code first. At registration the farm is new, so the Owner username has no number.
- The form fills the value in when the farm name or the person's name is entered (on leaving the field). Once the person types their own value, suggestions stop replacing it; clearing the field turns them back on. A username stays fixed once the account is saved, as before.
- The database enforces uniqueness: unique indexes on `AbpTenants.TenancyName` and on `AbpUsers` (TenantId, NormalizedUserName), with no `IsDeleted` filter, because farms and accounts are never deleted and a farm code is never reused (old exports and logs carry it). If two people save the same value at once, the second save gets "was just taken … choose a different" instead of a server error.
- The existing format checks are unchanged (farm code: starts with a letter, 2–64 letters, digits, `-` or `_`). Generated codes already meet the spec's stricter rule (2–20, uppercase, letters, digits, hyphens).

### Consequences
Positive:
- Faster registration and account setup, with consistent codes and usernames.
- Duplicates are impossible even under concurrent saves; the database now matches the spec's unique farm code.

Negative:
- A suggestion that was free can be taken before it is saved; the person then sees a message and picks another.
- Typed farm codes are still checked against the older 2–64 rule and stored as typed, so the spec's "stored uppercase, 2–20" rule is still not enforced for typed codes. Aligning it would change the seeded test farm codes (`pilot-farm`, `test-farm-b`, `gensan-semi`) and the tests that use them; left for a separate change.
- An existing database with duplicate codes or usernames in one farm would fail to apply the new indexes; none exist in the seeds.

## Decision DEC-76: No stocking window

Status: Accepted
Date: 2026-11-03
Owners: Capstone development team
Amends: DEC-63 (the stocking window and the "Show older deliveries" picker)

### Context
DEC-63 limited a stocking date to the delivery's received date plus a Farm Standards window (default 1 day, 0 to 3). Logging is manual: paper sheets are filled in at the pond and entered later at a desk, so the day a record is typed in says nothing about when stocking happened. A rule that rejects a stocking date, or hides a delivery, because it was entered late works against that.

### Decision
- A stocking date can be any time from the delivery's received date up to now. It is never checked against when the record is entered. Before the received date and in the future are still rejected.
- The delivery picker offers every Received, open delivery, newest first. "Show older deliveries" is removed.
- The Farm Standards "Stocking window" setting is removed. The `StockingWindowDays` column stays unused, so no migration is needed.
- Finish stocking is unchanged for the Owner. The dashboard lists a delivery from an earlier day that is not finished and still has PL not stocked, with the label "Fry delivery with PL not stocked yet".

### Consequences
Positive: late entry never blocks stocking; one less setting; the picker is simpler.
Negative: nothing warns when a very old delivery is picked by mistake; the review step still names the delivery and its received date, with a confirmation tick, which is the only check.

---

## Decision DEC-77: Construction type fixed at creation; ponds are archived, never deleted

Status: Accepted
Date: 2026-11-06
Owners: Capstone development team
Extends: DEC-35 (void instead of delete)

### Context
A pond's name and code are made from its name prefix and number when it is created, and never change. Without a chosen prefix the prefix comes from the construction type ("Earthen Pond 3", EP-03). Until now the construction type could still be changed before the first batch was stocked, which left ponds named for a construction they no longer had. The type also drives density bands, the farming-system warning and the construction recorded on each batch and trace report. There was no way to retire a pond or to undo one added by mistake; Inactive status exists but leaves the pond in every list.

### Decision
- The construction type cannot change after the pond is created. A wrong entry means archiving the pond and adding a new one. The create form warns about this.
- A pond can be archived and restored (Ponds manage permission). Archiving needs no open batch and no preparation round in progress. An archived pond keeps its batches, history, number and code, leaves the pond list, dashboard and choice lists, and cannot be edited, prepared or stocked until restored. A "Show archived ponds" checkbox on the ponds page lists them.
- Ponds are never deleted. Archive is separate from the Inactive and Under maintenance manual statuses, which keep the pond visible.

### Consequences
Positive: names and codes always match the pond; mistakes and retired ponds are tidied away without losing traceability.
Negative: an archived pond keeps its number and code reserved, so a mistaken "Earthen Pond 3" leaves a gap in the numbering. The database column `Pond.IsArchived` needs the database reset described in the README.


---

## Decision DEC-78: The Farm Owner can change the farm code; old codes stay reserved and point to the new one

Status: Accepted 2026-11-09 (not built or run yet)
Date: 2026-11-09
Owners: Capstone development team
Related: DEC-75, DEC-06

### Context
The farm code is what staff type, with their username, to sign in (DEC-06), and DEC-75 made it unique. After registration it could not be changed anywhere in the system, and the Farm profile did not show it. A farm that picked a poor code, or changed its name, had no way to fix it. Changing a sign-in key has costs: every user must learn the new one, saved links break, and old exports and logs carry the old code.

### Options considered
1. Never allow a change (the farm code is fixed at registration).
2. Only the System Administrator can change it, on request.
3. The Farm Owner can change it, with warnings, a uniqueness check and a waiting period.

### Decision
Option 3.

- Only the Farm Owner can change it (Farm profile › Farm details › Change code). The Technician sees the code but not the button.
- The new code follows the same format rule as before (starts with a letter, 2–64 letters, digits, `-` or `_`) and must not be any farm's current code or any retired code. Case is ignored. The dialog checks it while typing and asks for the new code to be typed twice.
- Every change writes a row to `FpmsFarmCodeChanges` (farm, old code, new code, who, when). The old code stays reserved for ever: no farm, including this one, can use it again. The unique index on the old code and the existing unique index on the farm code make this hold even when two people save at once.
- A farm can change its code once in 30 days. The System Administrator has no override in this version.
- On the sign-in page, a retired code does not say "no farm uses this code"; it says the code changed and shows the farm's current code, and fills it into the field. This tells anyone who knows an old code which code the farm uses now. The team accepted this because the old code was already shared with the staff, and the sign-in page already tells a visitor whether a code exists.
- People who are signed in stay signed in (sessions follow the farm's internal id, not the code). Exports and reports keep the code they were made with. Later ones carry the new code.

### Consequences
Positive:
- A wrong or outdated code can be fixed without asking the System Administrator.
- Old bookmarks and remembered codes lead to a helpful message instead of a dead end.

Negative:
- Staff must be told about the new code; the dialog says so and offers a copy button.
- Retired codes use up code space for ever.
- A new table, `FpmsFarmCodeChanges`; an existing Codespace database needs the same reset as for DEC-77.
- Not built or run yet; the new tests in `FarmCode_Tests` have not been run.


## Decision DEC-79: Warn about a missing Shrimp Fry Source Certificate (SFSC)

Date: 2026-11-09
Owners: Capstone development team
Builds on: DEC-70

### Context
DEC-70 added an optional SFSC number to the fry delivery, but a missing number was silent. BFAR FAO 225-1 s.2007 requires the certificate, and without it the final product can be confiscated. The paper often arrives after the fry, so the number cannot be required at stocking without breaking flag-never-block. Five options were on hold under DEC-70: warn at stocking, warn at sale, list at Close Batch and on the trace report, a dashboard list, and an Owner switch to require it.

### Decision
Options 1 to 3, all warnings, never blocks:
1. Stocking: a warning when the delivery has no SFSC number (once per stocking).
2. Sale: a warning naming the batches whose fry delivery has no SFSC number, because confiscation becomes a risk at dispatch.
3. Close Batch lists it with the other open items, and the trace report marks the SFSC "Not recorded: required by BFAR FAO 225-1" (it was already in the report's missing-records list).

The dashboard list and the Owner switch (options 4 and 5) are not built.

### Consequences
Positive: the gap is visible at the two moments it matters and in the records an inspector reads; adding the number on the delivery clears every warning.
Negative: one more warning at stocking for farms whose SFSC always comes later; the number is still typed by hand and not checked.

## Decision DEC-80: Harvest tally sheet (crate tally, ABW sample, base-ABW pricing)

Date: 2026-11-10
Owners: Capstone development team
Status: Proposed. Built on branch `feature/harvest-tally`; not compiled or run. Terms marked † need the partner farm.
Builds on: DEC-55, DEC-67

### Context
The only reference for how the partner farm records a harvest is its paper Harvest Tally Sheet: customer and address, pond, date, crate numbers 1 to 210 with a weight for each, total kilos, an ABW worked out from a sample ("5002/414 = 12.08 g"), an "agreed base-10 price" of ₱210, a price per kilo of ₱220.40 and a total amount of ₱110,861.20 (503 kg × ₱220.40). The numbers fit a base price at 10 g ABW plus ₱5 for each gram above it: 210 + (12.08 − 10) × 5 = 220.40 †.

The system stored only the harvest's total kg, box count and ABW, and a typed price per kg. Practice differs by farm and buyer: some weigh only a total, some price by size grade or by count, and the base and step are set by the buyer.

### Options considered
1. Keep typing totals: nothing new, but the crate weights, the sample and the price working are lost.
2. Optional, layered additions: a crate tally and an ABW sample on the harvest, and a pricing method on the sale line (Fixed, or Base ABW), each storing its inputs.
3. A configurable pricing formula builder: covers any rule, but is hard to validate, test and explain.

### Decision
Option 2. Every part is optional; a farm that does not use it sees no change in what it must enter.
- **Crate tally.** A harvest can hold a list of crate weights (`HarvestCrate`: crate number, kg; at most 1,000). When present, the harvest's TotalKg is their sum and Boxes their count, worked out by the server. Removing every crate returns to a typed total. The existing rules still apply to the total (grades, sold and not-sold kg).
- **Crate types.** "Crate" is the standard word on every screen and message; a crate with no type is just "Crate", and a type only names it ("Crate 3 · Banyera"). The farm keeps a list of crate types (`ContainerType`: name, usual kg, optional empty weight, order, default, active), managed by the Owner under Harvests › Crate types, next to size grades. In the code they are `ContainerType`. The crate tally's quick add starts on the default crate type with its usual kg ("Add 16 × Banyera, 30 kg"); a one-off weight can still be typed. A container with an empty weight is weighed with the container on the scale, and the empty weight is subtracted: the crate keeps the scale reading (GrossKg), the empty weight (TareKg) and the net kg. Naming rule (guidance on the screen, not enforced): kind, usual capacity, then the owner when the crates are not the farm's: "Banyera 30 kg", "Tub 25 kg – Mindanao Processing". Crates a buyer lends get their own type with their own empty weight. Each crate keeps a copy of the container's name and empty weight, and an edited harvest sends its saved empty weight back, so changing or deactivating a container never changes a saved tally. Types are deactivated, never deleted.
- **ABW sample.** Optional sample weight (g) and piece count on the harvest; both or neither. When both are given, the ABW is weight ÷ pieces rounded to 0.01 g and must be within 0.01 to 60 g.
- **Pricing method per sale line.** `PriceMethod`: Fixed (default, unchanged) or BaseAbw. BaseAbw stores the base price per kg, base ABW, step per gram and the ABW used (default: the harvest's sampled ABW). Price = base + (ABW − base ABW) × step, with the ABW rounded to 0.01 g and the price to centavos; a smaller ABW lowers the price. The formula only suggests: the price saved is the one agreed, and a price that differs from the formula warns (flag-never-block). The terms are kept on the line, so later changes never alter a past sale.
- **Buyer terms.** A new sale prefills a base-ABW line from the buyer's latest base-ABW sale (`GetBuyerPriceTerms`), every value editable. No new settings screen.
- The dispatch receipt prints the base-ABW terms under the price.

Built later under DEC-82: pricing by count and by price table, a size grade per crate, a printable tally sheet. Not built: a Farm Standards default for the base ABW and step.

**Later, if buyers bring their own crates †: buyer-owned crate types.** Today a buyer's crates are separate types named after the buyer, which needs no change and suits two or three buyers. If the partner farm confirms buyers lend crates with different empty weights, add, without changing what exists:
1. An optional BuyerId on `ContainerType` (empty = the farm's own); a buyer can have its own default type.
2. An optional BuyerId on `Harvest` ("Name of Customer" on the tally sheet), used only to pick crates; the sale stays separate, so a harvest can still be split between buyers.
3. The quick add groups types as "Farm crates" and "[Buyer]'s crates" and starts on the harvest buyer's default, else the farm default.
Existing types become farm-owned with no data change, and the crate's name and empty-weight copies already keep saved tallies stable. Trigger: the farm confirms buyer-owned crates, or the type list passes about ten.

### Consequences
Positive: the paper sheet can be entered as it is and reprinted with its working; one new table and a few nullable columns; existing sales, reports, yield and revenue are unchanged (revenue stays kg × the saved price). New pricing methods add a value to `PriceMethod` without changing the existing ones.
Negative: more fields on two screens (both collapsed or defaulted); the reading of "base-10" is an inference from one sheet and must be confirmed; a data model change means dropping the development database and generating a new Initial migration.

### Questions for the partner farm
- Is the base always 10 g ABW and the step always ₱5 per gram, and who sets them (buyer or farm)? Is there rounding, or a cap?
- Does any buyer price by count per kg or by size grade instead?
- Is one sheet always one buyer and one pond? Are crates ever graded separately?
- Are crates weighed with the shrimp only (as the sheet's net total suggests) or with the container? Which containers are used, and their usual and empty weights?

## Decision DEC-81: The buyer on the harvest, and tally sheet entry

Date: 2026-11-10
Owners: Capstone development team
Status: Proposed. Built on branch `feature/harvest-tally`; not compiled or run. Questions marked † are for the partner farm.
Builds on: DEC-67, DEC-80

### Context
The partner farm's tally sheet starts with "Name of Customer" and ends with the price and total: the harvest is often the buyer's event. The buyer may set the day, bring the crew, crates and scale, sample the ABW and price on it †. The system kept the harvest (production) and the sale (money) apart, so the common case of one buyer per harvest was entered twice, and nothing on the harvest said whom it was for.

### Options considered
1. Merge harvest and sale into one record: matches the paper, but breaks split harvests, kept or spoiled kg, and the production indicators that must not depend on a buyer.
2. Keep both records; add the buyer as optional context on the harvest, and a single entry for the one-buyer case that creates both.
3. Buyer profiles with stored defaults (crate type, scale, pricing, payment terms): more setup and screens than the farm needs yet.

### Decision
Option 2, in two levels; option 3 is the later level.
- **Level 1, buyer on the harvest.** Optional `BuyerId` ("Name of Customer") and `WeighedBy` (the farm's or the buyer's scale) on the harvest. Choosing a buyer on a new harvest suggests what that buyer decided last time: the crate type used most on their last harvest, whose scale, their payment terms and base-ABW terms (`TallySheet/GetBuyerDefaults`, learned from history, no settings). Anyone who records harvests can pick a buyer (`GetBuyerOptions`) without the Buyers permission. A saved harvest's "Sell this harvest" opens a sale with its unsold grades, its buyer and that buyer's terms.
- **Level 2, tally sheet entry.** On a new harvest with a buyer, an optional section records the sale on the same form: one price (fixed or base ABW) for all of the harvest's graded kg (or the whole total as "Ungraded / mixed"), payment terms, due date and payment received. One save (`TallySheet/Save`) creates the harvest and the sale in one unit of work; the price terms, buyer and grade lines are checked before anything is saved. The dispatch receipt opens. Afterwards they are ordinary records, edited on their own pages. A harvest split between buyers, partly kept, or graded at different prices uses the separate screens.
- When the buyer weighed the harvest, the farm kg are the buyer's weight, so the sale needs no separate buyer kg.
- The harvest stays the production record: yield, survival and FCR never depend on the buyer. A harvest with several buyers names the main one.

### Later: buyer profiles (Level 3) †
Stored defaults per buyer (crate type, scale, pricing method and terms, payment terms), and buyer-owned crate types (see DEC-80). Build only if learning from the last harvest and sale proves unreliable: terms change often, or new buyers have no history.

### Consequences
Positive: the one-buyer case is entered once, like the paper; the harvest records whom it was for; split cases still work; no settings screen.
Negative: a second save path to keep consistent with the separate screens (it calls the same services, so the same rules apply); suggestions come from history, so a buyer's first harvest starts empty. On SQL Server the unit of work is one transaction; the checks before saving keep a bad price from leaving a harvest without its sale on databases without transactions.

### Questions for the partner farm †
- Who harvests: the farm's crew or the buyer's? Whose scale and whose ABW sample?
- Is one tally sheet always one buyer? Is a harvest ever split between buyers or partly kept?

## Decision DEC-82: Pricing by count and by price table, graded crates, printable tally sheet

Date: 2026-11-10
Owners: Capstone development team
Status: Proposed. Built on branch `feature/harvest-tally`; not compiled or run. Terms marked † need the partner farm.
Builds on: DEC-80, DEC-81

### Context
DEC-80 left three extensions for later: buyers who price by count (pieces per kg) rather than ABW, or from a price list; grading crate by crate; and printing the tally sheet to sign at the pond. Each was designed to add to what exists without changing it.

### Decision
All three, each optional.
- **Two more pricing methods** (`PriceMethod` 3 and 4; values 1 and 2 keep their meaning).
  - *Base count:* a base price at a base count, plus a step for each piece per kg fewer (bigger shrimp), minus for more: price = base + (base count − count) × step †.
  - *Price table:* the price of the row covering the count. `PriceTable` (name, optional buyer, active) with `PriceTableRow`s (count from, count to, price per kg; an open end means no limit; no overlaps). Owners manage them under Sales › Price tables.
  - *Count used:* typed on the line, else the grade's middle count (50/60 → 55), else 1000 ÷ the harvest's ABW, as a whole number (12.08 g → 83) †.
  - The line keeps its terms, the count, copies of the table name and row, and the price the method gave (`ReferencePricePerKg`), so editing a table never changes a saved sale. A different agreed price warns, as in DEC-80; a count no row covers is rejected.
  - A buyer's next sale is prefilled from their last priced line of any method, else from their own active price table.
  - On the tally sheet (DEC-81) with several grades, count and table pricing work out each grade's price from its own count.
- **A size grade per crate.** Optional `HarvestCrate.SizeGradeId` ("Grade each crate"). When any crate is graded, the harvest's grade lines are the crates' net kg per grade, and ungraded crates go to "Ungraded / mixed"; typed grade lines are then ignored. The existing rule still holds: a grade line cannot drop below what is already sold.
- **Printable tally sheet** (`TallySheet/GetPrint`, Harvest › Tally sheet). Laid out like the paper: customer and address, pond, date, ABW with its sample, crates in columns of 30 (with the grade or crate type, and scale reading minus crate weight), total kilos, and each sale of the harvest with its price working and amount, plus signature lines. With no crate tally it prints the total; with no sale, or for users who cannot see sales, the price block is left blank to fill in by hand.

### Consequences
Positive: covers the pricing practices seen in the industry with named, testable methods (no formula builder); graded crates remove double entry of grade kg; the printed sheet replaces the paper form at the pond.
Negative: two more tables and several nullable columns on the sale line; the count's rounding and the step direction are assumptions to confirm †; a table's rows are replaced as a whole on save.

### Questions for the partner farm †
- Does any buyer price by count, and how is the count taken (their sample, the grade, or from ABW)? Whole counts or decimals?
- Do buyers give price lists by count range? How often do they change?
- Are crates ever graded separately at the pond?
- Should the printed sheet carry the buyer's signature, the checker's, or both?

## Decision DEC-83: Harvest lot code

Date: 2026-11-10
Owners: Capstone development team; format suggested by the adviser
Status: Proposed. Built on branch `feature/harvest-tally`; not compiled locally. Items marked † to confirm with the adviser.
Builds on: DEC-72 (trace report), DEC-80, DEC-81

### Context
A lot code identifies one harvest through processing, distribution and sale, and is what a buyer, processor or BFAR quotes in a recall. Nothing in the system did that: harvests were known by date and batch. The adviser suggested year-area-barangay/municipality-farm-pond, with area 0 for General Santos (by barangay) and 1 for Sarangani (by municipality).

### Options considered
1. The adviser's code as given: names a pond for a year, not a harvest, so two crops or a partial harvest would share a code.
2. The adviser's code plus a harvest number at the end (chosen), or plus the harvest date (MMDD): the date is longer, clashes when a pond is harvested twice in a day, and goes wrong if a date is corrected.
3. A farm tag (3 letters) instead of a farm number: readable, unique system-wide, but mixes letters into a numeric code; the farm code itself is too long, has hyphens and can change (DEC-78).
4. Official PSGC codes for places: official but much longer than two digits.

### Decision
`YY-A-LL-FF-PP-HH`, e.g. `26-0-24-03-07-02` (16 characters):
- **YY** the harvest's year (farm time). **A** area: 0 General Santos City, 1 Sarangani; 2–9 free for new areas.
- **LL** our own fixed place list, taken from the farm address: General Santos barangays 01–26 in the order of the address list (Apopong 01 … Tambler 24 … Upper Labay 26); Sarangani municipalities 01–07 (Alabel, Glan, Kiamba, Maasim, Maitum, Malapatan, Malungon). A number never changes meaning; a new place gets the next free number †.
- **FF** the farm's number within that place, across all farms: the next free one, given with the farm's first lot code †.
- **PP** the pond's farm-wide lot number (`Pond.LotNumber`), given when the pond is created, never reused (archived ponds keep theirs). Pond codes can repeat a number across prefixes (EP-01, CP-01); this cannot.
- **HH** the pond's harvest count for the year (a never-reused number sequence, like receipt numbers).

Rules:
- The farm's area, place and farm number are stored on Farm profile when first given and then fixed, so an address change does not change the farm's codes.
- The code is given when the harvest is saved and never changes or is reused, even when the harvest's date is corrected, because it may already be on crates and receipts. Unique per farm.
- When the address does not allow a code (outside General Santos and Sarangani, or a General Santos farm with no barangay), the harvest still saves with a warning saying what to fix (flag-never-block); the code is given the next time the harvest is saved.
- One code per harvest. Grades packed separately can add the grade on a label (`26-0-24-03-07-02/6070`) without a second stored code †.
- Shown on the harvest page, the Harvests list (and searchable there), the batch's Harvests tab, the sale form, the dispatch receipt (searchable in Sales), the tally sheet and the trace report. Farm profile shows the farm's part (`0-24-03`) and what to fix.

### Consequences
Positive: one short, stable identifier from pond to buyer, readable by area and place; recalls can start from the code.
Negative: limits of 99 places per area, 99 farms per place, 99 ponds per farm and 99 harvests per pond per year (larger values print with more digits); the place list is ours and must be kept in step with the address list; data model change.

### Questions for the adviser †
- Is the harvest number at the end acceptable, and should the grade suffix go on labels?
- Who confirms the farm number (the system, BFAR or the LGU), and should it match an existing registry?
- Should the place list later map to PSGC codes?

---

## Decision DEC-84: Trace report for one harvest lot code

Date: 2026-11-10
Owners: Capstone development team
Status: Proposed. Built on branch `feature/lot-trace` (from `feature/harvest-tally`); not compiled or run locally.
Builds on: DEC-72 (trace report for one batch), DEC-57 (withdrawal periods), DEC-83 (harvest lot code)

### Context
The trace report (DEC-72) covers a whole batch. In a recall, a buyer, processor or BFAR quotes a lot code (DEC-83), which is one harvest. A batch sheet answers that badly when the batch had partial harvests: it lists feed and treatments given after the lot left the pond, every sale of every harvest, and it does not say whether a withdrawal period was still running on the day this lot was harvested.

### Options considered
1. Keep the batch sheet only; staff read off the right harvest.
2. A trace sheet per lot code, reusing the batch trace limited to one harvest (chosen).
3. Reverse lookup from a feed or chemical lot to the harvests it reached (still the DEC-72 follow-up).

### Decision
Option 2. `Trace.GetLotTrace(lotCode)` (permission Farm.Reports) returns the same sheet as `GetBatchTrace`, with `LotCode`, `LotHarvestId` and `LotHarvestDate` set:
- **Back to the source:** the batch's fry delivery, SFSC and hatchery, as for the batch.
- **Feed:** sessions dated up to the harvest day (farm time). Sessions are AM or PM with no reliable time, so the harvest day's sessions are kept.
- **Treatments:** chemical and supplement applications observed up to the harvest time. Each with an earliest safe harvest date after the harvest date is marked `WithdrawalNotMet` ("not over at harvest"), and the count shows as a warning above the sheet. The batch sheet does not run this check.
- **Forward:** only this harvest, its sales lines, not-sold entries and not-accounted-for kg.
- **Finding it:** "Trace a lot code" on Reports (spaces, dots and en dashes between the parts are accepted); "Trace this lot" on the harvest page, the tally sheet and each dispatch receipt line; the lot code links on the Harvests list and the batch's Harvests tab. Route `/app/reports/trace/lot/:code`. An unknown code shows "No harvest has the lot code …".
No table is added and nothing is written. The batch sheet is unchanged.

### Consequences
Positive: a recall that starts from a crate or receipt code gets one sheet for that harvest, with the food-safety question answered on it.
Negative: feed on the harvest day is included even if fed after the harvest; a treatment's date or end date corrected later changes the check, since it is computed on read; the lot code is unique per farm only, so the lookup works within the signed-in farm.

---

## Decision DEC-85: Harvest and sales screens (tabs, shared sale blocks, lot summary)

Date: 2026-11-11
Owners: Capstone development team
Status: Proposed. Steps 1, 2, 6 and 7 built on branch `feature/harvest-sales-redesign` (from `feature/lot-trace`); not compiled or run locally. Steps 3 to 5 not built.
Builds on: DEC-67 (not sold, buyer kg, credit), DEC-80 to DEC-82 (tally sheet, buyer on the harvest, pricing methods), DEC-83 (lot code), DEC-84 (lot trace)

### Context
The harvest and sales data chain is sound (batch, harvest with its lot code, grade lines, sale lines, sale, payments). The screens were weak in five ways: three set-up lists sat beside the two daily lists in one row of five tabs; the harvest form asked for the total before the crates that work it out; the sale on the harvest form and the Sales form were two separate copies of the pricing fields, and only the Sales form had a review step; a saved harvest opened as an edit form; and the Harvests list spent three columns on one story (sold, not sold, unaccounted). The owner confirmed that harvests are typed in afterwards from the paper tally sheet on a computer, not at the pond on a phone.

### Options considered
1. Leave the screens as they are.
2. Keep the data and rules, and rework the screens in five steps that each ship on their own (chosen).
3. A step-by-step harvest wizard for phone entry at the pond. Rejected: entry is from paper, at a desk.
4. Remove the sale from the harvest form so there is one place to sell. Rejected: it would undo DEC-81.

### Decision
Option 2. No entity, rule, permission or route changes; no migration.
- **Step 1, tabs (built).** The section shows Harvests, Sales and Setup. Setup groups Size grades, Crate types and Price tables as a second row of tabs; it shows when the user may open at least one of them and opens the first. Their routes are unchanged.
- **Step 2, shared sale blocks (built).** The price terms (Base ABW, Base count, Price table), the working line and the "price differs" warning are one component, and payment terms, due date and paid-now are another; the harvest form and the Sales form both use them. On the Sales form, payment terms and due date move from the top card to a Payment card. The harvest-form sale gets the "Check before saving" step: the button reads "Review harvest and sale", and only the review card's button saves. Transport details stay on the Sales form.
- **Step 3, harvest form order (not built).** Harvest, weighing, size grading, sample and counts, not sold, quality checks, sale, with a summary strip that stays visible. No field added or removed.
- **Step 4, harvest view page (not built).** A saved harvest opens as a read-only lot summary (kg balance, grades, sales with payment status, not sold) with Edit as a button.
- **Step 5, Harvests list (not built).** One kg balance and a status (Unsold, Partly sold, Sold, Unaccounted) with a filter replace the three kg columns; the CSV export keeps every column.
- **Step 6, prints (built).** The harvest tally sheet and the dispatch receipt share one letterhead (farm left; title, number and date right) and a boxed lot code. Tables are ruled, with right-aligned fixed-width figures and kilos to two decimals. The crate tally prints in blocks of 30 with a subtotal under each and a heading on every row of blocks; crates weighed with a container show scale kg, crate kg and shrimp kg in separate columns; crates, total kilos and ABW are in one boxed summary. On the receipt the lot code has its own column, "Buyer kg" prints only when one was recorded, transport is a labelled grid, and a Buyer copy / Farm copy switch (Buyer copy by default) leaves the price workings off the buyer's copy. Both print on A4 portrait with "Page x of y" (Chrome and Edge). The tally sheet has no BFAR registration number yet: its print data does not carry one.
- **Step 7, tab bar in every section (built).** A tab is a place and an action is a button: "Record operations" is no longer a tab, and Record operations, Record harvest, Record sale and Stock a batch sit at the right of the tab bar (the first three only on the list page itself). The Setup row uses the same style as the tabs, smaller, with a count on each list that the list page keeps current. A page title that only repeats the open tab is not drawn (it stays for screen readers). Tabs stay on one row that scrolls sideways on a narrow screen, with the open tab brought into view and the action shown as its icon. Create buttons that open a form on the same page (Resources, Farm, the Setup lists) stay in their pages.

### Consequences
Positive: daily work and set-up are separated; a price is worked out and shown the same way wherever a sale is recorded, and one test compares the two entry points; a sale is always checked before it is saved.
Negative: Size grades, Crate types and Price tables are one click further away; the harvest-form sale takes one more click; payment terms and due date sit lower on the Sales form than before.
Open: whether three tabs satisfy the spec's screen list; whether transport details are needed on the harvest form; the farm's own words for the four statuses; the farm's paper size and what its scale reads to (two kilo decimals assumed).

---

Copy the decision section format for every new important choice involving architecture, database, authentication, hosting, APIs, libraries or security. Add the decision to the spec's Appendix A at the same time.
