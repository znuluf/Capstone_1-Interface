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
/// harvest 18 Apr 2026 (DOC 75), sold the same day, ponds cleaned and the cycle closed by 30 Apr 2026. The ponds then
/// stand idle through the lean season (May to June). A second cycle, stocked 14 Sep 2026, is running and logged up to the
/// day before the seed date (harvest planned 28 Nov 2026). No real farm or personal data.
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
        _context.ContainerTypes.AddRange(_banyera,
            new ContainerType { Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _ownerId, Name = "Tub 25 kg – Mindanao Processing", NominalKg = 25m, TareKg = 1.2m, SortOrder = 2 });

        InventoryItem Feed(string stage, string spec, string bai) => new()
        {
            TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.Feed, Brand = "TestFeed", ProductName = $"Vannamei {stage} {spec}", FeedType = stage,
            BaiRegistrationNo = bai, Unit = "kg", ReorderLevel = 100, PackSize = 25m,
        };
        var feeds = new[] { Feed("Starter", "40-42% CP crumble", "BAI-TEST-0001"), Feed("Grower", "38-40% CP pellet", "BAI-TEST-0002"), Feed("Finisher", "36-38% CP pellet", "BAI-TEST-0003") };
        var probiotic = new InventoryItem { TenantId = _t, CreatorUserId = _ownerId, Category = InventoryCategory.AdditiveSupplement, Brand = "AquaTest", ProductName = "Bacillus probiotic", Unit = "kg", ReorderLevel = 2, PackSize = 1m };
        _context.InventoryItems.AddRange(feeds);
        _context.InventoryItems.Add(probiotic);
        _context.SaveChanges();

        // ---- PL per pond and the feed each needs: total feed = harvest x FCR, rising with the shrimp ----
        var pls = Plans.Select((p, i) => (long)(ponds[i].AreaM2 * p.Density)).ToArray();
        var schedules = Plans.Select((p, i) => FeedSchedule(pls[i] * p.Survival * p.AbwG / 1000m * p.Fcr)).ToArray();
        var lots = new InventoryLot[3];
        var costs = new[] { 96m, 82m, 76m };
        var received = new[] { new DateOnly(2026, 1, 25), new DateOnly(2026, 2, 15), new DateOnly(2026, 3, 20) };
        for (var s = 0; s < 3; s++)
        {
            var need = schedules.Sum(x => x.Where(d => Stage(d.Doc) == s).Sum(d => d.Kg));
            lots[s] = Receive(feeds[s], $"{new[] { "ST", "GR", "FN" }[s]}-{received[s]:yyMMdd}", Math.Ceiling(need / 25m) * 25m + 25m, costs[s], received[s]);
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
        var saleNo = 0;

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

            // ---- Logs: pre-stocking water, AM/PM feeding, weekly water, fortnightly growth, probiotic, two mortality entries ----
            var facts = new BatchFacts { PlCountStocked = pl, PondAreaM2 = pond.AreaM2, StockingDate = Stocking };
            Water(batch, Local(Stocking.AddDays(-1), 16), LogType.PreStockingWaterQuality, 0);
            foreach (var (doc, kg) in schedules[i])
            {
                var lot = lots[Stage(doc)];
                var am = Math.Round(kg * 0.45m, 1);
                facts.CumulativeFeedKg += FeedSession(batch, Stocking.AddDays(doc), FeedingSessionTime.AM, lot, am);
                if (doc == RainDoc)
                {
                    // Heavy rain: the PM feeding was skipped (a common weather problem in the interviews).
                    _context.FeedingSessions.Add(new FeedingSession
                    {
                        Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _techId, BatchId = batch.Id, FeedDate = Stocking.AddDays(doc), Session = FeedingSessionTime.PM,
                        Status = FeedingStatus.NotFed, Notes = "Heavy rain and strong wind; feeding skipped", ClientRequestId = Guid.NewGuid(),
                    });
                    continue;
                }

                facts.CumulativeFeedKg += FeedSession(batch, Stocking.AddDays(doc), FeedingSessionTime.PM, lot, kg - am);
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
                AbwSampleWeightG = plan.AbwG * 400m, AbwSamplePieces = 400, Crates = CrateTally(harvestKg),
                GradeLines = new List<HarvestGradeLine>
                {
                    new() { TenantId = _t, SizeGradeId = grade6070.Id, Kg = harvestKg - kg5060 },
                    new() { TenantId = _t, SizeGradeId = grade5060.Id, Kg = kg5060 },
                },
            };
            _context.Harvests.Add(harvest);
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

            AddSale(toManila ? manila : processor, ++saleNo, line6070, "Bank transfer", HarvestDate.AddDays(toManila ? 10 : 6), transport: true, toManila);
            // 50/60 is 55 pcs/kg in the middle: the "51–60 pcs/kg" row of the market table, ₱380.
            var row = _marketTable.Find(55m);
            AddSale(market, ++saleNo, new SaleLine
            {
                TenantId = _t, HarvestGradeLineId = g5060.Id, Kg = g5060.Kg, PricePerKg = row.PricePerKg, PriceMethod = PriceMethod.Table, PriceTableId = _marketTable.Id,
                PriceTableName = _marketTable.Name, PriceTableRowLabel = row.Label, PriceCountPerKg = 55m, ReferencePricePerKg = row.PricePerKg,
            }, "Cash", HarvestDate, transport: false);

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
        SeedRunningCycle(ponds, pls, stoNino, stoNinoHealth, feeds, probiotic);
        SeedReadyToStock(rdex);

        _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.CycleCode, Scope = "2026-02-GSH", NextValue = 2 });
        _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.CycleCode, Scope = "2026-09-SNA", NextValue = 2 });
        _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.DispatchReceipt, Scope = "2026", NextValue = saleNo + 1 });
        // Each harvested pond had its 1st harvest of 2026 (DEC-83); the next one is 02.
        foreach (var n in Enumerable.Range(1, Plans.Length))
        {
            _context.NumberSequences.Add(new NumberSequence { Id = Guid.NewGuid(), TenantId = _t, SequenceType = NumberSequenceType.HarvestLot, Scope = $"P{n}-2026", NextValue = 2 });
        }
        _context.SaveChanges();
    }

    /// <summary>
    /// The running cycle: the same three ponds prepared 1 to 11 Sep 2026 and stocked 14 Sep 2026, logged up to the day
    /// before the seed date (at most DOC 74), with the day-75 harvest planned for 28 Nov 2026. No harvest yet.
    /// </summary>
    private void SeedRunningCycle(List<Pond> ponds, long[] pls, HatcherySource hatchery, HatcheryCertificate certificate, InventoryItem[] feeds, InventoryItem probiotic)
    {
        var stocking = new DateOnly(2026, 9, 14);
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8)).AddDays(-1);
        var lastDoc = Math.Clamp(yesterday.DayNumber - stocking.DayNumber, 0, CultureDays - 1);

        var schedules = Plans.Select((p, i) => FeedSchedule(pls[i] * p.Survival * p.AbwG / 1000m * p.Fcr).Where(d => d.Doc <= lastDoc).ToList()).ToArray();
        var received = new[] { new DateOnly(2026, 9, 4), new DateOnly(2026, 9, 28), new DateOnly(2026, 11, 1) };
        var costs = new[] { 98m, 84m, 78m };
        var lots = new InventoryLot[3];
        for (var s = 0; s < 3; s++)
        {
            // Enough for the days logged plus stock on hand for the rest of the culture.
            var need = schedules.Sum(x => x.Where(d => Stage(d.Doc) == s).Sum(d => d.Kg));
            var onHand = Stage(lastDoc + 1) <= s ? 500m : 0m;
            var date = received[s] <= yesterday ? received[s] : yesterday;
            lots[s] = Receive(feeds[s], $"{new[] { "ST", "GR", "FN" }[s]}-{date:yyMMdd}", Math.Ceiling(need / 25m) * 25m + 25m + onHand, costs[s], date);
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
            _context.SaveChanges();

            Water(batch, Local(stocking.AddDays(-1), 16), LogType.PreStockingWaterQuality, 0);
            foreach (var (doc, kg) in schedules[i])
            {
                var am = Math.Round(kg * 0.45m, 1);
                FeedSession(batch, stocking.AddDays(doc), FeedingSessionTime.AM, lots[Stage(doc)], am);
                FeedSession(batch, stocking.AddDays(doc), FeedingSessionTime.PM, lots[Stage(doc)], kg - am);
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
            PlReceived = 303000, CostPhp = Math.Round(303000 * 0.34m, 0), PlHealthCertificateNo = $"PLHC-{today:yyyyMMdd}", TransportPermitNo = $"DTP-{today:yyyyMMdd}-RDX",
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

    private static int Stage(int doc) => doc <= 20 ? 0 : doc <= 50 ? 1 : 2;

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

    private decimal FeedSession(PondBatch batch, DateOnly day, FeedingSessionTime time, InventoryLot lot, decimal kg)
    {
        var session = new FeedingSession
        {
            Id = Guid.NewGuid(), TenantId = _t, CreatorUserId = _techId, BatchId = batch.Id, FeedDate = day, Session = time, Status = FeedingStatus.Fed,
            FedAtTime = time == FeedingSessionTime.AM ? "07:00" : "17:00", ClientRequestId = Guid.NewGuid(),
        };
        _context.FeedingSessions.Add(session);
        Move(lot, Local(day, time == FeedingSessionTime.AM ? 7 : 17), StockMovementType.Usage, -kg, batch.Id, session.Id);
        return kg;
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

    /// <summary>20 kg banyeras with the remainder in the last one, numbered in weighing order (DEC-80).</summary>
    private List<HarvestCrate> CrateTally(decimal totalKg)
    {
        var crates = new List<HarvestCrate>();
        var left = totalKg;
        while (left > 0)
        {
            var kg = Math.Min(20m, left);
            crates.Add(new HarvestCrate { TenantId = _t, CrateNo = crates.Count + 1, Kg = kg, ContainerTypeId = _banyera.Id, ContainerName = _banyera.Name });
            left -= kg;
        }

        return crates;
    }

    private void AddSale(Buyer buyer, int number, SaleLine line, string method, DateOnly paidOn, bool transport, bool interIsland = false)
    {
        var sale = new Sale
        {
            TenantId = _t, CreatorUserId = _ownerId, BuyerId = buyer.Id, SaleDate = HarvestDate, DispatchReceiptNo = $"DR-2026-{number:0000}",
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
    }
}
