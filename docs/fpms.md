> **Superseded.** This document (fpms.md v1.x) and its D-01 to D-39 decisions are replaced by [Capstone-Planning.md](Capstone-Planning.md) v2.3 (DEC-01 to DEC-44; ID mapping in its Appendix C). Kept for history only.

# **Farm Production Management System**

*Six planning documents before implementation*

A capstone-ready product and build specification for a farm-specific web application supporting whiteleg shrimp (Penaeus vannamei) production operations in the Sarangani Province and General Santos City study context.

Version 1.4 aligns the planning documents with the Capstone 1 manuscript (Objectives 1.1, Scope 1.2, Definition of Terms 1.4, Tables 3–6). Phase 1 (capstone scope) is a Local On-Premise MVP: one deployment on the partner farm's local network, built on the ASP.NET Boilerplate v10.2.0 startup template (ASP.NET Core on .NET 9 with an Angular 19.2.1 client using abp-ng2-module) and SQL Server. The data model is SaaS-ready from day one: every farm-owned record carries a FarmId (implemented as the framework's TenantId), so the Phase 2 move to a multi-tenant cloud SaaS does not require a rewrite. Production follows the manuscript's structure: a Production Cycle groups Pond Batches, and all daily logs attach to a pond batch. Every feature is traced to its manuscript Table 6 number (for example "Ref 5.2"). Version 1.5 resolves all site and operations items (decisions D-21 to D-27); defaults chosen for v1.4 remain listed in Appendix A for confirmation. Version 1.6 (22 Oct 2026) revises the farm profile, pond and compliance rules after an interface review: compliance records are tracked by reference number and dates without files or approval, and a missing permit never blocks production (decisions D-30 to D-32).

# **Contents**

1\. Product Requirements Document

2\. Technical Requirements Document

3\. App Flow

4\. UI and UX Design Brief

5\. Backend Schema

6\. Implementation Plan

Appendix A. Decision log, defaults to confirm, and unresolved items

Appendix B. Manuscript alignment notes

Appendix C. Revision history

# **1\. Product Requirements Document**

Purpose: Define the product behavior, its intended users, the release phases, and how the capstone team will evaluate completion.

## **Product and problem**

Product name: Farm Production Management System (FPMS).

One-sentence idea: An on-premise farm production management web application for whiteleg shrimp (P. vannamei) aquaculture that helps a farm record and review farm compliance, pond and resource master data, production cycles and pond batches, daily logbooks from pond preparation to harvest, harvest sales, inventory and financial transactions, and performance reports in one farm account, built on a SaaS-ready multi-tenant data architecture.

Manuscript objectives covered:

* Objective 1 (role-based platform for farm resources, compliance documentation, and operational records): accounts and roles, farm profile, compliance documents, ponds, hatchery sources, inventory, dashboard, reports.
* Objective 2 (end-to-end production cycle workflows integrated with a transaction mechanism): production cycles, pond batches, daily logbooks, harvest and sales, plus a transaction mechanism that records both inventory movements and financial records (decision D-14).
* Objective 3 (structured functional testing): acceptance criteria and functional test checkpoints in Sections 1 and 6.

Problem and current workaround: Production information can be distributed across paper logbooks, spreadsheets, and individual notes, making it harder to retrieve a cycle history, review day-to-day records, compute performance indicators, and keep permits current. The system will provide a structured digital record. This is the product rationale; the frequency and impact of the current workaround should be confirmed with study participants rather than treated as measured evidence.

Deployment context: Phase 1 runs on a local-network server at the primary partner farm. Users need access to the farm LAN, not the Internet. Cloud SaaS hosting for multiple farms is Phase 2 (see Release phases and roadmap).

## **Users and roles**

| Role | Level | Purpose |
| :---- | :---- | :---- |
| Farm Owner | Farm (tenant) | Full access within the farm: farm profile, user accounts, compliance documents, ponds, resources, production cycles and batches, sales, transactions, and reports. A farm may have several Owners. |
| Farm Technician | Farm (tenant) | Records daily operations: logbooks, growth sampling, mortality, and harvest measurements for the farm's batches. Cannot manage accounts, master data, sales, finances, or reports. |
| System Administrator | System (host) | A technical support account held by the development team. Installs and maintains the system, manages farm accounts and system reference data, and performs account recovery. It is not an end-user role and has no access to farm production, sales, or financial records (decision D-16). |

## **Goal and success measures**

| Goal | Measure for capstone evaluation |
| :---- | :---- |
| Maintain a coherent, traceable production record | Functional test cases pass for registration, farm setup, compliance, resources, cycle and batch lifecycle, daily logbooks, harvest and sales, transactions, and reports; each Key Data Element in manuscript Table 5 that is in P1 scope can be entered and retrieved. |
| Prevent cross-farm exposure | With at least two test farms in the same database, authorization tests show a user cannot read or change records outside the farm their account belongs to, and the System Administrator cannot read farm production records. |
| Flag unsafe water quality | Readings inside, on the boundary of, and outside each GAqP optimal range produce the correct in-range or out-of-range flag. |
| Compute performance indicators correctly | Stocking density, DOC, ABW, estimated population and biomass, FCR, and survival rate match hand-calculated values for a reference test batch. |
| Keep inventory and financial records consistent | Stock on hand equals receipts minus usage plus adjustments for every lot; sales totals equal the generated income transactions. |
| Support usable data entry and retrieval | Representative owner and technician tasks can be completed in structured functional testing; record task outcomes and defects. |
| Meet proposed local performance expectations | Measure selected API requests and dashboard/report loads under an agreed local test dataset; compare with targets in the TRD. |

Evaluation method: structured functional testing. All P1 acceptance and farm-isolation tests must pass, with no open critical/high-severity defects; record lower-severity failures and limitations. Record test scenarios, expected results, data, pass/fail outcomes, and defects. Performance measurements must document dataset and concurrency.

## **Feature scope (traced to manuscript Table 6)**

P1 features must ship for the capstone. P2 features are built only if time allows after all P1 acceptance tests pass; they add to P1 without changing its data model. "Ref" is the manuscript Table 6 feature number.

| Ref | Feature | Priority | Phase 1 scope |
| :---- | :---- | :---- | :---- |
| 1.1 | Farm Account Registration | P1 | Farm name, location, contact details, and initial Farm Owner credentials; unique farm code; optional onboarding compliance documents. Registration can be enabled or disabled by the System Administrator. |
| 1.2 | User Authentication | P1 | Sign-in/sign-out with username or email and password; JWT bearer tokens; forced password change for new accounts; lockout after repeated failures. |
| 1.3 | Technician Account Management | P1 | Owners create, update, deactivate, and reset Farm Owner and Farm Technician accounts; activity is visible through the farm activity log (Ref 9.1). |
| 2.1 | Farm Profile Management | P1 | Farm name, structured address (line 1, line 2, city/municipality, province, postal code, country), total farm area in hectares, contact details, time zone, and document alert window; a Ponds tab summarizing pond specifications (D-31). |
| 2.2 | Document Certification Management | P1 (farm-level); P2 (batch-level) | Record, categorize, filter, view, renew, and archive farm-level compliance records (category, preset title, reference number, issuing agency, issue date, expiry date or perpetual, notes/location) with computed expiry status and in-app renewal reminders. No file storage and no approval step (D-30). Batch-level document attachments are P2. |
| 3.1 | Hatchery Source Management | P1 | Hatchery registry with contact details, BFAR accreditation/inspection status, and health certificate number and expiry; linked to cycles and batch stocking. Certificate file attachments are P2. |
| 3.2 | Feed Inventory Management | P1 | Feed items (brand, feed type, BAI registration number), lots, receipts, usage from feeding logs, adjustments, and quantity on hand. |
| 3.3 | Feed Additives and Supplements Management | P1 | Same inventory model for probiotics, vitamins, immunostimulants, lime, chlorine, and other chemicals; usage from treatment and pond preparation logs. |
| 4.1 | Pond Configuration Management | P1 | Manuscript Table 3 pond master data (Section 5). |
| 4.2 | Pond Status Tracking | P1 | Pond status (derived from batches plus manual maintenance/inactive status) with a status and modification history. |
| 4.3 | Pond Preparation Logging | P1 | Draining date, drying duration, lime and chlorine application (from inventory), filling date, water source mixing ratio, linked to the planned batch. |
| 5.1 | Production Cycle Initialization | P1 | Cycle code, planned start/end dates, target production volume, objectives, and hatchery source. At activation (first batch stocked) the system checks required permits and shows a reminder when any has no current record; it never blocks (decision D-30, replacing D-15). |
| 5.2 | Batch Creation and Stocking Management | P1 | Pond batches within a cycle: stocking date and time, PL count, PL age, batch/lot number, acclimation duration, initial survival estimate, and computed stocking density. |
| 5.3 | Pre-Stocking Water Quality Recording | P1 | Baseline temperature, salinity, pH, and DO captured as part of stocking. |
| 5.4 | Production Protocol Configuration | P2 | Feeding, sampling, and water-quality schedules and the dashboard's "today's scheduled tasks". P1 shows the GAqP monitoring frequency as guidance only. |
| 5.5 | Batch Closure | P1 | Closes a harvested or failed batch, computes final FCR, survival rate, and ABW, and makes its records read-only. |
| 5.6 | Production Cycle Closure | P1 | Closes a cycle after all its batches are closed and post-production activities are logged; produces the cycle summary. |
| 6.1 | Feeding Operations Logging | P1 | Feed lot, quantity per feeding (kg), feeding time, method, tray observation, and adjustment notes; cumulative feed per batch; deducts inventory. |
| 6.2 | Water Quality Logging | P1 | DO, temperature, pH, salinity, TAN, nitrite, nitrate, and alkalinity; out-of-range values flagged against GAqP optimal ranges. |
| 6.3 | Growth Sampling | P1 | Sampling date, sample size, total sample weight, computed ABW, and growth rate since the previous sample. Growth-curve charts are P2. |
| 6.4 | Health Intervention Logging | P1 | Intervention type, reason, product (from inventory), dosage, and outcome; covers the manuscript's "Chemical and Supplements" logbook. |
| 6.5 | Mortality Event Recording | P1 | Mortality count, suspected cause, suspected disease, observed symptoms; adjusts the estimated population. |
| 7.1 | Harvest Recording | P1 | Harvest date, partial or final, total volume (kg), number of boxes, ABW, size grading lines, and optional quality assessment checks (smooth shell, intact appendages, no necrosis). |
| 7.2 | Buyer Information Management | P1 | Buyer registry with company name, contact person, phone, and address; linked to sales. |
| 7.3 | Harvest Sales Documentation | P1 | Buyer, sale date, quantity (kg) and price per kg per size grade (prices entered manually), total, payment terms and status; printable sales record; generates an income transaction. Automatic "Base 10" price calculation is P2. |
| 7.4 | Production Cycle Failure Declaration | P1 | Declare a batch or a whole cycle failed with reason, date, and estimated loss; printable failure report to support an insurance or compensation claim. Integration with insurance processes is out of scope. |
| 8.1 | Production Cycle Performance Report | P1 (tables); P2 (charts) | Stocking details, feed consumption, FCR, water-quality summary (weekly averages and out-of-range counts), growth table, harvest outcomes, and financial performance. Trend and growth charts are P2. |
| 8.2 | Harvest Summary Report | P1 | Batch- and cycle-level harvest volume, ABW and size distribution, survival rate, and buyer allocation. |
| 9.1 | Audit Trail and Activity Logging | P1 | Framework audit logging of user actions, sign-in attempts, and data changes; farm activity log for Owners; security events for the System Administrator. |
| 9.2 | Dashboard | P1 | Role-specific dashboard with active cycles and batches, alerts (water quality, documents, low or negative stock), and KPIs (current ABW, FCR to date, estimated survival). "Today's scheduled tasks" depends on Ref 5.4 (P2). |
| — | Financial transactions (Objective 2) | P1 | Farm expense and income ledger with configurable categories; income generated from sales; optional expense generated from inventory receipts. |
| Table 5 | Biosecurity and operational continuity logs | P2 | Visitor logs, disinfection records, aerator runtime hours, power interruptions, water exchange. In P1 these can be recorded as general notes or treatment logs. |

