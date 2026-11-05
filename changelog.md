# Changelog

All notable changes to this project are documented here.

## Unreleased

### Added (pond rules, preparation actions and the pond page; not built or run yet)
- Pond fields lock once a pond has been in production. While a batch is open, the area, the depths and the farming system cannot change. Once any batch exists, the purpose cannot change. The construction type is fixed from the moment the pond is created, because the pond's name and code depend on it (a wrong entry means adding a new pond). After the batches have closed, area and depth can still be corrected, but a change note is required and goes in the pond history; earlier batches keep the area they were stocked with. The pond detail now reports `LockedFields` (field and reason) and `SizeChangeNeedsNote`, and the page shows a lock and the reason beside each locked field.
- Ponds can be archived and restored (Ponds manage permission). An archived pond keeps its batches, history, number and code, but leaves the pond list, the dashboard and every choice list, and cannot be edited, prepared or stocked until restored. Only a pond with no open batch and no preparation round in progress can be archived. The ponds page has a "Show archived ponds" checkbox. New endpoints `Pond.Archive` and `Pond.Restore`; `Pond.GetAll` takes `includeArchived`. The data model gains `Pond.IsArchived`: reset the database as the README describes.
- The create-pond form now warns that the construction type cannot be changed afterwards.
- Pond preparation: a Prepared pond can be reopened (back to Under preparation) and an unused round can be abandoned; both need the Ponds manage permission and a reason, and are logged in the pond history as "Preparation change". A preparation entry can be edited or removed (reason required) until the pond is marked Prepared. The pond detail shows how many days ago the pond was marked Prepared, with a warning after 30 days (`PondPreparationRound.StaleAfterDays`, fixed in code).
- New endpoints `Pond.ReopenPreparation`, `Pond.AbandonPreparation`, `Pond.EditPreparationEntry` and `Pond.VoidPreparationEntry`.
- Pond page: summary tiles and Overview, Details, Batches and History tabs (the tab is kept in the address). Details are read-only until Edit is pressed. History can be filtered by type. The purpose is now a choice (it was fixed text) until a batch exists.
- Creating a pond without a prefix when that construction type's default prefix (Earthen, Concrete or HDPE-lined pond) is inactive now says so and what to do.
- New tests in `PondRules_Tests`.

### Changed (navigation; not built or run yet)
- The failure report uses the pond area each batch was stocked with, not the pond's current area.
- The Back button on a record opened from the dashboard goes to that record's own list instead of the dashboard. The batch page's Back goes to the batch list (it went to the cycle page). From any other page it still returns to where you came from.
- The sidebar highlight follows the page you end up on, including redirects such as /app to the dashboard, is lit as soon as the destination is known, and goes back to the current page when a move is cancelled (for example the unsaved-changes prompt). It is repainted explicitly because the app runs without zone.js.
- The "Record operations" button is removed from the Ponds and Batches lists (it opened the wizard with nothing chosen). It stays on a batch page and in the Operations section; the pond cards still open the wizard for a pond and day.

### Fixed (build; found in GitHub Actions)
- Creating a pond without a prefix failed with "no such entity" when its default prefix was created on the spot; the new prefix is now used directly. The AC-04 test expected a pond without a prefix to be rejected, which is no longer true (the construction type names it); it now checks an unknown prefix instead.

### Added (suggested farm code and usernames, DEC-75; built and 245 tests passed in GitHub Actions; screens not checked by hand)
- Register: the farm name now comes before the farm code, and the farm code is filled in from it (`GENSAN-SEMI`, then `GENSAN-SEMI-2` when taken). The Owner username is filled in from the first initial and surname (`jdelacruz`). Both can be changed before saving; once changed, they are not replaced again.
- Farm › Users: a new account's username is filled in the same way, with `2`, `3` and so on when the name is taken in this farm.
- New endpoints `Account.GetRegistrationSuggestions` and `FarmUser.GetSuggestedUserName`; the rules live in `AccountNameGenerator`.
- A GitHub Actions build (`.github/workflows/build.yml`) runs on every push: API build and tests, the Initial migration, and the Angular build.
- The farm code index (`AbpTenants.TenancyName`) and the username index per farm (`AbpUsers` TenantId + NormalizedUserName) are now unique. Two saves of the same value cannot both succeed; the second gets a message to choose another.

