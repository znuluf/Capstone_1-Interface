# Changelog

All notable changes to this project are documented here.

## Unreleased

### Changed (harvest and sales screens, DEC-85; branch `feature/harvest-sales-redesign`)
- **Three tabs.** Harvest and sales now shows Harvests, Sales and Setup. Size grades, Crate types and Price tables are under Setup, as a second row; their addresses are unchanged.
- **One price and payment block.** The sale on the harvest form and the Sales form use the same price-terms fields, working line, "price differs" warning and payment fields. On the Sales form, payment terms and due date are now in a Payment card below the lines.
- **Review before a harvest-form sale.** Recording a harvest with its sale now shows "Check before saving" first, like the Sales form.

### Added (trace by lot code, DEC-84; branch `feature/lot-trace`)
- **Harvest and sales tabs.** Size grades, Crate types and Price tables are now tabs beside Harvests and Sales instead of buttons in the page headers.
- **Tally sheet button.** Every harvest row in Harvests and in the batch's Harvests tab has a labelled "Tally sheet" button (it was an unlabelled print icon on the batch), and the harvest page shows it first, as the main outline button.
- **Trace a lot code.** Reports has a "Trace a lot code" box: type the code from a crate, dispatch receipt or tally sheet to open the trace report for that one harvest. "Trace this lot" also opens it from the harvest page, the tally sheet and each dispatch receipt line, and the lot codes on the Harvests list and the batch's Harvests tab link to it.
- The lot sheet shows the batch's fry source, the feed up to the harvest day, the treatments up to the harvest, and only that harvest's sales, not-sold and not-accounted-for kg. A treatment whose withdrawal period had not ended by the harvest date is marked "not over at harvest", with a warning above the sheet. The batch trace report is unchanged.
- The lot sheet opens with the lot code, a fry-source-to-buyer chain and four summary tiles (harvested kg, where it went, fry source and SFSC, withdrawal status), so a recall question is answered before the detail. A treatment still withdrawing at harvest is a red tile and a red row, and both print. Section headings on all trace sheets are ruled and do not print alone at the foot of a page.
- **Trace sheet redesign.** The six sections are now four numbered parts: Origin (fry source and stocking as labelled facts), Grow-out (feed and treatments), Harvest (each harvest with its grades as chips) and Where it went (a bar of sold, not sold and not-accounted-for kg, then sales grouped by buyer). Lot, supplier, dose and transport details sit in a muted second line instead of extra columns; feed has a total; a lot sheet's treatments show "Ended" or "Not over" at harvest. Missing items read "Not recorded" in amber. Applies to the batch sheet too.
- **Trace sheet print layout.** Prints on A4 with a footer naming the farm and the lot (or batch) and "Page n of N", in compact 9.5 pt type. The four summary tiles print in one row, the origin facts in three columns, table headings repeat on each new page, and colours (withdrawal, missing items, the where-it-went bar) print. No blank page after the sheet. A sign-off block prints at the end: prepared by, checked by and date, or for a buyer copy, released by, date and received by.
- **Trace sheet, minimal layout.** The sheet is now set like a document: a header with the lot (or batch) code, its harvest, pond, batch and cycle; one sentence on the withdrawal status; four key figures without boxes; then 01 Origin, 02 Grow-out, 03 Harvest and 04 Where it went, using labelled lists and tables with hairlines only and right-aligned numbers. Where it went accounts for the kilos (harvested − sold − not sold = not accounted for) before the sales by buyer. Colour is used only for status: red for withdrawal not over, amber for missing records and unaccounted kg. Wide tables scroll on a phone. Replaces the tiles, chain, chips and bar.
- **Trace sheet tables.** Tables have a tinted header band, more room in each row and fixed column widths. The product or receipt is the first line in bold, with lot and supplier, then quantity, dose and prescription, on their own grey lines; date ranges are stacked ("to …"). Each buyer's group shows its receipt count and kg, and the buyer's kg shows the difference from the farm's kg (amber when lower).
- **Crate tally as a table.** On the harvest form the crates are now rows: crate no., crate type, grade, kg, crate weight and shrimp kg (when a crate type has an empty weight), and a running total, with the crate count and total kg in the footer, and the count and kg per grade when crates are graded. Each crate's type can be changed in its row. Enter after a weight goes to the next crate, or adds one of the same type and grade after the last; it no longer submits the form. Long tallies scroll with the header and total kept in view.

