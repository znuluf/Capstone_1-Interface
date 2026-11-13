using Capstone.Authorization.Roles;
using Capstone.Compliance;
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
/// The small sample for the Codespace "FPMS_Simple" database (Seed:SimpleSampleData=true). One test farm in General Santos
/// City with two Owners (Abi Rkabubba, Sam Amsedel) and one Technician (Kim Onacsus); three ponds, one of each construction
/// type, all run intensive; and one finished 75-day cycle: ponds prepared in late January, stocked 2 Feb 2026, total
/// harvest 18 Apr 2026 (DOC 75), graded crate by crate and sold the same day with each buyer's crates on their receipt,
/// ponds cleaned and the cycle closed by 30 Apr 2026. The ponds then stand idle through the lean season (May to June). A
/// second cycle, stocked 14 Sep 2026, is running and logged up to the day before the seed date (harvest planned 28 Nov
/// 2026), with one partial harvest per pond in early November that between them cover the harvest and sales scenarios
/// (see <see cref="SeedRunningHarvests"/>). No real farm or personal data.
/// </summary>
public class SimpleSampleDataBuilder
{
    public const string FarmCode = "rkabubba-aqua";

    private static readonly DateOnly Stocking = new(2026, 2, 2);
    private const int CultureDays = 75;
    private static readonly DateOnly HarvestDate = Stocking.AddDays(CultureDays); // 18 Apr 2026
    private static readonly DateOnly BatchesClosed = new(2026, 4, 28);
    private static readonly DateOnly CycleClosed = new(2026, 4, 30);

    /// <summary>Construction type, pond number, area, PL per m2 (intensive band for the construction), survival, final ABW (g), FCR.</summary>
    private sealed record PondPlan(PondConstructionType Type, string Prefix, string ShortCode, decimal AreaM2, decimal Density, decimal Survival, decimal AbwG, decimal Fcr);

    private static readonly PondPlan[] Plans =
    {
        new(PondConstructionType.Earthen, "Earthen Pond", "EP", 2000m, 85m, 0.78m, 15.5m, 1.35m),
        new(PondConstructionType.Concrete, "Concrete Pond", "CP", 600m, 130m, 0.82m, 16.5m, 1.25m),
        new(PondConstructionType.HdpeLined, "HDPE-lined Pond", "HP", 1000m, 130m, 0.82m, 16.5m, 1.28m),
    };

    private readonly CapstoneDbContext _context;
    private int _t;
    private long _ownerId;
    private long _techId;
    private ContainerType _banyera;
    private ContainerType _tub;
    private Buyer _processor;
    private Buyer _market;
    private Buyer _manila;
    /// <summary>Dispatch receipts issued so far (DR-2026-0001 …), across both cycles.</summary>
    private int _saleNo;
    /// <summary>Harvests of 2026 per pond lot number, for the lot code's harvest number (DEC-83).</summary>
    private readonly Dictionary<int, int> _lotHarvests = new();
    private int _pondLotNo;
    private PriceTable _marketTable;
    private Dictionary<string, ParameterDefinition> _parameters;

    public SimpleSampleDataBuilder(CapstoneDbContext context)
    {
        _context = context;
    }

    private static DateTime Local(DateOnly d, int hour, int min = 0) =>
        DateTime.SpecifyKind(d.ToDateTime(new TimeOnly(hour, min)).AddHours(-8), DateTimeKind.Utc);

    public void Create()
    {
        var farms = new FarmSeedBuilder(_context);
        var pw = SeedOptions.DevelopmentPassword;
        var farm = farms.EnsureFarm(FarmCode, "Rkabubba Aqua Farm (test)", "Purok 3 (test data)", "General Santos City", "South Cotabato", "Tambler");
        var abi = farms.EnsureUser(farm.Id, "arkabubba", "Abi", "Rkabubba", StaticRoleNames.Tenants.FarmOwner, pw);
        farms.EnsureUser(farm.Id, "samsedel", "Sam", "Amsedel", StaticRoleNames.Tenants.FarmOwner, pw);
        var kim = farms.EnsureUser(farm.Id, "konacsus", "Kim", "Onacsus", StaticRoleNames.Tenants.FarmTechnician, pw);

        if (_context.Ponds.IgnoreQueryFilters().Any(p => p.TenantId == farm.Id))
        {
            return;
        }

        _t = farm.Id;
        _ownerId = abi.Id;
        _techId = kim.Id;
        _parameters = _context.ParameterDefinitions.AsNoTracking().ToDictionary(p => p.Id);

        var profile = _context.FarmProfiles.IgnoreQueryFilters().First(p => p.Id == _t);
        profile.FarmingSystem = FarmingSystem.Intensive;
        profile.PostalCode = "9500";
        profile.ContactName = "Abi Rkabubba";
        profile.ContactPhone = "0917 000 1111";
        profile.TotalAreaHectares = 0.5m;
        // The partner farm tests water about three times a week (DEC-94).
        profile.WaterQualityDaily = false;
        // Harvest lot code identity (DEC-83): General Santos (0), Tambler (24), the first farm there (01).
        (profile.LotAreaCode, profile.LotPlaceCode, profile.LotFarmNumber) = (LotPlaces.GenSanArea, 24, 1);
        _context.SaveChanges();

        SeedPermits();
        Seed();
    }

