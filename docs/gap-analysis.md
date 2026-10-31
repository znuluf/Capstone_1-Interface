# Gap Analysis: Capstone codebase vs specification v2.4

(Reviewed against v2.3; v2.4 adds only the approved amendments in Section 9. Sections 10 and 11 list the v2.5 and v2.6 changes.)

Milestone 0 deliverable (roadmap.md). Read-only review of the code on branch `feature/constraints-edits` (last commit `f1b1fbc`), 22 Oct 2026.

Status key:
- **Done**: the code already meets the target.
- **Change**: it exists but differs from the spec.
- **New**: missing.
- **Verify**: likely met; confirm during migration.
- **Amend spec**: the code's approach is reasonable, so the spec should follow the code (needs team approval).

## 0. Safety steps before any change

| Step | Status |
| :---- | :---- |
| Tag the current state `pre-spec-v2.3` | Declined for now |
| Database backup before the first migration | Declined before step A (no data changes); take one before step C |
| Untracked `scripts/tablet-preview.sh` | Left uncommitted (team decision) |

## 1. Foundations and template hardening (Milestones 1–2)

| Item | Status | Where / note |
| :---- | :---- | :---- |
| Template baseline, versions recorded, SQL Server in OrbStack, secrets out of source | Done | Commits `1318a33`, `99701bf`; README |
| `Clock.Provider` = UTC | Done | `CapstoneCoreModule.cs` |
| Separate client origin (DEC-07) | Done | D-29 |
| Zoneless-safe page base | Done | `FpmsPage` (old architecture.md) |
| Static roles FarmOwner / FarmTechnician / SystemAdministrator | Done | `FarmRoleSynchronizer`, `HostRoleAndUserCreator` |
| No Default tenant; no `123qwe` in production | Done | Admin password comes from `SystemAdmin:InitialPassword` with a forced change; the development password is only a fallback |
| User self-registration disabled; only farm registration | Done | `AccountAppService.RegisterFarm`; no user Register method |
| Role-editing UI removed; template host pages replaced | Done | No roles, users or tenants routes in `app-routing.module.ts` |
| Farm code on sign-in | Done | README sign-in instructions |
| Password policy | Done (spec amended, DEC-45) | 8+ characters with upper, lower and digit |
| Lockout | Done | 5 attempts and 15 minutes (spec amended, DEC-45) |
| Swagger in Development only | Done (step A) | `Startup.cs` |
| JWT lifetime 4 hours | Done (step A) | Default 240 minutes |
| Security-stamp check on JWT requests | Done (step A) | `JwtSecurityStampCheck` (1-minute cache) |
| "Switch user" button (idle logout removed 22 Oct 2026, DEC-37) | New | Angular |
| Per-user form drafts | New | Angular |
| Read-committed snapshot (outside a transaction) | Done (step A) | Migration `Fpms_ReadCommittedSnapshot` |
| Enums stored as strings | Done (spec amended, DEC-45) | Enums are integers with explicit fixed values (`Planned = 1`, …), which is already safe against reordering. Converting every enum column adds risk for no gain. Proposed rule: integers with explicit values, never renumbered. |
| Unique indexes filtered on `IsDeleted = 0` | Verify | Most indexes use `NotDeleted`. The open-batch index uses `[Status] <> 5`, which must change when the statuses change. ClientRequestId is not checked yet. |
| `DateOnly` / `datetime2` column types | Verify | `DateOnly` is already used (e.g., `HealthCertificateExpiry`, `SaleDate`) |
| Entity history | Done (step A) | Narrowed to the listed entities under their current names; the list follows the renames in step C |
| Background workers | Change (scaffold done in step A) | `FarmPeriodicWorkerBase`; the jobs come in step F |
| `/health` | Change | Database check only; add version, backups, disk and certificates |
| Permission names | Done (spec amended, DEC-45) | Code uses `Farm.{Area}.{Action}` / `System.*` (e.g., `Farm.Ponds.Manage`). Keep these and change the spec's `Pages.*` convention. |
| `.editorconfig`, `dotnet format`, Prettier | Change (`.editorconfig` done in step A) | `dotnet format` and Prettier still to add |
| Log rotation 10 MB × 30 files | Done (step A) | `log4net.config`, `log4net.Production.config` |
| Notifications through ABP's system | Done (spec amended, DEC-45) | A custom `FarmNotification` / `FarmNotificationRead` exists, works and is tested (owners-only flag, once-per-record). Keep it and add grouping, instead of rewriting. |