### Changed (home page, sign-in redirect and routes; not built or run yet)
- The home page is one minimal screen: the Farm.Shrimp.io wordmark and Sign in at the top; a centred "Feed. Log. Harvest." headline with one line, Create a farm account and Sign in buttons; and a small footer. The records diagram, the facts strip, the feature cards, the "Built for wet hands" band and the closing section are removed for now (see commit bd251ae to bring them back).
- The home page is now at "/" (the old /welcome address still works) and is for visitors only: it offers Sign in and Create a farm account. A signed-in user who opens "/" goes straight to their start page (Dashboard, or Farms for the System Administrator). On small phones the top bar keeps only Sign in.
- After signing in from the home page (or from /account), the app used to go back to the welcome page. It now reopens the requested page only when it is inside the app (a bookmark or shared link), and otherwise opens /app, which sends the System Administrator to Farms and farm users to the Dashboard. Registering a farm and the forced password change use the same rule.
- Sign-in, register and change-password pages no longer lose their top on short windows (a laptop, or the taller register form): the page grows and scrolls instead of being fixed to the window height, and is still centred when it fits. The logo is a little smaller and the card padding a little tighter; fields and buttons keep their touch sizes.
- Signing out goes straight to the sign-in page, so handing over a shared tablet takes one step.
- A signed-in user who opens the sign-in or register page goes straight into the app.
- Unknown addresses, including /app pages that do not exist, go to the home page (or into the app when signed in) instead of a blank screen.
- A user with no permission for their usual start page goes to My account instead of being redirected in a loop.
- The logo on the sign-in pages opens the home page without reloading the site; "What is FPMS?" now reads "What is Farm.Shrimp.io?".

