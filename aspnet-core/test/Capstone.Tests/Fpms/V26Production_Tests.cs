using Abp.Authorization;
using Abp.UI;
using Capstone.Domain;
using Capstone.Harvests;
using Capstone.Inventory;
using Capstone.Logbooks;
using Capstone.Logbooks.Dto;
using Capstone.Ponds;
using Capstone.Production;
using Capstone.Production.Dto;
using Capstone.ReferenceData;
using Capstone.Resources;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>
/// v2.6 production changes: stocking window and Finish stocking (DEC-63), reopening and cycle outcome (DEC-64), density
/// bands (DEC-65), logs within the batch's life (DEC-66), water ranges (DEC-56), Farm Standards (DEC-58), PL certificate and
/// dead at stocking (DEC-59), treatment withdrawal (DEC-57; banned-substance list dropped), pack sizes and lot order (DEC-68).
/// </summary>
public class V26Production_Tests : FpmsTestBase
{
    private static TimeZoneInfo Zone => FarmClock.Resolve(FarmClock.DefaultTimeZone);
    private static DateOnly Today => FarmClock.Today(Zone);

    private static List<ReadingInput> Baseline() => new()
    {
        new() { ParameterCode = ParameterCodes.Temperature, Value = 29m },
        new() { ParameterCode = ParameterCodes.Salinity, Value = 20m },
        new() { ParameterCode = ParameterCodes.PH, Value = 7.8m },
        new() { ParameterCode = ParameterCodes.DO, Value = 6m },
    };

    private BatchStockingInput Stocking(string pondCode, long pl, DateTime? at = null, long? dead = null) => new()
    {
        PondId = PondId(pondCode), PlCount = pl, StockedAt = at ?? DateTime.UtcNow.AddMinutes(-1), TransportMode = TransportMode.Truck,
        AcclimationMinutes = 45, InitialSurvivalEstimatePct = 95, DeadAtStocking = dead, Readings = Baseline(),
    };

    private async Task<Guid> NewDeliveryAsync(string number, DateOnly received, long pl = 100000)
    {
        var result = await Resolve<FryDeliveryAppService>().Create(new FryDeliveryEditDto
        {
            HatcheryId = HatcheryId(GetTenantId(PilotFarm)), HatcheryBatchNumber = number, DeliveryDate = received, PlAgeDays = 12, PlReceived = pl,
            PlHealthCertificateNo = $"PLHC-{number}", InitialStatus = FryDeliveryStatus.Received,
        });
        return result.Id;
    }