    private void Seed()
    {
        // ---- Ponds: one of each construction type, named by it (EP-01, CP-01, HP-01) ----
        var ponds = new List<Pond>();
        var order = _context.PondNamePrefixes.IgnoreQueryFilters().Where(x => x.TenantId == _t).Max(x => (int?)x.SortOrder) ?? 0;
        foreach (var plan in Plans)
        {
            var prefix = _context.PondNamePrefixes.IgnoreQueryFilters().FirstOrDefault(x => x.TenantId == _t && x.ShortCode == plan.ShortCode)
                         ?? new PondNamePrefix { TenantId = _t, Name = plan.Prefix, ShortCode = plan.ShortCode, SortOrder = ++order, IsActive = true };
            if (prefix.Id == Guid.Empty)
            {
                _context.PondNamePrefixes.Add(prefix);
                _context.SaveChanges();
            }

            var earthen = plan.Type == PondConstructionType.Earthen;
            var pond = new Pond
            {
                TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(new DateOnly(2025, 12, 1), 9), PrefixId = prefix.Id, Number = 1, PondCode = PondNaming.FormatCode(plan.ShortCode, 1),
                LotNumber = ++_pondLotNo, AreaM2 = plan.AreaM2, AverageDepthM = earthen ? 1.3m : 1.5m, MaxDepthM = earthen ? 1.6m : 1.8m, Purpose = PondPurpose.GrowOut, ConstructionType = plan.Type,
                InletType = "PVC pipe with 300-micron filter bag", OutletType = earthen ? "Monk with gate boards" : "Central drain with standpipe",
                AerationSystem = earthen ? "Paddlewheel x4, 1 hp each" : "Paddlewheel x2 and a 1 hp air blower with diffuser lines",
            };
            _context.Ponds.Add(pond);
            _context.SaveChanges();
            _context.PondHistories.Add(new PondHistory
            {
                TenantId = _t, CreatorUserId = _ownerId, PondId = pond.Id, ChangeDateUtc = pond.CreationTime, ChangeType = PondChangeType.Created,
                Description = $"Pond {pond.PondCode} ({PondNaming.DisplayName(plan.Prefix, 1)}) created ({plan.AreaM2:0.##} m², GrowOut). Status Available.",
            });
            ponds.Add(pond);
        }

        // ---- Resources: the three BFAR-accredited P. vannamei hatcheries of Region XII ----
        // Names, locations, accreditation numbers and expiry dates from the BFAR list of accredited P. vannamei hatcheries
        // as of 30 Nov 2025 (rows 24 to 26). Each accreditation is kept as an "Other" certificate with its expiry; issue dates
        // are read from the renewal date in the number (RNW101725 = 17 Oct 2025). Contact details are left out; health
        // certificate numbers are test values.
        HatcherySource Hatchery(string name, string shortCode, string address, string accreditationNo)
        {
            var h = new HatcherySource
            {
                TenantId = _t, CreatorUserId = _ownerId, Name = name, ShortCode = shortCode, Address = address,
                BfarAccreditationNo = accreditationNo, AccreditationStatus = AccreditationStatus.Accredited,
            };
            _context.HatcherySources.Add(h);
            _context.SaveChanges();
            return h;
        }

        HatcheryCertificate Certificate(HatcherySource h, CertificateType type, string no, DateOnly? issued, DateOnly expires)
        {
            var c = new HatcheryCertificate { TenantId = _t, CreatorUserId = _ownerId, HatcheryId = h.Id, CertificateType = type, CertificateNo = no, IssueDate = issued, ExpiryDate = expires };
            _context.HatcheryCertificates.Add(c);
            return c;
        }

        var gensanHatchery = Hatchery("Gensan Shrimp Hatchery (Charoen Pokphand Foods Philippines Corporation)", "GSH", "Brgy. Tinoto, Maasim, Sarangani Province", "HA01-R12SAR-02092013-RNW101725");
        var stoNino = Hatchery("Sto. Niño Aquaculture Corporation (larval rearing facility)", "SNA", "Brgy. Tuyan, Malapatan, Sarangani Province", "HA02-R12SAR-02092013-RNW101725");
        var rdex = Hatchery("RDEX Food International Philippines, Inc.", "RDX", "Bawing, General Santos City", "HA03-R12-GSC-080718-RNW111521");
        Certificate(gensanHatchery, CertificateType.Other, "BFAR accreditation HA01-R12SAR-02092013-RNW101725", new DateOnly(2025, 10, 17), new DateOnly(2028, 10, 17));
        Certificate(stoNino, CertificateType.Other, "BFAR accreditation HA02-R12SAR-02092013-RNW101725", new DateOnly(2025, 10, 17), new DateOnly(2028, 10, 17));
        Certificate(rdex, CertificateType.Other, "BFAR accreditation HA03-R12-GSC-080718-RNW111521", null, new DateOnly(2027, 8, 15));
        var gensanHealth = Certificate(gensanHatchery, CertificateType.Health, "HC-GSH-TEST-2026", new DateOnly(2026, 1, 5), new DateOnly(2026, 12, 31));
        var stoNinoHealth = Certificate(stoNino, CertificateType.Health, "HC-SNA-TEST-2026", new DateOnly(2026, 7, 1), new DateOnly(2027, 6, 30));
        Certificate(rdex, CertificateType.Health, "HC-RDX-TEST-2026", new DateOnly(2026, 3, 1), new DateOnly(2027, 2, 28));
        var hatchery = gensanHatchery;
        var certificate = gensanHealth;

        var processor = new Buyer { TenantId = _t, CreatorUserId = _ownerId, BuyerType = BuyerType.Company, Name = "Mindanao Shrimp Processing (test)", ContactPerson = "Q. Inspector", Phone = "0920 777 8888", Address = "Calumpang Industrial Area, General Santos City" };
        var market = new Buyer { TenantId = _t, CreatorUserId = _ownerId, BuyerType = BuyerType.Individual, Name = "Rosa Villanueva (test)", Phone = "0921 999 0000", Address = "Dadiangas Market stall 14 (test)" };
        var manila = new Buyer { TenantId = _t, CreatorUserId = _ownerId, BuyerType = BuyerType.Company, Name = "Luzon Seafood Traders (test)", ContactPerson = "L. Trader", Phone = "0917 555 1212", Address = "Navotas Fish Port Complex, Metro Manila" };
        _context.Buyers.AddRange(processor, market, manila);
        (_processor, _market, _manila) = (processor, market, manila);

        // The market buyer prices by count from her price table (DEC-82).
        _marketTable = new PriceTable
        {
            Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _ownerId, Name = "Rosa Villanueva – market prices", BuyerId = market.Id,
            Rows = new List<PriceTableRow>
            {
                new() { TenantId = _t, MaxCountPerKg = 40, PricePerKg = 450m },
                new() { TenantId = _t, MinCountPerKg = 41, MaxCountPerKg = 50, PricePerKg = 400m },
                new() { TenantId = _t, MinCountPerKg = 51, MaxCountPerKg = 60, PricePerKg = 380m },
                new() { TenantId = _t, MinCountPerKg = 61, MaxCountPerKg = 70, PricePerKg = 350m },
                new() { TenantId = _t, MinCountPerKg = 71, PricePerKg = 320m },
            },
        };
        _context.PriceTables.Add(_marketTable);

        // Crate types for the crate tally (DEC-80), named kind, capacity, then owner: the farm's banyeras are weighed shrimp
        // only; the processor lends tubs that are weighed with the tub.
        _banyera = new ContainerType { Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _ownerId, Name = "Banyera 20 kg", NominalKg = 20m, SortOrder = 1, IsDefault = true };
        _tub = new ContainerType { Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _ownerId, Name = "Tub 25 kg – Mindanao Processing", NominalKg = 25m, TareKg = 1.2m, SortOrder = 2 };
        _context.ContainerTypes.AddRange(_banyera, _tub);

        // The partner farm's feeds by stage (DEC-61): a fry mash powder from another brand, then Uni-President Nu Ri N310 to N315.
        var feeds = FeedCodes.Select((f, i) => new InventoryItem
        {
            TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.Feed, Brand = f.Brand, ProductName = f.Product, FeedType = f.Form,
            BaiRegistrationNo = $"BAI-TEST-{i + 1:0000}", Unit = "kg", ReorderLevel = f.Pack * 2, PackSize = f.Pack,
        }).ToArray();
        var probiotic = new InventoryItem { TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.AdditiveSupplement, Brand = "AquaTest", ProductName = "Bacillus probiotic", Unit = "kg", ReorderLevel = 2, PackSize = 1m };
        _context.InventoryItems.AddRange(feeds);
        _context.InventoryItems.Add(probiotic);
        _context.SaveChanges();

        // ---- PL per pond and the feed each needs: total feed = harvest x FCR, rising with the shrimp ----
        var pls = Plans.Select((p, i) => (long)(ponds[i].AreaM2 * p.Density)).ToArray();
        var schedules = Plans.Select((p, i) => FeedSchedule(pls[i] * p.Survival * p.AbwG / 1000m * p.Fcr)).ToArray();
        var lots = new InventoryLot[FeedCodes.Length];
        for (var s = 0; s < FeedCodes.Length; s++)
        {
            // Each code is bought about five days before the pond starts on it, in whole packs plus one spare.
            var f = FeedCodes[s];
            var date = Stocking.AddDays(f.FromDoc - 5);
            lots[s] = Receive(feeds[s], $"{f.LotPrefix}-{date:yyMMdd}", Packs(NeedKg(schedules, s), f.Pack) + f.Pack, f.CostPhp, date);
        }

        var probioticLot = Receive(probiotic, "PB-260125", 20m, 950m, new DateOnly(2026, 1, 25));

        // ---- Fry delivery and the cycle ----
        const long deadOnArrival = 2000, countDifference = 3000;
        var delivery = new FryDelivery
        {
            TenantId = _t, CreatorUserId = _ownerId, HatcheryId = hatchery.Id, HatcheryBatchNumber = "GSH-B0202", DeliveryDate = Stocking, PlAgeDays = 12,
            PlReceived = pls.Sum() + deadOnArrival + countDifference, CostPhp = Math.Round((pls.Sum() + deadOnArrival + countDifference) * 0.36m, 0),
            PlHealthCertificateNo = "PLHC-20260202", TransportPermitNo = "DTP-20260202-GSH", SfscNo = "SFSC-2026-GSH-0202",
            StockingFinishedAtUtc = Local(Stocking, 11), StockingFinishedByUserId = _ownerId,
            Notes = "Picked up at the hatchery in Brgy. Tinoto, Maasim; oxygenated bags, by truck to the farm.",
        };
        _context.FryDeliveries.Add(delivery);
        _context.SaveChanges();
        _context.FryDeliveryShortfalls.Add(new FryDeliveryShortfall { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = delivery.Id, Reason = ShortfallReason.DeadOnArrival, Count = deadOnArrival, Note = "Dead in the bags on arrival" });
        _context.FryDeliveryShortfalls.Add(new FryDeliveryShortfall { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = delivery.Id, Reason = ShortfallReason.CountDifference, Count = countDifference, Note = "Hatchery count was higher than the farm's count" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Ordered, ChangedAtUtc = Local(new DateOnly(2026, 1, 20), 10), Note = "Ordered by phone" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _techId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Received, ChangedAtUtc = Local(Stocking, 5) });

        var cycle = new ProductionCycle { TenantId = _t, CreatorUserId = _ownerId, CycleCode = "2026-02-GSH-01", Status = CycleStatus.Active, FryDeliveryId = delivery.Id };
        _context.ProductionCycles.Add(cycle);
        _context.SaveChanges();

        var grades = _context.SizeGrades.IgnoreQueryFilters().Where(g => g.TenantId == _t).ToList();
        var grade6070 = grades.First(g => g.Label == "60/70");
        var grade5060 = grades.First(g => g.Label == "50/60");

        for (var i = 0; i < Plans.Length; i++)
        {
            var plan = Plans[i];
            var pond = ponds[i];
            var pl = pls[i];
            var letter = ((char)('A' + i)).ToString();

            var round = new PondPreparationRound
            {
                TenantId = _t, CreatorUserId = _techId, PondId = pond.Id, StartedAtUtc = Local(new DateOnly(2026, 1, 20), 8),
                PreparedAtUtc = Local(new DateOnly(2026, 1, 30), 15), PreparedByUserId = _techId, UsedAtUtc = Local(Stocking, 7),
            };
            _context.PondPreparationRounds.Add(round);
            _context.SaveChanges();
            foreach (var (day, text) in new[]
            {
                (20, plan.Type == PondConstructionType.Earthen ? "Drained the pond; drying started." : "Drained the pond and scrubbed the walls."),
                (24, plan.Type == PondConstructionType.Earthen ? "Applied agricultural lime and tilled the pond bottom." : "Disinfected with calcium hypochlorite; rinsed after two days."),
                (30, "Filled to 1.3 m with filtered seawater; probiotic applied."),
            })
            {
                _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = _t, CreatorUserId = _techId, RoundId = round.Id, ObservedAtUtc = Local(new DateOnly(2026, 1, day), 9), Description = text });
            }

