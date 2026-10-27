using Abp.Authorization;
using Abp.UI;
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

/// <summary>Step C: fry deliveries, pond preparation, Create Batch (Stocking), failure and closure (AC-06 to AC-10, AC-15 to AC-17).</summary>
public class Lifecycle_Tests : FpmsTestBase
{
    private static List<ReadingInput> Baseline() => new()
    {
        new() { ParameterCode = ParameterCodes.Temperature, Value = 29m },
        new() { ParameterCode = ParameterCodes.Salinity, Value = 20m },
        new() { ParameterCode = ParameterCodes.PH, Value = 7.8m },
        new() { ParameterCode = ParameterCodes.DO, Value = 6m },
    };

    private BatchStockingInput Stocking(string pondCode, long pl, DateTime? at = null) => new()
    {
        PondId = PondId(pondCode), PlCount = pl, StockedAt = at ?? DateTime.UtcNow.AddMinutes(-1), TransportMode = TransportMode.Truck,
        TimeProcessed = (at ?? DateTime.UtcNow.AddMinutes(-1)).AddHours(-5), AcclimationMinutes = 45, InitialSurvivalEstimatePct = 95, Readings = Baseline(),
    };

    private async Task<Guid> NewPreparedPondAsync(int number)
    {
        var ponds = Resolve<PondAppService>();
        var id = await ponds.Create(new PondEditDto { PrefixId = PrefixId("GP"), Number = number, AreaM2 = 1000, AverageDepthM = 1.2m, MaxDepthM = 1.5m });
        await ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = id, ObservedAt = DateTime.UtcNow.AddDays(-3), Description = "Drained and limed" });
        await ponds.MarkPrepared(new Abp.Application.Services.Dto.EntityDto<Guid>(id));
        return id;
    }

    // ---------------------------------------------------------------- AC-06 fry deliveries
    [Fact]
    public async Task AC06_delivery_status_history_keeps_every_change_with_who_made_it()
    {
        var service = Resolve<FryDeliveryAppService>();
        var saved = await service.Create(new FryDeliveryEditDto
        {
            HatcheryId = HatcheryId(GetTenantId(PilotFarm)), HatcheryBatchNumber = "HL-NEW", DeliveryDate = new DateOnly(2026, 10, 21), PlAgeDays = 25, PlReceived = 100000,
        });
        saved.Warnings.ShouldContain(w => w.Kind == "PlAge");

        LoginAsPilotTechnician();
        await service.UpdateStatus(new UpdateFryDeliveryStatusInput { DeliveryId = saved.Id, Status = FryDeliveryStatus.InTransit, Note = "Left the hatchery 4 AM" });
        await service.UpdateStatus(new UpdateFryDeliveryStatusInput { DeliveryId = saved.Id, Status = FryDeliveryStatus.Received });
        await Should.ThrowAsync<UserFriendlyException>(() => service.UpdateStatus(new UpdateFryDeliveryStatusInput { DeliveryId = saved.Id, Status = FryDeliveryStatus.Received }));
        await Should.ThrowAsync<AbpAuthorizationException>(() => service.Update(new FryDeliveryEditDto { Id = saved.Id, HatcheryBatchNumber = "X", PlReceived = 1 }));

        var detail = await service.Get(saved.Id);
        detail.Status.ShouldBe(FryDeliveryStatus.Received);
        detail.History.Count.ShouldBe(3);
        detail.History.Select(h => h.ChangedBy).ShouldContain("Tomas Technician");
        detail.History.ShouldContain(h => h.Note == "Left the hatchery 4 AM");
    }

    [Fact]
    public async Task AC06_batch_number_is_unique_per_hatchery_and_stocked_delivery_status_is_fixed()
    {
        var service = Resolve<FryDeliveryAppService>();
        await Should.ThrowAsync<UserFriendlyException>(() => service.Create(new FryDeliveryEditDto
        {
            HatcheryId = HatcheryId(GetTenantId(PilotFarm)), HatcheryBatchNumber = "HL-0530", DeliveryDate = new DateOnly(2026, 10, 21), PlAgeDays = 12, PlReceived = 1000,
        }));
        var stocked = (await service.GetAll(new GetFryDeliveriesInput())).Items.Single(d => d.HatcheryBatchNumber == "HL-0530");
        stocked.IsStocked.ShouldBeTrue();
        stocked.PlLeft.ShouldBe(0);
        await Should.ThrowAsync<UserFriendlyException>(() => service.UpdateStatus(new UpdateFryDeliveryStatusInput { DeliveryId = stocked.Id, Status = FryDeliveryStatus.Rejected }));
    }

    // ---------------------------------------------------------------- AC-07 pond preparation
    [Fact]
    public async Task AC07_first_entry_opens_preparation_and_mark_prepared_needs_an_entry()
    {
        var ponds = Resolve<PondAppService>();
        var id = await ponds.Create(new PondEditDto { PrefixId = PrefixId("GP"), Number = 7, AreaM2 = 1000, AverageDepthM = 1.2m, MaxDepthM = 1.5m });
        (await ponds.Get(id)).Status.ShouldBe(PondDisplayStatus.Available);
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.MarkPrepared(new Abp.Application.Services.Dto.EntityDto<Guid>(id)));

        LoginAsPilotTechnician();
        await ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = id, ObservedAt = DateTime.UtcNow.AddDays(-2), Description = "Drained pond, drying started" });
        (await ponds.Get(id)).Status.ShouldBe(PondDisplayStatus.UnderPreparation);
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = id, ObservedAt = DateTime.UtcNow.AddDays(1), Description = "future" }));

        await ponds.MarkPrepared(new Abp.Application.Services.Dto.EntityDto<Guid>(id));
        var detail = await ponds.Get(id);
        detail.Status.ShouldBe(PondDisplayStatus.Prepared);
        detail.OpenRound.Entries.Count.ShouldBe(1);
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = id, ObservedAt = DateTime.UtcNow, Description = "more" }));

        LoginAsPilotOwner();
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.SetManualStatus(new SetPondStatusInput { Id = id, ManualStatus = PondManualStatus.UnderMaintenance }));
    }

    [Fact]
    public async Task AC07_a_stocked_pond_cannot_be_prepared_but_a_harvested_one_can()
    {
        var ponds = Resolve<PondAppService>();
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = PondId("GP-02"), ObservedAt = DateTime.UtcNow, Description = "x" }));
        (await ponds.Get(PondId("GP-01"))).Status.ShouldBe(PondDisplayStatus.PostHarvest);
        await ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = PondId("GP-01"), ObservedAt = DateTime.UtcNow.AddHours(-1), Description = "Sludge removed" });
        (await ponds.Get(PondId("GP-01"))).Status.ShouldBe(PondDisplayStatus.UnderPreparation);
    }

    // ---------------------------------------------------------------- AC-08 stepper options
    [Fact]
    public async Task AC08_stepper_offers_only_received_unused_deliveries_and_prepared_ponds()
    {
        var options = await Resolve<CycleAppService>().GetStockingOptions(new GetStockingOptionsInput());
        options.Deliveries.Select(d => d.HatcheryBatchNumber).ShouldBe(new[] { NewDelivery });
        options.Ponds.Select(p => p.PondCode).ShouldBe(new[] { "GP-03" });
        options.BlockedPonds.ShouldBeEmpty();
    }

    // ---------------------------------------------------------------- AC-09 Create Batch
    [Fact]
    public async Task AC09_create_batch_starts_an_active_cycle_with_generated_codes_in_one_step()
    {
        var other = await NewPreparedPondAsync(8);
        LoginAsPilotTechnician();
        var result = await Resolve<CycleAppService>().CreateBatches(new CreateBatchesInput
        {
            FryDeliveryId = DeliveryId(NewDelivery), ClientRequestId = Guid.NewGuid(),
            Batches = new() { Stocking("GP-03", 90000), Stocking("GP-08", 40000) },
        });
        var month = Domain.FarmClock.Today(Domain.FarmClock.Resolve(Domain.FarmClock.DefaultTimeZone)).ToString("yyyy-MM");
        result.CycleCreated.ShouldBeTrue();
        result.CycleCode.ShouldBe($"{month}-SBH-01");
        result.Batches.Select(b => b.BatchCode).ShouldBe(new[] { $"{month}-SBH-01-A", $"{month}-SBH-01-B" });
        result.Batches[0].StockingDensityPerM2.ShouldBe(60m); // 90,000 ÷ 1,500 m²
        result.PlLeft.ShouldBe(20000);
        // DEC-65 bands: GP-03 is intensive in an HDPE-lined pond (100–140), GP-08 semi-intensive earthen (40–60).
        result.Warnings.ShouldContain(w => w.Kind == "Density" && w.Message.StartsWith("GP-03") && w.Message.Contains("below"));
        result.Warnings.ShouldNotContain(w => w.Message.StartsWith("GP-08")); // 40 PL/m² is inside semi-intensive
        result.Batches[0].DensityFlag.ShouldBe(DensityFlag.Below);
        result.Batches[1].DensityFlag.ShouldBe(DensityFlag.Within);

        LoginAsPilotOwner();
        var cycle = await Resolve<CycleAppService>().Get(result.CycleId);
        cycle.Status.ShouldBe(CycleStatus.Active);
        cycle.BatchCount.ShouldBe(2);
        (await Resolve<PondAppService>().Get(PondId("GP-03"))).Status.ShouldBe(PondDisplayStatus.InProduction);
        (await Resolve<PondAppService>().Get(other)).OpenRound.ShouldBeNull();
        var batch = await Resolve<BatchAppService>().Get(result.Batches[0].Id);
        batch.Status.ShouldBe(BatchStatus.Stocked);
        batch.TransportMode.ShouldBe(TransportMode.Truck);
        batch.FarmingSystemAtStocking.ShouldBe(FarmingSystem.Intensive); // snapshot of the pond's override (DEC-52)
        batch.ConstructionTypeAtStocking.ShouldNotBeNull();
        batch.DensityFlag.ShouldBe(DensityFlag.Below);
        batch.HatcheryCertificationStatusAtStocking.ShouldContain("HC-2026-014");
        batch.LogCounts.ShouldContainKey(nameof(LogType.PreStockingWaterQuality));
        (await Resolve<FryDeliveryAppService>().Get(DeliveryId(NewDelivery))).IsStocked.ShouldBeTrue();
    }

    [Fact]
    public async Task AC09_allocations_cannot_exceed_the_pl_received_and_nothing_is_saved()
    {
        var cycles = Resolve<CycleAppService>();
        var before = Q(c => c.PondBatches.IgnoreQueryFilters().Count());
        await Should.ThrowAsync<UserFriendlyException>(() => cycles.CreateBatches(new CreateBatchesInput
        {
            FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { Stocking("GP-03", 150001) },
        }));
        Q(c => c.PondBatches.IgnoreQueryFilters().Count()).ShouldBe(before);
        Q(c => c.ProductionCycles.IgnoreQueryFilters().Count(x => x.TenantId == GetTenantId(PilotFarm))).ShouldBe(1);
    }

    [Fact]
    public async Task AC09_stepper_rules_reject_missing_readings_unprepared_ponds_and_bad_times()
    {
        var cycles = Resolve<CycleAppService>();
        var noReadings = Stocking("GP-03", 1000);
        noReadings.Readings = new() { new() { ParameterCode = ParameterCodes.PH, Value = 7.8m } };
        await ThrowsAny(() => cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { noReadings } }));
        await Should.ThrowAsync<UserFriendlyException>(() => cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { Stocking("GP-01", 1000) } }));
        await Should.ThrowAsync<UserFriendlyException>(() => cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { Stocking("GP-03", 1000, DateTime.UtcNow.AddDays(1)) } }));
        await Should.ThrowAsync<UserFriendlyException>(() => cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { Stocking("GP-03", 1000, new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc)) } }));
        var late = Stocking("GP-03", 1000);
        late.TimeProcessed = DateTime.UtcNow;
        await Should.ThrowAsync<UserFriendlyException>(() => cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { late } }));
        await Should.ThrowAsync<UserFriendlyException>(() => cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = DeliveryId("HL-0530"), Batches = new() { Stocking("GP-03", 1000) } }));
    }

    [Fact]
    public async Task AC09_a_retried_submit_does_not_create_twice()
    {
        var cycles = Resolve<CycleAppService>();
        var input = new CreateBatchesInput { FryDeliveryId = DeliveryId(NewDelivery), ClientRequestId = Guid.NewGuid(), Batches = new() { Stocking("GP-03", 50000) } };
        var first = await cycles.CreateBatches(input);
        var again = await cycles.CreateBatches(input);
        again.WasDuplicate.ShouldBeTrue();
        again.CycleId.ShouldBe(first.CycleId);
        Q(c => c.PondBatches.IgnoreQueryFilters().Count(b => b.CycleId == first.CycleId)).ShouldBe(1);
    }

    // ---------------------------------------------------------------- AC-10 add batches later
    [Fact]
    public async Task AC10_more_batches_can_be_added_while_pl_is_left_even_the_same_day()
    {
        var cycles = Resolve<CycleAppService>();
        var first = await cycles.CreateBatches(new CreateBatchesInput { FryDeliveryId = DeliveryId(NewDelivery), Batches = new() { Stocking("GP-03", 100000) } });
        await NewPreparedPondAsync(9);
        var options = await cycles.GetStockingOptions(new GetStockingOptionsInput { CycleId = first.CycleId });
        options.Deliveries.Single().PlLeft.ShouldBe(50000);
        options.Ponds.Select(p => p.PondCode).ShouldBe(new[] { "GP-09" });

        var second = await cycles.CreateBatches(new CreateBatchesInput { CycleId = first.CycleId, Batches = new() { Stocking("GP-09", 50000) } });
        second.CycleCreated.ShouldBeFalse();
        second.Batches.Single().BatchCode.ShouldEndWith("-B");
        second.PlLeft.ShouldBe(0);
        (await cycles.Get(first.CycleId)).CanCreateBatch.ShouldBeFalse();
    }

    // ---------------------------------------------------------------- AC-15, AC-16, AC-17
    [Fact]
    public async Task AC15_declare_failure_makes_the_batch_failed_and_the_pond_post_harvest()
    {
        var batches = Resolve<BatchAppService>();
        var id = BatchId(CurrentBatch);
        var today = Domain.FarmClock.Today(Domain.FarmClock.Resolve(Domain.FarmClock.DefaultTimeZone));
        await Should.ThrowAsync<UserFriendlyException>(() => batches.DeclareFailure(new FailureInput { Id = id, Reason = "x", FailureDate = today.AddDays(1) }));
        await batches.DeclareFailure(new FailureInput { Id = id, Reason = "WSSV outbreak", FailureDate = today, EstimatedLossPhp = 250000 });

        var detail = await batches.Get(id);
        detail.Status.ShouldBe(BatchStatus.Failed);
        detail.FailureReason.ShouldBe("WSSV outbreak");
        detail.CanAddHarvest.ShouldBeTrue(); // salvage harvest
        (await Resolve<PondAppService>().Get(PondId("GP-02"))).Status.ShouldBe(PondDisplayStatus.PostHarvest);
        (await Resolve<Reports.ReportAppService>().GetFailureReport(new Reports.Dto.FailureReportInput { BatchId = id })).Batches.Single().EstimatedLossPhp.ShouldBe(250000m);
        await Should.ThrowAsync<UserFriendlyException>(() => batches.DeclareFailure(new FailureInput { Id = id, Reason = "again", FailureDate = today }));
    }

    [Fact]
    public async Task AC16_closing_a_batch_fixes_final_indicators_and_locks_records()
    {
        var batches = Resolve<BatchAppService>();
        await Should.ThrowAsync<UserFriendlyException>(() => batches.Close(new CloseBatchInput { Id = BatchId(CurrentBatch), ConfirmReadOnly = true }));

        var batchId = BatchId(ReferenceBatch);
        var closed = await batches.Close(new CloseBatchInput { Id = batchId, ConfirmReadOnly = true });
        closed.FinalFcr.ShouldBe(1.2m);
        var batch = Q(c => c.PondBatches.IgnoreQueryFilters().Single(b => b.Id == batchId));
        batch.Status.ShouldBe(BatchStatus.Closed);
        batch.SurvivalRatePct.ShouldBe(71.25m);
        batch.TotalHarvestKg.ShouldBe(2500m);
        batch.CultureDays.ShouldBe(99);

        var ex = await Should.ThrowAsync<UserFriendlyException>(() => Resolve<LogAppService>().Create(new SaveLogInput
        {
            BatchId = batchId, LogType = LogType.GeneralNote, ObservedAt = DateTime.UtcNow, Notes = "late note", ClientRequestId = Guid.NewGuid(),
        }));
        ex.Message.ShouldContain("read-only");
        (await Resolve<PondAppService>().Get(PondId("GP-01"))).Status.ShouldBe(PondDisplayStatus.Available);
    }

    [Fact]
    public async Task AC17_cycle_closes_only_when_every_batch_is_closed()
    {
        var cycles = Resolve<CycleAppService>();
        var batches = Resolve<BatchAppService>();
        var cycleId = CycleId("C-2026-01");
        await Should.ThrowAsync<UserFriendlyException>(() => cycles.Close(new CloseCycleInput { Id = cycleId }));

        var today = Domain.FarmClock.Today(Domain.FarmClock.Resolve(Domain.FarmClock.DefaultTimeZone));
        await batches.Close(new CloseBatchInput { Id = BatchId(ReferenceBatch), ConfirmReadOnly = true });
        await batches.DeclareFailure(new FailureInput { Id = BatchId(CurrentBatch), Reason = "Crop lost", FailureDate = today });
        (await cycles.Get(cycleId)).CanClose.ShouldBeFalse();
        await batches.Close(new CloseBatchInput { Id = BatchId(CurrentBatch), ConfirmReadOnly = true });

        (await cycles.Get(cycleId)).CanClose.ShouldBeTrue();
        await Should.ThrowAsync<UserFriendlyException>(() => cycles.Close(new CloseCycleInput { Id = cycleId })); // outcome required (DEC-64)
        (await cycles.Get(cycleId)).SuggestedOutcome.ShouldBe(CycleOutcome.Completed); // one batch harvested, one failed
        await cycles.Close(new CloseCycleInput { Id = cycleId, Outcome = CycleOutcome.Completed });
        var closed = await cycles.Get(cycleId);
        closed.Status.ShouldBe(CycleStatus.Closed);
        closed.CanCreateBatch.ShouldBeFalse();
        (await Resolve<Reports.ReportAppService>().GetCyclePerformance(cycleId)).IsFinal.ShouldBeTrue();
    }

    [Fact]
    public async Task Technician_cannot_declare_failure_or_close()
    {
        LoginAsPilotTechnician();
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<BatchAppService>().Close(new CloseBatchInput { Id = BatchId(ReferenceBatch), ConfirmReadOnly = true }));
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<CycleAppService>().Close(new CloseCycleInput { Id = CycleId("C-2026-01") }));
    }

    [Fact]
    public void Batch_letters_run_A_to_Z_then_AA()
    {
        CycleAppService.NextLetter(new List<string>()).ShouldBe("A");
        CycleAppService.NextLetter(new List<string> { "A", "B" }).ShouldBe("C");
        CycleAppService.NextLetter(Enumerable.Range(0, 26).Select(i => ((char)('A' + i)).ToString()).ToList()).ShouldBe("AA");
    }
}