    // ---------------------------------------------------------------- DEC-76: no stocking window
    [Fact]
    public async Task Stocking_date_may_be_any_day_from_the_received_date_to_today()
    {
        var old = await NewDeliveryAsync("HL-OLD", Today.AddDays(-5));
        var cycles = Resolve<CycleAppService>();
        // Five days after it was received is accepted: there is no window, so entering a paper sheet late never blocks.
        var viaToday = await cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = old, Batches = new() { Stocking("GP-03", 50000) } });
        viaToday.Batches.Single().BatchCode.ShouldNotBeNull();

        // A date on the day after receipt is accepted too. The seed has only GP-01 to GP-03 (GP-03 is used above), so
        // add a fourth grow-out pond and mark it Prepared.
        var ponds = Resolve<PondAppService>();
        var newPondId = await ponds.Create(new PondEditDto
        {
            PrefixId = PrefixId("GP"), AreaM2 = 1000, AverageDepthM = 1.2m, MaxDepthM = 1.5m,
            Purpose = PondPurpose.GrowOut, ConstructionType = PondConstructionType.Earthen,
        });
        await ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = newPondId, ObservedAt = DateTime.UtcNow.AddMinutes(-30), Description = "Drained and limed" });
        await ponds.MarkPrepared(new Abp.Application.Services.Dto.EntityDto<Guid>(newPondId));
        (await ponds.Get(newPondId)).PondCode.ShouldBe("GP-04");

        var older = await NewDeliveryAsync("HL-OLD2", Today.AddDays(-5));
        var dayAfter = FarmClock.StartOfDayUtc(Today.AddDays(-4), Zone).AddHours(9);
        var ok = await cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = older, Batches = new() { Stocking("GP-04", 50000, dayAfter) } });
        ok.Batches.Single().BatchCode.ShouldNotBeNull();
    }

    [Fact]
    public async Task Stocking_before_the_received_date_is_rejected()
    {
        var cycles = Resolve<CycleAppService>();
        await Should.ThrowAsync<UserFriendlyException>(() => cycles.CreateBatches(new CreateBatchesInput
        {
            FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { Stocking("GP-03", 50000, FarmClock.StartOfDayUtc(Today.AddDays(-1), Zone).AddHours(9)) },
        }));
    }

    [Fact]
    public async Task Delivery_picker_lists_newest_first_and_offers_old_deliveries_too()
    {
        await NewDeliveryAsync("HL-OLDER", Today.AddDays(-6));
        var options = await Resolve<CycleAppService>().GetStockingOptions(new GetStockingOptionsInput());
        options.Deliveries.Select(d => d.DeliveryDate).ShouldBe(options.Deliveries.Select(d => d.DeliveryDate).OrderByDescending(d => d));
        var fresh = options.Deliveries.Single(d => d.HatcheryBatchNumber == NewDelivery);
        fresh.DaysSinceReceived.ShouldBe(0);
        fresh.PlHealthCertificateNo.ShouldBe("PLHC-2026-1020");
        var older = options.Deliveries.Single(d => d.HatcheryBatchNumber == "HL-OLDER");
        older.DaysSinceReceived.ShouldBe(6);
    }

    [Fact]
    public async Task Finish_stocking_accounts_for_every_pl_and_closes_the_delivery()
    {
        var cycles = Resolve<CycleAppService>();
        var created = await cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { Stocking("GP-03", 100000) } });
        var deliveries = Resolve<FryDeliveryAppService>();
        var detail = await deliveries.Get(DeliveryId(NewDelivery));
        detail.CanFinishStocking.ShouldBeTrue();

        // 150,000 received − 100,000 stocked = 50,000 to account for.
        await Should.ThrowAsync<UserFriendlyException>(() => deliveries.FinishStocking(new FinishStockingInput
        {
            DeliveryId = detail.Id, RowVersion = detail.RowVersion, Shortfalls = new() { new() { Reason = ShortfallReason.DeadOnArrival, Count = 30000 } },
        }));

        LoginAsPilotTechnician();
        await Should.ThrowAsync<AbpAuthorizationException>(() => deliveries.FinishStocking(new FinishStockingInput { DeliveryId = detail.Id, RowVersion = detail.RowVersion }));
        LoginAsPilotOwner();

        await deliveries.FinishStocking(new FinishStockingInput
        {
            DeliveryId = detail.Id, RowVersion = detail.RowVersion,
            Shortfalls = new() { new() { Reason = ShortfallReason.DeadOnArrival, Count = 30000 }, new() { Reason = ShortfallReason.CountDifference, Count = 20000, Note = "Hatchery count was high" } },
        });

        var finished = await deliveries.Get(detail.Id);
        finished.IsStockingFinished.ShouldBeTrue();
        finished.PlStocked.ShouldBe(100000);
        finished.PlNotStocked.ShouldBe(50000);
        finished.PlLeft.ShouldBe(0);
        finished.Shortfalls.Count.ShouldBe(2);
        finished.StockingFinishedBy.ShouldNotBeNull();

        await Should.ThrowAsync<UserFriendlyException>(() => cycles.GetStockingOptions(new GetStockingOptionsInput { CycleId = created.CycleId }));
        await Should.ThrowAsync<UserFriendlyException>(() => cycles.CreateBatches(new CreateBatchesInput { CycleId = created.CycleId, Batches = new() { Stocking("GP-02", 1000) } }));
        (await cycles.Get(created.CycleId)).CanCreateBatch.ShouldBeFalse();
    }

    [Fact]
    public async Task Dashboard_lists_open_deliveries_from_earlier_days_that_still_have_pl_left()
    {
        var old = await NewDeliveryAsync("HL-WAITING", Today.AddDays(-4));
        var dashboard = await Resolve<Dashboard.DashboardAppService>().Get();
        dashboard.FinishStocking.ShouldContain(d => d.Id == old);
        dashboard.FinishStocking.ShouldNotContain(d => d.HatcheryBatchNumber == NewDelivery); // received today: nothing to finish yet
    }

    // ---------------------------------------------------------------- DEC-59
    [Fact]
    public async Task Dead_at_stocking_is_stored_and_warns_above_the_count()
    {
        var created = await Resolve<CycleAppService>().CreateBatches(new CreateBatchesInput
        {
            FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { Stocking("GP-03", 1000, dead: 1200) },
        });
        created.Warnings.ShouldContain(w => w.Kind == "DeadAtStocking");
        var batch = await Resolve<BatchAppService>().Get(created.Batches.Single().Id);
        batch.DeadAtStocking.ShouldBe(1200);
        batch.PlHealthCertificateNo.ShouldBe("PLHC-2026-1020");
    }

    // ---------------------------------------------------------------- DEC-70 SFSC number
    [Fact]
    public async Task Sfsc_number_is_optional_trimmed_and_shown_on_the_batch()
    {
        var deliveries = Resolve<FryDeliveryAppService>();
        var created = await deliveries.Create(new FryDeliveryEditDto
        {
            HatcheryId = HatcheryId(GetTenantId(PilotFarm)), HatcheryBatchNumber = "HL-SFSC", DeliveryDate = Today, PlAgeDays = 12, PlReceived = 100000,
            SfscNo = "  SFSC-2026-0042 ", InitialStatus = FryDeliveryStatus.Received,
        });
        (await deliveries.Get(created.Id)).SfscNo.ShouldBe("SFSC-2026-0042");

        var plain = await NewDeliveryAsync("HL-NOSFSC", Today);
        (await deliveries.Get(plain)).SfscNo.ShouldBeNull();

        var stocked = await Resolve<CycleAppService>().CreateBatches(new CreateBatchesInput { FryDeliveryId = created.Id, Batches = new() { Stocking("GP-03", 50000) } });
        (await Resolve<BatchAppService>().Get(stocked.Batches.Single().Id)).SfscNo.ShouldBe("SFSC-2026-0042");
    }

    // ---------------------------------------------------------------- DEC-64 reopening and outcome
    [Fact]
    public async Task Owner_reopens_a_closed_batch_with_a_reason_and_it_returns_to_harvested()
    {
        var batches = Resolve<BatchAppService>();
        var id = BatchId(ReferenceBatch);
        var closed = await batches.Get(id);
        await batches.Close(new CloseBatchInput { Id = id, ConfirmReadOnly = true, RowVersion = closed.RowVersion });
        var detail = await batches.Get(id);
        detail.CanReopen.ShouldBeTrue();
        detail.FinalFcr.ShouldNotBeNull();

        await Should.ThrowAsync<Exception>(() => batches.Reopen(new ReopenInput { Id = id, Reason = "", RowVersion = detail.RowVersion }));
        LoginAsPilotTechnician();
        await Should.ThrowAsync<AbpAuthorizationException>(() => batches.Reopen(new ReopenInput { Id = id, Reason = "Wrong harvest kg", RowVersion = detail.RowVersion }));
        LoginAsPilotOwner();

        await batches.Reopen(new ReopenInput { Id = id, Reason = "Final harvest kg was entered wrong", RowVersion = detail.RowVersion });
        var reopened = await batches.Get(id);
        reopened.Status.ShouldBe(BatchStatus.Harvested);
        reopened.FinalFcr.ShouldBeNull();
        reopened.IsReadOnly.ShouldBeFalse();
        reopened.Reopenings.Single().Reason.ShouldBe("Final harvest kg was entered wrong");

        // Re-closing recomputes the final indicators.
        await batches.Close(new CloseBatchInput { Id = id, ConfirmReadOnly = true, RowVersion = reopened.RowVersion });
        (await batches.Get(id)).FinalFcr.ShouldBe(1.2m);
    }

    [Fact]
    public async Task A_batch_in_a_closed_cycle_is_reopened_only_after_the_cycle()
    {
        var cycles = Resolve<CycleAppService>();
        var batches = Resolve<BatchAppService>();
        var cycleId = CycleId("C-2026-01");
        await batches.Close(new CloseBatchInput { Id = BatchId(ReferenceBatch), ConfirmReadOnly = true });
        await batches.DeclareFailure(new FailureInput { Id = BatchId(CurrentBatch), Reason = "Crop lost", FailureDate = Today });
        await batches.Close(new CloseBatchInput { Id = BatchId(CurrentBatch), ConfirmReadOnly = true });
        await cycles.Close(new CloseCycleInput { Id = cycleId, Outcome = CycleOutcome.Completed });

        var failedBatch = await batches.Get(BatchId(CurrentBatch));
        failedBatch.CanReopen.ShouldBeFalse();
        failedBatch.ReopenBlockedReason.ShouldContain("Reopen the cycle first");
        await Should.ThrowAsync<UserFriendlyException>(() => batches.Reopen(new ReopenInput { Id = failedBatch.Id, Reason = "Mortality entered on the wrong pond", RowVersion = failedBatch.RowVersion }));

        var cycle = await cycles.Get(cycleId);
        cycle.CanReopen.ShouldBeTrue();
        cycle.Outcome.ShouldBe(CycleOutcome.Completed);
        await cycles.Reopen(new ReopenInput { Id = cycleId, Reason = "A batch needs a correction", RowVersion = cycle.RowVersion });
        var active = await cycles.Get(cycleId);
        active.Status.ShouldBe(CycleStatus.Active);
        active.Outcome.ShouldBeNull();
        active.Reopenings.Count.ShouldBe(1);

        failedBatch = await batches.Get(BatchId(CurrentBatch));
        await batches.Reopen(new ReopenInput { Id = failedBatch.Id, Reason = "Mortality entered on the wrong pond", RowVersion = failedBatch.RowVersion });
        (await batches.Get(failedBatch.Id)).Status.ShouldBe(BatchStatus.Failed); // it has a failure record
    }

    [Fact]
    public async Task Outcome_is_suggested_as_failed_when_every_batch_failed()
    {
        var cycles = Resolve<CycleAppService>();
        var batches = Resolve<BatchAppService>();
        var created = await cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { Stocking("GP-03", 100000) } });
        var batchId = created.Batches.Single().Id;
        await batches.DeclareFailure(new FailureInput { Id = batchId, Reason = "WSSV outbreak", FailureDate = Today });
        await batches.Close(new CloseBatchInput { Id = batchId, ConfirmReadOnly = true });
        var cycle = await cycles.Get(created.CycleId);
        cycle.SuggestedOutcome.ShouldBe(CycleOutcome.Failed);
        await cycles.Close(new CloseCycleInput { Id = created.CycleId, Outcome = CycleOutcome.Failed, RowVersion = cycle.RowVersion });
        (await cycles.Get(created.CycleId)).Outcome.ShouldBe(CycleOutcome.Failed);
    }

    [Fact]
    public async Task A_batch_cannot_be_reopened_while_its_pond_has_a_new_open_batch()
    {
        var batches = Resolve<BatchAppService>();
        await batches.Close(new CloseBatchInput { Id = BatchId(ReferenceBatch), ConfirmReadOnly = true });
        // Prepare P-01 again and stock it from the new delivery.
        var ponds = Resolve<PondAppService>();
        var pondId = PondId("GP-01");
        await ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = pondId, ObservedAt = DateTime.UtcNow.AddMinutes(-30), Description = "Drained and limed" });
        await ponds.MarkPrepared(new Abp.Application.Services.Dto.EntityDto<Guid>(pondId));
        await Resolve<CycleAppService>().CreateBatches(new CreateBatchesInput { FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { Stocking("GP-01", 50000) } });

        var old = await batches.Get(BatchId(ReferenceBatch));
        old.CanReopen.ShouldBeFalse();
        old.ReopenBlockedReason.ShouldContain("already has open batch");
    }

    // ---------------------------------------------------------------- DEC-65 bands
    [Fact]
    public async Task Density_bands_follow_the_2025_standard_per_construction_type()
    {
        async Task<DensityFlag?> Judge(FarmingSystem system, PondConstructionType construction, decimal value) =>
            await InUow(async () => (await Resolve<DensityEvaluator>().JudgeAsync(system, construction, value)).Flag);
        (await Judge(FarmingSystem.Intensive, PondConstructionType.Earthen, 80m)).ShouldBe(DensityFlag.Within);
        (await Judge(FarmingSystem.Intensive, PondConstructionType.Concrete, 80m)).ShouldBe(DensityFlag.Below);
        (await Judge(FarmingSystem.Intensive, PondConstructionType.HdpeLined, 141m)).ShouldBe(DensityFlag.Above);
        (await Judge(FarmingSystem.SemiIntensive, PondConstructionType.Earthen, 35m)).ShouldBe(DensityFlag.Below); // between bands
        (await Judge(FarmingSystem.Extensive, PondConstructionType.Earthen, 30m)).ShouldBe(DensityFlag.Within);
        Q(c => c.DensityBands.Count()).ShouldBe(9);
    }

    // ---------------------------------------------------------------- DEC-58 Farm Standards
    [Fact]
    public async Task Farm_standards_override_water_ranges_for_new_readings_only_and_reset()
    {
        var logs = Resolve<LogAppService>();
        SaveLogInput Reading(decimal doValue) => new()
        {
            BatchId = BatchId(CurrentBatch), LogType = LogType.WaterQuality, ObservedAt = DateTime.UtcNow.AddMinutes(-5), ClientRequestId = Guid.NewGuid(),
            Readings = new() { new() { ParameterCode = ParameterCodes.DO, Value = doValue } },
        };

        var before = await logs.Create(Reading(4.5m));
        before.Log.HasOutOfRange.ShouldBeFalse();

        var standards = Resolve<FarmStandardsAppService>();
        await standards.SetParameterRange(new SetParameterRangeInput { Code = ParameterCodes.DO, OptimalMin = 5m });
        var dto = await standards.Get();
        var row = dto.Parameters.Single(p => p.Code == ParameterCodes.DO);
        row.Differs.ShouldBeTrue();
        row.StandardMin.ShouldBe(4m);
        row.Source.ShouldContain("197:2025");

        var after = await Resolve<LogAppService>().Create(Reading(4.5m));
        after.Log.HasOutOfRange.ShouldBeTrue();
        // The earlier reading keeps the flag it was judged with.
        Q(c => c.WaterQualityMeasurements.IgnoreQueryFilters().Single(m => m.LogId == before.Log.Id).IsOutOfRange).ShouldBeFalse();

        await standards.ResetParameterRange(new CodeInput { Code = ParameterCodes.DO });
        (await Resolve<LogAppService>().Create(Reading(4.5m))).Log.HasOutOfRange.ShouldBeFalse();
        (await standards.Get()).Parameters.Single(p => p.Code == ParameterCodes.DO).Differs.ShouldBeFalse();
    }

    [Fact]
    public async Task Farm_standards_override_density_bands_thresholds_and_the_stocking_window()
    {
        var standards = Resolve<FarmStandardsAppService>();
        await standards.SetDensityBand(new SetDensityBandInput { FarmingSystem = FarmingSystem.Intensive, ConstructionType = PondConstructionType.HdpeLined, MinPlM2 = 50, MaxPlM2 = 70 });
        var judged = await InUow(() => Resolve<DensityEvaluator>().JudgeAsync(FarmingSystem.Intensive, PondConstructionType.HdpeLined, 60m));
        judged.Flag.ShouldBe(DensityFlag.Within);
        judged.IsFarmValue.ShouldBeTrue();

        await standards.SetThreshold(new SetThresholdInput { Code = FarmThresholds.PlAgeMax, Value = 15 });
        await Should.ThrowAsync<UserFriendlyException>(() => standards.SetThreshold(new SetThresholdInput { Code = FarmThresholds.PlAgeMin, Value = 16 }));
        await Should.ThrowAsync<UserFriendlyException>(() => standards.SetThreshold(new SetThresholdInput { Code = FarmThresholds.FeedSpikeMultiplier, Value = 50 }));
        var warn = await Resolve<FryDeliveryAppService>().Create(new FryDeliveryEditDto
        {
            HatcheryId = HatcheryId(GetTenantId(PilotFarm)), HatcheryBatchNumber = "HL-AGE", DeliveryDate = Today, PlAgeDays = 18, PlReceived = 1000,
        });
        warn.Warnings.ShouldContain(w => w.Kind == "PlAge" && w.Message.Contains("PL10–PL15"));

        var old = await NewDeliveryAsync("HL-3DAYS", Today.AddDays(-3));
        (await Resolve<CycleAppService>().CreateBatches(new CreateBatchesInput { FryDeliveryId = old, Batches = new() { Stocking("GP-03", 50000) } })).Batches.Count.ShouldBe(1);

        LoginAsPilotTechnician();
        (await standards.Get()).CanEdit.ShouldBeFalse();
    }

    [Fact]
    public async Task Owner_marks_the_standards_reviewed_for_the_setup_checklist()
    {
        var dashboard = Resolve<Dashboard.DashboardAppService>();
        (await dashboard.Get()).SetupTasks.Single(t => t.Key == "standards").Done.ShouldBeFalse();
        await Resolve<FarmStandardsAppService>().MarkReviewed();
        (await Resolve<Dashboard.DashboardAppService>().Get()).SetupTasks.Single(t => t.Key == "standards").Done.ShouldBeTrue();
    }

    // ---------------------------------------------------------------- DEC-66
    [Fact]
    public async Task A_note_dated_before_stocking_is_rejected()
    {
        var note = new SaveLogInput
        {
            BatchId = BatchId(CurrentBatch), LogType = LogType.GeneralNote, ObservedAt = new DateTime(2026, 9, 10, 2, 0, 0, DateTimeKind.Utc), Notes = "early", ClientRequestId = Guid.NewGuid(),
        };
        (await Should.ThrowAsync<UserFriendlyException>(() => Resolve<LogAppService>().Create(note))).Message.ShouldContain("stocking date");
    }

    // ---------------------------------------------------------------- DEC-57 treatments
    [Fact]
    public async Task Treatment_with_withdrawal_days_sets_a_safe_harvest_date_and_an_early_harvest_warns()
    {
        UsingDbContext(context =>
        {
            var lot = context.InventoryLots.IgnoreQueryFilters().Include(l => l.Item).Single(l => l.LotNumber == LimeLot);
            lot.Item.ActiveIngredient = "Oxytetracycline";
            lot.Item.DefaultWithdrawalDays = 10;
        });

        var options = await Resolve<InventoryAppService>().GetLotOptions(null);
        options.Single(o => o.LotId == LotId(LimeLot)).DefaultWithdrawalDays.ShouldBe(10);

        var input = new SaveLogInput
        {
            BatchId = BatchId(CurrentBatch), LogType = LogType.ChemicalApplication, ObservedAt = DateTime.UtcNow.AddMinutes(-5), ClientRequestId = Guid.NewGuid(),
            ChemicalApplication = new ChemicalApplicationInput
            {
                Reason = "Bacterial check", Dosage = 2m, DosageUnit = "ppm", Method = "Broadcast", EndDate = Today.AddDays(2), WithdrawalDays = 10, PrescriptionRef = "RX-1",
                Usages = new() { new() { LotId = LotId(LimeLot), Quantity = 5m } },
            },
        };
        var result = await Resolve<LogAppService>().Create(input);
        result.Warnings.ShouldContain(w => w.Kind == "Withdrawal");
        result.Log.SafeHarvestDate.ShouldBe(Today.AddDays(12));
        result.Log.ChemicalApplication.Method.ShouldBe("Broadcast");
        (await Resolve<BatchAppService>().Get(BatchId(CurrentBatch))).EarliestSafeHarvestDate.ShouldBe(Today.AddDays(12));

        var harvest = await Resolve<HarvestAppService>().Create(new SaveHarvestInput
        {
            BatchId = BatchId(CurrentBatch), HarvestedAt = DateTime.UtcNow.AddMinutes(-1), HarvestType = HarvestType.Partial, TotalKg = 100m, AbwG = 12m,
        });
        harvest.Warnings.ShouldContain(w => w.Kind == "Withdrawal");

        var badEnd = new SaveLogInput
        {
            BatchId = BatchId(CurrentBatch), LogType = LogType.ChemicalApplication, ObservedAt = DateTime.UtcNow.AddMinutes(-5), ClientRequestId = Guid.NewGuid(),
            ChemicalApplication = new ChemicalApplicationInput { EndDate = Today.AddDays(-3), Usages = new() { new() { LotId = LotId(LimeLot), Quantity = 1m } } },
        };
        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<LogAppService>().Create(badEnd));
    }

    // ---------------------------------------------------------------- DEC-68
    [Fact]
    public async Task Receipts_can_be_entered_in_packs_and_lots_are_offered_earliest_expiry_first()
    {
        var inventory = Resolve<InventoryAppService>();
        var feedItem = (await inventory.GetItems()).First(i => i.Category == InventoryCategory.Feed);
        feedItem.PackSize = 25m;
        await inventory.SaveItem(feedItem);

        var receipt = await inventory.RecordReceipt(new RecordReceiptInput
        {
            ItemId = feedItem.Id, LotNumber = "FG-PACKS", ReceivedDate = Today, ExpiryDate = Today.AddDays(5), PackCount = 40, PackCost = 1500m,
        });
        receipt.QuantityOnHand.ShouldBe(1000m);
        receipt.UnitCost.ShouldBe(60m);

        await Should.ThrowAsync<UserFriendlyException>(() => inventory.RecordReceipt(new RecordReceiptInput { ItemId = feedItem.Id, LotNumber = "FG-NONE", ReceivedDate = Today }));

        var lots = await inventory.GetLotOptions(InventoryCategory.Feed);
        lots.First().LotId.ShouldBe(receipt.LotId); // expires soonest
        lots.Where(l => l.QuantityOnHand > 0).Select(l => l.ExpiryDate ?? DateOnly.MaxValue)
            .ShouldBe(lots.Where(l => l.QuantityOnHand > 0).Select(l => l.ExpiryDate ?? DateOnly.MaxValue).OrderBy(d => d));
    }
}