            var band = _context.DensityBands.AsNoTracking().FirstOrDefault(b => b.FarmingSystem == FarmingSystem.Intensive && b.ConstructionType == plan.Type);
            var batch = new PondBatch
            {
                TenantId = _t, CreatorUserId = _ownerId, CycleId = cycle.Id, PondId = pond.Id, PreparationRoundId = round.Id, Letter = letter, BatchCode = $"{cycle.CycleCode}-{letter}",
                Status = BatchStatus.Stocked, StockedAtUtc = Local(Stocking, 7, 30 + i * 10), StockingDate = Stocking, PondAreaM2AtStocking = pond.AreaM2, TransportMode = TransportMode.Truck,
                TimeProcessedUtc = Local(Stocking, 6, 30), PlCountStocked = pl, DeadAtStocking = 150, AcclimationMinutes = 60, InitialSurvivalEstimatePct = 95,
                FarmingSystemAtStocking = FarmingSystem.Intensive, ConstructionTypeAtStocking = plan.Type, DensityFlag = band?.Judge(plan.Density),
                HatcheryCertificationStatusAtStocking = hatchery.DescribeCertification(certificate, Stocking),
            };
            _context.PondBatches.Add(batch);
            _context.SaveChanges();

            // ---- Logs: pre-stocking water, four feedings a day (DEC-61), weekly water, fortnightly growth, probiotic, two mortality entries ----
            var facts = new BatchFacts { PlCountStocked = pl, PondAreaM2 = pond.AreaM2, StockingDate = Stocking };
            Water(batch, Local(Stocking.AddDays(-1), 16), LogType.PreStockingWaterQuality, 0);
            foreach (var (doc, kg) in schedules[i])
            {
                // Heavy rain: the afternoon feedings (3 and 4) were skipped (a common weather problem in the interviews).
                facts.CumulativeFeedKg += FeedDay(batch, Stocking.AddDays(doc), doc, lots, kg, doc == RainDoc ? 3 : null);
            }

            // Power interruption overnight (the problem named most in the interviews): aerators stopped, low DO at dawn, losses.
            var outage = Stocking.AddDays(OutageDoc);
            Readings(batch, Local(outage, 4, 30), "Power interruption from 01:00 to 04:00; aerators off. Backup generator started at 04:10.",
                (ParameterCodes.DO, 2.8m), (ParameterCodes.Temperature, 28.9m), (ParameterCodes.PH, 7.7m));
            var outageLog = Log(batch, Local(outage, 7), LogType.Mortality);
            var outageDead = (int)Math.Round(pl * 0.012m);
            _context.MortalityDetails.Add(new MortalityDetail
            {
                Id = outageLog.Id, TenantId = _t, Count = outageDead, Cause = MortalityCause.WaterQuality, Symptoms = "Shrimp gasping at the surface along the edges at dawn",
                ResponseAction = "Ran the backup generator; reduced the morning feed by half",
            });
            facts.Mortalities.Add(new MortalityFact { ObservedAtUtc = outageLog.ObservedAtUtc, Count = outageDead });
            Readings(batch, Local(Stocking.AddDays(RainDoc), 16), "Heavy rain all afternoon; salinity dropped.",
                (ParameterCodes.Salinity, 11m), (ParameterCodes.Temperature, 27.2m), (ParameterCodes.PH, 7.4m), (ParameterCodes.DO, 5.1m));

            for (var d = 7; d < CultureDays; d += 7)
            {
                Water(batch, Local(Stocking.AddDays(d), 5, 30), LogType.WaterQuality, d);
            }

            for (var d = 14; d < CultureDays; d += 14)
            {
                var abw = Math.Max(0.05m, Math.Round(plan.AbwG * (decimal)Math.Pow((double)d / CultureDays, 1.8), 2));
                var log = Log(batch, Local(Stocking.AddDays(d), 9), LogType.GrowthSampling);
                var weight = Math.Round(abw * 100m, 1);
                var abwG = IndicatorCalculator.Abw(weight, 100);
                _context.GrowthSamplingDetails.Add(new GrowthSamplingDetail { Id = log.Id, TenantId = _t, SampleCount = 100, TotalSampleWeightG = weight, AbwG = abwG });
                facts.GrowthSamples.Add(new GrowthSampleFact { Date = Stocking.AddDays(d), ObservedAtUtc = log.ObservedAtUtc, AbwG = abwG });
            }

            for (var d = 7; d < CultureDays; d += 14)
            {
                var kg = Math.Ceiling(pond.AreaM2 / 1000m) / 2m;
                var log = Log(batch, Local(Stocking.AddDays(d), 10), LogType.ChemicalApplication);
                _context.ChemicalApplicationDetails.Add(new ChemicalApplicationDetail { Id = log.Id, TenantId = _t, Reason = "Water and gut probiotic", Dosage = Math.Round(kg * 10000m / pond.AreaM2, 2), DosageUnit = "kg/ha", Method = "Activated in pond water, broadcast" });
                Move(probioticLot, log.ObservedAtUtc, StockMovementType.Usage, -kg, batch.Id, sourceLogId: log.Id);
            }

            foreach (var (d, share, cause) in new[] { (4, 0.008m, "Stress after PL stocking"), (35, 0.010m, "Molting-related losses") })
            {
                var log = Log(batch, Local(Stocking.AddDays(d), 8, 30), LogType.Mortality);
                var count = (int)Math.Round(pl * share);
                _context.MortalityDetails.Add(new MortalityDetail { Id = log.Id, TenantId = _t, Count = count, Cause = MortalityCause.Others, OtherCause = cause, Symptoms = "Weak swimming near the dike" });
                facts.Mortalities.Add(new MortalityFact { ObservedAtUtc = log.ObservedAtUtc, Count = count });
            }

            facts.CumulativeMortality = facts.Mortalities.Sum(m => m.Count);
            _context.SaveChanges();

            // ---- Total harvest at DOC 75: 60/70 with the bigger shrimp as 50/60 ----
            var harvestKg = Math.Round(pl * plan.Survival * plan.AbwG / 1000m, 1);
            var kg5060 = Math.Round(harvestKg * 0.35m, 1);
            var harvest = new Harvest
            {
                TenantId = _t, CreatorUserId = _techId, BatchId = batch.Id, HarvestedAtUtc = Local(HarvestDate, 3), HarvestType = HarvestType.Total, TotalKg = harvestKg,
                LotCode = HarvestLotCoder.Format(HarvestDate.Year, LotPlaces.GenSanArea, 24, 1, pond.LotNumber.Value, 1), // DEC-83: the pond's 1st harvest of 2026
                Boxes = (int)Math.Ceiling(harvestKg / 20m), AbwG = plan.AbwG, DeadAtHarvest = 40, SmoothShell = true, IntactAppendages = true, NoNecrosis = true,
                // DEC-80: a 400-piece ABW sample and a crate tally of 20 kg crates, the last one partly filled.
                // DEC-82, DEC-86: the crates are graded one by one, the 60/70 first; each later goes on its grade's sale.
                AbwSampleWeightG = plan.AbwG * 400m, AbwSamplePieces = 400,
                Crates = CrateTally(harvestKg - kg5060, grade6070.Id).Concat(CrateTally(kg5060, grade5060.Id, firstNo: (int)Math.Ceiling((harvestKg - kg5060) / 20m) + 1)).ToList(),
                GradeLines = new List<HarvestGradeLine>
                {
                    new() { TenantId = _t, SizeGradeId = grade6070.Id, Kg = harvestKg - kg5060 },
                    new() { TenantId = _t, SizeGradeId = grade5060.Id, Kg = kg5060 },
                },
            };
            harvest.Boxes = harvest.Crates.Count;
            _context.Harvests.Add(harvest);
            _lotHarvests[pond.LotNumber.Value] = 1;
            batch.Status = BatchStatus.Harvested;
            _context.SaveChanges();
            facts.Harvests.Add(new HarvestFact
            {
                Date = HarvestDate, HarvestedAtUtc = harvest.HarvestedAtUtc, IsFinal = true, TotalKg = harvestKg, AbwG = plan.AbwG,
                GradeLines = harvest.GradeLines.Select(g => (g.Kg, g.SizeGradeId == grade6070.Id ? grade6070.MidCountPerKg : grade5060.MidCountPerKg)).ToList(),
            });

