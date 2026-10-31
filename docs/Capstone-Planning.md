# **Capstone: Farm Production Management System (FPMS)**

*Planning specification v2.6 · 26 October 2026*

A capstone build specification for an on-premise web application supporting whiteleg shrimp (*Penaeus vannamei*) production at a partner farm in the Sarangani Province and General Santos City study context.

This document replaces all earlier planning versions (fpms.md v1.2–v1.5 and the repo decision log D-01 to D-39). It keeps every decision that is still in force, incorporates the defense panel's revisions, and renumbers decisions from DEC-01. Appendix C maps old IDs to new ones.

Version 2.6 finalizes the production business logic after a review with the team (26 Oct 2026): stocking window and Finish stocking, Owner reopening and cycle outcome, density bands per construction type, Owner-editable Farm Standards, treatment withdrawal records, harvest and sales options, and inventory pack sizes (DEC-63 to DEC-68). It also settles the v2.5 proposals DEC-56 to DEC-62. Values marked † are defaults awaiting the adviser or the partner farm.

# **Contents**

1\. Product Requirements Document

2\. Technical Requirements Document

3\. App Flow

4\. UI and UX Design Brief

5\. Backend Schema

6\. Reliability, Scalability, and Maintainability

7\. Implementation Plan

Appendix A. Decision log

Appendix B. Manuscript alignment notes

Appendix C. Mapping from earlier decision IDs

Appendix D. Terminology and use-case alignment

# **1\. Product Requirements Document**

## **Product and problem**

Product name: Farm Production Management System (FPMS). Project and code name: Capstone (solution, projects, and namespaces `Capstone.*`).

One-sentence idea: An on-premise web application that helps a *P. vannamei* farm prepare ponds, stock fry from a hatchery delivery into pond batches, record daily logbooks to harvest, sell the harvest, and review performance, with permits, hatcheries, feed stock, and buyers kept in one farm account.

Problem: production records are scattered across paper logbooks, spreadsheets, and notes, which makes cycle history, performance indicators, and permit expiry hard to track. The frequency and impact of this should be confirmed with study participants rather than treated as measured evidence.

Deployment: Phase 1 runs on one server PC on the partner farm's local network; no Internet is needed. The data model is multi-tenant (FarmId on every record) so a cloud SaaS version is possible in Phase 2 without a rewrite.

Manuscript objectives covered:
- Objective 1 (role-based platform for farm resources, compliance documentation, and operational records): accounts and roles, farm profile, permits and licenses, ponds, hatcheries, feed and additives stock, dashboard, reports.
- Objective 2 (end-to-end production cycle workflows with a transaction mechanism): pond preparation, production cycles and batches, daily logbooks, harvest and sales; the transaction mechanism is the inventory movement ledger (DEC-15).
- Objective 3 (structured functional testing): acceptance criteria below and test checkpoints in Section 7.

## **Core definitions**

| Term | Definition in Capstone |
| :---- | :---- |
| Production Cycle | The complete operational period for rearing shrimp that originate from **one specific fry source batch** (one hatchery delivery). It runs from fry source selection and stocking, through daily grow-out management and water-quality monitoring, to the final harvest and sales. It is the parent of its batches and controls the overall timeline and source information. Status: Active, then Closed when the Owner closes it, with an outcome of Completed or Failed; the Owner can reopen it with a reason (DEC-64). |
| Fry delivery (fry source batch) | One delivery of post-larvae from a hatchery: hatchery, hatchery batch number, PL age, total PL received, delivery date, and status history. Exactly one delivery starts one production cycle. A delivery stays open for stocking until the Owner selects Finish stocking, which records any PL not stocked with a reason (DEC-63). |
| Batch (Shrimp Batch) | A discrete sub-unit of the cycle's stock allocated to one culture unit (pond). It is the unit of traceability for stocking: pond, stocking count, transport mode, time processed, and stocking density. Batches of the same cycle share the same genetic source, so their pond performance can be compared. Several batches can be created on the same day. A batch is Stocked, then Harvested or Failed, then Closed by the Owner after review; the Owner can reopen a Closed batch with a reason (DEC-64). Each pond is stocked once per batch: no top-ups and no nursery transfers. |
| Pond preparation round | The preparation work done on a pond before it can receive fry, recorded as dated free-text entries describing the process. A pond must be marked **Prepared** before a batch can be stocked into it. |

## **Users and roles**

| Role | Level | Purpose |
| :---- | :---- | :---- |
| Farm Owner | Farm | Full access within the farm: farm profile and settings, staff accounts, permits, ponds, hatcheries and fry deliveries, feed stock, production cycles, sales, reports. A farm may have several Owners. |
| Farm Technician | Farm | Records operations: pond preparation, fry delivery status updates, stocking through the stepper, daily logs, harvests. Reads ponds, hatcheries, and stock. Cannot manage staff, master data, sales, or reports. |
| System Administrator | System (host) | Technical support account held by the development team: installation, farm activation, registration switch, reference data, security and error logs, account recovery. Never sees farm production, stock, sales, or permit records. |

## **Feature scope**

P1 must ship. P2 is built only after every P1 acceptance test passes. "Ref" is the manuscript Table 6 number; "R-xx" is the defense revision item.

