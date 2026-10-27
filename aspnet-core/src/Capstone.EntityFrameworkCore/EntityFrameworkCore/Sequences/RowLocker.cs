using Abp.Dependency;
using Abp.EntityFrameworkCore;
using Capstone.Domain;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace Capstone.EntityFrameworkCore.Sequences;

/// <summary>SQL Server: SELECT … WITH (UPDLOCK, ROWLOCK) in the caller's transaction. Other providers: no lock (tests).</summary>
public class RowLocker : IRowLocker, ITransientDependency
{
    private readonly IDbContextProvider<CapstoneDbContext> _dbContextProvider;

    public RowLocker(IDbContextProvider<CapstoneDbContext> dbContextProvider)
    {
        _dbContextProvider = dbContextProvider;
    }

    public async Task LockAsync(RowLockTarget target, Guid id)
    {
        var context = await _dbContextProvider.GetDbContextAsync();
        if (!context.Database.IsSqlServer())
        {
            return;
        }

        var table = target switch
        {
            RowLockTarget.FryDelivery => "FpmsFryDeliveries",
            RowLockTarget.HarvestGradeLine => "FpmsHarvestGradeLines",
            _ => throw new ArgumentOutOfRangeException(nameof(target)),
        };

        // The table name comes from the fixed list above, never from input.
        await context.Database.ExecuteSqlRawAsync($"SELECT Id FROM [{table}] WITH (UPDLOCK, ROWLOCK) WHERE Id = @id", new SqlParameter("@id", id));
    }
}
