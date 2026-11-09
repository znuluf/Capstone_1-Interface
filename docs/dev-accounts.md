# Development accounts

In a Codespace, only the sample farm below is seeded (`SEED_SAMPLE_DATA=1`), and the `admin` password is your `ADMIN_INITIAL_PASSWORD` secret. The `pilot-farm` and `test-farm-b` accounts are the older development data used by the tests.

The older farms are seeded only when the environment is Development (or `Seed:DevelopmentData` is true). Never use these in a shared or production environment; the farm's System Administrator password comes from `SystemAdmin:InitialPassword` there.

| Farm code | Username | Role | Password |
| :---- | :---- | :---- | :---- |
| `pilot-farm` | `owner` | Farm Owner | `Fpms@2026` |
| `pilot-farm` | `tech` | Farm Technician | `Fpms@2026` |
| `test-farm-b` | `owner` | Farm Owner | `Fpms@2026` |
| (blank) | `admin` | System Administrator | `Fpms@2026` (databases created by the original template may still use `123qwe`) |

The pilot farm includes a reference cycle (C-2026-01) with a harvested batch, a stocked batch and logs for indicator checks; the second farm is used for farm-isolation tests (D-27).

## Codespace sample database (FPMS_Sample)

Started with `SEED_SAMPLE_DATA=1 bash .devcontainer/start-fpms.sh`. One test farm, all passwords `Fpms@2026`.

| Farm code | User | Role |
|---|---|---|
| `gensan-semi` | `owner` (Elena Dela Cruz) | Farm Owner |
| `gensan-semi` | `tech1`, `tech2`, `areyes` | Farm Technician |
| `gensan-semi` | `rgarcia` | Farm Technician, inactive (left after the first cycle; his entries stay) |

The farm used the code `tambler-shrimp` until about two months before the seed date (DEC-78). Typing the old code on the sign-in page shows and fills in `gensan-semi`.

**Dates are counted back from the day the database is seeded**, so the running batches always end yesterday and the dashboard, the 30-day preparation warning and the permit alerts look current. The data is built by `SampleDataBuilder` and is the same shape every time. It is made to show the table and list features of `feature/table-and-data-presentation`:

| Area | What is in the sample |
|---|---|
| Ponds | 28 ponds named by construction type: EP-01 to EP-18 earthen (semi-intensive), CP-01 to CP-06 concrete and HP-01 to HP-04 HDPE-lined (both intensive). 26 active, so the pond cards need "Show more". Every status appears: In production (15), Post-harvest (EP-11 harvested, EP-12 failed), Under preparation (EP-13, HP-04), Prepared (EP-14; HP-03 prepared 41 days ago, with the stale warning), Under maintenance (CP-04), Inactive (CP-05), Available (CP-06, EP-17, EP-18) and Archived (EP-15, EP-16). That is 8 filter options, so the status filter is a dropdown. |
| Pond history | Created, status changes, archiving, an area correction on EP-03 after its batches closed (2,500 → 2,450 m²; earlier batches keep 2,500), and preparation changes: an entry edited and an entry removed on EP-13, a reopened preparation on HP-04 and an abandoned one on CP-06. |
| Hatcheries and deliveries | GenSan Bay Hatchery (Accredited, a current and an expired health certificate), Sarangani Aqua Hatchery (Pending), Kiamba Coastal Hatchery (Not accredited, no certificate, no SFSC). Seven stocked deliveries with shortfalls, plus one rejected at the gate and one ordered for three days after the seed date. |
| Cycles | Seven cycles with the app's codes (`yyyy-MM-hatchery-nn`): four closed, one waiting to be closed (EP-11 harvested, EP-12 failed with AHPND suspected), and two running at about DOC 75 and DOC 28. 43 batches; CP-04 failed with white spot in a closed cycle; one batch was reopened and closed again; EP-06 is stocked below the density band and EP-10 above it. |
| Logs | Two feeding sessions a day (time fed typed for the last 14 days), water quality (weekly; every second day on running batches) with a few out-of-range readings, growth samples, mortality (disease entries marked high mortality), probiotic, lime, zeolite and BKC applications, a voided duplicate entry, a rain day with the PM session Not fed, a blank day on EP-05 and a missing PM session on HP-02. Low DO on EP-02 and high pH on HP-01 yesterday. |
| Harvests and sales | Partial and total harvests over several size grades, buyer re-weigh (accepted kg), transport details on the processing-plant sales, paid, partly paid, unpaid, overdue and voided sales across five buyers (one inactive). EP-11 has kg given to staff, spoiled kg and kg not accounted for. A BKC treatment 12 days before the EP-11 harvest triggers the withdrawal warning. |
| Inventory | Feed, supplement and chemical lots per cycle, a grower lot that ran below zero and is flagged for reconciliation, a premix lot below its reorder level and near expiry, and an item with no stock. |
| Permits | Current, expiring in 18 days (GAqP farm certification), expired (water permit), and a renewed barangay clearance with its archived original. |

To rebuild it in an existing Codespace, stop the servers, drop the database and run the script again:

```bash
cd aspnet-core/docker/sqlserver && . ../../../.devcontainer/local.env && docker compose exec -T sqlserver \
  /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$SA_PASSWORD" -Q "ALTER DATABASE [FPMS_Sample] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [FPMS_Sample]"
cd - && SEED_SAMPLE_DATA=1 bash .devcontainer/start-fpms.sh
```

The farm in the clean `FPMS` database has no sample data.

## Codespace simple sample database (FPMS_Simple)

Started with `SEED_SAMPLE_DATA=simple bash .devcontainer/start-fpms.sh`. One small test farm, all passwords `Fpms@2026`. Built by `SimpleSampleDataBuilder`; fixed dates.

| Farm code | User | Role |
|---|---|---|
| `rkabubba-aqua` | `arkabubba` (Abi Rkabubba) | Farm Owner |
| `rkabubba-aqua` | `samsedel` (Sam Amsedel) | Farm Owner |
| `rkabubba-aqua` | `konacsus` (Kim Onacsus) | Farm Technician |

Rkabubba Aqua Farm (test), Brgy. Tambler, General Santos City; farming system Intensive. Three ponds, one per construction type, each stocked inside its intensive density band: EP-01 earthen 2,000 m² at 80 PL/m², CP-01 concrete 600 m² at 120 PL/m², HP-01 HDPE-lined 1,000 m² at 120 PL/m².

One finished 75-day cycle, `2026-02-GBH-01` (GenSan Bay Hatchery, accredited): ponds prepared 20 to 30 Jan 2026, stocked 2 Feb, daily AM and PM feeding, weekly water quality, growth samples every 14 days, probiotic every 14 days and two mortality entries. Total harvest on 18 Apr (DOC 75, about 16 g, graded 60/70 and 50/60); the 60/70 went to a processing plant (re-weighed, paid in 7 days) and the 50/60 to a market buyer for cash. Ponds cleaned and left to dry, batches closed 28 Apr, cycle closed 30 Apr. The ponds stand idle (Available) through the lean season, May to June.

 (development only)

The sign-in page shows one-click buttons for the accounts above when the app runs from `ng serve` / `yarn start` (the development environment). The list is in `angular/src/environments/environment.ts` (`devAccounts`); `environment.prod.ts` leaves it empty, so production builds show no buttons and contain no passwords. A button fills the farm code, username and password and signs in. Only the accounts seeded in the database you are running will work, and `admin` in a Codespace uses your `ADMIN_INITIAL_PASSWORD` secret, so its button only works where the password is still `Fpms@2026`.
