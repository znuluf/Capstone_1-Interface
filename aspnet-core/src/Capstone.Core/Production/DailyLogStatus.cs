using Abp.Dependency;
using Abp.Domain.Repositories;
using Capstone.Domain;
using Capstone.Harvests;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Production;

/// <summary>A daily record slot: logged, Not fed (feeding only), or blank. Blank is neutral, never "overdue" (DEC-50).</summary>
public enum DailyCellStatus { Blank = 0, Logged = 1, NotFed = 2 }

public class DailyLogDay
{
    public DateOnly Date { get; set; }

    /// <summary>
    /// One cell per feeding of the day, in order (feeding 1 first) (DEC-61): the farm's scheduled feedings, plus any
    /// feeding logged beyond the schedule.
    /// </summary>
    public List<DailyCellStatus> Feedings { get; set; } = new();

    public DailyCellStatus Water { get; set; }

    public int BlankFeedings => Feedings.Count(f => f == DailyCellStatus.Blank);

    public int NotFedFeedings => Feedings.Count(f => f == DailyCellStatus.NotFed);

    public bool HasBlank => BlankFeedings > 0 || Water == DailyCellStatus.Blank;

    public string DescribeBlanks()
    {
        var missing = new List<string>();
        var blank = Feedings.Select((f, i) => (f, No: i + 1)).Where(x => x.f == DailyCellStatus.Blank).Select(x => x.No).ToList();
        if (blank.Count == 1)
        {
            missing.Add($"feeding {blank[0]}");
        }
        else if (blank.Count > 1)
        {
            missing.Add($"feedings {string.Join(", ", blank)}");
        }

        if (Water == DailyCellStatus.Blank) missing.Add("water quality");
        return string.Join(", ", missing);
    }
}

/// <summary>
/// Daily log completeness (DEC-50): for each batch and farm-local day, whether each feeding and the day's water
/// quality were logged. The number of feedings a day comes from the farm's schedule (DEC-61). Also the batch's
/// last-day rule (DEC-51): no log after the Total harvest date.
/// </summary>
public class DailyLogStatusService : ITransientDependency
{
    private readonly IRepository<FeedingSession, Guid> _sessions;
    private readonly IRepository<ProductionLog, Guid> _logs;
    private readonly IRepository<Harvest, Guid> _harvests;
    private readonly IRepository<BatchFailure, Guid> _failures;

    public DailyLogStatusService(IRepository<FeedingSession, Guid> sessions, IRepository<ProductionLog, Guid> logs, IRepository<Harvest, Guid> harvests,
        IRepository<BatchFailure, Guid> failures)
    {
        _sessions = sessions;
        _logs = logs;
        _harvests = harvests;
        _failures = failures;
    }

    /// <summary>Days from..to (inclusive) for each batch. Days before a batch's stocking date are left out.</summary>
    public async Task<Dictionary<Guid, List<DailyLogDay>>> LoadAsync(IReadOnlyCollection<PondBatch> batches, DateOnly from, DateOnly to, TimeZoneInfo zone,
        int feedingsPerDay)
    {
        var ids = batches.Select(b => b.Id).ToList();
        var sessions = await _sessions.GetAll().AsNoTracking()
            .Where(s => ids.Contains(s.BatchId) && s.FeedDate >= from && s.FeedDate <= to)
            .Select(s => new { s.BatchId, s.FeedDate, s.Session, s.Status }).ToListAsync();
        var fromUtc = FarmClock.StartOfDayUtc(from, zone);
        var toUtc = FarmClock.StartOfDayUtc(to.AddDays(1), zone);
        var water = await _logs.GetAll().AsNoTracking()
            .Where(l => ids.Contains(l.BatchId) && (l.LogType == LogType.WaterQuality || l.LogType == LogType.PreStockingWaterQuality)
                        && l.ObservedAtUtc >= fromUtc && l.ObservedAtUtc < toUtc)
            .Select(l => new { l.BatchId, l.ObservedAtUtc }).ToListAsync();
        var waterDays = water.Select(w => (w.BatchId, Day: FarmClock.LocalDate(w.ObservedAtUtc, zone))).ToHashSet();

        var byDay = sessions.ToLookup(x => (x.BatchId, x.FeedDate));
        List<DailyCellStatus> FeedCells(Guid batchId, DateOnly day)
        {
            var logged = byDay[(batchId, day)].ToList();
            var count = Math.Max(Math.Max(feedingsPerDay, 1), logged.Count == 0 ? 0 : logged.Max(x => x.Session));
            return Enumerable.Range(1, count).Select(n =>
            {
                var s = logged.FirstOrDefault(x => x.Session == n);
                return s == null ? DailyCellStatus.Blank : s.Status == FeedingStatus.NotFed ? DailyCellStatus.NotFed : DailyCellStatus.Logged;
            }).ToList();
        }

        var result = new Dictionary<Guid, List<DailyLogDay>>();
        foreach (var b in batches)
        {
            var start = b.StockingDate.HasValue && b.StockingDate.Value > from ? b.StockingDate.Value : from;
            var days = new List<DailyLogDay>();
            for (var d = start; d <= to; d = d.AddDays(1))
            {
                days.Add(new DailyLogDay
                {
                    Date = d,
                    Feedings = FeedCells(b.Id, d),
                    Water = waterDays.Contains((b.Id, d)) ? DailyCellStatus.Logged : DailyCellStatus.Blank,
                });
            }

            result[b.Id] = days;
        }

        return result;
    }

    /// <summary>
    /// The farm-local date of the batch's Total (Final) harvest, after which logs and feeding are rejected (DEC-51).
    /// Null when there is none, or when the batch is Failed (salvage records are exempt).
    /// </summary>
    public async Task<DateOnly?> LastLogDateAsync(PondBatch batch, TimeZoneInfo zone)
    {
        if (batch.Status == BatchStatus.Failed)
        {
            return null;
        }

        var final = await _harvests.GetAll().AsNoTracking()
            .Where(h => h.BatchId == batch.Id && h.HarvestType == HarvestType.Total)
            .OrderByDescending(h => h.HarvestedAtUtc).Select(h => (DateTime?)h.HarvestedAtUtc).FirstOrDefaultAsync();
        return final.HasValue ? FarmClock.LocalDate(final.Value, zone) : null;
    }

    /// <summary>The last day a batch's daily records are expected: its Total harvest date, its failure date, or today.</summary>
    public async Task<DateOnly> ExpectedUntilAsync(PondBatch batch, DateOnly today, TimeZoneInfo zone)
    {
        var failure = await _failures.GetAll().AsNoTracking().Where(f => f.BatchId == batch.Id).Select(f => (DateOnly?)f.FailedOn).FirstOrDefaultAsync();
        if (failure.HasValue)
        {
            return failure.Value < today ? failure.Value : today;
        }

        var final = await _harvests.GetAll().AsNoTracking()
            .Where(h => h.BatchId == batch.Id && h.HarvestType == HarvestType.Total)
            .OrderByDescending(h => h.HarvestedAtUtc).Select(h => (DateTime?)h.HarvestedAtUtc).FirstOrDefaultAsync();
        var finalDay = final.HasValue ? FarmClock.LocalDate(final.Value, zone) : (DateOnly?)null;
        return finalDay.HasValue && finalDay.Value < today ? finalDay.Value : today;
    }
}
