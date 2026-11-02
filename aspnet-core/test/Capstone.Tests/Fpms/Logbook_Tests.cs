using Abp.Authorization;
using Abp.UI;
using Capstone.Alerts;
using Capstone.Domain;
using Capstone.Inventory;
using Capstone.Logbooks;
using Capstone.Logbooks.Dto;
using Capstone.Production;
using Capstone.Production.Dto;
using Capstone.ReferenceData;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Step D, operations: AM/PM feeding sessions, logs, warnings and voids (AC-11, AC-12, AC-20).</summary>
public class Logbook_Tests : FpmsTestBase
{
    private static DateOnly Today => FarmClock.Today(FarmClock.Resolve(FarmClock.DefaultTimeZone));

    private SaveFeedingSessionInput Session(decimal kg, FeedingSessionTime time = FeedingSessionTime.AM, DateOnly? day = null, Guid? requestId = null) => new()
    {
        BatchId = BatchId(CurrentBatch), FeedDate = day ?? Today, Session = time, ClientRequestId = requestId ?? Guid.NewGuid(),
        Lines = new() { new() { LotId = LotId(FeedLot), Kg = kg } },
    };

    private SaveLogInput Log(LogType type) => new()
    {
        BatchId = BatchId(CurrentBatch), LogType = type, ObservedAt = DateTime.UtcNow.AddMinutes(-5), ClientRequestId = Guid.NewGuid(),
    };

    // ---------------------------------------------------------------- feeding sessions (AC-11)
    [Fact]
    public async Task Feeding_session_draws_stock_and_updates_cumulative_feed()
    {
        var before = LotQty(LotId(FeedLot));
        LoginAsPilotTechnician();
        var result = await Resolve<FeedingAppService>().Save(Session(25m));

        result.Warnings.ShouldBeEmpty();
        result.Session.Kg.ShouldBe(25m);
        result.Session.RecordedBy.ShouldBe("Tomas Technician");
        result.Indicators.CumulativeFeedKg.ShouldBe(325m); // 300 seeded + 25
        LotQty(LotId(FeedLot)).ShouldBe(before - 25m);
        Q(c => c.StockMovements.IgnoreQueryFilters().Count(m => m.FeedingSessionId == result.Session.Id && m.Type == StockMovementType.Usage)).ShouldBe(1);
    }

    // ---------------------------------------------------------------- optional time of feeding (DEC-71, AC-40)
    [Fact]
    public async Task Time_fed_is_optional_validated_cleared_for_not_fed_and_kept_on_correction()
    {
        var feeding = Resolve<FeedingAppService>();
        var input = Session(20m);
        input.FedAtTime = " 06:30 ";
        var saved = await feeding.Save(input);
        saved.Session.FedAtTime.ShouldBe("06:30");

        var again = Session(22m);
        again.FedAtTime = "07:15";
        (await feeding.Save(again)).Session.FedAtTime.ShouldBe("07:15");

        var blank = Session(22m);
        (await feeding.Save(blank)).Session.FedAtTime.ShouldBeNull();

        var bad = Session(22m);
        bad.FedAtTime = "25:99";
        await Should.ThrowAsync<UserFriendlyException>(() => feeding.Save(bad));

        var notFed = Session(0m, FeedingSessionTime.PM);
        notFed.Status = FeedingStatus.NotFed;
        notFed.Lines = new();
        notFed.FedAtTime = "16:00";
        (await feeding.Save(notFed)).Session.FedAtTime.ShouldBeNull();
    }