## **Release phases and roadmap**

| Phase | Scope |
| :---- | :---- |
| Now: Phase 1, capstone (Local MVP) | All P1 features above; local on-premise deployment at the partner farm; JWT authentication; FarmId (TenantId) partitioning on all farm data; compliance records tracked by reference number and dates (no file storage, D-30). P2 features only if time allows. |
| Next / Later: Phase 2, SaaS (future work) | Remaining P2 features; cloud SaaS migration (Azure or AWS); multi-tenant onboarding with farm resolution by subdomain; cloud Blob Storage if file attachments are reintroduced; offline capture with automated sync; email/SMS reminders; runtime/framework upgrade (decision D-05). |
| Not planned | Hardware/IoT sensor integration; automated feeding or pond control; cloud auto-scaling during Capstone 1 and 2; predictive analytics; species other than P. vannamei. |

## **Out of scope for version one**

* Centralized owner dashboard for switching among or comparing multiple Farm Accounts. Each farm is registered and accessed as its own farm context.
* Technician self-registration, or any account that belongs to more than one farm.
* External users such as BFAR or third-party auditors (manuscript Limitations), regional managers, native mobile apps, IoT sensor integration, automated feeding/control, predictive analytics, and public-facing portals.
* Species other than Penaeus vannamei.
* Cloud hosting, multi-tenant SaaS onboarding, subdomain-based farm resolution, offline sync, and email or SMS notifications (all Phase 2).
* External payment processing, BIR-registered official receipts or invoices, insurance-claim processing, and external government system integration. The printable sales record is an internal document, not an official receipt.
* Integration with the partner organization's Shrimp.io decentralized application; FPMS is a separate, standalone system with a centralized database.
* Claims that a report is an officially accepted BFAR submission format until the format and approval basis are confirmed.

## **User stories**

| ID | Story |
| :---- | :---- |
| US-01 | As a prospective Farm Owner, I want to register a farm account and enter farm details so that I can establish a farm-specific workspace. |
| US-02 | As a Farm Owner, I want to create and deactivate Farm Owner and Farm Technician accounts so that authorized people can manage and record operations. |
| US-03 | As a Farm Owner, I want to record my permits with their reference numbers, issuing agencies, expiry dates, and where the hard copy is kept, and be reminded before they expire, so that permits stay current. |
| US-04 | As a Farm Owner, I want to maintain pond master data and pond status so that batches are stocked into known, available ponds. |
| US-05 | As a Farm Owner, I want to maintain hatchery sources, buyers, and feed and supplement inventory so that stocking, feeding, treatments, and sales are traceable. |
| US-06 | As a Farm Owner, I want to create a production cycle with its hatchery source and plan pond batches so that each pond's crop is a defined, traceable record. |
| US-07 | As a Farm Owner or Farm Technician, I want to record pond preparation and stock a batch with its PL details and baseline water quality so that the batch has a complete starting record. |
| US-08 | As a Farm Technician, I want to record feeding, water quality, growth sampling, treatments, and mortality for a batch, and see out-of-range readings, so that daily production history is captured and problems are visible. |
| US-09 | As a Farm Owner or Farm Technician, I want to record harvests with grading and quality checks so that harvest outcomes are documented. |
| US-10 | As a Farm Owner, I want to record sales to buyers per size grade and track payment so that revenue is documented and income is recorded automatically. |
| US-11 | As a Farm Owner, I want to declare a batch or cycle failed with a reason and estimated loss so that crop losses are documented. |
| US-12 | As a Farm Owner, I want to close batches and cycles so that final FCR and survival rate are computed and records become read-only. |
| US-13 | As a Farm Owner, I want to record farm expenses and income and see stock on hand so that I can track operating costs. |
| US-14 | As a Farm Owner, I want cycle performance and harvest summary reports so that I can review production outcomes. |
| US-15 | As a user, I want validation and clear error feedback so that I can correct incomplete or invalid records. |
| US-16 | As the System Administrator, I want to unlock or reset a Farm Owner's password and manage system reference data without seeing farm production records, so that the farm can recover access safely. |

## **Acceptance criteria**

| ID | Given / When / Then |
| :---- | :---- |
| AC-01 | Given registration is enabled and valid owner credentials and farm details are entered, when registration is submitted, then the system creates the Farm Account (tenant), farm profile, farm roles, default categories, and initial Farm Owner in one transaction and opens the farm dashboard; if any step fails, nothing is created. |
| AC-02 | Given an Owner in a farm account, when they create a Farm Owner or Farm Technician account, then the account belongs only to that farm, has the selected role, must change its temporary password at first sign-in, and cannot access another farm's records. |
| AC-03 | Given an Owner saves a compliance record with a category, preset or custom title, reference number, and an expiry date or "Perpetual / No expiry date", then it is stored for that farm only and appears in the list with its expiry status. Perpetual is refused when the category requires an expiry date; an expiry date before the issue date, an issue date in the future, or a reference number already used by a current record in the same category is refused. A record within the farm's alert window (default 30 days) shows Expiring soon and appears as a dashboard reminder; a record past its expiry date shows Expired. Renewing a record archives the earlier one, which then sends no reminders. No file is uploaded or stored. |
| AC-04 | Given a registered farm, when the Owner saves a pond with the required master data, then it appears in pond management with status Available and its changes are recorded in the pond history. |
| AC-05 | Given hatchery sources and inventory items exist, when the Owner records a stock receipt for a lot, then the lot's quantity on hand increases, and if a unit cost is entered an expense transaction is generated. |
| AC-06 | Given an active hatchery source, when the Owner creates a production cycle with planned dates, target volume, and hatchery source, then a Planned cycle is created. |
| AC-07 | Given a Planned or Active cycle and a grow-out pond with no open batch, when the Owner plans a batch with planned stocking date and planned PL count, then a Planned batch is created; ponds that already have a batch that is not Closed cannot be selected. |
| AC-08 | Given a Planned batch, when an authorized user stocks it with stocking date and time, PL count > 0, PL age, lot number, acclimation duration, and baseline temperature, salinity, pH, and DO, then the batch becomes Stocked, stocking density is computed, the hatchery certification status is recorded on the batch, and the cycle becomes Active if it was Planned. |
| AC-09 | Given required permits have no current record, when the first batch of a cycle is stocked (cycle activation) by an Owner or a Technician, then stocking succeeds and the result lists the missing permits as a reminder. Nothing is blocked and no override is recorded (D-30). |
| AC-10 | Given a batch whose status allows the log type, when an authorized user submits a valid log, then it is stored with batch/pond context, timestamp, and recorder; a resubmission after a network retry does not create a duplicate. |
| AC-11 | Given a valid water-quality reading outside its GAqP optimal range, when saved, then it is stored, marked out of range, and shown as an alert in log history and on the dashboard. |
| AC-12 | Given a feeding or treatment log that uses an inventory lot, when saved, then a usage movement reduces that lot's quantity on hand; if the usage exceeds stock on hand, the user is warned, the entry is saved, and the lot is flagged for reconciliation. |
| AC-13 | Given growth sampling with sample count and total sample weight, when saved, then ABW and growth since the previous sample are computed and shown; given a mortality log, the estimated population decreases by the count. |
| AC-14 | Given a Stocked batch, when a harvest is saved with grading lines and quality checks, then it is linked to the batch and included in reports; after a Final harvest the Owner can mark the batch Harvested. |
| AC-15 | Given a harvest and an active buyer, when the Owner records a sale with grade lines (kg and price per kg), then the total is computed, sold quantity cannot exceed the harvest's unsold quantity, an income transaction is generated, and a printable sales record is available. |
| AC-16 | Given a Stocked batch or an Active cycle, when the Owner declares failure with reason, date, and estimated loss, then the batch (or every open batch of the cycle) becomes Failed and a printable failure report is available. |
| AC-17 | Given a Harvested or Failed batch, when the Owner closes it after confirmation, then final FCR, survival rate, ABW, and cycle duration are computed and stored, its logs and harvests become read-only for all roles, and the pond becomes available. Sales payments and transactions can still be recorded. |
| AC-18 | Given all batches of a cycle are Closed, when the Owner closes the cycle, then the cycle becomes Closed and its summary report is final. A cycle with open batches cannot be closed. |
| AC-19 | Given report filters for the farm and a date, cycle, or batch range, when a report is requested, then only matching records of that farm are returned using Asia/Manila calendar-day boundaries, and computed indicators match the formulas in Section 5. |
| AC-20 | Given missing, invalid, or physically impossible input (for example pH above 14 or a negative quantity), when submitted, then no record is committed and field-level feedback is displayed. |
| AC-21 | Given a user requests a record that belongs to another farm, when the API evaluates the request, then access is denied and no record data is disclosed. |
| AC-22 | Given the System Administrator is signed in, when they unlock or reset a Farm Owner's password, then the Owner must change the password at next sign-in and the action is audit-logged; requests for any farm production, sales, or financial data are denied. |

## **Open questions**

* Site, connectivity, account custody, retention, performance, and pilot-scope questions are resolved in Appendix A (decisions D-21 to D-27).
* Confirm the defaults listed in Appendix A ("Defaults to confirm") and the retention periods in D-25 with the adviser or partner farm.

# **2\. Technical Requirements Document**

Purpose: Record the selected ASP.NET Boilerplate v10.2.0 Angular \+ ASP.NET Core startup template, the Local MVP deployment, the SaaS-ready tenancy model, and the security checks required before build.

| Area | Requirement / status |
| :---- | :---- |
| Platform | Responsive web application; desktop/tablet browsers are the primary use context. |
| Frontend and runtime | Angular 19.2.1 client from the ASP.NET Boilerplate v10.2.0 startup template, using abp-ng2-module. Record the exact Angular, Node, and npm versions from the template's package.json and lockfile in the README. localhost:4200 is development-only; in production the built Angular app is served from the farm server. |
| Backend | ASP.NET Core Web API on .NET 9 from the ASP.NET Boilerplate v10.2.0 startup template. This is the open-source classic ASP.NET Boilerplate, which is different from the commercial ASP.NET Zero product and from the modern ABP Framework at abp.io. Layered solution: Core, Application, EntityFrameworkCore, Web.Core, Web.Host, Migrator, and Tests. Support status: ASP.NET Boilerplate support ended in May 2026 and .NET 9 support ends on 10 November 2026; accepted as a capstone risk (decision D-05). |
| Data access / database | EF Core version supplied by the template, with SQL Server. Single database, shared schema, with farm isolation by TenantId. Development database: SQL Server in Docker via OrbStack (decision D-03); pin the image tag and confirm it runs on every team machine (Apple Silicon Macs run the SQL Server image under x86-64 emulation). |
| Multi-tenancy (SaaS readiness) | Each farm is one tenant. All farm-owned entities implement IMustHaveTenant (a TenantId column, called FarmId in this document). The framework's automatic data filter applies WHERE TenantId \= @CurrentFarmId to every query and stamps new records with the current farm. The System Administrator is a host-level user (no TenantId). Phase 1 deploys this for the partner farm; Phase 2 serves many farms from the same schema. |
| Computed indicators | Stocking density, DOC, ABW, estimated population and biomass, FCR, and survival rate are computed in the Application layer from source records using the formulas in Section 5. Live values are computed at read time; final values are stored when a batch is closed. |
| Inventory | Stock is a ledger of movements (receipt, usage, adjustment) per lot; quantity on hand is the sum of movements. Usage movements are created by feeding, treatment, and pond-preparation logs inside the same database transaction as the log. |
| Document storage | None. Compliance records are database rows tracked by reference number, category, and dates (D-30); the hard copy's location is kept in the record's notes. The earlier IFileStorageService and upload/download endpoint were removed. |
| Notifications | In-app only in Phase 1: dashboard alerts and a notification list for document expiry, water-quality alerts, and low or negative stock. No email or SMS because Internet access is not assumed. |
| Printing | Reports, sales records, and failure reports use print-friendly pages (browser print to paper or PDF). No server-side PDF generation is required. |
| Deployment | Phase 1: on-premise Kestrel hosting on a dedicated farm-office PC (8–16 GB RAM, SSD, Windows 11 Pro or Ubuntu LTS) on a UPS, with SQL Server Express. LAN only with a fixed local IP and no Internet exposure; HTTPS with a certificate from the team's local certificate authority installed on farm devices (decision D-21). |
| Time zone | Store timestamps in UTC (framework clock set to UTC). Display times and compute calendar-day boundaries and DOC in the farm time zone, default Asia/Manila (UTC+08:00, no daylight saving). The time zone is stored on the farm profile for SaaS readiness. |
| Region | Local execution context in General Santos City / Sarangani Province; no cloud region in Phase 1\. |
| External services | No third-party API is required by the core workflow. Internal JSON REST API with OpenAPI/Swagger in development. Credentials are owned by the capstone team and must not be committed to source control. |

