using Capstone.Authorization.Roles;
using Capstone.Compliance;
using Capstone.Domain;
using Capstone.Farms;
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
/// Sample data for the Codespace "FPMS_Sample" database (Seed:SampleData=true), shaped to show the table and list features:
/// paged lists, filters with many options, pond cards beyond the first 24, pond locks, archiving, preparation changes and
/// the farm code history (DEC-77, DEC-78).
///
/// One clearly-labelled test farm (General Santos City) with an Owner and four Technicians (one inactive), whiteleg
/// shrimp (vannamei), 28 ponds named by construction type (EP earthen, CP concrete, HP HDPE-lined; two archived), three
/// hatcheries with different accreditation, five buyers (one inactive), and seven production cycles over about eleven
/// months: four closed, two running and one waiting to be closed (one batch harvested, one failed). Every pond status
/// appears at least once.
///
/// Dates are counted back from the day the database is seeded, so the running batches always end yesterday and the
/// dashboard, the stale-preparation warning and the permit alerts look current. Cycle codes, batch codes and dispatch
/// receipts use the app's own formats and sequences. No real farm or personal data.
/// </summary>
public class SampleDataBuilder
{
    public const string FarmCode = "gensan-semi";

    /// <summary>The code the farm used before the Owner changed it (DEC-78); it stays reserved and points to the new one.</summary>
    public const string FormerFarmCode = "tambler-shrimp";

    private readonly CapstoneDbContext _context;

    /// <summary>Farm local date the sample is counted back from. Entries end the day before.</summary>
    private readonly DateOnly _today;

