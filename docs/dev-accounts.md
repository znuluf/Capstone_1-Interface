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
| `gensan-semi` | `owner` | Farm Owner |
| `gensan-semi` | `tech1`, `tech2` | Farm Technician |

Whiteleg shrimp (vannamei) in semi-intensive earthen ponds, one hatchery. Closed cycle C-2026-01 (stocked 20 Apr, harvested to 3 Aug 2026) and running cycle C-2026-02 (stocked 2 Sep, last entry 14 Sep 2026). Stocking is about 40 PL/m². The farm in the clean `FPMS` database has no sample data.
