# Reference batch: hand-calculated indicators

The development seed creates one reference batch so the computed indicators (Capstone-Planning.md Section 5) can be checked against hand calculations. The automated test `Indicator_Tests.Reference_batch_indicators_match_hand_calculations` asserts every value below; the API smoke test checks final FCR and survival through the API.

## Source records (pilot-farm, batch B-2026-01-P01, pond GP-01 in a fresh development database; P-01 in one converted from before step B)

| Record | Value |
| :---- | :---- |
| Pond area | 2,000 m² |
| Stocked | 1 Jun 2026 (Asia/Manila), 200,000 PL |
| Feeding | 3 logs × 1,000 kg = 3,000 kg (lot FG-0601 at ₱75/kg) |
| Mortality | 1 log, 10,000 pieces |
| Growth samples | 1 Aug 2026: 100 pcs, 1,200 g · 1 Sep 2026: 100 pcs, 2,000 g |
| Final harvest | 8 Sep 2026 06:00 Manila (7 Sep 22:00 UTC), 2,500 kg, ABW 17.5 g |
| Grade lines | 2,000 kg at 55 pcs/kg · 500 kg at 65 pcs/kg |

## Calculations

| Indicator | Formula (Section 5) | Working | Result |
| :---- | :---- | :---- | :---- |
| Stocking density | PL stocked ÷ area | 200,000 ÷ 2,000 | **100 PL/m²** |
| DOC | farm-local date − stocking date (stocking day = 0) | 11 Jun − 1 Jun | 10 (example) |
| Cumulative feed | Σ feeding kg | 1,000 + 1,000 + 1,000 | **3,000 kg** |
| ABW of a sample | sample weight ÷ count | 2,000 g ÷ 100 | **20 g** (latest sample) |
| Growth rate | ΔABW ÷ days between samples | (20 − 12) ÷ 31 | **0.258 g/day** |
| Harvested pieces | Σ grade kg × pcs/kg | 2,000 × 55 + 500 × 65 | **142,500** |
| Estimated population | stocked − mortality − harvested | 200,000 − 10,000 − 142,500 | **47,500** |
| Estimated standing biomass | population × latest sample ABW ÷ 1,000 | 47,500 × 20 ÷ 1,000 | **950 kg** |
| FCR to date | feed ÷ (biomass + harvested kg) | 3,000 ÷ (950 + 2,500) | **0.870** |
| Final FCR | total feed ÷ total harvested kg | 3,000 ÷ 2,500 | **1.20** |
| Survival rate | harvested pieces ÷ stocked × 100 | 142,500 ÷ 200,000 × 100 | **71.25 %** |
| Culture days | last harvest date − stocking date (farm-local) | 8 Sep − 1 Jun | **99 days** |
| Current / final ABW | harvest ABW when given | | **17.5 g** |

Notes:
- The harvest happened at 22:00 UTC on 7 Sep, which is 06:00 on 8 Sep in Asia/Manila; culture days use the farm-local date (D-10), so the result is 99, not 98.
- Batch production cost for the same batch: inventory usage 3,000 kg × ₱75 = ₱225,000, plus its share of the ₱45,000 labor expense linked to the cycle (allocated by stocked PL count, D-14). Purchases appear in the cash ledger when received and are not added again (Capstone-Planning.md Section 5 cost note).
