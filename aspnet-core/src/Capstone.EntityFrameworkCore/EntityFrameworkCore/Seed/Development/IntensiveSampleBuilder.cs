using Capstone.Authorization.Roles;
using Capstone.Compliance;
using Capstone.Domain;
using Capstone.EntityFrameworkCore.Seed.Farms;
using Capstone.Farms;
using Capstone.Harvests;
using Capstone.Inventory;
using Capstone.Ponds;
using Capstone.Production;
using Capstone.ReferenceData;
using Capstone.Resources;
using Capstone.Sales;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Capstone.EntityFrameworkCore.Seed.Development;

/// <summary>
/// Second sample farm for the Codespace "FPMS_Sample" database (Seed:SampleData=true), next to gensan-semi: an intensive
/// farm with HDPE-lined ponds in Kiamba, Sarangani, and about a year of records (November 2025 to 31 October 2026).
/// Its farm code and usernames follow the DEC-75 formats. It covers what the first sample farm does not: treatments with
/// a withdrawal period, a failed batch with a salvage harvest that was not sold, harvests waiting to be closed, re-weighed
/// sales, overdue and unpaid sales, kg not sold and kg not accounted for, a feed lot flagged for reconciliation, Not fed
/// sessions and typed feeding times, permits (one renewed, one expiring), a second hatchery with pending accreditation,
/// an inactive account and a pond under maintenance.
/// Four cycles: 2025-11-SBH-01 (closed), 2026-03-SBH-01 (closed; one batch failed), 2026-07-SBH-01 (harvested, not yet
/// closed) and 2026-10-KCH-01 (running). Stocking is 120 to 130 PL/m², inside the intensive lined-pond band. Feeding is two
/// logged sessions a day (DEC-61 keeps AM/PM). No real farm or personal data.
/// </summary>
public class IntensiveSampleBuilder
{
    /// <summary>What the registration form suggests for "Kiamba Intensive Shrimp Farm" (DEC-75).</summary>
    public const string FarmCode = "KIAMBA-INTENSIVE";

    /// <summary>Last day with any sample entry (farm local date).</summary>
    public static readonly DateOnly LastEntryDate = new(2026, 10, 31);

    private const decimal PondAreaM2 = 1000m;

    private readonly CapstoneDbContext _context;
    private int _t;
    private long _owner;
    private long[] _techs;
    private Dictionary<string, Pond> _ponds;
    private Dictionary<string, ParameterDefinition> _parameters;
    private Dictionary<string, SizeGrade> _grades;
    private int _receiptNo;

    public IntensiveSampleBuilder(CapstoneDbContext context)
    {
        _context = context;
    }

    // ---------------------------------------------------------------- plans

    private enum BatchEnd { Harvested, Failed, Running }

    /// <summary>
    /// One pond stocking. HarvestKg is the whole batch (partial + total) and FinalAbwG the size at the total harvest;
    /// PlannedKg and Fcr size the daily feed (a running or failed batch is fed as if it would reach PlannedKg).
    /// </summary>
    private sealed record BatchPlan(
        string Pond, long Pl, long DeadAtStocking, int AcclimMinutes, BatchEnd End,
        decimal PlannedKg, decimal Fcr, decimal HarvestKg = 0, decimal FinalAbwG = 0, decimal PartialKg = 0, decimal PartialAbwG = 0);

    private sealed record CyclePlan(
        string Code, string Hatchery, DateOnly Stocking, DateOnly? PartialHarvest, DateOnly? Harvest, DateOnly? Closed, string HatcheryBatchNo,
        long DeadOnArrival, long CountDifference, BatchPlan[] Batches);

    private static readonly DateOnly FailureDate = new(2026, 4, 29);

    private static readonly CyclePlan[] Cycles =
    {
        // Closed: 110 days. GP-01 had a partial harvest at day 85.
        new("2025-11-SBH-01", "SBH", new DateOnly(2025, 11, 10), new DateOnly(2026, 2, 3), new DateOnly(2026, 2, 28), new DateOnly(2026, 3, 7), "SBH-1110",
            2500, 3000,
            new[]
            {
                new BatchPlan("GP-01", 120000, 300, 60, BatchEnd.Harvested, 2110m, 1.30m, 2110m, 22.0m, 400m, 17.0m),
                new BatchPlan("GP-02", 125000, 250, 75, BatchEnd.Harvested, 2150m, 1.32m, 2150m, 21.5m),
            }),
        // Closed: GP-03 harvested at day 105; GP-04 failed at day 44 (suspected AHPND), salvage harvest not sold.
        new("2026-03-SBH-01", "SBH", new DateOnly(2026, 3, 16), null, new DateOnly(2026, 6, 29), new DateOnly(2026, 7, 6), "SBH-0316",
            2000, 4000,
            new[]
            {
                new BatchPlan("GP-03", 120000, 200, 60, BatchEnd.Harvested, 1980m, 1.35m, 1980m, 21.0m),
                new BatchPlan("GP-04", 130000, 350, 90, BatchEnd.Failed, 2300m, 1.30m),
            }),
        // Harvested at day 100 (GP-02 partial at day 75); waiting for the Owner to close the batches and the cycle.
        new("2026-07-SBH-01", "SBH", new DateOnly(2026, 7, 20), new DateOnly(2026, 10, 3), new DateOnly(2026, 10, 28), null, "SBH-0720",
            1800, 2500,
            new[]
            {
                new BatchPlan("GP-01", 120000, 240, 60, BatchEnd.Harvested, 1850m, 1.38m, 1850m, 20.0m),
                new BatchPlan("GP-02", 120000, 180, 60, BatchEnd.Harvested, 1800m, 1.36m, 1800m, 20.5m, 350m, 16.0m),
            }),
        // Running: stocked 3 Oct 2026 from the second hatchery (accreditation pending); logs to 31 Oct (DOC 28).
        new("2026-10-KCH-01", "KCH", new DateOnly(2026, 10, 3), null, null, null, "KCH-1003",
            1500, 2000,
            new[]
            {
                new BatchPlan("GP-03", 125000, 220, 75, BatchEnd.Running, 2300m, 1.30m),
                new BatchPlan("GP-04", 125000, 260, 90, BatchEnd.Running, 2300m, 1.30m),
            }),
    };

    // ---------------------------------------------------------------- entry point

