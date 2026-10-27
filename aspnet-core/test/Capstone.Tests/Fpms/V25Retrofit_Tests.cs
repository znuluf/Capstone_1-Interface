using Abp.UI;
using Capstone.Domain;
using Capstone.Logbooks;
using Capstone.Logbooks.Dto;
using Capstone.Production;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>v2.5 retrofit (DEC-49 to DEC-54): Not fed sessions, Daily log status, close check, no logs after the Total harvest,
/// population from the survival estimate, farm-wide feeding sheet.</summary>
public class V25Retrofit_Tests : FpmsTestBase
{
    private static TimeZoneInfo Zone => FarmClock.Resolve(FarmClock.DefaultTimeZone);
    private static DateOnly Today => FarmClock.Today(Zone);

    private SaveFeedingSessionInput Fed(decimal kg, FeedingSessionTime time = FeedingSessionTime.AM, string batch = CurrentBatch, DateOnly? day = null) => new()
    {
        BatchId = BatchId(batch), FeedDate = day ?? Today, Session = time, ClientRequestId = Guid.NewGuid(),
        Lines = new() { new() { LotId = LotId(FeedLot), Kg = kg } },
    };

    private SaveFeedingSessionInput NotFed(FeedingSessionTime time = FeedingSessionTime.PM) => new()
    {
        BatchId = BatchId(CurrentBatch), FeedDate = Today, Session = time, ClientRequestId = Guid.NewGuid(), Status = FeedingStatus.NotFed,
    };

    // ---------------------------------------------------------------- DEC-50 Not fed
    [Fact]
    public async Task Not_fed_session_saves_without_feed_and_draws_no_stock()
    {
        var before = LotQty(LotId(FeedLot));
        var result = await Resolve<FeedingAppService>().Save(NotFed());
        result.Session.Status.ShouldBe(FeedingStatus.NotFed);
        result.Session.Kg.ShouldBe(0m);
        result.Indicators.CumulativeFeedKg.ShouldBe(300m);
        LotQty(LotId(FeedLot)).ShouldBe(before);
        Q(c => c.StockMovements.IgnoreQueryFilters().Count(m => m.FeedingSessionId == result.Session.Id)).ShouldBe(0);
    }

    [Fact]
    public async Task Not_fed_with_feed_lines_or_fed_without_lines_is_rejected()
    {
        var feeding = Resolve<FeedingAppService>();
        var withLines = NotFed();
        withLines.Lines = new() { new() { LotId = LotId(FeedLot), Kg = 5m } };
        await Should.ThrowAsync<UserFriendlyException>(() => feeding.Save(withLines));

        var empty = Fed(5m);
        empty.Lines = new();
        await ThrowsAny(() => feeding.Save(empty));
    }

    [Fact]
    public async Task Changing_a_fed_session_to_not_fed_returns_its_feed()
    {
        var feeding = Resolve<FeedingAppService>();
        var before = LotQty(LotId(FeedLot));
        await feeding.Save(Fed(12m, FeedingSessionTime.PM));
        var changed = await feeding.Save(NotFed(FeedingSessionTime.PM));
        changed.Session.Status.ShouldBe(FeedingStatus.NotFed);
        LotQty(LotId(FeedLot)).ShouldBe(before);
    }

    [Fact]
    public async Task Daily_log_status_shows_logged_not_fed_and_blank_cells()
    {
        var feeding = Resolve<FeedingAppService>();
        await feeding.Save(Fed(10m, FeedingSessionTime.AM));
        await feeding.Save(NotFed(FeedingSessionTime.PM));

        var status = await feeding.GetDailyStatus(new GetDailyLogStatusInput { Days = 3 });
        status.To.ShouldBe(Today);
        status.From.ShouldBe(Today.AddDays(-2));
        var row = status.Rows.Single(r => r.BatchCode == CurrentBatch);
        row.Days.Count.ShouldBe(3);
        var today = row.Days.Single(d => d.Date == Today);
        today.Am.ShouldBe(DailyCellStatus.Logged);
        today.Pm.ShouldBe(DailyCellStatus.NotFed);
        status.Rows.ShouldNotContain(r => r.BatchCode == ReferenceBatch); // harvested batches are not expected to log
    }

    [Fact]
    public async Task Close_check_lists_the_days_with_blank_daily_records()
    {
        var check = await Resolve<BatchAppService>().GetCloseCheck(BatchId(CurrentBatch));
        check.From.ShouldBe(new DateOnly(2026, 9, 15));
        check.To.ShouldBe(Today);
        check.BlankDaysTotal.ShouldBeGreaterThan(0);
        check.BlankDays.Count.ShouldBe(Math.Min(check.BlankDaysTotal, 60));
        check.BlankDays.ShouldAllBe(d => !string.IsNullOrWhiteSpace(d.Missing));

        await Resolve<FeedingAppService>().Save(Fed(10m, FeedingSessionTime.AM));
        await Resolve<FeedingAppService>().Save(NotFed(FeedingSessionTime.PM));
        var after = await Resolve<BatchAppService>().GetCloseCheck(BatchId(CurrentBatch));
        after.NotFedSlots.ShouldBe(check.NotFedSlots + 1);
        after.BlankFeedingSlots.ShouldBe(check.BlankFeedingSlots - 2);
    }

