# Development accounts

In a Codespace, the two sample farms below are seeded by default (`SEED_SAMPLE_DATA=0` gives the clean database instead), and the `admin` password is your `ADMIN_INITIAL_PASSWORD` secret. The `pilot-farm` and `test-farm-b` accounts are the older development data used by the tests.

The older farms are seeded only when the environment is Development (or `Seed:DevelopmentData` is true). Never use these in a shared or production environment; the farm's System Administrator password comes from `SystemAdmin:InitialPassword` there.

| Farm code | Username | Role | Password |
| :---- | :---- | :---- | :---- |
| `pilot-farm` | `owner` | Farm Owner | `Fpms@2026` |
| `pilot-farm` | `tech` | Farm Technician | `Fpms@2026` |
| `test-farm-b` | `owner` | Farm Owner | `Fpms@2026` |
| (blank) | `admin` | System Administrator | `Fpms@2026` (databases created by the original template may still use `123qwe`) |

The pilot farm includes a reference cycle (C-2026-01) with a harvested batch, a stocked batch and logs for indicator checks; the second farm is used for farm-isolation tests (D-27).

## Codespace sample database (FPMS_Sample)

The default in a Codespace (`bash .devcontainer/start-fpms.sh`). Two test farms, every password `Fpms@2026`. Reset with `bash .devcontainer/reset-data.sh`.

| Farm code | User | Role |
|---|---|---|
| `gensan-semi` | `owner` | Farm Owner |
| `gensan-semi` | `tech1`, `tech2` | Farm Technician |
| `KIAMBA-INTENSIVE` | `rsantos` | Farm Owner |
| `KIAMBA-INTENSIVE` | `mreyes`, `agarcia` | Farm Technician |
| `KIAMBA-INTENSIVE` | `bvillanueva` | Farm Technician, deactivated (cannot sign in) |

### gensan-semi
Whiteleg shrimp (vannamei) in semi-intensive earthen ponds, one hatchery. Closed cycle C-2026-01 (stocked 20 Apr, harvested to 3 Aug 2026) and running cycle C-2026-02 (stocked 2 Sep, last entry 14 Sep 2026). Stocking is about 40 PL/m².

### KIAMBA-INTENSIVE
Intensive farm in Kiamba, Sarangani: four HDPE-lined grow-out ponds of 1,000 m² (GP-01 to GP-04), GP-05 under maintenance, an earthen reservoir. About a year of records, 10 Nov 2025 to 31 Oct 2026; stocking 120 to 130 PL/m². The farm code and usernames follow the suggested formats (DEC-75).

| Cycle | Ponds | State | What it shows |
| :---- | :---- | :---- | :---- |
| `2025-11-SBH-01` | GP-01, GP-02 | Closed | Partial harvest on GP-01; sales with transport details, paid. |
| `2026-03-SBH-01` | GP-03, GP-04 | Closed | GP-04 failed at day 44 (suspected AHPND): disease mortality, oxytetracycline on prescription with a 30-day withdrawal, a 180 kg salvage harvest recorded as not sold. |
| `2026-07-SBH-01` | GP-01, GP-02 | Harvested, not closed | Ready for Close Batch: a Grower lot flagged for reconciliation, 10 kg not sold (staff use, spoiled), 5 kg not accounted for, a re-weighed sale half paid and overdue, a credit sale not yet paid. |
| `2026-10-KCH-01` | GP-03, GP-04 | Running (DOC 28 on 31 Oct) | Second hatchery (accreditation pending, no SFSC yet); a Not fed session; low DO on the last reading. |

Also: daily dawn water quality and weekly TAN, nitrite and alkalinity (a few readings out of range), weekly growth samples, weekly probiotic, typed feeding times (blank every fifth day), permits including a renewed sanitary permit and a water permit expiring 20 Nov 2026. The farm in the clean `FPMS` database has no sample data.
