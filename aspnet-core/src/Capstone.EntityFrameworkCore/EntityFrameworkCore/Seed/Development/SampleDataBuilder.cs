using Capstone.Authorization.Roles;
using Capstone.Domain;
using Capstone.Harvests;
using Capstone.Inventory;
using Capstone.Ponds;
using Capstone.Production;
using Capstone.ReferenceData;
using Capstone.Resources;
using Capstone.Sales;
using Capstone.EntityFrameworkCore.Seed.Farms;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Capstone.EntityFrameworkCore.Seed.Development;

/// <summary>
/// Sample data for the Codespace "FPMS_Sample" database (Seed:SampleData=true). One clearly-labelled test farm
/// (General Santos / Sarangani area) with one Owner and two Technicians, a single hatchery as the only fry source,
/// whiteleg shrimp (vannamei) in semi-intensive earthen ponds, stocked directly with hatchery-bred post-larvae (PL)
/// on the day they arrive after a 30-minute to 2-hour acclimation.
/// History: closed cycle C-2026-01 (stocked 20 Apr 2026, partial and total harvests, sales, batches and cycle closed)
/// and running cycle C-2026-02 (stocked 2 Sep 2026, last entry 14 Sep 2026). Stocking is about 40 PL/m2, the low end of
/// the app's own semi-intensive earthen band. Feeding follows Starter (to about day 20), Grower (to about day 70) and
/// Finisher feeds, as two logged sessions a day. No real farm or personal data.
/// </summary>
public class SampleDataBuilder
{
    public const string FarmCode = "gensan-semi";

    /// <summary>Last day with any sample entry (farm local date).</summary>
    private static readonly DateOnly LastEntryDate = new(2026, 9, 14);

    private readonly CapstoneDbContext _context;

    public SampleDataBuilder(CapstoneDbContext context)
    {
        _context = context;
    }

    // ---- Plans ----
    private sealed record PondSpec(string Prefix, int Number, decimal AreaM2, PondPurpose Purpose);

    /// <summary>One pond stocking. HarvestKg is the whole batch (partial + total); PartialKg is the part taken earlier.</summary>
    private sealed record BatchPlan(string Prefix, int PondNumber, long Pl, long DeadAtStocking, decimal HarvestKg, decimal PartialKg, decimal Fcr, int AcclimMinutes);

    private sealed record Shortfall(ShortfallReason Reason, long Count, string Note);

    private sealed record CyclePlan(string Code, DateOnly Stocking, DateOnly? PartialHarvest, DateOnly? Harvest, DateOnly? Closed, string HatcheryBatchNo, Shortfall[] Shortfalls, BatchPlan[] Batches);

    public void Create()
    {
        var farms = new FarmSeedBuilder(_context);
        var pw = SeedOptions.DevelopmentPassword;

        var farm = farms.EnsureFarm(FarmCode, "GenSan Semi-Intensive Shrimp Farm (test)", "Brgy. Tambler (test data)", "General Santos City", "South Cotabato");
        var owner = farms.EnsureUser(farm.Id, "owner", "Elena", "Dela Cruz", StaticRoleNames.Tenants.FarmOwner, pw);
        var tech1 = farms.EnsureUser(farm.Id, "tech1", "Jun", "Bautista", StaticRoleNames.Tenants.FarmTechnician, pw);
        var tech2 = farms.EnsureUser(farm.Id, "tech2", "Lito", "Mendoza", StaticRoleNames.Tenants.FarmTechnician, pw);

        if (!_context.Ponds.IgnoreQueryFilters().Any(p => p.TenantId == farm.Id))
        {
            SeedFarm(farm.Id, owner.Id, tech1.Id, tech2.Id);
        }
    }

    private static readonly PondSpec[] PondSpecs =
    {
        new("GP", 1, 2000, PondPurpose.GrowOut),
        new("GP", 2, 2500, PondPurpose.GrowOut),
        new("GP", 3, 1500, PondPurpose.GrowOut),
        new("R", 1, 3000, PondPurpose.Reservoir),
    };

