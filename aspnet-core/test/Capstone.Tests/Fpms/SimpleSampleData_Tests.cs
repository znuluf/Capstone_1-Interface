using Abp.Events.Bus;
using Abp.Events.Bus.Entities;
using Capstone.EntityFrameworkCore.Seed.Development;
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
        ponds.Select(p => p.PondCode).OrderBy(c => c).ShouldBe(new[] { "CP-01", "EP-01", "HP-01" });
        ponds.ShouldAllBe(p => p.Status == PondDisplayStatus.InProduction);

        var cycles = Q(c => c.ProductionCycles.IgnoreQueryFilters().Where(x => x.TenantId == _farm).ToList());
        cycles.Single(x => x.CycleCode == "2026-02-GSH-01").Status.ShouldBe(CycleStatus.Closed);
        cycles.Single(x => x.CycleCode == "2026-09-SNA-01").Status.ShouldBe(CycleStatus.Active);

        var batches = Q(c => c.PondBatches.IgnoreQueryFilters().Where(b => b.TenantId == _farm).ToList());
        batches.Count.ShouldBe(6);
        batches.Count(b => b.Status == BatchStatus.Stocked).ShouldBe(3);
        batches.Where(b => b.Status != BatchStatus.Stocked).ShouldAllBe(b => b.Status == BatchStatus.Closed && b.CultureDays == 75 && b.TotalHarvestKg > 0 && b.FarmingSystemAtStocking == FarmingSystem.Intensive);
        batches.ShouldAllBe(b => b.FarmingSystemAtStocking == FarmingSystem.Intensive && b.DensityFlag == DensityFlag.Within);

        Q(c => c.Users.IgnoreQueryFilters().Count(u => u.TenantId == _farm)).ShouldBe(3);
        Q(c => c.Sales.IgnoreQueryFilters().Count(s => s.TenantId == _farm)).ShouldBe(6);
        Q(c => c.Buyers.IgnoreQueryFilters().Count(b => b.TenantId == _farm)).ShouldBe(3);
        var hatcheries = Q(c => c.HatcherySources.IgnoreQueryFilters().Where(h => h.TenantId == _farm).ToList());
        hatcheries.Count.ShouldBe(3);
        hatcheries.ShouldAllBe(h => h.AccreditationStatus == Capstone.Resources.AccreditationStatus.Accredited);
        Q(c => c.ComplianceDocuments.IgnoreQueryFilters().Count(d => d.TenantId == _farm)).ShouldBe(6);
    }
}