    // ---------------------------------------------------------------- trace report (DEC-72, AC-41)
    [Fact]
    public async Task Trace_report_lists_the_fry_source_and_the_feed_lot_used()
    {
        await Resolve<FeedingAppService>().Save(Session(25m));
        var trace = await Resolve<Capstone.Reports.TraceAppService>().GetBatchTrace(BatchId(CurrentBatch));

        trace.BatchCode.ShouldBe(CurrentBatch);
        trace.FrySource.ShouldNotBeNull();
        trace.FeedLots.ShouldNotBeEmpty();
        trace.FeedLots.Sum(l => l.Kg).ShouldBeGreaterThanOrEqualTo(25m);
        trace.FeedingSessionsFed.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task Saving_the_same_day_and_session_again_updates_it_with_reversing_movements()
    {
        var feeding = Resolve<FeedingAppService>();
        var before = LotQty(LotId(FeedLot));
        var first = await feeding.Save(Session(25m));
        var second = await feeding.Save(Session(30m));

        second.WasUpdate.ShouldBeTrue();
        second.Session.Id.ShouldBe(first.Session.Id);
        second.Session.Kg.ShouldBe(30m);
        second.Indicators.CumulativeFeedKg.ShouldBe(330m);
        LotQty(LotId(FeedLot)).ShouldBe(before - 30m);
        Q(c => c.StockMovements.IgnoreQueryFilters().Count(m => m.FeedingSessionId == first.Session.Id)).ShouldBe(3); // usage, reversal, new usage
        Q(c => c.FeedingSessions.IgnoreQueryFilters().Count(s => s.BatchId == first.Session.BatchId && s.FeedDate == Today && !s.IsDeleted)).ShouldBe(1);
    }

    [Fact]
    public async Task A_session_can_draw_from_several_lots()
    {
        var feedItem = Q(c => c.InventoryItems.IgnoreQueryFilters().Single(i => i.ProductName == "Shrimp Grower #3").Id);
        var receipt = await Resolve<InventoryAppService>().RecordReceipt(new RecordReceiptInput
        {
            ItemId = feedItem, LotNumber = "FG-1022", ReceivedDate = Today, Quantity = 500, UnitCost = 80, Supplier = "Feed Dealer",
        });
        var input = Session(10m);
        input.Lines.Add(new FeedingLineInput { LotId = receipt.LotId, Kg = 5m });
        var result = await Resolve<FeedingAppService>().Save(input);
        result.Session.Kg.ShouldBe(15m);
        result.Session.Lines.Count.ShouldBe(2);
        LotQty(receipt.LotId).ShouldBe(495m);
    }

    [Fact]
    public async Task Resubmitting_the_same_client_request_id_does_not_duplicate()
    {
        var requestId = Guid.NewGuid();
        var feeding = Resolve<FeedingAppService>();
        var first = await feeding.Save(Session(10m, requestId: requestId));
        var second = await feeding.Save(Session(10m, requestId: requestId));
        second.WasDuplicate.ShouldBeTrue();
        second.Session.Id.ShouldBe(first.Session.Id);
        Q(c => c.StockMovements.IgnoreQueryFilters().Count(m => m.FeedingSessionId == first.Session.Id)).ShouldBe(1);
    }

    [Fact]
    public async Task Stock_shortfall_warns_saves_and_flags_the_lot()
    {
        // Lot FG-0601: 5,000 received − 3,300 used = 1,700 kg on hand.
        var feeding = Resolve<FeedingAppService>();
        await feeding.Save(Session(1000m, FeedingSessionTime.AM));
        var pm = await feeding.Save(Session(800m, FeedingSessionTime.PM));
        pm.Warnings.ShouldContain(w => w.Kind == "Stock");
        Q(c => c.InventoryLots.IgnoreQueryFilters().Single(l => l.LotNumber == FeedLot).NeedsReconciliation).ShouldBeTrue();
        LotQty(LotId(FeedLot)).ShouldBe(-100m);
        // DEC-49: entry checks warn inline only; no notification is raised.
        Q(c => c.FarmNotifications.IgnoreQueryFilters().Any(n => n.Type == FarmNotificationType.NegativeStock || n.Type == FarmNotificationType.LowStock)).ShouldBeFalse();
    }

    [Fact]
    public async Task Flagged_lots_are_listed_by_close_check_and_marked_on_the_trace_report()
    {
        var feeding = Resolve<FeedingAppService>();
        await feeding.Save(Session(1000m, FeedingSessionTime.AM));
        await feeding.Save(Session(800m, FeedingSessionTime.PM)); // takes the lot below zero and flags it
        var batchId = BatchId(CurrentBatch);

        var check = await Resolve<BatchAppService>().GetCloseCheck(batchId);
        check.FlaggedLots.ShouldContain(l => l.LotNumber == FeedLot);

        var trace = await Resolve<Capstone.Reports.TraceAppService>().GetBatchTrace(batchId);
        trace.FeedLots.Single(l => l.LotNumber == FeedLot).NeedsReconciliation.ShouldBeTrue();
    }

    [Fact]
    public async Task Feeding_rules_reject_bad_amounts_dates_and_lots()
    {
        var feeding = Resolve<FeedingAppService>();
        await ThrowsAny(() => feeding.Save(Session(1001m)));
        await ThrowsAny(() => feeding.Save(Session(0m)));
        await Should.ThrowAsync<UserFriendlyException>(() => feeding.Save(Session(10m, day: Today.AddDays(1))));
        await Should.ThrowAsync<UserFriendlyException>(() => feeding.Save(Session(10m, day: new DateOnly(2026, 9, 1)))); // before stocking
        var lime = Session(10m);
        lime.Lines = new() { new() { LotId = LotId(LimeLot), Kg = 10m } };
        await Should.ThrowAsync<UserFriendlyException>(() => feeding.Save(lime));
    }

    [Fact]
    public async Task More_than_three_times_the_recent_average_warns()
    {
        var feeding = Resolve<FeedingAppService>();
        await feeding.Save(Session(10m, FeedingSessionTime.AM, Today.AddDays(-1)));
        await feeding.Save(Session(10m, FeedingSessionTime.PM, Today.AddDays(-1)));
        var big = await feeding.Save(Session(40m));
        big.Warnings.ShouldContain(w => w.Kind == "Feeding");
    }

    [Fact]
    public async Task Owner_voids_a_session_and_its_feed_returns_to_stock()
    {
        var feeding = Resolve<FeedingAppService>();
        var before = LotQty(LotId(FeedLot));
        var saved = await feeding.Save(Session(20m));

        LoginAsPilotTechnician();
        await Should.ThrowAsync<AbpAuthorizationException>(() => feeding.Void(new VoidInput { Id = saved.Session.Id, Reason = "x" }));
        await Should.ThrowAsync<UserFriendlyException>(() => feeding.Save(Session(21m))); // recorded by the Owner

        LoginAsPilotOwner();
        await feeding.Void(new VoidInput { Id = saved.Session.Id, Reason = "Entered on the wrong pond" });
        LotQty(LotId(FeedLot)).ShouldBe(before);
        (await feeding.GetList(new GetFeedingSessionsInput { BatchId = BatchId(CurrentBatch) })).Items.ShouldNotContain(s => s.Id == saved.Session.Id);
        Q(c => c.FeedingSessions.IgnoreQueryFilters().Single(s => s.Id == saved.Session.Id).VoidReason).ShouldBe("Entered on the wrong pond");

        // Re-entry after a void is allowed.
        (await feeding.Save(Session(20m))).Session.Id.ShouldNotBe(saved.Session.Id);
    }

    [Fact]
    public async Task Feeding_sheet_lists_open_batches_and_saves_several_sessions()
    {
        var feeding = Resolve<FeedingAppService>();
        var sheet = await feeding.GetSheet(new GetFeedingSheetInput { CycleId = CycleId("C-2026-01"), FeedDate = Today });
        sheet.Rows.Select(r => r.BatchCode).ShouldBe(new[] { CurrentBatch }); // the reference batch had its Total harvest on 8 Sep (DEC-51)
        (await feeding.GetSheet(new GetFeedingSheetInput { CycleId = CycleId("C-2026-01"), FeedDate = new DateOnly(2026, 9, 8) })).Rows.Select(r => r.BatchCode).ShouldBe(new[] { ReferenceBatch });

        var results = await feeding.SaveSheet(new SaveFeedingSheetInput { Sessions = new() { Session(8m, FeedingSessionTime.AM), Session(9m, FeedingSessionTime.PM) } });
        results.Count.ShouldBe(2);
        results.Last().Indicators.CumulativeFeedKg.ShouldBe(317m);
        (await feeding.GetSheet(new GetFeedingSheetInput { CycleId = CycleId("C-2026-01"), FeedDate = Today })).Rows.Single(r => r.BatchCode == CurrentBatch).Pm.Kg.ShouldBe(9m);
    }

    // ---------------------------------------------------------------- water quality (AC-12)
    [Fact]
    public async Task Out_of_range_water_quality_is_saved_flagged_and_summarised_per_pond_per_day_without_a_notification()
    {
        var logs = Resolve<LogAppService>();
        var input = Log(LogType.WaterQuality);
        input.Readings = new List<ReadingInput> { new() { ParameterCode = ParameterCodes.DO, Value = 3.9m }, new() { ParameterCode = ParameterCodes.PH, Value = 7.9m } };
        var result = await logs.Create(input);
        result.Log.HasOutOfRange.ShouldBeTrue();
        var doReading = result.Log.Measurements.Single(m => m.ParameterCode == ParameterCodes.DO);
        doReading.Side.ShouldBe(ReadingSide.Low);
        doReading.Recommendation.ShouldNotBeNullOrWhiteSpace();
        result.Log.Measurements.Single(m => m.ParameterCode == ParameterCodes.PH).IsOutOfRange.ShouldBeFalse();
        result.Warnings.Single().Message.ShouldContain("Recommendation");

        var again = Log(LogType.WaterQuality);
        again.Readings = new List<ReadingInput> { new() { ParameterCode = ParameterCodes.PH, Value = 9.2m } };
        await logs.Create(again);
        Q(c => c.FarmNotifications.IgnoreQueryFilters().Any(n => n.Type == FarmNotificationType.WaterQualityAlert)).ShouldBeFalse(); // DEC-49

        var dashboard = await Resolve<Dashboard.DashboardAppService>().Get();
        var alert = dashboard.WaterQualityAlerts.Single(a => a.LogIds.Contains(result.Log.Id));
        alert.Readings.Count.ShouldBe(2); // one alert for the pond and day, listing both out-of-range readings
        alert.Readings.ShouldContain(r => r.Contains("(low;"));
    }

    [Fact]
    public async Task Invalid_reading_commits_nothing()
    {
        var input = Log(LogType.WaterQuality);
        input.Readings = new List<ReadingInput> { new() { ParameterCode = ParameterCodes.PH, Value = 15m } };
        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<LogAppService>().Create(input));
        Q(c => c.ProductionLogs.IgnoreQueryFilters().Count(l => l.ClientRequestId == input.ClientRequestId)).ShouldBe(0);
    }