## **Authentication and roles**

Farm roles in version one: Farm Owner and Farm Technician, created as static roles in every farm. Every farm user account belongs to exactly one farm. Farm registration creates the initial Farm Owner. Any Farm Owner can create additional Farm Owner and Farm Technician accounts within their own farm; Technicians cannot create accounts. A farm may have multiple Farm Owners. A person managing another farm uses a separate account in that farm. The UI opens one farm context at a time; there is no centralized multi-farm dashboard or farm switcher.

System Administrator (decision D-16): the template's host-level administrator is renamed and scoped as the System Administrator. It is held by the development team and used for installation, database migration, enabling or disabling farm registration, activating or deactivating farm accounts, maintaining system reference data (water-quality parameters and units), reviewing security and error logs, backups, and account recovery (unlocking a Farm Owner or issuing a temporary password). Its screens and API permissions exclude farm production, inventory, sales, financial, and compliance-document records, and it cannot sign in to a farm. Every recovery action is audit-logged. Developers have no personal accounts in the production system; development and testing use seeded test farms only.

Credential handling: store only salted, computationally strong password hashes produced by ASP.NET Core Identity's password hasher, as configured by the template. Plaintext password storage and custom overrides that disable standard hashing are rejected. Never log or return passwords. A new or reset account gets a temporary password and must change it at first sign-in. Email-based reset is not required in Phase 1, because Internet and email access are not assumed; a Farm Owner resets Technician and Owner accounts in the farm, and the System Administrator is the recovery path when no Owner can sign in. Use the template's lockout settings for repeated failed sign-ins.

Authentication (decision D-02): all API endpoints use JWT Bearer tokens. The client signs in through the template's TokenAuth endpoint and receives an access token; the Angular client attaches it as an Authorization: Bearer header on every API call through abp-ng2-module. The server does not accept cookie-based sessions. Set and document the token lifetime, keep the signing key in configuration outside source control, and serve all traffic over HTTPS on the LAN. Keep the template's generated antiforgery configuration unchanged and do not add a cookie authentication scheme.

## **Architecture and data flow**

**1\.** The Angular client, using abp-ng2-module, presents farm screens and sends validated API requests with the Bearer token over the farm local network.

**2\.** The ASP.NET Core Web.Host project validates the JWT, resolves the current farm (tenant) or host context from the token, checks role permissions, and passes the request to application services that apply business rules.

**3\.** Follow the layered solution: Core contains domain entities, lifecycle rules, and indicator formulas; Application contains use cases/application services; Web.Core contains web-facing shared components; Web.Host is the ASP.NET Core host. Keep controllers transport-facing and organize features by manuscript subject area; DDD beyond the template structure is not a panel-approved requirement.

**4\.** The framework's tenant data filter scopes every query to the current farm. Services never treat a client-supplied FarmId as authority.

**5\.** A log that consumes inventory, a sale that generates income, and a receipt that generates an expense are each saved in one database transaction with their generated records.

**6\.** EntityFrameworkCore contains EF Core persistence and migrations for SQL Server; Migrator applies reviewed database migrations. Include the template's test project and add structured functional tests for capstone acceptance.

**7\.** The API accepts no file uploads; compliance records are metadata only (D-30).

**8\.** Reports query authorized farm data through backend services; the Angular frontend never accesses SQL Server directly.

## **Security and privacy**

| Control area | Minimum design requirement |
| :---- | :---- |
| Farm boundary | Every farm-owned entity has a TenantId (FarmId) column directly. The farm is derived from the authenticated token, never from a client-supplied FarmId. Keep the tenant data filter enabled; disable it only in reviewed host-level maintenance code. Test with at least two farms. |
| Role permissions | Follow the permission matrix in Section 5. Technicians cannot delete records and cannot manage users, master data, cycle or batch status, sales, transactions, compliance documents, or reports. The System Administrator cannot read farm production, inventory, sales, financial, or document records. |
| Validation | Validate at both API and database layers: required values, physical limits, lengths, date ordering, same-farm foreign keys, allowed status transitions, Closed read-only rules, and sold quantity not exceeding harvested quantity. GAqP optimal ranges flag readings but do not block them; stock shortfalls warn but do not block. |
| Credentials and secrets | Use framework password hashing, least privilege, secret configuration outside source control (JWT signing key, connection strings, System Administrator initial password), and generic sign-in failure messages. |
| Documents | No files are uploaded or stored (D-30). Compliance records are ordinary farm-owned rows protected by the farm boundary and the Owner-only Farm.Compliance permission. |
| Audit and errors | Use the framework audit log for user actions, sign-in attempts, and data changes. Farm Owners see their farm's activity log; the System Administrator sees security and system events without farm record contents. Do not log credentials or sensitive payloads. |
| Privacy and retention | Production, inventory, financial/transactional, buyer, profile, account, and compliance data are sensitive operational information. Retention per decision D-25: financial records at least 5 years; compliance documents while valid plus 5 years after expiry; production records for the life of the system; user accounts deactivated rather than deleted, keeping only necessary personal data (Data Privacy Act of 2012). |

## **Performance, reliability, environments, and delivery**

| Topic | Target / decision |
| :---- | :---- |
| API response | Approved target: p95 under 500 ms for ordinary local API reads/writes over the LAN, measured with the D-26 dataset (one farm, 2 years, 10 ponds, 20 batches, about 30,000 log entries) and 5 concurrent users. Exclude large reports; record test conditions and results. |
| Availability | No production uptime SLA is claimed for the capstone. Demonstrate restart/recovery behavior and document observed availability during structured testing. |
| Backups | Automated daily SQL Server backup to an external drive (database only; no file storage since D-30); a weekly encrypted copy kept off-site by the Farm Owner; restore demonstrated before release (decision D-22). Retention follows decision D-25. Container volume snapshots are supplementary only. |
| Development | Local macOS workstations, VS Code, SQL Server in Docker via OrbStack, and Git with feature branches. Feature-Driven Development (FDD) per the manuscript methodology: one feature set per branch, reviewed before merge. |
| Staging | Local/on-premise deployment for UAT with partner-farm representatives, contingent on access and consent. |
| Production | Phase 1: on-premise deployment on the partner farm's local network. Keep secrets and production data separate from development. |
| Delivery | Manual package delivery with structured functional testing is the supplied CI/CD constraint. Automated build checks may be added if course/team constraints allow; no CI platform is selected. |

## **Key technical decisions and tradeoffs**

| Choice | Reason / tradeoff | Status |
| :---- | :---- | :---- |
| ASP.NET Boilerplate v10.2.0 startup template (.NET 9, Angular 19.2.1, abp-ng2-module) | Provides the layered solution, JWT authentication, multi-tenancy, role permissions, and audit logging out of the box. Framework support ended May 2026 and .NET 9 support ends 10 Nov 2026; accepted for the capstone, with an upgrade path in Phase 2\. | Selected (D-04, D-05) |
| Local On-Premise MVP with SaaS-ready tenancy | Fits the partner farm's LAN-only operation. FarmId (TenantId) on all data avoids a rewrite for SaaS. The team is responsible for device security, TLS, backups, updates, and physical access. | Accepted (D-01) |
| Production Cycle → Pond Batch → logs | Matches the manuscript definitions; daily data and performance indicators are per pond; a cycle groups batches from one fry source. | Accepted (D-13) |
| Inventory as a movement ledger | Quantity on hand is always explainable from receipts, usage, and adjustments; supports lot traceability. | Accepted (D-14, D-19) |
| JWT Bearer authentication | Stateless API authentication supplied by the template; same model works for a future cloud deployment. Token handling and HTTPS must be configured correctly. | Accepted (D-02) |
| SQL Server in Docker/OrbStack | Repeatable, platform-independent development database. Production host installation and licensing edition need confirmation. | Accepted (D-03) |
| No file storage | Compliance records carry reference numbers, dates, and the hard copy's location; backups are database-only. | Accepted (D-30, supersedes the file part of D-06) |
| Framework identity/password hashing | Avoids unsafe plaintext credential storage and reduces bespoke security code. | Required |
| Structured functional evaluation | Matches the supplied capstone evaluation approach; provides observable evidence without inventing a panel-approved numeric threshold. | Established |

# **3\. App Flow**

Purpose: Define the screens and user paths, including action feedback and blocked states. The farm context comes from the signed-in account's farm, not from a cross-farm dashboard.

## **Entry points and navigation**

* Farm Owner: opens the farm server's local address and signs in with the farm code, username or email, and password. In the Phase 1 deployment the partner farm's code is pre-filled; Phase 2 will resolve the farm from the subdomain. Each account is linked to one farm only; there is no portfolio dashboard or farm switcher.
* Farm Technician: signs in to an account created by a Farm Owner and changes the temporary password at first sign-in. The farm is resolved automatically; no farm-selection step is shown.
* System Administrator: signs in with the farm code left blank (host sign-in) and sees only the System Administration area.
* Farm navigation (role-filtered): Dashboard; Farm (Profile, Users, Compliance Documents, Activity Log); Ponds; Resources (Hatchery Sources, Buyers, Inventory); Production (Cycles, Batches, Logbooks); Harvest and Sales; Transactions; Reports; Account/Sign out.
* System Administration navigation: Farms (activate/deactivate, registration on/off), Account Recovery, Reference Data, Security and Error Logs.
* Back behavior returns to the prior list or dashboard while preserving safe search/filter state. Protected routes require sign-in and server authorization. Deep links must still enforce authorization.
* All dates and times are displayed in Asia/Manila time.

## **Screen inventory**

| Screen | Purpose / key data | Access |
| :---- | :---- | :---- |
| Sign In | Farm code (pre-filled in Phase 1), username/email, and password; validation, generic errors, account status; forced password change on first sign-in. | All |
| Farm Account Registration | Owner identity, credentials, farm details including farm code, structured address and optional total area, review/submit. | Prospective Owner (when registration is enabled) |
| Dashboard | Active cycles and batches per pond with DOC, current ABW, FCR to date, and estimated survival; water-quality alerts; low or negative stock; for Owners, expiring or expired permits and required permits with no current record. | Owner and Technician; content varies by role |
| Farm Profile | Farm details tab: farm name, structured address, total area (with a warning when ponds add up to more), contact details, time zone, document alert window. Ponds tab: pond specifications (pond type, farming system, area, depth, status) with a link to manage ponds. | Owner edit; Technician read |
| Farm Users | Create, edit, deactivate, and reset Farm Owner and Farm Technician accounts. | Owner |
| Compliance Documents | Status tiles (Active, Expiring soon, Expired, No expiry) that filter the list; required-permit summary; list with category, title, reference number, agency, issue and expiry dates, status; filters by category, status, text, and archived; View (details dialog), Edit, Renew, Archive/Restore; Add dialog (category, preset title or custom title, reference number, issuing agency, perpetual checkbox, issue and expiry dates, notes/location); categories and preset configuration. | Owner |
| Activity Log | Farm user actions and data changes with user and time; filter by user, date, and record type. | Owner |
| Pond List / Pond Detail | Manuscript Table 3 master data, status, current batch, status and modification history. | Owner manage; Technician read |
| Hatchery Sources | Registry with accreditation status and health certificate number/expiry. | Owner manage; Technician read |
| Buyers | Registry with company, contact person, phone, address, and sales history. | Owner |
| Inventory | Items, lots, quantity on hand, low/negative stock flags; record receipts and adjustments; movement history per lot. | Owner manage; Technician read |
| Production Cycles | Cycle list and detail: code, status, planned dates, target volume, objectives, hatchery source, batches; Create, Declare Failure, and Close actions. | Owner manage; Technician read |
| Batch Detail | Pond, status, stocking data, density, DOC, indicators, logs by type, harvests; Plan, Stock, Mark Harvested, Declare Failure, and Close actions. | Owner manage; Technician read and log entry |
| Logbook Entry | Log type (pond preparation, feeding, water quality, growth sampling, treatment/health intervention, mortality, post-production, general note), date/time, type-specific fields, inventory lot where applicable, out-of-range flags. A daily feeding sheet allows several feeding rounds to be entered at once. | Owner and Technician |
| Harvest Entry / Detail | Harvest date, partial or final, total kg, boxes, ABW, grading lines, optional quality checks (collapsed section), notes. | Owner and Technician |
| Sales | Sale list and entry: buyer, date, harvest, grade lines with kg and price per kg, total, payment terms, status, amount paid; printable sales record. | Owner |
| Transactions | Income/expense ledger with category, date, amount in PHP, description, counterparty, and links to cycle, batch, sale, or stock receipt. | Owner |
| Reports | Production Cycle Performance, Harvest Summary, batch failure report, operational history, water-quality exceptions, inventory movement, and income/expense summary; print-friendly. | Owner |
| System Administration | Farms, registration toggle, account recovery, reference data, security and error logs. | System Administrator |

