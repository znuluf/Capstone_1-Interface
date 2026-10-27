# Functional test report: Milestone 8

> Historical record from the team's MacBook Pro runs. The performance scripts and the build agent it mentions were removed from this Codespace repository.

Structured functional testing (manuscript Objective 3; fpms.md Section 1 evaluation method and Section 6 test checkpoints).

| Item | Value |
| :---- | :---- |
| Build | branch `feature/p1-build` |
| Run date | 22 Oct 2026 (Asia/Manila) |
| Environment | Team MacBook Pro (x86-64), .NET 9.0.318 SDK, SQL Server 2022 CU16 Developer in OrbStack, Node 24 for scripts |
| Data | Development seed (two test farms, D-27); performance farm `perf-farm` (D-26) |
| Evidence | `dotnet test test/Capstone.Tests` (xUnit), `scripts/smoke-test.mjs` (API over HTTPS), browser walk-through, `scripts/perf/load-test.mjs`, `scripts/backup/restore-check.sh` |

## Summary

| Area | Result |
| :---- | :---- |
| Backend automated tests | 77 of 77 passed (including 8 new acceptance tests for this milestone) |
| API smoke test (HTTPS, real JWT, two farms) | 32 of 32 checks passed |
| Acceptance criteria AC-01 to AC-22 | 22 of 22 passed |
| Farm isolation (two farms) | Passed (see AC-21) |
| Performance (D-26) | Passed after a fix: p95 345 ms, 0 errors (794 requests, 5 users, 30,107 logs) |
| Backup and restore (D-22) | Passed: backup restored into a separate database; 32 tables and 3 documents identical |
| Open critical/high defects | None |

## Acceptance criteria

"Unit" = xUnit test in `aspnet-core/test/Capstone.Tests/Fpms`; "Smoke" = check in `scripts/smoke-test.mjs`; "UI" = browser walk-through on 22 Oct 2026.