    // ---------------------------------------------------------------- growth sampling
    [Fact]
    public async Task Growth_sampling_computes_abw_rejects_impossible_and_warns_on_a_drop()
    {
        var logs = Resolve<LogAppService>();
        var good = Log(LogType.GrowthSampling);
        good.Growth = new GrowthInput { SampleCount = 50, TotalSampleWeightG = 400m };
        var result = await logs.Create(good);
        result.Log.AbwG.ShouldBe(8m);
        result.Indicators.LatestSampleAbwG.ShouldBe(8m);
        (await logs.GetList(new GetLogsInput { BatchId = BatchId(CurrentBatch), LogType = LogType.GrowthSampling })).Items.First(l => l.Id == result.Log.Id).GrowthRateGPerDay.ShouldNotBeNull();

        var impossible = Log(LogType.GrowthSampling);
        impossible.Growth = new GrowthInput { SampleCount = 1, TotalSampleWeightG = 61m };
        await Should.ThrowAsync<UserFriendlyException>(() => logs.Create(impossible));

        var drop = Log(LogType.GrowthSampling);
        drop.ObservedAt = DateTime.UtcNow.AddMinutes(-1);
        drop.Growth = new GrowthInput { SampleCount = 50, TotalSampleWeightG = 300m }; // 6 g after 8 g
        (await logs.Create(drop)).Warnings.ShouldContain(w => w.Kind == "Growth");
    }

