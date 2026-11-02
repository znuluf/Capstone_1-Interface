using Capstone.Dashboard;
using Capstone.Domain;
using Capstone.Production;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Dashboard summary counts for spec 9.2: batches awaiting Close Batch, and lots expiring soon or expired.</summary>
public class Dashboard_Tests : FpmsTestBase
{
    private static DateOnly Today => FarmClock.Today(FarmClock.Resolve(FarmClock.DefaultTimeZone));

    [Fact]
    public async Task Counts_harvested_and_failed_batches_not_closed_yet()
    {
        var tenantId = GetTenantId(PilotFarm);
        var stocked = Q(c => c.PondBatches.IgnoreQueryFilters()
            .Where(b => b.TenantId == tenantId && b.Status == BatchStatus.Stocked).Select(b => b.Id).ToList());
        stocked.Count.ShouldBeGreaterThan(0);
        var before = (await Resolve<DashboardAppService>().Get()).Kpis.BatchesAwaitingClose;

        UsingDbContext(null, c => c.PondBatches.IgnoreQueryFilters().Single(b => b.Id == stocked[0]).Status = BatchStatus.Harvested);
        (await Resolve<DashboardAppService>().Get()).Kpis.BatchesAwaitingClose.ShouldBe(before + 1);

        UsingDbContext(null, c => c.PondBatches.IgnoreQueryFilters().Single(b => b.Id == stocked[0]).Status = BatchStatus.Closed);
        (await Resolve<DashboardAppService>().Get()).Kpis.BatchesAwaitingClose.ShouldBe(before);
    }

    [Fact]
    public async Task Counts_lots_with_stock_that_expire_within_the_window_or_have_expired()
    {
        var tenantId = GetTenantId(PilotFarm);
        var withStock = Q(c => c.InventoryLots.IgnoreQueryFilters().Where(l => l.TenantId == tenantId).Select(l => l.Id).ToList())
            .Where(id => LotQty(id) > 0).ToList();
        withStock.Count.ShouldBeGreaterThan(1);

        // Every lot far in the future, then one on the last day of the window and one expired yesterday.
        UsingDbContext(null, c =>
        {
            foreach (var lot in c.InventoryLots.IgnoreQueryFilters().Where(l => l.TenantId == tenantId))
            {
                lot.ExpiryDate = Today.AddDays(365);
            }
        });
        UsingDbContext(null, c =>
        {
            c.InventoryLots.IgnoreQueryFilters().Single(l => l.Id == withStock[0]).ExpiryDate = Today.AddDays(DashboardAppService.LotExpiringSoonDays);
            c.InventoryLots.IgnoreQueryFilters().Single(l => l.Id == withStock[1]).ExpiryDate = Today.AddDays(-1);
        });

        var kpis = (await Resolve<DashboardAppService>().Get()).Kpis;
        kpis.LotsExpiringSoon.ShouldBe(1);
        kpis.LotsExpired.ShouldBe(1);
        kpis.LotExpiringSoonDays.ShouldBe(DashboardAppService.LotExpiringSoonDays);

        // One day past the window is no longer "soon".
        UsingDbContext(null, c => c.InventoryLots.IgnoreQueryFilters().Single(l => l.Id == withStock[0]).ExpiryDate = Today.AddDays(DashboardAppService.LotExpiringSoonDays + 1));
        (await Resolve<DashboardAppService>().Get()).Kpis.LotsExpiringSoon.ShouldBe(0);
    }
}
