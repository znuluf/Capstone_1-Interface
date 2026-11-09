using Capstone.Domain;
using Capstone.Authorization.Roles;
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
/// Test-only fixture (D-27, not used by the app): two test farms with Owner and Technician accounts. The pilot farm gets ponds,
/// resources, inventory and a reference batch whose indicators are hand-calculated in docs/reference-batch.md.
/// No real farm or personal data.
/// </summary>
public class DevelopmentDataBuilder
{
    public const string PilotFarmCode = "pilot-farm";
    public const string SecondFarmCode = "test-farm-b";

    private readonly CapstoneDbContext _context;

    public DevelopmentDataBuilder(CapstoneDbContext context)
    {
        _context = context;
    }

    public void Create()
    {
        var farms = new FarmSeedBuilder(_context);
        var pw = SeedOptions.DevelopmentPassword;

        var pilot = farms.EnsureFarm(PilotFarmCode, "Pilot Test Farm", "Brgy. Tinoto (test data)", "Maasim", "Sarangani");
        var owner = farms.EnsureUser(pilot.Id, "owner", "Olivia", "Owner", StaticRoleNames.Tenants.FarmOwner, pw);
        var tech = farms.EnsureUser(pilot.Id, "tech", "Tomas", "Technician", StaticRoleNames.Tenants.FarmTechnician, pw);

        var second = farms.EnsureFarm(SecondFarmCode, "Second Test Farm", "Brgy. Lagao (test data)", "General Santos City", "South Cotabato");
        var owner2 = farms.EnsureUser(second.Id, "owner", "Bea", "Owner", StaticRoleNames.Tenants.FarmOwner, pw);
        farms.EnsureUser(second.Id, "tech", "Ben", "Technician", StaticRoleNames.Tenants.FarmTechnician, pw);

        if (!_context.Ponds.IgnoreQueryFilters().Any(p => p.TenantId == pilot.Id))
        {
            SeedPilotFarm(pilot.Id, owner.Id, tech.Id);
        }

        if (!_context.Ponds.IgnoreQueryFilters().Any(p => p.TenantId == second.Id))
        {
            SeedSecondFarm(second.Id, owner2.Id);
        }
    }

    private static DateTime Utc(int y, int m, int d, int h = 0, int min = 0) => new(y, m, d, h, min, 0, DateTimeKind.Utc);

    private void SeedSecondFarm(int t, long ownerId)
    {
        var growOut = _context.PondNamePrefixes.IgnoreQueryFilters().Single(x => x.TenantId == t && x.ShortCode == "GP");
        _context.Ponds.Add(new Pond
        {
            TenantId = t, CreatorUserId = ownerId, PrefixId = growOut.Id, Number = 1, PondCode = PondNaming.FormatCode("GP", 1), AreaM2 = 1800, AverageDepthM = 1.1m, MaxDepthM = 1.4m,
            Purpose = PondPurpose.GrowOut, ConstructionType = PondConstructionType.HdpeLined, FarmingSystemOverride = FarmingSystem.Intensive,
        });
        _context.Buyers.Add(new Buyer { TenantId = t, CreatorUserId = ownerId, BuyerType = BuyerType.Company, Name = "Farm B Buyer Co.", ContactPerson = "B. Buyer", Phone = "0918 000 0000" });
        _context.HatcherySources.Add(new HatcherySource { TenantId = t, CreatorUserId = ownerId, Name = "Farm B Hatchery", ShortCode = "FBH", AccreditationStatus = AccreditationStatus.Pending });
        _context.SaveChanges();
    }