    // ---------------------------------------------------------------- mortality
    [Fact]
    public async Task Mortality_causes_need_their_detail_and_large_counts_warn()
    {
        var logs = Resolve<LogAppService>();
        var before = (await Resolve<BatchAppService>().Get(BatchId(CurrentBatch))).Indicators.EstimatedPopulation;

        var noName = Log(LogType.Mortality);
        noName.Mortality = new MortalityInput { Count = 10, Cause = MortalityCause.Disease };
        await Should.ThrowAsync<UserFriendlyException>(() => logs.Create(noName));
        var noOther = Log(LogType.Mortality);
        noOther.Mortality = new MortalityInput { Count = 10, Cause = MortalityCause.Others };
        await Should.ThrowAsync<UserFriendlyException>(() => logs.Create(noOther));

        var disease = Log(LogType.Mortality);
        disease.Mortality = new MortalityInput { Count = 3000, Cause = MortalityCause.Disease, DiseaseName = "AHPND", OtherCause = "ignored", Symptoms = "pale hepatopancreas" };
        var result = await logs.Create(disease);
        result.Indicators.EstimatedPopulation.ShouldBe(before - 3000);
        result.Log.Mortality.OtherCause.ShouldBeNull();
        result.Warnings.ShouldContain(w => w.Kind == "Mortality"); // over 1% of the estimated population
        result.Log.IsHighMortality.ShouldBeTrue();
        Q(c => c.FarmNotifications.IgnoreQueryFilters().Any(n => n.Type == FarmNotificationType.HighMortality)).ShouldBeFalse(); // DEC-49
        var dashboard = await Resolve<Dashboard.DashboardAppService>().Get();
        dashboard.HighMortality.ShouldContain(h => h.LogId == result.Log.Id);
        dashboard.Kpis.HighMortalityDays7Days.ShouldBeGreaterThanOrEqualTo(1);

        var waterQuality = Log(LogType.Mortality);
        waterQuality.Mortality = new MortalityInput { Count = 10, Cause = MortalityCause.WaterQuality };
        (await logs.Create(waterQuality)).Warnings.ShouldBeEmpty();
    }