    private static readonly CyclePlan[] CyclePlans =
    {
        // Closed cycle, fully logged: 105 days of culture. PL arrived and were stocked the same day, 40 PL/m2.
        // Total harvest 1,176 kg (of it 180 kg as a partial harvest) and 1,412 kg: about 75% and 72% survival at ~19.6 g.
        new("C-2026-01", new DateOnly(2026, 4, 20), new DateOnly(2026, 7, 24), new DateOnly(2026, 8, 3), new DateOnly(2026, 8, 15), "HL-0420",
            new[] { new Shortfall(ShortfallReason.DeadOnArrival, 3000, "Dead in the bags on arrival"), new Shortfall(ShortfallReason.CountDifference, 2000, "Hatchery count was higher than the farm's count") },
            new[] { new BatchPlan("GP", 1, 80000, 150, 1176m, 180m, 1.40m, 60), new BatchPlan("GP", 2, 100000, 200, 1412m, 0m, 1.45m, 90) }),
        // Running cycle stocked 2 Sep 2026; logs run to 14 Sep.
        new("C-2026-02", new DateOnly(2026, 9, 2), null, null, null, "HL-0902",
            new[] { new Shortfall(ShortfallReason.DeadOnArrival, 1500, "Dead in the bags on arrival"), new Shortfall(ShortfallReason.CountDifference, 2500, "Hatchery count was higher than the farm's count") },
            new[] { new BatchPlan("GP", 1, 80000, 120, 0m, 0m, 0m, 75), new BatchPlan("GP", 3, 60000, 90, 0m, 0m, 0m, 45) }),
    };

    /// <summary>Feed stage by day of culture: 0 Starter (to about day 20), 1 Grower (to about day 70), 2 Finisher.</summary>
    private static int FeedStage(int doc) => doc <= 20 ? 0 : doc <= 70 ? 1 : 2;

    /// <summary>
    /// Daily feed (kg per day, whole pond) by day of culture. A closed batch spreads its total feed (harvest kg x FCR) over the
    /// days of culture, rising as the shrimp grow; a running batch is fed from the estimated biomass at 20% falling to 15%.
    /// </summary>
    private static List<(int Doc, decimal Kg, int Stage)> FeedSchedule(BatchPlan bp, DateOnly stocking, DateOnly end, bool closed)
    {
        var days = Days(stocking, end);
        var list = new List<(int Doc, decimal Kg, int Stage)>();
        if (closed)
        {
            var total = bp.HarvestKg * bp.Fcr;
            var weights = new List<double>();
            for (var d = 1; d < days; d++)
            {
                weights.Add(Math.Pow(d, 1.4));
            }

            var sum = weights.Sum();
            for (var d = 1; d < days; d++)
            {
                list.Add((d, Math.Round(total * (decimal)(weights[d - 1] / sum), 1), FeedStage(d)));
            }
        }
        else
        {
            for (var d = 1; d <= days; d++)
            {
                var abw = 0.01 * Math.Exp(0.22 * d); // grams; PL12 stocked at ~0.01 g
                var biomassKg = bp.Pl * 0.95m * (decimal)abw / 1000m;
                var rate = 0.20m - 0.05m * d / Math.Max(days, 1);
                list.Add((d, Math.Max(1.0m, Math.Round(biomassKg * rate, 1)), 0));
            }
        }

        return list;
    }

    private static DateTime Utc(int y, int m, int d, int h = 0, int min = 0) => new(y, m, d, h, min, 0, DateTimeKind.Utc);

    /// <summary>Farm local time (Asia/Manila, UTC+8) to UTC.</summary>
    private static DateTime LocalUtc(DateOnly d, int hour, int min = 0) =>
        DateTime.SpecifyKind(d.ToDateTime(new TimeOnly(hour, min)).AddHours(-8), DateTimeKind.Utc);

    private static int Days(DateOnly from, DateOnly to) => to.DayNumber - from.DayNumber;