| AC | Criterion (short) | Evidence | Result |
| :---- | :---- | :---- | :---- |
| AC-01 | Registration creates tenant, profile, roles, categories, Owner in one transaction; nothing on failure; toggle | Unit: `Registration_creates_farm_profile_roles_categories_and_owner`, `Duplicate_farm_code_is_rejected_and_nothing_is_created`, `Registration_can_be_disabled_by_the_system_administrator` | Pass |
| AC-02 | Owner creates Owner/Technician accounts in own farm; forced password change | Unit: `Owner_creates_technician_who_must_change_the_temporary_password`, `Weak_temporary_password_is_rejected`, `Last_active_owner_cannot_be_deactivated`; Smoke: owner creates technician, must change password, limited token, signs in after change | Pass |
| AC-03 | Compliance records (D-30): preset or custom title, reference number, perpetual vs expiry rules, unique current reference number, Expiring soon / Expired, dashboard reminder, renewal archives the old record | Unit: `AC03_expiry_status_follows_the_alert_window_and_reaches_the_dashboard`, `AC03_any_current_record_satisfies_a_required_permit_without_approval`, 11 tests in `Constraints_Tests`; Smoke: record saved, duplicate and perpetual refused, upload endpoint gone, second farm denied; UI: list, status tiles, Add dialog (22 Oct, after the D-30 revision) | Pass (re-run 22 Oct after D-30) |
| AC-04 | Pond saved Available with history; duplicate and invalid ponds rejected | Unit: `AC04_new_pond_is_available_with_a_history_entry_and_invalid_ponds_are_rejected`; UI: new pond with depth validation | Pass |
| AC-05 | Receipt increases stock; unit cost generates expense; moving average | Unit: `Costed_receipt_increases_stock_updates_moving_average_and_creates_an_expense`, `Stock_on_hand_equals_the_movement_ledger`, `Adjustment_requires_a_reason`; UI: receipt of 100 kg at ₱74 created ₱7,400 expense | Pass |
| AC-06 | Cycle created Planned; dates ordered; unique code | Unit: `AC06_cycle_requires_ordered_dates_and_an_active_hatchery`, `AC06_to_AC18_full_lifecycle_from_new_pond_to_closed_cycle` | Pass |
| AC-07 | Batch planned on a grow-out pond without an open batch | Unit: `Second_open_batch_on_a_pond_is_rejected`, `Batch_cannot_be_planned_on_a_non_grow_out_pond`, `Eligible_ponds_exclude_ponds_with_open_batches` | Pass |
| AC-08 | Stocking sets Stocked, density, certification snapshot, cycle Active | Unit: `First_stocking_warns_about_missing_documents_and_records_the_owner_override`, `Stocking_rejects_zero_pl_and_future_time`, `Stocking_requires_temperature_salinity_ph_and_do`; UI: stocked B-2026-03-P03 at 100 PL/m² | Pass |
| AC-09 | Missing required permits give a reminder at first stocking; stocking never blocked (D-30) | Unit: `First_stocking_reminds_about_missing_permits_but_never_blocks_even_for_a_technician` | Pass (re-run 22 Oct after D-30) |
| AC-10 | Log stored with batch context and recorder; retry not duplicated | Unit: `Resubmitting_the_same_client_request_id_does_not_duplicate`, `Feeding_sheet_saves_several_rounds`; Smoke: retry with same ClientRequestId | Pass |
| AC-11 | Out-of-range reading saved, flagged, alerted on dashboard | Unit: `Out_of_range_water_quality_is_saved_flagged_and_alerted`, `Readings_are_flagged_against_optimal_ranges` (boundaries: DO 5.0/4.9, pH 8.3/8.4, TAN 0.029/0.03, ALK 100/101, NO2 1.0, SAL 15/35.1); Smoke: dashboard alert list; UI: DO 4.8 flagged | Pass |
| AC-12 | Usage reduces lot; shortfall warns, saves, flags lot | Unit: `Feeding_log_creates_a_usage_movement_and_updates_cumulative_feed`, `Treatment_with_product_deducts_supplement_stock`, `Stock_shortfall_warns_saves_and_flags_the_lot`, `Technician_edits_own_entries_only_and_edits_reverse_stock` | Pass |
| AC-13 | ABW and growth rate computed; mortality lowers population | Unit: `Growth_sampling_computes_abw_and_growth_rate`, `Mortality_reduces_the_estimated_population`, `Abw_and_growth_rate` | Pass |
| AC-14 | Harvest linked to batch; Harvested only after a Final harvest | Unit: `Mark_harvested_requires_a_final_harvest`, `Grade_lines_cannot_exceed_harvest_total`; UI: partial harvest with grading | Pass |
| AC-15 | Sale total; sold ≤ unsold; income generated; printable record | Unit: `Sale_cannot_exceed_unsold_harvest_and_total_equals_generated_income`, `Generated_transactions_cannot_be_edited_directly`; UI: sale 250 kg × ₱260 = ₱65,000, income recorded, printable record with internal-document notice | Pass |
| AC-16 | Batch or cycle failure with reason, date, loss; failure report | Unit: `Cycle_failure_fails_every_open_stocked_batch`, `AC06_to_AC18_full_lifecycle_from_new_pond_to_closed_cycle` (single batch, future date rejected, report) | Pass |
| AC-17 | Close computes and stores final indicators; read-only; pond available | Unit: `Closing_a_batch_stores_final_indicators_and_makes_records_read_only`, full-lifecycle test (confirmation required) | Pass |
| AC-18 | Cycle closes only when all batches are Closed; summary final | Unit: `Cycle_cannot_close_while_batches_are_open`, full-lifecycle test (closes, report `IsFinal`) | Pass |
| AC-19 | Reports filter by farm and Asia/Manila days; indicators match formulas | Unit: `Harvest_summary_uses_farm_day_boundaries`, `Cycle_report_reconciles_with_source_records`, `Farm_day_boundaries_use_asia_manila`, `Reference_batch_indicators_match_hand_calculations` (docs/reference-batch.md); Smoke: 8 Sep = 2,500 kg | Pass |
| AC-20 | Invalid or impossible input commits nothing | Unit: `Invalid_reading_commits_nothing`, `Physically_impossible_readings_are_rejected` (pH 15, TEMP 46, DO −1), `AC20_negative_or_impossible_values_commit_nothing`; Smoke: pH 15 rejected | Pass |
| AC-21 | Another farm's records denied, nothing disclosed | Unit: `Another_farms_identifiers_resolve_to_not_found`, `Second_farm_sees_only_its_own_ponds`, `AC21_another_farm_cannot_write_to_or_report_on_pilot_records`; Smoke: second farm cannot read batch or download document | Pass |
| AC-22 | System Administrator unlock/temporary password, audit-logged; no farm data | Unit: `System_administrator_issues_a_temporary_password_after_identity_check`, `System_administrator_cannot_read_farm_records`, `Farm_users_cannot_call_system_administration`; Smoke: admin denied farm data, security log; UI: admin menus only | Pass |

