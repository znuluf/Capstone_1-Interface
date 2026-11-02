# Roadmap

Source of truth for scope: [docs/Capstone-Planning.md](docs/Capstone-Planning.md) v2.6. It applies to the existing Capstone codebase, which already implements most P1 features under the earlier spec. Section 1 is feature scope, Section 7 is the implementation plan, and AC-xx are the acceptance criteria. "Ref" numbers refer to manuscript Table 6.

## Done (production-logic rewrite)
- Step 1: spec v2.5 retrofit of steps B–D (DEC-49 to DEC-54).
- Step 2: spec v2.6 production changes (DEC-56 to DEC-59, DEC-62 to DEC-66, DEC-68 parts).
- Step E: harvest and sales (conversions 7–9, 13; DEC-55, DEC-67, DEC-68 revenue and delivery cost share).

## Now
Goal: **Migration step F, Reports and operations** (gap analysis Section 8): six named reports, server-side pagination, CSV export, health page, backup scripts and BackupRun, runbook.
Status: code committed as WIP `947c58b`. Verified: 220 of 220 backend tests, migration round-trip, API smoke test (all checks). Still open: browser check of the new pages, the gap-analysis rows for F, and the final commit.

## Next
Goal: **Migration step G, Quality**: tests mapped to AC-01–AC-27, smoke test, performance re-run, timed restore, tablet accessibility check.

## Interface redesign: backend additions the mockups need
Source: the Farm.Shrimp.io interface mockups. Status as of 3 Nov 2026. "Built" means written on branch `feature/lists-toolbar` (which contains the earlier redesign branches) and not yet compiled or tested by the team.

Built:
- **Per-day event flags on the daily log status** (`Feeding/GetDailyStatus`): each day says whether a mortality, growth-sampling or chemical entry was observed (`DailyLogCellDto.Mortality/GrowthSampling/Chemical`). This call also serves the dashboard log calendar, so a separate farm-wide call was not needed (was item 3).
- **Text search on lists** (was item 4): `PagedInput.Search`. Batches (batch, pond, cycle), Cycles, Fry deliveries, Harvests, Sales and the Logbook search on the columns people read; CSV exports carry the same search. In-memory lists use `SearchText.Matches`.
- **Counts for the filter chips:** `Batch/GetStatusCounts`, `Cycle/GetStatusCounts`, `FryDelivery/GetStatusCounts`, `Harvest/GetTypeCounts`, `Sale/GetPaymentStatusCounts`, `Log/GetTypeCounts`. Each follows the search but not the chosen chip.
- **Logbook "Show voided":** `GetLogsInput.IncludeVoided`; `LogDto` carries `IsVoided`, `VoidReason`, `VoidedBy`, `VoidedAtUtc` and `IsBatchClosed`. Voided entries are soft-deleted, so the call switches off the soft-delete filter only for this listing.
- **Trace report:** `TraceFrySourceDto.DeliveryId`, so the missing-items box can link to the fry delivery.
- **Stocking window removed** (DEC-76): the setting, the window checks and `SetStockingWindow` are gone; `Resources/GetOpenAfterWindow` became `GetOpenWithPlLeft`; the `StockingWindowDays` column stays unused.

Still open:
1. Save many water-quality readings in one call. Needed by both water-sheet layouts (all ponds on one day, and one pond with many rows). Each row still becomes an ordinary water-quality log with its own observed time. Not started.
2. Remaining stock per feed lot. Needed by the feeding sheet to fill in the oldest lot and to offer "put the rest on the next lot". Today a stock shortfall is only reported after saving.
3. Dashboard fields (was item 5): the dashboard works out "data entered through" from the latest log entries on the screen; a server field would be exact. The age of each batch's latest growth sample is already there (`DaysSinceGrowthSampling`).
4. A farm-wide search across ponds, batches and feed lots (the header search below).

Left for later (decided not needed yet): a search box in the header to find a pond, batch or feed lot from any page. It needs a backend search across ponds, batches and lots, so the first version of the new header has no search box.

## Waiting on the adviser and partner farm
Values marked † in the spec are defaults until answered.