## **Primary journey: onboarding and setup**

**1\.** Prospective Owner selects Register Farm Account (enabled by the System Administrator for onboarding).

**2\.** Enters owner account details and farm information, and may attach onboarding compliance documents.

**3\.** Reviews a summary and submits. The server creates the farm, farm profile, roles, default categories, and Owner account in one transaction.

**4\.** On success, the Owner lands on the dashboard with setup tasks: complete the profile, record compliance permits, add ponds, add hatchery sources and buyers, set up inventory items and record opening stock, and create user accounts.

**5\.** Owner creates additional Farm Owner and Farm Technician accounts with temporary passwords; each account is bound to this farm.

## **Primary journey: production through closure**

**1\.** Owner creates a production cycle with code, planned start and end dates, target volume, objectives, and hatchery source. The cycle is Planned.

**2\.** Owner plans one batch per grow-out pond in the cycle (only ponds without an open batch are offered). Each batch is Planned.

**3\.** Owner or Technician records pond preparation logs for each planned batch (draining, drying, liming and disinfection from inventory, filling, water source ratio).

**4\.** At stocking, the user records stocking date and time, PL count, PL age, lot number, acclimation duration, initial survival estimate, and baseline water quality. The batch becomes Stocked. For the cycle's first stocked batch, the system lists any required permit without a current record as a reminder; stocking always proceeds. The cycle becomes Active.

**5\.** Owner or Technician records daily logbooks: feeding rounds (deducting feed stock), water quality (flagged against GAqP ranges), growth sampling, treatments and health interventions (deducting supplement stock), and mortality.

**6\.** Owner or Technician records harvests (partial or final) with grading and quality checks. The Owner records sales per grade to buyers; each sale generates an income transaction and a printable sales record.

**7\.** After the final harvest the Owner marks the batch Harvested. If the crop is lost, the Owner declares the batch failed (or the whole cycle failed) with reason, date, and estimated loss.

**8\.** Owner or Technician records post-production logs (sludge removal, drying, equipment maintenance). The Owner closes the batch: final indicators are computed, records become read-only, and the pond becomes available.

**9\.** When all batches are closed, the Owner closes the cycle and prints the Production Cycle Performance and Harvest Summary reports.

## **Primary journey: account recovery**

**1\.** A Farm Owner who cannot sign in contacts the System Administrator in person or by phone.

**2\.** The System Administrator verifies identity through a second Farm Owner or the Owner's pre-agreed security question (decision D-24), then unlocks the account or issues a temporary password from Account Recovery.

**3\.** The Owner signs in and must set a new password. The action appears in the security log.

## **Action states and alternate paths**

| Action | Validation and loading | Success / error / alternate |
| :---- | :---- | :---- |
| Register farm | Required owner/farm fields; unique farm code; username/email uniqueness within the farm; password policy; show submit progress. | Success creates farm context and dashboard. Validation errors retain entered non-secret fields. Registration disabled shows a contact-administrator message. No partial farm or account if registration fails. |
| Save pond | Required code, area, depths, purpose, construction type, and farming system; code unique within farm; max depth not below average depth. | Success returns to pond detail and adds a history entry. Duplicate or invalid values show field-level errors. |
| Create farm user | Required name, username/email, role, and temporary password; created in the current farm only. | Success shows the active account. Owner can deactivate or reset; no self-registration for technicians. |
| Record stock receipt / adjustment | Required item, lot number, quantity > 0 (receipt) or signed quantity and reason (adjustment); optional unit cost. | Success updates quantity on hand; a receipt with unit cost also creates an expense transaction. |
| Create cycle / plan batch | Cycle: code, planned dates (end not before start), hatchery source. Batch: grow-out pond without an open batch, planned stocking date, planned PL count > 0. | Success opens detail. If no eligible pond exists, link the Owner to Ponds. |
| Stock batch | Required stocking fields and baseline water quality; PL count > 0; stocking date not in the future. | Success sets batch Stocked and cycle Active. Required permits without a current record are listed in the result as a reminder; nothing is blocked. |
| Save log | Required fields per log type; physical limits; inventory lot from the farm; allowed for the batch status; duplicate-safe ClientRequestId. | Success appears in history with recorder. Out-of-range water quality saves with a warning. Stock shortfall saves with a warning and flags the lot. Closed batches block entry. |
| Save harvest | Batch Stocked or Failed (emergency harvest); total kg > 0; grading lines kg not exceeding total; date not before stocking. | Success updates batch indicators and reports. |
| Save sale | Active buyer; harvest of the same farm; grade lines kg > 0 and price per kg ≥ 0; sold kg not above unsold harvest kg. | Success computes total, creates income transaction, and opens the printable sales record. |
| Change batch/cycle status | Only allowed transitions offered; failure requires reason, date, estimated loss; Close requires confirmation that records become read-only; cycle Close requires all batches Closed. | Success updates status and available actions. A conflicting concurrent change shows a refresh message instead of overwriting. |
| Save compliance record | Category; preset or custom title; reference number required and unique among current records in the category; expiry date required unless Perpetual, Perpetual refused when the category requires an expiry date; expiry not before issue; issue not in the future. | Success lists the record with its expiry status. Renew archives the earlier record. Invalid values show the reason and save nothing. |
| Open report | Validate filter range and farm scope; show loading/empty states. | Success displays matching records. Empty result explains no matching data. Unauthorized access is denied without revealing other farms. |
| Account recovery (System Administrator) | Select farm and user; confirm identity verification checkbox; generate temporary password. | Success shows the temporary password once and logs the action. Farm data is never displayed. |

## **Empty, blocked, and offline states**

* No ponds, hatchery sources, or inventory items: explain what must be set up first and link to the setup screen.
* No active cycles/logs/sales/documents: show a brief empty state and role-appropriate next step.
* Closed batch or cycle: show records as read-only, hide edit controls, and explain why; the API also rejects changes.
* Permission denied or expired/disabled account: give safe status guidance and return to an authorized screen; do not reveal the requested record or security-sensitive details.
* Local-network outage: Internet access is not required while the user can reach the farm server on the local network. If the server is unavailable, preserve unsaved input only in the current session and show retry guidance. No offline sync or browser-side queue is in Phase 1\.

# **4\. UI and UX Design Brief**

Purpose: Provide a consistent and usable interface for farm-office and field recording. The direction below is a proposed design system, not a panel-approved visual specification.

## **Audience and tone**

Audience: Farm Owners reviewing and administering farm records, and Farm Technicians entering operational data at the ponds, often on a tablet. Tone: clear, practical, calm. Design adjectives: readable, dependable, efficient.

## **Visual direction**

| Token | Proposed value |
| :---- | :---- |
| Primary | Deep marine blue \#244A63 for navigation and primary actions. |
| Accent | Aquaculture teal \#168C8C for highlights and selected states. |
| Background / surface | Warm off-white \#F6F8F7; white cards and forms. |
| Text | Near-black \#232D36; secondary \#596872. |
| Semantic colors | Success \#287A4B; warning \#A66A00 (out-of-range readings, permits expiring soon, low stock, missing required permits, unusual pond settings); error \#B33A3A (expired documents, negative stock); info \#2B6F9B. Pair color with icon/text. |
| Typography | System sans-serif (e.g., Inter if bundled/licensed, otherwise platform UI font); body 16 px target, compact tables 14 px minimum where possible; clear heading hierarchy. |

Reference products: none specified. Do not imply a visual reference has been selected. During prototyping, compare familiar farm-management or inventory interfaces only if the team explicitly chooses references.

## **Components and layout**

* Persistent left navigation on desktop; compact collapsible navigation on tablet. Keep the current farm name visible as context, without a cross-farm selector.
* Forms use explicit labels, examples/units beside numeric inputs, inline validation, and a clear save/cancel pair. Group fields by task; do not use placeholder text as the only label. Computed values (density, ABW, totals) appear read-only beside the inputs that produce them.
* Tables support readable column labels, sorting/filtering only where useful, and visible empty/loading/error states. Use cards for concise summaries rather than duplicating full tables.
* Use an 8 px spacing rhythm, consistent alignment, and a responsive content width. Suggested breakpoints: 768 px tablet and 1024 px desktop; verify with actual target devices. Make primary actions distinct; destructive, deactivation, failure, and Close actions require confirmation and explain the effect.

## **Screen hierarchy**

| Screen group | Visual emphasis |
| :---- | :---- |
| Dashboard | Pond grid with each pond's batch status, DOC, ABW, and FCR to date; alerts (water quality, documents, stock); recent activity; shortcuts to Add Log, Feeding Sheet, and Reports. |
| Farm and resources | Separate profile, users, documents, ponds, hatcheries, buyers, and inventory. Pond detail shows status, current batch, and history. Inventory shows quantity on hand per lot with flags. |
| Cycle and batch | Cycle detail lists its batches as cards with status path (Planned → Stocked → Harvested / Failed → Closed) and only the next allowed actions enabled. Stocking is a guided form with the baseline water-quality step. |
| Logbook entry | Choose batch then log type; prioritize date/time, values with units, inventory lot, and notes. Show the optimal range beside each water-quality field and an inline out-of-range warning with icon and text. Feeding sheet: one row per feeding round. Support comfortable tablet touch entry. |
| Harvest and sales | Grading lines in a compact table, with the optional quality checks in a collapsed section at the end of the harvest form; sale entry shows unsold kg per harvest and a read-back of totals before saving; printable sales record. |
| Compliance documents | Status tiles and a list with category, title, reference number, agency, dates, and status badges (Active, Expiring soon, Expired, No expiry; Archived) using text plus color. Add/Edit/Renew and View open as dialogs. |
| Reports | Filters before results; distinguish computed indicators from source records; show the selected time/cycle/batch range and data freshness; print layout. |
| System Administration | Visually distinct header ("System Administration") so it is never confused with a farm workspace. |

## **Accessibility and interaction states**

* Meet WCAG 2.2 AA as a design target where practical; verify contrast, reflow, keyboard use, visible focus, semantic headings, and form labels. This target is a recommendation, not a confirmed institutional criterion.
* Touch targets should be comfortably usable on tablets; aim for 44 × 44 CSS pixels for primary controls where layout allows.
* Every interactive control has hover, focus, disabled, loading, error, and success treatments where relevant. Loading states prevent duplicate submissions and announce completion/errors accessibly.
* Do not encode status by color alone. Provide text and/or icons with accessible names. Ensure tables have meaningful headers and forms expose validation messages to assistive technology.

## **Assets needed**

Use a project wordmark or text title unless the capstone team supplies an approved logo. Use a consistent icon set with labels for less familiar actions. No stock pond imagery or illustrations are necessary for the operational interface.

# **5\. Backend Schema**

Purpose: Define the relational model for a single SQL Server database shared by farms (tenants), with explicit ownership, fields, lifecycle rules, computed indicators, and access boundaries. Phase 1 deploys it for one partner farm; Phase 2 uses the same schema for many farms. Field names follow the Key Data Elements in manuscript Table 5.