    private void SeedFarm(int t, long ownerId, long techId, long tech2Id)
    {
        // ---- Ponds (the farm's farming system is Semi-intensive, the FarmProfile default; no pond overrides it) ----
        var prefixes = _context.PondNamePrefixes.IgnoreQueryFilters().Where(x => x.TenantId == t).ToDictionary(x => x.ShortCode);
        var ponds = new Dictionary<string, Pond>();
        foreach (var spec in PondSpecs)
        {
            var pond = new Pond
            {
                TenantId = t, CreatorUserId = ownerId, PrefixId = prefixes[spec.Prefix].Id, Number = spec.Number, PondCode = PondNaming.FormatCode(spec.Prefix, spec.Number),
                AreaM2 = spec.AreaM2, AverageDepthM = 1.2m, MaxDepthM = 1.5m, Purpose = spec.Purpose, ConstructionType = PondConstructionType.Earthen,
                InletType = "PVC pipe with screen", OutletType = "Monk with gate boards", AerationSystem = "Paddlewheel x2, 1 hp each",
            };
            ponds[pond.PondCode] = pond;
            _context.Ponds.Add(pond);
        }

        _context.SaveChanges();
        foreach (var p in ponds.Values)
        {
            _context.PondHistories.Add(new PondHistory { TenantId = t, CreatorUserId = ownerId, PondId = p.Id, ChangeDateUtc = Utc(2026, 1, 20), ChangeType = PondChangeType.Created, Description = "Pond registered (seed)." });
        }

        // ---- Resources: one hatchery (the only fry source) and two buyers ----
        var hatchery = new HatcherySource
        {
            TenantId = t, CreatorUserId = ownerId, Name = "GenSan Bay Hatchery (test)", ShortCode = "GBH", Address = "General Santos City", ContactPerson = "H. Manager", Phone = "0917 111 2222",
            BfarAccreditationNo = "BFAR-HAT-TEST-001", AccreditationStatus = AccreditationStatus.Accredited,
        };
        _context.HatcherySources.Add(hatchery);
        _context.SaveChanges();

        var healthCertificate = new HatcheryCertificate
        {
            TenantId = t, CreatorUserId = ownerId, HatcheryId = hatchery.Id, CertificateType = CertificateType.Health, CertificateNo = "HC-2026-001",
            IssueDate = new DateOnly(2026, 1, 5), ExpiryDate = new DateOnly(2026, 12, 31),
        };
        _context.HatcheryCertificates.Add(healthCertificate);

        var buyers = new[]
        {
            new Buyer { TenantId = t, CreatorUserId = ownerId, BuyerType = BuyerType.Company, Name = "Tambler Seafood Buyer (test)", ContactPerson = "S. Buyer", Phone = "0918 333 4444", Address = "Fish Port Complex, General Santos City" },
            new Buyer { TenantId = t, CreatorUserId = ownerId, BuyerType = BuyerType.Company, Name = "Lagao Fish Dealer (test)", ContactPerson = "M. Dealer", Phone = "0919 555 6666", Address = "Lagao Public Market, General Santos City" },
        };
        _context.Buyers.AddRange(buyers);

        InventoryItem NewFeed(string stage, string spec, string bai, decimal reorder) => new()
        {
            TenantId = t, CreatorUserId = ownerId, Category = InventoryCategory.Feed, Brand = "TestFeed", ProductName = $"Vannamei {stage} {spec}", FeedType = stage,
            BaiRegistrationNo = bai, Unit = "kg", ReorderLevel = reorder,
        };
        var feedItems = new[]
        {
            NewFeed("Starter", "40-42% CP crumble", "BAI-TEST-0001", 50),
            NewFeed("Grower", "38-40% CP pellet", "BAI-TEST-0002", 500),
            NewFeed("Finisher", "36-38% CP pellet", "BAI-TEST-0003", 500),
        };
        var probiotic = new InventoryItem { TenantId = t, CreatorUserId = ownerId, Category = InventoryCategory.AdditiveSupplement, Brand = "AquaTest", ProductName = "Bacillus probiotic", Unit = "kg", ReorderLevel = 5 };
        var lime = new InventoryItem { TenantId = t, CreatorUserId = ownerId, Category = InventoryCategory.Chemical, Brand = "Generic", ProductName = "Agricultural lime", Unit = "kg", ReorderLevel = 50 };
        _context.InventoryItems.AddRange(feedItems);
        _context.InventoryItems.AddRange(probiotic, lime);
        _context.SaveChanges();

        var grade5060 = _context.SizeGrades.IgnoreQueryFilters().First(g => g.TenantId == t && g.Label == "50/60");
        var grade4050 = _context.SizeGrades.IgnoreQueryFilters().First(g => g.TenantId == t && g.Label == "40/50");

        InventoryLot Receive(InventoryItem item, string lotNumber, decimal qty, decimal cost, DateOnly date, string supplier)
        {
            var lot = new InventoryLot { TenantId = t, CreatorUserId = ownerId, ItemId = item.Id, LotNumber = lotNumber, ReceivedDate = date, Supplier = supplier, UnitCost = cost };
            _context.InventoryLots.Add(lot);
            _context.SaveChanges();
            _context.StockMovements.Add(new StockMovement { TenantId = t, CreatorUserId = ownerId, LotId = lot.Id, MovementDateUtc = LocalUtc(date, 9), Type = StockMovementType.Receipt, Quantity = qty, UnitCost = cost, Reason = "Stock received (seed)" });
            _context.SaveChanges();
            return lot;
        }

        var logs = new LogWriter(_context, t);
        var saleCounter = 0;
        var cycleIndex = 0;

        foreach (var cp in CyclePlans)
        {
            cycleIndex++;
            var isClosedPlan = cp.Closed.HasValue;

            // Daily feed schedule for every batch of the cycle, then feed lots sized from what the schedules use.
            var schedules = cp.Batches.Select(b => FeedSchedule(b, cp.Stocking, cp.Harvest ?? LastEntryDate, isClosedPlan)).ToList();
            var receivedOn = cp.Stocking.AddDays(-10);
            var feedLots = new InventoryLot[3];
            var feedCosts = new[] { 95m + cycleIndex, 82m + cycleIndex, 76m + cycleIndex };
            var lotPrefix = new[] { "ST", "GR", "FN" };
            for (var stage = 0; stage < 3; stage++)
            {
                var needed = schedules.Sum(sch => sch.Where(x => x.Stage == stage).Sum(x => x.Kg));
                decimal qty;
                if (isClosedPlan)
                {
                    qty = needed > 0 ? Math.Ceiling(needed * 1.10m / 25m) * 25m + 25m : 0m;
                }
                else
                {
                    qty = stage == 0 ? 100m : stage == 1 ? 500m : 0m; // running cycle: starter in use, grower on hand for later
                }

                if (qty > 0)
                {
                    feedLots[stage] = Receive(feedItems[stage], $"{lotPrefix[stage]}-{receivedOn:MMdd}", qty, feedCosts[stage], receivedOn, "Feed Dealer (test)");
                }
            }

            Receive(probiotic, $"PB-{receivedOn:MMdd}", 20m, 950m, receivedOn, "Agrivet (test)");
            Receive(lime, $"LM-{receivedOn:MMdd}", 400m, 12m, receivedOn, "Agrivet (test)");

            // Fry delivery: PL received = what was stocked + what was not (recorded at Finish stocking). One delivery starts one cycle.
            var stockedPl = cp.Batches.Sum(b => b.Pl);
            var shortfallPl = cp.Shortfalls.Sum(s => s.Count);
            var delivery = new FryDelivery
            {
                TenantId = t, CreatorUserId = ownerId, HatcheryId = hatchery.Id, HatcheryBatchNumber = cp.HatcheryBatchNo, DeliveryDate = cp.Stocking,
                PlAgeDays = 12, PlReceived = stockedPl + shortfallPl, CostPhp = Math.Round((stockedPl + shortfallPl) * 0.30m, 0),
                PlHealthCertificateNo = $"PLHC-{cp.Stocking:yyyy}-{cp.Stocking:MMdd}", TransportPermitNo = $"TP-{cp.Stocking:yyyyMMdd}",
                StockingFinishedAtUtc = LocalUtc(cp.Stocking, 11), StockingFinishedByUserId = ownerId,
            };
            _context.FryDeliveries.Add(delivery);
            _context.SaveChanges();
            _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = t, CreatorUserId = ownerId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Ordered, ChangedAtUtc = LocalUtc(cp.Stocking.AddDays(-12), 10), Note = "Recorded" });
            _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = t, CreatorUserId = techId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Received, ChangedAtUtc = LocalUtc(cp.Stocking, 5) });
            foreach (var s in cp.Shortfalls)
            {
                _context.FryDeliveryShortfalls.Add(new FryDeliveryShortfall { TenantId = t, CreatorUserId = ownerId, DeliveryId = delivery.Id, Reason = s.Reason, Count = s.Count, Note = s.Note });
            }

            var cycle = new ProductionCycle { TenantId = t, CreatorUserId = ownerId, CycleCode = cp.Code, Status = CycleStatus.Active, FryDeliveryId = delivery.Id };
            _context.ProductionCycles.Add(cycle);
            _context.SaveChanges();

            var letters = new[] { "A", "B", "C", "D" };
            var batchRows = new List<(BatchPlan Plan, Pond Pond, PondBatch Row, BatchLogSummary Summary)>();
            for (var bi = 0; bi < cp.Batches.Length; bi++)
            {
                var bp = cp.Batches[bi];
                var pond = ponds[PondNaming.FormatCode(bp.Prefix, bp.PondNumber)];
                var technician = bi % 2 == 0 ? techId : tech2Id;

                // Pond preparation round for this stocking (used by the batch).
                var round = new PondPreparationRound
                {
                    TenantId = t, CreatorUserId = technician, PondId = pond.Id, StartedAtUtc = LocalUtc(cp.Stocking.AddDays(-9), 8), PreparedAtUtc = LocalUtc(cp.Stocking.AddDays(-2), 15),
                    PreparedByUserId = technician, UsedAtUtc = LocalUtc(cp.Stocking, 8),
                };
                _context.PondPreparationRounds.Add(round);
                _context.SaveChanges();
                _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = t, CreatorUserId = technician, RoundId = round.Id, ObservedAtUtc = LocalUtc(cp.Stocking.AddDays(-9), 9), Description = "Drained the pond; drying started." });
                _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = t, CreatorUserId = technician, RoundId = round.Id, ObservedAtUtc = LocalUtc(cp.Stocking.AddDays(-6), 9), Description = "Applied agricultural lime and tilled the pond bottom." });
                _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = t, CreatorUserId = technician, RoundId = round.Id, ObservedAtUtc = LocalUtc(cp.Stocking.AddDays(-2), 9), Description = "Filled to 1.2 m with screened seawater; probiotic applied." });

                var density = (decimal)bp.Pl / pond.AreaM2;
                var band = _context.DensityBands.AsNoTracking().FirstOrDefault(b => b.FarmingSystem == FarmingSystem.SemiIntensive && b.ConstructionType == pond.ConstructionType);
                var batch = new PondBatch
                {
                    TenantId = t, CreatorUserId = ownerId, CycleId = cycle.Id, PondId = pond.Id, PreparationRoundId = round.Id, Letter = letters[bi], BatchCode = $"{cp.Code}-{letters[bi]}",
                    Status = BatchStatus.Stocked, StockedAtUtc = LocalUtc(cp.Stocking, 8), StockingDate = cp.Stocking, PondAreaM2AtStocking = pond.AreaM2, TransportMode = TransportMode.Truck,
                    PlCountStocked = bp.Pl, DeadAtStocking = bp.DeadAtStocking, AcclimationMinutes = bp.AcclimMinutes, InitialSurvivalEstimatePct = 95,
                    FarmingSystemAtStocking = FarmingSystem.SemiIntensive, ConstructionTypeAtStocking = pond.ConstructionType, DensityFlag = band?.Judge(density),
                    HatcheryCertificationStatusAtStocking = hatchery.DescribeCertification(healthCertificate, cp.Stocking),
                };
                _context.PondBatches.Add(batch);
                _context.SaveChanges();

                BatchLogSummary summary;
                if (isClosedPlan)
                {
                    summary = logs.ClosedBatchLogs(batch, technician, feedLots, feedCosts, schedules[bi], cp.Stocking, cp.Harvest.Value, 1000m / 51m, bp.Pl);
                }
                else
                {
                    summary = logs.ActiveBatchLogs(batch, technician, feedLots, feedCosts, schedules[bi], cp.Stocking, LastEntryDate, bp.Pl, lowDoAlert: bi == 0);
                }

                batchRows.Add((bp, pond, batch, summary));
            }

            if (!isClosedPlan)
            {
                continue;
            }

            // ---- Harvests, sales, then close the batches and the cycle ----
            for (var bi = 0; bi < batchRows.Count; bi++)
            {
                var (bp, pond, batch, summary) = batchRows[bi];
                var technician = bi % 2 == 0 ? techId : tech2Id;
                var totalKg = bp.HarvestKg - bp.PartialKg;

                if (bp.PartialKg > 0)
                {
                    var partial = AddHarvest(t, technician, batch, cp.PartialHarvest.Value, HarvestType.Partial, bp.PartialKg, grade5060, grade4050, summary);
                    AddSale(t, ownerId, buyers[1], cp.PartialHarvest.Value, partial, grade4050, 1m, ++saleCounter, fullyPaid: true);
                }

                var total = AddHarvest(t, technician, batch, cp.Harvest.Value, HarvestType.Total, totalKg, grade5060, grade4050, summary);
                var lastBatchOfCycle = bi == batchRows.Count - 1;
                AddSale(t, ownerId, buyers[0], cp.Harvest.Value, total, grade4050, 1m, ++saleCounter, fullyPaid: !lastBatchOfCycle);
                batch.Status = BatchStatus.Harvested;
                _context.SaveChanges();

                // Close the batch the way Close Batch does: store the final indicators the calculator gives.
                var facts = new BatchFacts
                {
                    PlCountStocked = bp.Pl, PondAreaM2 = pond.AreaM2, StockingDate = cp.Stocking, CumulativeFeedKg = summary.FeedKg,
                    CumulativeMortality = summary.Mortalities.Sum(m => m.Count), Mortalities = summary.Mortalities, GrowthSamples = summary.Growth, Harvests = summary.Harvests,
                };
                var ind = IndicatorCalculator.Compute(facts, cp.Closed.Value);
                batch.FinalAbwG = ind.FinalAbwG;
                batch.FinalFcr = ind.FinalFcr;
                batch.SurvivalRatePct = ind.SurvivalRatePct ?? 0m;
                batch.TotalHarvestKg = ind.TotalHarvestKg;
                batch.TotalFeedKg = ind.CumulativeFeedKg;
                batch.CultureDays = ind.CultureDays;
                batch.Status = BatchStatus.Closed;
                batch.ClosedAtUtc = LocalUtc(cp.Closed.Value, 10);
                batch.ClosedByUserId = ownerId;
                _context.SaveChanges();
            }

            cycle.Status = CycleStatus.Closed;
            cycle.Outcome = CycleOutcome.Completed;
            cycle.ClosedAtUtc = LocalUtc(cp.Closed.Value, 10);
            cycle.ClosedByUserId = ownerId;
            _context.SaveChanges();
        }

        // The next dispatch receipt the app issues continues after the sample ones ("DR-2026-0001" ...).
        _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = t, SequenceType = NumberSequenceType.DispatchReceipt, Scope = "2026", NextValue = saleCounter + 1 });
        _context.SaveChanges();
    }

    /// <summary>One harvest with its two grade lines (60% 50/60, 40% 40/50), recorded as a fact for the batch's indicators.</summary>
    private Harvest AddHarvest(int t, long userId, PondBatch batch, DateOnly date, HarvestType type, decimal kg, SizeGrade grade5060, SizeGrade grade4050, BatchLogSummary summary)
    {
        var kg5060 = Math.Round(kg * 0.6m, 1);
        var kg4050 = kg - kg5060;
        var abw = Math.Round(1000m / 51m, 1);
        var harvest = new Harvest
        {
            TenantId = t, CreatorUserId = userId, BatchId = batch.Id, HarvestedAtUtc = LocalUtc(date, 3), HarvestType = type, TotalKg = kg, Boxes = (int)Math.Ceiling(kg / 20m), AbwG = abw,
            DeadAtHarvest = type == HarvestType.Total ? 40 : 0, SmoothShell = true, IntactAppendages = true, NoNecrosis = true,
            GradeLines = new List<HarvestGradeLine>
            {
                new() { TenantId = t, SizeGradeId = grade5060.Id, Kg = kg5060 },
                new() { TenantId = t, SizeGradeId = grade4050.Id, Kg = kg4050 },
            },
        };
        _context.Harvests.Add(harvest);
        _context.SaveChanges();

        summary.Harvests.Add(new HarvestFact
        {
            Date = date, HarvestedAtUtc = harvest.HarvestedAtUtc, IsFinal = type == HarvestType.Total, TotalKg = kg, AbwG = abw,
            GradeLines = new List<(decimal Kg, decimal? MidCountPerKg)> { (kg5060, grade5060.MidCountPerKg), (kg4050, grade4050.MidCountPerKg) },
        });
        return harvest;
    }

    /// <summary>A sale of all of one harvest's grades. Fully paid sales are paid on the sale date; otherwise 60% is paid and the rest is overdue.</summary>
    private void AddSale(int t, long ownerId, Buyer buyer, DateOnly date, Harvest harvest, SizeGrade grade4050, decimal priceFactor, int number, bool fullyPaid)
    {
        var lines = harvest.GradeLines.Select(gl => new SaleLine
        {
            TenantId = t, HarvestGradeLineId = gl.Id, Kg = gl.Kg, PricePerKg = (gl.SizeGradeId == grade4050.Id ? 420m : 380m) * priceFactor,
        }).ToList();
        var total = lines.Sum(l => l.Amount);
        var sale = new Sale
        {
            TenantId = t, CreatorUserId = ownerId, BuyerId = buyer.Id, SaleDate = date, DispatchReceiptNo = $"DR-{date:yyyy}-{number:0000}",
            PaymentTerms = fullyPaid ? "Cash on delivery" : "60% on delivery, balance in 15 days", DueDate = fullyPaid ? null : date.AddDays(15),
            Destination = "Fish Port Complex, General Santos City", Lines = lines,
            Payments = new List<SalePayment>
            {
                new() { TenantId = t, CreatorUserId = ownerId, PaidOn = date, Amount = fullyPaid ? total : Math.Round(total * 0.6m, 0), Method = "Bank transfer" },
            },
        };
        _context.Sales.Add(sale);
        _context.SaveChanges();
    }

    /// <summary>What the logs of one batch add up to, so its final indicators can be computed like Close Batch does.</summary>
    private class BatchLogSummary
    {
        public decimal FeedKg { get; set; }
        public List<MortalityFact> Mortalities { get; } = new();
        public List<GrowthSampleFact> Growth { get; } = new();
        public List<HarvestFact> Harvests { get; } = new();
    }

    /// <summary>Writes seed logs with their detail rows and usage movements.</summary>
    private class LogWriter
    {
        private readonly CapstoneDbContext _context;
        private readonly int _t;
        private Dictionary<string, ParameterDefinition> _parameters;

        public LogWriter(CapstoneDbContext context, int tenantId)
        {
            _context = context;
            _t = tenantId;
        }

        private ProductionLog NewLog(PondBatch batch, long userId, DateTime at, LogType type)
        {
            var log = new ProductionLog { Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = userId, BatchId = batch.Id, PondId = batch.PondId, LogType = type, ObservedAtUtc = at, ClientRequestId = Guid.NewGuid() };
            _context.ProductionLogs.Add(log);
            return log;
        }

        /// <summary>A feeding session (AM before noon farm time, else PM); its kilograms are its usage movement.</summary>
        private void Feeding(PondBatch batch, long userId, DateTime at, InventoryLot lot, decimal kg, decimal unitCost, string notes)
        {
            var local = at.AddHours(8); // Asia/Manila
            var session = new FeedingSession
            {
                Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = userId, BatchId = batch.Id, FeedDate = DateOnly.FromDateTime(local),
                Session = local.Hour < 12 ? FeedingSessionTime.AM : FeedingSessionTime.PM, Status = FeedingStatus.Fed, Notes = notes, ClientRequestId = Guid.NewGuid(),
            };
            _context.FeedingSessions.Add(session);
            _context.StockMovements.Add(new StockMovement { TenantId = _t, CreatorUserId = userId, LotId = lot.Id, MovementDateUtc = at, Type = StockMovementType.Usage, Quantity = -kg, UnitCost = unitCost, BatchId = batch.Id, FeedingSessionId = session.Id });
        }

        /// <summary>One day's feed as an AM session (07:00) and a PM session (17:00); more of the ration goes in the evening.</summary>
        private decimal FeedDay(PondBatch batch, long userId, DateOnly stocking, int doc, decimal dailyKg, int stage, InventoryLot[] lots, decimal[] costs)
        {
            var lot = lots[stage];
            var amKg = Math.Round(dailyKg * (doc <= 60 ? 0.40m : 0.50m), 1);
            var pmKg = Math.Round(dailyKg - amKg, 1);
            var mode = doc <= 30 ? "Blind feeding (broadcast)" : "Scheduled feeding; ration adjusted to check-tray consumption";
            Feeding(batch, userId, LocalUtc(stocking.AddDays(doc), 7), lot, amKg, costs[stage], mode);
            Feeding(batch, userId, LocalUtc(stocking.AddDays(doc), 17), lot, pmKg, costs[stage], mode);
            return amKg + pmKg;
        }

        private void Mortality(BatchLogSummary summary, PondBatch batch, long userId, DateTime at, int count, string cause)
        {
            var log = NewLog(batch, userId, at, LogType.Mortality);
            _context.MortalityDetails.Add(new MortalityDetail { Id = log.Id, TenantId = _t, Count = count, Cause = MortalityCause.Others, OtherCause = cause, Symptoms = "Weak swimming near the dike" });
            summary.Mortalities.Add(new MortalityFact { ObservedAtUtc = at, Count = count });
        }

        private void Growth(BatchLogSummary summary, PondBatch batch, long userId, DateTime at, decimal abw, decimal? estimatedSurvivalPct = null)
        {
            var log = NewLog(batch, userId, at, LogType.GrowthSampling);
            var weight = Math.Round(abw * 100m, 1);
            var abwG = IndicatorCalculator.Abw(weight, 100);
            _context.GrowthSamplingDetails.Add(new GrowthSamplingDetail { Id = log.Id, TenantId = _t, SampleCount = 100, TotalSampleWeightG = weight, AbwG = abwG, EstimatedSurvivalPct = estimatedSurvivalPct });
            summary.Growth.Add(new GrowthSampleFact { Date = DateOnly.FromDateTime(at.AddHours(8)), ObservedAtUtc = at, AbwG = abwG, EstimatedSurvivalPct = estimatedSurvivalPct });
        }

        private void WaterQuality(PondBatch batch, long userId, DateTime at, LogType type, params (string Code, decimal Value)[] readings)
        {
            _parameters ??= _context.ParameterDefinitions.ToDictionary(p => p.Id);
            var log = NewLog(batch, userId, at, type);
            foreach (var (code, value) in readings)
            {
                var p = _parameters[code];
                _context.WaterQualityMeasurements.Add(new WaterQualityMeasurement { Id = Guid.NewGuid(), TenantId = _t, LogId = log.Id, ParameterCode = code, Value = value, UnitCode = p.UnitCode, IsOutOfRange = p.IsOutOfOptimalRange(value), Side = p.SideOf(value) });
            }
        }

        /// <summary>Normal readings that vary a little from one visit to the next.</summary>
        private void RoutineWaterQuality(PondBatch batch, long userId, DateTime at, int i) =>
            WaterQuality(batch, userId, at, LogType.WaterQuality,
                (ParameterCodes.Temperature, 28.8m + ((i * 7) % 15) / 10m),
                (ParameterCodes.Salinity, 20m + (i * 3) % 5),
                (ParameterCodes.PH, 7.8m + ((i * 5) % 5) / 10m),
                (ParameterCodes.DO, 5.4m + ((i * 3) % 9) / 10m));

        /// <summary>Full history up to the total harvest: pre-stocking check, daily feeding by stage, weekly water quality, fortnightly growth samples, three mortality events.</summary>
        public BatchLogSummary ClosedBatchLogs(PondBatch batch, long userId, InventoryLot[] feedLots, decimal[] feedCosts, List<(int Doc, decimal Kg, int Stage)> schedule, DateOnly stocking, DateOnly harvest, decimal finalAbw, long pl)
        {
            var summary = new BatchLogSummary();
            var cultureDays = Days(stocking, harvest);
            WaterQuality(batch, userId, LocalUtc(stocking.AddDays(-1), 16), LogType.PreStockingWaterQuality,
                (ParameterCodes.Temperature, 29.5m), (ParameterCodes.Salinity, 22m), (ParameterCodes.PH, 7.8m), (ParameterCodes.DO, 6.1m));

            foreach (var day in schedule)
            {
                summary.FeedKg += FeedDay(batch, userId, stocking, day.Doc, day.Kg, day.Stage, feedLots, feedCosts);
            }

            var visit = 0;
            for (var d = 7; d < cultureDays; d += 7)
            {
                visit++;
                RoutineWaterQuality(batch, userId, LocalUtc(stocking.AddDays(d), 5, 30), visit);
            }

            for (var d = 14; d < cultureDays; d += 14)
            {
                var abw = Math.Round(finalAbw * (decimal)Math.Pow((double)d / cultureDays, 1.4), 2);
                Growth(summary, batch, userId, LocalUtc(stocking.AddDays(d), 9), Math.Max(abw, 0.1m));
            }

            Mortality(summary, batch, userId, LocalUtc(stocking.AddDays(8), 8, 30), (int)Math.Round(pl * 0.009m), "Stress after a heavy rain");
            Mortality(summary, batch, userId, LocalUtc(stocking.AddDays(Math.Min(30, cultureDays - 1)), 8, 30), (int)Math.Round(pl * 0.012m), "Molting-related losses");
            Mortality(summary, batch, userId, LocalUtc(stocking.AddDays(Math.Min(70, cultureDays - 1)), 8, 30), (int)Math.Round(pl * 0.008m), "Low dissolved oxygen at dawn");
            _context.SaveChanges();
            return summary;
        }

        /// <summary>The running batch up to <paramref name="until"/>: pre-stocking check, daily AM and PM feeding, a water-quality check every second day, two growth samples, two mortality events, and optionally a final low-DO reading.</summary>
        public BatchLogSummary ActiveBatchLogs(PondBatch batch, long userId, InventoryLot[] feedLots, decimal[] feedCosts, List<(int Doc, decimal Kg, int Stage)> schedule, DateOnly stocking, DateOnly until, long pl, bool lowDoAlert)
        {
            var summary = new BatchLogSummary();
            var days = Days(stocking, until);
            WaterQuality(batch, userId, LocalUtc(stocking.AddDays(-1), 16), LogType.PreStockingWaterQuality,
                (ParameterCodes.Temperature, 30m), (ParameterCodes.Salinity, 20m), (ParameterCodes.PH, 7.9m), (ParameterCodes.DO, 5.8m));

            foreach (var day in schedule)
            {
                summary.FeedKg += FeedDay(batch, userId, stocking, day.Doc, day.Kg, day.Stage, feedLots, feedCosts);
            }

            var visit = 0;
            for (var d = 2; d <= days; d += 2)
            {
                visit++;
                RoutineWaterQuality(batch, userId, LocalUtc(stocking.AddDays(d), 5, 30), visit);
            }

            Growth(summary, batch, userId, LocalUtc(stocking.AddDays(7), 9), 0.05m);
            Growth(summary, batch, userId, LocalUtc(stocking.AddDays(days - 1), 9), 0.13m, estimatedSurvivalPct: 92m);

            Mortality(summary, batch, userId, LocalUtc(stocking.AddDays(4), 8, 30), (int)Math.Round(pl * 0.009m), "Stress after PL stocking");
            Mortality(summary, batch, userId, LocalUtc(stocking.AddDays(9), 8, 30), (int)Math.Round(pl * 0.006m), "Stress after a heavy rain");

            if (lowDoAlert)
            {
                // The most recent reading: dissolved oxygen below the optimal range, shown as a dashboard alert.
                WaterQuality(batch, userId, LocalUtc(until, 5, 30), LogType.WaterQuality,
                    (ParameterCodes.DO, 3.9m), (ParameterCodes.Temperature, 30.8m), (ParameterCodes.PH, 8.3m));
            }

            _context.SaveChanges();
            return summary;
        }
    }
}
