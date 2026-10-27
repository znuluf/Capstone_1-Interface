using Abp.Auditing;
using Abp.Dependency;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Abp.Threading.BackgroundWorkers;
using Abp.Threading.Timers;
using System;
using System.Linq;

namespace Capstone.Health;

/// <summary>
/// Deletes request audit logs older than 12 months, once a day, 500 rows at a time (AC-26 retention). Data-change history
/// (the Owner activity log) is not touched. Registered by <see cref="CapstoneApplicationModule"/>.
/// </summary>
public class AuditLogPurgeWorker : PeriodicBackgroundWorkerBase, ISingletonDependency
{
    public const int RetentionMonths = 12;
    private const int BatchSize = 500;
    private readonly IRepository<AuditLog, long> _auditLogs;

    public AuditLogPurgeWorker(AbpTimer timer, IRepository<AuditLog, long> auditLogs) : base(timer)
    {
        _auditLogs = auditLogs;
        Timer.Period = (int)TimeSpan.FromHours(24).TotalMilliseconds;
    }

    protected override void DoWork()
    {
        try
        {
            Purge(DateTime.UtcNow);
        }
        catch (Exception ex)
        {
            Logger.Error("The audit log purge failed.", ex);
        }
    }

    /// <summary>Returns how many rows were deleted.</summary>
    public int Purge(DateTime nowUtc)
    {
        var cutoff = nowUtc.AddMonths(-RetentionMonths);
        var deleted = 0;
        while (true)
        {
            using var uow = UnitOfWorkManager.Begin();
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant))
            {
                var ids = _auditLogs.GetAll().Where(a => a.ExecutionTime < cutoff).OrderBy(a => a.Id).Select(a => a.Id).Take(BatchSize).ToList();
                if (ids.Count == 0)
                {
                    uow.Complete();
                    return deleted;
                }

                foreach (var id in ids)
                {
                    _auditLogs.Delete(id);
                }
            }

            uow.Complete();
            deleted += BatchSize;
            if (deleted >= 100_000)
            {
                return deleted; // the next daily run continues
            }
        }
    }
}