## 2. Farm setup (Milestone 3)

| Item | Status | Where / note |
| :---- | :---- | :---- |
| Structured address, total farm area | Done | D-31 |
| Farm-level farming system with pond override | Done (step B) | `FarmProfile.FarmingSystem`, `Pond.FarmingSystemOverride` |
| Date order and 12/24-hour settings | Done (step B) | `FarmProfile.DateOrder`, `Use24HourTime`; applied by the date pipes |
| Permits as reference records, presets, renew, archive, no files | Done | D-30 (`ComplianceDocument`, `DocumentPreset`) |
| Rename to "Permits and Licenses"; new category names; soonest-expiring sort | Done (step B) | Existing categories renamed, missing ones added; the list was already sorted soonest-expiring first |
| Ponds first (gating) | Verify | Dashboard setup checklist exists |
| Pond name from prefix + number; code generated once | Done (step B) | `PondNamePrefix`; existing codes kept (conversion 14) |
| Hatchery ShortCode | Done (step B) | Generated from initials for existing hatcheries |
| HatcheryCertificate history | Done (step B) | Conversion 11 |
| Fry deliveries with status history (Technician can update status) | Done (step C) | `FryDelivery`, `FryDeliveryStatusChange`; Resources → Fry deliveries |
| Buyer type (Individual / Company), privacy acknowledgement | Done (step B) | Conversion 12 |
| Size grades as a farm table | Done (steps B and E) | `SizeGrade`, seeded per farm plus labels already used |

## 3. Production model (Milestone 4): the biggest change

| Item | Status | Where / note |
| :---- | :---- | :---- |
| Preparation rounds on the pond with free-text entries and Mark Prepared | Done (step C) | `PondPreparationRound`, `PondPreparationEntry`; conversion 1 |
| Pond status precedence including Prepared | Done (step C) | `PondAppService.DeriveStatus` |
| One fry delivery → one cycle; Create Batch (Stocking) stepper | Done (step C) | `CycleAppService.CreateBatches`; conversion 2 |
| Planned status removed (cycles and batches) | Done (step C) | Values 1 and 3 retired; Planned batches voided |
| Cycle Failed status removed; failure per batch only; BatchFailure table | Done (step C) | Conversion 3 |
| Transport mode, time processed per batch | Done (step C) | Converted batches: Other / not recorded |
| No permit check in stocking (dashboard only) | Done (step C) | Reminder removed from stocking |
| Codes generated once via a locked NumberSequence | Done (step C) | Cycle code from NumberSequence; batch code = cycle code + letter; existing codes kept |
| Close Batch, Close Production Cycle, read-only after close | Done | `BatchAppService` with RowVersion |
| Row locks for delivery allocation | Done (step C) | `IRowLocker` (UPDLOCK, ROWLOCK) on the FryDelivery row |

## 4. Operations (Milestone 5)

| Item | Status | Where / note |
| :---- | :---- | :---- |
| Choose cycle then pond | Done (step D) | Operations → Record operations picks the cycle, then the pond; remembered per user |
| AM/PM feeding sessions, one or more lots each | Done (step D) | `FeedingSession`, `FeedingAppService`, Operations → Feeding; conversion 4 |
| One-way stock links | Done (step D) | `StockMovement.FeedingSessionId` or `SourceLogId`, never both (check constraint) |
| Lot-based cost | Done (step D) | `InventoryLot.UnitCost`; moving average dropped; conversion 10 |
| Chemical and Supplement Application replaces Treatment | Done (step D) | `ChemicalApplicationDetail`; several lots per application; conversion 5 |
| Mortality causes: Disease, Water quality, Others | Done (step D) | Disease name / other cause required by cause; conversion 6 |
| Post-production logs removed | Done (step D) | Historical rows shown read-only; the type cannot be created |
| Water-quality flags | Done | `WaterQualityEvaluator`; Low/High side stored |
| Recommendation texts | Done (step B) | Low/High texts, editable by the System Administrator; drafts for adviser review |
| Grouped water-quality alerts (one per pond per day) | Done (step D) | One notification per pond per farm day; grouped dashboard rows |
| Pre-stocking water quality requires DO, temperature, pH, salinity | Done (step C) | The stepper requires the four readings |
| Void with reason | Done (step D) | Owner only, logs and feeding sessions; stock reversed |
| ClientRequestId duplicate safety | Done | Logs, feeding sessions, batches; preparation entries added in step D |
| Form drafts (AC-25) | Done (steps D and E) | Log, feeding, preparation and harvest forms |