            // The processing plant takes the 60/70 (re-weighed at the plant); the market buyer takes the 50/60 for cash.
            var g6070 = harvest.GradeLines[0];
            var g5060 = harvest.GradeLines[1];
            // HP-01's 60/70 is shipped to a Manila buyer (closed van to the port, then ferry); the others go to the local plant.
            // The plant prices on ABW (DEC-80): ₱300/kg at 12 g plus ₱10 for each gram above, so 15.5 g → ₱335 and 16.5 g → ₱345.
            var toManila = plan.Type == PondConstructionType.HdpeLined;
            harvest.BuyerId = (toManila ? manila : processor).Id; // DEC-81: the main buyer; the market buyer takes the 50/60
            harvest.WeighedBy = WeighedBy.Farm;
            var line6070 = new SaleLine { TenantId = _t, HarvestGradeLineId = g6070.Id, Kg = g6070.Kg, BuyerAcceptedKg = Math.Round(g6070.Kg * (toManila ? 0.98m : 0.985m), 1), PricePerKg = 360m };
            if (!toManila)
            {
                line6070.PriceMethod = PriceMethod.BaseAbw;
                line6070.BasePricePerKg = 300m;
                line6070.BaseAbwG = 12m;
                line6070.StepPerG = 10m;
                line6070.PriceAbwG = plan.AbwG;
                line6070.PricePerKg = SaleLine.BaseAbwPrice(300m, 12m, 10m, plan.AbwG);
                line6070.ReferencePricePerKg = line6070.PricePerKg;
            }

            var sale6070 = AddSale(toManila ? manila : processor, ++_saleNo, line6070, "Bank transfer", HarvestDate.AddDays(toManila ? 10 : 6), transport: true, toManila);
            // 50/60 is 55 pcs/kg in the middle: the "51–60 pcs/kg" row of the market table, ₱380.
            var row = _marketTable.Find(55m);
            var sale5060 = AddSale(market, ++_saleNo, new SaleLine
            {
                TenantId = _t, HarvestGradeLineId = g5060.Id, Kg = g5060.Kg, PricePerKg = row.PricePerKg, PriceMethod = PriceMethod.Table, PriceTableId = _marketTable.Id,
                PriceTableName = _marketTable.Name, PriceTableRowLabel = row.Label, PriceCountPerKg = 55m, ReferencePricePerKg = row.PricePerKg,
            }, "Cash", HarvestDate, transport: false);
            _context.SaveChanges();
            // DEC-86: each crate is on its grade's dispatch receipt, so each buyer's receipt lists its own crates. HP-01's
            // sales are left without crates, as sales recorded before crates could be marked.
            if (!toManila)
            {
                foreach (var crate in harvest.Crates)
                {
                    crate.SaleId = crate.SizeGradeId == grade6070.Id ? sale6070.Id : sale5060.Id;
                }

                _context.SaveChanges();
            }

            // ---- After the harvest: clean and dry the pond, then close the batch the way Close Batch does ----
            var sludge = Log(batch, Local(HarvestDate.AddDays(3), 8), LogType.PostProduction, plan.Type == PondConstructionType.Earthen ? "Sludge pushed out of the pond bottom." : "Walls and floor pressure-washed.");
            _context.PostProductionDetails.Add(new PostProductionDetail { Id = sludge.Id, TenantId = _t, ActivityType = PostProductionActivity.SludgeRemoval });
            var drying = Log(batch, Local(HarvestDate.AddDays(6), 8), LogType.PostProduction, "Pond left to dry over the lean season (May to June).");
            _context.PostProductionDetails.Add(new PostProductionDetail { Id = drying.Id, TenantId = _t, ActivityType = PostProductionActivity.Drying });