Partner farm:
1. Stocking: how long after a delivery arrives can the last pond still be stocked? (answered by the team: no limit; DEC-76 removed the stocking window)
2. Feeding: how many feedings a day? (DEC-61)
3. Treatments: which drugs and chemicals are used, and their withdrawal periods? (DEC-57)
4. Water: which test kits does the farm have, and is water logged every day? (extra parameters)
5. Pond preparation: are steps done in a fixed order worth recording separately? (DEC-32)
6. Sales: is everything graded before sale? (DEC-67)
7. Sales: do buyers re-weigh and pay on their own weight? (DEC-67)
8. Sales: is harvest kept for staff, given away or lost? (DEC-67)
9. Sales: is the price agreed at sale or set later by the buyer? (DEC-67)
10. Sales: do buyers pay later on credit, and with what terms? (DEC-67)
11. Inventory: is feed bought in bags, and what pack sizes? (DEC-68)
12. Health: is PCR or bacterial testing done, and when? (DEC-62)
13. Feeding: when feed from different lots or bags is mixed in one feeding, how is each part measured (weighed per bag, by a ratio, or only the total)? Decides whether the feeding sheet takes kilograms per lot, a total with shares, or a total drawn oldest lot first.
14. Water: does the farm write on the sheets the system prints, or on its own form, and is it one sheet per pond or one table for all ponds? Decides which water-sheet layout is built (one pond with many rows, or all ponds on one day) and what the printed sheet looks like.
15. Water: how many times a day is each pond measured, and which readings are taken each time? Decides the columns of the water sheet.
16. Water: is every pond measured every day, or only some? Decides whether the all-ponds layout is useful or mostly empty.
17. Water: who types the readings in later, and do they go pond by pond or sheet by sheet? Decides the default layout and the order of the rows.

Adviser: confirm the PNS/BAFS 197:2025 water ranges and density bands against the PDF (DEC-56, DEC-65) and the survival-estimate method (DEC-53).

