using Abp.UI;
using Capstone.Domain;
using Capstone.Harvests;
using Capstone.Logbooks;
using Capstone.Logbooks.Dto;
using Capstone.Production;
using Capstone.Reports;
using Capstone.Sales;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>
/// DEC-84: the trace report for one harvest lot code. It is the batch trace (DEC-72) limited to one harvest: feed up to the
/// harvest day, treatments up to the harvest time with a withdrawal check against the harvest date, and only that
/// harvest's sales, not-sold and not-accounted-for kg. The pilot farm is in Maasim, Sarangani, so its harvests get lot codes.
/// </summary>
public class LotTrace_Tests : FpmsTestBase
{
    private static DateOnly Today => FarmClock.Today(FarmClock.Resolve(FarmClock.DefaultTimeZone));

    private TraceAppService Trace => Resolve<TraceAppService>();

    private Guid Ungraded => Q(c => c.SizeGrades.IgnoreQueryFilters().Single(g => g.Label == SizeGrade.UngradedLabel && g.TenantId == GetTenantId(PilotFarm)).Id);

    private Guid Buyer => Q(c => c.Buyers.IgnoreQueryFilters().First(b => b.Name.StartsWith("GenSan")).Id);

    private SaveHarvestInput Harvest(DateTime at, decimal kg) => new()
    {
        BatchId = BatchId(CurrentBatch), HarvestedAt = at, HarvestType = HarvestType.Partial, TotalKg = kg,
        GradeLines = new() { new() { SizeGradeId = Ungraded, Kg = kg } },
    };

    private Task<SaveLogResultDto> Treatment(DateTime at, int withdrawalDays) => Resolve<LogAppService>().Create(new SaveLogInput
    {
        BatchId = BatchId(CurrentBatch), LogType = LogType.ChemicalApplication, ObservedAt = at, ClientRequestId = Guid.NewGuid(),
        ChemicalApplication = new ChemicalApplicationInput { Reason = "Treatment", WithdrawalDays = withdrawalDays, Usages = new() { new() { LotId = LotId(LimeLot), Quantity = 5 } } },
    });

    [Fact]
    public void Typed_lot_codes_are_tidied_before_the_lookup()
    {
        TraceAppService.NormalizeLotCode(" 26-0-24-03-07-02 ").ShouldBe("26-0-24-03-07-02");
        TraceAppService.NormalizeLotCode("26 0 24 03 07 02").ShouldBe("26-0-24-03-07-02");
        TraceAppService.NormalizeLotCode("26–0–24–03–07–02").ShouldBe("26-0-24-03-07-02"); // en dash from a word processor
        TraceAppService.NormalizeLotCode("   ").ShouldBeNull();
    }

    [Fact]
    public async Task An_unknown_or_empty_lot_code_says_so()
    {
        (await Should.ThrowAsync<UserFriendlyException>(() => Trace.GetLotTrace("99-9-99-99-99-99"))).Message.ShouldContain("No harvest has the lot code");
        await Should.ThrowAsync<UserFriendlyException>(() => Trace.GetLotTrace(""));
    }

    [Fact]
    public async Task A_lot_lists_only_its_own_harvest_and_sales()
    {
        var first = await Resolve<TallySheetAppService>().Save(new SaveTallySheetInput
        {
            Harvest = WithBuyer(Harvest(DateTime.UtcNow.AddHours(-3), 120)),
            Sale = new TallySaleInput { PricePerKg = 220, PaymentTerms = "Cash on harvest" },
        });
        var second = await Resolve<HarvestAppService>().Create(Harvest(DateTime.UtcNow.AddHours(-1), 80));
        first.Harvest.LotCode.ShouldNotBeNull();

        var lot = await Trace.GetLotTrace(first.Harvest.LotCode);
        lot.LotCode.ShouldBe(first.Harvest.LotCode);
        lot.LotHarvestId.ShouldBe(first.Harvest.Id);
        lot.BatchCode.ShouldBe(CurrentBatch);
        lot.FrySource.ShouldNotBeNull(); // a lot shares its batch's origin
        lot.Harvests.Single().HarvestId.ShouldBe(first.Harvest.Id);
        lot.HarvestedKg.ShouldBe(120m);
        lot.SoldKg.ShouldBe(120m);
        lot.UnaccountedKg.ShouldBe(0m);
        lot.Sales.ShouldAllBe(s => s.SaleId == first.Sale.Id);

        // The unsold second harvest has its own sheet; the batch sheet still covers both.
        var other = await Trace.GetLotTrace(second.LotCode);
        other.Sales.ShouldBeEmpty();
        other.UnaccountedKg.ShouldBe(80m);
        var batch = await Trace.GetBatchTrace(BatchId(CurrentBatch));
        batch.LotCode.ShouldBeNull();
        batch.Harvests.Select(h => h.HarvestId).ShouldContain(first.Harvest.Id);
        batch.Harvests.Select(h => h.HarvestId).ShouldContain(second.Id);
    }