## 5. Harvest and sales (Milestone 6)

| Item | Status | Where / note |
| :---- | :---- | :---- |
| Harvest types Partial / Total | Done (step E) | `Partial`, `Final`, `Emergency` → Final becomes Total; Emergency becomes Partial or Total (by batch status) |
| Optional final count | Done (step E) | `Harvest` has no FinalCount |
| Harvest opened from the batch | Verify | Routes include `harvests/new` |
| Sale lines reference harvest grade lines; one sale across several harvests | Done (step E) | `Sale.HarvestId` plus text `SizeLabel` |
| Payments as SalePayment rows | Done (step E) | `AmountPaid` / `PaymentStatus` stored on the sale |
| Dispatch receipt number via NumberSequence; "dispatch receipt" naming | Done (step E) | "Sales record" today |
| Financial ledger removed | Done (step E; tables archived) | `FinanceEntities`, `FinanceManager`, `Sale.GeneratedTransactionId`, `/transactions` page, Income and Expense report |

## 6. Reports, dashboard, operations (Milestones 7–9)

| Item | Status | Where / note |
| :---- | :---- | :---- |
| Six named reports with card summary, sorting, filters | Change | Seven reports today (including finance) |
| Server-side pagination | New | No `PagedResultRequestDto` in the Application layer |
| CSV export with the formula-injection guard | New | — |
| Health page (version, backups, disk, certificates, errors) | New | — |
| Backups: full recovery, 30-minute log backups, CHECKDB, BackupRun, file-name patterns | Change | `scripts/backup/backup.sh` does daily full backups |
| Restore rehearsal | Done (extend) | `restore-check.sh`; extend to the log chain and a timed standby restore |
| Runbook, certificate renewal, training farm | New | `docs/backup-restore.md` covers part of the runbook |
| Automated tests | Done for the old ACs; update | 75 tests in `test/Capstone.Tests/Fpms`; many assert old behavior |
| Performance (p95 345 ms, 30,107 logs) | Done; re-run after migration | `scripts/perf/load-test.mjs` |

## 7. Data conversions (each a reviewed migration with a conversion test)

1. **Planned batches → preparation rounds.** PondPreparation logs on Planned batches become PondPreparationEntry rows (description = activity + notes), with the round marked Prepared if that batch was later stocked. Planned batches and cycles with no other records are deleted (soft). Planned batches with other records are flagged for the team to decide.
2. **Cycle per delivery.** For each existing cycle, create a FryDelivery from its hatchery and the batches' lot numbers. Its status is Received; PL received = Σ stocking counts.
3. **Batch fields.** Transport mode = Other and time processed = null for existing batches. Failure fields move to BatchFailure. Cycle Failed becomes Closed if all batches are closed, otherwise Active.
4. **Feeding rounds → AM/PM sessions.** Rounds before 12:00 farm time become AM, the rest PM. Their usage movements are re-linked to the session.
5. **Treatment → Chemical and Supplement Application.** Keep lot, quantity and reason; drop intervention type and outcome (kept in the audit history).
6. **Mortality causes.** Stress, Cannibalism, Predation, Unknown and Other → Others, keeping the old value as the description.
7. **Harvest types.** Final → Total; Emergency → Total if the batch is Failed, otherwise Partial.
8. **Size grades.** Create SizeGrade rows from the distinct labels; link grade lines and sale lines to them.
9. **Sales.** Each sale line references the matching grade line of its sale's harvest. Existing `AmountPaid` becomes one SalePayment dated at the sale date.
10. **Lot cost.** The receipt movement's UnitCost becomes the lot's UnitCost; drop `MovingAverageUnitCost`.
11. **Hatchery certificates.** The current number and expiry become the first HatcheryCertificate row.
12. **Buyers.** CompanyName → Name with type Company.
13. **Finance.** Archive the finance tables by renaming them with a `_Archived` suffix, or export them to CSV, before dropping them. Remove `Sale.GeneratedTransactionId`.
14. **Ponds.** Assign prefix + number from existing codes where they match (e.g., "GP-03"); otherwise prefix "Pond" with the next number, **keeping the existing code**.