## Section 6 checkpoints not tied to a single AC

| Checkpoint | Evidence | Result |
| :---- | :---- | :---- |
| Technician cannot reach Owner-only screens or endpoints | Unit: `Technician_cannot_reach_owner_only_areas`; UI: Technician menu has no Users, Documents, Buyers, Sales, Transactions, Reports | Pass |
| Missing, expired or tampered JWT rejected | Smoke: tampered JWT rejected, missing JWT rejected | Pass |
| Password hashes only; secrets not in source | `git grep` finds no key or password; `appsettings.json` has empty key and no password; API refuses to start without a 32+ character key | Pass |
| Purchase vs usage cost not double counted | Unit: `Cycle_report_reconciles_with_source_records`; Income and expense summary shows the two views separately | Pass |

## Performance (D-26)

Conditions (D-26): one farm (`perf-farm`, Migrator `--perf-data`) with two years of synthetic records: 10 grow-out ponds, 4 cycles, 20 batches (15 closed, 5 stocked), **30,107 log entries** (25,005 water-quality measurements, 15,879 stock movements in the database at run time). Five concurrent users signed in with real JWTs: 2 Farm Owners and 3 Farm Technicians, each issuing ordinary reads and writes with a 0.3–0.9 s pause, for 120 seconds. API built in Release, SQL Server 2022 in OrbStack on the same Mac, HTTPS on localhost. Large reports are excluded from the target by D-26 and listed for information.

**Result: p95 = 345 ms for 794 ordinary requests, 0 errors. Target (p95 < 500 ms) met.**

| Operation | n | p50 ms | p95 ms | max ms |
| :---- | ---: | ---: | ---: | ---: |
| Log list (batch, 100 entries) | 104 | 299 | 421 | 733 |
| Save feeding log | 76 | 208 | 417 | 751 |
| Dashboard | 130 | 169 | 294 | 587 |
| Save water-quality log | 80 | 141 | 205 | 286 |
| Batch list | 37 | 81 | 126 | 144 |
| Inventory items | 32 | 68 | 104 | 132 |
| Batch detail | 97 | 55 | 93 | 522 |
| Cycle detail | 26 | 58 | 76 | 80 |
| Feed lot options | 73 | 34 | 56 | 223 |
| Unread notifications | 24 | 22 | 50 | 59 |
| Sales (30 days) | 25 | 23 | 48 | 170 |
| Ponds | 51 | 23 | 47 | 47 |
| Transactions (30 days) | 39 | 25 | 47 | 48 |
| *Cycle Performance report (excluded)* | 27 | 226 | 354 | 775 |

Raw results: `scripts/perf/results/2026-10-21T20-16-28-039Z.json`. Re-run with `bash scripts/build-agent.sh` target `perf-run`, or `node scripts/perf/load-test.mjs https://localhost:44311 120` against a running API.

**Defect found and fixed by this test.** The first run failed the target (p95 = 10,540 ms): the log list took 7.4 s even for a single user. Database command timing showed two causes:

1. EF Core 9 sends id lists (`ids.Contains(x.Id)`) as one JSON parameter, and SQL Server chose scan plans for it (3.6 s for 100 logs). Fixed by sending such lists as literal values (`TranslateParameterizedCollectionsToConstants`, `CapstoneDbContextConfigurer`) and splitting the multi-include log query (`AsSplitQuery`).
2. ABP's farm filter is written as `(@filterOff = 1 OR TenantId = @current)`, so indexes that start with `TenantId` cannot be used for seeks. Fixed by migration `Fpms_PerformanceIndexes`, which adds indexes that start with the searched column (log batch and time, stock movement source log, lot and batch). The farm filter itself is unchanged.

After the fixes the single-user log list takes 328 ms (was 7,426 ms) and the cycle report 326 ms (was 695 ms).

## Backup and restore (D-22)

Procedure: `scripts/backup/restore-check.sh` (guide: [backup-restore.md](backup-restore.md)). It takes a full CHECKSUM-verified backup of `CapstoneDb` plus the document folder, restores both into a separate database (`CapstoneDb_RestoreCheck`) and an empty folder, and compares them with the live copies. The live database is not touched.

**Result: passed.** Backup 62 MB; restore of 7,802 pages in 0.22 s; row counts identical in all 32 FPMS and core ABP tables (for example 30,419 production logs, 25,005 water-quality measurements, 15,879 stock movements, 47 transactions, 3 compliance documents); all 3 document files identical by SHA-256.

The daily external-drive backup and weekly off-site copy for the farm PC (Windows Task Scheduler or Ubuntu cron) are documented in backup-restore.md and are set up during Milestone 9.

## Defects found during Milestone 8 and the UI walk-through

| # | Severity | Description | Status |
| :---- | :---- | :---- | :---- |
| 1 | High | Pages that keep data in plain fields stayed on "Loading…" (zoneless change detection) | Fixed before this run |
| 2 | Medium | Moving between two records of the same kind kept showing the first record | Fixed before this run |
| 3 | Medium | Open batch showed "Final FCR" and harvested-only survival after a partial harvest | Fixed before this run |
| 4 | Low | Template sign-in fails when the client and API share one origin (anti-forgery) | Avoided by D-29 (separate addresses) |
| 5 | Low | One dev-database sign-in record stored about 3 hours ahead of real time; source not identified | Watch; farm PC must use automatic clock sync |
| 6 | High | Log list took 7.4 s (single user) with the D-26 dataset; overall p95 10.5 s | Fixed (query translation, split query, migration `Fpms_PerformanceIndexes`); p95 now 345 ms |
| 7 | Low | Load-test script could report "target met" for an empty run | Fixed in the script |

## Not yet covered (carry to Milestone 9 or user acceptance)

- Accessibility check with a screen reader and on the partner farm's tablets (keyboard focus, labels and contrast were designed for WCAG 2.2 AA; not formally audited).
- Pond Wi-Fi walk test and on-site HTTPS certificate (D-21, D-23).
- User acceptance testing with partner-farm staff (task completion and observations).
- Retention periods (D-25) to be confirmed with the adviser.

## Re-run after the farm profile, pond and compliance revision (22 Oct 2026, D-30 to D-32)

| Item | Result |
| :---- | :---- |
| Restore point | git tag `pre-constraints-edits` (commit `ed4d1cf`); database backup `~/FPMS-backups/20261022-080628` taken before migrating |
| Migration | `Fpms_FarmAddressAndComplianceRecords` applied to the development database. It copied the one-line addresses into address line 1 and de-duplicated three smoke-test reference numbers ("(2)", "(3)" suffixes). Down() was written and reviewed; the round trip runs with build-agent target `migration-roundtrip Fpms_PerformanceIndexes` after the agent is restarted |
| Backend automated tests | 100 of 100 passed (new `Constraints_Tests`: 23 test cases covering compliance, farm profile and pond rules) |
| API smoke test | 33 of 33 checks passed (compliance checks rewritten for D-30) |
| Angular build | Passed |
| UI check | Registration address step, Compliance documents (status tiles, required permits, list, Add dialog), Farm profile (address, Ponds tab) viewed in the browser |
| Not re-run | D-26 performance (no change to hot paths); backup restore rehearsal (scripts are now database-only; run `restore-check` before release) |