    // ---------------------------------------------------------------- DEC-51 nothing after the Total harvest
    [Fact]
    public async Task Entries_dated_after_the_total_harvest_are_rejected()
    {
        // The reference batch had its Total harvest on 8 Sep 2026.
        var last = await InUow(async () =>
        {
            var batch = await Resolve<Abp.Domain.Repositories.IRepository<PondBatch, Guid>>().GetAsync(BatchId(ReferenceBatch));
            return await Resolve<DailyLogStatusService>().LastLogDateAsync(batch, Zone);
        });
        last.ShouldBe(new DateOnly(2026, 9, 8));

        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<FeedingAppService>().Save(Fed(5m, batch: ReferenceBatch, day: new DateOnly(2026, 9, 9))));
        var log = new SaveLogInput
        {
            BatchId = BatchId(ReferenceBatch), LogType = LogType.Mortality, ObservedAt = new DateTime(2026, 9, 10, 1, 0, 0, DateTimeKind.Utc), ClientRequestId = Guid.NewGuid(),
            Mortality = new MortalityInput { Count = 5, Cause = MortalityCause.WaterQuality },
        };
        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<LogAppService>().Create(log));
    }

    // ---------------------------------------------------------------- DEC-53 survival estimate drives population
    [Fact]
    public async Task A_survival_estimate_resets_the_population_and_later_mortality_still_counts()
    {
        var logs = Resolve<LogAppService>();
        var growth = new SaveLogInput
        {
            BatchId = BatchId(CurrentBatch), LogType = LogType.GrowthSampling, ObservedAt = DateTime.UtcNow.AddMinutes(-10), ClientRequestId = Guid.NewGuid(),
            Growth = new GrowthInput { SampleCount = 50, TotalSampleWeightG = 400m, EstimatedSurvivalPct = 80m },
        };
        var result = await logs.Create(growth);
        result.Log.EstimatedSurvivalPct.ShouldBe(80m);
        result.Indicators.PopulationBasis.ShouldBe("Estimate");
        result.Indicators.EstimatedPopulation.ShouldBe(200000m); // 250,000 × 80 %

        var mortality = new SaveLogInput
        {
            BatchId = BatchId(CurrentBatch), LogType = LogType.Mortality, ObservedAt = DateTime.UtcNow.AddMinutes(-5), ClientRequestId = Guid.NewGuid(),
            Mortality = new MortalityInput { Count = 500, Cause = MortalityCause.WaterQuality },
        };
        (await logs.Create(mortality)).Indicators.EstimatedPopulation.ShouldBe(199500m);
    }

    [Fact]
    public async Task Without_an_estimate_population_comes_from_mortality()
    {
        var batch = await Resolve<BatchAppService>().Get(BatchId(CurrentBatch));
        batch.Indicators.PopulationBasis.ShouldBe("Mortality");
        (await Resolve<BatchAppService>().Get(BatchId(ReferenceBatch))).Indicators.EstimatedPopulation.ShouldBe(47500m);
    }

    [Fact]
    public async Task Survival_estimate_must_be_a_percentage()
    {
        var growth = new SaveLogInput
        {
            BatchId = BatchId(CurrentBatch), LogType = LogType.GrowthSampling, ObservedAt = DateTime.UtcNow.AddMinutes(-10), ClientRequestId = Guid.NewGuid(),
            Growth = new GrowthInput { SampleCount = 50, TotalSampleWeightG = 400m, EstimatedSurvivalPct = 120m },
        };
        await ThrowsAny(() => Resolve<LogAppService>().Create(growth));
    }

    // ---------------------------------------------------------------- DEC-54 farm-wide feeding sheet
    [Fact]
    public async Task Feeding_sheet_without_a_cycle_lists_every_open_batch_by_pond()
    {
        var sheet = await Resolve<FeedingAppService>().GetSheet(new GetFeedingSheetInput { FeedDate = Today });
        sheet.CycleId.ShouldBeNull();
        sheet.Rows.ShouldContain(r => r.BatchCode == CurrentBatch && r.CycleCode != null);
        sheet.Rows.Select(r => r.PondCode).ShouldBe(sheet.Rows.Select(r => r.PondCode).OrderBy(p => p));
    }

    // ---------------------------------------------------------------- DEC-52 density bands are seeded
    [Fact]
    public void Density_bands_are_seeded_for_every_system_and_construction_type()
    {
        Q(c => c.DensityBands.Count()).ShouldBe(9); // 3 systems × 3 construction types (DEC-65)
    }
}