Conventions: FarmId means the framework's TenantId column (int, not null), supplied by IMustHaveTenant on every farm-owned table. A farm is one row in the framework's AbpTenants table plus its FarmProfile row. Farm-owned entities use sequential GUID primary keys so that Phase 2 offline capture can create records on devices without key collisions. Audited entities use the framework's audit fields (CreationTime, CreatorUserId, LastModificationTime, LastModifierUserId) and soft delete (IsDeleted). "Recorder" means CreatorUserId.

## **Entity catalog: farm, accounts, and compliance**

| Entity | Core fields and constraints |
| :---- | :---- |
| Farm (AbpTenants) | Framework table. Id int PK (= FarmId); TenancyName (farm code) unique; Name; IsActive (set by the System Administrator). |
| FarmProfile | TenantId int PK and FK to AbpTenants; FarmName nvarchar(150) required; AddressLine1 nvarchar(200) required (house number, street, purok or sitio, unit); AddressLine2 nvarchar(200) nullable (building, suite, floor, or barangay); CityMunicipality nvarchar(100) required; Province nvarchar(100) required; PostalCode nvarchar(10) nullable (4 digits when the country is the Philippines); Country nvarchar(100) required, default 'Philippines'; TotalAreaHectares decimal(10,2) nullable, 0.01–100,000 (warning only when pond areas exceed it); Latitude/Longitude decimal(9,6) nullable; ContactName/Phone/Email; TimeZone default 'Asia/Manila'; DocumentExpiryAlertDays int default 30; audit fields. Required address parts are enforced by the API (columns nullable for existing rows). Ownership type and operational details were removed (D-31). |
| User (AbpUsers) | Framework table. Id long PK; TenantId (one farm per account; null only for the System Administrator); UserName and EmailAddress unique within the farm; Name, Surname; password hash only; IsActive; ShouldChangePasswordOnNextLogin; lockout fields. |
| Role / UserRole (AbpRoles, AbpUserRoles) | Framework tables. Static farm roles FarmOwner and FarmTechnician in every farm; host role SystemAdministrator. Permissions per the matrix below. |
| DocumentCategory | Id Guid PK; TenantId; Name; RequiresExpiryDate bit (records cannot be perpetual); IsActive. Unique (TenantId, Name). Seeded per farm with presets (D-30): Fisheries and Aquaculture (requires expiry); Environmental Compliance; Business and Local Government (requires expiry); Tax and Business Registration; Other. Farm Owners can add and edit categories; changes are audit-logged. |
| DocumentPreset | Id Guid PK; TenantId; CategoryId FK; Name nvarchar(200); DefaultIssuingAgency nvarchar(200) nullable; IsRequired bit (reminder when no current record uses it); IsActive; SortOrder. Unique (TenantId, CategoryId, Name). Seeded: BFAR Fishpond / Aquafarm Registration (required), Fishpond Lease Agreement (FLA), Fish Health Certificate; Environmental Compliance Certificate (ECC) (required), Certificate of Non-Coverage (CNC), Wastewater Discharge Permit, Water Permit (NWRB); Mayor's / Business Permit (required), Barangay Business Clearance, Sanitary Permit; BIR Certificate of Registration (Form 2303), DTI Business Name Registration, SEC Registration, CDA Registration. |
| ComplianceDocument | Id Guid PK; TenantId; CategoryId FK; PresetId FK nullable (null = custom title); Title nvarchar(200) required (defaults to the preset name); DocumentNumber nvarchar(100) required, unique per (TenantId, CategoryId) among non-archived rows; IssuingAgency nvarchar(200) nullable; IssueDate nullable, not in the future; ExpiryDate nullable (null = Perpetual / No expiry date; required when the category requires it; not before IssueDate); Notes nvarchar(500) nullable (notes or hard-copy location); IsArchived; RenewedFromId nullable; audit fields. No file columns and no review columns (D-30). Expiry status (Active, Expiring soon, Expired, No expiry) is computed at read time from the farm-local date and DocumentExpiryAlertDays. A required preset is "satisfied" when a non-archived, non-expired record uses it. |
| Notification | Id Guid PK; TenantId; Type (DocumentExpiring, DocumentExpired, WaterQualityAlert, LowStock, NegativeStock); related record type and Id; Message; CreatedAtUtc; ReadByUserIds or per-user read table. In-app only. |

## **Entity catalog: ponds and resources**

| Entity | Core fields and constraints |
| :---- | :---- |
| Pond | Id Guid PK; TenantId; PondCode nvarchar(30) required (manuscript "Pond ID"); Name; AreaM2 decimal(10,2) > 0; AverageDepthM decimal(5,2) > 0; MaxDepthM decimal(5,2) ≥ AverageDepthM; Purpose (GrowOut, Nursery, Reservoir, Treatment); ConstructionType (Earthen, Concrete, HDPE-lined, Other) (manuscript "Pond Type"); InletType; OutletType; AerationSystem nvarchar(300) (type, count, horsepower); FarmingSystem (Extensive, Semi-intensive, Intensive, Super-intensive); Latitude/Longitude nullable; ManualStatus (Active, UnderMaintenance, Inactive); Notes; audit fields. Unique (TenantId, PondCode). Displayed status is derived: Inactive or Under maintenance (manual), else Under preparation (Planned batch), In production (Stocked batch), Post-harvest (Harvested/Failed batch), else Available. Farming system vs construction: super-intensive in an earthen pond, or extensive in a concrete or HDPE-lined pond, shows a warning but saves (D-32). |
| PondHistory | Id Guid PK; TenantId; PondId FK; ChangeDate; ChangeType (StatusChange, InfrastructureModification); Description; recorder. Covers Ref 4.2 "infrastructure modifications over time". |
| HatcherySource | Id Guid PK; TenantId; Name; Address; ContactPerson; Phone; BfarAccreditationNo nullable; AccreditationStatus (Accredited, Pending, NotAccredited, Unknown); HealthCertificateNo nullable; HealthCertificateExpiry nullable; IsActive; audit fields. |
| Buyer | Id Guid PK; TenantId; CompanyName; ContactPerson; Phone; Address; IsActive; audit fields. |
| InventoryItem | Id Guid PK; TenantId; Category (Feed, Additive/Supplement, Chemical); Brand; ProductName; FeedType nullable (e.g., starter, grower, finisher); BaiRegistrationNo nullable; Unit (kg, g, L, mL, pcs); ReorderLevel nullable; MovingAverageUnitCost decimal(14,4) (maintained on receipts); IsActive. Unique (TenantId, Brand, ProductName). |
| InventoryLot | Id Guid PK; TenantId; ItemId FK; LotNumber; ReceivedDate; ExpiryDate nullable; Supplier nullable. Unique (TenantId, ItemId, LotNumber). QuantityOnHand = sum of its movements (not stored, or cached and reconciled). |
| StockMovement | Id Guid PK; TenantId; LotId FK; MovementDate; Type (Receipt, Usage, Adjustment); Quantity decimal(14,3) (positive for receipt, negative for usage, signed for adjustment); UnitCost nullable (receipt); Reason (required for adjustment); SourceLogId nullable (usage); BatchId nullable (usage); GeneratedTransactionId nullable; recorder. Movements are never edited; corrections use a reversing adjustment. |

## **Entity catalog: production**