**Rollback** for every conversion is a restore from the pre-migration backup (spec Section 6). Down() methods exist for development only.

## 8. Proposed migration order

| Step | Content | Why this order |
| :---- | :---- | :---- |
| A. Foundations | Swagger in Development only; 4-hour token with the JWT security-stamp check; lockout value; RCSI; `.editorconfig` and `dotnet format`; log rotation; entity-history list; background-worker scaffold | No data changes; lowest risk |
| B. Reference and setup data | Size grades, hatchery short codes and certificates, buyers, pond prefixes, farm settings, permit renames, recommendation fields, NumberSequence | Later steps depend on them |
| C. Production model | Fry deliveries, preparation rounds, stepper, Planned removal, BatchFailure, transport fields (conversions 1–3, 14) | The biggest change; needs B |
| D. Operations | AM/PM sessions, chemical application, mortality causes, void fields, grouped alerts, drafts (conversions 4–6, 10) | Builds on C |
| E. Harvest and sales | Harvest types, final count, grade-line sale lines, payments, dispatch receipt, finance removal (conversions 7–9, 12, 13) | Builds on B and C |
| F. Reports and operations | Six reports, pagination, CSV export, health page, backup scripts and BackupRun, runbook | Uses the final schema |
| G. Quality | Update the tests to AC-01–AC-27, smoke test, performance re-run, timed restore, accessibility on tablets | Final evidence |

## 9. Spec amendments (approved 22 Oct 2026, DEC-45, spec v2.4)

1. **Permission names:** keep the existing `Farm.{Area}.{Action}` and `System.*` scheme (DEC-41 example names change).
2. **Enums:** stay integers with explicit fixed values instead of strings (DEC-40, DEC-43).
3. **Notifications:** keep the existing FarmNotification tables, adding grouping and owners-only targeting, instead of ABP's system (DEC-43).
4. **Password policy:** keep the existing stricter rule (upper, lower and digit; 8+ characters).
5. **Lockout duration:** 15 minutes (current code).

## 10. Spec v2.5 additions (25 Oct 2026, DEC-49 to DEC-55)

| Item | Status | Where / note |
| :---- | :---- | :---- |
| Notifications only for time-triggered events; entry checks inline and in summaries | Change | Retire the step D grouped water-quality notifications; dashboard summary counts (DEC-49) |
| FeedingSession Status (Fed, NotFed) | New | Schema and feeding sheet (DEC-50) |
| Daily log status view; Close Batch blank-day list | New | Dashboard / operations; Close Batch dialog (DEC-50) |
| Reject logs dated after the Total harvest | New | Log and feeding services; salvage exception (DEC-51) |
| Batch snapshots (farming system, construction, density flag); DensityBand reference data | New | Migration with backfill from current pond values (DEC-52) |
| EstimatedSurvivalPct on growth sampling; remaining-population formula | New | IndicatorCalculator; reference batch test for both bases (DEC-53) |
| Farm-wide daily feeding sheet grouped by pond; pond-first operations | Change | Step D feeding page and Record operations (DEC-54, provisional) |
| Sale transport details; DeadAtHarvest; BFAR number on the receipt | Done (step E) | DEC-55 |
| DEC-56 to DEC-62 | Proposed | Not scheduled until the adviser and partner farm answer |

## 11. Spec v2.6 changes (26 Oct 2026, DEC-56 to DEC-68)

Planning only; code changes come later as reviewed migrations with conversion rules. Values marked † wait on the adviser or the partner farm.