            var ind = IndicatorCalculator.Compute(facts, BatchesClosed);
            batch.FinalAbwG = ind.FinalAbwG;
            batch.FinalFcr = ind.FinalFcr;
            batch.SurvivalRatePct = ind.SurvivalRatePct ?? 0m;
            batch.TotalHarvestKg = ind.TotalHarvestKg;
            batch.TotalFeedKg = ind.CumulativeFeedKg;
            batch.CultureDays = ind.CultureDays;
            batch.Status = BatchStatus.Closed;
            batch.ClosedAtUtc = Local(BatchesClosed, 10);
            batch.ClosedByUserId = _ownerId;
            _context.SaveChanges();
        }

        cycle.Status = CycleStatus.Closed;
        cycle.Outcome = CycleOutcome.Completed;
        cycle.ClosedAtUtc = Local(CycleClosed, 11);
        cycle.ClosedByUserId = _ownerId;

        // Feed left at cycle close is written off, so no stock is left behind to expire.
        foreach (var lot in lots.Append(probioticLot))
        {
            var balance = _context.StockMovements.Local.Where(m => m.LotId == lot.Id).Sum(m => m.Quantity);
            if (balance > 0)
            {
                Move(lot, Local(CycleClosed, 15), StockMovementType.Adjustment, -balance, null, reason: "Stock count at cycle close: remainder damaged, written off");
            }
        }

        _context.SaveChanges();
        var running = SeedRunningCycle(ponds, pls, stoNino, stoNinoHealth, feeds, probiotic);
        SeedRunningHarvests(running, ponds, grades);
        SeedReadyToStock(rdex);

        _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.CycleCode, Scope = "2026-02-GSH", NextValue = 2 });
        _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.CycleCode, Scope = "2026-09-SNA", NextValue = 2 });
        _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.DispatchReceipt, Scope = "2026", NextValue = _saleNo + 1 });
        // The next lot code's harvest number per pond (DEC-83): one more than the pond's harvests of 2026 so far.
        foreach (var n in Enumerable.Range(1, Plans.Length))
        {
            _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.HarvestLot, Scope = $"P{n}-2026", NextValue = _lotHarvests.GetValueOrDefault(n) + 1 });
        }
        _context.SaveChanges();
    }

    /// <summary>
    /// The running cycle: the same three ponds prepared 1 to 11 Sep 2026 and stocked 14 Sep 2026, logged up to the day
    /// before the seed date (at most DOC 74), with the day-75 harvest planned for 28 Nov 2026. No harvest yet.
    /// </summary>
    private List<PondBatch> SeedRunningCycle(List<Pond> ponds, long[] pls, HatcherySource hatchery, HatcheryCertificate certificate, InventoryItem[] feeds, InventoryItem probiotic)
    {
        var batches = new List<PondBatch>();
        var stocking = new DateOnly(2026, 9, 14);
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8)).AddDays(-1);
        var lastDoc = Math.Clamp(yesterday.DayNumber - stocking.DayNumber, 0, CultureDays - 1);

        var schedules = Plans.Select((p, i) => FeedSchedule(pls[i] * p.Survival * p.AbwG / 1000m * p.Fcr).Where(d => d.Doc <= lastDoc).ToList()).ToArray();
        var lots = new InventoryLot[FeedCodes.Length];
        for (var s = 0; s < FeedCodes.Length; s++)
        {
            // Enough for the days logged, plus a few packs on hand of the code in use and the codes still to come.
            var f = FeedCodes[s];
            var onHand = Stage(lastDoc + 1) <= s ? 5 * f.Pack : 0m;
            var planned = stocking.AddDays(f.FromDoc - 5);
            var date = planned <= yesterday ? planned : yesterday;
            lots[s] = Receive(feeds[s], $"{f.LotPrefix}-{date:yyMMdd}", Packs(NeedKg(schedules, s), f.Pack) + f.Pack + onHand, f.CostPhp + 2m, date);
        }

        var probioticLot = Receive(probiotic, "PB-260904", 20m, 960m, new DateOnly(2026, 9, 4));

        var delivery = new FryDelivery
        {
            TenantId = _t, CreatorUserId = _ownerId, HatcheryId = hatchery.Id, HatcheryBatchNumber = "SNA-B0914", DeliveryDate = stocking, PlAgeDays = 12,
            PlReceived = pls.Sum() + 4000, CostPhp = Math.Round((pls.Sum() + 4000) * 0.33m, 0),
            PlHealthCertificateNo = "PLHC-20260914", TransportPermitNo = "DTP-20260914-SNA", SfscNo = null, // the SFSC paper has not arrived yet: shows the DEC-79 warnings until it is typed in
            StockingFinishedAtUtc = Local(stocking, 11), StockingFinishedByUserId = _ownerId,
            Notes = "Delivered by the hatchery truck from Brgy. Tuyan, Malapatan; oxygenated bags. SFSC to follow from the hatchery.",
        };
        _context.FryDeliveries.Add(delivery);
        _context.SaveChanges();
        _context.FryDeliveryShortfalls.Add(new FryDeliveryShortfall { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = delivery.Id, Reason = ShortfallReason.DeadOnArrival, Count = 1500, Note = "Dead in the bags on arrival" });
        _context.FryDeliveryShortfalls.Add(new FryDeliveryShortfall { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = delivery.Id, Reason = ShortfallReason.CountDifference, Count = 2500, Note = "Hatchery count was higher than the farm's count" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Ordered, ChangedAtUtc = Local(new DateOnly(2026, 9, 1), 10), Note = "Ordered by phone" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _techId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Received, ChangedAtUtc = Local(stocking, 5) });

        var cycle = new ProductionCycle { TenantId = _t, CreatorUserId = _ownerId, CycleCode = "2026-09-SNA-01", Status = CycleStatus.Active, FryDeliveryId = delivery.Id };
        _context.ProductionCycles.Add(cycle);
        _context.SaveChanges();

        for (var i = 0; i < Plans.Length; i++)
        {
            var plan = Plans[i];
            var pond = ponds[i];
            var pl = pls[i];
            var letter = ((char)('A' + i)).ToString();

            var round = new PondPreparationRound
            {
                TenantId = _t, CreatorUserId = _techId, PondId = pond.Id, StartedAtUtc = Local(new DateOnly(2026, 9, 1), 8),
                PreparedAtUtc = Local(new DateOnly(2026, 9, 11), 15), PreparedByUserId = _techId, UsedAtUtc = Local(stocking, 7),
            };
            _context.PondPreparationRounds.Add(round);
            _context.SaveChanges();
            foreach (var (day, text) in new[]
            {
                (1, "Checked the dried pond after the lean season; repaired the inlet screen."),
                (5, plan.Type == PondConstructionType.Earthen ? "Applied agricultural lime and tilled the pond bottom." : "Disinfected with calcium hypochlorite; rinsed after two days."),
                (11, "Filled to 1.3 m with filtered seawater; probiotic applied."),
            })
            {
                _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = _t, CreatorUserId = _techId, RoundId = round.Id, ObservedAtUtc = Local(new DateOnly(2026, 9, day), 9), Description = text });
            }

            var band = _context.DensityBands.AsNoTracking().FirstOrDefault(b => b.FarmingSystem == FarmingSystem.Intensive && b.ConstructionType == plan.Type);
            var batch = new PondBatch
            {
                TenantId = _t, CreatorUserId = _ownerId, CycleId = cycle.Id, PondId = pond.Id, PreparationRoundId = round.Id, Letter = letter, BatchCode = $"{cycle.CycleCode}-{letter}",
                Status = BatchStatus.Stocked, StockedAtUtc = Local(stocking, 7, 30 + i * 10), StockingDate = stocking, PondAreaM2AtStocking = pond.AreaM2, TransportMode = TransportMode.Truck,
                TimeProcessedUtc = Local(stocking, 6, 30), PlCountStocked = pl, DeadAtStocking = 120, AcclimationMinutes = 60, InitialSurvivalEstimatePct = 95,
                FarmingSystemAtStocking = FarmingSystem.Intensive, ConstructionTypeAtStocking = plan.Type, DensityFlag = band?.Judge(plan.Density),
                HatcheryCertificationStatusAtStocking = hatchery.DescribeCertification(certificate, stocking),
            };
            _context.PondBatches.Add(batch);
            batches.Add(batch);
            _context.SaveChanges();

            Water(batch, Local(stocking.AddDays(-1), 16), LogType.PreStockingWaterQuality, 0);
            foreach (var (doc, kg) in schedules[i])
            {
                FeedDay(batch, stocking.AddDays(doc), doc, lots, kg);
            }

            for (var d = 7; d <= lastDoc; d += 7)
            {
                Water(batch, Local(stocking.AddDays(d), 5, 30), LogType.WaterQuality, d);
            }

            for (var d = 14; d <= lastDoc; d += 14)
            {
                var abw = Math.Max(0.05m, Math.Round(plan.AbwG * (decimal)Math.Pow((double)d / CultureDays, 1.8), 2));
                var log = Log(batch, Local(stocking.AddDays(d), 9), LogType.GrowthSampling);
                var weight = Math.Round(abw * 100m, 1);
                var isLast = d + 14 > lastDoc;
                _context.GrowthSamplingDetails.Add(new GrowthSamplingDetail
                {
                    Id = log.Id, TenantId = _t, SampleCount = 100, TotalSampleWeightG = weight, AbwG = IndicatorCalculator.Abw(weight, 100),
                    EstimatedSurvivalPct = isLast ? Math.Round(100m - (100m - plan.Survival * 100m) * d / CultureDays, 0) : null,
                });
            }

            for (var d = 7; d <= lastDoc; d += 14)
            {
                var kg = Math.Ceiling(pond.AreaM2 / 1000m) / 2m;
                var log = Log(batch, Local(stocking.AddDays(d), 10), LogType.ChemicalApplication);
                _context.ChemicalApplicationDetails.Add(new ChemicalApplicationDetail { Id = log.Id, TenantId = _t, Reason = "Water and gut probiotic", Dosage = Math.Round(kg * 10000m / pond.AreaM2, 2), DosageUnit = "kg/ha", Method = "Activated in pond water, broadcast" });
                Move(probioticLot, log.ObservedAtUtc, StockMovementType.Usage, -kg, batch.Id, sourceLogId: log.Id);
            }

            foreach (var (d, share, cause) in new[] { (4, 0.008m, "Stress after PL stocking"), (35, 0.010m, "Molting-related losses") })
            {
                if (d <= lastDoc)
                {
                    var log = Log(batch, Local(stocking.AddDays(d), 8, 30), LogType.Mortality);
                    _context.MortalityDetails.Add(new MortalityDetail { Id = log.Id, TenantId = _t, Count = (int)Math.Round(pl * share), Cause = MortalityCause.Others, OtherCause = cause, Symptoms = "Weak swimming near the dike" });
                }
            }

            _context.SaveChanges();
        }

        return batches;
    }

    private const int OutageDoc = 40;
    private const int RainDoc = 52;

    private void Readings(PondBatch batch, DateTime at, string notes, params (string Code, decimal Value)[] readings)
    {
        var log = Log(batch, at, LogType.WaterQuality, notes);
        foreach (var (code, value) in readings)
        {
            var p = _parameters[code];
            _context.WaterQualityMeasurements.Add(new WaterQualityMeasurement { Id = Guid.NewGuid(), TenantId = _t, LogId = log.Id, ParameterCode = code, Value = value, UnitCode = p.UnitCode, IsOutOfRange = p.IsOutOfOptimalRange(value), Side = p.SideOf(value) });
        }
    }

    /// <summary>
    /// Ready for the user to try "Stock a batch": two new ponds (EP-02 earthen, HP-02 HDPE-lined) prepared and marked Prepared,
    /// and a fry delivery from RDEX received on the seed date that has not been stocked yet (no cycle). The Shrimp Fry Source
    /// Certificate number is left blank, so stocking shows the DEC-79 warning unless it is typed in first.
    /// </summary>
    private void SeedReadyToStock(HatcherySource hatchery)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8));
        foreach (var (shortCode, type, area) in new[] { ("EP", PondConstructionType.Earthen, 2000m), ("HP", PondConstructionType.HdpeLined, 1000m) })
        {
            var prefix = _context.PondNamePrefixes.IgnoreQueryFilters().First(x => x.TenantId == _t && x.ShortCode == shortCode);
            var earthen = type == PondConstructionType.Earthen;
            var created = today.AddDays(-25);
            var pond = new Pond
            {
                TenantId = _t, CreatorUserId = _ownerId, CreationTime = Local(created, 9), PrefixId = prefix.Id, Number = 2, PondCode = PondNaming.FormatCode(shortCode, 2),
                LotNumber = ++_pondLotNo, AreaM2 = area, AverageDepthM = earthen ? 1.3m : 1.5m, MaxDepthM = earthen ? 1.6m : 1.8m, Purpose = PondPurpose.GrowOut, ConstructionType = type,
                InletType = "PVC pipe with 300-micron filter bag", OutletType = earthen ? "Monk with gate boards" : "Central drain with standpipe",
                AerationSystem = earthen ? "Paddlewheel x4, 1 hp each" : "Paddlewheel x2 and a 1 hp air blower with diffuser lines",
            };
            _context.Ponds.Add(pond);
            _context.SaveChanges();
            _context.PondHistories.Add(new PondHistory
            {
                TenantId = _t, CreatorUserId = _ownerId, PondId = pond.Id, ChangeDateUtc = pond.CreationTime, ChangeType = PondChangeType.Created,
                Description = $"Pond {pond.PondCode} ({PondNaming.DisplayName(prefix.Name, 2)}) created ({area:0.##} m², GrowOut). Status Available.",
            });

            var round = new PondPreparationRound
            {
                TenantId = _t, CreatorUserId = _techId, PondId = pond.Id, StartedAtUtc = Local(today.AddDays(-12), 8),
                PreparedAtUtc = Local(today.AddDays(-2), 15), PreparedByUserId = _techId,
            };
            _context.PondPreparationRounds.Add(round);
            _context.SaveChanges();
            foreach (var (offset, text) in new[]
            {
                (-12, earthen ? "Drained the new pond; drying started." : "Checked the new liner for leaks and scrubbed it."),
                (-8, earthen ? "Applied agricultural lime and tilled the pond bottom." : "Disinfected with calcium hypochlorite; rinsed after two days."),
                (-2, "Filled to 1.3 m with filtered seawater; probiotic applied."),
            })
            {
                _context.PondPreparationEntries.Add(new PondPreparationEntry { TenantId = _t, CreatorUserId = _techId, RoundId = round.Id, ObservedAtUtc = Local(today.AddDays(offset), 9), Description = text });
            }
        }

        // 300,000 PL for the two ponds at the intensive densities (85 and 130 PL/m2), plus about 1% extra from the hatchery.
        var delivery = new FryDelivery
        {
            TenantId = _t, CreatorUserId = _ownerId, HatcheryId = hatchery.Id, HatcheryBatchNumber = $"RDX-B{today:MMdd}", DeliveryDate = today, PlAgeDays = 12,
            PlReceived = 303000, PlOrdered = 300000, CostPhp = Math.Round(303000 * 0.34m, 0), PlHealthCertificateNo = $"PLHC-{today:yyyyMMdd}", TransportPermitNo = $"DTP-{today:yyyyMMdd}-RDX",
            Notes = "Delivered by the hatchery truck from Bawing; oxygenated bags. Planned for EP-02 (170,000 PL) and HP-02 (130,000 PL). Shrimp Fry Source Certificate to follow.",
        };
        _context.FryDeliveries.Add(delivery);
        _context.SaveChanges();
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Ordered, ChangedAtUtc = Local(today.AddDays(-10), 10), Note = "Ordered by phone" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _ownerId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.InTransit, ChangedAtUtc = Local(today.AddDays(-1), 23), Note = "Left the hatchery" });
        _context.FryDeliveryStatusChanges.Add(new FryDeliveryStatusChange { TenantId = _t, CreatorUserId = _techId, DeliveryId = delivery.Id, Status = FryDeliveryStatus.Received, ChangedAtUtc = Local(today, 0, 30) });
        _context.SaveChanges();
    }

    /// <summary>The farm's permits and licenses, all current (test numbers).</summary>
    private void SeedPermits()
    {
        var presets = _context.DocumentPresets.IgnoreQueryFilters().Where(p => p.TenantId == _t).ToList();
        void Doc(string preset, string number, DateOnly issued, DateOnly? expires)
        {
            var p = presets.First(x => x.Name == preset);
            _context.ComplianceDocuments.Add(new ComplianceDocument
            {
                Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _ownerId, CategoryId = p.CategoryId, PresetId = p.Id, Title = p.Name, DocumentNumber = number,
                IssuingAgency = p.DefaultIssuingAgency, IssueDate = issued, ExpiryDate = expires,
            });
        }

        Doc("BFAR Fishpond / Aquafarm Registration", "BFAR-R12-FP-TEST-0107", new DateOnly(2025, 11, 20), new DateOnly(2028, 11, 19));
        Doc("BFAR Shrimp Grow-out Farm Certification (GAqP)", "BFAR-GAQP-TEST-0031", new DateOnly(2025, 12, 10), new DateOnly(2028, 12, 9));
        Doc("Mayor's / Business Permit", "BP-TEST-2026-1184", new DateOnly(2026, 1, 15), new DateOnly(2026, 12, 31));
        Doc("Barangay Business Clearance", "BBC-TEST-2026-0412", new DateOnly(2026, 1, 10), new DateOnly(2026, 12, 31));
        Doc("Environmental Compliance Certificate (ECC)", "ECC-R12-TEST-2025-0219", new DateOnly(2025, 10, 30), null);
        Doc("BIR Certificate of Registration (Form 2303)", "BIR-TEST-412-778-905", new DateOnly(2025, 10, 5), null);
        _context.SaveChanges();
    }

    /// <summary>
    /// The partner farm's feeds by day of culture (DEC-61), from its logbook and the Nu Ri feeding guide: a fry mash powder
    /// from a brand still to be confirmed, then Nu Ri N310 to N315 (10 kg bags up to N312, 20 kg after). Costs are
    /// placeholders (PHP per kg).
    /// </summary>
    private static readonly (string Brand, string Product, string Form, decimal Pack, int FromDoc, string LotPrefix, decimal CostPhp)[] FeedCodes =
    {
        ("Other brand (to confirm)", "Fry mash", "Powder", 10m, 1, "FM", 120m),
        ("Uni-President", "Nu Ri N310", "Crumble", 10m, 4, "N310", 110m),
        ("Uni-President", "Nu Ri N311", "Crumble", 10m, 8, "N311", 105m),
        ("Uni-President", "Nu Ri N312", "Pellet", 10m, 15, "N312", 100m),
        ("Uni-President", "Nu Ri N313", "Pellet", 20m, 21, "N313", 92m),
        ("Uni-President", "Nu Ri N314", "Pellet", 20m, 41, "N314", 86m),
        ("Uni-President", "Nu Ri N315", "Pellet", 20m, 61, "N315", 80m),
    };

    /// <summary>Days at the start of each new code when it is mixed half and half with the previous code, as the farm does.</summary>
    private const int MixDays = 2;

    /// <summary>The feed code in use on a day of culture (index into <see cref="FeedCodes"/>).</summary>
    private static int Stage(int doc)
    {
        var s = 0;
        while (s + 1 < FeedCodes.Length && FeedCodes[s + 1].FromDoc <= doc) s++;
        return s;
    }

    /// <summary>A feeding's kilograms by feed code: the code in use, or half and half with the previous code while mixing.</summary>
    private static List<(int Stage, decimal Kg)> Split(int doc, decimal kg)
    {
        var s = Stage(doc);
        var half = Math.Round(kg / 2, 1);
        if (s == 0 || doc >= FeedCodes[s].FromDoc + MixDays || half <= 0)
        {
            return new List<(int, decimal)> { (s, kg) };
        }

        return new List<(int, decimal)> { (s - 1, half), (s, kg - half) };
    }

    /// <summary>Kilograms of one feed code the schedules use, split the way <see cref="FeedDay"/> splits them.</summary>
    private static decimal NeedKg(IEnumerable<List<(int Doc, decimal Kg)>> schedules, int stage) =>
        schedules.Sum(x => x.Sum(d => Portions(d.Kg).SelectMany(p => Split(d.Doc, p)).Where(p => p.Stage == stage).Sum(p => p.Kg)));

    private static decimal Packs(decimal kg, decimal pack) => Math.Ceiling(kg / pack) * pack;

    private static List<(int Doc, decimal Kg)> FeedSchedule(decimal totalKg)
    {
        var weights = Enumerable.Range(1, CultureDays - 1).Select(d => Math.Pow(d, 1.4)).ToList();
        var sum = weights.Sum();
        return weights.Select((w, i) => (i + 1, Math.Max(0.5m, Math.Round(totalKg * (decimal)(w / sum), 1)))).ToList();
    }

    private InventoryLot Receive(InventoryItem item, string lotNumber, decimal qty, decimal cost, DateOnly date)
    {
        var lot = new InventoryLot { TenantId = _t, CreatorUserId = _ownerId, ItemId = item.Id, LotNumber = lotNumber, ReceivedDate = date, ExpiryDate = date.AddDays(180), Supplier = "Feed Dealer (test)", UnitCost = cost };
        _context.InventoryLots.Add(lot);
        _context.SaveChanges();
        Move(lot, Local(date, 9), StockMovementType.Receipt, qty, null, reason: "Stock received (seed)");
        return lot;
    }

    private void Move(InventoryLot lot, DateTime at, StockMovementType type, decimal qty, Guid? batchId, Guid? sessionId = null, Guid? sourceLogId = null, string reason = null) =>
        _context.StockMovements.Add(new StockMovement
        {
            TenantId = _t, CreatorUserId = type == StockMovementType.Usage ? _techId : _ownerId, LotId = lot.Id, MovementDateUtc = at, Type = type, Quantity = qty, UnitCost = lot.UnitCost,
            BatchId = batchId, FeedingSessionId = sessionId, SourceLogId = sourceLogId, Reason = reason,
        });

    /// <summary>The partner farm's schedule (DEC-61): four feedings at 6 AM, 10 AM, 2 PM and 6 PM.</summary>
    private static readonly int[] FeedingHours = { 6, 10, 14, 18 };

    /// <summary>A day's kilograms split evenly over the four feedings (the last takes the rounding).</summary>
    private static List<decimal> Portions(decimal kg)
    {
        var each = Math.Round(kg / FeedingHours.Length, 1);
        return Enumerable.Range(1, FeedingHours.Length).Select(n => n == FeedingHours.Length ? kg - each * (FeedingHours.Length - 1) : each).ToList();
    }

    /// <summary>
    /// One day's feeding split evenly over the four feedings, as the farm's logbook does; on the first days of a new feed
    /// code each feeding mixes it with the previous code. From <paramref name="notFedFrom"/> on, the feedings are saved as
    /// Not fed (no stock drawn). Returns the kilograms fed.
    /// </summary>
    private decimal FeedDay(PondBatch batch, DateOnly day, int doc, InventoryLot[] lots, decimal kg, int? notFedFrom = null)
    {
        var portions = Portions(kg);
        var fed = 0m;
        for (var n = 1; n <= FeedingHours.Length; n++)
        {
            if (notFedFrom.HasValue && n >= notFedFrom.Value)
            {
                _context.FeedingSessions.Add(new FeedingSession
                {
                    Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _techId, BatchId = batch.Id, FeedDate = day, Session = n,
                    Status = FeedingStatus.NotFed, Notes = "Heavy rain and strong wind; feeding skipped", ClientRequestId = Guid.NewGuid(),
                });
                continue;
            }

            fed += FeedSession(batch, day, n, Split(doc, portions[n - 1]).Select(p => (lots[p.Stage], p.Kg)).ToList());
        }

        return fed;
    }

    private decimal FeedSession(PondBatch batch, DateOnly day, int feedingNo, List<(InventoryLot Lot, decimal Kg)> lines)
    {
        var hour = FeedingHours[feedingNo - 1];
        var session = new FeedingSession
        {
            Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _techId, BatchId = batch.Id, FeedDate = day, Session = feedingNo, Status = FeedingStatus.Fed,
            FedAtTime = $"{hour:00}:00", ClientRequestId = Guid.NewGuid(),
        };
        _context.FeedingSessions.Add(session);
        foreach (var (lot, kg) in lines.Where(l => l.Kg > 0))
        {
            Move(lot, Local(day, hour), StockMovementType.Usage, -kg, batch.Id, session.Id);
        }

        return lines.Sum(l => l.Kg);
    }

    private ProductionLog Log(PondBatch batch, DateTime at, LogType type, string notes = null)
    {
        var log = new ProductionLog { Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _techId, BatchId = batch.Id, PondId = batch.PondId, LogType = type, ObservedAtUtc = at, Notes = notes, ClientRequestId = Guid.NewGuid() };
        _context.ProductionLogs.Add(log);
        return log;
    }

    /// <summary>Temperature, salinity, pH and DO; TAN, nitrite and alkalinity every fourth week.</summary>
    private void Water(PondBatch batch, DateTime at, LogType type, int doc)
    {
        var log = Log(batch, at, type);
        var readings = new List<(string Code, decimal Value)>
        {
            (ParameterCodes.Temperature, 28.4m + doc % 5 * 0.3m), (ParameterCodes.Salinity, 18m + doc % 4), (ParameterCodes.PH, 7.9m + doc % 3 * 0.1m), (ParameterCodes.DO, 5.0m + doc % 4 * 0.3m),
        };
        if (doc > 0 && doc % 28 == 0)
        {
            readings.Add((ParameterCodes.Tan, 0.4m));
            readings.Add((ParameterCodes.Nitrite, 0.1m));
            readings.Add((ParameterCodes.Alkalinity, 140m));
        }

        foreach (var (code, value) in readings)
        {
            var p = _parameters[code];
            _context.WaterQualityMeasurements.Add(new WaterQualityMeasurement { Id = Guid.NewGuid(), TenantId = _t, LogId = log.Id, ParameterCode = code, Value = value, UnitCode = p.UnitCode, IsOutOfRange = p.IsOutOfOptimalRange(value), Side = p.SideOf(value) });
        }
    }

    /// <summary>
    /// 20 kg banyeras with the remainder in the last one, numbered in weighing order from <paramref name="firstNo"/> (DEC-80),
    /// all of one size grade when given (DEC-82).
    /// </summary>
    private List<HarvestCrate> CrateTally(decimal totalKg, Guid? gradeId = null, int firstNo = 1)
    {
        var crates = new List<HarvestCrate>();
        var left = totalKg;
        while (left > 0)
        {
            var kg = Math.Min(20m, left);
            crates.Add(new HarvestCrate { TenantId = _t, CrateNo = firstNo + crates.Count, Kg = kg, SizeGradeId = gradeId, ContainerTypeId = _banyera.Id, ContainerName = _banyera.Name });
            left -= kg;
        }

        return crates;
    }

    private Sale AddSale(Buyer buyer, int number, SaleLine line, string method, DateOnly paidOn, bool transport, bool interIsland = false)
    {
        var sale = new Sale
        {
            Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _ownerId, BuyerId = buyer.Id, SaleDate = HarvestDate, DispatchReceiptNo = $"DR-2026-{number:0000}",
            PaymentTerms = paidOn > HarvestDate ? (interIsland ? "Net 10 days" : "Net 7 days") : "Cash on delivery", DueDate = paidOn > HarvestDate ? HarvestDate.AddDays(interIsland ? 10 : 7) : null,
            Destination = buyer.Address, Lines = new List<SaleLine> { line },
        };
        sale.Payments.Add(new SalePayment { TenantId = _t, CreatorUserId = _ownerId, PaidOn = paidOn, Amount = line.Amount, Method = method });
        if (transport)
        {
            sale.Transporter = interIsland ? "Closed van to Makar Wharf, then RoRo ferry to Manila (test)" : "Farm truck";
            sale.DriverName = "R. Santos (test)";
            sale.PlateNo = "TST 1234";
            sale.LoadedAtUtc = Local(HarvestDate, 5);
            sale.LocalTransportPermitNo = $"LTP-R12-260418-{number:000}";
            sale.TemperatureNote = interIsland ? "Packed in ice, 0–2 °C, re-iced at the port; about two days in transit" : "Ice slurry, 0–2 °C in insulated boxes";
        }

        _context.Sales.Add(sale);
        return sale;
    }

    /// <summary>
    /// Partial harvests of the running cycle, one scenario per pond, so every harvest and sales screen has something to show
    /// (DEC-80 to DEC-86). Each is seeded only once its day has passed (the cycle is logged up to yesterday).
    /// <list type="bullet">
    /// <item>EP-01, DOC 52: graded crates split between two buyers with each sale's crates marked, a crate kept for staff use;
    /// the processor priced by count and paid half, now overdue; the market buyer from her price table, paid cash. Sold.</item>
    /// <item>CP-01, DOC 55: the processor's tubs weighed with the tub on the buyer's scale; four of five sold on credit
    /// (unpaid, not yet due), one entered twice and voided. Partly sold, one tub not accounted for.</item>
    /// <item>HP-01, DOC 57: weighed as a total only, ungraded, no buyer yet, a quality remark, and a disinfectant whose
    /// withdrawal period had not ended at harvest (the lot trace warns). Unsold.</item>
    /// </list>
    /// </summary>
    private void SeedRunningHarvests(List<PondBatch> batches, List<Pond> ponds, List<SizeGrade> grades)
    {
        var stocking = new DateOnly(2026, 9, 14);
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8)).AddDays(-1);
        SizeGrade Grade(string label) => grades.First(g => g.Label == label);
        var g100 = Grade("100/120");
        var g90 = Grade("90/100");
        var ungraded = grades.First(g => g.Label == SizeGrade.UngradedLabel);

        Harvest NewHarvest(int i, int doc, int hour, decimal abwG, int samplePieces)
        {
            var pond = ponds[i];
            var lotNo = pond.LotNumber.Value;
            var n = _lotHarvests[lotNo] = _lotHarvests.GetValueOrDefault(lotNo) + 1;
            var day = stocking.AddDays(doc);
            return new Harvest
            {
                TenantId = _t, CreatorUserId = _techId, BatchId = batches[i].Id, HarvestedAtUtc = Local(day, hour), HarvestType = HarvestType.Partial,
                LotCode = HarvestLotCoder.Format(day.Year, LotPlaces.GenSanArea, 24, 1, lotNo, n),
                AbwG = abwG, AbwSampleWeightG = Math.Round(abwG * samplePieces, 0), AbwSamplePieces = samplePieces,
                SmoothShell = true, IntactAppendages = true, NoNecrosis = true,
            };
        }

        Sale NewSale(Buyer buyer, DateOnly date, string terms, DateOnly? due, params SaleLine[] lines) => new()
        {
            Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _ownerId, BuyerId = buyer.Id, SaleDate = date, DispatchReceiptNo = $"DR-{date:yyyy}-{++_saleNo:0000}",
            PaymentTerms = terms, DueDate = due, Destination = buyer.Address, Lines = lines.ToList(),
        };

        // ---- EP-01, DOC 52: split between two buyers, crates marked per sale ----
        if (stocking.AddDays(52) <= yesterday)
        {
            var day = stocking.AddDays(52);
            var h = NewHarvest(0, 52, 4, 8.0m, 300);
            h.BuyerId = _processor.Id;
            h.WeighedBy = WeighedBy.Farm;
            // Crates 1–6 are 100/120 (114 kg), 7–9 are 90/100 (60 kg); crate 10 (6 kg) is kept for the staff.
            h.Crates = CrateTally(114m, g100.Id).Concat(CrateTally(60m, g90.Id, firstNo: 7)).ToList();
            h.Crates.Add(new HarvestCrate { TenantId = _t, CrateNo = 10, Kg = 6m, ContainerTypeId = _banyera.Id, ContainerName = _banyera.Name });
            h.TotalKg = h.Crates.Sum(c => c.Kg);
            h.Boxes = h.Crates.Count;
            h.GradeLines = new List<HarvestGradeLine>
            {
                new() { TenantId = _t, SizeGradeId = g100.Id, Kg = 114m },
                new() { TenantId = _t, SizeGradeId = g90.Id, Kg = 60m },
                new() { TenantId = _t, SizeGradeId = ungraded.Id, Kg = 6m },
            };
            h.Disposals.Add(new HarvestDisposal { TenantId = _t, Kg = 6m, Reason = DisposalReason.StaffOrHomeUse, Note = "Crate 10, shared with the farm staff" });
            _context.Harvests.Add(h);
            _context.SaveChanges();

            // Priced by count: ₱250 at 120 pcs/kg plus ₱3 for each piece fewer; 100/120 is 110 pcs/kg → ₱280.
            var byCount = SaleLine.BaseCountPrice(250m, 120m, 3m, 110m);
            var toProcessor = NewSale(_processor, day, "Net 5 days", day.AddDays(5), new SaleLine
            {
                TenantId = _t, HarvestGradeLineId = h.GradeLines[0].Id, Kg = 114m, PricePerKg = byCount, PriceMethod = PriceMethod.BaseCount,
                BasePricePerKg = 250m, BaseCountPerKg = 120m, StepPerCount = 3m, PriceCountPerKg = 110m, ReferencePricePerKg = byCount,
            });
            toProcessor.Transporter = "Farm truck";
            toProcessor.DriverName = "R. Santos (test)";
            toProcessor.PlateNo = "TST 1234";
            toProcessor.LoadedAtUtc = Local(day, 6);
            toProcessor.TemperatureNote = "Ice slurry, 0–2 °C";
            toProcessor.Payments.Add(new SalePayment { TenantId = _t, CreatorUserId = _ownerId, PaidOn = day, Amount = Math.Round(toProcessor.Total / 2m, 2), Method = "Bank transfer", Note = "Half on delivery" });

            // 90/100 is 95 pcs/kg: the "71+ pcs/kg" row of the market table.
            var row = _marketTable.Find(95m);
            var toMarket = NewSale(_market, day, "Cash on delivery", null, new SaleLine
            {
                TenantId = _t, HarvestGradeLineId = h.GradeLines[1].Id, Kg = 60m, PricePerKg = row.PricePerKg, PriceMethod = PriceMethod.Table, PriceTableId = _marketTable.Id,
                PriceTableName = _marketTable.Name, PriceTableRowLabel = row.Label, PriceCountPerKg = 95m, ReferencePricePerKg = row.PricePerKg,
            });
            toMarket.Payments.Add(new SalePayment { TenantId = _t, CreatorUserId = _ownerId, PaidOn = day, Amount = toMarket.Total, Method = "Cash" });
            _context.Sales.AddRange(toProcessor, toMarket);
            _context.SaveChanges();
            foreach (var c in h.Crates)
            {
                c.SaleId = c.SizeGradeId == g100.Id ? toProcessor.Id : c.SizeGradeId == g90.Id ? toMarket.Id : null;
            }

            _context.SaveChanges();
        }

        // ---- CP-01, DOC 55: tubs weighed with the tub, partly sold on credit, a duplicate voided ----
        if (stocking.AddDays(55) <= yesterday)
        {
            var day = stocking.AddDays(55);
            var h = NewHarvest(1, 55, 5, 9.4m, 300);
            h.BuyerId = _manila.Id;
            h.WeighedBy = WeighedBy.Buyer;
            h.Crates = Enumerable.Range(1, 5)
                .Select(n => new HarvestCrate { TenantId = _t, CrateNo = n, Kg = 25m, GrossKg = 26.2m, TareKg = _tub.TareKg, ContainerTypeId = _tub.Id, ContainerName = _tub.Name })
                .ToList();
            h.TotalKg = 125m;
            h.Boxes = 5;
            h.GradeLines = new List<HarvestGradeLine> { new() { TenantId = _t, SizeGradeId = g100.Id, Kg = 125m } };
            _context.Harvests.Add(h);
            _context.SaveChanges();

            SaleLine Line() => new() { TenantId = _t, HarvestGradeLineId = h.GradeLines[0].Id, Kg = 100m, PricePerKg = 295m };
            var duplicate = NewSale(_manila, day, "Net 30 days", day.AddDays(30), Line());
            duplicate.VoidReason = "Entered twice; the sale is on the next receipt";
            var credit = NewSale(_manila, day, "Net 30 days", day.AddDays(30), Line());
            credit.Transporter = "Closed van to Makar Wharf, then RoRo ferry to Manila (test)";
            credit.Destination = _manila.Address;
            credit.LocalTransportPermitNo = $"LTP-R12-{day:yyMMdd}-{_saleNo:000}";
            _context.Sales.AddRange(duplicate, credit);
            _context.SaveChanges();
            foreach (var c in h.Crates.Where(c => c.CrateNo <= 4))
            {
                c.SaleId = credit.Id;
            }

            duplicate.IsDeleted = true;
            duplicate.DeletionTime = Local(day, 14);
            duplicate.DeleterUserId = _ownerId;
            _context.SaveChanges();
        }

        // ---- HP-01, DOC 57: total only, ungraded, unsold; a treatment still withdrawing at harvest ----
        if (stocking.AddDays(57) <= yesterday)
        {
            var day = stocking.AddDays(57);
            var batch = batches[2];
            var disinfectant = new InventoryItem
            {
                TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.Chemical, Brand = "AquaTest", ProductName = "Iodine water disinfectant (test)",
                ActiveIngredient = "Povidone-iodine", DefaultWithdrawalDays = 7, Unit = "L", ReorderLevel = 2, PackSize = 1m,
            };
            _context.InventoryItems.Add(disinfectant);
            _context.SaveChanges();
            var lot = Receive(disinfectant, "IOD-261101", 10m, 650m, new DateOnly(2026, 11, 1) <= yesterday ? new DateOnly(2026, 11, 1) : yesterday);
            var log = Log(batch, Local(stocking.AddDays(54), 10), LogType.ChemicalApplication);
            _context.ChemicalApplicationDetails.Add(new ChemicalApplicationDetail
            {
                Id = log.Id, TenantId = _t, Reason = "High Vibrio count after heavy rain", Dosage = 1m, DosageUnit = "L/1000 m²", Method = "Diluted, broadcast over the pond",
                WithdrawalDays = 7,
            });
            Move(lot, log.ObservedAtUtc, StockMovementType.Usage, -1m, batch.Id, sourceLogId: log.Id);

            var h = NewHarvest(2, 57, 15, 10.1m, 300);
            h.WeighedBy = WeighedBy.Farm;
            h.TotalKg = 85m;
            h.Boxes = 5;
            h.NoNecrosis = false;
            h.QualityNotes = "A few soft shells and tail necrosis in the sample; harvested early ahead of the rain.";
            h.GradeLines = new List<HarvestGradeLine> { new() { TenantId = _t, SizeGradeId = ungraded.Id, Kg = 85m } };
            _context.Harvests.Add(h);
            _context.SaveChanges();
        }
    }
}