    public SampleDataBuilder(CapstoneDbContext context, DateOnly? today = null)
    {
        _context = context;
        _today = today ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8));
    }

    private DateOnly LastEntry => _today.AddDays(-1);

    private DateOnly D(int offset) => _today.AddDays(offset);

    // ---------------------------------------------------------------- plans

    private sealed record PondSpec(PondConstructionType Type, int Number, decimal AreaM2, decimal AvgDepthM, decimal MaxDepthM, int CreatedOffset);

    private enum BatchEnd { Closed, Harvested, Failed, FailedClosed, Running }

    /// <summary>
    /// One pond stocking. Density is PL per m2; survival, ABW and FCR are what the harvest works out to (or is heading for).
    /// PartialDoc takes PartialShare of the harvest weight early. FailDoc ends a failed batch with a small emergency harvest.
    /// </summary>
    private sealed record BatchPlan(string Pond, decimal Density, decimal Survival, decimal FinalAbwG, decimal Fcr,
        int? PartialDoc = null, decimal PartialShare = 0m, BatchEnd End = BatchEnd.Closed, int? FailDoc = null, string FailReason = null);

    /// <summary>One fry delivery and the cycle it starts. CloseAfterDays null: the cycle is still open.</summary>
    private sealed record CyclePlan(string Key, string Hatchery, int StockOffset, int CultureDays, int? CloseAfterDays, string HatcheryBatchNo, BatchPlan[] Batches);

    private static BatchPlan B(string pond, decimal density, decimal survival, decimal abw, decimal fcr, int? partialDoc = null, decimal partialShare = 0m) =>
        new(pond, density, survival, abw, fcr, partialDoc, partialShare);

    private static BatchPlan Run(string pond, decimal density, decimal survival = 0.78m, decimal abw = 20m, decimal fcr = 1.40m, int? partialDoc = null, decimal partialShare = 0m) =>
        new(pond, density, survival, abw, fcr, partialDoc, partialShare, BatchEnd.Running);

    private static readonly PondSpec[] PondSpecs = BuildPondSpecs();

    private static PondSpec[] BuildPondSpecs()
    {
        var list = new List<PondSpec>();
        decimal[] earthen = { 2000, 2500, 2500, 2200, 2400, 2000, 2500, 2300, 2200, 2500, 2000, 2400, 2100, 2300, 1800, 1800, 2200, 2200 };
        for (var i = 0; i < earthen.Length; i++)
        {
            list.Add(new PondSpec(PondConstructionType.Earthen, i + 1, earthen[i], 1.2m, 1.5m, i >= 16 ? -20 : -400));
        }

        decimal[] concrete = { 600, 600, 600, 600, 500, 500 };
        for (var i = 0; i < concrete.Length; i++)
        {
            list.Add(new PondSpec(PondConstructionType.Concrete, i + 1, concrete[i], 1.4m, 1.6m, -400));
        }

        decimal[] lined = { 1000, 1000, 1200, 1200 };
        for (var i = 0; i < lined.Length; i++)
        {
            list.Add(new PondSpec(PondConstructionType.HdpeLined, i + 1, lined[i], 1.5m, 1.8m, -360));
        }

        return list.ToArray();
    }

    /// <summary>In stocking order. Offsets are days before the seed date.</summary>
    private static readonly CyclePlan[] CyclePlans =
    {
        // Closed: eight earthen ponds, two partial harvests. EP-15 and EP-16 were archived after this cycle.
        new("C1", "GBH", -330, 105, 10, "GBH-B1201", new[]
        {
            B("EP-01", 45, 0.76m, 20.5m, 1.38m), B("EP-02", 45, 0.74m, 19.8m, 1.42m, 90, 0.15m), B("EP-03", 44, 0.75m, 20.1m, 1.40m),
            B("EP-04", 45, 0.73m, 19.5m, 1.44m), B("EP-05", 46, 0.77m, 20.8m, 1.36m, 90, 0.12m), B("EP-06", 45, 0.72m, 19.2m, 1.46m),
            B("EP-15", 42, 0.70m, 18.6m, 1.50m), B("EP-16", 42, 0.68m, 18.2m, 1.55m),
        }),
        // Closed: intensive concrete ponds. CP-04 failed with suspected white spot at DOC 48 and went under maintenance.
        new("C2", "SAH", -320, 95, 15, "SAH-0118", new[]
        {
            B("CP-01", 115, 0.80m, 18.4m, 1.28m), B("CP-02", 115, 0.78m, 18.0m, 1.32m), B("CP-03", 118, 0.79m, 18.2m, 1.30m),
            new BatchPlan("CP-04", 115, 0.20m, 18m, 1.30m, End: BatchEnd.FailedClosed, FailDoc: 48, FailReason: "White spot (WSSV) suspected after mass mortality; emergency harvest."),
        }),
        // Closed: ten ponds (earthen and HDPE-lined), two partial harvests, one sale voided and re-entered, one batch reopened.
        new("C3", "GBH", -200, 108, 12, "GBH-B0423", new[]
        {
            B("EP-07", 45, 0.75m, 20.6m, 1.39m), B("EP-08", 45, 0.74m, 20.0m, 1.41m), B("EP-09", 44, 0.76m, 20.9m, 1.37m),
            B("EP-10", 46, 0.73m, 19.7m, 1.43m), B("EP-13", 45, 0.75m, 20.3m, 1.40m), B("EP-14", 45, 0.71m, 19.0m, 1.47m),
            B("HP-01", 110, 0.79m, 19.4m, 1.30m, 85, 0.18m), B("HP-02", 110, 0.78m, 19.1m, 1.32m, 85, 0.18m),
            B("HP-03", 108, 0.80m, 19.6m, 1.29m), B("HP-04", 108, 0.77m, 18.9m, 1.33m),
        }),
        // Closed: a cycle from a hatchery that is not accredited; lower survival.
        new("C4", "KCH", -190, 100, 12, "KCH-0503", new[]
        {
            B("EP-01", 44, 0.66m, 18.8m, 1.55m), B("EP-02", 44, 0.62m, 18.1m, 1.62m), B("EP-03", 45, 0.68m, 19.0m, 1.52m), B("EP-04", 44, 0.64m, 18.4m, 1.58m),
        }),
        // Open, waiting to be closed: EP-11 total-harvested six days ago; EP-12 failed at DOC 92.
        new("C7", "KCH", -112, 106, null, "KCH-0720", new[]
        {
            new BatchPlan("EP-11", 45, 0.72m, 19.6m, 1.45m, End: BatchEnd.Harvested),
            new BatchPlan("EP-12", 45, 0.30m, 15m, 1.45m, End: BatchEnd.Failed, FailDoc: 92, FailReason: "Acute hepatopancreatic necrosis (AHPND) suspected; shrimp off feed, red bodies on the dike."),
        }),
        // Running, DOC 75: six earthen and three concrete ponds; CP-01 partial-harvested five days ago.
        new("C5", "GBH", -75, 105, null, "GBH-B0826", new[]
        {
            Run("EP-01", 45), Run("EP-02", 45), Run("EP-03", 44), Run("EP-04", 45), Run("EP-05", 46), Run("EP-06", 38),
            Run("CP-01", 115, 0.80m, 18.4m, 1.28m, 70, 0.12m), Run("CP-02", 115, 0.80m, 18.4m, 1.28m), Run("CP-03", 118, 0.80m, 18.4m, 1.28m),
        }),
        // Running, DOC 28. EP-10 is stocked above the semi-intensive band.
        new("C6", "SAH", -28, 105, null, "SAH-1012", new[]
        {
            Run("EP-07", 45), Run("EP-08", 45), Run("EP-09", 46), Run("EP-10", 62), Run("HP-01", 110, 0.80m, 19.4m, 1.30m), Run("HP-02", 110, 0.80m, 19.4m, 1.30m),
        }),
    };

    private static readonly Dictionary<string, decimal> GradePrices = new()
    {
        ["30/40"] = 480m, ["40/50"] = 420m, ["50/60"] = 380m, ["60/70"] = 340m, ["70/80"] = 310m,
        ["80/90"] = 290m, ["90/100"] = 270m, ["100/120"] = 250m, [SizeGrade.UngradedLabel] = 150m,
    };

    // ---------------------------------------------------------------- state

    private int _t;
    private long _ownerId;
    private long[] _techs;
    private long _formerTechId;
    private Dictionary<string, Pond> _ponds;
    private Dictionary<string, HatcherySource> _hatcheries;
    private List<HatcheryCertificate> _certificates;
    private Dictionary<string, Buyer> _buyers;
    private List<SizeGrade> _grades;
    private Dictionary<string, ParameterDefinition> _parameters;
    private InventoryItem[] _feedItems;
    private InventoryItem _probiotic, _lime, _bkc, _vitaminC, _zeolite, _chlorine;
    private readonly List<SalePlan> _salePlans = new();
    private readonly Dictionary<string, int> _cycleSequences = new();

    private enum Pay { Paid, PaidNet7, PartialOverdue, PartialNotDue, UnpaidNotDue, UnpaidOverdue }

    private sealed record SaleLinePlan(HarvestGradeLine Line, decimal Kg, decimal? AcceptedKg, decimal Price);

    private sealed record SalePlan(DateOnly Date, Buyer Buyer, List<SaleLinePlan> Lines, Pay Pay, bool Transport, string VoidReason = null);

    /// <summary>What the logs of one batch add up to, so its final indicators can be computed like Close Batch does.</summary>
    private sealed class BatchLogSummary
    {
        public decimal FeedKg { get; set; }
        public List<MortalityFact> Mortalities { get; } = new();
        public List<GrowthSampleFact> Growth { get; } = new();
        public List<HarvestFact> Harvests { get; } = new();
    }

    // ---------------------------------------------------------------- entry point

    public void Create()
    {
        var farms = new FarmSeedBuilder(_context);
        var pw = SeedOptions.DevelopmentPassword;

        var farm = farms.EnsureFarm(FarmCode, "GenSan Semi-Intensive Shrimp Farm (test)", "Purok 5, Brgy. Tambler (test data)", "General Santos City", "South Cotabato");
        var owner = farms.EnsureUser(farm.Id, "owner", "Elena", "Dela Cruz", StaticRoleNames.Tenants.FarmOwner, pw);
        var tech1 = farms.EnsureUser(farm.Id, "tech1", "Jun", "Bautista", StaticRoleNames.Tenants.FarmTechnician, pw);
        var tech2 = farms.EnsureUser(farm.Id, "tech2", "Lito", "Mendoza", StaticRoleNames.Tenants.FarmTechnician, pw);
        var tech3 = farms.EnsureUser(farm.Id, "areyes", "Ana", "Reyes", StaticRoleNames.Tenants.FarmTechnician, pw);
        var former = farms.EnsureUser(farm.Id, "rgarcia", "Ramon", "Garcia", StaticRoleNames.Tenants.FarmTechnician, pw);

        if (_context.Ponds.IgnoreQueryFilters().Any(p => p.TenantId == farm.Id))
        {
            return;
        }

        former.IsActive = false; // left the farm after the first cycle; his entries stay
        _t = farm.Id;
        _ownerId = owner.Id;
        _techs = new[] { tech1.Id, tech2.Id, tech3.Id };
        _formerTechId = former.Id;
        _context.SaveChanges();

        SeedProfile();
        SeedFarmCodeChange("Elena Dela Cruz");
        SeedPonds();
        SeedResources();
        SeedInventoryItems();
        SeedPermits();

        _grades = _context.SizeGrades.IgnoreQueryFilters().Where(g => g.TenantId == _t).OrderBy(g => g.SortOrder).ToList();
        _parameters = _context.ParameterDefinitions.AsNoTracking().ToDictionary(p => p.Id);

        var lotCounter = 0;
        foreach (var cp in CyclePlans)
        {
            ApplyPondEventsBefore(D(cp.StockOffset));
            SeedCycle(cp, ref lotCounter);
        }

        ApplyPondEventsBefore(_today);
        SeedIdlePondPreparation();
        SeedExtraDeliveries();
        SeedSales();
        SeedSequences();
    }

    // ---------------------------------------------------------------- time helpers

    /// <summary>Farm local time (Asia/Manila, UTC+8) to UTC.</summary>
    private static DateTime Local(DateOnly d, int hour, int min = 0) =>
        DateTime.SpecifyKind(d.ToDateTime(new TimeOnly(hour, min)).AddHours(-8), DateTimeKind.Utc);

    private static int Days(DateOnly from, DateOnly to) => to.DayNumber - from.DayNumber;

    private long Tech(int i) => _techs[Math.Abs(i) % _techs.Length];

    // ---------------------------------------------------------------- farm, ponds, resources

    private void SeedProfile()
    {
        var profile = _context.FarmProfiles.IgnoreQueryFilters().First(p => p.Id == _t);
        profile.ContactName = "Elena Dela Cruz";
        profile.ContactPhone = "0917 123 4567";
        profile.ContactEmail = "owner@gensan-semi.test";
        profile.PostalCode = "9500";
        profile.TotalAreaHectares = 6.5m;
        profile.Latitude = 6.0838m;
        profile.Longitude = 125.1270m;
        profile.FarmingSystem = FarmingSystem.SemiIntensive;
        _context.SaveChanges();
    }

    private void SeedFarmCodeChange(string ownerName)
    {
        if (_context.FarmCodeChanges.Any(x => x.TenantId == _t))
        {
            return;
        }

        _context.FarmCodeChanges.Add(new FarmCodeChange
        {
            Id = Guid.NewGuid(), TenantId = _t, OldCode = FormerFarmCode, NewCode = FarmCode, ChangedByUserId = _ownerId, ChangedByName = ownerName, ChangedAt = Local(D(-62), 9, 15),
        });
        _context.SaveChanges();
    }

    private PondNamePrefix EnsurePrefix(string name, string shortCode)
    {
        var prefix = _context.PondNamePrefixes.IgnoreQueryFilters().FirstOrDefault(x => x.TenantId == _t && x.ShortCode == shortCode);
        if (prefix != null)
        {
            return prefix;
        }

        var order = (_context.PondNamePrefixes.IgnoreQueryFilters().Where(x => x.TenantId == _t).Max(x => (int?)x.SortOrder) ?? 0) + 1;
        prefix = new PondNamePrefix { TenantId = _t, Name = name, ShortCode = shortCode, SortOrder = order, IsActive = true };
        _context.PondNamePrefixes.Add(prefix);
        _context.SaveChanges();
        return prefix;
    }

    private void SeedPonds()
    {
        var prefixes = new Dictionary<PondConstructionType, PondNamePrefix>
        {
            [PondConstructionType.Earthen] = EnsurePrefix("Earthen Pond", "EP"),
            [PondConstructionType.Concrete] = EnsurePrefix("Concrete Pond", "CP"),
            [PondConstructionType.HdpeLined] = EnsurePrefix("HDPE-lined Pond", "HP"),
        };

        _ponds = new Dictionary<string, Pond>();
        foreach (var s in PondSpecs)
        {
            var prefix = prefixes[s.Type];
            var code = PondNaming.FormatCode(prefix.ShortCode, s.Number);
            var earthen = s.Type == PondConstructionType.Earthen;
            var pond = new Pond
            {
                TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(D(s.CreatedOffset), 9), PrefixId = prefix.Id, Number = s.Number, PondCode = code,
                AreaM2 = s.AreaM2, AverageDepthM = s.AvgDepthM, MaxDepthM = s.MaxDepthM, Purpose = PondPurpose.GrowOut, ConstructionType = s.Type,
                FarmingSystemOverride = earthen ? null : FarmingSystem.Intensive,
                InletType = earthen ? "PVC pipe with screen" : "PVC pipe with 300-micron filter bag",
                OutletType = earthen ? "Monk with gate boards" : "Central drain with standpipe",
                AerationSystem = earthen ? "Paddlewheel x2, 1 hp each" : "Paddlewheel x2 and a 1 hp air blower with diffuser lines",
                Latitude = 6.0800m + s.Number * 0.0004m, Longitude = 125.1240m + (int)s.Type * 0.0012m,
            };
            _ponds[code] = pond;
            _context.Ponds.Add(pond);
        }

        _context.SaveChanges();
        foreach (var s in PondSpecs)
        {
            var prefix = prefixes[s.Type];
            var pond = _ponds[PondNaming.FormatCode(prefix.ShortCode, s.Number)];
            History(pond, Local(D(s.CreatedOffset), 9), PondChangeType.Created,
                $"Pond {pond.PondCode} ({PondNaming.DisplayName(prefix.Name, s.Number)}) created ({s.AreaM2:0.##} m², GrowOut). Status Available.");
        }

        _context.SaveChanges();
    }

    private void History(Pond pond, DateTime at, PondChangeType type, string description, long? userId = null) =>
        _context.PondHistories.Add(new PondHistory { TenantId = _t, CreatorUserId = userId ?? _ownerId, CreationTime = at, PondId = pond.Id, ChangeDateUtc = at, ChangeType = type, Description = description });

    /// <summary>Pond changes that happen between cycles, applied in date order so later batches see the new values.</summary>
    private readonly List<(DateOnly Date, Action Apply, bool Done)> _pondEvents = new();

    private void ApplyPondEventsBefore(DateOnly date)
    {
        if (_pondEvents.Count == 0)
        {
            _pondEvents.Add((D(-205), () =>
            {
                var p = _ponds["CP-04"];
                p.ManualStatus = PondManualStatus.UnderMaintenance;
                History(p, Local(D(-205), 10), PondChangeType.StatusChange, "Status: Active → Under maintenance. Wall cracks being repaired and the pond disinfected after the white spot loss.");
            }, false));
            _pondEvents.Add((D(-200), () =>
            {
                foreach (var code in new[] { "EP-15", "EP-16" })
                {
                    var p = _ponds[code];
                    p.IsArchived = true;
                    History(p, Local(D(-200), 9), PondChangeType.Archived, "Pond archived. Low-lying pond floods in the rainy season; no longer used for culture.");
                }
            }, false));
            _pondEvents.Add((D(-150), () =>
            {
                var p = _ponds["CP-05"];
                p.ManualStatus = PondManualStatus.Inactive;
                History(p, Local(D(-150), 10), PondChangeType.StatusChange, "Status: Active → Inactive. Not used this season: no blower installed yet.");
            }, false));
            _pondEvents.Add((D(-76), () =>
            {
                var p = _ponds["EP-03"];
                History(p, Local(D(-76), 14), PondChangeType.InfrastructureModification,
                    $"Area: {p.AreaM2:0.##} → 2450 m². Note: Dike rebuilt after erosion and the pond re-surveyed. Earlier batches keep the area they were stocked with.");
                p.AreaM2 = 2450m;
            }, false));
        }

        for (var i = 0; i < _pondEvents.Count; i++)
        {
            var e = _pondEvents[i];
            if (!e.Done && e.Date < date)
            {
                e.Apply();
                _pondEvents[i] = (e.Date, e.Apply, true);
            }
        }

        _context.SaveChanges();
    }

    private void SeedResources()
    {
        var gbh = new HatcherySource
        {
            TenantId = _t, CreatorUserId = _ownerId, Name = "GenSan Bay Hatchery (test)", ShortCode = "GBH", Address = "Brgy. Labangal, General Santos City",
            ContactPerson = "H. Manager", Phone = "0917 111 2222", BfarAccreditationNo = "BFAR-HAT-TEST-001", AccreditationStatus = AccreditationStatus.Accredited,
        };
        var sah = new HatcherySource
        {
            TenantId = _t, CreatorUserId = _ownerId, Name = "Sarangani Aqua Hatchery (test)", ShortCode = "SAH", Address = "Alabel, Sarangani",
            ContactPerson = "P. Santos", Phone = "0918 222 3333", AccreditationStatus = AccreditationStatus.Pending,
        };
        var kch = new HatcherySource
        {
            TenantId = _t, CreatorUserId = _ownerId, Name = "Kiamba Coastal Hatchery (test)", ShortCode = "KCH", Address = "Kiamba, Sarangani",
            ContactPerson = "R. Lim", Phone = "0919 333 4444", AccreditationStatus = AccreditationStatus.NotAccredited,
        };
        _context.HatcherySources.AddRange(gbh, sah, kch);
        _context.SaveChanges();
        _hatcheries = new Dictionary<string, HatcherySource> { ["GBH"] = gbh, ["SAH"] = sah, ["KCH"] = kch };

        _certificates = new List<HatcheryCertificate>
        {
            new() { TenantId = _t, CreatorUserId = _ownerId, HatcheryId = gbh.Id, CertificateType = CertificateType.Health, CertificateNo = "HC-GBH-TEST-01", IssueDate = D(-560), ExpiryDate = D(-196) },
            new() { TenantId = _t, CreatorUserId = _ownerId, HatcheryId = gbh.Id, CertificateType = CertificateType.Health, CertificateNo = "HC-GBH-TEST-02", IssueDate = D(-195), ExpiryDate = D(170) },
            new() { TenantId = _t, CreatorUserId = _ownerId, HatcheryId = sah.Id, CertificateType = CertificateType.Health, CertificateNo = "HC-SAH-TEST-01", IssueDate = D(-340), ExpiryDate = D(25) },
        };
        _context.HatcheryCertificates.AddRange(_certificates);

        _buyers = new Dictionary<string, Buyer>
        {
            ["TSB"] = new() { TenantId = _t, CreatorUserId = _ownerId, BuyerType = BuyerType.Company, Name = "Tambler Seafood Buyer (test)", ContactPerson = "S. Buyer", Phone = "0918 333 4444", Address = "Fish Port Complex, General Santos City" },
            ["LFD"] = new() { TenantId = _t, CreatorUserId = _ownerId, BuyerType = BuyerType.Company, Name = "Lagao Fish Dealer (test)", ContactPerson = "M. Dealer", Phone = "0919 555 6666", Address = "Lagao Public Market, General Santos City" },
            ["MSP"] = new() { TenantId = _t, CreatorUserId = _ownerId, BuyerType = BuyerType.Company, Name = "Mindanao Shrimp Processing (test)", ContactPerson = "Q. Inspector", Phone = "0920 777 8888", Address = "Calumpang Industrial Area, General Santos City", PrivacyNoticeAcknowledgedAtUtc = Local(D(-300), 10) },
            ["RVL"] = new() { TenantId = _t, CreatorUserId = _ownerId, BuyerType = BuyerType.Individual, Name = "Rosa Villanueva (test)", Phone = "0921 999 0000", Address = "Dadiangas Market stall 14 (test)", PrivacyNoticeAcknowledgedAtUtc = Local(D(-310), 10) },
            ["PRS"] = new() { TenantId = _t, CreatorUserId = _ownerId, BuyerType = BuyerType.Company, Name = "Polomolok Restaurant Supply (test)", ContactPerson = "D. Cook", Phone = "0922 121 2121", Address = "Polomolok, South Cotabato", IsActive = false },
        };
        _context.Buyers.AddRange(_buyers.Values);
        _context.SaveChanges();
    }

    private void SeedInventoryItems()
    {
        InventoryItem Feed(string stage, string spec, string bai, decimal reorder) => new()
        {
            TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.Feed, Brand = "TestFeed", ProductName = $"Vannamei {stage} {spec}", FeedType = stage,
            BaiRegistrationNo = bai, Unit = "kg", ReorderLevel = reorder, PackSize = 25m,
        };
        _feedItems = new[]
        {
            Feed("Starter", "40-42% CP crumble", "BAI-TEST-0001", 100),
            Feed("Grower", "38-40% CP pellet", "BAI-TEST-0002", 500),
            Feed("Finisher", "36-38% CP pellet", "BAI-TEST-0003", 500),
        };
        _probiotic = new InventoryItem { TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.AdditiveSupplement, Brand = "AquaTest", ProductName = "Bacillus probiotic", ActiveIngredient = "Bacillus subtilis and B. licheniformis", Unit = "kg", ReorderLevel = 5, PackSize = 1m };
        _vitaminC = new InventoryItem { TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.AdditiveSupplement, Brand = "AquaTest", ProductName = "Vitamin C premix", ActiveIngredient = "Ascorbic acid (stabilised)", Unit = "kg", ReorderLevel = 5, PackSize = 1m };
        _lime = new InventoryItem { TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.Chemical, Brand = "Generic", ProductName = "Agricultural lime", ActiveIngredient = "Calcium carbonate", Unit = "kg", ReorderLevel = 100, PackSize = 50m };
        _zeolite = new InventoryItem { TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.Chemical, Brand = "Generic", ProductName = "Zeolite granules", ActiveIngredient = "Clinoptilolite", Unit = "kg", ReorderLevel = 50, PackSize = 25m };
        _bkc = new InventoryItem { TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.Chemical, Brand = "AquaTest", ProductName = "BKC 80% disinfectant", ActiveIngredient = "Benzalkonium chloride", Unit = "L", ReorderLevel = 2, PackSize = 1m, DefaultWithdrawalDays = 14 };
        _chlorine = new InventoryItem { TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.Chemical, Brand = "Generic", ProductName = "Calcium hypochlorite 70%", ActiveIngredient = "Calcium hypochlorite", Unit = "kg", ReorderLevel = 45, PackSize = 45m };
        _context.InventoryItems.AddRange(_feedItems);
        _context.InventoryItems.AddRange(_probiotic, _vitaminC, _lime, _zeolite, _bkc, _chlorine);
        _context.SaveChanges();

        // A small premix lot close to expiry and below the reorder level; never used.
        Receive(_vitaminC, $"VC-{D(-40):yyMMdd}", 3m, 640m, D(-40), "Agrivet (test)", D(15));

        // Chlorine was used up for pond preparation; no stock left (shows at zero, below reorder level).
        var cl = Receive(_chlorine, $"CL-{D(-95):yyMMdd}", 45m, 95m, D(-95), "Agrivet (test)", D(270));
        Movement(cl, Local(D(-86), 8), StockMovementType.Usage, -45m, 95m, "Pond disinfection before stocking (C5 ponds)");
        _context.SaveChanges();
    }

    private InventoryLot Receive(InventoryItem item, string lotNumber, decimal qty, decimal cost, DateOnly date, string supplier, DateOnly? expiry = null)
    {
        var lot = new InventoryLot { TenantId = _t, CreatorUserId = _ownerId, ItemId = item.Id, LotNumber = lotNumber, ReceivedDate = date, ExpiryDate = expiry, Supplier = supplier, UnitCost = cost };
        _context.InventoryLots.Add(lot);
        _context.SaveChanges();
        Movement(lot, Local(date, 9), StockMovementType.Receipt, qty, cost, "Stock received (seed)");
        return lot;
    }

    private StockMovement Movement(InventoryLot lot, DateTime at, StockMovementType type, decimal qty, decimal? cost, string reason, Guid? batchId = null, Guid? sessionId = null, Guid? logId = null, long? userId = null)
    {
        var m = new StockMovement
        {
            TenantId = _t, CreatorUserId = userId ?? _ownerId, CreationTime = at, LotId = lot.Id, MovementDateUtc = at, Type = type, Quantity = qty, UnitCost = cost,
            Reason = reason, BatchId = batchId, FeedingSessionId = sessionId, SourceLogId = logId,
        };
        _context.StockMovements.Add(m);
        return m;
    }

    private void SeedPermits()
    {
        var presets = _context.DocumentPresets.IgnoreQueryFilters().Where(p => p.TenantId == _t).ToList();
        var categories = _context.DocumentCategories.IgnoreQueryFilters().Where(c => c.TenantId == _t).ToDictionary(c => c.Id);

        ComplianceDocument Doc(string preset, string number, int issue, int? expiry, string notes = null, bool archived = false, Guid? renewedFrom = null)
        {
            var p = presets.First(x => x.Name == preset);
            var category = categories[p.CategoryId];
            var doc = new ComplianceDocument
            {
                Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(D(issue), 10), CategoryId = p.CategoryId, PresetId = p.Id, Title = p.Name,
                DocumentNumber = number, IssuingAgency = p.DefaultIssuingAgency, IssueDate = D(issue),
                ExpiryDate = expiry.HasValue ? D(expiry.Value) : category.RequiresExpiryDate ? D(issue + 365) : null,
                Notes = notes, IsArchived = archived, RenewedFromId = renewedFrom,
            };
            _context.ComplianceDocuments.Add(doc);
            return doc;
        }

        Doc("Mayor's / Business Permit", "BP-TEST-2026-0412", -300, 65);
        var oldClearance = Doc("Barangay Business Clearance", "BBC-TEST-0198", -680, -315, archived: true);
        Doc("Barangay Business Clearance", "BBC-TEST-0233", -315, 50, "Renewed at the barangay hall.", renewedFrom: oldClearance.Id);
        Doc("DTI Business Name Registration", "DTI-TEST-5531200", -900, 925);
        Doc("BFAR Fishpond / Aquafarm Registration", "BFAR-R12-FP-TEST-0042", -400, 330);
        Doc("BFAR Shrimp Grow-out Farm Certification (GAqP)", "BFAR-GAQP-TEST-0007", -1080, 18, "Renewal inspection to be scheduled with BFAR Region XII.");
        Doc("Environmental Compliance Certificate (ECC)", "ECC-R12-TEST-2023-0091", -1050, null);
        Doc("BIR Certificate of Registration (Form 2303)", "BIR-TEST-109-332-417", -1100, null);
        Doc("Water Permit", "NWRB-TEST-WP-2218", -1090, -12, "Expired: renewal filed, waiting for NWRB.");
        Doc("Sanitary Permit", "SP-TEST-2026-0307", -250, 115);
        _context.SaveChanges();
    }

    // ---------------------------------------------------------------- cycles

    private string NextCycleCode(DateOnly firstStocking, string hatcheryShortCode)
    {
        var scope = $"{firstStocking:yyyy-MM}-{hatcheryShortCode}";
        _cycleSequences.TryGetValue(scope, out var n);
        _cycleSequences[scope] = ++n;
        return $"{scope}-{n:00}";
    }

    private static int FeedStage(int doc) => doc <= 20 ? 0 : doc <= 70 ? 1 : 2;

    /// <summary>ABW on a day of culture, rising to the final ABW at the end of culture.</summary>
    private static decimal AbwAt(BatchPlan bp, int doc, int cultureDays) =>
        Math.Max(0.02m, Math.Round(bp.FinalAbwG * (decimal)Math.Pow((double)doc / cultureDays, 1.8), 2));

    /// <summary>Harvest weight the batch reaches (or is heading for) at the end of culture.</summary>
    private static decimal PlannedHarvestKg(long pl, BatchPlan bp) => Math.Round(pl * bp.Survival * bp.FinalAbwG / 1000m, 1);

    /// <summary>Daily feed (kg) by day of culture: the planned total (harvest x FCR) spread over the culture, rising as the shrimp grow.</summary>
    private static List<(int Doc, decimal Kg, int Stage)> FeedSchedule(long pl, BatchPlan bp, int cultureDays, int lastDoc)
    {
        var total = PlannedHarvestKg(pl, bp) * bp.Fcr;
        var weights = Enumerable.Range(1, cultureDays - 1).Select(d => Math.Pow(d, 1.4)).ToList();
        var sum = weights.Sum();
        var list = new List<(int Doc, decimal Kg, int Stage)>();
        for (var d = 1; d <= Math.Min(lastDoc, cultureDays - 1); d++)
        {
            list.Add((d, Math.Max(0.5m, Math.Round(total * (decimal)(weights[d - 1] / sum), 1)), FeedStage(d)));
        }

        return list;
    }

    /// <summary>Last day of culture with logs: the day before the total harvest or failure, else yesterday.</summary>
    private int LastDoc(BatchPlan bp, CyclePlan cp, DateOnly stocking) => bp.End switch
    {
        BatchEnd.Failed or BatchEnd.FailedClosed => bp.FailDoc.Value,
        BatchEnd.Running => Days(stocking, LastEntry),
        _ => cp.CultureDays - 1,
    };

    private void SeedCycle(CyclePlan cp, ref int lotCounter)
    {
        var stocking = D(cp.StockOffset);
        var hatchery = _hatcheries[cp.Hatchery];
        var harvestDate = stocking.AddDays(cp.CultureDays);
        var closeDate = cp.CloseAfterDays.HasValue ? harvestDate.AddDays(cp.CloseAfterDays.Value) : (DateOnly?)null;
        var running = cp.Batches.All(b => b.End == BatchEnd.Running);
        var techOffset = cp.Key[1] - '0';

        // ---- PL count per batch from the pond area at stocking ----
        var plans = cp.Batches.Select(bp =>
        {
            var pond = _ponds[bp.Pond];
            var pl = (long)(Math.Round(pond.AreaM2 * bp.Density / 1000m) * 1000m);
            return (Plan: bp, Pond: pond, Pl: pl, Schedule: FeedSchedule(pl, bp, cp.CultureDays, LastDoc(bp, cp, stocking)));
        }).ToList();

        // ---- Feed and supplement lots for the cycle, received ten days before stocking ----
        var receivedOn = stocking.AddDays(-10);
        var feedCosts = new[] { 96m, 82m, 76m };
        var feedLots = new InventoryLot[3];
        var lotPrefix = new[] { "ST", "GR", "FN" };
        for (var stage = 0; stage < 3; stage++)
        {
            var need = plans.Sum(p => p.Schedule.Where(x => x.Stage == stage).Sum(x => x.Kg));
            decimal qty;
            if (!running)
            {
                qty = need > 0 ? Math.Ceiling(need / 25m) * 25m : 0m;
            }
            else if (cp.Key == "C5" && stage == 1)
            {
                // The grower lot was short: usage was recorded past zero and the lot is flagged for reconciliation (DEC-73).
                qty = Math.Floor(need / 25m) * 25m - 25m;
            }
            else
            {
                var next = FeedStage(Days(stocking, LastEntry) + 1);
                qty = Math.Ceiling(need / 25m) * 25m + (stage == next ? 750m : stage > next ? 1000m : 0m);
            }

            if (qty > 0)
            {
                var date = stage == 0 ? receivedOn : stocking.AddDays(stage == 1 ? 15 : 62);
                if (date > LastEntry)
                {
                    date = LastEntry.AddDays(-2);
                }

                feedLots[stage] = Receive(_feedItems[stage], $"{lotPrefix[stage]}-{date:yyMMdd}-{++lotCounter:00}", qty, feedCosts[stage] + (cp.StockOffset > -150 ? 2m : 0m), date, "Feed Dealer (test)", date.AddDays(180));
                if (running && cp.Key == "C5" && stage == 1)
                {
                    feedLots[stage].NeedsReconciliation = true;
                }
            }
        }

        var probioticNeed = plans.Sum(p => Math.Ceiling(p.Pond.AreaM2 / 4000m * 2m) / 2m * (LastDoc(p.Plan, cp, stocking) / 14 + 1));
        var probioticLot = Receive(_probiotic, $"PB-{receivedOn:yyMMdd}", Math.Ceiling(probioticNeed) + (running ? 10m : 0m), 950m, receivedOn, "Agrivet (test)", receivedOn.AddDays(365));
        var limeLot = Receive(_lime, $"LM-{receivedOn:yyMMdd}", 50m * Math.Ceiling(plans.Sum(p => p.Pond.AreaM2) / 100m * 2m / 50m) + 100m, 12m, receivedOn, "Agrivet (test)");
        var zeoliteLot = cp.Key is "C5" or "C3" ? Receive(_zeolite, $"ZE-{receivedOn:yyMMdd}", 250m, 28m, receivedOn, "Agrivet (test)") : null;
        var bkcLot = cp.Key is "C5" or "C7" ? Receive(_bkc, $"BK-{receivedOn:yyMMdd}", 4m, 420m, receivedOn, "Agrivet (test)", receivedOn.AddDays(540)) : null;
        _context.SaveChanges();

        // ---- Fry delivery and the cycle ----
        var shortfalls = new List<FryDeliveryShortfall>
        {
            new() { TenantId = _t, CreatorUserId = _ownerId, Reason = ShortfallReason.DeadOnArrival, Count = 1000 + 500 * (plans.Count % 3), Note = "Dead in the bags on arrival" },
            new() { TenantId = _t, CreatorUserId = _ownerId, Reason = ShortfallReason.CountDifference, Count = 2000, Note = "Hatchery count was higher than the farm's count" },
        };
        if (cp.Key == "C6")
        {
            shortfalls.Add(new FryDeliveryShortfall { TenantId = _t, CreatorUserId = _ownerId, Reason = ShortfallReason.Discarded, Count = 3000, Note = "Weak PL discarded after the stress test" });
        }

        var stockedPl = plans.Sum(p => p.Pl);
        var receivedPl = stockedPl + shortfalls.Sum(s => s.Count);
        var delivery = new FryDelivery
        {
            TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(stocking.AddDays(-12), 10), HatcheryId = hatchery.Id, HatcheryBatchNumber = cp.HatcheryBatchNo, DeliveryDate = stocking,
            PlAgeDays = cp.Hatchery == "KCH" ? 10 : 12, PlReceived = receivedPl, CostPhp = Math.Round(receivedPl * (cp.Hatchery == "KCH" ? 0.24m : 0.30m), 0),
            PlHealthCertificateNo = cp.Hatchery == "KCH" ? null : $"PLHC-{stocking:yyyyMMdd}", TransportPermitNo = $"DTP-{stocking:yyyyMMdd}-{cp.Hatchery}",
            SfscNo = cp.Hatchery == "KCH" ? null : $"SFSC-{stocking:yyyy}-{cp.Hatchery}-{stocking:MMdd}",
            Notes = cp.Hatchery == "KCH" ? "Hatchery not accredited; no PL health certificate or SFSC came with this delivery." : null,
            StockingFinishedAtUtc = Local(stocking, 11), StockingFinishedByUserId = _ownerId,
        };
        _context.FryDeliveries.Add(delivery);
        _context.SaveChanges();
        foreach (var s in shortfalls)
        {
            s.DeliveryId = delivery.Id;
            _context.FryDeliveryShortfalls.Add(s);
        }

        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Ordered, ChangedAtUtc = Local(stocking.AddDays(-12), 10), Note = "Ordered by phone" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.InTransit, ChangedAtUtc = Local(stocking.AddDays(-1), 22), Note = "Left the hatchery by truck" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = Tech(techOffset), DeliveryId = delivery.Id, Status = FryDeliveryStatus.Received, ChangedAtUtc = Local(stocking, 5) });

        var cycle = new ProductionCycle
        {
            TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(stocking, 8), CycleCode = NextCycleCode(stocking, hatchery.ShortCode), Status = CycleStatus.Active, FryDeliveryId = delivery.Id,
        };
        _context.ProductionCycles.Add(cycle);
        _context.SaveChanges();

        var letters = "ABCDEFGHIJKLMNOP";
        var rows = new List<(BatchPlan Plan, Pond Pond, long Pl, PondBatch Batch, BatchLogSummary Summary, long Tech)>();
        for (var i = 0; i < plans.Count; i++)
        {
            var (bp, pond, pl, schedule) = plans[i];
            var tech = cp.Key == "C1" && i % 4 == 3 ? _formerTechId : Tech(i + techOffset);

            var round = PreparationRound(pond, tech, stocking.AddDays(-9), stocking.AddDays(-2), Local(stocking, 8));
            var density = pl / pond.AreaM2;
            var system = pond.EffectiveFarmingSystem(FarmingSystem.SemiIntensive);
            var band = _context.DensityBands.AsNoTracking().FirstOrDefault(b => b.FarmingSystem == system && b.ConstructionType == pond.ConstructionType);
            var batch = new PondBatch
            {
                TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(stocking, 8), CycleId = cycle.Id, PondId = pond.Id, PreparationRoundId = round.Id,
                Letter = letters[i].ToString(), BatchCode = $"{cycle.CycleCode}-{letters[i]}", Status = BatchStatus.Stocked,
                StockedAtUtc = Local(stocking, 7, 30 + i % 3 * 10), StockingDate = stocking, PondAreaM2AtStocking = pond.AreaM2, TransportMode = TransportMode.Truck,
                TimeProcessedUtc = Local(stocking, 6, 30), PlCountStocked = pl, DeadAtStocking = 80 + 20 * (i % 4), AcclimationMinutes = 45 + 15 * (i % 4), InitialSurvivalEstimatePct = 95,
                FarmingSystemAtStocking = system, ConstructionTypeAtStocking = pond.ConstructionType, DensityFlag = band?.Judge(density),
                HatcheryCertificationStatusAtStocking = hatchery.DescribeCertification(HatcheryCertificate.CurrentHealthCertificate(_certificates.Where(c => c.HatcheryId == hatchery.Id), stocking), stocking),
            };
            _context.PondBatches.Add(batch);
            _context.SaveChanges();

            var summary = BatchLogs(cp, bp, batch, pond, pl, tech, stocking, schedule, feedLots, feedCosts, probioticLot, limeLot, zeoliteLot, bkcLot);
            rows.Add((bp, pond, pl, batch, summary, tech));
        }

        // ---- Harvests, failures, closing ----
        var buyerTurn = 0;
        foreach (var (bp, pond, pl, batch, summary, tech) in rows)
        {
            buyerTurn++;
            if (bp.PartialDoc.HasValue && stocking.AddDays(bp.PartialDoc.Value) <= LastEntry)
            {
                var date = stocking.AddDays(bp.PartialDoc.Value);
                var kg = Math.Round(PlannedHarvestKg(pl, bp) * bp.PartialShare, 1);
                var partial = AddHarvest(batch, tech, date, HarvestType.Partial, kg, AbwAt(bp, bp.PartialDoc.Value, cp.CultureDays), summary);
                var pay = running ? Pay.UnpaidNotDue : Pay.Paid;
                PlanSale(date, running ? _buyers["TSB"] : _buyers["RVL"], partial, pay, transport: running);
            }

            switch (bp.End)
            {
                case BatchEnd.Closed:
                {
                    var kg = PlannedHarvestKg(pl, bp) - summary.Harvests.Sum(h => h.TotalKg);
                    var total = AddHarvest(batch, tech, harvestDate, HarvestType.Total, Math.Round(kg, 1), bp.FinalAbwG, summary);
                    TotalHarvestSales(cp, bp, total, harvestDate, buyerTurn);
                    batch.Status = BatchStatus.Harvested;
                    break;
                }

                case BatchEnd.Harvested:
                {
                    // EP-11: harvested six days ago; part given to staff, part spoiled, a little not accounted for.
                    var total = AddHarvest(batch, tech, harvestDate, HarvestType.Total, PlannedHarvestKg(pl, bp), bp.FinalAbwG, summary);
                    total.Disposals.Add(new HarvestDisposal { TenantId = _t, Kg = 15m, Reason = DisposalReason.StaffOrHomeUse, Note = "Shared with the harvest crew" });
                    total.Disposals.Add(new HarvestDisposal { TenantId = _t, Kg = 8m, Reason = DisposalReason.SpoiledOrLost, Note = "Crushed in the bottom boxes" });
                    var main = total.GradeLines.OrderByDescending(g => g.Kg).First();
                    var other = total.GradeLines.Where(g => g != main).ToList();
                    _salePlans.Add(new SalePlan(harvestDate, _buyers["MSP"], new List<SaleLinePlan> { new(main, main.Kg, Math.Round(main.Kg * 0.985m, 1), Price(main)) }, Pay.PartialNotDue, true));
                    if (other.Count > 0)
                    {
                        _salePlans.Add(new SalePlan(harvestDate, _buyers["RVL"], other.Select(g => new SaleLinePlan(g, Math.Max(0m, g.Kg - 50m), null, Price(g))).ToList(), Pay.Paid, false));
                    }
                    batch.Status = BatchStatus.Harvested;
                    PostProduction(batch, tech, Local(harvestDate.AddDays(3), 8), PostProductionActivity.SludgeRemoval, "Sludge pushed out of the pond bottom; drying started.");
                    break;
                }

                case BatchEnd.Failed:
                case BatchEnd.FailedClosed:
                {
                    var failedOn = stocking.AddDays(bp.FailDoc.Value);
                    var kg = Math.Round(pl * bp.Survival * AbwAt(bp, bp.FailDoc.Value, cp.CultureDays) / 1000m, 1);
                    var harvest = AddHarvest(batch, tech, failedOn.AddDays(1), HarvestType.Total, kg, AbwAt(bp, bp.FailDoc.Value, cp.CultureDays), summary, failed: true);
                    PlanSale(failedOn.AddDays(1), _buyers["LFD"], harvest, bp.End == BatchEnd.Failed ? Pay.UnpaidOverdue : Pay.Paid, transport: false);
                    _context.BatchFailures.Add(new BatchFailure
                    {
                        TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(failedOn, 15), BatchId = batch.Id, FailedOn = failedOn, Reason = bp.FailReason,
                        EstimatedLossPhp = Math.Round((PlannedHarvestKg(pl, bp with { Survival = 0.75m }) * 380m - kg * 150m) / 1000m) * 1000m,
                    });
                    batch.Status = BatchStatus.Failed;
                    break;
                }
            }

            _context.SaveChanges();

            if (closeDate.HasValue)
            {
                var closedOn = closeDate.Value;
                if (cp.Key == "C3" && bp.Pond == "EP-09")
                {
                    // Reopened the day after closing to correct a harvest entry, then closed again.
                    _context.ReopenEvents.Add(new ReopenEvent
                    {
                        TenantId = _t, CreatorUserId = _ownerId, EntityType = ReopenedEntityType.Batch, EntityId = batch.Id, ReopenedAtUtc = Local(closedOn.AddDays(1), 8),
                        ReopenedByUserId = _ownerId, Reason = "Harvest weight corrected after the buyer's re-weigh.",
                    });
                    closedOn = closedOn.AddDays(1);
                }

                CloseBatch(batch, pond, pl, stocking, summary, closedOn);
            }
        }

        if (closeDate.HasValue)
        {
            cycle.Status = CycleStatus.Closed;
            cycle.Outcome = CycleOutcome.Completed;
            cycle.ClosedAtUtc = Local(closeDate.Value.AddDays(cp.Key == "C3" ? 1 : 0), 11);
            cycle.ClosedByUserId = _ownerId;

            // Leftover feed and supplements at cycle close are written off, so closed cycles leave no expired stock behind.
            foreach (var lot in feedLots.Where(l => l != null).Append(probioticLot).Append(limeLot).Concat(new[] { zeoliteLot, bkcLot }.Where(l => l != null)))
            {
                var balance = _context.StockMovements.Local.Where(m => m.LotId == lot.Id).Sum(m => m.Quantity);
                if (balance > 0)
                {
                    Movement(lot, Local(closeDate.Value, 15), StockMovementType.Adjustment, -balance, lot.UnitCost, "Stock count at cycle close: remainder damaged, written off");
                }
            }
        }

        _context.SaveChanges();
    }

    private void CloseBatch(PondBatch batch, Pond pond, long pl, DateOnly stocking, BatchLogSummary summary, DateOnly closedOn)
    {
        var facts = new BatchFacts
        {
            PlCountStocked = pl, PondAreaM2 = batch.PondAreaM2AtStocking, StockingDate = stocking, CumulativeFeedKg = summary.FeedKg,
            CumulativeMortality = summary.Mortalities.Sum(m => m.Count), Mortalities = summary.Mortalities, GrowthSamples = summary.Growth, Harvests = summary.Harvests,
        };
        var ind = IndicatorCalculator.Compute(facts, closedOn);
        batch.FinalAbwG = ind.FinalAbwG;
        batch.FinalFcr = ind.FinalFcr;
        batch.SurvivalRatePct = ind.SurvivalRatePct ?? 0m;
        batch.TotalHarvestKg = ind.TotalHarvestKg;
        batch.TotalFeedKg = ind.CumulativeFeedKg;
        batch.CultureDays = ind.CultureDays;
        batch.Status = BatchStatus.Closed;
        batch.ClosedAtUtc = Local(closedOn, 10);
        batch.ClosedByUserId = _ownerId;
    }

    private PondPreparationRound PreparationRound(Pond pond, long tech, DateOnly start, DateOnly? prepared, DateTime? usedAt, params (int DayOffset, string Text)[] entries)
    {
        var round = new PondPreparationRound
        {
            TenantId = _t, CreatorUserId = tech, CreationTime = Local(start, 8), PondId = pond.Id, StartedAtUtc = Local(start, 8),
            PreparedAtUtc = prepared.HasValue ? Local(prepared.Value, 15) : null, PreparedByUserId = prepared.HasValue ? tech : null, UsedAtUtc = usedAt,
        };
        _context.PondPreparationRounds.Add(round);
        _context.SaveChanges();

        if (entries.Length == 0)
        {
            var earthen = pond.ConstructionType == PondConstructionType.Earthen;
            entries = new[]
            {
                (0, earthen ? "Drained the pond; drying started." : "Drained the pond and scrubbed the walls."),
                (3, earthen ? "Applied agricultural lime and tilled the pond bottom." : "Disinfected with calcium hypochlorite; rinsed after two days."),
                (prepared.HasValue ? Days(start, prepared.Value) : 5, "Filled to 1.2 m with screened seawater; probiotic applied."),
            };
        }

        foreach (var (offset, text) in entries)
        {
            _context.PondPreparationEntries.Add(new PondPreparationEntry
            {
                TenantId = _t, CreatorUserId = tech, CreationTime = Local(start.AddDays(offset), 9), RoundId = round.Id, ObservedAtUtc = Local(start.AddDays(offset), 9), Description = text,
            });
        }

        return round;
    }

    // ---------------------------------------------------------------- logs

    private ProductionLog NewLog(PondBatch batch, long userId, DateTime at, LogType type, string notes = null)
    {
        var log = new ProductionLog
        {
            Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = userId, CreationTime = at.AddMinutes(20), BatchId = batch.Id, PondId = batch.PondId, LogType = type,
            ObservedAtUtc = at, Notes = notes, ClientRequestId = Guid.NewGuid(),
        };
        _context.ProductionLogs.Add(log);
        return log;
    }

    private BatchLogSummary BatchLogs(CyclePlan cp, BatchPlan bp, PondBatch batch, Pond pond, long pl, long tech, DateOnly stocking, List<(int Doc, decimal Kg, int Stage)> schedule,
        InventoryLot[] feedLots, decimal[] feedCosts, InventoryLot probioticLot, InventoryLot limeLot, InventoryLot zeoliteLot, InventoryLot bkcLot)
    {
        var summary = new BatchLogSummary();
        var running = bp.End == BatchEnd.Running;
        var lastDoc = LastDoc(bp, cp, stocking);
        var rainDay = Days(stocking, D(-20));
        var blankDoc = cp.Key == "C5" && bp.Pond == "EP-05" ? Days(stocking, D(-12)) : -1;
        var noPmDoc = cp.Key == "C6" && bp.Pond == "HP-02" ? Days(stocking, D(-3)) : -1;

        WaterQuality(batch, tech, Local(stocking.AddDays(-1), 16), LogType.PreStockingWaterQuality,
            (ParameterCodes.Temperature, 29.5m), (ParameterCodes.Salinity, 22m), (ParameterCodes.PH, 7.9m), (ParameterCodes.DO, 6.1m));

        // ---- Feeding: an AM (07:00) and a PM (17:00) session a day ----
        foreach (var (doc, dailyKg, stage) in schedule)
        {
            if (doc == blankDoc)
            {
                continue; // nothing logged that day: an amber square on the log calendar
            }

            var day = stocking.AddDays(doc);
            var lot = feedLots[stage] ?? feedLots.First(l => l != null);
            var amKg = Math.Round(dailyKg * (doc <= 60 ? 0.40m : 0.50m), 1);
            var pmKg = Math.Round(dailyKg - amKg, 1);
            var method = doc <= 30 ? "Blind feeding (broadcast)" : "Scheduled feeding; ration adjusted to check-tray consumption";
            var recent = running && day >= D(-14);
            summary.FeedKg += Feeding(batch, tech, day, 7, lot, amKg, feedCosts[stage], method, recent ? $"07:{doc % 5 * 3:00}" : null);

            if (doc == noPmDoc)
            {
                continue; // PM session not logged
            }

            if (running && doc == rainDay && cp.Key == "C5")
            {
                _context.FeedingSessions.Add(new FeedingSession
                {
                    Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = tech, CreationTime = Local(day, 18), BatchId = batch.Id, FeedDate = day, Session = FeedingSessionTime.PM,
                    Status = FeedingStatus.NotFed, Notes = "Heavy rain and strong wind; feeding skipped", ClientRequestId = Guid.NewGuid(),
                });
                continue;
            }

            summary.FeedKg += Feeding(batch, tech, day, 17, lot, pmKg, feedCosts[stage], method, recent ? $"16:{40 + doc % 4 * 5:00}" : null);
        }

        // ---- Water quality ----
        var step = running ? 2 : 7;
        var visit = 0;
        for (var d = step; d <= lastDoc; d += step)
        {
            if (d == blankDoc)
            {
                continue;
            }

            visit++;
            var at = Local(stocking.AddDays(d), 5, 30);
            var readings = new List<(string, decimal)>
            {
                (ParameterCodes.Temperature, 28.6m + (visit * 7 + d) % 15 / 10m),
                (ParameterCodes.Salinity, 19m + (visit * 3) % 6),
                (ParameterCodes.PH, 7.8m + (visit * 5) % 6 / 10m),
                (ParameterCodes.DO, 5.2m + (visit * 3) % 9 / 10m),
            };
            if (visit % 4 == 0)
            {
                readings.Add((ParameterCodes.Tan, 0.2m + visit % 5 / 10m));
                readings.Add((ParameterCodes.Nitrite, 0.05m + visit % 4 / 20m));
                readings.Add((ParameterCodes.Alkalinity, 110m + visit * 7 % 60));
            }

            // A few readings out of the optimal range for the Water Quality Exceptions report.
            if (cp.Key == "C1" && bp.Pond == "EP-16" && d == 63)
            {
                readings[1] = (ParameterCodes.Salinity, 28m);
            }

            if (cp.Key == "C3" && bp.Pond == "HP-02" && d == 56)
            {
                readings[2] = (ParameterCodes.PH, 9.2m);
            }

            if (cp.Key == "C4" && d == 70)
            {
                readings[3] = (ParameterCodes.DO, 3.6m);
            }

            WaterQuality(batch, tech, at, LogType.WaterQuality, readings.ToArray());
        }

        if (running && bp.Pond == "EP-02")
        {
            WaterQuality(batch, tech, Local(LastEntry, 5, 40), LogType.WaterQuality, "Low DO at dawn; ran the second paddlewheel.",
                (ParameterCodes.DO, 3.6m), (ParameterCodes.Temperature, 30.8m), (ParameterCodes.PH, 8.3m));
        }

        if (running && bp.Pond == "HP-01")
        {
            WaterQuality(batch, tech, Local(LastEntry, 14, 0), LogType.WaterQuality, "Afternoon pH high after an algal bloom.",
                (ParameterCodes.PH, 9.1m), (ParameterCodes.Temperature, 31.2m), (ParameterCodes.DO, 7.9m));
        }

        // ---- Growth samples: every 14 days (running batches every 7 from day 14) ----
        var sampleEvery = running ? 7 : 14;
        for (var d = 14; d <= lastDoc; d += sampleEvery)
        {
            var isLast = d + sampleEvery > lastDoc;
            var survivalEstimate = isLast && running ? Math.Round(100m - (100m - bp.Survival * 100m) * d / cp.CultureDays, 0) : (decimal?)null;
            Growth(summary, batch, tech, Local(stocking.AddDays(d), 9), AbwAt(bp, d, cp.CultureDays), survivalEstimate);
        }

        // ---- Mortality ----
        Mortality(summary, batch, tech, Local(stocking.AddDays(Math.Min(4, lastDoc)), 8, 30), (int)Math.Round(pl * 0.008m), MortalityCause.Others, null, "Stress after PL stocking");
        if (lastDoc > 30)
        {
            Mortality(summary, batch, tech, Local(stocking.AddDays(30), 8, 30), (int)Math.Round(pl * 0.010m), MortalityCause.Others, null, "Molting-related losses");
        }

        if (lastDoc > 70)
        {
            Mortality(summary, batch, tech, Local(stocking.AddDays(70), 8, 30), (int)Math.Round(pl * 0.006m), MortalityCause.WaterQuality, null, "Low dissolved oxygen at dawn");
        }

        if (bp.FailDoc.HasValue)
        {
            var disease = bp.Pond == "CP-04" ? "White spot syndrome (WSSV), suspected" : "AHPND, suspected";
            for (var k = 3; k >= 1; k--)
            {
                Mortality(summary, batch, tech, Local(stocking.AddDays(bp.FailDoc.Value - k + 1), 7), (int)Math.Round(pl * 0.12m * (4 - k)), MortalityCause.Disease, disease,
                    "Shrimp off feed, swimming at the surface; red discoloration", "Stopped feeding; samples sent to the BFAR fish health laboratory", high: true);
            }
        }

        // One mortality entry entered twice by mistake and voided.
        if (cp.Key == "C5" && bp.Pond == "EP-04")
        {
            var dup = NewLog(batch, tech, Local(stocking.AddDays(30), 8, 35), LogType.Mortality);
            _context.MortalityDetails.Add(new MortalityDetail { Id = dup.Id, TenantId = _t, Count = (int)Math.Round(pl * 0.010m), Cause = MortalityCause.Others, OtherCause = "Molting-related losses" });
            dup.VoidReason = "Entered twice";
            dup.IsDeleted = true;
            dup.DeletionTime = Local(stocking.AddDays(30), 11);
            dup.DeleterUserId = _ownerId;
        }

        // ---- Supplements and chemicals ----
        var probioticKg = Math.Ceiling(pond.AreaM2 / 4000m * 2m) / 2m;
        for (var d = 7; d <= lastDoc; d += 14)
        {
            Chemical(batch, tech, Local(stocking.AddDays(d), 10), probioticLot, probioticKg, "Water and gut probiotic", probioticKg * 10000m / pond.AreaM2, "kg/ha", "Activated in pond water, broadcast", null, null);
        }

        foreach (var d in new[] { 35, 70 })
        {
            if (d <= lastDoc)
            {
                var kg = Math.Round(pond.AreaM2 / 100m, 0);
                Chemical(batch, tech, Local(stocking.AddDays(d), 15), limeLot, kg, "Raise alkalinity and buffer pH", 100m, "kg/ha", "Broadcast along the dikes", null, null);
            }
        }

        if (zeoliteLot != null && lastDoc > 50 && bp.Pond.StartsWith("EP"))
        {
            Chemical(batch, tech, Local(stocking.AddDays(50), 15), zeoliteLot, 25m, "Lower ammonia after a feed spike", 25m * 10000m / pond.AreaM2, "kg/ha", "Broadcast", null, null);
        }

        if (bkcLot != null && cp.Key == "C5" && bp.Pond == "CP-02")
        {
            var day = D(-9);
            Chemical(batch, tech, Local(day, 16), bkcLot, 1m, "Disinfect after a vibrio count rise", 0.5m, "ppm", "Diluted and sprayed over the pond", 14, day, "Rx-TEST-2026-031 (Dr. A. Vet, test)");
        }

        if (bkcLot != null && cp.Key == "C7" && bp.Pond == "EP-11")
        {
            // Applied 12 days before the harvest with a 14-day withdrawal: the harvest shows the withdrawal warning (DEC-57).
            var day = stocking.AddDays(cp.CultureDays - 12);
            Chemical(batch, tech, Local(day, 16), bkcLot, 2m, "Disinfect after a vibrio count rise", 0.5m, "ppm", "Diluted and sprayed over the pond", 14, day, null);
        }

        if (!running && bp.End != BatchEnd.Failed)
        {
            // Every finished batch also gets a dated note.
            NewLog(batch, tech, Local(stocking.AddDays(Math.Min(lastDoc, 45)), 11), LogType.GeneralNote, "Check trays show good consumption; shell colour normal.");
        }

        _context.SaveChanges();
        return summary;
    }

    private decimal Feeding(PondBatch batch, long userId, DateOnly day, int hour, InventoryLot lot, decimal kg, decimal unitCost, string notes, string fedAt)
    {
        var at = Local(day, hour);
        var session = new FeedingSession
        {
            Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = userId, CreationTime = at.AddMinutes(25), BatchId = batch.Id, FeedDate = day,
            Session = hour < 12 ? FeedingSessionTime.AM : FeedingSessionTime.PM, Status = FeedingStatus.Fed, Notes = notes, FedAtTime = fedAt, ClientRequestId = Guid.NewGuid(),
        };
        _context.FeedingSessions.Add(session);
        Movement(lot, at, StockMovementType.Usage, -kg, unitCost, null, batch.Id, session.Id, userId: userId);
        return kg;
    }

    private void Mortality(BatchLogSummary summary, PondBatch batch, long userId, DateTime at, int count, MortalityCause cause, string disease, string otherOrSymptoms, string response = null, bool high = false)
    {
        var log = NewLog(batch, userId, at, LogType.Mortality);
        _context.MortalityDetails.Add(new MortalityDetail
        {
            Id = log.Id, TenantId = _t, Count = count, Cause = cause, DiseaseName = disease, OtherCause = cause == MortalityCause.Others ? otherOrSymptoms : null,
            Symptoms = cause == MortalityCause.Others ? "Weak swimming near the dike" : otherOrSymptoms, ResponseAction = response, IsHighMortality = high,
        });
        summary.Mortalities.Add(new MortalityFact { ObservedAtUtc = at, Count = count });
    }

    private void Growth(BatchLogSummary summary, PondBatch batch, long userId, DateTime at, decimal abw, decimal? estimatedSurvivalPct)
    {
        var log = NewLog(batch, userId, at, LogType.GrowthSampling);
        var weight = Math.Round(abw * 100m, 1);
        var abwG = IndicatorCalculator.Abw(weight, 100);
        _context.GrowthSamplingDetails.Add(new GrowthSamplingDetail { Id = log.Id, TenantId = _t, SampleCount = 100, TotalSampleWeightG = weight, AbwG = abwG, EstimatedSurvivalPct = estimatedSurvivalPct });
        summary.Growth.Add(new GrowthSampleFact { Date = DateOnly.FromDateTime(at.AddHours(8)), ObservedAtUtc = at, AbwG = abwG, EstimatedSurvivalPct = estimatedSurvivalPct });
    }

    private void WaterQuality(PondBatch batch, long userId, DateTime at, LogType type, params (string Code, decimal Value)[] readings) =>
        WaterQuality(batch, userId, at, type, null, readings);

    private void WaterQuality(PondBatch batch, long userId, DateTime at, LogType type, string notes, params (string Code, decimal Value)[] readings)
    {
        var log = NewLog(batch, userId, at, type, notes);
        foreach (var (code, value) in readings)
        {
            var p = _parameters[code];
            _context.WaterQualityMeasurements.Add(new WaterQualityMeasurement
            {
                Id = Guid.NewGuid(), TenantId = _t, LogId = log.Id, ParameterCode = code, Value = value, UnitCode = p.UnitCode, IsOutOfRange = p.IsOutOfOptimalRange(value), Side = p.SideOf(value),
            });
        }
    }

    private void Chemical(PondBatch batch, long userId, DateTime at, InventoryLot lot, decimal qty, string reason, decimal? dosage, string unit, string method, int? withdrawalDays, DateOnly? endDate, string prescription = null)
    {
        var log = NewLog(batch, userId, at, LogType.ChemicalApplication);
        _context.ChemicalApplicationDetails.Add(new ChemicalApplicationDetail
        {
            Id = log.Id, TenantId = _t, Reason = reason, Dosage = dosage.HasValue ? Math.Round(dosage.Value, 2) : null, DosageUnit = unit, Method = method,
            EndDate = endDate, WithdrawalDays = withdrawalDays, PrescriptionRef = prescription,
        });
        Movement(lot, at, StockMovementType.Usage, -qty, lot.UnitCost, null, batch.Id, logId: log.Id, userId: userId);
    }

    private void PostProduction(PondBatch batch, long userId, DateTime at, PostProductionActivity activity, string notes)
    {
        var log = NewLog(batch, userId, at, LogType.PostProduction, notes);
        _context.PostProductionDetails.Add(new PostProductionDetail { Id = log.Id, TenantId = _t, ActivityType = activity });
    }

    // ---------------------------------------------------------------- harvests and sales

    /// <summary>The grade a harvest's ABW falls in, with the next larger grade for the bigger shrimp.</summary>
    private (SizeGrade Main, SizeGrade Bigger) GradesFor(decimal abwG)
    {
        var count = 1000m / abwG;
        var graded = _grades.Where(g => g.MinCountPerKg.HasValue).OrderBy(g => g.MinCountPerKg).ToList();
        var index = graded.FindIndex(g => count >= g.MinCountPerKg && count < g.MaxCountPerKg);
        if (index < 0)
        {
            index = count < graded[0].MinCountPerKg ? 0 : graded.Count - 1;
        }

        return (graded[index], index > 0 ? graded[index - 1] : null);
    }

    private Harvest AddHarvest(PondBatch batch, long userId, DateOnly date, HarvestType type, decimal kg, decimal abw, BatchLogSummary summary, bool failed = false)
    {
        var lines = new List<HarvestGradeLine>();
        if (failed)
        {
            lines.Add(new HarvestGradeLine { TenantId = _t, SizeGradeId = _grades.First(g => g.Label == SizeGrade.UngradedLabel).Id, Kg = kg });
        }
        else
        {
            var (main, bigger) = GradesFor(abw);
            var biggerKg = bigger == null ? 0m : Math.Round(kg * 0.35m, 1);
            lines.Add(new HarvestGradeLine { TenantId = _t, SizeGradeId = main.Id, SizeGrade = main, Kg = kg - biggerKg });
            if (biggerKg > 0)
            {
                lines.Add(new HarvestGradeLine { TenantId = _t, SizeGradeId = bigger.Id, SizeGrade = bigger, Kg = biggerKg });
            }
        }

        var harvest = new Harvest
        {
            TenantId = _t, CreatorUserId = userId, CreationTime = Local(date, 9), BatchId = batch.Id, HarvestedAtUtc = Local(date, 3), HarvestType = type, TotalKg = kg,
            Boxes = (int)Math.Ceiling(kg / 20m), AbwG = Math.Round(abw, 1), DeadAtHarvest = type == HarvestType.Total ? (failed ? 900 : 40) : 0,
            SmoothShell = !failed, IntactAppendages = true, NoNecrosis = !failed, QualityNotes = failed ? "Soft shells and reddish discoloration; sold ungraded at a low price." : null,
            GradeLines = lines,
        };
        _context.Harvests.Add(harvest);
        _context.SaveChanges();

        summary.Harvests.Add(new HarvestFact
        {
            Date = date, HarvestedAtUtc = harvest.HarvestedAtUtc, IsFinal = type == HarvestType.Total, TotalKg = kg, AbwG = harvest.AbwG,
            GradeLines = lines.Select(l => (l.Kg, _grades.First(g => g.Id == l.SizeGradeId).MidCountPerKg)).ToList(),
        });
        return harvest;
    }

    private decimal Price(HarvestGradeLine line)
    {
        var label = _grades.First(g => g.Id == line.SizeGradeId).Label;
        return GradePrices.TryGetValue(label, out var p) ? p : 300m;
    }

    private void PlanSale(DateOnly date, Buyer buyer, Harvest harvest, Pay pay, bool transport) =>
        _salePlans.Add(new SalePlan(date, buyer, harvest.GradeLines.Select(g => new SaleLinePlan(g, g.Kg, null, Price(g))).ToList(), pay, transport));

    /// <summary>Total harvests of finished cycles: the processing plant takes the main grade, the bigger grade goes to a dealer or the market.</summary>
    private void TotalHarvestSales(CyclePlan cp, BatchPlan bp, Harvest harvest, DateOnly date, int turn)
    {
        var main = harvest.GradeLines.OrderByDescending(g => g.Kg).First();
        var others = harvest.GradeLines.Where(g => g != main).ToList();
        var mainBuyer = turn % 3 == 0 ? _buyers["TSB"] : _buyers["MSP"];
        var otherBuyer = cp.Key == "C1" && turn == 2 ? _buyers["PRS"] : turn % 2 == 0 ? _buyers["LFD"] : _buyers["RVL"];
        var pay = mainBuyer == _buyers["MSP"] ? Pay.PaidNet7 : Pay.Paid;
        if (cp.Key == "C3" && turn == 4)
        {
            pay = Pay.PartialOverdue;
        }

        if (cp.Key == "C3" && turn == 2)
        {
            // Entered for the wrong buyer, voided, then entered again.
            _salePlans.Add(new SalePlan(date, _buyers["LFD"], new List<SaleLinePlan> { new(main, main.Kg, null, Price(main)) }, Pay.UnpaidNotDue, false, "Wrong buyer selected; entered again for the processing plant."));
        }

        var accepted = mainBuyer == _buyers["MSP"] ? Math.Round(main.Kg * 0.985m, 1) : (decimal?)null;
        _salePlans.Add(new SalePlan(date, mainBuyer, new List<SaleLinePlan> { new(main, main.Kg, accepted, Price(main)) }, pay, mainBuyer == _buyers["MSP"]));
        if (others.Count > 0)
        {
            _salePlans.Add(new SalePlan(date, otherBuyer, others.Select(g => new SaleLinePlan(g, g.Kg, null, Price(g))).ToList(), Pay.Paid, false));
        }
    }

    /// <summary>Writes the planned sales in date order so dispatch receipt numbers run in sequence per year, as the app issues them.</summary>
    private void SeedSales()
    {
        var counters = new Dictionary<int, int>();
        foreach (var sp in _salePlans.OrderBy(s => s.Date))
        {
            counters.TryGetValue(sp.Date.Year, out var n);
            counters[sp.Date.Year] = ++n;

            var lines = sp.Lines.Select(l => new SaleLine { TenantId = _t, HarvestGradeLineId = l.Line.Id, Kg = l.Kg, BuyerAcceptedKg = l.AcceptedKg, PricePerKg = l.Price }).ToList();
            var total = lines.Sum(l => l.Amount);
            var (terms, due) = sp.Pay switch
            {
                Pay.Paid => ("Cash on delivery", (DateOnly?)null),
                Pay.PaidNet7 => ("Net 7 days", sp.Date.AddDays(7)),
                Pay.PartialOverdue or Pay.PartialNotDue => ("50% on delivery, balance in 15 days", sp.Date.AddDays(15)),
                _ => ("Net 15 days", sp.Date.AddDays(15)),
            };

            var payments = new List<SalePayment>();
            void AddPayment(DateOnly on, decimal amount, string method) =>
                payments.Add(new SalePayment { TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(on, 16), PaidOn = on, Amount = amount, Method = method });
            switch (sp.Pay)
            {
                case Pay.Paid:
                    AddPayment(sp.Date, total, sp.Buyer.BuyerType == BuyerType.Individual ? "Cash" : "GCash");
                    break;
                case Pay.PaidNet7:
                    AddPayment(sp.Date.AddDays(6), total, "Bank transfer");
                    break;
                case Pay.PartialOverdue:
                case Pay.PartialNotDue:
                    AddPayment(sp.Date, Math.Round(total * 0.5m, 0), "Bank transfer");
                    break;
            }

            var sale = new Sale
            {
                TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(sp.Date, 10), BuyerId = sp.Buyer.Id, SaleDate = sp.Date,
                DispatchReceiptNo = $"DR-{sp.Date:yyyy}-{n:0000}", PaymentTerms = terms, DueDate = due, Destination = sp.Buyer.Address, Lines = lines, Payments = payments,
            };
            if (sp.Transport)
            {
                sale.Transporter = "Farm truck";
                sale.DriverName = "R. Santos (test)";
                sale.PlateNo = "TST 1234";
                sale.LoadedAtUtc = Local(sp.Date, 5);
                sale.LocalTransportPermitNo = $"LTP-R12-{sp.Date:yyMMdd}-{n:000}";
                sale.TemperatureNote = "Ice slurry, 0–2 °C in insulated boxes";
            }

            if (sp.VoidReason != null)
            {
                sale.VoidReason = sp.VoidReason;
                sale.IsDeleted = true;
                sale.DeletionTime = Local(sp.Date, 11);
                sale.DeleterUserId = _ownerId;
            }

            _context.Sales.Add(sale);
        }

        _context.SaveChanges();
        foreach (var (year, last) in counters)
        {
            _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.DispatchReceipt, Scope = year.ToString(), NextValue = last + 1 });
        }

        _context.SaveChanges();
    }

    private void SeedSequences()
    {
        foreach (var (scope, last) in _cycleSequences)
        {
            _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.CycleCode, Scope = scope, NextValue = last + 1 });
        }

        _context.SaveChanges();
    }

    // ---------------------------------------------------------------- ponds between cycles

    /// <summary>Preparation states of the ponds that are not in production now (pond statuses Under preparation, Prepared and Available).</summary>
    private void SeedIdlePondPreparation()
    {
        // EP-13: under preparation; one entry corrected and one removed (DEC-77 preparation actions).
        var ep13 = _ponds["EP-13"];
        var round13 = PreparationRound(ep13, Tech(0), D(-5), null, null,
            (0, "Drained the pond after the harvest; sludge pushed to the dike."),
            (2, "Applied agricultural lime, 250 kg, and tilled the bottom."));
        var wrong = new PondPreparationEntry
        {
            TenantId = _t, CreatorUserId = Tech(1), CreationTime = Local(D(-3), 10), RoundId = round13.Id, ObservedAtUtc = Local(D(-3), 10), Description = "Filled to 1.0 m with screened seawater.",
            IsDeleted = true, DeletionTime = Local(D(-2), 8), DeleterUserId = _ownerId,
        };
        _context.PondPreparationEntries.Add(wrong);
        History(ep13, Local(D(-3), 16), PondChangeType.PreparationChange, "Preparation entry edited. Was: Applied lime 300 kg. Now: Applied agricultural lime, 250 kg, and tilled the bottom.", Tech(0));
        History(ep13, Local(D(-2), 8), PondChangeType.PreparationChange, $"Preparation entry removed. Entered on the wrong pond (it was EP-14). Entry: {wrong.Description}");

        // EP-14: Prepared three days ago, waiting for the next fry delivery.
        PreparationRound(_ponds["EP-14"], Tech(1), D(-12), D(-3), null);

        // HP-03: Prepared 41 days ago and never stocked: the pond page warns to re-check it before stocking.
        PreparationRound(_ponds["HP-03"], Tech(2), D(-50), D(-41), null);

        // HP-04: was Prepared, reopened after heavy rain diluted the water; back under preparation.
        var hp04 = _ponds["HP-04"];
        PreparationRound(hp04, Tech(0), D(-18), null, null,
            (0, "Drained the pond and scrubbed the liner."),
            (3, "Disinfected with calcium hypochlorite; rinsed after two days."),
            (8, "Filled to 1.2 m with screened seawater; probiotic applied."),
            (13, "Re-filled after heavy rain diluted salinity to 8 ppt."));
        History(hp04, Local(D(-10), 15), PondChangeType.PreparationChange, "Marked Prepared.", Tech(0));
        History(hp04, Local(D(-6), 9), PondChangeType.PreparationChange, "Preparation reopened. Heavy rain overflowed the pond; salinity fell to 8 ppt.");

        // CP-06: a preparation round was abandoned; the pond is Available.
        var cp06 = _ponds["CP-06"];
        PreparationRound(cp06, Tech(1), D(-40), null, Local(D(-33), 9),
            (0, "Drained the pond and scrubbed the walls."),
            (2, "Inlet pump failed during filling."));
        History(cp06, Local(D(-33), 9), PondChangeType.PreparationChange, "Preparation abandoned. Inlet pump broke; stocking moved to the HDPE-lined ponds.");

        _context.SaveChanges();
    }

    /// <summary>A delivery rejected at the farm gate and one ordered for the Prepared ponds; neither starts a cycle.</summary>
    private void SeedExtraDeliveries()
    {
        var rejected = new FryDelivery
        {
            TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(D(-45), 10), HatcheryId = _hatcheries["KCH"].Id, HatcheryBatchNumber = "KCH-0925", DeliveryDate = D(-35),
            PlAgeDays = 9, PlReceived = 0, Notes = "Rejected at the farm gate: PL failed the stress test and the hatchery could not show a health certificate.",
        };
        var ordered = new FryDelivery
        {
            TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(D(-2), 10), HatcheryId = _hatcheries["GBH"].Id, HatcheryBatchNumber = "GBH-B1112", DeliveryDate = D(3),
            PlAgeDays = 12, PlReceived = 205000, CostPhp = 61500m, Notes = "For EP-14 and HP-03.",
        };
        _context.FryDeliveries.AddRange(rejected, ordered);
        _context.SaveChanges();
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = rejected.Id, Status = FryDeliveryStatus.Ordered, ChangedAtUtc = Local(D(-45), 10) });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = rejected.Id, Status = FryDeliveryStatus.InTransit, ChangedAtUtc = Local(D(-36), 21) });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = Tech(2), DeliveryId = rejected.Id, Status = FryDeliveryStatus.Rejected, ChangedAtUtc = Local(D(-35), 6), Note = "Failed the formalin stress test" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = ordered.Id, Status = FryDeliveryStatus.Ordered, ChangedAtUtc = Local(D(-2), 10), Note = "Confirmed by phone" });
        _context.SaveChanges();
    }
}