    [Fact]
    public async Task Feed_given_after_the_harvest_day_is_left_out()
    {
        var harvest = await Resolve<HarvestAppService>().Create(Harvest(DateTime.UtcNow.AddHours(-30), 50));
        var lotBefore = (await Trace.GetLotTrace(harvest.LotCode)).FeedLots.Sum(l => l.Kg);
        var batchBefore = (await Trace.GetBatchTrace(BatchId(CurrentBatch))).FeedLots.Sum(l => l.Kg);

        await Resolve<FeedingAppService>().Save(new SaveFeedingSessionInput
        {
            BatchId = BatchId(CurrentBatch), FeedDate = Today, Session = 2, ClientRequestId = Guid.NewGuid(),
            Lines = new() { new() { LotId = LotId(FeedLot), Kg = 25m } },
        });

        var lot = await Trace.GetLotTrace(harvest.LotCode);
        lot.LotHarvestDate.ShouldNotBeNull();
        lot.LotHarvestDate.Value.ShouldBeLessThan(Today);
        lot.FeedLots.Sum(l => l.Kg).ShouldBe(lotBefore);
        lot.FeedLots.ShouldAllBe(l => l.LastFedOn == null || l.LastFedOn <= lot.LotHarvestDate);
        (await Trace.GetBatchTrace(BatchId(CurrentBatch))).FeedLots.Sum(l => l.Kg).ShouldBe(batchBefore + 25m);
    }

    [Fact]
    public async Task Treatments_stop_at_the_harvest_and_an_unfinished_withdrawal_is_flagged()
    {
        await Treatment(DateTime.UtcNow.AddHours(-30), withdrawalDays: 7); // still withdrawing at harvest
        var harvest = await Resolve<HarvestAppService>().Create(Harvest(DateTime.UtcNow.AddHours(-2), 60));
        await Treatment(DateTime.UtcNow.AddMinutes(-30), withdrawalDays: 3);            // after the harvest: not in this lot

        var lot = await Trace.GetLotTrace(harvest.LotCode);
        lot.Treatments.ShouldAllBe(t => t.Date <= lot.LotHarvestDate);
        lot.Treatments.ShouldNotContain(t => t.WithdrawalDays == 3);
        var flagged = lot.Treatments.Where(t => t.WithdrawalNotMet).ToList();
        flagged.ShouldContain(t => t.WithdrawalDays == 7);
        flagged.ShouldAllBe(t => t.EarliestSafeHarvestDate > lot.LotHarvestDate);
        lot.WithdrawalNotMetCount.ShouldBe(flagged.Count);

        // The batch sheet keeps every treatment and does not run the per-lot check.
        var batch = await Trace.GetBatchTrace(BatchId(CurrentBatch));
        batch.Treatments.ShouldContain(t => t.WithdrawalDays == 3);
        batch.WithdrawalNotMetCount.ShouldBe(0);
    }

    private SaveHarvestInput WithBuyer(SaveHarvestInput input)
    {
        input.BuyerId = Buyer;
        input.WeighedBy = WeighedBy.Buyer;
        return input;
    }
}