    public void Create()
    {
        var farms = new FarmSeedBuilder(_context);
        var pw = SeedOptions.DevelopmentPassword;

        var farm = farms.EnsureFarm(FarmCode, "Kiamba Intensive Shrimp Farm (test)", "Sitio Lagundi, Brgy. Poblacion (test data)", "Kiamba", "Sarangani");
        var owner = farms.EnsureUser(farm.Id, "rsantos", "Rosa", "Santos", StaticRoleNames.Tenants.FarmOwner, pw);
        var tech1 = farms.EnsureUser(farm.Id, "mreyes", "Mark", "Reyes", StaticRoleNames.Tenants.FarmTechnician, pw);
        var tech2 = farms.EnsureUser(farm.Id, "agarcia", "Ana", "Garcia", StaticRoleNames.Tenants.FarmTechnician, pw);
        var former = farms.EnsureUser(farm.Id, "bvillanueva", "Ben", "Villanueva", StaticRoleNames.Tenants.FarmTechnician, pw);

        if (_context.Ponds.IgnoreQueryFilters().Any(p => p.TenantId == farm.Id))
        {
            return; // already seeded
        }

        _t = farm.Id;
        _owner = owner.Id;
        _techs = new[] { tech1.Id, tech2.Id };

        // A technician who left the farm in May: deactivated, never deleted (his entries keep their author).
        former.IsActive = false;

        var profile = _context.FarmProfiles.IgnoreQueryFilters().Single(p => p.Id == _t);
        profile.FarmingSystem = FarmingSystem.Intensive;
        profile.TotalAreaHectares = 1.2m;
        profile.PostalCode = "9514";
        profile.ContactName = "Rosa Santos";
        profile.ContactPhone = "0917 222 3333";
        profile.ContactEmail = "office@kiamba-intensive.test";
        _context.SaveChanges();

        _parameters = _context.ParameterDefinitions.AsNoTracking().ToDictionary(p => p.Id);
        _grades = _context.SizeGrades.IgnoreQueryFilters().Where(g => g.TenantId == _t).ToDictionary(g => g.Label);

        SeedPonds();
        SeedPermits();
        var hatcheries = SeedHatcheries();
        var buyers = SeedBuyers();
        var items = SeedItems();

        var cycleIndex = 0;
        foreach (var plan in Cycles)
        {
            SeedCycle(plan, ++cycleIndex, hatcheries[plan.Hatchery], buyers, items, formerTech: cycleIndex <= 2 ? former.Id : null);
        }

        // The app's own counters continue after the sample codes.
        foreach (var scope in Cycles.Select(c => c.Code[..c.Code.LastIndexOf('-')]).Distinct())
        {
            _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.CycleCode, Scope = scope, NextValue = 2 });
        }

        _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.DispatchReceipt, Scope = "2026", NextValue = _receiptNo + 1 });
        _context.SaveChanges();
    }

    // ---------------------------------------------------------------- reference records

    private void SeedPonds()
    {
        var prefixes = _context.PondNamePrefixes.IgnoreQueryFilters().Where(x => x.TenantId == _t).ToDictionary(x => x.ShortCode);
        _ponds = new Dictionary<string, Pond>();

        Pond Add(string prefix, int number, decimal area, PondPurpose purpose, PondConstructionType construction, string aeration, PondManualStatus status = PondManualStatus.Active, string notes = null)
        {
            var pond = new Pond
            {
                TenantId = _t, CreatorUserId = _owner, PrefixId = prefixes[prefix].Id, Number = number, PondCode = PondNaming.FormatCode(prefix, number),
                AreaM2 = area, AverageDepthM = construction == PondConstructionType.Earthen ? 1.2m : 1.4m, MaxDepthM = construction == PondConstructionType.Earthen ? 1.5m : 1.6m,
                Purpose = purpose, ConstructionType = construction, InletType = "PVC pipe with 500-micron filter bag", OutletType = "Central drain with standpipe",
                AerationSystem = aeration, ManualStatus = status, Notes = notes,
            };
            _context.Ponds.Add(pond);
            _ponds[pond.PondCode] = pond;
            return pond;
        }

        const string aerators = "Paddlewheel x4 (1 hp) and long-arm aerator x1";
        for (var n = 1; n <= 4; n++)
        {
            Add("GP", n, PondAreaM2, PondPurpose.GrowOut, PondConstructionType.HdpeLined, aerators);
        }

        var gp05 = Add("GP", 5, PondAreaM2, PondPurpose.GrowOut, PondConstructionType.HdpeLined, aerators, PondManualStatus.UnderMaintenance, "Liner torn along the north dike; repair scheduled.");
        Add("R", 1, 2500m, PondPurpose.Reservoir, PondConstructionType.Earthen, "None");
        _context.SaveChanges();

        foreach (var p in _ponds.Values)
        {
            _context.PondHistories.Add(new PondHistory { TenantId = _t, CreatorUserId = _owner, PondId = p.Id, ChangeDateUtc = LocalUtc(new DateOnly(2025, 10, 1), 9), ChangeType = PondChangeType.Created, Description = "Pond registered (seed)." });
        }

        _context.PondHistories.Add(new PondHistory { TenantId = _t, CreatorUserId = _owner, PondId = gp05.Id, ChangeDateUtc = LocalUtc(new DateOnly(2026, 9, 15), 10), ChangeType = PondChangeType.StatusChange, Description = "Under maintenance: liner torn along the north dike." });
        _context.SaveChanges();
    }

    private void SeedPermits()
    {
        var presets = _context.DocumentPresets.IgnoreQueryFilters().Where(p => p.TenantId == _t).ToDictionary(p => p.Name);

        ComplianceDocument Add(string preset, string number, DateOnly? issued, DateOnly? expiry, string notes = null, bool archived = false, Guid? renewedFrom = null)
        {
            var p = presets[preset];
            var doc = new ComplianceDocument
            {
                Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _owner, CategoryId = p.CategoryId, PresetId = p.Id, Title = p.Name, DocumentNumber = number,
                IssuingAgency = p.DefaultIssuingAgency, IssueDate = issued, ExpiryDate = expiry, Notes = notes ?? "Binder #1, farm office", IsArchived = archived, RenewedFromId = renewedFrom,
            };
            _context.ComplianceDocuments.Add(doc);
            return doc;
        }

        Add("Mayor's / Business Permit", "BP-KIA-2026-0457 (test)", new DateOnly(2026, 1, 15), new DateOnly(2026, 12, 31));
        Add("BFAR Fishpond / Aquafarm Registration", "BFAR-XII-AQF-0921 (test)", new DateOnly(2025, 7, 1), new DateOnly(2027, 6, 30));
        Add("BFAR Shrimp Grow-out Farm Certification (GAqP)", "BFAR-GAqP-XII-0133 (test)", new DateOnly(2024, 2, 1), new DateOnly(2027, 1, 31));
        Add("Environmental Compliance Certificate (ECC)", "ECC-R12-2311-0088 (test)", new DateOnly(2023, 11, 20), null, "No expiry; original in the safe");
        Add("Water Permit", "NWRB-WP-12-2021-044 (test)", new DateOnly(2021, 11, 20), new DateOnly(2026, 11, 20), "Renewal filed 15 Oct 2026");
        var oldSanitary = Add("Sanitary Permit", "SP-2025-0318 (test)", new DateOnly(2025, 2, 1), new DateOnly(2026, 1, 31), archived: true);
        _context.SaveChanges();
        Add("Sanitary Permit", "SP-2026-0291 (test)", new DateOnly(2026, 2, 2), new DateOnly(2027, 1, 31), renewedFrom: oldSanitary.Id);
        _context.SaveChanges();
    }

    private sealed record Hatchery(HatcherySource Source, HatcheryCertificate Health);

    private Dictionary<string, Hatchery> SeedHatcheries()
    {
        var sbh = new HatcherySource
        {
            TenantId = _t, CreatorUserId = _owner, Name = "Sarangani Bay PL Hatchery (test)", ShortCode = "SBH", Address = "Glan, Sarangani", ContactPerson = "P. Hatchery", Phone = "0917 444 5555",
            BfarAccreditationNo = "BFAR-HAT-TEST-014", AccreditationStatus = AccreditationStatus.Accredited,
        };
        var kch = new HatcherySource
        {
            TenantId = _t, CreatorUserId = _owner, Name = "Kiamba Coastal Hatchery (test)", ShortCode = "KCH", Address = "Kiamba, Sarangani", ContactPerson = "R. Hatchery", Phone = "0918 777 8888",
            AccreditationStatus = AccreditationStatus.Pending,
        };
        _context.HatcherySources.AddRange(sbh, kch);
        _context.SaveChanges();

        var sbhOld = new HatcheryCertificate { TenantId = _t, CreatorUserId = _owner, HatcheryId = sbh.Id, CertificateType = CertificateType.Health, CertificateNo = "HC-SBH-2025-07", IssueDate = new DateOnly(2025, 7, 1), ExpiryDate = new DateOnly(2026, 6, 30) };
        var sbhNew = new HatcheryCertificate { TenantId = _t, CreatorUserId = _owner, HatcheryId = sbh.Id, CertificateType = CertificateType.Health, CertificateNo = "HC-SBH-2026-07", IssueDate = new DateOnly(2026, 7, 1), ExpiryDate = new DateOnly(2027, 6, 30) };
        var kchCert = new HatcheryCertificate { TenantId = _t, CreatorUserId = _owner, HatcheryId = kch.Id, CertificateType = CertificateType.Health, CertificateNo = "HC-KCH-2026-09", IssueDate = new DateOnly(2026, 9, 1), ExpiryDate = new DateOnly(2027, 2, 28) };
        _context.HatcheryCertificates.AddRange(sbhOld, sbhNew, kchCert);
        _context.SaveChanges();

        return new Dictionary<string, Hatchery>
        {
            // The certificate valid on each stocking date is picked in SeedCycle.
            ["SBH"] = new(sbh, null),
            ["KCH"] = new(kch, kchCert),
        };
    }

    private HatcheryCertificate CertificateOn(HatcherySource hatchery, DateOnly date) =>
        _context.HatcheryCertificates.Local
            .Where(c => c.HatcheryId == hatchery.Id && c.IssueDate <= date && (c.ExpiryDate == null || c.ExpiryDate >= date))
            .OrderByDescending(c => c.IssueDate)
            .FirstOrDefault();

    private Buyer[] SeedBuyers()
    {
        var buyers = new[]
        {
            new Buyer { TenantId = _t, CreatorUserId = _owner, BuyerType = BuyerType.Company, Name = "Sarangani Seafood Processing (test)", ContactPerson = "Q. Receiving", Phone = "0917 101 2020", Address = "Makar Wharf, General Santos City" },
            new Buyer { TenantId = _t, CreatorUserId = _owner, BuyerType = BuyerType.Company, Name = "Kiamba Market Traders (test)", ContactPerson = "T. Trader", Phone = "0918 303 4040", Address = "Kiamba Public Market, Kiamba" },
            new Buyer { TenantId = _t, CreatorUserId = _owner, BuyerType = BuyerType.Individual, Name = "Nestor Ramos (test)", Phone = "0919 505 6060", Address = "Maitum, Sarangani" },
        };
        _context.Buyers.AddRange(buyers);
        _context.SaveChanges();
        return buyers;
    }

    private sealed class Items
    {
        public InventoryItem[] Feeds { get; init; }
        public InventoryItem Probiotic { get; init; }
        public InventoryItem Dolomite { get; init; }
        public InventoryItem Oxytetracycline { get; init; }
        public InventoryItem VitaminC { get; init; }
    }

    private Items SeedItems()
    {
        InventoryItem Feed(string stage, string spec, string bai, decimal reorder) => new()
        {
            TenantId = _t, CreatorUserId = _owner, Category = InventoryCategory.Feed, Brand = "SampleAqua", ProductName = $"Vannamei {stage} {spec}", FeedType = stage,
            BaiRegistrationNo = bai, Unit = "kg", ReorderLevel = reorder, PackSize = 25m,
        };

        var items = new Items
        {
            Feeds = new[]
            {
                Feed("Starter", "42% CP crumble", "BAI-TEST-1101", 100),
                Feed("Grower", "40% CP pellet", "BAI-TEST-1102", 750),
                Feed("Finisher", "38% CP pellet", "BAI-TEST-1103", 750),
            },
            Probiotic = new InventoryItem { TenantId = _t, CreatorUserId = _owner, Category = InventoryCategory.AdditiveSupplement, Brand = "AquaTest", ProductName = "Bacillus pond probiotic", Unit = "kg", ReorderLevel = 5, PackSize = 1m },
            VitaminC = new InventoryItem { TenantId = _t, CreatorUserId = _owner, Category = InventoryCategory.AdditiveSupplement, Brand = "AquaTest", ProductName = "Vitamin C feed premix", Unit = "kg", ReorderLevel = 2, PackSize = 1m },
            Dolomite = new InventoryItem { TenantId = _t, CreatorUserId = _owner, Category = InventoryCategory.Chemical, Brand = "Generic", ProductName = "Dolomite (alkalinity)", Unit = "kg", ReorderLevel = 100, PackSize = 50m },
            Oxytetracycline = new InventoryItem
            {
                TenantId = _t, CreatorUserId = _owner, Category = InventoryCategory.Chemical, Brand = "VetTest", ProductName = "Oxytetracycline 50% soluble powder", ActiveIngredient = "Oxytetracycline HCl",
                Unit = "kg", PackSize = 1m, DefaultWithdrawalDays = 30,
            },
        };
        _context.InventoryItems.AddRange(items.Feeds);
        _context.InventoryItems.AddRange(items.Probiotic, items.VitaminC, items.Dolomite, items.Oxytetracycline);
        _context.SaveChanges();
        return items;
    }

    private InventoryLot Receive(InventoryItem item, string lotNumber, decimal qty, decimal cost, DateOnly date, string supplier, DateOnly? expiry = null)
    {
        var lot = new InventoryLot { TenantId = _t, CreatorUserId = _owner, ItemId = item.Id, LotNumber = lotNumber, ReceivedDate = date, ExpiryDate = expiry, Supplier = supplier, UnitCost = cost };
        _context.InventoryLots.Add(lot);
        _context.SaveChanges();
        _context.StockMovements.Add(new StockMovement { TenantId = _t, CreatorUserId = _owner, LotId = lot.Id, MovementDateUtc = LocalUtc(date, 9), Type = StockMovementType.Receipt, Quantity = qty, UnitCost = cost, Reason = "Stock received (seed)" });
        _context.SaveChanges();
        return lot;
    }

    // ---------------------------------------------------------------- one cycle

    private sealed class Lots
    {
        public InventoryLot[] Feed { get; } = new InventoryLot[3];
        public decimal[] FeedCost { get; } = new decimal[3];
        public InventoryLot Probiotic { get; set; }
        public InventoryLot VitaminC { get; set; }
        public InventoryLot Dolomite { get; set; }
        public InventoryLot Oxytetracycline { get; set; }
    }

    private void SeedCycle(CyclePlan cp, int cycleIndex, Hatchery hatchery, Buyer[] buyers, Items items, long? formerTech)
    {
        var running = cp.Harvest == null;
        var feedEnd = cp.Harvest ?? LastEntryDate;

        // Daily feed per batch, then lots sized from what the cycle uses (a running cycle also keeps Grower on hand).
        var schedules = cp.Batches.Select(b => FeedPlan(b, cp.Stocking, feedEnd)).ToList();
        var receivedOn = cp.Stocking.AddDays(-10);
        var lots = new Lots();
        var stageCodes = new[] { "ST", "GR", "FN" };
        for (var stage = 0; stage < 3; stage++)
        {
            var needed = schedules.Sum(s => s.Where(d => d.Stage == stage).Sum(d => d.Kg));
            var qty = needed > 0 ? Math.Ceiling(needed * 1.05m / 25m) * 25m + 50m : running && stage == 1 ? 1000m : 0m;
            lots.FeedCost[stage] = new[] { 98m, 86m, 80m }[stage] + cycleIndex;
            if (qty > 0)
            {
                lots.Feed[stage] = Receive(items.Feeds[stage], $"{stageCodes[stage]}-{receivedOn:yyMMdd}", qty, lots.FeedCost[stage], receivedOn, "Feed Dealer GenSan (test)", receivedOn.AddMonths(6));
            }
        }

        var weeks = (int)Math.Ceiling(Days(cp.Stocking, feedEnd) / 7m) + 1;
        lots.Probiotic = Receive(items.Probiotic, $"PB-{receivedOn:yyMMdd}", weeks * cp.Batches.Length * 1m + 4m, 950m, receivedOn, "Agrivet Kiamba (test)", receivedOn.AddMonths(12));
        lots.VitaminC = Receive(items.VitaminC, $"VC-{receivedOn:yyMMdd}", 10m, 620m, receivedOn, "Agrivet Kiamba (test)", receivedOn.AddMonths(12));
        lots.Dolomite = Receive(items.Dolomite, $"DL-{receivedOn:yyMMdd}", 300m, 14m, receivedOn, "Agrivet Kiamba (test)");
        if (cp.Batches.Any(b => b.End == BatchEnd.Failed))
        {
            lots.Oxytetracycline = Receive(items.Oxytetracycline, "OTC-260420", 2m, 3200m, new DateOnly(2026, 4, 20), "VetSupply GenSan (test)", new DateOnly(2027, 4, 30));
        }

        // A Grower lot whose count did not match the stock card: listed at Close Batch and on the trace report (DEC-73).
        if (cycleIndex == 3 && lots.Feed[1] != null)
        {
            lots.Feed[1].NeedsReconciliation = true;
        }

        // Fry delivery: PL received = stocked + not stocked (dead on arrival, count difference).
        var stockedPl = cp.Batches.Sum(b => b.Pl);
        var delivery = new FryDelivery
        {
            TenantId = _t, CreatorUserId = _owner, HatcheryId = hatchery.Source.Id, HatcheryBatchNumber = cp.HatcheryBatchNo, DeliveryDate = cp.Stocking,
            PlAgeDays = 12, PlReceived = stockedPl + cp.DeadOnArrival + cp.CountDifference, CostPhp = Math.Round((stockedPl + cp.DeadOnArrival + cp.CountDifference) * 0.35m, 0),
            PlHealthCertificateNo = $"PLHC-{cp.HatcheryBatchNo}", TransportPermitNo = $"DTP-{cp.Stocking:yyyyMMdd}-{hatchery.Source.ShortCode}",
            // The pending hatchery's SFSC had not arrived yet: left blank, as allowed (DEC-70).
            SfscNo = hatchery.Source.AccreditationStatus == AccreditationStatus.Accredited ? $"SFSC-XII-{cp.Stocking:yyMMdd}" : null,
            StockingFinishedAtUtc = LocalUtc(cp.Stocking, 11), StockingFinishedByUserId = _owner,
        };
        _context.FryDeliveries.Add(delivery);
        _context.SaveChanges();
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _owner, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Ordered, ChangedAtUtc = LocalUtc(cp.Stocking.AddDays(-14), 10), Note = "Ordered by phone" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _techs[0], DeliveryId = delivery.Id, Status = FryDeliveryStatus.Received, ChangedAtUtc = LocalUtc(cp.Stocking, 5, 30) });
        _context.FryDeliveryShortfalls.Add(new FryDeliveryShortfall { TenantId = _t, CreatorUserId = _owner, DeliveryId = delivery.Id, Reason = ShortfallReason.DeadOnArrival, Count = cp.DeadOnArrival, Note = "Dead in the bags on arrival" });
        _context.FryDeliveryShortfalls.Add(new FryDeliveryShortfall { TenantId = _t, CreatorUserId = _owner, DeliveryId = delivery.Id, Reason = ShortfallReason.CountDifference, Count = cp.CountDifference, Note = "Hatchery count was higher than the farm's count" });

        var cycle = new ProductionCycle { TenantId = _t, CreatorUserId = _owner, CycleCode = cp.Code, Status = CycleStatus.Active, FryDeliveryId = delivery.Id };
        _context.ProductionCycles.Add(cycle);
        _context.SaveChanges();

        var health = hatchery.Health ?? CertificateOn(hatchery.Source, cp.Stocking);
        var band = _context.DensityBands.AsNoTracking().FirstOrDefault(b => b.FarmingSystem == FarmingSystem.Intensive && b.ConstructionType == PondConstructionType.HdpeLined);
        var letters = new[] { "A", "B" };

        for (var bi = 0; bi < cp.Batches.Length; bi++)
        {
            var bp = cp.Batches[bi];
            var pond = _ponds[bp.Pond];
            // The former technician logged the first two cycles' second pond until he left in May.
            var tech = bi == 1 && formerTech.HasValue ? formerTech.Value : _techs[bi % 2];

            var round = new PondPreparationRound
            {
                TenantId = _t, CreatorUserId = tech, PondId = pond.Id, StartedAtUtc = LocalUtc(cp.Stocking.AddDays(-8), 8), PreparedAtUtc = LocalUtc(cp.Stocking.AddDays(-2), 15),
                PreparedByUserId = tech, UsedAtUtc = LocalUtc(cp.Stocking, 7),
            };
            _context.PondPreparationRounds.Add(round);
            _context.SaveChanges();
            _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = _t, CreatorUserId = tech, RoundId = round.Id, ObservedAtUtc = LocalUtc(cp.Stocking.AddDays(-8), 9), Description = "Drained; sludge removed from the central drain; liner washed." });
            _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = _t, CreatorUserId = tech, RoundId = round.Id, ObservedAtUtc = LocalUtc(cp.Stocking.AddDays(-6), 9), Description = "Liner sun-dried and disinfected; checked for tears." });
            _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = _t, CreatorUserId = tech, RoundId = round.Id, ObservedAtUtc = LocalUtc(cp.Stocking.AddDays(-3), 9), Description = "Filled to 1.4 m from the reservoir through filter bags; dolomite and probiotic applied." });

            var batch = new PondBatch
            {
                TenantId = _t, CreatorUserId = _owner, CycleId = cycle.Id, PondId = pond.Id, PreparationRoundId = round.Id, Letter = letters[bi], BatchCode = $"{cp.Code}-{letters[bi]}",
                Status = BatchStatus.Stocked, StockedAtUtc = LocalUtc(cp.Stocking, 7, 30), StockingDate = cp.Stocking, PondAreaM2AtStocking = pond.AreaM2, TransportMode = TransportMode.Van,
                TimeProcessedUtc = LocalUtc(cp.Stocking, 6), PlCountStocked = bp.Pl, DeadAtStocking = bp.DeadAtStocking, AcclimationMinutes = bp.AcclimMinutes, InitialSurvivalEstimatePct = 95,
                FarmingSystemAtStocking = FarmingSystem.Intensive, ConstructionTypeAtStocking = pond.ConstructionType, DensityFlag = band?.Judge((decimal)bp.Pl / pond.AreaM2),
                HatcheryCertificationStatusAtStocking = hatchery.Source.DescribeCertification(health, cp.Stocking),
            };
            _context.PondBatches.Add(batch);
            _context.SaveChanges();

            var logs = new BatchLogs(this, batch, tech, cp.Stocking, lots);
            logs.Write(bp, schedules[bi], feedEnd);

            if (bp.End == BatchEnd.Failed)
            {
                SeedFailure(batch, bp, logs, tech);
            }
            else if (!running)
            {
                SeedHarvestsAndSales(cp, bp, batch, logs, tech, buyers);
            }

            if (cp.Closed.HasValue)
            {
                CloseBatch(batch, bp, logs, bp.End == BatchEnd.Failed ? new DateOnly(2026, 5, 8) : cp.Closed.Value);
            }
        }

        if (cp.Closed.HasValue)
        {
            cycle.Status = CycleStatus.Closed;
            cycle.Outcome = CycleOutcome.Completed; // one batch failed; the cycle as a whole still produced a harvest
            cycle.ClosedAtUtc = LocalUtc(cp.Closed.Value, 10);
            cycle.ClosedByUserId = _owner;
        }

        _context.SaveChanges();
    }

    // ---------------------------------------------------------------- harvests, sales, failure, closing

    private void SeedHarvestsAndSales(CyclePlan cp, BatchPlan bp, PondBatch batch, BatchLogs logs, long tech, Buyer[] buyers)
    {
        var processor = buyers[0];
        var market = buyers[1];
        var individual = buyers[2];

        if (bp.PartialKg > 0)
        {
            // Partial harvest: smaller shrimp, sold at the market the same morning and paid in cash.
            var partial = AddHarvest(batch, tech, cp.PartialHarvest.Value, HarvestType.Partial, bp.PartialKg, bp.PartialAbwG, logs, ("50/60", 0.55m), ("60/70", 0.45m));
            AddSale(market, cp.PartialHarvest.Value, partial, price: new() { ["50/60"] = 360m, ["60/70"] = 330m }, paid: 1m, terms: "Cash on delivery", transport: false);
        }

        var totalKg = bp.HarvestKg - bp.PartialKg;
        var total = AddHarvest(batch, tech, cp.Harvest.Value, HarvestType.Total, totalKg, bp.FinalAbwG, logs, ("30/40", 0.20m), ("40/50", 0.60m), ("50/60", 0.20m));
        var prices = new Dictionary<string, decimal> { ["30/40"] = 470m, ["40/50"] = 420m, ["50/60"] = 380m };
        var lastCycle = cp.Closed == null;

        if (!lastCycle)
        {
            AddSale(processor, cp.Harvest.Value, total, prices, paid: 1m, terms: "Paid in full within 7 days", transport: true, paidAfterDays: 5);
            batch.Status = BatchStatus.Harvested;
            return;
        }

        if (bp.Pond == "GP-01")
        {
            // Not sold: 6 kg for staff, 4 kg spoiled while waiting for the truck (DEC-67). The processor re-weighed the rest
            // and accepted about 1% less; half is paid and the balance was due 31 Oct (overdue).
            total.Disposals.Add(new HarvestDisposal { TenantId = _t, Kg = 6m, Reason = DisposalReason.StaffOrHomeUse, Note = "Shared with farm staff" });
            total.Disposals.Add(new HarvestDisposal { TenantId = _t, Kg = 4m, Reason = DisposalReason.SpoiledOrLost, Note = "Spoiled while waiting for the truck" });
            _context.SaveChanges();
            AddSale(processor, cp.Harvest.Value, total, prices, paid: 0.5m, terms: "50% on delivery, balance by 31 Oct", transport: true, dueDate: new DateOnly(2026, 10, 31), reweigh: 0.99m, holdBackKg: 10m);
        }
        else
        {
            // Sold to an individual buyer on credit, not yet paid; 5 kg is not accounted for (Close Batch lists it).
            AddSale(individual, cp.Harvest.Value, total, prices, paid: 0m, terms: "Payment in 15 days", transport: false, dueDate: new DateOnly(2026, 11, 12), holdBackKg: 5m);
        }

        batch.Status = BatchStatus.Harvested;
    }

    private void SeedFailure(PondBatch batch, BatchPlan bp, BatchLogs logs, long tech)
    {
        batch.Status = BatchStatus.Failed;
        _context.BatchFailures.Add(new BatchFailure
        {
            Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _owner, BatchId = batch.Id, FailedOn = FailureDate,
            Reason = "Mass mortality from day 36; AHPND suspected (PCR positive on 27 Apr). Treatment did not stop the losses.", EstimatedLossPhp = 650000m,
        });

        // Salvage harvest the next morning: small, ungraded, inside the 30-day withdrawal period, so none of it was sold.
        var salvage = AddHarvest(batch, tech, FailureDate.AddDays(1), HarvestType.Total, 180m, 6.5m, logs, (SizeGrade.UngradedLabel, 1m));
        salvage.QualityNotes = "Soft shells and pale hepatopancreas on many shrimp.";
        salvage.Disposals.Add(new HarvestDisposal { TenantId = _t, Kg = 180m, Reason = DisposalReason.Other, Note = "Not sold: within the withdrawal period after oxytetracycline; buried on site." });
        _context.SaveChanges();
    }

    /// <summary>Close Batch: store the final indicators the calculator gives, as the app does.</summary>
    private void CloseBatch(PondBatch batch, BatchPlan bp, BatchLogs logs, DateOnly closedOn)
    {
        var s = logs.Summary;
        var facts = new BatchFacts
        {
            PlCountStocked = bp.Pl, PondAreaM2 = batch.PondAreaM2AtStocking, StockingDate = batch.StockingDate, CumulativeFeedKg = s.FeedKg,
            CumulativeMortality = s.Mortalities.Sum(m => m.Count), Mortalities = s.Mortalities, GrowthSamples = s.Growth, Harvests = s.Harvests,
        };
        var ind = IndicatorCalculator.Compute(facts, closedOn);
        batch.FinalAbwG = ind.FinalAbwG;
        batch.FinalFcr = ind.FinalFcr;
        batch.SurvivalRatePct = ind.SurvivalRatePct ?? 0m;
        batch.TotalHarvestKg = ind.TotalHarvestKg;
        batch.TotalFeedKg = ind.CumulativeFeedKg;
        batch.CultureDays = ind.CultureDays ?? (bp.End == BatchEnd.Failed ? Days(batch.StockingDate.Value, FailureDate) : null);
        batch.Status = BatchStatus.Closed;
        batch.ClosedAtUtc = LocalUtc(closedOn, 10);
        batch.ClosedByUserId = _owner;
        _context.SaveChanges();
    }

    /// <summary>A harvest split over size grades by kg share, recorded as a fact for the batch's indicators.</summary>
    private Harvest AddHarvest(PondBatch batch, long userId, DateOnly date, HarvestType type, decimal kg, decimal abwG, BatchLogs logs, params (string Grade, decimal Share)[] split)
    {
        var lines = new List<HarvestGradeLine>();
        var left = kg;
        for (var i = 0; i < split.Length; i++)
        {
            var lineKg = i == split.Length - 1 ? left : Math.Round(kg * split[i].Share, 1);
            left -= lineKg;
            lines.Add(new HarvestGradeLine { TenantId = _t, SizeGradeId = _grades[split[i].Grade].Id, Kg = lineKg });
        }

        var harvest = new Harvest
        {
            TenantId = _t, CreatorUserId = userId, BatchId = batch.Id, HarvestedAtUtc = LocalUtc(date, 4), HarvestType = type, TotalKg = kg, Boxes = (int)Math.Ceiling(kg / 20m), AbwG = abwG,
            DeadAtHarvest = type == HarvestType.Total ? 60 : 0, SmoothShell = true, IntactAppendages = true, NoNecrosis = true, GradeLines = lines,
        };
        _context.Harvests.Add(harvest);
        _context.SaveChanges();

        logs.Summary.Harvests.Add(new HarvestFact
        {
            Date = date, HarvestedAtUtc = harvest.HarvestedAtUtc, IsFinal = type == HarvestType.Total, TotalKg = kg, AbwG = abwG,
            GradeLines = lines.Select(l => (l.Kg, _grades.Values.First(g => g.Id == l.SizeGradeId).MidCountPerKg)).ToList(),
        });
        return harvest;
    }

    /// <summary>
    /// A sale of one harvest's grades. <paramref name="holdBackKg"/> is left off the last line (disposed or unaccounted);
    /// <paramref name="reweigh"/> sets the buyer's accepted kg; <paramref name="paid"/> is the share paid.
    /// </summary>
    private void AddSale(Buyer buyer, DateOnly date, Harvest harvest, Dictionary<string, decimal> price, decimal paid, string terms, bool transport,
        DateOnly? dueDate = null, decimal? reweigh = null, decimal holdBackKg = 0m, int paidAfterDays = 0)
    {
        var lines = new List<SaleLine>();
        for (var i = 0; i < harvest.GradeLines.Count; i++)
        {
            var gl = harvest.GradeLines[i];
            var label = _grades.Values.First(g => g.Id == gl.SizeGradeId).Label;
            var kg = i == harvest.GradeLines.Count - 1 ? gl.Kg - holdBackKg : gl.Kg;
            lines.Add(new SaleLine
            {
                TenantId = _t, HarvestGradeLineId = gl.Id, Kg = kg, PricePerKg = price[label],
                BuyerAcceptedKg = reweigh.HasValue ? Math.Round(kg * reweigh.Value, 1) : null,
            });
        }

        var amount = lines.Sum(l => l.Amount);
        var sale = new Sale
        {
            TenantId = _t, CreatorUserId = _owner, BuyerId = buyer.Id, SaleDate = date, DispatchReceiptNo = $"DR-{date:yyyy}-{++_receiptNo:0000}", PaymentTerms = terms, DueDate = dueDate,
            Destination = buyer.Address, Lines = lines,
        };

        if (transport)
        {
            sale.Transporter = "SOX Cold Haul (test)";
            sale.DriverName = "E. Driver";
            sale.PlateNo = "NBX 1234";
            sale.LoadedAtUtc = LocalUtc(date, 6);
            sale.LocalTransportPermitNo = $"LTP-{date:yyyyMMdd}-01";
            sale.TemperatureNote = "Iced 1:1 in insulated tubs; 2 °C at loading";
        }

        if (paid > 0)
        {
            sale.Payments.Add(new SalePayment { TenantId = _t, CreatorUserId = _owner, PaidOn = date.AddDays(paidAfterDays), Amount = paid == 1m ? amount : Math.Round(amount * paid, 0), Method = paid == 1m && paidAfterDays == 0 ? "Cash" : "Bank transfer" });
        }

        _context.Sales.Add(sale);
        _context.SaveChanges();
    }

    // ---------------------------------------------------------------- feed plan

    private static int FeedStage(int doc) => doc <= 20 ? 0 : doc <= 70 ? 1 : 2;

    /// <summary>
    /// Daily feed (kg, whole pond) by day of culture up to <paramref name="end"/>: the planned total (PlannedKg x FCR over
    /// 110 days, rising as the shrimp grow). A harvested batch uses its own culture length; a failed batch is cut back by
    /// 40% from day 36 when the losses started and stops at the failure date.
    /// </summary>
    private static List<(int Doc, decimal Kg, int Stage)> FeedPlan(BatchPlan bp, DateOnly stocking, DateOnly end)
    {
        var plannedDays = bp.End == BatchEnd.Harvested ? Days(stocking, end) : 110;
        var lastDoc = bp.End switch
        {
            BatchEnd.Harvested => plannedDays - 1,
            BatchEnd.Failed => Days(stocking, FailureDate) - 1,
            _ => Days(stocking, end),
        };

        var total = bp.PlannedKg * bp.Fcr;
        var weights = Enumerable.Range(1, plannedDays - 1).Select(d => Math.Pow(d, 1.4)).ToList();
        var sum = weights.Sum();
        var list = new List<(int, decimal, int)>();
        for (var d = 1; d <= lastDoc; d++)
        {
            var kg = Math.Round(total * (decimal)(weights[Math.Min(d, plannedDays - 1) - 1] / sum), 1);
            if (bp.End == BatchEnd.Failed && d >= 36)
            {
                kg = Math.Round(kg * 0.6m, 1);
            }

            list.Add((d, Math.Max(kg, 0.4m), FeedStage(d)));
        }

        return list;
    }

    // ---------------------------------------------------------------- time helpers

    /// <summary>Farm local time (Asia/Manila, UTC+8) to UTC.</summary>
    private static DateTime LocalUtc(DateOnly d, int hour, int min = 0) =>
        DateTime.SpecifyKind(d.ToDateTime(new TimeOnly(hour, min)).AddHours(-8), DateTimeKind.Utc);

    private static int Days(DateOnly from, DateOnly to) => to.DayNumber - from.DayNumber;

    // ---------------------------------------------------------------- logs of one batch

    private sealed class Summary
    {
        public decimal FeedKg { get; set; }
        public List<MortalityFact> Mortalities { get; } = new();
        public List<GrowthSampleFact> Growth { get; } = new();
        public List<HarvestFact> Harvests { get; } = new();
    }

    /// <summary>Feeding sessions, water quality, growth samples, mortality, treatments and notes for one batch.</summary>
    private sealed class BatchLogs
    {
        private readonly IntensiveSampleBuilder _b;
        private readonly CapstoneDbContext _context;
        private readonly PondBatch _batch;
        private readonly long _user;
        private readonly DateOnly _stocking;
        private readonly Lots _lots;
        private readonly int _t;

        public Summary Summary { get; } = new();

        public BatchLogs(IntensiveSampleBuilder builder, PondBatch batch, long user, DateOnly stocking, Lots lots)
        {
            _b = builder;
            _context = builder._context;
            _t = builder._t;
            _batch = batch;
            _user = user;
            _stocking = stocking;
            _lots = lots;
        }

        public void Write(BatchPlan bp, List<(int Doc, decimal Kg, int Stage)> feed, DateOnly feedEnd)
        {
            var lastDoc = bp.End switch
            {
                BatchEnd.Failed => Days(_stocking, FailureDate),
                BatchEnd.Running => Days(_stocking, LastEntryDate),
                _ => Days(_stocking, feedEnd) - 1,
            };

            Water(LocalUtc(_stocking.AddDays(-1), 16), LogType.PreStockingWaterQuality,
                (ParameterCodes.Temperature, 29.0m), (ParameterCodes.Salinity, 20m), (ParameterCodes.PH, 7.9m), (ParameterCodes.DO, 6.0m),
                (ParameterCodes.Alkalinity, 140m), (ParameterCodes.Tan, 0.10m), (ParameterCodes.Nitrite, 0.05m));

            foreach (var day in feed)
            {
                FeedDay(day.Doc, day.Kg, day.Stage, bp);
            }

            WaterQuality(bp, lastDoc);
            GrowthSamples(bp, lastDoc);
            Mortalities(bp, lastDoc);
            Treatments(bp, lastDoc);
            _context.SaveChanges();
        }

        // ---- feeding

        private void FeedDay(int doc, decimal kg, int stage, BatchPlan bp)
        {
            var lot = _lots.Feed[stage];
            var cost = _lots.FeedCost[stage];
            var day = _stocking.AddDays(doc);
            var amKg = Math.Round(kg * (doc <= 60 ? 0.45m : 0.50m), 1);
            var pmKg = kg - amKg;
            var notes = doc <= 25 ? "Broadcast along the dikes" : "Check trays at 2 h; ration adjusted";

            // Not fed: one morning of heavy molting, and the dusk when DO fell in the running cycle (DEC-50).
            var skipAm = bp.End == BatchEnd.Harvested && doc == 41;
            var skipPm = bp.End == BatchEnd.Running && doc == 24;
            if (skipAm)
            {
                NotFed(day, FeedingSessionTime.AM, "Heavy molting seen at dawn; morning feed held.");
                pmKg = kg;
            }
            else
            {
                Fed(day, FeedingSessionTime.AM, doc % 5 == 0 ? null : "07:00", lot, amKg, cost, notes);
            }

            if (skipPm)
            {
                NotFed(day, FeedingSessionTime.PM, "DO 3.6 at dusk; evening feed held.");
                Summary.FeedKg += skipAm ? 0 : amKg;
                return;
            }

            // Typed time on most sessions; every fifth day left blank ("Not recorded", still counts as logged).
            Fed(day, FeedingSessionTime.PM, doc % 5 == 0 ? null : doc % 2 == 0 ? "17:30" : "17:45", lot, pmKg, cost, notes);
            Summary.FeedKg += (skipAm ? 0 : amKg) + pmKg;
        }

        private void Fed(DateOnly day, FeedingSessionTime session, string time, InventoryLot lot, decimal kg, decimal cost, string notes)
        {
            var at = LocalUtc(day, session == FeedingSessionTime.AM ? 7 : 17, session == FeedingSessionTime.AM ? 0 : 30);
            var s = new FeedingSession
            {
                Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _user, BatchId = _batch.Id, FeedDate = day, Session = session, Status = FeedingStatus.Fed,
                FedAtTime = time, Notes = notes, ClientRequestId = Guid.NewGuid(),
            };
            _context.FeedingSessions.Add(s);
            _context.StockMovements.Add(new StockMovement { TenantId = _t, CreatorUserId = _user, LotId = lot.Id, MovementDateUtc = at, Type = StockMovementType.Usage, Quantity = -kg, UnitCost = cost, BatchId = _batch.Id, FeedingSessionId = s.Id });
        }

        private void NotFed(DateOnly day, FeedingSessionTime session, string notes) =>
            _context.FeedingSessions.Add(new FeedingSession
            {
                Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _user, BatchId = _batch.Id, FeedDate = day, Session = session, Status = FeedingStatus.NotFed,
                Notes = notes, ClientRequestId = Guid.NewGuid(),
            });

        // ---- water quality

        private ProductionLog NewLog(DateTime at, LogType type, string notes = null)
        {
            var log = new ProductionLog { Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _user, BatchId = _batch.Id, PondId = _batch.PondId, LogType = type, ObservedAtUtc = at, Notes = notes, ClientRequestId = Guid.NewGuid() };
            _context.ProductionLogs.Add(log);
            return log;
        }

        private void Water(DateTime at, LogType type, params (string Code, decimal Value)[] readings)
        {
            var log = NewLog(at, type);
            foreach (var (code, value) in readings)
            {
                var p = _b._parameters[code];
                _context.WaterQualityMeasurements.Add(new WaterQualityMeasurement { Id = Guid.NewGuid(), TenantId = _t, LogId = log.Id, ParameterCode = code, Value = value, UnitCode = p.UnitCode, IsOutOfRange = p.IsOutOfOptimalRange(value), Side = p.SideOf(value) });
            }
        }

        /// <summary>
        /// Dawn DO, temperature and pH every day; salinity, TAN, nitrite and alkalinity every week. Late in culture TAN rises
        /// above 1.0 once, alkalinity falls below 100 once (dolomite the next day), and the running cycle ends on a low DO.
        /// </summary>
        private void WaterQuality(BatchPlan bp, int lastDoc)
        {
            for (var d = 1; d <= lastDoc; d++)
            {
                var at = LocalUtc(_stocking.AddDays(d), 5, 30);
                var lowDo = (bp.End == BatchEnd.Harvested && d == 64) || (bp.End == BatchEnd.Running && d == lastDoc);
                var dawn = new List<(string, decimal)>
                {
                    (ParameterCodes.DO, lowDo ? 3.7m : 4.6m + ((d * 7) % 15) / 10m),
                    (ParameterCodes.Temperature, 27.6m + ((d * 5) % 26) / 10m),
                    (ParameterCodes.PH, 7.7m + ((d * 3) % 6) / 10m),
                };

                if (d % 7 == 0)
                {
                    var lateTan = bp.End == BatchEnd.Harvested && d == 84;
                    var lowAlk = d == 49;
                    dawn.Add((ParameterCodes.Salinity, 18m + (d / 7) % 5));
                    dawn.Add((ParameterCodes.Tan, lateTan ? 1.35m : Math.Min(0.9m, 0.10m + d * 0.006m)));
                    dawn.Add((ParameterCodes.Nitrite, Math.Min(0.4m, 0.02m + d * 0.003m)));
                    dawn.Add((ParameterCodes.Alkalinity, lowAlk ? 92m : 120m + (d * 11) % 50));
                }

                Water(at, LogType.WaterQuality, dawn.ToArray());
            }
        }

        // ---- growth

        private void GrowthSamples(BatchPlan bp, int lastDoc)
        {
            // Target size for a failed or running batch: about 22 g at day 110.
            var finalAbw = bp.End == BatchEnd.Harvested ? bp.FinalAbwG : 22m;
            var horizon = bp.End == BatchEnd.Harvested ? lastDoc + 1 : 110;
            var finalSurvival = bp.End == BatchEnd.Harvested ? 80m : 85m;
            var n = 0;
            for (var d = 14; d <= lastDoc; d += 7)
            {
                n++;
                var abw = Math.Max(0.15m, Math.Round(finalAbw * (decimal)Math.Pow((double)d / horizon, 1.4), 2));
                if (bp.End == BatchEnd.Failed && d >= 35)
                {
                    abw = Math.Round(abw * 0.9m, 2); // losses and the feed cut slowed growth
                }

                decimal? survival = n % 3 == 0 ? Math.Round(95m - (95m - finalSurvival) * d / horizon, 0) : null;
                if (bp.End == BatchEnd.Failed && d >= 42)
                {
                    survival = 55m;
                }

                Sample(LocalUtc(_stocking.AddDays(d), 9), abw, survival);
            }
        }

        private void Sample(DateTime at, decimal abw, decimal? survival)
        {
            var log = NewLog(at, LogType.GrowthSampling);
            var weight = Math.Round(abw * 100m, 1);
            var abwG = IndicatorCalculator.Abw(weight, 100);
            _context.GrowthSamplingDetails.Add(new GrowthSamplingDetail { Id = log.Id, TenantId = _t, SampleCount = 100, TotalSampleWeightG = weight, AbwG = abwG, EstimatedSurvivalPct = survival });
            Summary.Growth.Add(new GrowthSampleFact { Date = DateOnly.FromDateTime(at.AddHours(8)), ObservedAtUtc = at, AbwG = abwG, EstimatedSurvivalPct = survival });
        }

        // ---- mortality

        private void Mortalities(BatchPlan bp, int lastDoc)
        {
            void Dead(int d, int count, MortalityCause cause, string what, string symptoms, string response = null, bool high = false)
            {
                if (d > lastDoc)
                {
                    return;
                }

                var at = LocalUtc(_stocking.AddDays(d), 6, 15);
                var log = NewLog(at, LogType.Mortality);
                _context.MortalityDetails.Add(new MortalityDetail
                {
                    Id = log.Id, TenantId = _t, Count = count, Cause = cause, IsHighMortality = high,
                    DiseaseName = cause == MortalityCause.Disease ? what : null, OtherCause = cause == MortalityCause.Others ? what : null,
                    Symptoms = symptoms, ResponseAction = response,
                });
                Summary.Mortalities.Add(new MortalityFact { ObservedAtUtc = at, Count = count });
            }

            var pl = bp.Pl;
            Dead(5, (int)(pl * 0.006m), MortalityCause.Others, "Stress after stocking", "Weak PL near the dike");
            Dead(33, (int)(pl * 0.004m), MortalityCause.Others, "Molting-related losses", "Soft-shelled shrimp in the check trays");
            if (bp.End == BatchEnd.Harvested)
            {
                Dead(64, (int)(pl * 0.005m), MortalityCause.WaterQuality, null, "Shrimp at the surface at dawn", "Extra aerators run overnight");
            }

            if (bp.End == BatchEnd.Failed)
            {
                const string disease = "AHPND (suspected)";
                const string signs = "Pale, shrunken hepatopancreas; empty gut; shrimp at the pond edge";
                Dead(36, 2500, MortalityCause.Disease, disease, signs, "Feed cut by 40%; sample sent for PCR");
                Dead(39, 6000, MortalityCause.Disease, disease, signs, "Treatment started on the vet's prescription", high: true);
                Dead(42, 15000, MortalityCause.Disease, disease, signs, "Owner informed; salvage harvest considered", high: true);
                Dead(44, 22000, MortalityCause.Disease, disease, signs, "Batch declared failed", high: true);
            }
        }

        // ---- treatments and notes

        private void Treatments(BatchPlan bp, int lastDoc)
        {
            void Apply(int d, InventoryLot lot, decimal qty, string reason, decimal? dose = null, string unit = null, string method = null, DateOnly? end = null, int? withdrawal = null, string rx = null)
            {
                if (d > lastDoc || lot == null)
                {
                    return;
                }

                var at = LocalUtc(_stocking.AddDays(d), 10);
                var log = NewLog(at, LogType.ChemicalApplication);
                _context.ChemicalApplicationDetails.Add(new ChemicalApplicationDetail
                {
                    Id = log.Id, TenantId = _t, Reason = reason, Dosage = dose, DosageUnit = unit, Method = method, EndDate = end, WithdrawalDays = withdrawal, PrescriptionRef = rx,
                });
                _context.StockMovements.Add(new StockMovement { TenantId = _t, CreatorUserId = _user, LotId = lot.Id, MovementDateUtc = at, Type = StockMovementType.Usage, Quantity = -qty, UnitCost = lot.UnitCost, BatchId = _batch.Id, SourceLogId = log.Id });
            }

            // Weekly pond probiotic.
            for (var d = 7; d <= lastDoc; d += 7)
            {
                Apply(d, _lots.Probiotic, 1m, "Weekly probiotic for the pond bottom and water", 1m, "kg/1,000 m²", "Activated in pond water 4 h, then broadcast");
            }

            // Alkalinity was 92 at day 49: dolomite the next day.
            Apply(50, _lots.Dolomite, 50m, "Alkalinity below 100 ppm (92)", 50m, "kg/1,000 m²", "Broadcast over the pond surface");

            // Vitamin C premix in the feed for a week after the low-DO morning (day 64) of harvested batches.
            if (bp.End == BatchEnd.Harvested)
            {
                Apply(65, _lots.VitaminC, 2m, "Stress after low DO at dawn", 3m, "g/kg feed", "Mixed into the feed", end: _stocking.AddDays(71));
            }

            if (bp.End == BatchEnd.Failed)
            {
                // Oxytetracycline for 5 days on a veterinarian's prescription; 30-day withdrawal (DEC-57).
                Apply(39, _lots.Oxytetracycline, 1m, "Suspected AHPND; losses rising", 4m, "g/kg feed", "Coated on feed with a binder", end: _stocking.AddDays(43), withdrawal: 30,
                    rx: "RX-2026-0414 (Dr. L. Navarro, test)");
                NewLog(LocalUtc(_stocking.AddDays(41), 15), LogType.GeneralNote, "PCR result from the BFAR fish health lab: positive for the AHPND toxin genes.");
            }

            if (bp.End == BatchEnd.Running)
            {
                NewLog(LocalUtc(LastEntryDate, 18), LogType.GeneralNote, "Two aerators serviced; spare paddlewheel motor ordered.");
            }
        }
    }
}
