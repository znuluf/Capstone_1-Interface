# References and values used in the system

One place to cross-check every standard, rule and default value in FPMS against its source.
Keep this file in step with the code: if a value changes, change it here and in `decisions.md`.

Status key: **Verified** = checked against the source document. **To verify** = taken from the source as read, not yet re-checked line by line. **Team default †** = chosen by the Capstone team, no external source; confirm with the adviser or partner farm.

## 1. Source documents

| Short name | Document | Used for | Where decided |
|---|---|---|---|
| PNS/BAFS 197:2025 | Philippine National Standard, Code of Good Aquaculture Practices (shrimp), Annex B (water quality) and Annex C (stocking density). Replaces PNS/BAFS 197:2017. | Water-quality ranges, density bands | DEC-56, DEC-65 |
| PNS/BAFS 197:2017 | Earlier GAqP code (superseded). Cited in the Capstone 1 manuscript. | Original water ranges in spec v1.x (D-09) | D-09, DEC-12 (superseded by DEC-56) |
| PNS/BAFS 135:2025 | Aquaculture standard, clauses 9.12, 9.13, 8.4.2.6, Annex A | Treatment records, withdrawal, transport permit | DEC-55, DEC-57 |
| PNS/BAFS 338:2022 | Traceability standard, Annex B records | Trace report, feeding time, transport details | DEC-55, DEC-71, DEC-72 |
| BFAR FAO 225-1, s. 2007 | Fisheries Administrative Order on vannamei: farm accreditation (3 years), Shrimp Fry Source Certification (SFSC), nine records per pond per cycle | SFSC field, Farm Certification preset, record checklist | DEC-70, DEC-74 |
| Draft BFAR Administrative Circular (2026, "draft for pubcon") | Not in force. Farm Certification via GAqP (3 years, yearly monitoring), SFSC Sec. 10(g), DTP Sec. 9(h), Annex A diseases, Annex B certification | Context for DEC-70, DEC-74; watch for the final text | DEC-70, DEC-74 |
| Shrimp Farmers' Manual | Stocking and harvest forms, PCR timing hint | Dead-at-stocking, dead-at-harvest, PCR hint | DEC-55, DEC-59, DEC-62 |
| Capstone 1 manuscript | Objectives, Tables 3 to 6, definition of terms (e.g. final FCR) | Scope, pond master data, indicator definitions | spec v2.6 |
| Data Privacy Act of 2012 (RA 10173) | Personal data handling | Account retention | D-25 |
| BIR books-of-accounts preservation rule | Financial record retention (at least 5 years) | Retention | D-25 |

Links given in `docs/fpms.md` (technology references):
- ASP.NET Boilerplate: https://github.com/aspnetboilerplate/aspnetboilerplate
- Angular startup template: https://aspnetboilerplate.com/Pages/Documents/Zero/Startup-Template-Angular
- Multi-tenancy and IMustHaveTenant: https://aspnetboilerplate.com/Pages/Documents/Multi-Tenancy
- .NET 8 and 9 end of support (10 Nov 2026): https://devblogs.microsoft.com/dotnet/dotnet-8-9-end-of-support/
- Microsoft .NET lifecycle: https://learn.microsoft.com/en-us/lifecycle/products/microsoft-net-and-net-core

## 2. Water-quality ranges (PNS/BAFS 197:2025 Annex B, P. vannamei)

Code: `ParameterDefinitionCreator.cs`. Status: **To verify** against the PDF (DEC-56 says adviser to confirm). Farms override in Farm Standards (DEC-58).

| Parameter | Unit | Optimal range in system | Flags | Monitoring (guidance) |
|---|---|---|---|---|
| Dissolved oxygen | ppm | 4.0 or more | low | 2x daily (AM, PM) |
| Temperature | °C | 25 to 30 | low and high | 2x daily |
| pH | pH | 7.5 to 9.0 | low and high | 2x daily |
| Salinity | ppt | 15 to 25 | low and high | 1x daily |
| Total ammonia nitrogen (TAN) | ppm | up to 1.0 (source range 0.1 to 1.0) | high only | Weekly |
| Nitrite | ppm | up to 0.5 | high only | Weekly |
| Alkalinity | ppm CaCO₃ | 100 to 200 | low and high | Weekly |
| Nitrate | ppm | up to 1.2 (source 0.6 to 1.2) | high only | As needed |

Not coded as a parameter: unionized ammonia up to 0.2 ppm (DEC-56 lists it; the system records TAN).
Physical limits (entry-error bounds, not biology): DO 0 to 20, temperature 0 to 45, pH 0 to 14, salinity 0 to 60, TAN 0 to 100, nitrite 0 to 100, alkalinity 0 to 500, nitrate 0 to 500.