## Done
- **Migration step D, Operations** (23 Oct 2026; DEC-48; no backup taken, at the team's request):
  - Operations menu: choose the cycle, then the pond (remembered per user)
  - AM/PM feeding sessions drawing from one or more lots, one page per cycle and day; corrections reverse and redraw stock
  - chemical and supplement application with several lots; mortality causes Disease / Water quality / Others
  - Owner void with a reason for logs and feeding sessions; per-user drafts for log, feeding and preparation forms
  - lot-based cost; the lot ledger names each movement's source; one water-quality alert per pond per day
  - conversions 4–6 and 10 applied to the development database; old detail tables archived
  - verified: 142 of 142 tests pass, Angular build passes, both migrations apply, roll back and re-apply, the API smoke test checks the converted feeding, mortality and stock data (the reference batch keeps FCR 1.2 and survival 71.25%)
- **Migration step C, Production model** (23 Oct 2026; DEC-47; no backup taken, at the team's request):
  - fry deliveries with dated status history (Owner records; Owner or Technician updates status)
  - pond preparation rounds with free-text entries and Mark Prepared; pond status precedence with Prepared
  - Create Batch (Stocking) stepper: delivery → ponds and PL allocation → details with pre-stocking water quality → review → create, in one transaction with a row lock on the delivery; cycle codes from NumberSequence, batch letters
  - Planned and Failed statuses removed; BatchFailure; Close Batch and Close Production Cycle
  - conversions 1–3 applied to the development database
  - verified: 135 of 135 tests pass, Angular build passes, the migration applies, rolls back and re-applies, the API smoke test checks the converted cycles and batches
- **Migration step B, Reference and setup data** (22 Oct 2026; DEC-46):
  - pond name prefixes with generated pond codes ("GP-03"); existing codes kept (conversion 14); farm-level farming system with a per-pond override
  - hatchery short codes and certificate history (conversion 11); buyer type with the privacy notice (conversion 12)
  - size grades (table and defaults; conversion 8 part 1), date order and 12/24-hour settings, "Permits and Licenses" categories, recommendation texts, NumberSequence
  - verified: 129 of 129 tests pass, Angular build passes, the three migrations apply to the development database and roll back and forward, the API smoke test checks the converted ponds, hatcheries and buyers
- **Migration step A, Foundations** (22 Oct 2026): Swagger in Development only; 4-hour token with the security-stamp check; sign-out after a password change; entity history narrowed; read-committed snapshot; background-worker scaffold; log rotation; `.editorconfig`. The 15-minute idle logout was removed at the team's request (DEC-37 amended). Manual sign-out checks skipped for now (deactivated account, own password change, Swagger in Development).
- **Milestone 0, Gap analysis** (docs/gap-analysis.md): every AC and DEC has a status, 14 data conversions with rules, migration order A–G. The team declined the pre-change tag and backup before steps A and B.

## Target checklists (spec Section 7)
These are the target state. During the gap analysis, items the existing code already meets are ticked as Done; the rest become migration work.

### Milestone 1 checklist, Project setup
- [ ] **Template baseline.** The existing solution was generated from the ASP.NET Boilerplate v10.2.0 Angular + ASP.NET Core template as `Capstone`. Confirm it, and record any template files already modified.
- [ ] **Record exact versions in README.md:**
  - the .NET target framework (`net9.0`) and SDK
  - the ABP packages, EF Core, and the JWT bearer package
  - Angular 19.2.1, abp-ng2-module, TypeScript, Node 22, and Yarn 1.22.22, from the `.csproj` files, `package.json`, and `yarn.lock`

  Result: README.md has a versions table.
- [ ] **Development SQL Server.** Add `aspnet-core/docker/sqlserver/docker-compose.yml` with a pinned SQL Server image tag and `.env.example`. Result: `docker compose up -d` works on every team Mac.
- [ ] **Secrets out of source.** Move the connection string, the JWT key, and `SystemAdmin:InitialPassword` into user-secrets or environment variables. Result: `git grep` finds no secret values.
- [ ] **Clock and Swagger.** Set `Clock.Provider` to UTC and limit Swagger to Development. Result: a Development-only test checks Swagger. Stored times are UTC.
- [ ] **Read-committed snapshot.** Enable it in a migration step with `suppressTransaction: true` (or in the Migrator). Result: the Migrator runs on an empty database and on a copy of an existing one (DEC-38).
- [x] **Enums with explicit fixed values** (already the case, DEC-45). Add DateOnly and `datetime2` conventions; filter every unique index with `IsDeleted = 0`. Result: a sample entity and migration show all four.
- [ ] **Entity history and background workers.** Enable ABP entity history for the listed entities and register the background-worker scaffold (no jobs yet). Result: configuration is in place, with a test that an entity change is recorded.
- [ ] **`/health` endpoint.** Add it with the app version (semantic version plus Git commit). Show the version in the client footer. Result: `/health` returns status and version.
- [ ] **Separate client origin.** Serve the Angular client from its own origin, listed in `App:CorsOrigins` (DEC-07). Result: sign-in works with the client and API on different ports.
- [ ] **Zoneless page base.** Add a zoneless-safe page base pattern: signals, or a view refresh after every API response, plus a reload when the route id changes. Result: an example page updates after a response and on a route change.
- [ ] **Formatting tools.** Add `.editorconfig`, `dotnet format`, ESLint, and Prettier. Result: all pass with no changes on the baseline.
- [ ] **Permission names and localization.** Keep the existing `PermissionNames` with `Farm.*` / `System.*` names (DEC-45), and the `Capstone` localization source. Result: both compile and are used by one sample page.
- [ ] **Log rotation.** Set log4net to rotate 10 MB × 30 files. Result: the configuration is committed.
- [ ] **Docs.** Copy the specification into `docs/`; add these five files at the repository root.

**Definition of done:**
- A clean clone, following the README, runs on a second team machine.
- The API's `/health` endpoint answers.
- The Angular shell signs in to the empty migrated database.
- Formatters pass.
- Versions and blockers are recorded.

### Milestone 2 checklist, Accounts and tenancy (AC-01, AC-02, AC-19, AC-21; DEC-06, DEC-37, DEC-44)
- [ ] **Roles in code.** Static roles FarmOwner, FarmTechnician, and SystemAdministrator, with permissions granted in code per the spec's permission table.
- [ ] **Template hardening:**
  - remove the Default tenant and the default `admin`/`123qwe` passwords
  - disable tenant user self-registration and role editing
  - replace the "Change tenant" dialog with a Farm code field on the sign-in form
  - set the token to 4 hours and add the security-stamp check
  - password policy (8+ characters with upper, lower, digit) and lockout (5 attempts, 15 minutes): already in place (DEC-45)
- [ ] **Farm registration.** Create the tenant, FarmProfile, roles, default permit categories and presets, pond prefixes, and Owner in one transaction, behind the registration switch.
- [ ] **Staff accounts.** Owners create, update, deactivate, and reset Owner and Technician accounts; a temporary password must be changed at first sign-in.
- [ ] **System Administrator.** Sign-in with the farm code left blank, Account Recovery, and the registration switch.
- [ ] **Development seed.** Two test farms (Development only) and `docs/dev-accounts.md`.

**Definition of done:** AC-01, AC-02, AC-19, and AC-21 pass; `admin`/`123qwe` cannot sign in; the self-registration and role-editing endpoints are unreachable.

### Milestones 3–9
Committed P1 work, migrated in the order agreed in Milestone 0:

- **Milestone 3, Farm setup** (Refs 2.1, 2.2, 3.1–3.3, 4.1, 7.2)
  - Scope: profile and settings, ponds first, permits and licenses, hatcheries and certificates, fry deliveries with status history, feed and additives, buyers.
  - Done when: AC-03 to AC-06 pass.
- **Milestone 4, Pond preparation and production** (Refs 4.2, 4.3, 5.1–5.3, 5.5, 5.6, 7.4)
  - Scope: preparation rounds, the Create Batch (Stocking) stepper, Declare Batch Failure, Close Batch, and Close Production Cycle.
  - Done when: AC-07 to AC-10 and AC-15 to AC-17 pass.
- **Milestone 5, Operations** (Refs 6.1–6.5)
  - Scope: AM/PM feeding sessions with one or more lots, water quality with grouped alerts, growth sampling, chemical application, mortality, live indicators.
  - Done when: AC-11 and AC-12 pass, and the reference batch matches hand calculations.
- **Milestone 6, Harvest and sales** (Refs 7.1, 7.3)
  - Scope: harvest from the batch, size grades, sales per grade line with locked receipt numbers, payments, Sales History, dispatch receipt.
  - Done when: AC-13 and AC-14 pass.
- **Milestone 7, Reports and dashboard** (Refs 8.1, 8.2, 9.1, 9.2)
  - Scope: the six named reports, pagination, CSV export with the injection guard, dashboard, notifications, History panels, the health page, background jobs.
  - Done when: AC-18, AC-26, and AC-27 pass.
- **Milestone 8, Quality and security**
  - Scope: the full validation suite, two-farm isolation, performance and data-growth test, backup and timed restore to the standby machine, accessibility on tablets.
  - Done when: AC-20 and AC-22 to AC-27 pass, with no open critical or high defects.
- **Milestone 9, Release at the partner farm**
  - Scope: Wi-Fi walk test, server PC on a UPS with services and time sync, HTTPS and certificate renewal, scheduled backups and integrity checks, runbook, user guide, training farm, adviser-reviewed recommendation texts, System Administrator handover.
  - Done when: the farm accepts the release and a restore has been rehearsed within 2 hours.

## Later
P2 work, started only after every P1 acceptance test passes:
- Trend and growth charts (Ref 8.1)
- Biosecurity tab: disinfection records first, visitor logs only if needed (R-20)
- Permit file attachments, several per record (R-11); this reintroduces file storage
- Automatic "Base 10" pricing (Ref 7.3)
- Printable log sheets for a paper-then-enter fallback
- Structured pond-preparation fields, after consulting the technician

Phase 2, after the capstone:
- Cloud SaaS with subdomain-based farm resolution
- Offline capture and sync
- Email or SMS reminders
- Retarget to .NET 10 LTS (DEC-05)

## Not planned
- Per-batch production protocols and "Today's tasks" (DEC-31)
- Post-production management logging (DEC-32)
- Financial bookkeeping ledger (DEC-15)
- IoT sensors, automated feeding or pond control, predictive analytics
- Species other than *P. vannamei*
- External user roles (BFAR, auditors), a multi-farm owner dashboard, or a farm switcher
- Payment processing, official BIR receipts or invoices
- Shrimp.io integration

## Roadmap rules
- Finish Now before starting Next.
- Add acceptance criteria to every major task (use the AC-xx IDs in the spec).
- Move completed work to changelog.md.
- Update this file whenever priorities change; a scope change also needs a decisions.md entry and a spec update.