| Ref | Feature | Priority | Scope |
| :---- | :---- | :---- | :---- |
| 1.1 | Farm Account Registration | P1 | Farm name, structured address, contact, initial Owner credentials, unique farm code. Registration can be switched on or off by the System Administrator. |
| 1.2 | User Authentication | P1 | Sign-in with farm code, username or email, and password; JWT; forced password change for new or reset accounts; lockout. |
| 1.3 | Staff Account Management | P1 | Owners create, update, deactivate, and reset Owner and Technician accounts. |
| 2.1 | Farm Profile and Settings | P1 | Structured address, contact, optional total farm area (ha), farm farming system (inherited by ponds), permit alert window, read-only Ponds summary tab, Farm Standards (water ranges, density bands, warning thresholds, stocking window; DEC-58). |
| 2.2 | Permits and Licenses | P1 | Reference records (no files): category, preset or custom title, reference number, issuing agency, issue date, expiry date or perpetual, notes/location of the hard copy. Search, soonest-expiring first, colored status, renew, archive (no delete), in-app expiry reminders; missing required permits are shown on the dashboard only (never a block). File attachments deferred (R-11). |
| 3.1 | Hatchery Profiles | P1 | Name, short code, address, contact, BFAR accreditation status, health certificate number and expiry, change history. |
| 3.1a | Fry Deliveries (Log Fries) | P1 | Hatchery batch number, delivery date, PL age, total PL received, PL health certificate number, optional transport permit number and cost, status (Ordered, In transit, Received, Rejected) with dated status history; shown as Stocked once a cycle uses it, and closed by Finish stocking, which records PL not stocked with a reason (R-07 to R-09, DEC-59, DEC-63). |
| 3.2 / 3.3 | Feed and Additives | P1 | Items (feed, additive/supplement, chemical; optional pack size, active ingredient and default withdrawal days), lots, receipts entered in packs or base units with optional unit cost, usage from logs (earliest-expiring lot pre-selected; DEC-68), adjustments, quantity on hand, low/negative stock flags, change history. |
| 4.1 | Pond Setup | P1 | Ponds must exist before anything else (R-02). Name from a farm prefix dropdown plus number; code generated; type, construction (Earthen, Concrete, HDPE-lined; DEC-65), area, depths, inlet/outlet, aeration, GPS; farming system inherited from the farm with optional override. |
| 4.2 | Pond Status | P1 | Available → Under preparation (first preparation entry) → Prepared (Mark Prepared) → In production (batch stocked) → Post-harvest (batch Harvested or Failed) → Available (batch Closed). A new preparation round can start from Post-harvest or Available. Manual Under maintenance and Inactive only while no batch is open. |
| 4.3 | Log Pond Preparations | P1 | Preparation rounds on the pond; each entry is a date/time and a free-text description of the process (structured fields to be defined after consulting the technician); "Mark Prepared" (R-22, R-25). |
| 5.1 / 5.2 / 5.3 | Create Batch (Stocking) | P1 | One continuous stepper: fry delivery → Prepared ponds with PL allocation → per-batch stocking details and Log Pre-Stocking Water Quality → review → Create. The first creation from a delivery initializes the production cycle (Active); later creations add batches to it while the delivery is open and within its stocking window; Finish stocking closes the delivery (DEC-63). Density is shown live per pond against the band for its farming system and construction type (warning only). Everything is saved in one transaction (R-23, R-24, R-28, R-29). |
| 5.5 | Close Batch | P1 | Owner closes a Harvested or Failed batch: its logs, feeding sessions, and harvests become read-only, so its final FCR, survival, and ABW are fixed. The Owner can reopen a Closed batch with a reason (DEC-64). |
| 5.6 | Close Production Cycle | P1 | When every batch is Closed, the Owner closes the cycle and confirms its outcome (Completed or Failed, pre-selected as Failed when every batch failed); everything becomes read-only. The Owner can reopen it with a reason (DEC-64). |
| 6.1 | Feeding Log | P1 | Daily per batch: AM and PM sessions, each with kg and feed lot or marked Not fed (R-31). One farm-wide daily sheet lists every open batch, grouped by pond (DEC-50, DEC-54). |
| 6.2 | Water Quality Log | P1 | DO, temperature, pH, salinity, TAN, nitrite, alkalinity, nitrate; flags against the farm's effective ranges (PNS/BAFS 197:2025 defaults, Owner overrides in Farm Standards) with recommendations (R-32, DEC-56, DEC-58). Extra parameters depend on the partner farm's test kits (open). |
| 6.3 | Growth Sampling | P1 | Sample count, total weight, computed ABW and growth rate. |
| 6.4 | Log Chemical and Supplement Application | P1 | Product lot, quantity, reason, dosage, method, end date, withdrawal days (pre-filled from the item); computed earliest safe harvest date; deducts stock (DEC-57; the banned-substance list was dropped 2026-10-26). Replaces "Log Intervention" (R-33). |
| 6.5 | Mortality Log | P1 | Count, cause (Disease with optional disease name, Water quality, Others with description), symptoms (R-34). |
| 7.1 | Log Harvest | P1 | Opened from the batch (R-35): date, Partial or Total harvest, total kg, boxes, ABW, size grading lines, optional final piece count (R-36), optional quality checks, "Remaining in pond" (R-38). No sample count (R-37). Optional not-sold entries (kg and reason) account for harvest kept, given away, or lost; a harvest before a treatment's safe harvest date warns (DEC-57, DEC-67). |
| 7.2 | Register Buyers | P1 | Individual or Company, name, contact person, phone, address (R-39). |
| 7.3 | Log Harvest Sales and Generate Dispatch Receipt | P1 | Buyer, harvest, grade lines (kg, price/kg, optional buyer's accepted kg), total, payment terms, optional due date (Overdue when past due and unpaid), an "Ungraded / mixed" grade for ungraded shrimp (DEC-67), each payment recorded (payment status computed); a sale can include grades from several harvests; printable dispatch receipt (internal, not a BIR official receipt); Sales History page (R-41). |
| 7.4 | Declare Batch Failure | P1 | Sets the batch status to Failed with reason, date, estimated loss; printable failure report. A failed batch may still record a salvage harvest. |
| 8.1 / 8.2 | Generate Production Report | P1 | Reports: Production Cycle Performance; Batch Harvest and Survival; Sales by Buyer and Period; Water Quality Exceptions; Feed and Additives Usage; Batch Failure Report. Each has a card summary plus table, sortable columns, date-range and total filters, hatchery short codes; cost results are labeled "margin over feed, chemicals and PL" (R-42 to R-46, DEC-15). A read-only Trace sheet per batch from the Batch detail page: fry source, feed and chemical lots, harvests, sales and transport (DEC-72). |
| 9.1 | Audit Trail and History | P1 | ABP audit log; Owner activity log; History panels on hatchery, delivery, feed item, and lot (R-18); security log for the System Administrator. |
| 9.2 | Dashboard | P1 | Pond status grid, active cycles and batches with DOC, ABW, FCR to date, estimated survival; permit and operational notifications; passive summaries (out-of-range readings and high-mortality days this week, low and negative stock, lots expiring soon); daily log status with blank days; Harvested and Failed batches awaiting Close Batch; deliveries awaiting Finish stocking; overdue sales; setup checklist (ponds first). Batch pages show health test hints by DOC, display only (DEC-62). |
| 8.1 | Trend and growth charts | P2 | |
| Table 5 | Biosecurity tab | P2 | Disinfection records first; visitor logs only if needed (R-20). |
| 2.2 | Permit file attachments | P2 | Several files per permit record (R-11); requires reintroducing file storage. |
| 7.3 | Automatic "Base 10" pricing | P2 | |
| — | Printable log sheets | P2 | Paper forms mirroring each log for a paper-then-enter fallback. |

## **Release phases**

| Phase | Scope |
| :---- | :---- |
| Phase 1 (capstone) | All P1 features, deployed at the partner farm; P2 if time allows. |
| Phase 2 (after capstone) | Cloud SaaS with subdomain farm resolution; offline capture and sync; email/SMS reminders; .NET 10 LTS retarget; remaining P2. |
| Not planned | Per-batch production protocols and scheduled task lists (DEC-31), nursery-to-grow-out transfers and top-up stocking (DEC-60, DEC-63), IoT sensors, automated feeding or pond control, other species, external roles (BFAR, auditors), multi-farm owner dashboard, payment processing, official BIR receipts, financial bookkeeping ledger (DEC-15), Shrimp.io integration, predictive analytics. |

## **User stories**

| ID | Story |
| :---- | :---- |
| US-01 | As a prospective Owner, I want to register my farm so that I get a farm workspace. |
| US-02 | As an Owner, I want to set up ponds first and manage staff accounts so that the farm is ready for production. |
| US-03 | As an Owner, I want to record permits and licenses with reference numbers and expiry dates and be reminded before they expire. |
| US-04 | As an Owner, I want hatchery profiles and fry deliveries with status history so that every fry source is traceable. |
| US-05 | As an Owner, I want to keep feed and additives stock so that usage is tracked by lot. |
| US-06 | As an Owner or Technician, I want to record pond preparation and mark a pond Prepared so that only prepared ponds receive fry. |
| US-07 | As an Owner or Technician, I want one guided flow that takes a fry delivery, splits it into batches across prepared ponds, and starts the cycle after a review, then lets me finish the delivery by recording any PL not stocked. |
| US-08 | As a Technician, I want to choose the cycle and pond, then log feeding (AM/PM), water quality, growth sampling, chemicals and supplements, and mortality, and see recommendations when readings are out of range. |
| US-09 | As an Owner or Technician, I want to record harvests from the batch and see what remains in the pond. |
| US-10 | As an Owner, I want to sell harvests to buyers per size grade, track payment, and see sales history. |
| US-11 | As an Owner, I want to declare batch failures, close batches, and close the production cycle so that final indicators are computed and records are locked, and reopen a closed batch or cycle with a reason when an error is found. |
| US-12 | As an Owner, I want specific reports with summaries, sorting, and filters. |
| US-13 | As the System Administrator, I want to recover a locked-out Owner without seeing farm data. |
| US-14 | As an Owner, I want to adjust the farm's standards (water ranges, density bands, warning thresholds, stocking window) while seeing the national default, so that warnings fit my farm. |

## **Acceptance criteria**

| ID | Given / When / Then |
| :---- | :---- |
| AC-01 | Given registration is on, when valid owner and farm details are submitted, then the farm, profile, roles, default categories and presets, and Owner are created in one transaction; on failure nothing is created. |
| AC-02 | Given an Owner, when they create an Owner or Technician account, then it belongs only to that farm, has that role, and must change its temporary password at first sign-in. |
| AC-03 | Given a farm with no ponds, when a user opens hatcheries, stock, or production, then they are directed to set up ponds first. |
| AC-04 | Given pond details, when a pond is saved, then its name follows the prefix-and-number pattern, its code is generated, its farming system is inherited unless overridden, and an unusual farming system for its construction shows a warning but saves. |
| AC-05 | Given a permit record, when saved, then reference-number and date rules apply; the list sorts soonest-expiring first with colored status; archived records stop reminding; nothing can be deleted. |
| AC-06 | Given a hatchery, when a fry delivery is recorded and its status changes, then each change is kept with its date and the user who made it (Owner or Technician) and shown in the delivery's history. |
| AC-07 | Given a pond, when the first preparation entry (date/time and description text) is saved, then the pond becomes Under preparation; when marked Prepared (at least one entry required), it becomes Prepared. |
| AC-08 | Given the Create Batch (Stocking) stepper, then only Received deliveries that are open (not finished) are offered, newest first, with deliveries past their stocking window behind "Show older deliveries"; only Prepared grow-out ponds without an open batch are offered; the review step names the delivery and its received date. |
| AC-09 | Given a delivery and allocations to one or more Prepared ponds, when the review is confirmed, then one Active cycle and one Stocked batch per pond are created in one transaction with transport mode, time processed, stocking count, density, and pre-stocking water quality; the sum of allocations cannot exceed the PL received; no permit check is part of batch creation; each stocking date falls between the delivery's received date and the end of its stocking window, checked against the delivery and never against today (DEC-63); a density outside the band for the pond's farming system and construction type warns and is stored as the batch's flag. |
| AC-10 | Given an Active cycle whose delivery is open with PL left, when Create Batch is used again within the stocking window, then another batch can be stocked, including on the same day as earlier batches. After Finish stocking, the delivery's PL received equals the PL stocked plus the PL recorded as not stocked (each with a reason), and no further batch can be added (DEC-63). |
| AC-11 | Given a Stocked batch, when a log is saved, then it is linked to the batch (and through it to the cycle and pond) with its time and recorder; retries do not duplicate; AM/PM feeding and chemical/supplement application deduct stock and warn on shortfall without blocking. |
| AC-12 | Given a water-quality reading outside its GAqP range, when saved, then it is stored, flagged, and shown with its recommendation text. |
| AC-13 | Given a Stocked batch, when a harvest is saved from the batch page, then it is linked without a batch selector, the optional final count is stored, and "Remaining in pond" is updated. After a Total harvest the batch becomes Harvested and the pond becomes Post-harvest. |
| AC-14 | Given harvest grade lines and a buyer, when a sale is saved, then the total is computed, sold kg per grade cannot exceed that grade's unsold kg, payments are recorded individually, and the sale appears in Sales History with a printable dispatch receipt. |
| AC-15 | Given a Stocked batch, when Declare Batch Failure is saved with reason, date, and estimated loss, then the batch status becomes Failed and the pond becomes Post-harvest. |
| AC-16 | Given a Harvested or Failed batch, when the Owner closes it, then its logs, feeding sessions, and harvests become read-only and its final FCR, survival, and ABW are shown; a Stocked batch cannot be closed. The Owner can reopen a Closed batch with a required reason; it returns to Harvested or Failed, the reopening is shown in its history, and re-closing recomputes the final indicators (DEC-64). |
| AC-17 | Given every batch of a cycle is Closed, when the Owner closes the production cycle, then the Owner confirms its outcome (Completed or Failed, pre-selected as Failed when every batch failed), the cycle becomes Closed, and all its records are read-only; sales and payment status can still be updated. A Closed cycle can be reopened by the Owner with a reason and must be reopened before any of its batches (DEC-64). |
| AC-18 | Given report filters, when a report is opened, then only this farm's matching records appear with a card summary, sortable columns, and Asia/Manila day boundaries; indicators match Section 5 formulas. |
| AC-19 | Given another farm's record ID, when any request uses it, then access is denied without disclosing data. |
| AC-20 | Given input that breaks a Reject rule in "Data validation and integrity", when submitted, then nothing is saved and field-level feedback is shown; given input that meets a Warn rule, it is saved and the warning is shown. |
| AC-21 | Given the System Administrator, when they unlock or reset an Owner, then the Owner must change the password and the action is logged; all farm data endpoints deny access. |
| AC-22 | Given a feeding session or chemical application is edited or voided, then stock on hand reflects the change through reversing movements, and no stock movement is ever edited or deleted. |
| AC-23 | Given two users stock batches from the same delivery at the same time, then the combined allocation never exceeds PL received; given two users edit the same batch, the second save is rejected with a reload message. |
| AC-24 | Given the server PC fails, when the restore procedure is run on the standby machine with the latest full and log backups, then the system is back within 2 hours and no more than the last 30 minutes of entries are missing. |
| AC-25 | Given a user reopens an unsaved log form, their draft is restored for them only; given another user signs in on the same tablet, they do not see it. |
| AC-26 | Given a backup job fails, disk space falls below 15%, or a certificate is within 30 days of expiry, then the health page shows it and the System Administrator and Owners see an alert. |
| AC-27 | Given any list, then results are paged on the server (25 by default, 100 at most); given any list or report, an Owner can export it as CSV and the export is audit-logged. |
| AC-28 | Given an entry outside a threshold (water quality, mortality, feeding, expired lot, density, stock), when saved, then the warning is shown inline to the person entering it and counted in the dashboard summary and reports; no notification is sent. Notifications are sent only for permit expiry and operational alerts (DEC-49). |
| AC-29 | Given a feeding session marked Not fed, then it has no stock movement and its slot counts as logged; given a slot with no session, the daily log status shows it as blank (neutral, not overdue); given blank feeding or water days, Close Batch lists them before the confirmation (DEC-50). |
| AC-30 | Given a batch with a Total harvest, when a log or feeding session is dated after the Total harvest date, then it is rejected; salvage records of a Failed batch are exempt. A log or feeding session dated before the batch's stocking date is rejected. Entries for any earlier date within the batch's life are accepted while the batch is not Closed, and histories show each entry's recorded time beside its date (DEC-50, DEC-51, DEC-66). |
| AC-31 | Given a batch is stocked, then it stores the pond's farming system, construction type and density flag as judged at that time; later pond or farm changes do not change them; the flag is Within, Below, or Above (DEC-52, DEC-65). |
| AC-32 | Given a growth sample with an estimated survival %, then remaining population and biomass use the latest such estimate; otherwise they use logged mortality; the batch shows which basis is used (DEC-53). |
| AC-33 | Given a sale, then its optional transport fields are saved and printed on the dispatch receipt, with the farm's BFAR registration number when a current BFAR registration permit exists (DEC-55). |
| AC-34 | Given Farm Standards, when an Owner changes a water range, density band, warning threshold, or the stocking window, then new entries are judged against the farm value; the standard default and its source stay visible with a "differs from standard" badge; "Reset to standard" restores it; earlier flags are unchanged (DEC-58). |
| AC-35 | Given a chemical application with withdrawal days, then its earliest safe harvest date is computed; a harvest before that date saves with a warning (DEC-57). |
| AC-36 | Given a fry delivery, then its PL health certificate number and optional transport permit number are saved; given a batch, its optional dead-at-stocking count is saved and shown separately from survival (DEC-59, DEC-68). |
| AC-37 | Given a sale line with a buyer's accepted kg, then the amount due and revenue use it and the receipt shows the difference from farm kg; given a due date passes while a sale is unpaid or partly paid, it shows Overdue; given not-sold entries on a harvest, its unsold balance is reduced and Close Batch lists kg neither sold nor accounted for; an "Ungraded / mixed" grade line can be sold (DEC-67). |
| AC-38 | Given an item with a pack size, when a receipt is entered in packs, then it is stored in the base unit; given a usage form, the earliest-expiring lot with stock is pre-selected (DEC-68). |
| AC-39 | Given a fry delivery with an SFSC number, then it is saved with the delivery, shown on the Batch detail page, the trace report and the delivery export, and printed on the dispatch receipt of a sale from that batch; a delivery without one saves normally (DEC-70). |
| AC-40 | Given a feeding session with a time fed ("HH:mm"), then it is saved, shown in the session history and the feeding export, and corrected with the session; a blank time still counts as logged; a malformed time is rejected; a Not fed session stores none (DEC-71). |
| AC-41 | Given a batch with a delivery, feeding, a chemical application, a harvest and a sale, when an Owner opens its trace report, then it shows the fry source and certificates, the feed and chemical lots, the harvests and grades, every sale with its buyer and transport details, not-sold entries and the kg not accounted for; missing optional fields read "Not recorded"; voided entries are not listed (DEC-72). |

# **2\. Technical Requirements Document**

| Area | Requirement |
| :---- | :---- |
| Template | ASP.NET Boilerplate v10.2.0 Angular + ASP.NET Core startup template, generated with project name **Capstone** (classic ABP; not ASP.NET Zero or abp.io). Projects: Capstone.Core, .Application, .EntityFrameworkCore, .Web.Core, .Web.Host, .Migrator, .Tests. |
| Backend | ASP.NET Core Web API on .NET 9 (`net9.0`), EF Core 9 with SQL Server, JWT bearer (template TokenAuth). |
| Frontend | Angular 19.2.1 with abp-ng2-module; Node 22 LTS; package manager as shipped with the template (Yarn 1.22 lockfile). Record exact versions in README. The template runs with **zoneless change detection**: page state uses signals (or marks the view for check after every API response), and detail pages reload when their route id changes, because Angular reuses the component. |
| Database | SQL Server. Development: Docker via OrbStack with a pinned image tag. Production: SQL Server Express. |
| Multi-tenancy | One ABP tenant per farm; every farm-owned entity implements `IMustHaveTenant` (TenantId = FarmId); ABP's data filter scopes every query. The System Administrator is a host user. |
| Hosting | Farm-office PC (8–16 GB RAM, SSD, Windows 11 Pro or Ubuntu LTS) on a UPS; Kestrel; LAN only, fixed IP, no port forwarding; HTTPS with a local certificate authority installed on farm devices. API and built client on separate origins, client listed in `App:CorsOrigins` (DEC-07). |
| Time | Store UTC; display, day boundaries, and DOC in the farm time zone (default Asia/Manila). Stocking day is DOC 0. The server clock is the only clock used for rules; it is kept in sync automatically (DEC-39). |
| Files | None in Phase 1. Permits are reference records (DEC-18). |
| Notifications | The existing farm notification tables (FarmNotification, FarmNotificationRead: per-user read state, owners-only targeting, once-per-record), in-app only. Types: permit expiry; operational alerts (backup failed or overdue, low disk, certificate expiring) to the System Administrator and as a banner to Owners. Entry-triggered checks (water quality out of range, high mortality, feeding spikes, expired lot used, density, stock below zero) are shown inline to the person entering them and in dashboard summaries and reports, not as notifications (DEC-49). |
| Printing | Browser print layouts for reports, dispatch receipts, and failure reports (log sheets are P2). |
| Backups | Full recovery model: full backup daily, transaction-log backup every 30 minutes, copied to an external drive; weekly encrypted off-site copy. Data loss at most 30 minutes; service restored within 2 hours (Section 6, DEC-36). |
| Support risk | ASP.NET Boilerplate support ended May 2026 and .NET 9 support ends 10 Nov 2026: accepted for the capstone; LAN-only; retarget in Phase 2 (DEC-05). |

## **Naming and formatting conventions**

Decided before Milestone 1 and enforced by tooling, so the code, the database, the screens, and the manuscript use the same words. Terms come from the Core definitions and Appendix D (e.g., "Batch", "Fry Delivery", "Log Pond Preparations").

### **Code**

| Area | Convention | Example |
| :---- | :---- | :---- |
| C# (backend) | Microsoft .NET conventions: PascalCase for types, methods, properties; camelCase for locals and parameters; `_camelCase` for private fields; `I` prefix for interfaces; `Async` suffix on async methods. One public type per file; file name = type name. | `ShrimpBatch`, `IShrimpBatchAppService`, `CloseBatchAsync`, `_batchRepository` |
| Namespaces and folders | `Capstone.<Area>` by subject area, same folders in Core and Application. | `Capstone.Production`, `Capstone.Hatcheries`, `Capstone.Permits` |
| Application services and DTOs (ABP) | `{Entity}AppService`; inputs `{Action}{Entity}Input`; outputs `{Entity}Dto`, `{Entity}ListDto`; paging via `PagedResultRequestDto`. | `HarvestAppService`, `CreateHarvestInput`, `HarvestDto` |
| API routes | ABP dynamic API as generated: `/api/services/app/{Service}/{Method}`; method names are verbs (`Create`, `Update`, `Get`, `GetAll`, `Void`, `Close`). No hand-written route styles. | `/api/services/app/ShrimpBatch/Close` |
| Permissions | `Farm.{Area}.{Action}` for farm users and `System.{Area}` for the System Administrator, defined in one `PermissionNames` class (the template's own `Pages.*` entries are not used by FPMS screens). | `Farm.Production.CloseBatch`, `Farm.Hatcheries.UpdateDeliveryStatus`, `System.AccountRecovery` |
| Enums | PascalCase singular type and values; stored as integers with an **explicit fixed value** for every member (`Stocked = 2`). Values are never renumbered or reused; a removed member's number is retired. | `BatchStatus.Harvested = 3`, `TransportMode.Truck = 1` |
| Angular (frontend) | Angular style guide: file names kebab-case with type suffix; classes PascalCase; members camelCase; one component per file; services end in `Service`. | `batch-detail.component.ts`, `BatchDetailComponent`, `harvestService` |
| Constants and config keys | PascalCase sections in appsettings; environment variables use `__`. | `Backup:LogIntervalMinutes`, `Backup__LogIntervalMinutes` |
| Tests | `{Method}_{Condition}_{Expected}`, grouped by acceptance criterion. | `Close_WhenBatchStocked_IsRejected` (AC-16) |
| Formatting tools | `.editorconfig` at the repository root; `dotnet format` for C#; Prettier and ESLint for Angular (the template's settings where present); all run before every merge. | — |

### **Database**

| Item | Convention | Example |
| :---- | :---- | :---- |
| Tables | Plural PascalCase, no prefix (ABP's own tables keep the `Abp` prefix). | `Ponds`, `ShrimpBatches`, `FeedingSessions` |
| Columns | PascalCase. Keys `Id`; foreign keys `{Entity}Id`; booleans `Is…`/`Has…`. | `PondId`, `IsArchived` |
| Time columns | `…At` = UTC date and time; `…Date` = farm-local calendar date; `…On` is not used. | `StockedAt`, `FeedDate`, `ExpiryDate` |
| Unit suffixes | Every measured column names its unit: `Kg`, `G`, `M`, `M2`, `Ha`, `Pct`, `Php`, `Minutes`, `Days`. | `TotalKg`, `AreaM2`, `PondAreaM2AtStocking`, `EstimatedLossPhp` |
| Constraints and indexes | EF Core default names (`PK_`, `FK_`, `IX_`); check constraints `CK_{Table}_{Rule}`. | `CK_Ponds_MaxDepthAtLeastAverage` |
| Migrations | `{yyyyMMdd}_{PascalCaseDescription}`, one purpose per migration. | `20261105_AddFryDeliveryStatusChanges` |

### **Record codes**

| Code | Format | Example |
| :---- | :---- | :---- |
| Farm code | 2–20 uppercase letters, digits, hyphens | `PILOT-FARM` |
| Hatchery short code | 2–6 uppercase letters | `SHI` |
| Pond code | Prefix initials + two-digit number | `GP-03` (Grow-out Pond 03) |
| Cycle code | Year-month of first stocking, hatchery code, two-digit sequence | `2026-11-SHI-01` |
| Batch code | Cycle code + letter | `2026-11-SHI-01-A` |
| Dispatch receipt number | `DR-` + year + six-digit sequence per farm | `DR-2026-000123` |

### **File names (exports, printouts, backups, logs)**

Rules for every generated file:
- **Characters:** ASCII only, no spaces.
- **Separators:** underscore between parts, hyphen inside a part.
- **Order:** dates are year first, so files sort chronologically.
- **Time zone:** times are farm time (Asia/Manila; the Philippines has no daylight saving).

| File | Pattern | Example |
| :---- | :---- | :---- |
| CSV export of a list | `{FarmCode}_{ListName}_{yyyyMMdd-HHmm}.csv` | `PILOT-FARM_FryDeliveries_20261022-1430.csv` |
| CSV export of a report | `{FarmCode}_{ReportName}_{FromDate}_{ToDate}_{yyyyMMdd-HHmm}.csv` (dates `yyyy-MM-dd`) | `PILOT-FARM_SalesByBuyerAndPeriod_2026-01-01_2026-10-22_20261022-1430.csv` |
| Report for one cycle or batch | `{FarmCode}_{ReportName}_{RecordCode}` + `.csv` or, when printed, `.pdf` | `PILOT-FARM_ProductionCyclePerformance_2026-11-SHI-01.pdf` |
| Dispatch receipt | `{FarmCode}_DispatchReceipt_{ReceiptNo}.pdf` | `PILOT-FARM_DispatchReceipt_DR-2026-000123.pdf` |
| Batch failure report | `{FarmCode}_BatchFailureReport_{BatchCode}.pdf` | `PILOT-FARM_BatchFailureReport_2026-11-SHI-01-B.pdf` |
| Full database backup | `{Prefix}_FULL_{yyyyMMdd-HHmmss}.bak` in `{BackupRoot}/{yyyy}/{MM}/` | `Capstone_FULL_20261022-010000.bak` |
| Transaction-log backup | `{Prefix}_LOG_{yyyyMMdd-HHmmss}.trn` in the same folder | `Capstone_LOG_20261022-143000.trn` |
| Weekly off-site archive | `{Prefix}_WEEKLY_{yyyy}-W{ww}.7z` (ISO week, AES-256) | `Capstone_WEEKLY_2026-W43.7z` |
| Integrity check result | `{Prefix}_CHECKDB_{yyyyMMdd-HHmmss}.txt` | `Capstone_CHECKDB_20261025-020000.txt` |
| Application log | `{Prefix}-{yyyyMMdd}.log`, rolling | `Capstone-20261022.log` |

Notes:
- **PDFs** are produced with the browser's Save as PDF. The page title is set to the file name, so the browser suggests the right name.
- **Backups and logs** cover the whole database, which can hold several farms, so they use the system prefix instead of a farm code.
- **Export names** use the English report and list names from Appendix D in PascalCase.

### **What can be configured**

| Setting | Default | Who changes it | Where |
| :---- | :---- | :---- | :---- |
| Date display order | Month first (Oct 22, 2026) | Owner | Farm Profile and Settings (also: Day first, 22 Oct 2026) |
| Time display | 12-hour | Owner | Farm Profile and Settings (also: 24-hour) |
| Permit alert window | 30 days | Owner | Farm Profile and Settings |
| Farm Standards: water-quality ranges, density bands, warning thresholds (PL age, feed spike, daily mortality, ABW drop, buyer weight difference) | PNS/BAFS 197:2025 and the † defaults, with source shown | Owner | Farm Profile and Settings → Farm Standards (DEC-58) |
| Stocking window after a delivery is received | 1 day (0–3) † | Owner | Farm Standards (DEC-63) |
| Backup file prefix | `Capstone` | System Administrator | `Backup:FilePrefix` in server configuration |
| Backup root folder and off-site drive path | `D:\Capstone\Backups` / removable drive | System Administrator | `Backup:RootPath`, `Backup:OffsitePath` |
| Log backup interval | 30 minutes | System Administrator | `Backup:LogIntervalMinutes` |
| Backup retention | 14 days on the drive, 8 weekly copies | System Administrator | `Backup:RetainDays`, `Backup:RetainWeeks` |
| Request audit retention | 12 months | System Administrator | `Audit:RequestRetentionMonths` |
| Log file size and count | 10 MB × 30 files | System Administrator | log4net configuration |

The **pattern itself** (order of parts, separators, date format inside file names) is fixed in code and not configurable. That keeps every file sortable and lets the restore and purge scripts find files reliably. Changing a pattern is a code change with a decision record.

### **Display formatting (screens, reports, printouts)**

| Value | Format | Example |
| :---- | :---- | :---- |
| Date | Month abbreviation, day, year (farm setting can switch to day first) | Oct 22, 2026 |
| Time | 12-hour with AM/PM, farm time (farm setting can switch to 24-hour) | 2:30 PM |
| Date and time | Date, then time | Oct 22, 2026, 2:30 PM |
| Money | Peso sign, thousands separator, 2 decimals | ₱12,450.00 |
| Whole counts | Thousands separator | 120,000 PL |
| Weights | kg with up to 2 decimals on screen (3 stored); g with 1 decimal | 152.35 kg; ABW 15.2 g |
| Area and density | m² with thousands separator; ha with 2 decimals; density 1 decimal | 2,500 m²; 1.25 ha; 48.0 PL/m² |
| Percentages | 1 decimal | Survival 82.4% |
| FCR | 2 decimals | 1.35 |
| Water quality | Parameter precision from Section 5 with unit | DO 5.8 ppm; TAN 0.025 ppm |
| Day of culture | "DOC" + number | DOC 45 |
| Empty value | En dash, never "null" or 0 | – |
| CSV export | ISO 8601 dates and times (farm time, with offset), plain numbers without separators, UTF-8 with BOM | 2026-10-22T14:30:00+08:00; 12450.00 |

### **Screen text**

- Labels and headings in sentence case; buttons start with a verb ("Create batch", "Close batch", "Mark prepared").
- The same term everywhere: "Batch" (not "lot" or "group"), "Fry delivery", "Feed and additives", "Permits and licenses", "Void" (not "delete").
- All screen text goes through ABP localization (one English source, `Capstone`), so a term changes in one place.
- Messages say what happened and what to do: "Sold kg is more than the 40.5 kg left in grade 60/70." Warnings and errors include their icon and text, not color alone.

## **Authentication and roles**

- All endpoints require a JWT except sign-in and farm registration (only while registration is on). Passwords are hashed by ASP.NET Core Identity; no plaintext, no custom hashing, no cookie-only sessions. Signing key and connection string live in user-secrets (development) or environment variables (production).
- Static farm roles: FarmOwner, FarmTechnician. Host role: SystemAdministrator. Every farm account belongs to exactly one farm; no farm switcher.
- New and reset accounts get a temporary password and must change it. No email reset. Recovery when no Owner can sign in: the System Administrator verifies identity through a second Owner or a pre-agreed security question, then issues a temporary password; the action is logged.
- Keep the template's antiforgery configuration unchanged; separate client origin avoids it (DEC-07).

## **Template hardening (ASP.NET Boilerplate defaults to change)**

The generated template ships with defaults that conflict with this spec. Each is changed in Milestones 1–2:

| Template default | Change |
| :---- | :---- |
| A seeded tenant "Default" and an `admin` user with password `123qwe` (host and tenant) | Remove the Default tenant from production seeding; the host admin becomes the System Administrator with `SystemAdmin:InitialPassword` and a forced change at first sign-in. |
| Public user self-registration page inside a tenant | Disabled (technicians are created by Owners only). Only the farm registration page remains, and only while registration is on. |
| Roles page that lets admins create roles and edit permissions | Removed from the client and its role-editing endpoints restricted; roles are static (FarmOwner, FarmTechnician, SystemAdministrator) and permissions are granted in code. |
| Template host pages (Tenants, Users, Roles) | Replaced by the System Administration area (farms, registration switch, account recovery, reference data, health page). |
| Tenant chosen through a "Change tenant" dialog on the sign-in page | Replaced by a Farm code field on the sign-in form (pre-filled with the partner farm's code in Phase 1). |
| JWT lifetime of 1 day | 4 hours (DEC-37). |
| Lenient password and lockout settings | At least 8 characters with an uppercase letter, a lowercase letter, and a digit; lockout after 5 failed attempts for 15 minutes (ABP Zero settings). |
| ABP timing setting per tenant | Not used. `Clock.Provider` is UTC and the farm time zone has one source: FarmProfile.TimeZone (Asia/Manila). |
| Swagger enabled in every environment | Development only. |
| Entity history disabled | Enabled for the listed entities (Section 6). |

## **Architecture rules**

- Business rules live in Core (entities, domain services, `IndicatorCalculator`, `PondSystemRules`) and Application (use cases). Controllers and Angular components hold none.
- The farm always comes from the token, never from client input. Host code never loads farm-owned entities.
- Generated records (stock usage from logs; delivery and pond status changes from Create Batch) are written in the same transaction as their source.
- Stock movements are never edited; corrections are reversing adjustments.
- Flag, never block: GAqP ranges, stock shortfalls, missing required permits (dashboard only), unusual pond farming system, ponds exceeding the farm area. Reject: physical limits, date rules, permit reference-number rules, over-allocation of a delivery, over-selling a harvest, edits to a closed batch or closed cycle.
- Performance: p95 < 500 ms for ordinary API calls with one farm of two years' data (10 ponds, about 30,000 logs) and 5 concurrent users. Id lists as SQL literals, indexes that start with the searched column, split queries for multi-include log reads.

# **3\. App Flow**

## **Navigation**

- Dashboard
- Farm Management
  - Ponds (setup first; preparation and status)
  - Production Cycles (Create Batch (Stocking) stepper, cycles, batches)
  - Hatchery (profiles, fry deliveries)
  - Feed and Additives (items, lots, receipts, adjustments)
  - Operations (daily logs)
  - Staff (Owner only)
  - Biosecurity (P2)
- Permits and Licenses (Owner)
- Harvest and Sales (harvest logs, sales, dispatch receipts, Sales History, buyers)
- Reports (Owner)
- Farm Profile and Settings (Owner)
- System Administration (System Administrator only)

Every page below the top level shows breadcrumbs. Long dropdowns (ponds, hatcheries, deliveries, lots, buyers, cycles) are searchable.

## **Journey 1: onboarding**

1. Owner registers the farm.
2. Dashboard shows the setup checklist; **Ponds come first**. Until a pond exists, Hatchery, Feed and Additives, and Production show "Set up your ponds first".
3. Owner sets the farm farming system and address in Farm Profile, reviews Farm Standards (which start from PNS/BAFS 197:2025), adds ponds, then hatcheries, feed and additive items with opening stock, permits, buyers, and staff accounts.

## **Journey 2: pond preparation**

1. Owner or Technician opens a pond that is Available or Post-harvest and adds a preparation entry: date/time and a free-text description of what was done (for example "Drained pond, drying started"). This opens a preparation round and sets the pond to Under preparation.
2. More entries are added as the work happens.
3. When done, the user selects **Mark Prepared** (needs at least one entry). The pond becomes Prepared and appears in the stepper.

## **Journey 3: log fries and Create Batch (Stocking)**

1. Owner records a fry delivery on the hatchery (batch number, delivery date, PL age, PL received, PL health certificate number, optional transport permit number and cost). The Owner or a Technician updates its status as it arrives (In transit, Received, Rejected), with an optional note. Each change is kept in the history with who made it.
2. Owner or Technician opens Production Cycles → **Create Batch (Stocking)**. The stepper does not end until the final assignment is made:
   1. **Fry source**: choose a Received, open delivery. The list is newest first and shows each delivery's hatchery, batch number, received date ("6 days ago"), PL age, and PL left; deliveries past their stocking window are behind "Show older deliveries".
   2. **Ponds**: choose one or more Prepared grow-out ponds; allocate a stocking count to each. Remaining PL is shown live, with each pond's density compared to the band for its farming system and construction type (warning only).
   3. **Batch details** per pond: stocking date and time (from the delivery's received date to the end of its stocking window), transport mode, time processed, acclimation minutes, initial survival estimate, optional dead at stocking, and **pre-stocking water quality** (temperature, salinity, pH, DO). Pond specs and the computed density are shown read-only.
   4. **Review**: the delivery and its received date, every batch, the total allocated, PL left, and any density warnings, with a confirmation tick.
   5. **Create**: the production cycle is initialized as Active, each batch as Stocked, ponds show In production, and the delivery shows as Stocked.
3. While the delivery is open, within its stocking window, and has PL left, **Create Batch** from the cycle reopens steps 2–5 for more ponds.
4. When stocking is done, the Owner selects **Finish stocking** on the delivery and records any PL not stocked with a reason (dead on arrival, discarded, returned, count difference). PL received then equals PL stocked plus PL not stocked, and the delivery can no longer be used. A delivery still open after its window shows on the Owner's dashboard.
5. Entries can be made late (end of day, next day, or later): every stocking date is checked against the delivery's received date, never against today, and histories show when each record was entered (DEC-63, DEC-66).

## **Journey 4: daily operations**

1. Operations → choose the **Pond** (only ponds with an open batch are listed, each with its cycle and batch code); the choice is remembered. The **Daily log status** view lists every open batch with AM, PM and water cells (logged, Not fed, or blank) and how long since the last mortality, growth sampling and chemical log (DEC-50, DEC-54).
2. Record feeding (AM ✓ kg + lot, PM ✓ kg + lot), water quality (flags and recommendations shown inline), growth sampling, chemical and supplement application, mortality, or a general note. The daily feeding sheet records AM/PM (or Not fed) for every open batch on the farm, grouped by pond; a logged cell shows its kg, lot, who logged it and when, and opens for editing only on request. Entries can be made for any earlier date within the batch's life (not before stocking, not after the Total harvest), with no cutoff, while the batch is not Closed; each history shows the entry's date and when and by whom it was recorded (DEC-50, DEC-51, DEC-66). Chemical applications record dosage and withdrawal days (DEC-57).

## **Journey 5: harvest, sales, completion**

1. From the batch page, record a harvest (no batch selector). After each partial harvest the page shows "Remaining in pond". Optional not-sold entries record harvest kept, given away, or lost. A harvest before a treatment's safe harvest date shows a warning.
2. After the Total harvest the batch becomes Harvested and the pond Post-harvest. If the crop is lost, the Owner uses **Declare Batch Failure**; a salvage harvest can still be logged.
3. Owner logs harvest sales per grade to buyers (with an optional buyer's accepted kg and due date) and prints the dispatch receipt; Sales History lists where every harvest went and marks overdue sales.
4. Owner selects **Close Batch** on each Harvested or Failed batch: its logs and harvests lock, fixing its final FCR, survival, and ABW. If an error is found later, the Owner can reopen the batch with a reason; re-closing recomputes the final indicators.
5. When every batch is Closed, the Owner selects **Close Production Cycle** and confirms the outcome (Completed or Failed; pre-selected as Failed when every batch failed). The cycle becomes Closed and all its records are read-only. Sales and payment status can still be updated. The Owner can reopen a Closed cycle with a reason (required before reopening one of its batches). The ponds can start a new preparation round at any time after their batch is harvested or failed.

## **Action states (key rules)**

| Action | Rule | Feedback |
| :---- | :---- | :---- |
| Save pond | Prefix + number unique; max depth ≥ average depth | Warning (not error) for unusual farming system or total pond area above farm area |
| Mark Prepared | At least one preparation entry in the open round | Pond moves to Prepared |
| Create Batch (Stocking) | Delivery Received and open (or the cycle's own open delivery when adding batches); stocking date within the delivery's stocking window; ponds Prepared, grow-out, no open batch; allocations > 0 and ≤ PL left | Live density warning per pond; review step names the delivery before saving |
| Save log | Batch Stocked (or Harvested/Failed for corrections before Close Batch); physical limits; date not before stocking and not after the Total harvest date | Out-of-range flag + recommendation; stock shortfall warning |
| Save harvest | Batch Stocked, or Failed (salvage harvest); total kg > 0; grading kg ≤ total | Remaining in pond updated |
| Save sale | Sold kg per grade line ≤ that grade's unsold kg | Printable dispatch receipt |
| Close Batch | Batch Harvested or Failed | Confirmation lists blank feeding and water days, explains the batch's logs will lock; final indicators shown |
| Close Production Cycle | All batches Closed | Outcome confirmed (Completed or Failed); confirmation explains all records will lock |
| Finish stocking | Delivery used by an Active cycle and not finished; PL not stocked recorded with a reason; stocked + not stocked = PL received | Delivery closed; no further batches |
| Reopen batch or cycle | Owner; reason required; a Closed cycle is reopened before its batches | Shown in history and the activity log; re-closing recomputes indicators |
| Permit | Reference number required and unique among current records in the category; expiry required unless perpetual is allowed; expiry ≥ issue; issue not in the future | Archive instead of delete; Renew archives the old record |

# **4\. UI and UX Design Brief**

- Tokens: primary #244A63, accent #168C8C, background #F6F8F7, text #232D36 / #596872; success #287A4B, warning #A66A00, error #B33A3A, info #2B6F9B. Status always uses text or icon plus color.
- Body 16 px, tables 14 px minimum, 8 px spacing rhythm, breakpoints 768 / 1024 px, touch targets about 44 px for tablet use at the ponds.
- Breadcrumbs on every sub-page; searchable dropdowns; confirmation for Close Batch, Close Production Cycle, Declare Batch Failure, archive, and deactivation.
- The Create Batch (Stocking) stepper shows progress (Fry source → Ponds → Batch details → Review → Create) and keeps entered data when moving back.
- Water-quality fields show the GAqP range beside the input and an inline warning with the recommendation when out of range.
- Permits list: search, filters, colored status badges (Active, Expiring soon, Expired, No expiry), soonest-expiring first.
- Reports: card summary on top, sortable table below, filters first.
- WCAG 2.2 AA as a target; keyboard and screen-reader check on the farm's tablets.

# **5\. Backend Schema**

Conventions:
- Every farm-owned table has `TenantId` (FarmId) via `IMustHaveTenant`; sequential GUID keys; ABP audit fields (CreationTime, CreatorUserId, LastModificationTime, LastModifierUserId) and soft delete. "Recorder" = CreatorUserId.
- **Normalization:** tables are in third normal form. A value that can be derived from other columns is computed on read, not stored. The only exceptions are listed under "Allowed snapshots and caches" below, each with its reason.
- Fixed lists (purpose, construction type, transport mode, mortality cause, statuses) are enums stored as integers with explicit fixed values. Lists a farm can edit (pond prefixes, permit categories and presets, size grades) are tables.
- **Column types:** every `…At` column is `datetime2` in UTC; every `…Date` column is `date` (`DateOnly` in C#) in farm time.
- **Soft delete and void:** ABP soft delete (`IsDeleted`) keeps the row, so **every unique index is filtered with `WHERE IsDeleted = 0`** (plus any other filter it already has). Voidable records (production logs, feeding sessions, preparation entries, harvests, sale lines, sale payments) also carry `VoidedAt`, `VoidedByUserId`, and `VoidReason`; voiding sets these and `IsDeleted`. Voided records are excluded from lists, indicators, and reports, and remain visible in history.
- **ClientRequestId** is unique per table per farm.

## **Farm, staff, and permits**

| Entity | Key fields and rules |
| :---- | :---- |
| Farm (AbpTenants) | TenancyName (farm code) unique, Name (the farm name; single source), IsActive. |
| FarmProfile | TenantId (PK, 1:1 with the tenant); AddressLine1 (req), AddressLine2, CityMunicipality (req), Province (req), PostalCode (4 digits in PH), Country (default Philippines); ContactPhone, ContactEmail; TotalAreaHa nullable; FarmingSystem (Extensive, Semi-intensive, Intensive; DEC-65); TimeZone (Asia/Manila); PermitAlertDays (30); StockingWindowDays (default 1, 0–3 †; DEC-63); DateDisplayOrder (MonthFirst, DayFirst; default MonthFirst); TimeDisplay (TwelveHour, TwentyFourHour; default TwelveHour). |
| FarmParameterRange | ParameterCode (unique per farm), OptimalMin, OptimalMax. Farm override of the host ParameterDefinition range; effective range = override or default (DEC-58). |
| FarmDensityBand | FarmingSystem, ConstructionType (unique together per farm), MinPlM2, MaxPlM2. Farm override of the host DensityBand (DEC-58, DEC-65). |
| FarmThreshold | Code (PlAgeMin, PlAgeMax, FeedSpikeMultiplier, DailyMortalityPct, AbwDropPct, BuyerWeightDiffPct; unique per farm), Value. Farm override of the † defaults; effective value = override or default (DEC-58). |
| User, Role (ABP) | One farm per account (host users have none); static roles FarmOwner, FarmTechnician, SystemAdministrator. |
| PermitCategory | Name (unique per farm), RequiresExpiryDate, IsActive. Seeded: Business and Local Permits; Fisheries (BFAR); Environmental (DENR); Tax (BIR); Water Rights (NWRB); Land / Lease; Health and Safety; Other. |
| PermitPreset | CategoryId, Title (unique per category), DefaultAgency, IsRequired. Required by default: BFAR Fishpond / Aquafarm Registration, Environmental Compliance Certificate (ECC), Mayor's / Business Permit. Owners can toggle IsRequired. |
| PermitRecord | CategoryId (req), PresetId nullable, CustomTitle (req when PresetId is null, else null), ReferenceNumber (req; unique among non-archived records in the category), IssuingAgency, IssueDate, ExpiryDate or IsPerpetual, Notes / location, IsArchived, RenewedFromId. Composite FK (PresetId, CategoryId) → PermitPreset(Id, CategoryId), so a preset always belongs to the record's category. Status computed on read: Active, Expiring soon, Expired, No expiry. |
| FarmNotification / FarmNotificationRead | Existing tables: Type, related record type and Id, Message, CreatedAtUtc, OwnersOnly; per-user read rows. The water-quality grouping key added in step D is no longer used for new notifications (DEC-49). |

## **Ponds and preparation**

| Entity | Key fields and rules |
| :---- | :---- |
| PondNamePrefix | Name (unique per farm), ShortCode (1–6 letters, unique per farm, suggested from the initials, fixed once created), SortOrder, IsActive. Seeded "Grow-out Pond" (GP), "Nursery Pond" (NP), "Reservoir" (R). |
| Pond | PrefixId, Number (unique together per farm); PondCode generated once at creation from the prefix's short code and the two-digit number (e.g., "GP-03"); the name is not stored but shown as prefix name + number ("Grow-out Pond 3"), stored, unique per farm, never changed (renaming a prefix does not rename existing codes); Purpose (GrowOut, Nursery, Reservoir, Treatment); ConstructionType (Earthen, Concrete, HDPE-lined; DEC-65); AreaM2 > 0; AverageDepthM; MaxDepthM ≥ average; InletType; OutletType; AerationSystem; Latitude/Longitude; FarmingSystemOverride nullable (effective system = override or farm setting); ManualStatus (Active, UnderMaintenance, Inactive). The operating status is **computed** (see precedence below), not stored. |
| PondModification | PondId, Date, Description. Infrastructure changes over time (status changes come from the audit log and batch/round records). |
| PondPreparationRound | PondId, StartedAt, PreparedAt nullable, PreparedByUserId nullable, UsedAt nullable (set when a batch is stocked from it). One open round per pond: filtered unique (PondId) where `UsedAt IS NULL AND IsDeleted = 0`. The batch points to the round it used (ShrimpBatch.PreparationRoundId, unique). |
| PondPreparationEntry | RoundId, ObservedAt, Description (free text, required). Structured fields to be added after consulting the technician. |

**Pond operating status precedence** (first rule that applies):
1. ManualStatus is Inactive or UnderMaintenance → that status.
2. A batch in the pond is Stocked → In production.
3. An open preparation round exists → Prepared if PreparedAt is set, otherwise Under preparation.
4. The pond's latest batch is Harvested or Failed (not yet Closed) → Post-harvest.
5. Otherwise → Available.

A new batch can be stocked only when the pond's previous batch is Closed (enforced by the open-batch index); the stepper explains this when a Prepared pond still has an unclosed batch.

## **Hatchery, fry, and stock**

| Entity | Key fields and rules |
| :---- | :---- |
| Hatchery | Name, ShortCode (unique per farm), Address, ContactPerson, Phone, BfarAccreditationNo, AccreditationStatus, IsActive. |
| HatcheryCertificate | HatcheryId, CertificateType (Health, Other), CertificateNo, IssueDate, ExpiryDate. Keeps every certificate over time; the current one is the latest unexpired. |
| FryDelivery | HatcheryId, HatcheryBatchNumber (unique per hatchery), DeliveryDate, PlAgeDays, PlReceived > 0, PlHealthCertificateNo, TransportPermitNo nullable (DEC-59), SfscNo nullable (DEC-70), Cost nullable, Notes, StockingFinishedAt and StockingFinishedByUserId nullable (set by Finish stocking; DEC-63). |
| FryDeliveryStatusChange | DeliveryId, Status (Ordered, InTransit, Received, Rejected), ChangedAt, ChangedByUserId, Note. The delivery's current status is the latest change. "Stocked" is not a stored status: a delivery is shown as Stocked when a cycle uses it, with PL left = PlReceived − Σ its batches' StockingCount − Σ its shortfall counts. |
| FryDeliveryShortfall | DeliveryId, Reason (DeadOnArrival, Discarded, Returned, CountDifference), Count > 0, Note. Recorded at Finish stocking so that PL received = Σ StockingCount + Σ shortfall Count (DEC-63). |
| InventoryItem | Category (Feed, Additive, Chemical), Brand, ProductName (unique with Brand per farm), FeedType, BaiRegistrationNo, Unit, PackSize nullable (> 0 base units per pack, e.g. 25 kg per bag; DEC-68), ActiveIngredient and DefaultWithdrawalDays nullable (chemicals; DEC-57), ReorderLevel. |
| InventoryLot | ItemId, LotNumber (unique per item), ReceivedDate, ExpiryDate, Supplier, UnitCost nullable (from its receipt). One receipt creates one lot; more stock of the same product is a new lot. Quantity on hand = Σ its movements (computed). |
| StockMovement | LotId, Date, Type (Receipt, Usage, Adjustment), signed Quantity, Reason (adjustment only), source link **one way only**: FeedingSessionId or ChemicalApplicationLogId (usage only; exactly one), or PreparationEntryId reserved for later. **The quantity used lives only here.** A feeding session's kg = −Σ of its usage movements, so one session may draw from several lots. Never edited; corrections are reversing movements linked to the same source. |

## **Production**

| Entity | Key fields and rules |
| :---- | :---- |
| ProductionCycle | FryDeliveryId (unique: one cycle per delivery), CycleCode generated once at creation (year-month of first stocking, hatchery short code, sequence from NumberSequence; e.g., "2026-11-SHI-01"), stored, unique per farm, never changed; Status (Active, Closed), Outcome (Completed, Failed; set at closing), ClosedAt, ClosedByUserId, RowVersion. Reopening clears Outcome and ClosedAt and writes a ReopenEvent (DEC-64). Hatchery comes from the delivery; start date is the earliest batch StockedAt (both computed). |
| ShrimpBatch | CycleId, PondId, PreparationRoundId (unique), Letter (A, B, …; unique per cycle), BatchCode generated once (cycle code + letter), stored, unique per farm, StockedAt, StockingCount > 0, PondAreaM2AtStocking (snapshot), FarmingSystemAtStocking and ConstructionTypeAtStocking (snapshots), DensityFlag (Within, Below, Above; as judged at stocking), TransportMode (Truck, Van, Motorcycle, Boat, Other), TimeProcessed, AcclimationMinutes, InitialSurvivalEstimatePct, DeadAtStocking nullable ≥ 0 (DEC-59), Status (Stocked, Harvested, Failed, Closed), ClosedAt, ClosedByUserId, RowVersion. Filtered unique (TenantId, PondId) where Status <> Closed. Σ of a cycle's StockingCount ≤ the delivery's PlReceived (checked in the same transaction). |
| BatchFailure | BatchId (PK, 1:0..1), FailedOn, Reason, EstimatedLossPhp. |
| ReopenEvent | EntityType (Batch, Cycle), EntityId, ReopenedAt, ReopenedByUserId, Reason (required). A reopened batch returns to Failed when it has a BatchFailure, otherwise to Harvested (DEC-64). |
| ProductionLog | BatchId, LogType (PreStockingWaterQuality, WaterQuality, GrowthSampling, ChemicalApplication, Mortality, GeneralNote), ObservedAt, Notes, ClientRequestId (unique per farm). Cycle and pond come from the batch. Read-only once the batch is Closed. |
| FeedingSession | BatchId, FeedDate (farm-local), Session (AM, PM), Status (Fed, NotFed), FedAtTime nullable (optional farm-local "HH:mm"; DEC-71), ClientRequestId. Unique (BatchId, FeedDate, Session) where IsDeleted = 0. A Fed session's lots and kg are its usage movements (one or more); a NotFed session has none. A slot with no row is shown as not logged (DEC-50). Read-only once the batch is Closed. |
| WaterQualityMeasurement | LogId, ParameterCode, Value, IsOutOfRange, Side (Low, High). Unique (LogId, ParameterCode). |
| GrowthSamplingDetail | LogId (PK), SampleCount > 0, TotalSampleWeightG > 0, EstimatedSurvivalPct nullable (0–100: staff estimate of live shrimp in the pond as a share of the stocking count, e.g. from cast-net sampling or feed-tray observation; DEC-53). ABW = weight ÷ count (computed). |
| ChemicalApplication | LogId (PK), Reason, Dosage and DosageUnit nullable, Method nullable, EndDate nullable, WithdrawalDays nullable (pre-filled from the item), PrescriptionRef nullable. Earliest safe harvest date = (EndDate or log date) + WithdrawalDays, computed on read. Its lot and quantity are its usage movement(s) (DEC-57). |
| MortalityDetail | LogId (PK), Count ≥ 0, Cause (Disease, WaterQuality, Others), DiseaseName (only when Disease), OtherCause (only when Others), Symptoms. |
| SizeGrade | Label (e.g., "60/70", unique per farm), MinCountPerKg, MaxCountPerKg (both null only for the seeded "Ungraded / mixed" grade, whose pieces are estimated from ABW; DEC-67). Farm-editable list. |
| Harvest | BatchId, HarvestedAt, Type (Partial, Total), TotalKg > 0, Boxes, SampledAbwG nullable, FinalCount nullable, DeadAtHarvest nullable ≥ 0, SmoothShell / IntactAppendages / NoNecrosis nullable, Notes. |
| HarvestGradeLine | HarvestId, SizeGradeId, Kg > 0. Unique (HarvestId, SizeGradeId); Σ Kg ≤ TotalKg. |
| HarvestDisposal | HarvestId, Kg > 0, Reason (StaffOrHomeUse, GivenAway, SpoiledOrLost, Other), Note. Not-sold kg; Σ sold kg + Σ disposal kg ≤ the harvest's TotalKg (DEC-67). |
| Buyer | BuyerType (Individual, Company), Name, ContactPerson (Company only), Phone, Address, IsActive, PrivacyNoticeAcknowledgedAt (Individual only: the Owner confirms the buyer was told their details are recorded for sales records). |
| Sale | BuyerId, SaleDate, DispatchReceiptNo (generated from NumberSequence at save, unique per farm, never reused; a voided sale keeps its number), PaymentTerms; DueDate nullable (≥ SaleDate; Overdue when past and not fully paid; DEC-67); optional transport details: Transporter, DriverName, PlateNo, LoadedAt, Destination, LocalTransportPermitNo, TemperatureNote (DEC-55). Total = Σ line amounts and payment status = paid vs total (both computed). |
| SaleLine | SaleId, HarvestGradeLineId, Kg > 0 (farm weight), BuyerAcceptedKg nullable ≥ 0, PricePerKg ≥ 0. Line amount = (BuyerAcceptedKg or Kg) × PricePerKg (DEC-67). Σ sold Kg per grade line ≤ that line's Kg. The harvest and batch come from the grade line, so one sale can include grades from several harvests. |
| SalePayment | SaleId, PaidOn, Amount > 0, Method (Cash, Bank transfer, Check, Other), Reference. Keeps each payment. |
| ParameterDefinition (host) | Code, Name, Unit, PhysicalMin/Max, OptimalMin/Max, GuidanceFrequency, LowRecommendation, HighRecommendation (adviser-reviewed text). Defaults from PNS/BAFS 197:2025 Annex B † (DEC-56); farms override through FarmParameterRange (DEC-58). |
| DensityBand (host) | FarmingSystem, ConstructionType (Earthen, Concrete, HDPE-lined), MinPlM2, MaxPlM2, Source. One row per pair, seeded from PNS/BAFS 197:2025 Annex C †; Concrete and HDPE-lined start at the lined values. Farms override through FarmDensityBand (DEC-52, DEC-56, DEC-65). |
| NumberSequence | TenantId, SequenceType (CycleCode, DispatchReceipt), Scope (e.g., "2026-11-SHI" or "2026"), NextValue. Read and incremented with `UPDLOCK` in the same transaction as the record that uses the number, so two saves can never get the same number. |

## **Data validation and integrity**

Every rule is enforced in the API (the authority) and, where marked, also in the database. The UI mirrors the API rules for immediate feedback: numeric inputs carry min, max and step; date pickers block impossible dates; pickers list only active, same-farm records; the save button is disabled while saving. Values marked † are defaults chosen by the team, to confirm with the adviser or partner farm.

Severity:
- **Reject**: nothing is saved; field-level message.
- **Warn**: saved, with a visible warning (and a dashboard alert where noted).
- **Info**: shown for context only.

### **General input rules**

| Rule | Severity | Layer |
| :---- | :---- | :---- |
| Text is trimmed; empty after trimming counts as missing. Names ≤ 100 characters, titles ≤ 150, notes and descriptions ≤ 2,000. | Reject | UI, API, DB (column lengths) |
| Codes (farm code, hatchery short code) are 2–20 characters, letters, digits and hyphens, stored uppercase. | Reject | UI, API |
| Phone: Philippine mobile or landline (e.g., 09XXXXXXXXX or +63…). Email: valid format. Postal code: 4 digits when the country is the Philippines. | Reject | UI, API |
| Decimal precision: kg 3 decimals; m² and m 2 decimals; money (PHP) 2 decimals; water-quality values 2 decimals (TAN and nitrite 3). | Reject (excess decimals rounded in UI, rejected in API) | UI, API, DB (column types) |
| Times are entered in Asia/Manila and stored in UTC. An observation time may not be more than 5 minutes in the future. | Reject | UI, API |
| Every foreign key must point to a record of the same farm and, for pickers, an active record. | Reject (another farm's record answers "not found") | API (tenant filter), DB (FK) |
| CSV export cells starting with `=`, `+`, `-`, `@`, tab, or carriage return are prefixed with an apostrophe (prevents formula injection in Excel). | Enforced on export | API |

### **Field limits and thresholds by record**

| Record and field | Reject when | Warn when |
| :---- | :---- | :---- |
| Farm total area (ha) | ≤ 0 or > 10,000 | Sum of pond areas exceeds it |
| Pond area (m²) | ≤ 0 or > 1,000,000 | — |
| Pond depths (m) | Average ≤ 0 or > 10; max < average | — |
| Pond farming system vs construction | — | Extensive in a concrete pond; extensive in an HDPE-lined pond (DEC-65) |
| Permit dates | Expiry before issue; issue date in the future; perpetual where the category requires expiry | — |
| Fry delivery PL received | ≤ 0 or > 10,000,000 | — |
| Fry delivery PL age (days) | < 1 or > 60 | Outside the farm's PL age range (default PL10–PL20 †) |
| Fry delivery status | A change to the same status as the current one; any change once a cycle uses the delivery, except a note | — |
| Stocking: count per batch | ≤ 0; cycle total > PL received | — |
| Stocking: date/time | Before the delivery's received date; after the end of its stocking window (Farm Standards, default 1 day †); in the future | — |
| Stocking: time processed | After the stocking time | Stocked more than 24 hours after processing † |
| Stocking: acclimation (minutes) | < 0 or > 600 | — |
| Stocking: initial survival estimate (%) | < 0 or > 100 | — |
| Stocking: dead at stocking | < 0 | Above the stocking count |
| Finish stocking: PL not stocked | Count ≤ 0; no reason; stocked + not stocked ≠ PL received | — |
| Pre-stocking water quality | Any of DO, temperature, pH, salinity missing | Outside the GAqP optimal range |
| Stocking density (PL/m²) vs the farm's effective band for the pond's farming system and construction type (DEC-52, DEC-65) | — | Outside the band (stored as DensityFlag Below or Above). Default bands (PNS/BAFS 197:2025 Annex C †): extensive 1–30; semi-intensive 40–60; intensive 70–90 (earthen), 100–140 (concrete or HDPE-lined). A density between two systems' bands is outside the pond's band and warns. |
| Water-quality readings | Outside the physical limits (Section 5 table) | Outside the GAqP optimal range (recommendation shown inline; counted in the dashboard summary and the Water Quality Exceptions report) |
| Feeding session kg | ≤ 0 or > 1,000 | More than 3× the batch's average session over the last 7 days †; lot expired; lot stock goes below zero (shown in the dashboard stock list) |
| Chemical/supplement application | Quantity ≤ 0; dosage < 0; withdrawal days < 0 or > 365; end date before the application date | Lot expired; lot stock goes below zero |
| Growth sampling | Sample count ≤ 0; total weight ≤ 0; ABW > 60 g | ABW lower than the previous sample by more than 20% † |
| Mortality count | < 0 | One day's count above 1% of the estimated remaining population † (counted in the dashboard summary); count above the estimated remaining population |
| Growth sampling estimated survival % | < 0 or > 100 | Higher than the batch's previous estimate |
| Harvest dead at harvest | < 0 | Above the harvested pieces |
| Log or feeding date | Before the batch's stocking date; after its Total harvest date (salvage records of a Failed batch excepted) | — |
| Harvest total kg | ≤ 0 | — |
| Harvest grade lines | Σ kg > total kg; the same grade twice in one harvest | Σ kg below total kg (ungraded remainder shown) |
| Harvest final count | < 0 or > the batch's stocking count | — |
| Harvest not sold | Kg ≤ 0; no reason; Σ sold kg + Σ not-sold kg > harvest total kg | — |
| Computed survival rate | — | Above 100% (shown as 100% with "estimate exceeds stocking count; check mortality and harvest entries") |
| Harvest sampled ABW | ≤ 0 or > 60 g | — |
| Harvest date | Before stocking; in the future | Before the earliest safe harvest date of a treatment on the batch (DEC-57) |
| Sale lines | Kg ≤ 0; price < 0; buyer's accepted kg < 0; sold kg per grade line > unsold kg of that line | Price is 0; buyer's accepted kg differs from kg by more than 10% † |
| Sale date | Before the harvest date of any of its lines | — |
| Sale due date | Before the sale date | Past due while unpaid or partly paid (shown as Overdue) |
| Sale payment | Amount ≤ 0; paid date before the sale date | Payments exceed the sale total (overpayment shown) |
| Inventory receipt | Quantity ≤ 0; unit cost < 0; pack count ≤ 0 when entered in packs | Lot expiry date already past |
| Inventory item pack size | ≤ 0 | — |
| Inventory adjustment | Quantity = 0; no reason | — |

Thresholds marked † are defaults the Owner can change in Farm Standards (DEC-58); every warning names the value it was judged against.

### **State and lifecycle guards**

| Action | Allowed only when |
| :---- | :---- |
| Add preparation entry | Pond is Available, Post-harvest, or Under preparation; ManualStatus is Active |
| Mark Prepared | Open round has at least one entry |
| Set ManualStatus to Under maintenance or Inactive | The pond has no open batch and no open preparation round |
| Create Batch (new cycle) | Delivery's current status is Received, no cycle uses it, and stocking is not finished; stocking date within the window; every chosen pond is Prepared, GrowOut, Active, with no open batch |
| Create Batch (add to cycle) | Cycle is Active; its delivery is not finished; stocking date within the window; the pond rules above; PL left > 0 |
| Save or edit a log or feeding session | Batch is Stocked; Harvested or Failed for corrections; never Closed; date not before stocking and not after the Total harvest date (DEC-51, DEC-66) |
| Log harvest | Batch is Stocked, or Failed (salvage) |
| Total harvest saved | Batch moves to Harvested; no further harvests unless the Total harvest is edited back to Partial before Close Batch |
| Declare Batch Failure | Batch is Stocked |
| Close Batch | Batch is Harvested or Failed |
| Close Production Cycle | Every batch is Closed |
| Finish stocking | Owner; delivery used by an Active cycle and not finished |
| Reopen batch | Owner; batch is Closed; its cycle is not Closed; reason given |
| Reopen cycle | Owner; cycle is Closed; reason given |
| Edit stocking count | Batch is not Closed; new cycle total ≤ PL received (after Finish stocking, the change is balanced by the delivery's count-difference line); Owner only, reason recorded in the audit log |
| Deactivate a hatchery, item, buyer, prefix, size grade, or category | Allowed at any time. It disappears from pickers, while history and existing links stay. A hatchery with a delivery that has no cycle yet shows a warning first. |

### **Edits, removals, and stock integrity**

- **No hard deletes of farm data.** A mistaken log, feeding session, chemical application, harvest, sale line, or payment is **voided** (soft delete with a reason) by an Owner while the batch is not Closed. Technicians edit their own entries but do not void.
- **Stock follows its source.** Editing a feeding session's or chemical application's lot or quantity, or voiding it, writes a reversing movement and (on edit) a new usage movement, all linked to the same source, in the same transaction. Stock movements themselves are never edited or deleted.
- **Re-entry after a void.** Because unique indexes ignore voided rows, a voided AM session or log can be entered again correctly.
- **Voiding a harvest** is rejected while any sale line uses its grade lines; the sale lines must be voided first.
- **Editing pond area** after stocking does not change existing batches, which use their snapshot.
- **Changing GAqP ranges** (System Administrator) does not re-flag past readings; flags are judged when saved.

### **Concurrency and duplicates**

- **Optimistic concurrency.** RowVersion on ShrimpBatch, ProductionCycle, FryDelivery, Harvest, and Sale. A conflicting save is rejected with "This record was changed by someone else; reload".
- **Delivery allocation.** Stocking batches from the same delivery is checked inside one transaction with a lock on the delivery row, so two users cannot over-allocate it at the same moment.
- **How locks are taken.** Inside the ABP unit of work, the parent row is read with `FromSqlRaw("SELECT … WITH (UPDLOCK, ROWLOCK) WHERE Id = @id")` before the check. This matters more under read-committed snapshot, where plain reads see a snapshot and do not wait. Locked rows: FryDelivery (allocation), HarvestGradeLine (sold kg), NumberSequence (codes and receipt numbers).
- **Duplicate-safe saves.** Every create request from the field (logs, feeding sessions, harvests, preparation entries) carries a ClientRequestId; a retried request returns the original record instead of creating a second one.
- **One feeding session per batch, day and session.** Saving AM again for the same day edits the existing session (with stock correction) rather than adding a second one.

### **Database constraints (beyond keys and foreign keys)**

- **Unique constraints** (all filtered with `IsDeleted = 0`): farm code; pond code; cycle code; batch code; hatchery short code; delivery batch number per hatchery; one cycle per delivery; batch letter per cycle; open batch per pond (filtered); open preparation round per pond (filtered); pond prefix + number; lot number per item; size grade label; grade per harvest; feeding session per batch/day/session; dispatch receipt number; permit reference number among non-archived records in a category (filtered); ClientRequestId per farm.
- **Check constraints:** all "> 0" and "≥ 0" rules above; percentages 0–100; ExpiryDate ≥ IssueDate; MaxDepthM ≥ AverageDepthM; exactly one source on a usage movement; DiseaseName only when the cause is Disease; OtherCause only when the cause is Others; PackSize > 0; DeadAtStocking ≥ 0; WithdrawalDays 0–365; Sale DueDate ≥ SaleDate.
- **Cross-row rules** (enforced in the API inside one transaction, not in the database):
  - cycle stocking total ≤ PL received; after Finish stocking, stocked + not stocked = PL received
  - per harvest: Σ sold kg + Σ not-sold kg ≤ total kg
  - sold kg per grade line ≤ graded kg
  - Σ grade kg ≤ harvest total

## **Allowed snapshots and caches**

| Stored value | Why it is kept |
| :---- | :---- |
| ShrimpBatch.PondAreaM2AtStocking | Pond area can be edited later; density must reflect the pond as stocked. |
| ShrimpBatch.FarmingSystemAtStocking, ConstructionTypeAtStocking, DensityFlag | The pond or farm setting can change after an upgrade; the batch is judged against the pond as stocked (DEC-52). |
| WaterQualityMeasurement.IsOutOfRange, Side | GAqP ranges can be changed by the System Administrator or overridden in Farm Standards; history must keep the flag as it was judged at the time. |
| InventoryLot.UnitCost | The receipt price of that lot is a historical fact; usage cost = quantity × the lot's unit cost (exact, and unaffected by later or back-dated receipts). |
| Pond.PondCode, ProductionCycle.CycleCode, ShrimpBatch.BatchCode, Sale.DispatchReceiptNo | Identifiers generated once at creation and never changed, so printed codes always match the system (SQL Server computed columns cannot read other tables). |

Final indicators of a Closed batch are computed on read; because a Closed batch's records are read-only, the values never change.

## **Water-quality parameters (defaults from PNS/BAFS 197:2025 Annex B †; the manuscript cites 197:2017)**

| Parameter | Unit | Optimal (flag outside) | Frequency | Physical limit (reject outside) |
| :---- | :---- | :---- | :---- | :---- |
| Dissolved oxygen | ppm | ≥ 4.0 | 2× daily | 0 – 20 |
| Temperature | °C | 25 – 30 | 2× daily | 0 – 45 |
| pH | — | 7.5 – 9.0 | 2× daily | 0 – 14 |
| Salinity | ppt | 15 – 25 | Daily | 0 – 60 |
| TAN (total ammonia-N) | ppm | ≤ 1.0 (source range 0.1–1.0; low values not flagged) | Weekly | 0 – 100 |
| Nitrite | ppm | ≤ 0.5 | Weekly | 0 – 100 |
| Alkalinity | ppm CaCO₃ | 100 – 200 | Weekly | 0 – 500 |
| Nitrate | ppm | ≤ 1.2 (source range 0.6–1.2; low values not flagged) | As needed | 0 – 500 |

The same source lists unionized ammonia (≤ 0.2 ppm), transparency (30–50 cm), H₂S (≤ 0.1 ppm), phosphate, silicate, magnesium, calcium, soil pH, and organic matter; which of these are logged depends on the partner farm's test kits (open question). Farms adjust any range in Farm Standards; past readings keep their saved flag (DEC-56, DEC-58).

## **Computed indicators (per batch; cycle values aggregate its batches)**

| Indicator | Formula |
| :---- | :---- |
| Stocking density | StockingCount ÷ PondAreaM2AtStocking |
| DOC | Farm-local date − stocking date (stocking day = 0) |
| Cumulative feed | Σ usage quantity of the batch's feeding sessions |
| ABW | Latest growth sample (weight ÷ count), or the harvest's SampledAbwG |
| Harvested pieces | FinalCount if given; else Σ grade kg × the grade's mid count per kg (the "Ungraded / mixed" grade and any ungraded remainder use kg × 1000 ÷ ABW); else TotalKg × 1000 ÷ ABW |
| Remaining in pond (est.) | With a growth sample that has EstimatedSurvivalPct (latest one): StockingCount × that % − mortality logged after the sample − pieces harvested after the sample. Otherwise: StockingCount − cumulative mortality − harvested pieces. Shown with its basis (DEC-53). |
| Biomass (est.) | Remaining × ABW ÷ 1000 |
| FCR to date | Cumulative feed ÷ (biomass + harvested kg) |
| Final FCR | Total feed ÷ total harvested kg (farm-weighed) |
| Survival rate | Harvested pieces ÷ StockingCount × 100 (capped at 100% with a warning); dead at stocking is shown separately, not deducted (DEC-68) |
| Production cost (stock used) | Σ usage quantity × its lot's unit cost, plus a share of the whole delivery cost by stocking count, including PL recorded as not stocked (DEC-68) |
| Sales revenue | Σ ((BuyerAcceptedKg or Kg) × PricePerKg) for lines from the batch's harvest grades (DEC-67) |
| Margin | Sales revenue − production cost, labeled "margin over feed, chemicals and PL" (DEC-15) |
| Earliest safe harvest date | Latest (EndDate or log date) + WithdrawalDays across the batch's chemical applications (DEC-57) |
| Delivery PL accounted for | Σ StockingCount + Σ shortfall Count; equals PlReceived after Finish stocking (DEC-63) |

## **Permissions**

| Area | Farm Owner | Farm Technician | System Administrator |
| :---- | :---- | :---- | :---- |
| Farm profile and settings | Manage | Read | Farm name, code, active only |
| Staff accounts | Manage | Own profile/password | Unlock / temporary password |
| Permits and Licenses | Manage | None | None |
| Ponds | Manage | Read; preparation entries; Mark Prepared | None |
| Hatchery profiles | Manage | Read | None |
| Fry deliveries | Record, edit, update status | Read; update status (with note) | None |
| Feed and Additives | Manage | Read stock | None |
| Create Batch (Stocking) | Yes | Yes | None |
| Logs, feeding sessions, harvests, sales | Create/update; void with reason until the batch is Closed | Create; update own until the batch is Closed; cannot void | None |
| Declare Batch Failure, Close Batch, Close Production Cycle, reopen, Finish stocking | Yes | No | None |
| Farm Standards | Manage | Read | None |
| Buyers, sales, Sales History | Manage | None | None |
| Reports, activity log | Yes | Operational dashboard only | Security and error logs only |
| Reference data (parameters, density bands, recommendations; farm overrides are Farm Standards) | Read | Read | Manage |

## **Retention**

Sales records and buyer details at least 5 years; permits while current plus 5 years after archiving; production records for the life of the system; user accounts deactivated rather than deleted; request audit log 12 months (data-change history kept for the life of the system); backups per DEC-36. Confirm with the adviser before release.

# **6\. Reliability, Scalability, and Maintainability**

Measured against the three goals of *Designing Data-Intensive Applications*, scaled to one farm on a local network. Values are targets to verify in Milestone 8.

## **Reliability**

| Concern | Solution |
| :---- | :---- |
| Hardware failure of the single server PC | **Targets:** at most 30 minutes of data lost (RPO), service back within 2 hours (RTO). **Cold standby:** a second machine (a team laptop or spare PC) with the same OS, SQL Server Express, and the current app release installed, kept off. **Restore:** a scripted procedure (restore full backup, then log backups in order, start the services, run the smoke test), rehearsed monthly with the time recorded. |
| Backups (SQL Server Express has no SQL Agent) | Database in the **full recovery model**. Scheduled with Windows Task Scheduler (or cron/systemd timers on Ubuntu) running `sqlcmd` scripts. **Full backup** daily at 01:00. **Transaction-log backup** every 30 minutes. Each file is copied to the external drive as soon as it is written. **Weekly off-site copy**, encrypted with AES-256 (7-Zip or a VeraCrypt/BitLocker drive, because Express has no native backup encryption), kept by the Owner. **Retention:** 14 days of daily backups and their logs on the drive, 8 weekly copies off-site. Every job writes its result to a BackupRun table shown on the health page. |
| Silent corruption | Weekly `DBCC CHECKDB` (scheduled script); backups made with `CHECKSUM`; monthly test restore to the standby machine followed by `RESTORE VERIFYONLY` and the smoke test. Any failure raises an operational alert. |
| Power loss | Transactions are atomic, so a half-saved record cannot exist. UPS with shutdown software for a clean shutdown when the battery runs low. BIOS set to "power on after AC loss". The API and client run as services that start automatically (Windows service via `UseWindowsService`, or systemd with `Restart=always`). |
| Clock errors | Automatic time sync on the server (Windows Time service or chrony). Rules use server UTC only; a client time more than 5 minutes ahead of the server is rejected. The health page shows server time and time-zone setting. |
| Shared tablets at the ponds | **No idle logout** (removed 22 Oct 2026 at the team's request; staff use "Switch user" when handing over a tablet). **Token lifetime** 4 hours (the template has no refresh tokens; staff sign in again). **Server-side revocation:** each request checks the user's security stamp (ABP's validator where the template provides it, otherwise a small middleware comparing the token's stamp claim with the cached stamp), so deactivating a user or resetting a password ends their sessions immediately. **Password policy:** at least 8 characters with an uppercase letter, a lowercase letter, and a digit. **Lockout:** 5 failed attempts locks the account for 15 minutes. A visible "Switch user" button. The signed-in name is always shown in the header. |
| Wi-Fi drops while typing | **Form drafts** saved in the browser (localStorage) for log, harvest, and preparation forms. Drafts are keyed by user and form, restored when the form reopens, deleted on save, discard, or after 24 hours, and never hold passwords. Combined with ClientRequestId, a retry after a drop neither loses nor duplicates data. |
| Write skew (two users pass the same check at once) | Checks that span rows lock the parent row (`UPDLOCK`) inside the transaction: delivery allocation (FryDelivery row) and sold kg per grade (HarvestGradeLine row). Rules that a unique index already guards rely on the index: open batch per pond, open preparation round per pond, one cycle per delivery, one feeding session per batch/day/session. |
| Readers blocking writers | `READ_COMMITTED_SNAPSHOT` turned on for the database so long reports read a consistent snapshot and never block saves at the ponds. `ALTER DATABASE … SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE` cannot run inside a transaction, so it runs in a migration step with `suppressTransaction: true` (or in the Migrator before migrations). |
| Human error | Void with reason (no hard deletes), confirmations, audit log, validation catalog (Section 5). A **training farm** (a second farm account with sample data) for practice without touching real records. |

## **Scalability**

| Concern | Solution |
| :---- | :---- |
| Load parameters | **Users:** 5 concurrent (2 Owners, 3 Technicians). **Ponds:** about 10. **Writes:** about 100 per day (feeding sessions, water-quality logs, other logs). **Reads:** dashboard and lists dominate. |
| Data growth | **Production records:** about 30,000 log and session rows a year, under 50 MB a year with indexes. **Audit log (the largest table):** ABP records every API request (an estimated 0.5 GB a year if kept forever). **Request audit retention:** 12 months, purged nightly; data-change history kept for the life of the system. **Expected database size:** under 2 GB after 5 years, well inside SQL Server Express's 10 GB limit. The health page shows the database size with a warning at 7 GB. |
| Lists and reports | **Server-side pagination** on every list: default 25 rows, maximum 100, with filters and sorting on the server. **Report date ranges** limited to 24 months; larger ranges use CSV export. Dashboard queries use only the indexes in the architecture rules. |
| Performance target | p95 < 500 ms for ordinary API calls at the load above with two years of data; reports < 3 s. Measured in Milestone 8 with the seeded two-year dataset. |
| Phase 2 growth | Tenant-first data model is ready for many farms. If indicators become slow, add caches of closed-batch indicators that are **rebuildable from source records** (never edited directly). Offline capture will rely on GUID keys and ClientRequestId already in place. |

## **Maintainability**

| Concern | Solution |
| :---- | :---- |
| Operability: health page (System Administrator) | Shows: app version and build; server time; database size; free disk space (alert below 15%); last successful full and log backup (alert if the log backup is older than 1 hour or the full backup older than 26 hours); last integrity check; certificate expiry dates (alert 30 days before); recent errors count. |
| Data-change history | ABP entity history is **disabled by default**; enable it for these entities only: Hatchery, HatcheryCertificate, FryDelivery, InventoryItem, InventoryLot, Pond, ShrimpBatch, Harvest, Sale, SalePayment, PermitRecord. The History panels read from it. High-volume rows (water-quality measurements, feeding sessions) rely on their own audit fields and void fields instead. |
| Scheduled jobs | ABP periodic background workers in the API, all in farm time: **daily 00:05** permit expiry check (raises Expiring soon / Expired notifications once each); **daily 00:15** request-audit purge (older than the retention setting); **every 15 minutes** backup freshness check (reads BackupRun; alerts if the log backup is older than 1 hour or the full backup older than 26 hours); **daily 06:00** disk space and certificate expiry check. Database backups and integrity checks run outside the app (Task Scheduler / cron) so they still run if the app is down. |
| Certificates | Local root CA valid 10 years. Server certificate valid 1 year (inside browser limits). **Renewal:** a scripted renewal, listed in the runbook, with a health-page alert 30 days before expiry. |
| Logs | The template's log4net rolling file: 10 MB per file, 30 files kept (about 300 MB cap). Errors include a correlation ID shown to the user ("Error reference ABC123") so a report can be matched to the log. |
| Runbook | One document in the repository covering: install; start, stop, and restart the services; backup and restore (including to the standby machine); certificate renewal; System Administrator account recovery; release and rollback; what each health-page alert means and what to do. |
| Release and rollback | **Before:** back up (full plus log), record app and database version. **Release:** stop services, deploy the package, apply reviewed migrations, start services, run the smoke test, check the health page. **Rollback:** if the smoke test fails, restore the pre-release backup and redeploy the previous package (do not rely on running migrations backwards after real data was written). Every migration still has a reviewed Down() for development use. |
| Schema evolution | EF Core migrations only, reviewed before merge. Enums stored as integers with **explicit fixed values**; values are never renumbered or reused, so adding members never changes the meaning of stored data. New columns nullable or with defaults so existing rows stay valid. |
| Data portability | **CSV export** (UTF-8 with BOM for Excel, ISO dates in farm time) on every list and report, Owner only, each export audit-logged. Supports the farm's right to its data (Data Privacy Act of 2012) and analysis by the adviser. |
| Versioning | Semantic version plus Git commit in the build; shown in the footer and on the health page; changelog.md updated per release. |
| Simplicity | Business rules in one place (Core); one validation catalog; source-of-truth tables vs computed values documented (Section 5); no feature kept without a manuscript, panel, or decision reference. |

# **7\. Implementation Plan**

Feature-Driven Development; each milestone ends with its acceptance tests passing.

**Existing codebase.** The Capstone solution already implements most P1 features under the earlier spec (fpms.md v1.5). Before any milestone work, a gap analysis (Milestone 0) marks every acceptance criterion and decision as Done, Change, or New. Each data-changing migration needs a conversion rule for existing records and a rollback by backup restore. The milestones below are the target checklist, worked through in the order the gap analysis sets. The v2.6 changes are listed in docs/gap-analysis.md Section 11.

| # | Milestone | Done when |
| :---- | :---- | :---- |
| 1 | Project setup: confirm the template baseline (generated as Capstone), record versions, SQL Server in OrbStack, secrets out of source, `/health`, separate client origin, `READ_COMMITTED_SNAPSHOT` on (outside a transaction), entity history and background workers configured, zoneless page base pattern, enums with explicit fixed values, log rotation, version in footer, `.editorconfig`, `dotnet format`, Prettier/ESLint, PermissionNames and localization source in place, Swagger limited to Development, `Clock.Provider` set to UTC. | Clean clone runs on a second machine. |
| 2 | Accounts and tenancy: static roles and permissions in code, template hardening (remove Default tenant and default passwords, disable user self-registration and role editing, Farm code sign-in field, 4-hour token, password and lockout policy), farm registration, staff, System Administrator and recovery, audit logging, two seeded test farms (development only). | AC-01, AC-02, AC-19, AC-21. |
| 3 | Farm setup: profile and settings, Farm Standards, ponds first (prefixes, inheritance, warnings), permits and licenses, hatcheries, fry deliveries (Log Fries) with history and PL health certificate, feed and additives (pack sizes), buyers. | AC-03 to AC-06, AC-34. |
| 4 | Log Pond Preparations, Create Batch (Stocking) stepper with stocking window and live density, Finish stocking, Declare Batch Failure, Close Batch, Close Production Cycle with outcome, reopening. | AC-07 to AC-10, AC-15 to AC-17, AC-36. |
| 5 | Operations: cycle → pond selection, AM/PM feeding and sheet, water quality with recommendations, growth sampling, chemical application with withdrawal and safe harvest date, mortality, live indicators. | AC-11, AC-12, AC-35, AC-38; reference batch matches hand calculations. |
| 6 | Harvest and sales: harvest from batch, remaining in pond, not-sold entries, buyers, sales with buyer's accepted kg and due dates, Sales History, dispatch receipt. | AC-13, AC-14, AC-37. |
| 7 | Reports and dashboard: named reports with cards, sorting, filters; server-side pagination; CSV export; dashboard and notifications; history panels; System Administrator health page. | AC-18, AC-26, AC-27. |
| 8 | Quality and security: full suite including every validation and integrity rule, two-farm isolation, performance and data-growth test, drafts, backup (full and 30-minute log) and timed restore to the standby machine, integrity check, accessibility on tablets. | No open critical/high defects; AC-20, AC-22 to AC-27. |
| 9 | Release: pond Wi-Fi walk test; server PC on UPS with auto power-on and services; time sync; HTTPS with local CA and renewal script; scheduled backups, integrity check, and off-site routine; standby machine prepared; runbook; user guide; training farm; adviser-reviewed recommendation texts; System Administrator handover. | Partner-farm acceptance; restore rehearsed within 2 hours. |

## **Test checkpoints**

- Isolation: two farms; every list, detail, write, and report denies the other farm's IDs.
- Ponds first: production, hatchery, and stock screens redirect when no pond exists.
- Stepper: unprepared ponds never listed; over-allocation rejected; two batches same day both save; one delivery cannot start two cycles; a stocking date after the window is rejected while a late entry dated inside it saves; Finish stocking requires stocked + not stocked = PL received and blocks further batches; a density outside the band warns and stores Below or Above.
- Water quality boundaries (defaults): DO 4.0 in range, 3.9 flagged; temperature 30.0 in, 30.1 flagged; pH 7.5 and 9.0 in, 7.4 and 9.1 flagged; salinity 25.0 in, 25.1 flagged; nitrite 0.50 in, 0.51 flagged; alkalinity 100 and 200 in, 99 and 201 flagged; pH 15 rejected; a Farm Standards override changes the flag for new readings only.
- Stock: AM/PM feeding and chemical application create usage movements; shortfall warns and saves.
- Closing: a Stocked batch cannot be closed; a cycle with an open batch cannot be closed; after Close Batch its operational logs and harvests reject edits; after Close Production Cycle every record rejects edits; reopening needs a reason, returns the batch to Harvested or Failed, and re-closing recomputes indicators; a batch of a Closed cycle cannot be reopened until the cycle is.
- Indicators: reference batch values equal hand calculations, including survival with and without FinalCount.
- Dates: a log dated before stocking or after the Total harvest is rejected; histories show each entry's recorded time.
- Treatments: a harvest before the safe harvest date warns.
- Sales options: the buyer's accepted kg drives the amount due; Overdue shows after the due date; not-sold kg cannot exceed the unsold balance; the "Ungraded / mixed" grade can be sold.
- Inventory: a receipt in packs stores base units; the earliest-expiring lot is pre-selected.
- Performance: p95 < 500 ms with the two-year dataset and 5 users.
- Template hardening: `admin`/`123qwe` cannot sign in on a fresh production install; the user self-registration and role-editing endpoints return not found or forbidden; Swagger is unreachable outside Development.
- Review fixes: a voided AM session can be re-entered; two simultaneous sales get different receipt numbers; one feeding session can use two lots and stock reflects both; a deactivated user's token is refused on the next request; the RCSI migration applies to an empty and to an existing database; History panels show changes for each tracked entity; a CSV cell starting with "=" opens as text in Excel.
- Validation: one test per Reject rule and per Warn rule in "Data validation and integrity", including void-and-reverse stock, concurrent allocation, and duplicate ClientRequestId.
- Backup: full plus log restore to the standby machine reproduces the database up to the last log backup, within 2 hours; a failed backup job shows on the health page.
- Reliability: concurrent sale of the same grade never oversells; a report running during saves does not block them; a draft survives a page reload and is invisible to another user.
- Scalability: pagination limits enforced; database size and growth measured on the two-year dataset; request-audit purge removes rows older than 12 months.
- Conventions: formatters and linters pass with no changes; dates, money, and codes on screens and printouts match the display formats; switching the farm's date order changes every screen and printout; every export, printout, backup, and log file name matches its pattern, and restore and purge scripts find files by pattern.
- Maintainability: release and rollback rehearsed once end to end; CSV export opens correctly in Excel.

# **Appendix A. Decision log**

| ID | Decision |
| :---- | :---- |
| DEC-01 | Local on-premise MVP at the partner farm with a SaaS-ready multi-tenant model (TenantId = FarmId). |
| DEC-02 | JWT bearer authentication; ASP.NET Core Identity password hashing; no cookie sessions or plaintext. |
| DEC-03 | SQL Server in Docker via OrbStack for development; SQL Server Express in production. |
| DEC-04 | ASP.NET Boilerplate v10.2.0 template (.NET 9, Angular 19.2.1), generated as Capstone. |
| DEC-05 | Accept ABP and .NET 9 end-of-support risk for the capstone; LAN-only; upgrade in Phase 2. |
| DEC-06 | Roles: Farm Owner, Farm Technician; restricted System Administrator host account; developers have no production accounts. |
| DEC-07 | Serve the Angular client from its own origin; keep the template's antiforgery configuration unchanged. |
| DEC-08 | Production hierarchy: one fry delivery → one Production Cycle → many Shrimp Batches (one per pond) → logs and harvests. |
| DEC-09 | Pond preparation on the pond; only Prepared ponds can be stocked; Create Batch (Stocking) stepper with review; the first creation initializes the production cycle. |
| DEC-10 | Lifecycle: batch Stocked → Harvested / Failed → Closed (Close Batch locks its logs); cycle Active → Closed (Close Production Cycle, after every batch is Closed). Failure is declared per batch. Amended by DEC-64: Owner reopening with a reason; cycle outcome Completed or Failed at closing. |
| DEC-11 | Transport mode and time processed are recorded per batch; hatchery, batch number, PL age, and PL received per delivery. |
| DEC-12 | GAqP ranges as seeded reference data: flag and show recommendations, never block; reject only physically impossible values. |
| DEC-13 | Daily logs: cycle → pond selection; AM/PM feeding with kg and lot; chemical and supplement application; three mortality causes. |
| DEC-14 | Asia/Manila for display, day boundaries, and DOC (stocking day = 0); UTC storage. |
| DEC-15 | Transaction mechanism = inventory movement ledger; usage cost from the lot's receipt unit cost; shortfall warns. No financial bookkeeping ledger. |
| DEC-16 | Sales keep prices and payment status; the printable dispatch receipt is internal, not a BIR official receipt. |
| DEC-17 | Farm-level farming system with pond override; unusual combinations warn only. Farming systems are Extensive, Semi-intensive, and Intensive (DEC-65). |
| DEC-18 | Permits and Licenses as reference records without files or approval; required presets remind, never block. File attachments deferred to P2. |
| DEC-19 | Structured farm address and optional total farm area (warning when ponds exceed it). |
| DEC-20 | Ponds must be set up first; pond names from prefix dropdown plus number. |
| DEC-21 | Technicians may use Create Batch (Stocking) and edit their own entries until the batch is Closed. |
| DEC-22 | Hosting: farm-office PC on UPS, LAN-only HTTPS with a local CA. |
| DEC-23 | Backups: superseded by DEC-36 (daily full plus 30-minute log backups, encrypted weekly off-site copy, rehearsed restore). |
| DEC-24 | Pond Wi-Fi walk test before release. Printable log sheets for a paper-then-enter fallback are P2. |
| DEC-25 | System Administrator custody: team during capstone, then a person named by the farm; recovery via second Owner or security question. |
| DEC-26 | Retention: sales 5 years; permits current plus 5 years; production for system life (confirm with adviser). |
| DEC-27 | Performance: two-year single-farm dataset, 5 users, p95 < 500 ms. |
| DEC-28 | Pilot: one deployment at the partner farm plus a second test farm for isolation tests. |
| DEC-29 | Scope: manuscript Table 6 with the P1/P2 split in Section 1, as revised by the defense panel. |
| DEC-30 | Terminology follows the manuscript's use-case names (Appendix D), except where the panel changed behavior. |
| DEC-31 | Configure Batch Production Protocol (Ref 5.4) and "Today's tasks" are removed. The farm follows one standard routine across ponds and adjusts daily by staff judgment, so the system focuses on logging. |
| DEC-32 | Pond preparation is recorded as dated free-text entries for now; post-production management logging is removed; batch creation has no permit check (required permits are reminded on the dashboard only). |
| DEC-33 | Farm Technicians can update fry delivery status (with a note); recording and editing delivery details stays with the Owner. |
| DEC-34 | Schema in third normal form: derived values computed on read; AM/PM feeding as session rows; quantities used stored only on stock movements; payments, certificates, and delivery status changes as history tables; sale lines reference harvest grade lines; size grades as a farm table. Snapshots kept only where history requires them (Section 5). |
| DEC-35 | One catalog of validation and integrity rules (Reject / Warn / Info) enforced in the API and mirrored in the UI; no hard deletes (void with reason and reversing stock movements); optimistic concurrency and duplicate-safe saves; density checked against the manuscript's farming-system ranges. Values marked † are team defaults to confirm. |
| DEC-36 | Backups: full recovery model, daily full and 30-minute log backups via scheduled sqlcmd, encrypted weekly off-site copy; RPO 30 minutes, RTO 2 hours with a cold standby machine and a monthly rehearsed restore. |
| DEC-37 | Shared-device security: 4-hour token with server-side security-stamp check, password policy (8+ characters with upper, lower, and digit), lockout after 5 failures for 15 minutes; per-user form drafts in the browser. |
| DEC-38 | Concurrency: READ_COMMITTED_SNAPSHOT; parent-row locks for cross-row checks; unique indexes for single-row rules. |
| DEC-39 | Operations: automatic time sync; services auto-start; health page with backup, disk, size, certificate, and error status; capped log files; runbook; release and rollback by backup restore. |
| DEC-40 | Scale and evolution: server-side pagination; 24-month report range; request-audit retention 12 months; enums stored as integers with explicit fixed values; CSV export of every list and report; version shown in the app. |
| DEC-41 | Naming and formatting conventions (code, database, record codes, display formats, screen text) as in Section 2, enforced by .editorconfig, dotnet format, Prettier, and ESLint from Milestone 1. |
| DEC-42 | Fixed file-name patterns for exports, printouts, backups, and logs (farm code or system prefix, record code, year-first timestamps). Configurable: date and time display per farm (Owner); backup paths, prefix, intervals, and retention, audit retention, and log size (System Administrator, server configuration). Patterns themselves are not configurable. |
| DEC-43 | Review fixes: unique indexes filtered on IsDeleted with explicit void fields; generated identifiers stored once (no cross-table computed columns) with a locked NumberSequence; one-way stock-movement links (several lots per feeding session); preparation round UsedAt; RCSI enabled outside a transaction; ABP entity history enabled for listed entities; ABP background workers for scheduled checks; existing farm notification tables with grouped water-quality alerts; lot-based cost instead of moving average; CSV formula-injection guard; buyer privacy notice; pond status precedence; zoneless-safe Angular pages; DateOnly / datetime2 column types. |
| DEC-44 | Template hardening: remove the Default tenant and default passwords, disable tenant user self-registration and role editing, replace the tenant dialog with a Farm code field, 4-hour JWT, stricter password and lockout settings, UTC clock with FarmProfile.TimeZone as the only farm time zone, Swagger in Development only. |
| DEC-45 | Spec follows the existing code where it is sound: permission names `Farm.*` / `System.*`; enums as integers with explicit fixed values; existing farm notification tables (with grouping); password policy with upper, lower, and digit; lockout 15 minutes. |
| DEC-46 | Step B details: pond prefixes store a fixed short code, pond names are prefix + number (not stored), existing pond codes kept; hatchery short codes fixed once a cycle uses them; existing permit categories renamed, presets not moved; size grades and recommendation drafts seeded; NumberSequence via MERGE with HOLDLOCK. |
| DEC-47 | Step C details: the batch entity keeps the code name PondBatch; existing cycles each get one Received delivery; old cycle and batch codes kept; Planned batches voided with their preparation converted to rounds; failed cycles become Active or Closed; Harvested and Failed batches take corrections until closed; Mark Harvested stays until step E. |
| DEC-48 | Step D details: feeding rounds become AM/PM sessions (before 12:00 farm time = AM; rounds merged; movements re-linked); treatments become chemical and supplement applications (type kept in the reason; pumping and exchange without a product become notes); mortality causes map to Disease / Water quality / Others with the old cause as text; lot cost = first receipt cost; old detail tables archived; Owner-only void with a saved reason; one alert and one dashboard row per pond per day; per-user drafts and remembered cycle/pond; ClientRequestId on preparation entries. |
| DEC-49 | Entry-triggered checks warn inline and in summaries and reports; notifications only for time-triggered events (permit expiry, operational alerts). Supersedes the water-quality and stock notification parts of DEC-12 and the Notifications row. |
| DEC-50 | Daily log completeness: feeding sessions can be marked Not fed; Daily log status view (daily records: AM, PM, water; event records: time since last log); Close Batch lists blank days; late entry has no cutoff. Revises DEC-34's "no row when not fed". Amended by DEC-66: histories always show the recorded time; entries must fall within the batch's life. |
| DEC-51 | Logs and feeding sessions dated after the batch's Total harvest date are rejected; salvage records of a Failed batch are exempt. |
| DEC-52 | Batch snapshots of farming system and construction type plus a stored density flag; density bands become host reference data by farming system and construction group. Refines DEC-17 and the density rule of DEC-35. Amended by DEC-65: bands per construction type; flag values Within, Below, Above. |
| DEC-53 | Growth sampling may record an estimated survival %; the latest estimate drives remaining population and biomass, otherwise logged mortality. |
| DEC-54 | One farm-wide daily feeding sheet grouped by pond; operations choose the pond first. Provisional: revisit after partner-farm feedback. |
| DEC-55 | Step E: optional sale transport details (including Local Transport Permit number), dead-at-harvest count, BFAR registration number on the dispatch receipt. |
| DEC-56 | Water ranges and density bands from PNS/BAFS 197:2025 as defaults (adviser to confirm the values †). Accepted 26 Oct 2026. |
| DEC-57 | Treatment record with dosage, withdrawal days and a computed safe harvest date; warning only, not a protocol (DEC-31 stands). Accepted; the banned-substance list was dropped (2026-10-26). |
| DEC-58 | Owner-editable Farm Standards: water ranges, density bands, † thresholds, stocking window; defaults shown with their source; changes apply forward only. Accepted; supersedes DEC-12's host-only ranges. |
| DEC-59 | PL health certificate and optional transport permit on the delivery; optional dead-at-stocking count on the batch. Accepted. |
| DEC-60 | Top-up stocking and several deliveries per batch. Rejected: one delivery and one stocking per pond (DEC-63). |
| DEC-61 | Feeding sessions per day. Waiting on the partner farm; AM/PM stays until then. |
| DEC-62 | Health test hints by DOC on the batch page, display only. Accepted. |
| DEC-63 | Stocking window (Farm Standards, default 1 day †) checked against the delivery's received date, never against today; newest-first delivery picker with older deliveries hidden; review names the delivery; Finish stocking records PL not stocked with a reason so the delivery adds up; no nursery transfers. |
| DEC-64 | The Owner reopens a Closed batch or cycle with a required reason (the cycle first); the cycle outcome, Completed or Failed, is confirmed at closing. Amends DEC-10 and DEC-47. |
| DEC-65 | Farming systems Extensive, Semi-intensive, Intensive; construction types Earthen, Concrete, HDPE-lined; density bands per farming system and construction type; a density between bands warns. Amends DEC-17 and DEC-52. |
| DEC-66 | Logs and feeding sessions must fall within the batch's life (not before stocking); histories always show the recorded time; no late badge. Amends DEC-50. |
| DEC-67 | Harvest and sales options: "Ungraded / mixed" size grade; buyer's accepted kg; not-sold entries; optional due date with Overdue; price editable after the sale. DEC-15 kept; reports label "margin over feed, chemicals and PL". |
| DEC-68 | Inventory and indicators: earliest-expiring lot pre-selected; item pack sizes; survival on stocking count with dead at stocking shown separately; whole delivery cost shared by stocking count; revenue on the buyer's accepted kg, FCR on farm kg; expired and negative stock warn. |
| DEC-69 | Batch log calendar on Batch detail (a day square per day from stocking to the end of culture; amber for nothing logged, green by 1 to 3 of AM, PM and water; event dots; Closed batches included). Amends DEC-50. Close Batch stays warning-only. |
| DEC-70 | Optional SFSC (Shrimp Fry Source Certification) number on the fry delivery; shown on the batch page, trace report and dispatch receipt; transport permit labelled DTP/LTP. Builds on DEC-59. |
| DEC-71 | Optional time of feeding ("HH:mm", farm time) on a Fed feeding session; AM/PM stays the key; DEC-61 unchanged. |
| DEC-72 | Read-only trace report per batch (fry source, feed and chemical lots, harvests, sales, transport, not-sold and unaccounted kg); Owner; reached from the Batch detail page. |

# **Appendix B. Manuscript alignment notes**

| Location | Change |
| :---- | :---- |
| 1.4 Definitions | Replace Production Cycle and Batch with the Core definitions in Section 1; add Fry delivery and Pond preparation round. RBAC: Farm Owner and Farm Technician, plus a System Administrator support account. |
| 1.1.2 Objective 2 | "...integrated with a transaction mechanism that records inventory movements." |
| 1.2 Scope | Pilot at the partner farm, with a second farm account for isolation testing. Digital logbooks: water quality, feeding (AM/PM), chemicals and supplements, growth sampling, mortality. |
| Table 6 Ref 2.2 | "Permits and Licenses: record, search, renew and archive permit records with expiry reminders." |
| Table 6 Ref 4.3 | Preparation is recorded on the pond; a pond must be Prepared before stocking. |
| Table 6 Refs 5.1–5.3 | Production is initialized from a fry delivery through a stepper that assigns batches to prepared ponds. |
| Table 6 Ref 5.5/5.6 | Close Batch locks the batch; Close Production Cycle locks the cycle. Remove "Log Post-Production Management". |
| Table 6 Ref 6.1, 6.4, 6.5 | AM/PM feeding; Chemical and Supplement Application; mortality causes Disease / Water quality / Others. |
| Table 6 Ref 7.3 | "...generates a dispatch receipt (internal document)." Financial ledger removed. |
| Table 6 Ref 5.4 | Remove Production Protocol Configuration; note that monitoring frequencies are shown as GAqP guidance and feeding/sampling are decided daily by staff. |
| Table 4 numbering | Renumber the duplicate Table 4. |
| Alerts (dashboard and logbook use cases) | Out-of-range water readings and high mortality are shown as inline warnings with recommendations and in dashboard summaries and reports; notifications cover permit expiry and operational alerts (DEC-49). |
| Table 6 Ref 6.1 | Feeding sessions can be marked Not fed; one farm-wide daily feeding sheet (DEC-50, DEC-54). |
| Table 6 Refs 5.1–5.3 | Add: a delivery is closed with Finish stocking, which records PL not stocked; stocking dates are checked against the delivery's received date (DEC-63). |
| Table 6 Ref 5.5/5.6 | Add: the Owner can reopen a closed batch or cycle with a reason; a cycle closes as Completed or Failed (DEC-64). |
| Water-quality table (3.1.2.4) | Cite PNS/BAFS 197:2025 (replaces 197:2017) and note that the farm can adjust ranges in Farm Standards (DEC-56, DEC-58). |
| Farming systems | Extensive, semi-intensive, and intensive only; stocking density per PNS/BAFS 197:2025 Annex C (DEC-65). |
| Table 6 Ref 6.4 | Chemical application records dosage and withdrawal period; a harvest before the safe date warns (DEC-57). |

# **Appendix C. Mapping from earlier decision IDs**

| Earlier IDs | New ID |
| :---- | :---- |
| D-01 | DEC-01 |
| D-02 | DEC-02 |
| D-03 | DEC-03 |
| D-04, D-28 | DEC-04 (code name stays Capstone) |
| D-05 | DEC-05 |
| D-07, D-16 | DEC-06 |
| D-29 | DEC-07 |
| D-13, D-34 | DEC-08, DEC-11 |
| D-33 | DEC-09 |
| D-08 | DEC-10 |
| D-09, D-35 (recommendations) | DEC-12 |
| D-11, D-35 | DEC-13 |
| D-10 | DEC-14 |
| D-14, D-19, D-39 | DEC-15 |
| D-18 | DEC-16 |
| D-32, D-36 | DEC-17 |
| D-06, D-15, D-30, D-38 | DEC-18 |
| D-31 | DEC-19 |
| D-37 (ponds first, naming) | DEC-20 |
| D-20 | DEC-21 |
| D-21 | DEC-22 |
| D-22 | DEC-23 |
| D-23 | DEC-24 |
| D-24 | DEC-25 |
| D-25 | DEC-26 |
| D-26 | DEC-27 |
| D-27 | DEC-28 |
| D-12, D-17 | DEC-29 |

# **Appendix D. Terminology and use-case alignment**

Use-case names from the manuscript's use-case diagram, matched to this specification. Where the panel changed behavior, the manuscript's use case should be renamed (right column).

| Manuscript use case | Term in this specification | Manuscript change needed |
| :---- | :---- | :---- |
| Manage Resources Information → Define Resources | Hatchery (profiles) and Feed and Additives screens under Farm Management | None |
| Log Fries | Fry Deliveries (Log Fries) under each hatchery: batch number, PL age, PL received, status history | Note that each fry delivery starts one production cycle |
| Log Feed and Additives | Feed and Additives: items, lots, receipts, adjustments | None |
| Manage Production Cycle | Production Cycles | None |
| Manage Ponds | Ponds (set up first, under Farm Management) | Move outside Manage Production Cycle; ponds are a prerequisite (R-02) |
| Log Pond Preparations | Log Pond Preparations on the pond (free-text entries), then Mark Prepared | Preparation is on the pond, before any batch |
| Manage Batches | Batches within a production cycle | None |
| Create Batch (Stocking) | Create Batch (Stocking) stepper; the first creation initializes the cycle | Add: select fry delivery and Prepared ponds; review step |
| Log Pre-Stocking Water Quality | Pre-stocking water quality inside the stepper | None |
| Configure Batch Production Protocol (Set Feeding Schedule, Set Sampling Schedule, Set Day of Culture Milestone, Set Water Quality Parameters and Log Schedule) | Not included (DEC-31). GAqP monitoring frequency is shown as guidance beside each water-quality field; feeding and sampling are judged daily by farm staff and simply logged | Remove these use cases from the diagram and Ref 5.4 from Table 6 |
| Close Batch | Close Batch | None |
| Manage Operations | Operations (daily logs; choose cycle, then pond) | None |
| Log Feeding | Log Feeding (AM/PM with kg and lot) | Feeding is recorded as AM and PM sessions |
| Log Water Quality | Log Water Quality with flags and recommendations | None |
| Log Growth Sampling | Log Growth Sampling | None |
| Log Intervention | Log Chemical and Supplement Application | Rename; intervention removed by the panel (R-33) |
| Log Mortality | Log Mortality (Disease, Water quality, Others) | None |
| Manage Harvest Logs → Log Harvest | Log Harvest, opened from the batch | None |
| Partial Harvest / Total Harvest | Harvest type Partial / Total | None |
| Declare Batch Failure → Update Batch Status to Failed | Declare Batch Failure | None |
| Register Buyers | Register Buyers (Individual or Company) | None |
| Log Harvest Sales | Log Harvest Sales; Sales History | None |
| Generate Dispatch Receipt | Dispatch receipt (printable, internal) | None |
| Close Production Cycle → Log Post-Production Management | Close Production Cycle only (DEC-32) | Remove Log Post-Production Management |
| Generate Production Report | Generate Production Report (named reports with cards, sorting, filters) | None |
| (not in diagram) | Permits and Licenses, Staff accounts, Farm Profile and Settings, System Administration | Covered by other use-case diagrams or to be added |