| Entity | Core fields and constraints |
| :---- | :---- |
| ProductionCycle | Id Guid PK; TenantId; CycleCode required, unique per farm; Status (Planned, Active, Failed, Closed); PlannedStartDate; PlannedEndDate (not before start); TargetProductionKg decimal(14,3) nullable; Objectives nvarchar(1000); HatcherySourceId FK required (the cycle's single fry source); FailureReason, FailureDate, EstimatedLossPhp nullable; ClosedAtUtc, ClosedByUserId; RowVersion; audit fields. |
| PondBatch | Id Guid PK; TenantId; CycleId FK; PondId FK (Purpose GrowOut, same farm); BatchCode required, unique per farm; Status (Planned, Stocked, Harvested, Failed, Closed); PlannedStockingDate; PlannedPlCount bigint > 0; StockedAtUtc nullable; PlCountStocked bigint > 0 when stocked; PlAgeDays int nullable; HatcheryLotNumber nullable; AcclimationMinutes int nullable; InitialSurvivalEstimatePct decimal(5,2) nullable; HatcheryCertificationStatusAtStocking (snapshot); StockingDensityPerM2 (stored at stocking = PlCountStocked / pond AreaM2); FailureReason, FailureDate, EstimatedLossPhp nullable; Final indicators (FinalAbwG, FinalFcr, SurvivalRatePct, TotalHarvestKg, TotalFeedKg, CultureDays) stored at closure; ClosedAtUtc, ClosedByUserId; RowVersion; audit fields. Filtered unique index (TenantId, PondId) where Status <> Closed: one open batch per pond. The batch's hatchery source is the cycle's. |
| ProductionLog | Id Guid PK; TenantId; BatchId FK; PondId FK (copied); LogType (PondPreparation, PreStockingWaterQuality, Feeding, WaterQuality, GrowthSampling, Treatment, Mortality, PostProduction, GeneralNote); ObservedAtUtc required, not in the future; Notes nvarchar(2000); ClientRequestId Guid unique per farm (duplicate-safe retries); recorder; audit fields. Type-specific details are in the tables below (one row per log). |
| PondPreparationDetail | LogId PK/FK; ActivityType (Draining, Drying, Liming, Disinfection, Filling, Other); DrainingDate, DryingDays, FillingDate nullable; SeawaterPct and FreshwaterPct nullable (sum to 100 when given); inventory usage lines via StockMovement. |
| FeedingDetail | LogId PK/FK; LotId FK (feed item; gives brand, type, lot, BAI no.); QuantityKg decimal(10,3) ≥ 0; FeedingRound int; Method (Broadcast, Tray, AutoFeeder, Other); TrayConsumptionMinutes int nullable; TrayLeftoverPct decimal(5,2) nullable; AdjustmentNote nullable. Creates a Usage movement. |
| WaterQualityMeasurement | Id Guid PK; TenantId; LogId FK; ParameterCode FK; Value decimal(12,4); UnitCode; IsOutOfRange bit computed at save and stored. Used by WaterQuality and PreStockingWaterQuality logs; at least one measurement per log; the pre-stocking log requires temperature, salinity, pH, and DO. |
| GrowthSamplingDetail | LogId PK/FK; SampleCount int > 0; TotalSampleWeightG decimal(10,2) > 0; AbwG computed = TotalSampleWeightG / SampleCount (stored). |
| TreatmentDetail | LogId PK/FK; InterventionType (Liming, Probiotic, Disinfection, Vitamin/Immunostimulant, WaterPumping, WaterExchange, Other); Reason; LotId nullable (product used); Dosage decimal(12,3) and DosageUnit nullable; Outcome nullable. Creates a Usage movement when a lot is used. Covers the manuscript "Chemical and Supplements" logbook and Ref 6.4. |
| MortalityDetail | LogId PK/FK; Count int ≥ 0; SuspectedCause (Disease, Stress, Cannibalism, WaterQuality, Predation, Unknown, Other); SuspectedDisease nullable (WSSV, AHPND/EMS, Other); Symptoms nvarchar(500) (e.g., "cherry blossom" coloration); ResponseAction nullable. |
| Harvest | Id Guid PK; TenantId; BatchId FK; HarvestedAtUtc (not before stocking); HarvestType (Partial, Final, Emergency); TotalKg decimal(14,3) > 0; Boxes int nullable; AbwG decimal(8,2) nullable; SmoothShell, IntactAppendages, NoNecrosis bit nullable (optional; null = not assessed); QualityNotes; recorder; audit fields. Multiple harvests per batch. |
| HarvestGradeLine | Id Guid PK; TenantId; HarvestId FK; SizeLabel (e.g., "60/70"); CountPerKg int > 0; Kg decimal(14,3) > 0. Sum of Kg ≤ Harvest.TotalKg. |
| Sale | Id Guid PK; TenantId; BuyerId FK; HarvestId FK (same farm); SaleDate; PaymentTerms nullable; PaymentStatus (Unpaid, Partial, Paid); AmountPaid decimal(14,2) ≥ 0; Reference nullable; TotalAmount computed and stored; GeneratedTransactionId; audit fields. Sum of sold kg across a harvest's sales ≤ Harvest.TotalKg. |
| SaleLine | Id Guid PK; TenantId; SaleId FK; SizeLabel; CountPerKg nullable; Kg decimal(14,3) > 0; PricePerKg decimal(12,2) ≥ 0; LineAmount = Kg × PricePerKg. |

## **Entity catalog: finance and reference data**

| Entity | Core fields and constraints |
| :---- | :---- |
| FarmTransaction | Id Guid PK; TenantId; TransactionDate; Type (Income, Expense); CategoryId FK; Amount decimal(14,2) > 0; CurrencyCode char(3) default PHP; Description; Counterparty nullable; Reference nullable; CycleId, BatchId nullable; Source (Manual, Sale, StockReceipt) with SaleId or StockMovementId; audit fields. Generated transactions are edited only through their source record. |
| TransactionCategory | Id Guid PK; TenantId; Name; Type; IsSystem (generated categories); IsActive. Seeded per farm: Expense: Fry/PL purchase, Inventory purchase (system), Labor, Electricity and fuel, Equipment and maintenance, Permits and fees, Other expense. Income: Harvest sales (system), Other income. |
| ParameterDefinition (host reference) | Host-level seeded table maintained by the System Administrator. Code PK; Name; UnitCode; PhysicalMin/PhysicalMax (reject outside); OptimalMin/OptimalMax nullable with inclusive/exclusive flags (flag outside); GuidanceFrequency (text); IsActive. Values in the next table. |

## **Water-quality parameters and GAqP optimal ranges**

Optimal ranges and monitoring frequencies are the GAqP (PNS/BAFS 197:2017) values cited in the manuscript's water-quality monitoring table and are seeded as reference data (decision D-09). A reading outside the optimal range is saved and flagged; a reading outside the physical limit is rejected as an entry error. Physical limits are data-entry sanity bounds, not biological thresholds. Range ends are inclusive unless shown with \< or \>. Monitoring frequency is shown as guidance in P1; overdue reminders depend on Ref 5.4 (P2).

| Parameter | Unit | Optimal range (flag outside) | Monitoring frequency | Physical limit (reject outside) |
| :---- | :---- | :---- | :---- | :---- |
| Dissolved oxygen (DO) | ppm (mg/L) | 5.0 – 9.0 | 2× daily (AM, PM) | 0 – 20 |
| Temperature | °C | 28 – 32 | 2× daily (AM, PM) | 0 – 45 |
| pH | pH units | 7.0 – 8.3 | 2× daily (AM, PM) | 0 – 14 |
| Salinity | ppt | 15 – 35 | 1× daily | 0 – 60 |
| Total ammonia nitrogen (TAN) | ppm (mg/L) | \< 0.03 | Weekly | 0 – 100 |
| Nitrite (NO₂⁻) | ppm (mg/L) | \< 1.0 | Weekly | 0 – 100 |
| Alkalinity | ppm (mg/L as CaCO₃) | \> 100 | Weekly | 0 – 500 |
| Nitrate (NO₃⁻) | ppm (mg/L) | None in manuscript (recorded, not flagged) | As needed | 0 – 500 |

## **Computed performance indicators**

All indicators are computed per batch; cycle values aggregate the cycle's batches (sums for quantities, weighted totals for ratios). Dates use the farm time zone.

| Indicator | Formula |
| :---- | :---- |
| Stocking density (PL/m²) | PlCountStocked ÷ pond AreaM2 |
| Day of Culture (DOC) | Farm-local date − stocking date, in days (stocking day = DOC 0) |
| Cumulative feed (kg) | Sum of FeedingDetail.QuantityKg for the batch |
| ABW (g) | Latest growth sample: TotalSampleWeightG ÷ SampleCount; at harvest, the harvest's AbwG when given |
| Harvested pieces | Sum over grade lines of Kg × CountPerKg; if a harvest has no grade lines, TotalKg × 1000 ÷ AbwG |
| Estimated population | PlCountStocked − cumulative recorded mortality − harvested pieces |
| Estimated standing biomass (kg) | Estimated population × latest ABW ÷ 1000 |
| FCR to date | Cumulative feed ÷ (estimated standing biomass + total harvested kg) |
| Final FCR | Total feed ÷ total harvested kg (manuscript definition) |
| Survival rate (%) | Total harvested pieces ÷ PlCountStocked × 100 |
| Culture days | Date of last harvest − stocking date |
| Growth rate (g/day) | (ABW of this sample − ABW of previous sample) ÷ days between samples |
| Batch production cost | Inventory usage cost (usage quantity × item moving-average unit cost) + manual expenses linked to the batch + the batch's share of manual expenses linked to its cycle (allocated by stocked PL count) |
| Batch revenue and margin | Sum of the batch's sales; margin = revenue − batch production cost |

Cost note: inventory purchases appear in the farm cash ledger as "Inventory purchase" expenses when received; batch production cost uses the cost of inventory actually used instead. Reports label these two views separately so purchases are never counted twice.

## **Batch and cycle lifecycle rules**

| Batch status | How it is entered | Records allowed |
| :---- | :---- | :---- |
| Planned | Owner plans a batch on a grow-out pond without an open batch, in a Planned or Active cycle. | Pond preparation, pre-stocking water quality, treatment, general note. Owner may edit or delete a Planned batch with no records. |
| Stocked | Owner or Technician stocks it with the required stocking data and baseline water quality. | All log types; partial, final, and emergency harvests. |
| Harvested | Owner marks Harvested after at least one Final harvest. | Corrections to existing logs and harvests; post-production and general notes; sales. |
| Failed | Owner declares failure from Stocked (or by cycle failure), with reason, date, and estimated loss. | Corrections; emergency harvests; post-production and general notes; sales. |
| Closed | Owner closes from Harvested or Failed after confirmation; final indicators are computed and stored. Reopening is not supported in Phase 1\. | Logs, measurements, and harvests are read-only for all roles. Sales payment updates and transactions may still reference the batch. The pond becomes available. |

| Cycle status | Rule |
| :---- | :---- |
| Planned | Created by the Owner; batches can be planned. |
| Active | Set automatically when the first batch is stocked; missing required permits are shown as a reminder only (D-30). |
| Failed | Owner declares cycle failure with reason, date, and estimated loss; every batch that is not Closed becomes Failed (Planned batches with no records are cancelled by deletion). |
| Closed | Owner closes after all batches are Closed; confirms post-production activities are logged. Reopening is not supported in Phase 1\. |

## **Relationships and indexes**

* Farm (tenant) 1-to-1 FarmProfile and 1-to-many Users. Each farm User belongs to exactly one farm and holds FarmOwner or FarmTechnician; the System Administrator is a host user with no farm.
* Farm 1-to-many Pond, PondHistory, HatcherySource, Buyer, InventoryItem, InventoryLot, StockMovement, ProductionCycle, PondBatch, ProductionLog, Harvest, Sale, FarmTransaction, TransactionCategory, DocumentCategory, ComplianceDocument, and Notification.
* HatcherySource 1-to-many ProductionCycle; ProductionCycle 1-to-many PondBatch; Pond 1-to-many PondBatch; PondBatch 1-to-many ProductionLog and Harvest; ProductionLog 1-to-0..1 detail row and 1-to-many WaterQualityMeasurement; Harvest 1-to-many HarvestGradeLine and Sale; Sale 1-to-many SaleLine; Buyer 1-to-many Sale; InventoryItem 1-to-many InventoryLot 1-to-many StockMovement; ParameterDefinition 1-to-many WaterQualityMeasurement.
* Indexes: unique (TenantId, PondCode); unique (TenantId, CycleCode); unique (TenantId, BatchCode); filtered unique (TenantId, PondId) on PondBatch where Status <> Closed; (TenantId, Status) on cycles and batches; (TenantId, BatchId, LogType, ObservedAtUtc) on logs; unique (TenantId, ClientRequestId); (TenantId, LotId, MovementDate); (TenantId, HarvestedAtUtc); (TenantId, SaleDate); (TenantId, TransactionDate); (TenantId, ExpiryDate). Add further indexes based on measured query patterns.
* Use foreign keys with restrict delete behavior and soft delete. Prefer deactivation for users, ponds, hatcheries, buyers, items, and categories with history; never cascade-delete production, inventory, or financial records. Use RowVersion concurrency tokens on cycle and batch status changes.

## **User ownership, authentication, and authorization**

Farm scope: the farm is resolved from the authenticated JWT's tenant claim. The framework's IMustHaveTenant filter adds WHERE TenantId \= @CurrentFarmId to every query, and new entities receive the current TenantId automatically. Client-supplied identifiers are looked up through the filtered repositories, so another farm's identifiers resolve to not found. Each farm account belongs to exactly one farm, a farm may have multiple Owners, and the UI has no farm portfolio or switcher. Host-level code paths used by the System Administrator never load farm-owned entities other than AbpTenants and AbpUsers.

Sign-up: farm registration creates the tenant, farm profile, static roles, seeded categories, and initial Farm Owner in one transaction after validation. Any Farm Owner may create additional Farm Owner and Farm Technician accounts within the current farm, each with a temporary password that must be changed at first sign-in. Sign-in uses JWT Bearer tokens and ASP.NET Core Identity password hashing (decision D-02). Deactivate accounts instead of deleting them so historical authorship is preserved.

| Entity / action | Farm Owner | Farm Technician | System Administrator |
| :---- | :---- | :---- | :---- |
| Farm profile | Read/update | Read | Read farm name, code, and active status only |
| Farm user accounts | Create/read/update/deactivate/reset Owner and Technician accounts | Own profile and password only | Unlock or issue a temporary password; no other edits |
| Compliance records, categories, and presets | Create, read, edit, renew, archive; add and edit categories (RequiresExpiryDate, active) and presets (default agency, Required, active) | No access | No access |
| Activity log | Read own farm's log | No access | Security and system events only, without farm record contents |
| Ponds and pond history | Create/read/update/deactivate | Read | No access |
| Hatchery sources | Create/read/update/deactivate | Read | No access |
| Buyers | Create/read/update/deactivate | No access | No access |
| Inventory items, lots, receipts, adjustments | Create/read/update/deactivate | Read stock on hand | No access |
| Cycles and batches | Create, plan, stock, mark harvested, declare failure, close; delete Planned with no records | Read; stock a Planned batch | No access |
| Production logs (all types) | Create/read/update while batch not Closed | Create/read; update own entries while batch not Closed; no delete | No access |
| Harvest records | Create/read/update while batch not Closed | Create/read; update own entries while batch not Closed; no delete | No access |
| Sales | Create/read/update; record payments | No access | No access |
| Transactions | Create/read/update manual records; read generated records | No access | No access |
| Reports and dashboard | All reports; full dashboard | Operational dashboard (batches, logs, water-quality alerts, stock flags) | No access |
| Farm accounts and registration | — | — | Activate/deactivate farm; enable/disable registration |
| Reference data (parameters, units) | Read | Read | Create/read/update |
| Other farms' data | Denied (a separate account in that farm is required) | Denied | Denied |

## **Validation, time, retention, migrations, and seed data**

* Time: store event and audit times in UTC; display in the farm time zone (default Asia/Manila). Date-only fields (planned dates, stocking date for DOC, sale and transaction dates, issue and expiry dates) are farm-local calendar dates. Report date filters convert farm-local day boundaries (00:00 to next 00:00, Asia/Manila) to UTC.
* Validation: nonnegative quantities and amounts; positive PL counts, areas, depths, sample counts and weights; valid units; physical limits; same-farm foreign keys; date ordering (planned end not before start, harvest not before stocking, expiry not before issue, observation not in the future); grade-line kg not above harvest kg; sold kg not above harvested kg; seawater and freshwater percentages sum to 100; allowed status transitions; Closed read-only rules. GAqP optimal ranges flag but never block; stock shortfalls warn but never block.
* Retention: define retention/export/deletion with the institution and farm. Preserve production history and attribution when accounts are deactivated. Document backup retention and verified restore steps.
* Migrations: use EF Core migrations in source control and review generated SQL for deployment.
* Seed data: host level: ParameterDefinition values, units, SystemAdministrator role and initial account (password from secret configuration, forced change at first sign-in). Per new farm: static roles and permissions, transaction categories, document categories. Do not put real user or farm data in development seeds; development seeds include two test farms with sample ponds, items, and one reference batch with hand-calculated indicators for testing.

# **6\. Implementation Plan**

Purpose: Build in dependency order using Feature-Driven Development (the manuscript methodology), with a reviewable checkpoint at the end of every milestone. Owner: capstone development team unless tasks are assigned by the team; no agent/person assignments are presumed. P2 features start only after Milestone 7 passes.

| Milestone | Tasks and dependency | Output / definition of done | Checkpoint |
| :---- | :---- | :---- | :---- |
| 1\. Project setup | Obtain the ASP.NET Boilerplate v10.2.0 Angular \+ ASP.NET Core startup template; confirm the .NET 9 SDK and Angular 19.2.1/Node versions from the project files and lockfile; inventory Core, Application, EntityFrameworkCore, Web.Core, Web.Host, Migrator, and test projects; run SQL Server in Docker via OrbStack; confirm multi-tenancy is enabled; configure development settings and secrets; define IFileStorageService. | Backend and Angular client build and run in every team environment; API health endpoint and Angular shell connect; secrets stay outside source; README records setup steps and exact package/TFM versions. | Clean setup on another team machine; document blockers and versions. |
| 2\. Accounts and tenancy (Refs 1.1–1.3, 9.1 base) | Static farm roles and permissions; System Administrator role and recovery screens; farm registration (tenant, profile, roles, categories, Owner in one transaction) with registration toggle; Owner creation and reset of accounts with forced password change; JWT lifetime and signing key; audit logging enabled; two-farm development seed. | Registration, sign-in, account management, and recovery work; authorization enforced in the API; no plaintext password field or storage. | AC-01, AC-02, AC-21, AC-22; cross-farm denial; credential-handling review. |
| 3\. Farm, compliance, ponds, and resources (Refs 2.1, 2.2, 3.1–3.3, 4.1–4.2) | Farm profile; compliance records with categories, presets, expiry status, renewal, archive, reminders; ponds with history; hatchery sources; buyers; inventory items, lots, receipts, adjustments, moving-average cost, receipt-generated expenses. | Owner can complete all setup tasks; compliance records follow the D-30 rules; stock on hand equals the movement ledger. | AC-03 to AC-05; inventory reconciliation test. |
| 4\. Cycles and batches (Refs 4.3, 5.1–5.3, 5.5, 5.6, 7.4) | Cycle creation; batch planning with one-open-batch rule; pond preparation logs; stocking with baseline water quality, density, and required-permit reminder; failure declaration; batch and cycle closure with stored final indicators. | Lifecycle transitions follow Section 5; closure computes indicators; read-only rules enforced in API and UI. | AC-06 to AC-09, AC-16 to AC-18. |
| 5\. Daily logbooks (Refs 6.1–6.5) | Feeding (with daily feeding sheet and inventory usage), water quality with GAqP flagging, growth sampling, treatments with inventory usage, mortality; duplicate-safe submission; live indicators (DOC, ABW, population, biomass, FCR to date). | All log types save with correct batch context, flags, stock movements, and indicators. | AC-10 to AC-13; reference-batch indicator test. |
| 6\. Harvest, sales, and finance (Refs 7.1–7.3, Objective 2) | Harvest with grading and quality checks; sales with grade lines, payment status, printable sales record, generated income; manual transactions and categories. | Sales totals equal generated income; sold kg never exceeds harvested kg; ledger shows manual and generated records. | AC-14, AC-15; finance reconciliation test. |
| 7\. Reports, dashboard, and audit (Refs 8.1, 8.2, 9.1, 9.2) | Production Cycle Performance and Harvest Summary reports, failure report, operational history, water-quality exceptions, inventory movement, income/expense summary; role-specific dashboard and notifications; farm activity log. | Reports reconcile with source records and indicator formulas; print layouts work; dashboard alerts appear for each alert type. | AC-19, AC-11 (dashboard), AC-03 (reminders). |
| 8\. Quality and security | Refine validation, access-denied/error/offline states, accessibility, backup/restore, and performance measurement using the D-26 seed script and 5 concurrent users. Optionally build P2 features in priority order (5.4, charts, biosecurity/operations logs, batch documents, Base 10 pricing). | No known critical authorization defects; core flows work with keyboard and tablet viewport; database backup restore demonstrated; targets measured and documented. | Run the full functional suite; review farm isolation, System Administrator restrictions, and JWT/password design; log all failures. |
| 9\. Release | Wi-Fi walk test at every pond (add an outdoor access point if needed); set up the farm-office PC on a UPS with SQL Server Express, fixed LAN IP, and local-CA HTTPS certificate installed on farm devices; configure production secrets and the System Administrator initial password; apply migrations; schedule daily external-drive backups and the weekly off-site copy; prepare rollback/restore procedure, user guide, account-recovery procedure, printable paper log sheets, and the System Administrator handover checklist. | Partner/staging acceptance completed if access is available; deployment steps repeatable; version and known limitations documented. | Release readiness review: functional results, backup restore, security configuration, rollback steps, and unresolved items approved by team/panel. |

## **Suggested functional test checkpoints**

| Area | Representative test cases |
| :---- | :---- |
| Registration | Valid registration; registration disabled; missing required farm details; duplicate farm code or account identifier; failed registration leaves no orphan farm or user records. |
| Farm boundary | With two farms in one database, Owner and Technician access only their own farm's data; another farm's identifiers are denied for list, detail, create, update, report, and compliance-record requests. |
| Accounts and roles | Owner creates another Owner and a Technician; temporary password must be changed; Technician cannot reach Owner-only screens or endpoints; Technician can edit own log but not another user's; deactivated user cannot sign in. |
| System Administrator | Unlock and temporary-password reset work and are logged; every farm production, inventory, sales, finance, and document endpoint returns access denied; host sign-in shows only System Administration. |
| Compliance | Save records from presets and custom titles; refuse perpetual where the category requires expiry, expiry before issue, future issue date, and duplicate current reference numbers; Expiring soon inside the alert window and Expired after the expiry date; reminders on dashboard; renew archives the earlier record; filters by category, status, and text; stocking the first batch with a missing required permit succeeds and shows the reminder (also for a Technician). |
| Ponds and resources | Create valid pond; reject duplicate code and max depth below average depth; status history recorded; hatchery and buyer CRUD; receipt increases stock and creates expense when costed; adjustment requires reason; moving-average cost updates correctly. |
| Cycles and batches | Reject a second open batch on the same pond; reject batch on a non-grow-out pond; reject zero PL count; invalid transitions rejected; cycle becomes Active on first stocking; cycle failure fails all open batches; cycle cannot close with open batches; Closed batch is read-only. |
| Logbooks | Each log type saves with required fields; water-quality boundary tests (DO 5.0 in range, 4.9 flagged; pH 8.3 in range, 8.4 flagged; TAN 0.029 in range, 0.03 flagged; alkalinity 100 flagged, 101 in range); pH 15 rejected; feeding and treatment create usage movements; stock shortfall warns and flags the lot; retry with the same ClientRequestId creates no duplicate. |
| Indicators | For the reference batch, stocking density, DOC, ABW, estimated population, biomass, FCR to date, final FCR, survival rate, and culture days equal hand-calculated values. |
| Harvest and sales | Grade lines cannot exceed harvest kg; sale cannot exceed unsold kg; sale total equals sum of lines; generated income matches; payment status updates; printable sales record shows the internal-document notice. |
| Reports | Filter by cycle, batch, and date; a record at 23:30 Asia/Manila is counted on that local day; empty range; unauthorized farm scope; report totals reconcile with source records; purchase and usage cost views are not double counted. |
| Reliability/security | Restart local services; restore database and document backups; verify password hashes only; verify secret exclusion; missing, expired, or tampered JWT is rejected; cookie-only requests are not authenticated. |

## **Release and rollback**

Before a farm-site release, back up the database, record the application/database version, apply reviewed migrations, verify login and critical farm flows, and confirm backup completion. Rollback must specify how to restore the prior application package and database backup; do not assume schema rollback is safe after production writes. Monitoring can begin with restricted local application logs, database health checks, disk/backup checks, and a documented incident contact/owner.

# **Appendix A. Decision log, defaults to confirm, and unresolved items**

## **Decision log**

| ID | Decision | Status |
| :---- | :---- | :---- |
| D-01 | Local MVP vs SaaS: build a Local On-Premise MVP for capstone UAT at the partner farm while keeping a multi-tenant-ready FarmId (TenantId) architecture. Full multi-tenant cloud SaaS moves to Phase 2\. | Accepted |
| D-02 | Authentication: standardize on JWT Bearer tokens for all API endpoints and salted ASP.NET Core Identity password hashing. Plaintext storage, custom hashing overrides, and cookie-only flows are rejected. | Accepted |
| D-03 | Containerization: SQL Server runs in Docker via OrbStack for platform-independent team development. | Accepted |
| D-04 | Template and stack: ASP.NET Boilerplate v10.2.0 startup template (Angular \+ ASP.NET Core) on .NET 9 with Angular 19.2.1 and abp-ng2-module. Replaces the earlier wording "ASP.NET Zero 10.2.0", which refers to a different commercial product and version line. | Accepted |
| D-05 | Support risk: ASP.NET Boilerplate support ended in May 2026 and .NET 9 support ends on 10 November 2026\. Accepted for the capstone; mitigate by pinning versions, applying the final .NET 9 patches, and keeping the server LAN-only. Retargeting to .NET 10 LTS or migrating to a supported framework is Phase 2 work. | Accepted risk |
| D-06 | Compliance documents are P1 with categories, document numbers, expiry tracking, and in-app reminders. File storage and Owner review were withdrawn by D-30. Batch-level documents are P2. | Superseded in part by D-30 |
| D-07 | Farm roles: Farm Owner and Farm Technician only. Any Owner can create Owner and Technician accounts within their farm. Every farm account belongs to exactly one farm; no farm switcher. | Accepted |
| D-08 | Lifecycle: batches follow Planned → Stocked → Harvested / Failed → Closed; cycles follow Planned → Active → Failed / Closed. One open batch per pond. Closed records are read-only; reopening is not supported. | Accepted (revised in v1.4) |
| D-09 | GAqP water-quality ranges for P. vannamei, as cited in the manuscript from PNS/BAFS 197:2017, are seeded reference data: DO 5.0–9.0 ppm, temperature 28–32 °C, pH 7.0–8.3, salinity 15–35 ppt, TAN \< 0.03 ppm, nitrite \< 1.0 ppm, alkalinity \> 100 ppm; nitrate is recorded without a range. Out-of-range readings are saved and flagged; physically impossible values are rejected. | Accepted (revised in v1.4) |
| D-10 | Time zone: Asia/Manila (UTC+08:00) for display, date boundaries, DOC, and report filtering; timestamps stored in UTC. | Accepted |
| D-11 | Logbooks: pond preparation, pre-stocking water quality, feeding, water quality, growth sampling, treatment/health intervention (chemicals and supplements), mortality, post-production, and general notes. | Accepted (revised in v1.4) |
| D-12 | Quality targets: local-network operation without Internet; no offline queue/sync in Phase 1; p95 under 500 ms for ordinary local API operations under documented conditions; no capstone uptime SLA; daily database and document backup on separate storage with demonstrated restore; print-friendly reports; all P1 and farm-isolation tests pass with no open critical/high defects. | Accepted |
| D-13 | Production structure follows the manuscript: a Production Cycle (single fry source) groups Pond Batches; each batch is stocked into one pond; all logs and harvests attach to a batch; batch closure precedes cycle closure. | Accepted |
| D-14 | The Objective 2 "transaction mechanism" covers both inventory movements (receipt, usage, adjustment per lot) and financial transactions (expenses and income, including income generated from sales). | Accepted |
| D-15 | Cycle activation warned about missing compliance documents and recorded the Owner's override. | Superseded by D-30 |
| D-16 | A System Administrator (host-level) account exists for installation, maintenance, reference data, farm activation, and account recovery. It is not an end-user role and cannot access farm production, inventory, sales, financial, or document records. Developers have no personal production accounts. | Accepted |
| D-17 | Scope follows manuscript Table 6 with the P1/P2 split in Section 1. P2 starts only after all P1 acceptance tests pass. | Accepted |
| D-18 | The printable sales record is an internal document, not a BIR-registered official receipt or invoice. | Accepted |
| D-19 | Inventory: a movement ledger per lot with moving-average unit cost; usage beyond stock on hand warns, saves, and flags the lot for reconciliation; corrections use reversing adjustments. | Accepted |
| D-20 | Technicians may edit their own log and harvest entries while the batch is not Closed; all edits are audit-logged. | Accepted |

## **Defaults (chosen in v1.4)**

| Default | Status |
| :---- | :---- |
| DOC convention: stocking day counts as DOC 0. | Confirmed |
| Required permits: BFAR registration, ECC, and the Mayor's/Business permit are the starting list (now presets marked Required, D-30); a Farm Owner can switch Required on or off for any preset. | Confirmed |
| Document rules: PDF, JPG, PNG up to 10 MB; 30-day expiry alert window. | Confirmed |
| Choice lists: pond purpose, construction type, inlet/outlet types, farming systems, feeding methods, intervention types, mortality causes and diseases, and seeded transaction categories (Section 5). | Confirmed |
| Harvest quality checks: smooth shell, intact appendages, no necrosis (from manuscript Ref 7.1), as optional yes/no checkboxes in a collapsed "Quality check (optional)" section; blank values are reported as "Not assessed". | Confirmed |
| Stocking is allowed only in grow-out ponds; nursery-to-grow-out transfers are not modeled in Phase 1. | Confirmed |
| Cycle expenses are allocated to batches by stocked PL count. | Confirmed |
| Who stocks a batch: Owner or Technician; every other status change is Owner-only. | Confirmed |

## **Resolved site and operations decisions (v1.5)**

All items previously listed as unresolved are resolved by the decisions below.

| ID | Decision | Status |
| :---- | :---- | :---- |
| D-21 | Production host: one dedicated small PC (mini-PC acceptable) at the farm office with 8–16 GB RAM, SSD storage, and Windows 11 Pro or Ubuntu LTS, on a UPS. Database: SQL Server Express (free; 10 GB per-database limit is sufficient for one farm). Network: LAN only, fixed local IP, no port forwarding or Internet exposure. TLS: HTTPS using a certificate issued by the team's own local certificate authority, with the root certificate installed on each farm device. | Accepted |
| D-22 | Backups: automated daily SQL Server backup and document-folder copy to an external drive; a weekly encrypted copy kept off-site by the Farm Owner; restore demonstrated before release and documented in the user guide. | Accepted |
| D-23 | Pond connectivity: before deployment, perform a phone walk test of Wi-Fi coverage at every pond; add an outdoor access point where coverage is weak. Fallback: paper-then-enter. Printable log sheets mirroring each logbook form are a P1 deliverable; entries are keyed in the same day with ObservedAt set to the actual reading time, not the entry time. | Accepted |
| D-24 | System Administrator custody: held by the development team during the capstone; at handover, transferred to a person named by the partner farm, with the password changed at transfer. Account recovery: the Owner requests recovery in person or by phone; the System Administrator verifies identity through a second Farm Owner or a pre-agreed security question, issues a temporary password, and the action is audit-logged. | Accepted |
| D-25 | Retention: financial records (sales and transactions) kept at least 5 years, matching the BIR's current books-of-accounts preservation rule; compliance documents kept while valid and archived for 5 years after expiry; production records kept for the life of the system as traceability history; personal data in user accounts deactivated rather than deleted and limited to what is needed, consistent with the Data Privacy Act of 2012. Confirm with the adviser or partner farm before release. | Accepted (confirm with adviser) |
| D-26 | Performance test conditions: one farm with 2 years of data (10 ponds, 20 batches, about 30,000 log entries) generated by a seed script; 5 concurrent users (2 Owners, 3 Technicians); target p95 under 500 ms for ordinary API operations over the LAN, excluding large reports and file uploads. | Accepted |
| D-27 | Pilot scope: a single deployment at the partner farm. A second farm account (test farm) is registered on the same server for the multi-farm pilot demonstration and for farm-isolation tests. Manuscript Section 1.2 is updated to match (Appendix B). | Accepted |

## **Revisions after the interface review (v1.6)**

| ID | Decision | Status |
| :---- | :---- | :---- |
| D-28, D-29 | Recorded in decisions.md (code namespace stays Capstone; client served from its own origin). | Accepted |
| D-30 | Compliance records without files or approval: tracked by category, preset or custom title, required reference number (unique among current records in a category), optional issuing agency, issue date, expiry date or perpetual, and notes/location. No upload, storage, download, or review; required permits are presets and give reminders only, at the dashboard and at a cycle's first stocking. Renew archives the earlier record. Supersedes D-15 and the file and review parts of D-06. | Accepted |
| D-31 | Structured farm address (line 1, line 2, city/municipality, province, postal code, country; no separate barangay field) and optional total farm area in hectares with a warning when ponds exceed it; ownership type and operational details removed from the profile and sign-up; Ponds tab on the farm profile. | Accepted |
| D-32 | Farming system vs pond type: super-intensive in earthen, or extensive in concrete or HDPE-lined, is flagged with a warning and never rejected. | Accepted |

## **Unresolved items**

None as of v1.5. The retention periods in D-25 should be confirmed with the adviser or partner farm before release.

## **Official references**

* PNS/BAFS 197:2017 Code of Good Aquaculture Practices (GAqP) for Shrimp and Crab (source of the water-quality ranges, as cited in the manuscript).
* ASP.NET Boilerplate repository and support notice: https\://github.com/aspnetboilerplate/aspnetboilerplate
* ASP.NET Boilerplate Angular startup template (JWT authentication, Migrator, tests, multi-tenancy default): https\://aspnetboilerplate.com/Pages/Documents/Zero/Startup-Template-Angular
* ASP.NET Boilerplate multi-tenancy and IMustHaveTenant data filter: https\://aspnetboilerplate.com/Pages/Documents/Multi-Tenancy
* .NET 8 and .NET 9 end of support (10 November 2026): https\://devblogs.microsoft.com/dotnet/dotnet-8-9-end-of-support/
* Microsoft .NET lifecycle: https\://learn.microsoft.com/en-us/lifecycle/products/microsoft-net-and-net-core

# **Appendix B. Manuscript alignment notes**

These are suggested edits to the Capstone 1 manuscript so that it and this specification agree.

| Manuscript location | Issue | Suggested change |
| :---- | :---- | :---- |
| 1.4 Definition of Terms, Role-Based Access Control | Names the roles "Administrator and Farm Technician", while the rest of the manuscript uses Farm Owner. | "...restricts system functionalities based on assigned user roles: Farm Owner and Farm Technician. A separate System Administrator account, maintained by the development team, supports installation, maintenance, and account recovery and has no access to farm production records." |
| Table 6, Ref 1.1 | "initial administrator credentials". | "initial Farm Owner credentials". |
| 1.2.2 Limitations | Add the System Administrator clarification. | "The System Administrator is a technical support account, not an end user of the system." |
| 1.2 Scope ("pilot testing in selected farms") vs 1.1.1 ("a partner shrimp farm") | Plural vs single pilot site. | "The system will be deployed and pilot-tested at the partner farm; a second farm account is used to demonstrate and test multi-farm data isolation." (decision D-27) |
| 1.1.2 Objective 2, "transaction mechanism to record and track operational movements" | Ambiguous meaning. | "...integrated with a transaction mechanism that records inventory movements and financial transactions." |
| 1.2.1 Scope, Digital Logbooks | Lists water quality, feed, and chemicals and supplements only, while Table 6 also includes growth sampling and mortality. | Add growth sampling and mortality to the logbook list. |
| Section 3.1.2.4 and 3.1.2.5 | Two tables are numbered "Table 4". | Renumber the water-quality table and later tables. |
| Table 6, Ref 2.2 "sends renewal reminders" | Implies email/SMS. | "...displays in-app renewal reminders." |
| Table 6, Ref 7.3 "Generates sale invoices and receipts" | Could be read as official BIR receipts. | "...generates a printable sales record." |
| Table 6, Ref 7.4 "triggers insurance/compensation processes" | No external integration in scope. | "...produces a failure report that can support insurance or compensation claims." |
| Table 6, Refs 5.4, 2.2 (batch-level), 8.1 (charts), Table 5 biosecurity and operational continuity KDEs | Planned as P2 in this specification. | Mark these as enhancements to be delivered if time allows, or list them under future work. |
| Table 6, Ref 5.1 "Validates prerequisite compliance documents before cycle activation" | Specification reminds instead of blocking (D-30). | "...checks prerequisite compliance permits at cycle activation and reminds the farm when any have no current record; production is not blocked." |
| Table 6, Ref 2.2 Document Certification Management (upload, review, download) | Since D-30 the system records permit metadata only; no files are uploaded or reviewed. | "...records farm-level compliance permits (category, reference number, issuing agency, issue and expiry dates, and hard-copy location), tracks their expiry status, and displays in-app renewal reminders." |
| Table 5, Key Data Elements for the farm profile (if ownership type or a single address field is listed) | The profile now has a structured address and total area; ownership type and operational details were removed (D-31). | List: farm name; address (line 1, line 2, city/municipality, province, postal code, country); total farm area (ha); contact details. |
| Table 3 or Table 5, Pond Type and Farming System | The two are now cross-checked with a warning (D-32). | "The system flags farming-system choices that are unusual for the pond type." |

# **Appendix C. Revision history**

| Version | Date | Changes |
| :---- | :---- | :---- |
| 1.2 | Before 21 Oct 2026 | Previous planning version. Named the template as ASP.NET Zero 10.2.0, left the target framework unspecified, and mixed JWT with a secure-cookie sign-in direction. |
| 1.3 | 21 Oct 2026 | Reconciled Local MVP hosting with SaaS-ready architecture (FarmId \= TenantId); corrected the template to ASP.NET Boilerplate v10.2.0 on .NET 9 with Angular 19.2.1; standardized JWT authentication; made compliance documents P1 with expiry tracking and a file-storage interface; Owners can create Owner and Technician accounts; defined the cycle lifecycle and one-non-Closed-cycle rule; locked in GAqP ranges with flag-not-block behavior; added mortality logs; set Asia/Manila time zone; added roadmap, decision log, lifecycle and parameter tables, and updated tests. |
| 1.4 | 21 Oct 2026 | Aligned with the Capstone 1 manuscript: feature scope traced to Table 6 with a P1/P2 split; Production Cycle → Pond Batch → logs structure; hatchery, buyer, and feed/supplement inventory; transaction mechanism covering inventory movements and financial records; expanded logbooks (pre-stocking water quality, growth sampling, treatments, mortality causes, post-production); alkalinity and nitrate parameters with monitoring frequencies; harvest grading, quality checks, and sales per grade; failure declaration; computed indicators (density, DOC, ABW, population, biomass, FCR, survival); compliance warning with recorded override; System Administrator account; Table 3 pond master data; permission matrix, acceptance criteria, milestones, and tests rewritten; manuscript alignment notes added. |
| 1.5 | 21 Oct 2026 | Confirmed all v1.4 defaults (required-for-production permits with Owner on/off setting; optional harvest quality checks). Resolved all unresolved items: production host and network (D-21), backups (D-22), pond connectivity with paper-then-enter fallback and printable log sheets (D-23), System Administrator custody and account recovery (D-24), retention periods (D-25), performance test conditions (D-26), and pilot scope with a second test farm (D-27). Updated TRD, recovery journey, release milestone, and manuscript alignment note. |
| 1.6 | 22 Oct 2026 | Interface review revisions. D-30: compliance records tracked by reference number, category, and dates; file storage, download, and the approval workflow removed; required permits became presets with reminder-only checks at stocking (supersedes D-15 and part of D-06); renewals, filters, and a View dialog. D-31: structured farm address, total farm area, ownership type and operational details removed, Ponds tab on the farm profile. D-32: farming system vs pond type warning. Updated AC-03, AC-09, the schema, app flow, permissions, tests, and Appendix B. |
