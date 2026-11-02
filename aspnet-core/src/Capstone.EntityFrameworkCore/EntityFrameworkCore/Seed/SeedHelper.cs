using Abp.Dependency;
using Abp.Domain.Uow;
using Abp.EntityFrameworkCore.Uow;
using Abp.MultiTenancy;
using Capstone.EntityFrameworkCore.Seed.Development;
using Capstone.EntityFrameworkCore.Seed.Host;
using Capstone.EntityFrameworkCore.Seed.Farms;
using Microsoft.EntityFrameworkCore;
using System;
using System.Transactions;

namespace Capstone.EntityFrameworkCore.Seed;

public static class SeedHelper
{
    public static void SeedHostDb(IIocResolver iocResolver)
    {
        WithDbContext<CapstoneDbContext>(iocResolver, SeedHostDb);
    }

    public static void SeedHostDb(CapstoneDbContext context)
    {
        context.SuppressAutoSetTenantId = true;

        // Host seed: editions, languages, settings, System Administrator, water-quality reference data.
        new InitialHostDbBuilder(context).Create();

        // Keep every farm's static roles in line with the permission matrix.
        new FarmRoleSynchronizer(context).SyncAllFarms();

        if (SeedOptions.SeedSampleData)
        {
            // Two sample farms: gensan-semi (semi-intensive, earthen) and KIAMBA-INTENSIVE (intensive, lined, about a year).
            new SampleDataBuilder(context).Create();
            new IntensiveSampleBuilder(context).Create();
        }
        else if (SeedOptions.SeedDevelopmentData)
        {
            new DevelopmentDataBuilder(context).Create();
        }
    }

    private static void WithDbContext<TDbContext>(IIocResolver iocResolver, Action<TDbContext> contextAction)
        where TDbContext : DbContext
    {
        using (var uowManager = iocResolver.ResolveAsDisposable<IUnitOfWorkManager>())
        {
            using (var uow = uowManager.Object.Begin(TransactionScopeOption.Suppress))
            {
                var context = uowManager.Object.Current.GetDbContext<TDbContext>(MultiTenancySides.Host);

                contextAction(context);

                uow.Complete();
            }
        }
    }
}