    // ---------------------------------------------------------------- chemical and supplement application
    [Fact]
    public async Task Chemical_application_deducts_stock_and_rejects_feed()
    {
        var logs = Resolve<LogAppService>();
        var lime = LotId(LimeLot);
        var before = LotQty(lime);
        var input = Log(LogType.ChemicalApplication);
        input.ChemicalApplication = new ChemicalApplicationInput { Reason = "Low alkalinity", Usages = new() { new() { LotId = lime, Quantity = 20 } } };
        var saved = await logs.Create(input);
        LotQty(lime).ShouldBe(before - 20m);
        saved.Log.ChemicalApplication.Usages.Single().Quantity.ShouldBe(20m);

        var feed = Log(LogType.ChemicalApplication);
        feed.ChemicalApplication = new ChemicalApplicationInput { Usages = new() { new() { LotId = LotId(FeedLot), Quantity = 5 } } };
        await Should.ThrowAsync<UserFriendlyException>(() => logs.Create(feed));
        var zero = Log(LogType.ChemicalApplication);
        zero.ChemicalApplication = new ChemicalApplicationInput { Usages = new() { new() { LotId = lime, Quantity = 0 } } };
        await Should.ThrowAsync<UserFriendlyException>(() => logs.Create(zero));
    }

    [Fact]
    public async Task Retired_log_types_cannot_be_created()
    {
        var logs = Resolve<LogAppService>();
        foreach (var type in new[] { LogType.PondPreparation, LogType.Feeding, LogType.PostProduction })
        {
            var input = Log(type);
            input.Notes = "x";
            await Should.ThrowAsync<UserFriendlyException>(() => logs.Create(input));
        }
    }