| Item | Status | Where / note |
| :---- | :---- | :---- |
| Stocking window checked against the delivery's received date; newest-first delivery picker with older deliveries hidden; review names the delivery | Change | Stepper and stocking service; FarmProfile.StockingWindowDays (default 1 †) (DEC-63) |
| Finish stocking with PL not stocked and reasons; delivery closed; dashboard reminder | New | FryDelivery.StockingFinishedAt/By, FryDeliveryShortfall; PL-left formula (DEC-63) |
| Owner reopening of batches and cycles with a reason; cycle outcome Completed / Failed at closing | New | ReopenEvent; ProductionCycle.Outcome; close dialogs; reports (DEC-64) |
| Farming systems without super-intensive; construction types without Other | Change | Enums and existing rows: conversion maps existing values after Owner review (DEC-65) |
| Density bands per farming system and construction type; flag Within / Below / Above; between-band densities warn | Change | DensityBand reseed (197:2025 †); backfill DensityFlag for BetweenBands rows (DEC-52, DEC-65) |
| Reject logs and feeding sessions dated before stocking; histories show recorded time | Change | Log and feeding services; history panels (DEC-66) |
| 197:2025 water ranges as defaults | Change | ParameterDefinition reseed; boundary tests updated; past flags kept (DEC-56) |
| Farm Standards: farm overrides of ranges, bands and † thresholds | New | FarmParameterRange, FarmDensityBand, FarmThreshold; settings page; effective-value lookup in every check (DEC-58) |
| Treatment record: dosage, method, end date, withdrawal days, safe harvest date | New | ChemicalApplication fields; InventoryItem.ActiveIngredient and DefaultWithdrawalDays; harvest warning (DEC-57; banned-substance list dropped) |
| PL health certificate and transport permit on the delivery; dead at stocking | New | FryDelivery fields; ShrimpBatch.DeadAtStocking (DEC-59) |
| Health test hints by DOC | New | Batch page, display only (DEC-62) |
| "Ungraded / mixed" size grade; buyer's accepted kg; not-sold entries; sale due date and Overdue | Done (step E) | SizeGrade seed; SaleLine.BuyerAcceptedKg; HarvestDisposal; Sale.DueDate (DEC-67) |
| Pack sizes; earliest-expiring lot pre-selected; delivery cost shared including PL not stocked; revenue on buyer kg | New / Change | InventoryItem.PackSize; usage forms; IndicatorCalculator (DEC-68) |
| Top-up stocking (DEC-60) | Rejected | No change |
| Feeding sessions per day (DEC-61) | Waiting | AM/PM unchanged until the partner farm answers |

## 12. Post-v2.6 additions (31 Oct 2026, DEC-70 to DEC-72)

Built on branch `feature/sfsc-feeding-time-trace`. The backend builds and 224 of 224 tests passed in a Codespace (31 Oct 2026). The Angular screens are not yet checked by hand. Migrations are generated per Codespace, so no migration file is in the change; after switching to the branch, delete the old `Migrations` folder and the database volume before starting (README).

| Item | Status | Where / note |
| :---- | :---- | :---- |
| Optional SFSC number on the fry delivery; DTP/LTP label | Change (backend tested; screens not checked) | `FryDelivery.SfscNo`; delivery forms; Batch detail; dispatch receipt; delivery CSV (DEC-70, AC-39) |
| Optional time of feeding on a Fed session | Change (backend tested; screens not checked) | `FeedingSession.FedAtTime`; feeding sheet; history; feeding CSV (DEC-71, AC-40) |
| Trace report for one batch | New (backend tested; screens not checked) | `TraceAppService`, `TraceDtos`, `trace-report.component.ts`; Batch detail "Trace" button (DEC-72, AC-41) |
| Flagged stock lots listed at Close Batch and marked on the trace report | New (backend tested; screens not checked) | `BatchAppService.GetCloseCheck` FlaggedLots; trace DTOs and page (DEC-73, AC-42) |
| Tests for the additions | Done (backend) | 224 of 224 passed, including the SFSC, time fed, trace and flagged-lot tests. Angular screens not yet checked |
| Enforcing the SFSC (warnings at stocking, sale, Close Batch; optional Owner switch) | On hold | Waiting on the adviser and partner farm; see DEC-70 open question |
| BFAR Farm Certification preset under Permits and Licenses (3-year expiry, possibly required) | On hold | Depends on whether the farm holds an FAO 225-1 accreditation; see DEC-70 open question. The SFSC itself stays on the delivery |
| Spec Section 7 milestone list and the test-report | Not updated | The 22 Oct test report predates v2.5, v2.6 and these changes |