### Changed (branding: Farm.Shrimp.io; not built or run yet)
- The app is named Farm.Shrimp.io (tagline: Farm Production Management System). Browser tabs read "Page name · Farm.Shrimp.io", or just "Farm.Shrimp.io" when a page has no title. Footers, the welcome page and desktop notifications use the new name.
- The four-ponds drawing is replaced by the logo: the shrimp mark and the name in the sidebar and on the welcome page, the full Farm.Shrimp.io wordmark on the sign-in and register pages (light backgrounds only). One shared `fpms-logo` component replaces three copies of the drawing, and `shared/fpms/brand.ts` holds the name.
- Tab icon, tablet home-screen icon and notification icon added (they were missing). Images are in `angular/src/assets/img/brand/` and are PNG exports of the final logo; the SVG source is kept outside the repo to save space.
- The interface colours follow the CFLRS logo: sidebar indigo #213260, buttons and links mid blue #1b6697 (hover #063e6a), hover and selected backgrounds aqua mist #def4f4. Text and button contrast stays above 4.5 : 1. Status colours (success green, warning gold, error red) are unchanged, and the logo's green is used in the logo only.
- The glow colour for marks on dark backgrounds now matches the logo orange (#ff921e).
- Not renamed: the ABP localization source `Capstone` (`AppConsts.ts`), which the server also uses.

### Added (batch log calendar, DEC-69; not built or run on a machine with .NET yet)
- Batch detail shows a Log calendar: one square per day from stocking to the end of culture, amber when nothing is logged, green for 1 to 3 of AM, PM and water, with dots for mortality, growth sampling and chemical entries. New endpoint `Batch.GetLogCalendar`.
- Close Batch is unchanged: it still only warns about blank days (DEC-69).

### Added (step F, reports and operations; browser check still open)
- Server-side paging on every long list (25 per page by default, 100 at most; a larger request is refused) with sortable columns, and totals for all matching rows (AC-27). Master lists stay unpaged.
- Six named reports: Production Cycle Performance, Batch Harvest and Survival, Sales by Buyer and Period (new), Water Quality Exceptions, Feed and Additives Usage, and Batch Failure Report. Date ranges are limited to 24 months, except for one batch or cycle. Operational history tab removed.
- CSV export of lists and reports (Owner only, audit-logged, formula-injection guard, UTF-8 with byte-order mark, dates in farm time).
- System health page for the System Administrator: version, database size, free disk, last backup of each job, certificate expiry, server errors and the backup history. Critical alerts show as a banner for the System Administrator and the Owners (AC-26).
- Backup scripts: daily full backup, 30-minute log backup, weekly integrity check, weekly encrypted off-site copy, retention (14 days, Sundays for 12 weeks, monthly for 5 years), restore with the log chain and a point-in-time option, timed restore test, certificate renewal, and Windows and cron schedules. Every run is recorded in `FpmsBackupRuns`.
- `docs/runbook.md` for the farm server: installation, schedule, health alerts, restore, certificate renewal, account recovery and release and rollback.
- Migration `Fpms_StepF_BackupRuns` adds the backup table and sets the database to the FULL recovery model.

### Deviations from the plan (step F)
- Master lists (ponds, buyers, hatcheries, items) are not paged.
- Sales and fry-delivery lists are paged in memory after filtering, because payment status and Overdue are computed.
- Health alerts are computed live when the page or banner is read, instead of by a 15-minute worker. The only worker is the daily audit-log purge.
- The backup scripts are not run on the farm PC yet; the restore test has not been run against a real farm backup.

### Changed (code, step E: harvest and sales)
- Harvests are Partial or Total. Saving the Total harvest marks the batch Harvested; changing it back to Partial reverts the batch. Optional final count and dead-at-harvest count (DEC-55).
- Harvest weight is split into grade lines linked to the farm's size grades, including "Ungraded / mixed". Kg that are not sold are recorded as home use, given away, spoiled or other (DEC-67). The harvest form keeps a draft.
- One sale can sell grade lines from several harvests. The buyer's accepted kg sets the amount; a large weight difference warns (DEC-67).
- Sales get a dispatch receipt number (DR-yyyy-nnnn), an optional due date with an Overdue badge and filter, transport details and the farm's BFAR registration number on the printed receipt (DEC-55, DEC-67).
- Payments are separate rows; the Owner can remove a payment or void a sale with a reason.
- Close Batch shows harvested kg not yet sold or recorded as not sold.
- Batch finance shows revenue (on buyer kg), inventory use and the batch's share of the delivery cost, including PL not stocked (DEC-68).
- Removed: income and expense records, the Transactions page, the Income and Expense report and the Mark harvested button. Old finance rows are kept in `FpmsTransactions_Archived` and `FpmsTransactionCategories_Archived`.
- Migration `Fpms_StepE_HarvestSales` converts existing harvests (Final → Total; Emergency → Total if the batch failed, else Partial), links grade and sale lines to size grades, turns amounts paid into payment rows and keeps existing sale references as receipt numbers.

### Changed (spec v2.6, planning only; no code yet)
- **Specification v2.6** after a production business logic review (26 Oct 2026): decisions DEC-63 to DEC-68 added; DEC-56 to DEC-59 and DEC-62 accepted, DEC-60 rejected, DEC-61 waiting on the partner farm.
- Stocking is checked against the delivery's received date (window default 1 day †), never today, so late entry still works; Finish stocking records PL not stocked so every delivery adds up (DEC-63).
- The Owner can reopen a closed batch or cycle with a reason; a cycle closes as Completed or Failed (DEC-64).
- Farming systems are extensive, semi-intensive and intensive; construction types are earthen, concrete and HDPE-lined; density bands come from PNS/BAFS 197:2025 per construction type and warn, never block (DEC-65).
- Logs can't be dated before stocking; histories always show when an entry was recorded (DEC-66).
- Water-quality defaults follow PNS/BAFS 197:2025; Owners can adjust ranges, bands and thresholds in Farm Standards (DEC-56, DEC-58).
- Treatment records gain dosage and withdrawal days with a safe-harvest warning (DEC-57; the banned-substance list was dropped); deliveries gain the PL health certificate and batches a dead-at-stocking count (DEC-59).
- Harvest and sales: an "Ungraded / mixed" grade, buyer's accepted kg, not-sold entries and sale due dates (DEC-67).
- Inventory pack sizes, earliest-expiring lot pre-selected, delivery cost shared including PL not stocked (DEC-68).

### Changed (spec v2.5, planning only; no code yet)
- **Specification v2.5** and decisions DEC-49 to DEC-55 (accepted) and DEC-56 to DEC-62 (proposed), after a review against PNS/BAFS 197:2025, 135:2025, 338:2022, 48:2022, the BAFS explanatory manual and the BFAR Shrimp Farmers' Manual.
- Out-of-range readings and other entry checks warn on screen and in dashboard summaries and reports; notifications only for permit expiry and system alerts (DEC-49).
- Feeding sessions can be marked Not fed; a Daily log status view shows blank days; Close Batch lists them; late entry has no cutoff (DEC-50).
- Logs dated after the Total harvest are rejected (DEC-51).
- Batches keep the pond's farming system, construction and density judgment from stocking; density bands become reference data (DEC-52).
- Growth sampling can record estimated survival, used for biomass (DEC-53).
- One farm-wide feeding sheet grouped by pond (DEC-54, provisional).
- Step E adds sale transport details, dead-at-harvest count and the BFAR number on the dispatch receipt (DEC-55).

### Added
- **Planning specification** [docs/Capstone-Planning.md](docs/Capstone-Planning.md) v2.4. It covers the PRD, TRD, app flow, UI/UX brief, backend schema in third normal form with a validation and integrity catalog, a reliability, scalability and maintainability plan, the implementation plan, decisions DEC-01 to DEC-45, manuscript alignment notes, and a terminology map. It gives the build an agreed, traceable scope before any code is written.
- **Repository guide files:** README.md, roadmap.md, architecture.md, changelog.md, decisions.md.
- **Gap analysis** (docs/gap-analysis.md): every AC and DEC marked Done, Change, or New against the current code, 14 data conversions, and the migration order A–G.

### Changed (migration step D, operations; DEC-48)
- **Operations menu.** Feeding (AM/PM), Record operations, Logbooks and printable sheets moved to their own menu. Record operations asks for the production cycle, then the pond; your last choice is remembered.
- **Feeding is AM and PM.** One page shows every pond of a cycle for a day: tick AM or PM, enter kilograms and the feed lot (add another lot if a session used two). Saving a session again corrects it, and the stock is corrected with it.
- **Chemical and supplement application** replaces "Treatment / health intervention": one or more product lots, quantities and a reason.
- **Mortality causes** are Disease (with the disease name), Water quality, or Others (with a description).
- **Owners void mistaken entries with a reason**: logs and feeding sessions disappear from records and indicators, and their products go back to stock. Technicians correct their own entries.
- **Unsaved forms survive a dropped connection.** Log, feeding and preparation forms keep a draft on the tablet for the signed-in user only, for up to 24 hours.
- **Water-quality alerts** come once per pond per day and list every out-of-range reading with Low or High.
- **Stock lots show their unit cost**, and the lot ledger shows where each movement came from (for example "PM feeding, 2026-10-22"). The average cost column was removed.
- Existing data was converted: feeding rounds became AM/PM sessions with the same feed totals, treatments became applications, mortality causes were mapped, and lot costs were taken from their receipts. The old detail tables are kept as archives.

### Changed (migration step C, production model; DEC-47)
- **Fry deliveries** (Resources → Fry deliveries): the Owner records each delivery (hatchery batch number, date, PL age, PL received, cost); the Owner or a Technician updates its status (Ordered, In transit, Received, Rejected) with a note, and every change is kept with who made it.
- **Pond preparation is on the pond.** Add dated entries describing the work; the pond shows Under preparation, then Prepared after Mark Prepared.
- **Create Batch (Stocking)** replaces "new cycle → plan batch → stock batch". One stepper picks a Received delivery, allocates PL to Prepared ponds, records stocking details (transport mode, time processed, acclimation, survival estimate) and pre-stocking water quality, shows a review, then creates the cycle and its batches together. More batches can be added from the cycle while PL is left. Codes are generated: cycle "2026-10-SBH-01", batches "…-A", "…-B".
- **No Planned cycles or batches.** Failure is declared per batch; a cycle is Active or Closed.
- **Stocking no longer shows a permit reminder** (the dashboard still does).
- Existing data was converted: each cycle got its delivery, Planned batches were voided with their preparation moved to the pond, and existing codes were kept.

### Changed (migration step B, reference and setup data; DEC-46)
- **Pond names follow a pattern.** A new pond is a name prefix plus a number ("Grow-out Pond 3") and gets a code made once from the prefix's short code ("GP-03"); nobody types the pond ID any more. Owners manage the prefixes under Ponds → Name prefixes. Existing ponds keep their codes; their old free-text names are kept in the notes.
- **Farming system is set for the whole farm** in Farm Profile → Settings; a pond can still set its own.
- **Hatcheries** have a short code (used later in cycle codes) and a certificate history: a renewal adds a certificate and the old one stays. The existing certificate number and expiry became the first entry.
- **Buyers** are an Individual or a Company. For an individual, the Owner confirms the buyer was told their details are kept for sales records (Data Privacy Act).
- **Size grades** are a farm list (30/40 to 100/120 to start) under Harvests → Size grades.
- **Dates and times** show as "Oct 22, 2026 2:30 PM" by default; the Owner can switch to day first and 24-hour time.
- **"Compliance documents" is now "Permits and licenses"**, with the spec's category names (Business and Local Permits, Fisheries (BFAR), Environmental (DENR), Tax (BIR), Water Rights (NWRB), Land / Lease, Health and Safety, Other).
- **Out-of-range water-quality warnings include a recommendation** (draft texts for the adviser to review; the System Administrator can edit them).

### Changed (migration step A, foundations; built and tested; manual checks skipped for now)
- **Sessions end sooner and safely (DEC-37).** Sign-in tokens last 4 hours instead of 10. Every request checks the account's security stamp, so a deactivated account or a changed password ends all sessions within a minute. Changing your own password on My account now signs you out.
- **Swagger only in Development.** The API's start page opens Swagger in Development and `/health` elsewhere; the demo notification endpoint is removed.
- **Data-change history is narrowed (DEC-43)** to farm profile, hatcheries, feed and additive items and lots, ponds, cycles, batches, harvests, sales and permits. High-volume records (logs, feeding, measurements) no longer add entries to the activity log's change history; they keep their own recorder and void fields.
- **Read-committed snapshot** is turned on by a migration (DEC-38), so reports no longer wait on writers.
- **Log files** keep 30 × 10 MB instead of 10.
- **Background-worker scaffold** for per-farm scheduled checks (no jobs yet) and an API `.editorconfig`.

### Changed (spec v2.4, DEC-45)
- The spec now follows the existing code for permission names (`Farm.*` / `System.*`), enum storage (integers with explicit fixed values), notifications (existing farm notification tables with grouping), password policy (upper, lower, digit), and lockout (15 minutes).

### Changed
- **Specification restarted (v2.3, now v2.4) for the existing Capstone codebase.** It supersedes fpms.md v1.2–v1.5 and the D-01 to D-39 decision log (mapping in spec Appendix C). The code keeps its `Capstone.*` names. Behavior that changes from the current build:
  - **Pond preparation** is recorded on the pond, and only Prepared ponds can be stocked.
  - **Create Batch (Stocking)** is a stepper that starts the cycle from one fry delivery. Transport mode and time processed are recorded per batch.
  - **Lifecycle:** batch Stocked → Harvested or Failed → Closed; cycle Active → Closed.
  - **Daily logs:** feeding is AM/PM sessions (one or more lots per session); "Intervention" became Chemical and Supplement Application; mortality causes are Disease, Water quality and Others.
  - **Permits** are reference records named "Permits and Licenses".
  - **Sales** are per harvest grade, with individual payments and a dispatch receipt.

### Fixed
- Nothing yet under spec v2.4.

### Removed (compared with the current build)
- The planned 15-minute idle logout (DEC-37 amended 22 Oct 2026); staff use "Switch user" to hand over a tablet.
- The financial transaction ledger.
- Production protocols and "Today's tasks".
- Post-production management logging.
- The permit reminder inside batch creation (it now appears on the dashboard only).
- Moving-average stock cost (cost now comes from each lot's receipt price).

## Update rules
- Add an entry whenever user-visible behavior changes.
- Describe what changed and why it matters.
- Link to the relevant issue or pull request when available.
- Move Unreleased entries into a version section at release time (`## 0.1.0 - <date>` at the end of Milestone 2, then one version per milestone).
- Use Git history for version recovery; use this file for a readable summary.
