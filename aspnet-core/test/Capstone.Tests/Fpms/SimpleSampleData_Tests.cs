using Abp.Events.Bus;
using Abp.Events.Bus.Entities;
using Capstone.EntityFrameworkCore.Seed.Development;
using Capstone.Harvests;
using Capstone.Sales;
using Capstone.Ponds;
using Capstone.Production;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>The small Codespace sample farm (FPMS_Simple): one closed intensive cycle in three ponds, one per construction type.</summary>
public class SimpleSampleData_Tests : FpmsTestBase
{
    private readonly int _farm;

    public SimpleSampleData_Tests()
    {
        UsingDbContext(null, context =>
        {
            context.EntityChangeEventHelper = NullEntityChangeEventHelper.Instance;
            context.EventBus = NullEventBus.Instance;
            context.SuppressAutoSetTenantId = true;
            new SimpleSampleDataBuilder(context).Create();
            new SimpleSampleDataBuilder(context).Create(); // a second run adds nothing
        });
        _farm = GetTenantId(SimpleSampleDataBuilder.FarmCode);
        LoginAsTenant(SimpleSampleDataBuilder.FarmCode, "arkabubba");
    }

    [Fact]
    public async Task A_closed_and_a_running_intensive_cycle_in_three_ponds()
    {
        var ponds = await Resolve<PondAppService>().GetAll(includeArchived: true);
        ponds.Select(p => p.PondCode).OrderBy(c => c).ShouldBe(new[] { "CP-01", "EP-01", "EP-02", "HP-01", "HP-02" });
        ponds.Where(p => p.PondCode.EndsWith("-01")).ShouldAllBe(p => p.Status == PondDisplayStatus.InProduction);
        ponds.Where(p => p.PondCode.EndsWith("-02")).ShouldAllBe(p => p.Status == PondDisplayStatus.Prepared);

        // A received delivery not stocked yet, ready for "Stock a batch".
        var waiting = Q(c => c.FryDeliveries.IgnoreQueryFilters().Where(d => d.TenantId == _farm && d.HatcheryBatchNumber.StartsWith("RDX-")).ToList());
        waiting.Count.ShouldBe(1);
        Q(c => c.ProductionCycles.IgnoreQueryFilters().Any(x => x.FryDeliveryId == waiting[0].Id)).ShouldBeFalse();

        var cycles = Q(c => c.ProductionCycles.IgnoreQueryFilters().Where(x => x.TenantId == _farm).ToList());
        cycles.Single(x => x.CycleCode == "2026-02-GSH-01").Status.ShouldBe(CycleStatus.Closed);
        cycles.Single(x => x.CycleCode == "2026-09-SNA-01").Status.ShouldBe(CycleStatus.Active);

        var batches = Q(c => c.PondBatches.IgnoreQueryFilters().Where(b => b.TenantId == _farm).ToList());
        batches.Count.ShouldBe(6);
        batches.Count(b => b.Status == BatchStatus.Stocked).ShouldBe(3);
        batches.Where(b => b.Status != BatchStatus.Stocked).ShouldAllBe(b => b.Status == BatchStatus.Closed && b.CultureDays == 75 && b.TotalHarvestKg > 0 && b.FarmingSystemAtStocking == FarmingSystem.Intensive);
        batches.ShouldAllBe(b => b.FarmingSystemAtStocking == FarmingSystem.Intensive && b.DensityFlag == DensityFlag.Within);

        Q(c => c.Users.IgnoreQueryFilters().Count(u => u.TenantId == _farm)).ShouldBe(3);
        // Six from the closed cycle and four from the running cycle's partial harvests, one of them voided.
        Q(c => c.Sales.IgnoreQueryFilters().Count(s => s.TenantId == _farm)).ShouldBe(10);
        Q(c => c.Sales.Count(s => s.TenantId == _farm)).ShouldBe(9);
        Q(c => c.Buyers.IgnoreQueryFilters().Count(b => b.TenantId == _farm)).ShouldBe(3);
        var hatcheries = Q(c => c.HatcherySources.IgnoreQueryFilters().Where(h => h.TenantId == _farm).ToList());
        hatcheries.Count.ShouldBe(3);
        hatcheries.ShouldAllBe(h => h.AccreditationStatus == Capstone.Resources.AccreditationStatus.Accredited);
        Q(c => c.ComplianceDocuments.IgnoreQueryFilters().Count(d => d.TenantId == _farm)).ShouldBe(6);
    }

    [Fact]
    public async Task A_missing_SFSC_is_listed_at_close_and_on_the_trace_report()
    {
        var running = Q(c => c.PondBatches.IgnoreQueryFilters().Where(b => b.TenantId == _farm && b.Status == BatchStatus.Stocked).Select(b => b.Id).First());
        var closed = Q(c => c.PondBatches.IgnoreQueryFilters().Where(b => b.TenantId == _farm && b.Status == BatchStatus.Closed).Select(b => b.Id).First());

        (await Resolve<BatchAppService>().GetCloseCheck(running)).SfscMissing.ShouldBeTrue();
        (await Resolve<BatchAppService>().GetCloseCheck(closed)).SfscMissing.ShouldBeFalse();
        (await Resolve<Capstone.Reports.TraceAppService>().GetBatchTrace(running)).FrySource.SfscMissing.ShouldBeTrue();
        (await Resolve<Capstone.Reports.TraceAppService>().GetBatchTrace(closed)).FrySource.SfscMissing.ShouldBeFalse();
    }

    /// <summary>The running cycle's partial harvests cover the harvest and sales scenarios (DEC-80 to DEC-86).</summary>
    [Fact]
    public async Task The_partial_harvests_cover_the_harvest_and_sales_scenarios()
    {
        var harvests = (await Resolve<HarvestAppService>().GetList(new GetHarvestsInput { MaxResultCount = 100 })).Items;
        harvests.Count.ShouldBe(6);
        var ep = harvests.Single(h => h.PondCode == "EP-01" && h.HarvestType == HarvestType.Partial);
        var cp = harvests.Single(h => h.PondCode == "CP-01" && h.HarvestType == HarvestType.Partial);
        var hp = harvests.Single(h => h.PondCode == "HP-01" && h.HarvestType == HarvestType.Partial);

        ep.SaleStatus.ShouldBe(HarvestSaleStatus.Sold);
        ep.NotSoldKg.ShouldBe(6m);
        ep.LotCode.ShouldEndWith("-02");
        cp.SaleStatus.ShouldBe(HarvestSaleStatus.PartlySold);
        cp.UnaccountedKg.ShouldBe(25m); // the voided duplicate does not count
        hp.SaleStatus.ShouldBe(HarvestSaleStatus.Unsold);

        // Each buyer's receipt lists its own crates; the staff crate is on none.
        var epCrates = (await Resolve<HarvestAppService>().Get(ep.Id)).Crates;
        epCrates.Count(c => c.SaleId == null).ShouldBe(1);
        var sales = Resolve<SaleAppService>();
        foreach (var saleId in epCrates.Where(c => c.SaleId != null).Select(c => c.SaleId.Value).Distinct())
        {
            var sale = await sales.Get(saleId);
            sale.Crates.Sum(c => c.Kg).ShouldBe(sale.TotalKg);
        }

        (await sales.GetAll(new GetSalesInput { OverdueOnly = true, MaxResultCount = 100 })).Items.ShouldNotBeEmpty();
        (await Resolve<Capstone.Reports.TraceAppService>().GetLotTrace(hp.LotCode)).WithdrawalNotMetCount.ShouldBe(1);
    }
}
