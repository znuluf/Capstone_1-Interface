using Abp.Events.Bus;
using Abp.Events.Bus.Entities;
using Capstone.EntityFrameworkCore.Seed.Development;
using Capstone.Farms;
using Capstone.Ponds;
using Capstone.Production;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>The Codespace sample farm (FPMS_Sample): it seeds without errors and shows what the list and pond pages need.</summary>
public class SampleData_Tests : FpmsTestBase
{
    private readonly int _farm;

    public SampleData_Tests()
    {
        UsingDbContext(null, context =>
        {
            context.EntityChangeEventHelper = NullEntityChangeEventHelper.Instance;
            context.EventBus = NullEventBus.Instance;
            context.SuppressAutoSetTenantId = true;
            new SampleDataBuilder(context).Create();
        });
        _farm = GetTenantId(SampleDataBuilder.FarmCode);
        LoginAsTenant(SampleDataBuilder.FarmCode, "owner");
    }

    [Fact]
    public async Task Ponds_show_every_status_and_more_than_one_page_of_cards()
    {
        var ponds = await Resolve<PondAppService>().GetAll(includeArchived: true);

        ponds.Count.ShouldBe(28);
        ponds.Count(p => !p.IsArchived).ShouldBeGreaterThan(24);
        ponds.Select(p => p.Status).Distinct().Count().ShouldBe(8);
        ponds.Single(p => p.PondCode == "EP-11").Status.ShouldBe(PondDisplayStatus.PostHarvest);
        ponds.Single(p => p.PondCode == "EP-12").Status.ShouldBe(PondDisplayStatus.PostHarvest);
        ponds.Single(p => p.PondCode == "EP-13").Status.ShouldBe(PondDisplayStatus.UnderPreparation);
        ponds.Single(p => p.PondCode == "HP-04").Status.ShouldBe(PondDisplayStatus.UnderPreparation);
        ponds.Single(p => p.PondCode == "EP-14").Status.ShouldBe(PondDisplayStatus.Prepared);
        ponds.Single(p => p.PondCode == "CP-04").Status.ShouldBe(PondDisplayStatus.UnderMaintenance);
        ponds.Single(p => p.PondCode == "CP-05").Status.ShouldBe(PondDisplayStatus.Inactive);
        ponds.Single(p => p.PondCode == "CP-06").Status.ShouldBe(PondDisplayStatus.Available);
        ponds.Count(p => p.Status == PondDisplayStatus.Archived).ShouldBe(2);
        ponds.Count(p => p.Status == PondDisplayStatus.InProduction).ShouldBe(15);

        var hp03 = await Resolve<PondAppService>().Get(ponds.Single(p => p.PondCode == "HP-03").Id);
        hp03.Status.ShouldBe(PondDisplayStatus.Prepared);
        hp03.PreparationWarning.ShouldNotBeNull();
    }

    [Fact]
    public async Task Lists_are_long_enough_to_page_and_records_use_the_app_formats()
    {
        Q(c => c.PondBatches.IgnoreQueryFilters().Count(b => b.TenantId == _farm)).ShouldBe(43);
        Q(c => c.Harvests.IgnoreQueryFilters().Count(h => h.TenantId == _farm)).ShouldBeGreaterThan(25);
        Q(c => c.Sales.IgnoreQueryFilters().Count(s => s.TenantId == _farm && !s.IsDeleted)).ShouldBeGreaterThan(25);
        Q(c => c.InventoryLots.IgnoreQueryFilters().Count(l => l.TenantId == _farm)).ShouldBeGreaterThan(25);

        // Cycle codes as the app makes them (yyyy-MM-hatchery-nn), one cycle per stocked delivery.
        var cycles = Q(c => c.ProductionCycles.IgnoreQueryFilters().Where(x => x.TenantId == _farm).ToList());
        cycles.Count.ShouldBe(7);
        cycles.ShouldAllBe(x => Regex.IsMatch(x.CycleCode, @"^\d{4}-\d{2}-[A-Z]{3}-\d{2}$"));
        cycles.Count(x => x.Status == CycleStatus.Closed).ShouldBe(4);

        // Closed batches carry their final indicators.
        var closed = Q(c => c.PondBatches.IgnoreQueryFilters().Where(b => b.TenantId == _farm && b.Status == BatchStatus.Closed).ToList());
        closed.Count.ShouldBe(26);
        closed.ShouldAllBe(b => b.TotalHarvestKg > 0 && b.CultureDays > 0);

        // Dispatch receipts are unique, including the voided one, and the next number continues after them.
        var receipts = Q(c => c.Sales.IgnoreQueryFilters().Where(s => s.TenantId == _farm).Select(s => s.DispatchReceiptNo).ToList());
        receipts.Distinct().Count().ShouldBe(receipts.Count);
        Q(c => c.Sales.IgnoreQueryFilters().Count(s => s.TenantId == _farm && s.IsDeleted && s.VoidReason != null)).ShouldBe(1);

        // The old farm code points to the new one (DEC-78).
        (await Resolve<FarmCodeManager>().FindCurrentCodeAsync(SampleDataBuilder.FormerFarmCode)).ShouldBe(SampleDataBuilder.FarmCode);
    }

    [Fact]
    public void Seeding_again_adds_nothing()
    {
        var before = Q(c => c.FeedingSessions.IgnoreQueryFilters().Count(f => f.TenantId == _farm));
        before.ShouldBeGreaterThan(5000);
        UsingDbContext(null, context =>
        {
            context.SuppressAutoSetTenantId = true;
            new SampleDataBuilder(context).Create();
        });
        Q(c => c.FeedingSessions.IgnoreQueryFilters().Count(f => f.TenantId == _farm)).ShouldBe(before);
        Q(c => c.Ponds.IgnoreQueryFilters().Count(p => p.TenantId == _farm)).ShouldBe(28);
    }
}