    [Fact]
    public async Task Technician_edits_own_entries_only_and_edits_reverse_stock()
    {
        var logs = Resolve<LogAppService>();
        var lime = LotId(LimeLot);
        SaveLogInput Chemical(decimal qty) => new()
        {
            BatchId = BatchId(CurrentBatch), LogType = LogType.ChemicalApplication, ObservedAt = DateTime.UtcNow.AddMinutes(-10), ClientRequestId = Guid.NewGuid(),
            ChemicalApplication = new ChemicalApplicationInput { Reason = "Liming", Usages = new() { new() { LotId = lime, Quantity = qty } } },
        };
        var ownerLog = await logs.Create(Chemical(5m));

        LoginAsPilotTechnician();
        var edit = Chemical(6m);
        edit.Id = ownerLog.Log.Id;
        await Should.ThrowAsync<AbpAuthorizationException>(() => logs.Update(edit));

        var mine = await logs.Create(Chemical(10m));
        var before = LotQty(lime);
        var mineEdit = Chemical(12m);
        mineEdit.Id = mine.Log.Id;
        var updated = await logs.Update(mineEdit);
        updated.Log.ChemicalApplication.Usages.Single().Quantity.ShouldBe(12m);
        LotQty(lime).ShouldBe(before - 2m);
        Q(c => c.StockMovements.IgnoreQueryFilters().Count(m => m.SourceLogId == mine.Log.Id)).ShouldBe(3); // usage, reversal, new usage
    }

    [Fact]
    public async Task Owner_voids_a_log_with_a_reason_and_its_stock_returns()
    {
        var logs = Resolve<LogAppService>();
        var lime = LotId(LimeLot);
        var before = LotQty(lime);
        var input = Log(LogType.ChemicalApplication);
        input.ChemicalApplication = new ChemicalApplicationInput { Usages = new() { new() { LotId = lime, Quantity = 15 } } };
        var saved = await logs.Create(input);

        LoginAsPilotTechnician();
        await Should.ThrowAsync<AbpAuthorizationException>(() => logs.Void(new VoidInput { Id = saved.Log.Id, Reason = "x" }));
        LoginAsPilotOwner();
        await logs.Void(new VoidInput { Id = saved.Log.Id, Reason = "Duplicate entry" });
        LotQty(lime).ShouldBe(before);
        (await logs.GetList(new GetLogsInput { BatchId = BatchId(CurrentBatch) })).Items.ShouldNotContain(l => l.Id == saved.Log.Id);
        Q(c => c.ProductionLogs.IgnoreQueryFilters().Single(l => l.Id == saved.Log.Id).VoidReason).ShouldBe("Duplicate entry");

        // With "include voided" the entry comes back marked, with its reason and who voided it, and offers no actions.
        var withVoided = (await logs.GetList(new GetLogsInput { BatchId = BatchId(CurrentBatch), IncludeVoided = true })).Items.Single(l => l.Id == saved.Log.Id);
        withVoided.IsVoided.ShouldBeTrue();
        withVoided.VoidReason.ShouldBe("Duplicate entry");
        withVoided.VoidedBy.ShouldNotBeNullOrWhiteSpace();
        withVoided.CanEdit.ShouldBeFalse();
        withVoided.CanVoid.ShouldBeFalse();
        (await logs.GetTypeCounts(new GetLogsInput { BatchId = BatchId(CurrentBatch), IncludeVoided = true })).ShouldContain(x => x.Status == (int)LogType.ChemicalApplication && x.Count > 0);
        (await logs.GetTypeCounts(new GetLogsInput { BatchId = BatchId(CurrentBatch) })).Where(x => x.Status == (int)LogType.ChemicalApplication).Sum(x => x.Count)
            .ShouldBeLessThan((await logs.GetTypeCounts(new GetLogsInput { BatchId = BatchId(CurrentBatch), IncludeVoided = true })).Where(x => x.Status == (int)LogType.ChemicalApplication).Sum(x => x.Count));

        // The lot's ledger names the source of the usage and of its reversal.
        var ledger = await Resolve<Inventory.InventoryAppService>().GetMovements(lime);
        ledger.Where(m => m.SourceLogId == saved.Log.Id).ShouldAllBe(m => m.Source == "Chemical and supplement application");
    }

    [Fact]
    public async Task Feeding_movements_name_their_session_in_the_lot_ledger()
    {
        var saved = await Resolve<FeedingAppService>().Save(Session(12m, FeedingSessionTime.PM));
        var ledger = await Resolve<Inventory.InventoryAppService>().GetMovements(LotId(FeedLot));
        ledger.Single(m => m.FeedingSessionId == saved.Session.Id).Source.ShouldBe($"PM feeding, {Today:yyyy-MM-dd}");
    }
}