    private void SeedPilotFarm(int t, long ownerId, long techId)
    {
        // ---- Ponds (Table 3 master data) ----
        // The farm's farming system is Semi-intensive (the FarmProfile default); ponds override it only where they differ.
        var prefixes = _context.PondNamePrefixes.IgnoreQueryFilters().Where(x => x.TenantId == t).ToDictionary(x => x.ShortCode);
        Pond NewPond(string shortCode, int number, decimal area, PondPurpose purpose, FarmingSystem? systemOverride) => new()
        {
            TenantId = t, CreatorUserId = ownerId, PrefixId = prefixes[shortCode].Id, Number = number, PondCode = PondNaming.FormatCode(shortCode, number),
            AreaM2 = area, AverageDepthM = 1.2m, MaxDepthM = 1.5m,
            Purpose = purpose, ConstructionType = PondConstructionType.Earthen, FarmingSystemOverride = systemOverride,
            InletType = "PVC pipe with screen", OutletType = "Monk with gate boards", AerationSystem = "Paddlewheel ×4, 1 hp each",
        };

        var p1 = NewPond("GP", 1, 2000, PondPurpose.GrowOut, null);
        var p2 = NewPond("GP", 2, 2500, PondPurpose.GrowOut, null);
        var p3 = NewPond("GP", 3, 1500, PondPurpose.GrowOut, FarmingSystem.Intensive);
        var r1 = NewPond("R", 1, 5000, PondPurpose.Reservoir, FarmingSystem.Extensive);
        _context.Ponds.AddRange(p1, p2, p3, r1);
        _context.SaveChanges();
        foreach (var p in new[] { p1, p2, p3, r1 })
        {
            _context.PondHistories.Add(new PondHistory { TenantId = t, CreatorUserId = ownerId, PondId = p.Id, ChangeDateUtc = Utc(2026, 5, 1), ChangeType = PondChangeType.Created, Description = "Pond registered (seed)." });
        }

        // ---- Resources ----
        var hatchery = new HatcherySource
        {
            TenantId = t, CreatorUserId = ownerId, Name = "Sarangani Bay Hatchery (test)", ShortCode = "SBH", Address = "Glan, Sarangani", ContactPerson = "H. Manager", Phone = "0917 111 2222",
            BfarAccreditationNo = "BFAR-HAT-TEST-001", AccreditationStatus = AccreditationStatus.Accredited,
        };
        var buyer = new Buyer { TenantId = t, CreatorUserId = ownerId, BuyerType = BuyerType.Company, Name = "GenSan Seafood Trading (test)", ContactPerson = "S. Buyer", Phone = "0918 333 4444", Address = "Fish Port Complex, General Santos City" };
        _context.HatcherySources.Add(hatchery);
        var healthCertificate = new HatcheryCertificate
        {
            TenantId = t, CreatorUserId = ownerId, HatcheryId = hatchery.Id, CertificateType = CertificateType.Health, CertificateNo = "HC-2026-014",
            IssueDate = new DateOnly(2026, 4, 1), ExpiryDate = new DateOnly(2027, 3, 31),
        };
        _context.HatcheryCertificates.Add(healthCertificate);
        _context.Buyers.Add(buyer);

        var feed = new InventoryItem { TenantId = t, CreatorUserId = ownerId, Category = InventoryCategory.Feed, Brand = "TestFeed", ProductName = "Shrimp Grower #3", FeedType = "Grower", BaiRegistrationNo = "BAI-TEST-0003", Unit = "kg", ReorderLevel = 500 };
        var probiotic = new InventoryItem { TenantId = t, CreatorUserId = ownerId, Category = InventoryCategory.AdditiveSupplement, Brand = "AquaTest", ProductName = "Bacillus probiotic", Unit = "kg", ReorderLevel = 5 };
        var lime = new InventoryItem { TenantId = t, CreatorUserId = ownerId, Category = InventoryCategory.Chemical, Brand = "Generic", ProductName = "Agricultural lime", Unit = "kg", ReorderLevel = 50 };
        _context.InventoryItems.AddRange(feed, probiotic, lime);
        _context.SaveChanges();

        var feedLot = new InventoryLot { TenantId = t, CreatorUserId = ownerId, ItemId = feed.Id, LotNumber = "FG-0601", ReceivedDate = new DateOnly(2026, 5, 28), Supplier = "Feed Dealer (test)" };
        var probioticLot = new InventoryLot { TenantId = t, CreatorUserId = ownerId, ItemId = probiotic.Id, LotNumber = "PB-0520", ReceivedDate = new DateOnly(2026, 5, 20), Supplier = "Agrivet (test)" };
        var limeLot = new InventoryLot { TenantId = t, CreatorUserId = ownerId, ItemId = lime.Id, LotNumber = "LM-0515", ReceivedDate = new DateOnly(2026, 5, 15), Supplier = "Agrivet (test)" };
        _context.InventoryLots.AddRange(feedLot, probioticLot, limeLot);
        _context.SaveChanges();

        void Receipt(InventoryLot lot, InventoryItem item, decimal qty, decimal cost, DateOnly date)
        {
            lot.UnitCost = cost;
            var m = new StockMovement { TenantId = t, CreatorUserId = ownerId, LotId = lot.Id, MovementDateUtc = date.ToDateTime(new TimeOnly(1, 0), DateTimeKind.Utc), Type = StockMovementType.Receipt, Quantity = qty, UnitCost = cost, Reason = "Opening stock (seed)" };
            _context.StockMovements.Add(m);
            _context.SaveChanges();
        }

        Receipt(feedLot, feed, 5000, 75m, new DateOnly(2026, 5, 28));
        Receipt(probioticLot, probiotic, 20, 950m, new DateOnly(2026, 5, 20));
        Receipt(limeLot, lime, 500, 12m, new DateOnly(2026, 5, 15));

        // ---- Fry delivery 1 → cycle 1 with the reference batch (Harvested) and an in-production batch ----
        var delivery = new FryDelivery
        {
            TenantId = t, CreatorUserId = ownerId, HatcheryId = hatchery.Id, HatcheryBatchNumber = "HL-0530", DeliveryDate = new DateOnly(2026, 5, 31),
            PlAgeDays = 12, PlReceived = 450000, CostPhp = 135000m,
        };
        _context.FryDeliveries.Add(delivery);
        _context.SaveChanges();
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = t, CreatorUserId = ownerId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Ordered, ChangedAtUtc = Utc(2026, 5, 20), Note = "Recorded" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = t, CreatorUserId = techId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Received, ChangedAtUtc = Utc(2026, 5, 31, 22) });

        var cycle = new ProductionCycle { TenantId = t, CreatorUserId = ownerId, CycleCode = "C-2026-01", Status = CycleStatus.Active, FryDeliveryId = delivery.Id };
        _context.ProductionCycles.Add(cycle);
        _context.SaveChanges();

        // Reference batch (docs/reference-batch.md): 200,000 PL in 2,000 m² on 1 Jun 2026 (Asia/Manila).
        var reference = new PondBatch
        {
            TenantId = t, CreatorUserId = ownerId, CycleId = cycle.Id, PondId = p1.Id, Letter = "A", BatchCode = "B-2026-01-P01", Status = BatchStatus.Harvested,
            StockedAtUtc = Utc(2026, 6, 1, 0, 0), StockingDate = new DateOnly(2026, 6, 1), PondAreaM2AtStocking = 2000, TransportMode = TransportMode.Truck,
            PlCountStocked = 200000, AcclimationMinutes = 45, InitialSurvivalEstimatePct = 95,
            HatcheryCertificationStatusAtStocking = hatchery.DescribeCertification(healthCertificate, new DateOnly(2026, 6, 1)),
        };
        var current = new PondBatch
        {
            TenantId = t, CreatorUserId = ownerId, CycleId = cycle.Id, PondId = p2.Id, Letter = "B", BatchCode = "B-2026-02-P02", Status = BatchStatus.Stocked,
            StockedAtUtc = Utc(2026, 9, 14, 23, 0), StockingDate = new DateOnly(2026, 9, 15), PondAreaM2AtStocking = 2500, TransportMode = TransportMode.Truck,
            PlCountStocked = 250000, AcclimationMinutes = 40, InitialSurvivalEstimatePct = 95,
            HatcheryCertificationStatusAtStocking = hatchery.DescribeCertification(healthCertificate, new DateOnly(2026, 9, 15)),
        };
        _context.PondBatches.AddRange(reference, current);
        _context.SaveChanges();

        var logs = new LogWriter(_context, t);
        // Reference batch logs
        logs.WaterQuality(reference, techId, Utc(2026, 5, 31, 23, 30), LogType.PreStockingWaterQuality, (ParameterCodes.Temperature, 29.5m), (ParameterCodes.Salinity, 22m), (ParameterCodes.PH, 7.8m), (ParameterCodes.DO, 6.1m));
        foreach (var (date, kg) in new[] { (Utc(2026, 7, 1, 0), 1000m), (Utc(2026, 8, 1, 0), 1000m), (Utc(2026, 9, 1, 0), 1000m) })
        {
            logs.Feeding(reference, techId, date, feedLot, kg, 75m);
        }

        logs.Mortality(reference, techId, Utc(2026, 7, 15, 1), 10000);
        logs.Growth(reference, techId, Utc(2026, 8, 1, 2), 100, 1200m);
        logs.Growth(reference, techId, Utc(2026, 9, 1, 2), 100, 2000m);

        var grade5060 = _context.SizeGrades.IgnoreQueryFilters().First(g => g.TenantId == t && g.Label == "50/60");
        var grade6070 = _context.SizeGrades.IgnoreQueryFilters().First(g => g.TenantId == t && g.Label == "60/70");
        var harvest = new Harvest
        {
            TenantId = t, CreatorUserId = techId, BatchId = reference.Id, HarvestedAtUtc = Utc(2026, 9, 7, 22, 0), HarvestType = HarvestType.Total, TotalKg = 2500, Boxes = 125, AbwG = 17.5m,
            SmoothShell = true, IntactAppendages = true, NoNecrosis = true,
            GradeLines = new List<HarvestGradeLine>
            {
                new() { TenantId = t, SizeGradeId = grade5060.Id, Kg = 2000 },
                new() { TenantId = t, SizeGradeId = grade6070.Id, Kg = 500 },
            },
        };
        _context.Harvests.Add(harvest);
        _context.SaveChanges();

        var sale = new Sale
        {
            TenantId = t, CreatorUserId = ownerId, BuyerId = buyer.Id, SaleDate = new DateOnly(2026, 9, 8), PaymentTerms = "50% on delivery, balance in 15 days",
            DispatchReceiptNo = "SR-2026-0001", DueDate = new DateOnly(2026, 9, 23),
            Lines = new List<SaleLine>
            {
                new() { TenantId = t, HarvestGradeLineId = harvest.GradeLines[0].Id, Kg = 2000, PricePerKg = 380 },
                new() { TenantId = t, HarvestGradeLineId = harvest.GradeLines[1].Id, Kg = 500, PricePerKg = 340 },
            },
            Payments = new List<SalePayment>
            {
                new() { TenantId = t, CreatorUserId = ownerId, PaidOn = new DateOnly(2026, 9, 8), Amount = 500000, Method = "Bank transfer" },
            },
        };
        _context.Sales.Add(sale);
        _context.SaveChanges();

        // In-production batch logs (one low-DO reading → dashboard alert)
        logs.WaterQuality(current, techId, Utc(2026, 9, 14, 22), LogType.PreStockingWaterQuality, (ParameterCodes.Temperature, 30m), (ParameterCodes.Salinity, 20m), (ParameterCodes.PH, 7.9m), (ParameterCodes.DO, 5.8m));
        logs.Feeding(current, techId, Utc(2026, 10, 1, 0), feedLot, 150m, 75m);
        logs.Feeding(current, techId, Utc(2026, 10, 15, 0), feedLot, 150m, 75m);
        logs.Mortality(current, techId, Utc(2026, 10, 5, 1), 2000);
        logs.Growth(current, techId, Utc(2026, 10, 15, 2), 100, 450m);
        logs.WaterQuality(current, techId, Utc(2026, 10, 20, 21, 30), LogType.WaterQuality, (ParameterCodes.DO, 4.6m), (ParameterCodes.Temperature, 29m), (ParameterCodes.PH, 8.1m));

        // ---- Fry delivery 2 (Received, not yet stocked) and pond GP-03 marked Prepared: ready for Create Batch (Stocking) ----
        var delivery2 = new FryDelivery
        {
            // Received today, so its ponds can be stocked within the default 1-day stocking window (DEC-63).
            TenantId = t, CreatorUserId = ownerId, HatcheryId = hatchery.Id, HatcheryBatchNumber = "HL-1020",
            DeliveryDate = FarmClock.Today(FarmClock.Resolve(FarmClock.DefaultTimeZone)), PlHealthCertificateNo = "PLHC-2026-1020",
            PlAgeDays = 12, PlReceived = 150000,
        };
        _context.FryDeliveries.Add(delivery2);
        _context.SaveChanges();
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = t, CreatorUserId = ownerId, DeliveryId = delivery2.Id, Status = FryDeliveryStatus.Ordered, ChangedAtUtc = Utc(2026, 10, 10), Note = "Recorded" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = t, CreatorUserId = techId, DeliveryId = delivery2.Id, Status = FryDeliveryStatus.Received, ChangedAtUtc = Utc(2026, 10, 20, 1) });

        var round = new PondPreparationRound { TenantId = t, CreatorUserId = techId, PondId = p3.Id, StartedAtUtc = Utc(2026, 10, 12, 1), PreparedAtUtc = Utc(2026, 10, 19, 2), PreparedByUserId = techId };
        _context.PondPreparationRounds.Add(round);
        _context.SaveChanges();
        _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = t, CreatorUserId = techId, RoundId = round.Id, ObservedAtUtc = Utc(2026, 10, 12, 1), Description = "Drained the pond; drying started." });
        _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = t, CreatorUserId = techId, RoundId = round.Id, ObservedAtUtc = Utc(2026, 10, 18, 1), Description = "Applied 100 kg agricultural lime." });
        _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = t, CreatorUserId = techId, RoundId = round.Id, ObservedAtUtc = Utc(2026, 10, 19, 1), Description = "Filled to 1.2 m with screened seawater." });

        _context.SaveChanges();
    }

    /// <summary>Writes seed logs with their detail rows and usage movements.</summary>
    private class LogWriter
    {
        private readonly CapstoneDbContext _context;
        private readonly int _t;

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

        private void Usage(PondBatch batch, long userId, DateTime at, InventoryLot lot, decimal qty, decimal unitCost, Guid logId)
        {
            _context.StockMovements.Add(new StockMovement { TenantId = _t, CreatorUserId = userId, LotId = lot.Id, MovementDateUtc = at, Type = StockMovementType.Usage, Quantity = -qty, UnitCost = unitCost, BatchId = batch.Id, SourceLogId = logId });
        }

        /// <summary>A feeding session (AM before noon farm time, else PM); its kilograms are its usage movement.</summary>
        public void Feeding(PondBatch batch, long userId, DateTime at, InventoryLot lot, decimal kg, decimal unitCost)
        {
            var local = at.AddHours(8); // Asia/Manila
            var session = new FeedingSession
            {
                Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = userId, BatchId = batch.Id, FeedDate = DateOnly.FromDateTime(local),
                Session = local.Hour < 12 ? FeedingSessionTime.AM : FeedingSessionTime.PM, ClientRequestId = Guid.NewGuid(),
            };
            _context.FeedingSessions.Add(session);
            _context.StockMovements.Add(new StockMovement { TenantId = _t, CreatorUserId = userId, LotId = lot.Id, MovementDateUtc = at, Type = StockMovementType.Usage, Quantity = -kg, UnitCost = unitCost, BatchId = batch.Id, FeedingSessionId = session.Id });
            _context.SaveChanges();
        }

        public void Mortality(PondBatch batch, long userId, DateTime at, int count)
        {
            var log = NewLog(batch, userId, at, LogType.Mortality);
            _context.MortalityDetails.Add(new MortalityDetail { Id = log.Id, TenantId = _t, Count = count, Cause = MortalityCause.Others, OtherCause = "Stress after a heavy rain", Symptoms = "Weak swimming near dike" });
            _context.SaveChanges();
        }

        public void Growth(PondBatch batch, long userId, DateTime at, int count, decimal weight)
        {
            var log = NewLog(batch, userId, at, LogType.GrowthSampling);
            _context.GrowthSamplingDetails.Add(new GrowthSamplingDetail { Id = log.Id, TenantId = _t, SampleCount = count, TotalSampleWeightG = weight, AbwG = IndicatorCalculator.Abw(weight, count) });
            _context.SaveChanges();
        }

        public void WaterQuality(PondBatch batch, long userId, DateTime at, LogType type, params (string Code, decimal Value)[] readings)
        {
            var log = NewLog(batch, userId, at, type);
            var parameters = _context.ParameterDefinitions.ToDictionary(p => p.Id);
            foreach (var (code, value) in readings)
            {
                var p = parameters[code];
                _context.WaterQualityMeasurements.Add(new WaterQualityMeasurement { Id = Guid.NewGuid(), TenantId = _t, LogId = log.Id, ParameterCode = code, Value = value, UnitCode = p.UnitCode, IsOutOfRange = p.IsOutOfOptimalRange(value), Side = p.SideOf(value) });
            }

            _context.SaveChanges();
        }
    }
}
