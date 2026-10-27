using Capstone.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Tests.Fpms;

public abstract class FpmsTestBase : CapstoneTestBase
{
    protected T Q<T>(Func<CapstoneDbContext, T> query) => UsingDbContext(null, context => query(context));

    protected Guid PondId(string code)
    {
        var tenantId = GetTenantId(PilotFarm);
        return Q(c => c.Ponds.IgnoreQueryFilters().Single(p => p.PondCode == code && p.TenantId == tenantId).Id);
    }

    protected Guid PrefixId(string shortCode, string farm = PilotFarm)
    {
        var tenantId = GetTenantId(farm);
        return Q(c => c.PondNamePrefixes.IgnoreQueryFilters().Single(p => p.ShortCode == shortCode && p.TenantId == tenantId).Id);
    }

    protected Guid DeliveryId(string batchNumber) => Q(c => c.FryDeliveries.IgnoreQueryFilters().Single(d => d.HatcheryBatchNumber == batchNumber).Id);

    protected Guid BatchId(string code) => Q(c => c.PondBatches.IgnoreQueryFilters().Single(b => b.BatchCode == code).Id);

    protected Guid CycleId(string code) => Q(c => c.ProductionCycles.IgnoreQueryFilters().Single(b => b.CycleCode == code).Id);

    protected Guid LotId(string lotNumber) => Q(c => c.InventoryLots.IgnoreQueryFilters().Single(l => l.LotNumber == lotNumber).Id);

    protected Guid HatcheryId(int tenantId) => Q(c => c.HatcherySources.IgnoreQueryFilters().First(h => h.TenantId == tenantId).Id);

    protected decimal LotQty(Guid lotId) => Q(c => c.StockMovements.IgnoreQueryFilters().Where(m => m.LotId == lotId).Sum(m => m.Quantity));

    /// <summary>Runs a domain-service call inside a unit of work (app services get one automatically).</summary>
    protected async Task<T> InUow<T>(Func<Task<T>> action)
    {
        using var uow = Resolve<Abp.Domain.Uow.IUnitOfWorkManager>().Begin();
        var result = await action();
        await uow.CompleteAsync();
        return result;
    }

    /// <summary>Asserts that the call fails with any exception (validation or business rule).</summary>
    protected static async Task ThrowsAny(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (Exception)
        {
            return;
        }

        throw new Shouldly.ShouldAssertException("Expected the call to fail, but it succeeded.");
    }

    protected const string ReferenceBatch = "B-2026-01-P01";
    protected const string CurrentBatch = "B-2026-02-P02";
    protected const string NewDelivery = "HL-1020";
    protected const string FeedLot = "FG-0601";
    protected const string LimeLot = "LM-0515";
}
