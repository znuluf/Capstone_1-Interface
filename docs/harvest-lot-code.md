# Harvest lot code

Every harvest gets one short lot code, for example `26-0-24-03-07-02`. The code follows the shrimp from the pond to the buyer, and is what a buyer, processor or BFAR quotes in a recall.

The format is the adviser's (year, area, barangay or municipality, farm, pond), with a harvest number added at the end. Without it the code would name a pond for a whole year, not one harvest.

Decision: [DEC-83](../decisions.md) (proposed until the adviser confirms the points under [Open questions](#open-questions)). Spec: Harvest data model and AC-49 in [Capstone-Planning.md](Capstone-Planning.md).

## Format: `YY-A-LL-FF-PP-HH`

The code has six parts and is 16 characters long. Every part comes from records the system already holds, so nobody types a lot code.

| Part | Meaning | Example | Where it comes from |
| :---- | :---- | :---- | :---- |
| `YY` | Year of the harvest (farm time) | `26` | The harvest date |
| `A` | Area: `0` General Santos City, `1` Sarangani; `2` to `9` free for new areas | `0` | The farm address |
| `LL` | Barangay (General Santos) or municipality (Sarangani) | `24` | The farm address, using the [place codes](#place-codes) |
| `FF` | The farm's number within that barangay or municipality, across all farms | `03` | Given with the farm's first lot code |
| `PP` | The pond's number within the farm | `07` | Given when the pond is created |
| `HH` | The pond's harvest number for the year | `02` | Counted by the system |

Read aloud, `26-0-24-03-07-02` is: 2026, General Santos, barangay Tambler, the third farm registered there, pond 7 of that farm, its second harvest of 2026.

## Place codes

The place codes are our own two-digit list, in the same order as the farm address dropdown (`angular/src/shared/fpms/coverage-area.ts`). In code they are `LotPlaces` in `Capstone.Core/Harvests/HarvestLotCodes.cs`.

A number never changes meaning. A new barangay or municipality gets the next free number, never a reused one.

**General Santos City barangays (area 0)**

| Code | Barangay | Code | Barangay | Code | Barangay |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 01 | Apopong | 10 | Dadiangas North | 19 | Olympog |
| 02 | Baluan | 11 | Dadiangas South | 20 | San Isidro (Lagao 2nd) |
| 03 | Batomelong | 12 | Dadiangas West | 21 | San Jose |
| 04 | Buayan | 13 | Fatima | 22 | Siguel (Bawing) |
| 05 | Bula | 14 | Katangawan | 23 | Sinawal |
| 06 | Calumpang | 15 | Labangal | 24 | Tambler |
| 07 | City Heights | 16 | Lagao (1st & 3rd) | 25 | Tinagacan |
| 08 | Conel | 17 | Ligaya | 26 | Upper Labay |
| 09 | Dadiangas East | 18 | Mabuhay | | |

**Sarangani municipalities (area 1)**

| Code | Municipality |
| :---- | :---- |
| 01 | Alabel |
| 02 | Glan |
| 03 | Kiamba |
| 04 | Maasim |
| 05 | Maitum |
| 06 | Malapatan |
| 07 | Malungon |

## Rules

A lot code is given once and never changes, so what is printed on crates and receipts always matches the record.

- **Given on save.** The code is given when the harvest is first saved. Correcting the harvest date or kilos later keeps the code. Codes are never reused and are unique within a farm.
- **The farm's part is fixed.** The area, place and farm number are stored on the farm profile when the farm's first lot code is given. Changing the farm address later does not change them.
- **Pond numbers cover the whole farm.** Pond codes such as `EP-01` and `CP-01` can repeat a number across pond types. The pond lot number (1, 2, 3 … in creation order) cannot. Archived ponds keep theirs.
- **It never blocks a harvest.** If the farm address is outside General Santos and Sarangani, or a General Santos farm has no barangay, the harvest still saves. A warning says what to fix, and the code is given the next time the harvest is saved.
- **One code per harvest.** A grade packed separately can add its grade on the label, for example `26-0-24-03-07-02/6070`, without a second stored code.
- **Limits.** 99 places per area, 99 farms per place, 99 ponds per farm and 99 harvests per pond per year. A larger value prints with more digits rather than failing.

## Where it appears

| Screen or document | What it shows |
| :---- | :---- |
| Harvest page | The code in the page heading |
| Harvests list | A Lot code column; search by lot code |
| Batch, Harvests tab | The code under each harvest's date |
| Sale form | The code beside each harvest grade offered for sale |
| Dispatch receipt | The code on each line; search by lot code in Sales |
| Printable tally sheet | The code in the header, beside the date |
| Trace report | The code on each harvest |
| Farm profile | The farm's part of the code (for example `0-24-03`), or what to fix in the address |

## How it relates to the production cycle and batch

The lot code is the harvest's outside name. The production cycle and batch remain the farm's inside record of how the shrimp were raised.

```
Fry delivery       hatchery, PL count, health certificate, SFSC number
   │  1 delivery starts 1 cycle
Production cycle   e.g. 2026-02-GSH-01
   │  1 batch per pond stocked
Batch              feed, chemical, water, mortality and sampling logs
   │  1 or more harvests (partial and total)
Harvest            lot code, e.g. 26-0-24-03-07-02
   │  1 or more sales from each harvest
Sales              buyer, dispatch receipt, kilos and price
```

From a lot code quoted in a recall, the trace report (DEC-72) follows this chain:
- up to the hatchery and SFSC
- through the feed and treatment records
- down to every buyer

The cycle and batch codes are left out of the lot code for three reasons:
- They are long.
- They show the hatchery code to buyers.
- One batch can produce several lots.

## How it is built

| Part | Where |
| :---- | :---- |
| Generator: farm identity, pond number, harvest number, format | `HarvestLotCoder` in `aspnet-core/src/Capstone.Core/Harvests/HarvestLotCodes.cs` |
| Stored code | `Harvest.LotCode` (unique per farm when set) |
| Farm's fixed part | `FarmProfile.LotAreaCode`, `LotPlaceCode`, `LotFarmNumber` (unique together across farms) |
| Pond number | `Pond.LotNumber`, set when the pond is created (`PondAppService`) or, for older ponds, with their first lot code |
| Harvest number | `NumberSequence` of type `HarvestLot`, scope `P{pond lot number}-{year}` |
| Issued | `HarvestAppService.Create`; also on `Update` when the harvest has no code yet |
| Tests | `aspnet-core/test/Capstone.Tests/Fpms/HarvestTally_Tests.cs` (lot code section) |

The sample farm `rkabubba-aqua` (Tambler, General Santos) is farm `0-24-01`. Its harvests have codes such as `26-0-24-01-01-01`.

## Open questions

To confirm with the adviser. If an answer differs, only the code generator changes.

1. Is the harvest number at the end acceptable? Should a grade packed separately carry its grade as a suffix on the label?
2. Who confirms the farm number: the system (next free number per place), BFAR or the LGU? Should it match an existing registry?
3. Should the place list later map to the official PSGC codes, kept alongside our two-digit codes?
