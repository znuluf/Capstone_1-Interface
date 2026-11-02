using Abp.Events.Bus;
using Abp.Events.Bus.Entities;
using Capstone.EntityFrameworkCore;
using Capstone.EntityFrameworkCore.Seed.Development;
using Capstone.Farms;
using Capstone.Inventory;
using Capstone.Production;
using Capstone.Reports;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>
/// The second Codespace sample farm (KIAMBA-INTENSIVE): seeds cleanly, follows the DEC-75 code formats, and reads
/// correctly through the app's own services (stock, Close Batch check, trace report, cycle report).
/// </summary>
public class SampleFarms_Tests : FpmsTestBase
{
    private const string Farm = IntensiveSampleBuilder.FarmCode;

    public SampleFarms_Tests()
    {
        AbpSession.TenantId = null;
        UsingDbContext(context =>
        {
            Normalize(context);
            new IntensiveSampleBuilder(context).Create();
        });
        LoginAsTenant(Farm, "rsantos");
    }

    private static void Normalize(CapstoneDbContext context)
    {
        context.EntityChangeEventHelper = NullEntityChangeEventHelper.Instance;
        context.EventBus = NullEventBus.Instance;
        context.SuppressAutoSetTenantId = true;
    }

    private int TenantId => GetTenantId(Farm);

    private Guid Batch(string code) => Q(c => c.PondBatches.IgnoreQueryFilters().Single(b => b.TenantId == TenantId && b.BatchCode == code).Id);

    [Fact]
    public void Codes_and_usernames_follow_the_suggested_formats()
    {
        Farm.ShouldBe(AccountNameGenerator.FarmCodeBase("Kiamba Intensive Shrimp Farm (test)"));
        var t = TenantId;
        var users = Q(c => c.Users.IgnoreQueryFilters().Where(u => u.TenantId == t).ToList());
        users.Select(u => u.UserName).OrderBy(x => x).ShouldBe(new[] { "agarcia", "bvillanueva", "mreyes", "rsantos" });
        users.ShouldAllBe(u => u.UserName == AccountNameGenerator.UserNameBase(u.Name, u.Surname));
        users.Single(u => u.UserName == "bvillanueva").IsActive.ShouldBeFalse();
    }

    [Fact]
    public void Four_cycles_cover_about_a_year_in_every_state()
    {
        var t = TenantId;
        var cycles = Q(c => c.ProductionCycles.IgnoreQueryFilters().Where(x => x.TenantId == t).OrderBy(x => x.CycleCode).ToList());
        cycles.Select(x => x.CycleCode).ShouldBe(new[] { "2025-11-SBH-01", "2026-03-SBH-01", "2026-07-SBH-01", "2026-10-KCH-01" });
        cycles.Count(x => x.Status == CycleStatus.Closed).ShouldBe(2);

        var batches = Q(c => c.PondBatches.IgnoreQueryFilters().Where(x => x.TenantId == t).ToList()).ToDictionary(b => b.BatchCode);
        batches.Count.ShouldBe(8);
        batches["2026-07-SBH-01-A"].Status.ShouldBe(BatchStatus.Harvested);
        batches["2026-10-KCH-01-A"].Status.ShouldBe(BatchStatus.Stocked);
        Q(c => c.BatchFailures.IgnoreQueryFilters().Count(f => f.TenantId == t)).ShouldBe(1);

        // Closed, harvested batches carry plausible final indicators.
        foreach (var code in new[] { "2025-11-SBH-01-A", "2025-11-SBH-01-B", "2026-03-SBH-01-A" })
        {
            var b = batches[code];
            b.Status.ShouldBe(BatchStatus.Closed);
            b.SurvivalRatePct.Value.ShouldBeInRange(70m, 95m);
            b.FinalFcr.Value.ShouldBeInRange(1.1m, 1.6m);
            b.CultureDays.Value.ShouldBeInRange(100, 112);
        }
    }

    [Fact]
    public void No_lot_goes_below_zero()
    {
        var t = TenantId;
        var balances = Q(c => c.StockMovements.IgnoreQueryFilters().Where(m => m.TenantId == t).GroupBy(m => m.LotId).Select(g => g.Sum(m => m.Quantity)).ToList());
        balances.ShouldNotBeEmpty();
        balances.ShouldAllBe(b => b >= 0m);
    }

    [Fact]
    public async Task Close_check_lists_the_flagged_lot_and_the_kg_not_sold_or_not_accounted_for()
    {
        var a = await Resolve<BatchAppService>().GetCloseCheck(Batch("2026-07-SBH-01-A"));
        a.FlaggedLots.ShouldNotBeEmpty();
        a.NotSoldKg.ShouldBe(10m);
        a.UnaccountedKg.ShouldBe(0m);

        var b = await Resolve<BatchAppService>().GetCloseCheck(Batch("2026-07-SBH-01-B"));
        b.UnaccountedKg.ShouldBe(5m);
    }

    [Fact]
    public async Task Trace_of_the_failed_batch_shows_the_treatment_and_the_salvage_not_sold()
    {
        var trace = await Resolve<TraceAppService>().GetBatchTrace(Batch("2026-03-SBH-01-B"));
        var otc = trace.Treatments.Single(x => x.WithdrawalDays == 30);
        otc.EarliestSafeHarvestDate.ShouldBe(new DateOnly(2026, 5, 28));
        trace.Harvests.Single().TotalKg.ShouldBe(180m);
        trace.Disposals.Sum(x => x.Kg).ShouldBe(180m);
        trace.Sales.ShouldBeEmpty();
        trace.FeedingSessionsFed.ShouldBeGreaterThan(80);
    }

    [Fact]
    public async Task Cycle_report_reads_the_closed_cycle_with_a_failed_batch()
    {
        var t = TenantId;
        var cycleId = Q(c => c.ProductionCycles.IgnoreQueryFilters().Single(x => x.TenantId == t && x.CycleCode == "2026-03-SBH-01").Id);
        var report = await Resolve<ReportAppService>().GetCyclePerformance(cycleId);
        report.CycleCode.ShouldBe("2026-03-SBH-01");
        report.Status.ShouldBe(CycleStatus.Closed);
    }

    [Fact]
    public void Seeding_again_changes_nothing()
    {
        var t = TenantId;
        int Count() => Q(c => c.ProductionLogs.IgnoreQueryFilters().Count(l => l.TenantId == t) + c.FeedingSessions.IgnoreQueryFilters().Count(s => s.TenantId == t));
        var before = Count();
        before.ShouldBeGreaterThan(1000);

        AbpSession.TenantId = null;
        UsingDbContext(context =>
        {
            Normalize(context);
            new IntensiveSampleBuilder(context).Create();
        });
        Count().ShouldBe(before);
    }
}