### Added (harvest tally sheet, DEC-80 to DEC-83; branch `feature/harvest-tally`)
- **Harvest lot code.** Every harvest gets a lot code when saved, e.g. `26-0-24-03-07-02`: year, area (0 General Santos, 1 Sarangani), barangay or municipality, farm, pond, and the pond's harvest number for the year. It never changes, appears on the harvest, receipt, tally sheet and trace report, and can be searched in Harvests and Sales. Farm profile shows the farm's part of the code, or what to fix in the address first.
- **Pricing by count and by price table.** A sale line can be priced "Base count" (a base price at a count, plus an amount for each piece per kg fewer) or "From a price table" (the row covering the shrimp's count). Sales › Price tables holds the farm's or a buyer's prices by count range. The count comes from the grade (50/60 → 55) or the harvest ABW (12.08 g → 83), and the line keeps a copy of the row and price used.
- **Grade each crate.** In the crate tally, each crate can carry its size grade; the size grading then adds up the crates.
- **Printable tally sheet.** Harvest › Tally sheet prints the harvest like the paper form, with crates, total kilos, the sale's price and amount, and signature lines.
- **Buyer on the harvest (optional).** A harvest can record its buyer ("Name of Customer") and whose scale was used. Choosing a buyer suggests their usual crate type, scale, payment terms and base-ABW terms, learned from their last harvest and sale.
- **Tally sheet entry.** On a new harvest with a buyer, turn on "Record the sale … now" to enter the price and payment on the same form. One save records the harvest and its sale together and opens the dispatch receipt. Split or partly kept harvests still use the separate screens.
- **Sell this harvest.** A saved harvest's button opens a sale with its unsold grades, its buyer and that buyer's terms.
- **Crate tally on the harvest (optional).** Enter each crate's weight, or "Add 16 crates of 30 kg", as on the paper Harvest Tally Sheet. The total kg and box count then come from the crates. Farms that weigh only a total enter it as before.
- **Crate types.** "Crate" is the standard word; a crate with no type is just "Crate". Harvests › Crate types lets the Owner name the crates the farm uses (banyera, tub, box) with their usual kg, an optional empty weight, and a default. The crate tally's quick add starts on the default ("Add 16 × Banyera, 30 kg each"). A crate type with an empty weight is weighed with the crate and the weight is subtracted. Saved tallies keep the type's name and empty weight even if it changes later. Suggested names: kind, capacity, then the owner when the crates are a buyer's ("Tub 25 kg – Mindanao Processing").
- **ABW sample on the harvest (optional).** Enter the sample weight in grams and the pieces counted; the ABW is worked out (5,002 g ÷ 414 = 12.08 g).
- **Base-ABW pricing on a sale line.** Choose "Base ABW price" and enter the buyer's base price, the base ABW and the amount per gram above it (₱210 at 10 g + ₱5/g → ₱220.40 at 12.08 g). The shrimp ABW defaults to the harvest's sample, the terms are prefilled from the buyer's last base-ABW sale, and the dispatch receipt shows them. A different agreed price is saved with a warning. "Fixed price" works as before.
- The `rkabubba-aqua` sample has two crate types ("Banyera 20 kg", the default; "Tub 25 kg – Mindanao Processing", lent by the processor and weighed with the tub), its harvests have banyera crate tallies and ABW samples, and the local processor's 60/70 sales use base-ABW pricing (₱300 at 12 g + ₱10/g).
- The `rkabubba-aqua` market buyer has a price table by count, used for the 50/60 sales (55 pcs/kg → ₱380).
- Data model change: drop the development database and let the Codespace generate a new Initial migration.

### Added (barangay dropdown)
- The farm address (registration and Farm profile) now has a Barangay dropdown that follows the chosen city or municipality: General Santos City (26), Alabel (14), Glan (31), Kiamba (19), Maasim (16), Maitum (19) and Malapatan (12). It is saved in the farm's address line 2, so no database change. Malungon's list is not included yet, so its barangay is typed in. An older value outside the list is kept. Source: Wikipedia lists, not yet checked against the PSA/PSGC.

### Changed (development data)
- The Simple sample (`FPMS_Simple`, farm `rkabubba-aqua`) is now the development database: the Codespace starts it by default (`SEED_SAMPLE_DATA=0` for the clean `FPMS`), and the Development environment seeds it. The older "Test farms (Development)" data (`pilot-farm`, `test-farm-b`) is removed from the app, along with `Seed:DevelopmentData`, the migrator's `--dev-data` and the sign-in buttons for those farms; the backend tests keep it as a test-only fixture (`test/Capstone.Tests/TestData`). The API smoke test (which needed those farms) is removed.

### Removed (hosting files)
- The root and Web.Host `Dockerfile`s, `.dockerignore`, `render.yaml`, `deploy/render/` and `docs/render.md` (Render hosting). The Codespace only needs `.devcontainer/` and `aspnet-core/docker/sqlserver/` (SQL Server in Docker), which stay.

### Added (sample: a delivery to stock)
- The `rkabubba-aqua` sample now has a received, unstocked fry delivery from RDEX (303,000 PL, dated the seed day) and two Prepared ponds, EP-02 and HP-02, so "Stock a batch" can be tried from the app.

### Changed (batch log calendar)
- Batch page › Log calendar is now a month calendar (Monday first) instead of a strip of small squares. Each day shows its date and day of culture, three small bars for AM feeding, PM feeding and water quality (in, not fed or missing), dots for mortality, growth samples and chemicals, and a green, amber or red background for all, some or none of the three daily records. Today is outlined. Above the months: counts of fully, partly and not logged days and a bar of the share. Clicking a day still opens its log; the tooltip and screen-reader label give the date, day of culture and what is missing.

### Added (SFSC warnings, DEC-79)
- A fry delivery without a Shrimp Fry Source Certificate (SFSC) number is now flagged, never blocked: a warning when it is stocked, a warning on a sale of shrimp from its batches (confiscation risk under BFAR FAO 225-1), an item in Close Batch, and "Not recorded: required by BFAR FAO 225-1" on the trace report. `CloseCheckDto.SfscMissing`, `TraceFrySourceDto.SfscMissing`; test in `SimpleSampleData_Tests`. In the sample, the September delivery has no SFSC yet. Screens, the dispatch receipt and the delivery CSV now use the full name, "Shrimp Fry Source Certificate no.", instead of "SFSC".

### Changed (one sample database on this branch)
- Only the `rkabubba-aqua` sample farm (`FPMS_Simple`) is kept; the larger `gensan-semi` sample (`FPMS_Sample`, `SampleDataBuilder`, `SampleData_Tests`) and the `Seed:SampleData` setting are removed. `SEED_SAMPLE_DATA=1` (or `simple`) now starts `FPMS_Simple`.
- The sample's hatcheries are the three BFAR-accredited P. vannamei hatcheries of Region XII, from the BFAR list as of 30 Nov 2025, with their accreditation numbers and expiry dates: Gensan Shrimp Hatchery (Charoen Pokphand Foods Philippines Corporation, Maasim) and Sto. Niño Aquaculture Corporation (Malapatan), both valid to 17 Oct 2028, and RDEX Food International Philippines, Inc. (Bawing, General Santos), valid to 15 Aug 2027. The February cycle uses CP fry (₱0.36 per piece), the September cycle Sto. Niño fry (₱0.33), as quoted in the farm interviews; both come by truck. The farm also has its permits on file, all current: BFAR registration and GAqP farm certification, Mayor's permit, barangay clearance, ECC and BIR registration.

### Added (simple sample database)
- `SEED_SAMPLE_DATA=simple` seeds a separate `FPMS_Simple` database with the small `rkabubba-aqua` farm: two Owners (Abi Rkabubba, Sam Amsedel), one Technician (Kim Onacsus), three intensive ponds (one earthen, one concrete, one HDPE-lined) one closed 75-day cycle (stocked 2 Feb 2026, harvested 18 Apr 2026) and one running cycle stocked 14 Sep 2026, logged to the day before seeding, harvest planned 28 Nov 2026. See `docs/dev-accounts.md`. New setting `Seed:SimpleSampleData`; test `SimpleSampleData_Tests`.

### Changed (farm address dropdowns)
- Register and Farm profile: Province and City / Municipality are dropdowns limited to the coverage area, General Santos City (listed under South Cotabato) and the seven municipalities of Sarangani. Choosing a province narrows the city list (General Santos is picked automatically) and an empty postal code is filled from the city. An older value outside the list still shows and can be kept. The street, purok and barangay stay typed. The list is in `angular/src/shared/fpms/coverage-area.ts`; the server does not enforce it.

### Changed (sample database for the table and list pages; seed checked by tests)
- The `gensan-semi` sample farm (`FPMS_Sample`, `SEED_SAMPLE_DATA=1`) is rebuilt to fit this branch: 28 ponds named by construction type (EP, CP, HP) with every pond status, two archived ponds, preparation rounds that were edited, reopened and abandoned, seven cycles with the app's own cycle codes, 43 batches, and enough harvests, sales and lots to page. It adds a farm code change (`tambler-shrimp` to `gensan-semi`), three hatcheries, five buyers and a set of permits with current, expiring, expired and renewed records. See `docs/dev-accounts.md`.
- Dates are counted back from the seed date, so the running batches end yesterday. Drop `FPMS_Sample` to get the new data in an existing Codespace.
- New tests in `SampleData_Tests` seed the sample farm and check the pond statuses, the list sizes, the code formats and that seeding twice adds nothing.

### Added (pond rules, preparation actions and the pond page; not built or run yet)
- Pond fields lock once a pond has been in production. While a batch is open, the area, the depths and the farming system cannot change. Once any batch exists, the purpose cannot change. The construction type is fixed from the moment the pond is created, because the pond's name and code depend on it (a wrong entry means adding a new pond). After the batches have closed, area and depth can still be corrected, but a change note is required and goes in the pond history; earlier batches keep the area they were stocked with. The pond detail now reports `LockedFields` (field and reason) and `SizeChangeNeedsNote`, and the page shows a lock and the reason beside each locked field.
- Ponds can be archived and restored (Ponds manage permission). An archived pond keeps its batches, history, number and code, but leaves the pond list, the dashboard and every choice list, and cannot be edited, prepared or stocked until restored. Only a pond with no open batch and no preparation round in progress can be archived. The ponds page has a "Show archived ponds" checkbox. New endpoints `Pond.Archive` and `Pond.Restore`; `Pond.GetAll` takes `includeArchived`. The data model gains `Pond.IsArchived`: reset the database as the README describes.
- Harvests list: fixed the table header, which had two extra columns ("Total kg" and "Boxes" twice) and put the wrong title over ABW, size grades and the sold, not sold and unaccounted figures. The cycle now sits under the pond and batch, size grades show as small chips, zero and missing values show as a dash, unaccounted weight is marked with a warning icon, and a footer row totals the rows shown.
- Farm profile: the Ponds tab opens with summary tiles (ponds, total pond area, ponds in production, share of the farm area with a bar), depth is split into average and maximum columns, and a footer row totals the pond area. Users who cannot edit the profile now see a read-only summary instead of disabled form fields.
- Tables: shared styles for totals rows, dash placeholders and chips.
- List filters: a filter with more than 5 options (including All) is now a dropdown showing each option with its count and a "Clear filter" link, instead of a row of chips that grows with every status and number. Filters with up to 5 options stay as chips. This is the shared list toolbar, so it applies to every list page. Counts show thousands separators.
- Ponds page: archived ponds show in All ponds after the active ones, dimmed with an Archived badge, and Archived is a filter option with its own count (no separate checkbox). Pond cards show 24 at a time with a "Show more" button.
- Sortable column headers: the sort arrows are drawn with CSS shapes instead of an icon font glyph, which showed as an empty box with an x when the glyph did not load. The current direction is drawn solid and the other faint.
- Permits and licenses: the Add, Edit, Renew and View windows now use the same dialog as the rest of the app (the old Bootstrap-modal markup clashed with the shared dialog styles and left the window mis-sized and unscrollable). Escape closes the open window, focus moves to the first field and returns to the button afterwards, and clicking outside the form no longer discards it; Cancel, X and Escape ask first when something was typed. Add no longer pre-selects a category and title (you choose them, and the title list waits for a category). Renew carries over the reference number with a hint and suggests the next expiry date from the previous permit's validity. The document title in the table opens the record.
- Farm profile: the farm code is now shown under Farm details (read-only, with a note that it is the sign-in code and appears on exports). It stays fixed on purpose; changing it would break every user's sign-in and the codes on old exports.
- Farm code (DEC-78): the Farm Owner can change it from Farm profile › Change code, with a warning, a live check that the code is free, and the new code typed twice. It can change once in 30 days. The old code stays reserved for every farm, and on the sign-in page it shows the new code and fills it in. People signed in stay signed in. New table `FpmsFarmCodeChanges`, endpoints `FarmProfile.ChangeFarmCode` and `FarmProfile.GetFarmCodeAvailability`, and tests in `FarmCode_Tests` (not built or run yet).
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