**Known mismatch:** `docs/fpms.md` decision D-09 and the parameter table still show the older 2017 values (DO 5.0 to 9.0, temperature 28 to 32, pH 7.0 to 8.3, salinity 15 to 35, TAN under 0.03, nitrite under 1.0). The code uses the 2025 values above. Update D-09 to point to DEC-56.

## 3. Stocking density bands (PNS/BAFS 197:2025 Annex C), PL per m²

Code: `DensityBandCreator.cs`. Status: **To verify**. Outside the band: warns and stores a flag, never blocks.

| Farming system | Earthen | Concrete | HDPE-lined |
|---|---|---|---|
| Extensive | 1 to 30 | 1 to 30 | 1 to 30 |
| Semi-intensive | 40 to 60 | 40 to 60 | 40 to 60 |
| Intensive | 70 to 90 | 100 to 140 | 100 to 140 |

Concrete takes the lined values (source gives earthen and lined only). Extensive in a concrete or lined pond raises a pond warning (DEC-65). Super-intensive was removed.

## 4. Team defaults (no external source) †

Code: `FarmStandards.cs`. All editable by the Owner in Farm Standards. Confirm with the partner farm.

| Setting | Default | Range allowed |
|---|---|---|
| Youngest PL age for stocking | 10 days | 1 to 60 |
| Oldest PL age for stocking | 20 days | 1 to 60 |
| Feeding session above 7-day average by | 3x | 1.5 to 10 |
| Daily mortality above (share of estimated population) | 1 % | 0.1 to 50 |
| ABW drop from previous sample above | 20 % | 1 to 90 |
| Buyer accepted kg differs from farm kg by more than | 10 % | 1 to 50 |
| Stocking window | 1 day (max 3) | DEC-63 |

## 5. Permits and licenses presets

Code: `FarmDefaults.cs`. Required presets only give a dashboard reminder, never block (DEC-18).

| Preset | Agency | Required | Basis |
|---|---|---|---|
| Mayor's / Business Permit | Municipal / City BPLO | Yes | General business law |
| BFAR Fishpond / Aquafarm Registration | BFAR RO XII | Yes | BFAR registration |
| BFAR Shrimp Grow-out Farm Certification (GAqP) | BFAR RO XII | Yes | FAO 225-1 s.2007 (3-year validity); draft circular (DEC-74). Whether it stays required: ask adviser and partner farm |
| Environmental Compliance Certificate (ECC) | DENR-EMB RO XII | Yes | DENR rules |
| Others (Barangay clearance, DTI, Fish Health Certificate, CNC, Wastewater, BIR 2303, Water Permit, FLA, Sanitary, SEC, CDA) | various | No | Optional presets |

## 6. Traceability and records: where each requirement is in the system

| Requirement | Source | System location | Decision |
|---|---|---|---|
| SFSC number (optional field, enforcement on hold) | FAO 225-1 | Fry delivery `SfscNo` | DEC-70 |
| Time of feeding (optional) | PNS/BAFS 338:2022 Annex B | Feeding session `FedAtTime` | DEC-71 |
| One-step-back, one-step-forward batch trace | PNS/BAFS 338:2022 | Trace report `reports/trace/:id` | DEC-72 |
| Flagged stock lots shown at Close Batch | Inventory rule | Close check `FlaggedLots` | DEC-73 |
| Transport details, Local Transport Permit, dead at harvest | 135:2025 (8.4.2.6), 338:2022, Manual | Sale and harvest fields | DEC-55 |
| Dosage, duration, withdrawal days, prescription ref | 135:2025 (9.12, 9.13), 338:2022 | Chemical application, inventory item | DEC-57 |
| PL health certificate, dead at stocking | Manual | Fry delivery, batch | DEC-59 |

Full gap list: `docs/gap-analysis.md` and the Project doc `claude/standards-gap-report.md`.

## 7. Formulas and rules

| Item | Definition | Source |
|---|---|---|
| Final FCR | Total feed ÷ total harvested kg | Manuscript definition |
| Batch production cost | Usage quantity × moving-average unit cost + linked expenses + share of shared costs | spec v2.6 |
| Retention | Financial records 5 years or more; compliance documents while valid plus 5 years; production records life of the system; accounts deactivated, not deleted | D-25 (confirm with adviser) |
| Hand-checked example | `docs/reference-batch.md` | Reference batch B-2026-01-P01 |

## 8. Open items

- Verify sections 2 and 3 against the PDFs, then change "To verify" to "Verified" with the date and checker.
- Add page or clause numbers for each value once checked.
- Add the exact document titles, issuing office and publication dates for every row in section 1 (the repo does not hold them).
- Confirm section 4 defaults with the partner farm.
- Fix the D-09 mismatch in `docs/fpms.md`.
- Re-check the draft BFAR circular when it is finalized.
