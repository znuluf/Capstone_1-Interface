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

## Codespace sample database (FPMS_Simple)

Started with `SEED_SAMPLE_DATA=1 bash .devcontainer/start-fpms.sh` (`simple` also works). It is the only sample database on this branch. One small test farm, all passwords `Fpms@2026`. Built by `SimpleSampleDataBuilder`; fixed dates.

| Farm code | User | Role |
|---|---|---|
| `rkabubba-aqua` | `arkabubba` (Abi Rkabubba) | Farm Owner |
| `rkabubba-aqua` | `samsedel` (Sam Amsedel) | Farm Owner |
| `rkabubba-aqua` | `konacsus` (Kim Onacsus) | Farm Technician |

Rkabubba Aqua Farm (test), Brgy. Tambler, General Santos City; farming system Intensive. Three ponds, one per construction type, each stocked inside its intensive density band: EP-01 earthen 2,000 m² at 85 PL/m², CP-01 concrete 600 m² at 130 PL/m², HP-01 HDPE-lined 1,000 m² at 130 PL/m² (inside the PNS/BAFS 197:2025 intensive bands, 70–90 earthen and 100–140 lined).

One finished 75-day cycle, `2026-02-GSH-01`, with CP fry from Gensan Shrimp Hatchery (Charoen Pokphand Foods Philippines Corporation, Brgy. Tinoto, Maasim) at ₱0.36 per piece, the CP price quoted in the farm interviews: ponds prepared 20 to 30 Jan 2026, stocked 2 Feb, daily AM and PM feeding, weekly water quality, growth samples every 14 days, probiotic every 14 days and two mortality entries, plus two problems farmers named in the interviews: a power interruption on DOC 40 (aerators off, DO 2.8 at dawn, a mortality entry) and heavy rain on DOC 52 (PM feeding skipped, salinity down to 11 ppt). Total harvest on 18 Apr (DOC 75, about 16 g, graded 60/70 and 50/60); the 60/70 from EP-01 and CP-01 went to the local processing plant (re-weighed, paid in 7 days), the 60/70 from HP-01 to a Manila buyer (closed van to Makar Wharf, then ferry; paid in 10 days), and the 50/60 to a market buyer for cash. Ponds cleaned and left to dry, batches closed 28 Apr, cycle closed 30 Apr. The ponds stood idle through the lean season, May to June. Hatcheries: the three BFAR-accredited P. vannamei hatcheries of Region XII, from the BFAR list as of 30 Nov 2025, with their accreditation numbers and expiry dates (recorded as certificates): Gensan Shrimp Hatchery (CP) `HA01-R12SAR-02092013-RNW101725` and Sto. Niño Aquaculture Corporation `HA02-R12SAR-02092013-RNW101725`, both to 17 Oct 2028, and RDEX Food International Philippines, Inc. (Bawing, General Santos) `HA03-R12-GSC-080718-RNW111521`, to 15 Aug 2027. Permits on file, all current: BFAR fishpond registration, BFAR GAqP farm certification, Mayor's permit, barangay clearance, ECC and BIR registration (test numbers).

A second cycle is running: `2026-09-SNA-01`, with fry from Sto. Niño Aquaculture Corporation (Brgy. Tuyan, Malapatan) at ₱0.33 per piece, its SFSC paper not yet in (no SFSC number on the delivery, so the DEC-79 warnings show at Close Batch, on the trace report and on a sale; type the number on the fry delivery to clear them), ponds prepared 1 to 11 Sep 2026 and stocked 14 Sep 2026, with the day-75 harvest planned for 28 Nov 2026 (before the December to January peak). Its logs run to the day before the database is seeded (at most DOC 74), so the dashboard looks current; seeded after 28 Nov it stops at DOC 74, waiting for the harvest. All three ponds show In production.

Ready to try "Stock a batch": two newer ponds, EP-02 (earthen, 2,000 m²) and HP-02 (HDPE-lined, 1,000 m²), are prepared and marked Prepared, and a fry delivery of 303,000 PL from RDEX Food International Philippines, Inc. (lot `RDX-Bmmdd`) is Received on the seed date and not stocked yet. About 170,000 PL for EP-02 and 130,000 for HP-02 keep both inside the intensive bands. Its Shrimp Fry Source Certificate number is blank, so stocking shows the DEC-79 warning; type it on the delivery first to see the warning go away.

 (development only)

The sign-in page shows one-click buttons for the accounts above when the app runs from `ng serve` / `yarn start` (the development environment). The list is in `angular/src/environments/environment.ts` (`devAccounts`); `environment.prod.ts` leaves it empty, so production builds show no buttons and contain no passwords. A button fills the farm code, username and password and signs in. Only the accounts seeded in the database you are running will work, and `admin` in a Codespace uses your `ADMIN_INITIAL_PASSWORD` secret, so its button only works where the password is still `Fpms@2026`.
