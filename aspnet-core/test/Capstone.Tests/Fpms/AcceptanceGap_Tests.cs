using Abp.UI;
using Capstone.Compliance;
using Capstone.Dashboard;
using Capstone.Domain;
using Capstone.Harvests;
using Capstone.Inventory;
using Capstone.Logbooks;
using Capstone.Logbooks.Dto;
using Capstone.Ponds;
using Capstone.Production;
using Capstone.Production.Dto;
using Capstone.ReferenceData;
using Capstone.Reports;
using Capstone.Sales;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>
/// Milestone 8: acceptance criteria that the earlier suites covered only in part
/// (AC-03 expiry and reminders, AC-04, AC-06, AC-16 single batch, AC-18 full closure, AC-20, AC-21 writes and reports).
/// </summary>
public class AcceptanceGap_Tests : FpmsTestBase
{
    private static DateOnly FarmToday() => FarmClock.Today(FarmClock.Resolve(FarmClock.DefaultTimeZone));

    private static List<ReadingInput> Baseline() => new()
    {
        new() { ParameterCode = ParameterCodes.Temperature, Value = 29m },
        new() { ParameterCode = ParameterCodes.Salinity, Value = 20m },
        new() { ParameterCode = ParameterCodes.PH, Value = 7.8m },
        new() { ParameterCode = ParameterCodes.DO, Value = 6m },
    };

    private const string Environmental = "Environmental (DENR)";
    private const string Fisheries = "Fisheries (BFAR)";
    private const string BfarRegistration = "BFAR Fishpond / Aquafarm Registration";

    private Guid AddDocument(string categoryName, DateOnly? expiry, string title, string presetName = null)
    {
        var tenantId = GetTenantId(PilotFarm);
        return UsingDbContext(null, c =>
        {
            var category = c.DocumentCategories.IgnoreQueryFilters().Single(x => x.TenantId == tenantId && x.Name == categoryName);
            var preset = presetName == null ? null : c.DocumentPresets.IgnoreQueryFilters().Single(x => x.TenantId == tenantId && x.Name == presetName);
            var doc = new ComplianceDocument
            {
                Id = Guid.NewGuid(), TenantId = tenantId, CategoryId = category.Id, PresetId = preset?.Id, Title = title, DocumentNumber = "T-" + title,
                IssueDate = FarmToday().AddYears(-1), ExpiryDate = expiry,
            };
            c.ComplianceDocuments.Add(doc);
            return doc.Id;
        });
    }

    // ---------------------------------------------------------------- AC-03
    [Fact]
    public async Task AC03_expiry_status_follows_the_alert_window_and_reaches_the_dashboard()
    {
        var today = FarmToday();
        var valid = AddDocument(Environmental, today.AddDays(200), "valid");
        var soon = AddDocument(Environmental, today.AddDays(10), "soon");
        var edge = AddDocument(Environmental, today.AddDays(30), "edge30");
        var expired = AddDocument(Environmental, today.AddDays(-1), "expired");
        var perpetual = AddDocument(Environmental, null, "perpetual");

        var docs = await Resolve<ComplianceAppService>().GetDocuments(new GetDocumentsInput());
        docs.Single(d => d.Id == valid).ExpiryStatus.ShouldBe(ExpiryStatus.Active);
        docs.Single(d => d.Id == perpetual).ExpiryStatus.ShouldBe(ExpiryStatus.NoExpiry);
        docs.Single(d => d.Id == perpetual).IsPerpetual.ShouldBeTrue();
        docs.Single(d => d.Id == soon).ExpiryStatus.ShouldBe(ExpiryStatus.ExpiringSoon);
        docs.Single(d => d.Id == edge).ExpiryStatus.ShouldBe(ExpiryStatus.ExpiringSoon); // default 30-day window is inclusive
        docs.Single(d => d.Id == expired).ExpiryStatus.ShouldBe(ExpiryStatus.Expired);

        var dashboard = await Resolve<DashboardAppService>().Get();
        dashboard.DocumentAlerts.Select(a => a.DocumentId).ShouldContain(soon);
        dashboard.DocumentAlerts.Select(a => a.DocumentId).ShouldContain(expired);
        dashboard.DocumentAlerts.Select(a => a.DocumentId).ShouldNotContain(valid);
        dashboard.DocumentAlerts.Select(a => a.DocumentId).ShouldNotContain(perpetual);

        // Status filter (D-30).
        (await Resolve<ComplianceAppService>().GetDocuments(new GetDocumentsInput { Status = ExpiryStatus.Expired })).Select(d => d.Id).ShouldBe(new[] { expired });
    }

    [Fact]
    public async Task AC03_any_current_record_satisfies_a_required_permit_without_approval()
    {
        var today = FarmToday();
        var compliance = Resolve<ComplianceAppService>();
        (await compliance.GetStatus()).MissingPermits.ShouldContain(BfarRegistration);

        AddDocument(Fisheries, today.AddDays(-5), "lapsed", BfarRegistration);
        (await compliance.GetStatus()).MissingPermits.ShouldContain(BfarRegistration);

        var good = AddDocument(Fisheries, today.AddDays(100), "current", BfarRegistration);
        (await compliance.GetStatus()).MissingPermits.ShouldNotContain(BfarRegistration);

        await compliance.SetArchived(new ArchiveDocumentInput { Id = good, IsArchived = true });
        (await compliance.GetStatus()).MissingPermits.ShouldContain(BfarRegistration);
    }

    [Fact]
    public async Task AC03_technician_has_no_access_to_compliance_documents()
    {
        LoginAsPilotTechnician();
        await Should.ThrowAsync<Abp.Authorization.AbpAuthorizationException>(() => Resolve<ComplianceAppService>().GetStatus());
    }

    // ---------------------------------------------------------------- AC-04
    [Fact]
    public async Task AC04_new_pond_is_available_with_a_history_entry_and_invalid_ponds_are_rejected()
    {
        var ponds = Resolve<PondAppService>();
        var gp = PrefixId("GP");
        var id = await ponds.Create(new PondEditDto
        {
            PrefixId = gp, Number = 9, AreaM2 = 1200, AverageDepthM = 1.2m, MaxDepthM = 1.5m,
            Purpose = PondPurpose.GrowOut, ConstructionType = PondConstructionType.Earthen,
        });
        var detail = await ponds.Get(id);
        detail.PondCode.ShouldBe("GP-09");
        detail.Name.ShouldBe("Grow-out Pond 9");
        detail.Status.ShouldBe(PondDisplayStatus.Available);
        detail.History.Count.ShouldBe(1);
        detail.History[0].ChangeType.ShouldBe(PondChangeType.Created);

        await Should.ThrowAsync<UserFriendlyException>(() => ponds.Create(new PondEditDto { PrefixId = gp, Number = 9, AreaM2 = 10, AverageDepthM = 1, MaxDepthM = 1 }));
        // No prefix is valid: the construction type names the pond (see PondNaming_Tests). An unknown prefix is still rejected.
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.Create(new PondEditDto { PrefixId = Guid.NewGuid(), AreaM2 = 10, AverageDepthM = 1, MaxDepthM = 1 }));
        await ThrowsAny(() => ponds.Create(new PondEditDto { PrefixId = gp, Number = 10, AreaM2 = 10, AverageDepthM = 1.5m, MaxDepthM = 1.0m }));
        await ThrowsAny(() => ponds.Create(new PondEditDto { PrefixId = gp, Number = 11, AreaM2 = 0, AverageDepthM = 1, MaxDepthM = 1 }));
        Q(c => c.Ponds.IgnoreQueryFilters().Count(p => p.PondCode == "GP-10" || p.PondCode == "GP-11")).ShouldBe(0);

        await ponds.Update(new PondEditDto
        {
            Id = id, AreaM2 = 1200, AverageDepthM = 1.2m, MaxDepthM = 1.5m, AerationSystem = "2 x 1 HP paddlewheel",
            Purpose = PondPurpose.GrowOut, ConstructionType = PondConstructionType.Earthen, ChangeNote = "Added aerators",
        });
        (await ponds.Get(id)).PondCode.ShouldBe("GP-09");
        await ponds.SetManualStatus(new SetPondStatusInput { Id = id, ManualStatus = PondManualStatus.UnderMaintenance, Note = "Dike repair" });
        detail = await ponds.Get(id);
        detail.Status.ShouldBe(PondDisplayStatus.UnderMaintenance);
        detail.History.Count.ShouldBe(3);
    }

    // ---------------------------------------------------------------- AC-04 to AC-17 end to end
    [Fact]
    public async Task Full_lifecycle_from_new_pond_to_closed_cycle()
    {
        var ponds = Resolve<PondAppService>();
        var pondId = await ponds.Create(new PondEditDto
        {
            PrefixId = PrefixId("GP"), Number = 20, AreaM2 = 1000, AverageDepthM = 1.2m, MaxDepthM = 1.4m, Purpose = PondPurpose.GrowOut,
            ConstructionType = PondConstructionType.Concrete, FarmingSystemOverride = FarmingSystem.Intensive,
        });
        await ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = pondId, ObservedAt = DateTime.UtcNow.AddDays(-25), Description = "Cleaned and disinfected" });
        await ponds.MarkPrepared(new Abp.Application.Services.Dto.EntityDto<Guid>(pondId));

        var deliveries = Resolve<Resources.FryDeliveryAppService>();
        var delivery = await deliveries.Create(new Resources.FryDeliveryEditDto
        {
            HatcheryId = HatcheryId(GetTenantId(PilotFarm)), HatcheryBatchNumber = "HL-LIFE", DeliveryDate = FarmToday().AddDays(-21), PlAgeDays = 12, PlReceived = 80000,
            InitialStatus = Resources.FryDeliveryStatus.Received,
        });

        var cycles = Resolve<CycleAppService>();
        var batches = Resolve<BatchAppService>();
        var created = await cycles.CreateBatches(new CreateBatchesInput
        {
            FryDeliveryId = delivery.Id,
            Batches = new()
            {
                new() { PondId = pondId, PlCount = 80000, StockedAt = DateTime.UtcNow.AddDays(-20), TransportMode = TransportMode.Van, Readings = Baseline() },
            },
        });
        var batchId = created.Batches.Single().Id;
        created.Batches.Single().StockingDensityPerM2.ShouldBe(80m);
        created.Warnings.ShouldContain(w => w.Kind == "Density"); // below 100 PL/m² for intensive in a concrete pond (DEC-65)
        (await cycles.Get(created.CycleId)).Status.ShouldBe(CycleStatus.Active);

        await Should.ThrowAsync<UserFriendlyException>(() => cycles.Close(new CloseCycleInput { Id = created.CycleId }));

        await batches.DeclareFailure(new FailureInput { Id = batchId, Reason = "AHPND suspected; mass mortality", FailureDate = FarmToday(), EstimatedLossPhp = 120000 });
        var failed = await batches.Get(batchId);
        failed.Status.ShouldBe(BatchStatus.Failed);
        failed.EstimatedLossPhp.ShouldBe(120000m);
        var report = await Resolve<ReportAppService>().GetFailureReport(new Reports.Dto.FailureReportInput { BatchId = batchId });
        report.Batches.Single().FailureReason.ShouldContain("AHPND");

        // A failed batch still takes notes until it is closed.
        await Resolve<LogAppService>().Create(new SaveLogInput
        {
            BatchId = batchId, LogType = LogType.GeneralNote, ObservedAt = DateTime.UtcNow.AddMinutes(-5), Notes = "Pond drained", ClientRequestId = Guid.NewGuid(),
        });
        await Should.ThrowAsync<UserFriendlyException>(() => batches.Close(new CloseBatchInput { Id = batchId, ConfirmReadOnly = false }));
        await batches.Close(new CloseBatchInput { Id = batchId, ConfirmReadOnly = true });
        (await batches.Get(batchId)).IsReadOnly.ShouldBeTrue();
        (await ponds.Get(pondId)).Status.ShouldBe(PondDisplayStatus.Available);

        var beforeClose = await cycles.Get(created.CycleId);
        beforeClose.SuggestedOutcome.ShouldBe(CycleOutcome.Failed); // its only batch failed (DEC-64)
        await cycles.Close(new CloseCycleInput { Id = created.CycleId, Outcome = beforeClose.SuggestedOutcome });
        (await cycles.Get(created.CycleId)).Status.ShouldBe(CycleStatus.Closed);
        (await cycles.Get(created.CycleId)).Outcome.ShouldBe(CycleOutcome.Failed);
        (await Resolve<ReportAppService>().GetCyclePerformance(created.CycleId)).IsFinal.ShouldBeTrue();
    }

    // ---------------------------------------------------------------- AC-20
    [Fact]
    public async Task AC20_negative_or_impossible_values_commit_nothing()
    {
        var logs = Resolve<LogAppService>();
        var batchId = BatchId(CurrentBatch);
        var before = Q(c => c.ProductionLogs.IgnoreQueryFilters().Count());
        var lotBefore = LotQty(LotId(FeedLot));

        await ThrowsAny(() => Resolve<FeedingAppService>().Save(new SaveFeedingSessionInput
        {
            BatchId = batchId, FeedDate = FarmToday(), Session = 1, ClientRequestId = Guid.NewGuid(),
            Lines = new() { new() { LotId = LotId(FeedLot), Kg = -5 } },
        }));
        await ThrowsAny(() => logs.Create(new SaveLogInput
        {
            BatchId = batchId, LogType = LogType.Mortality, ObservedAt = DateTime.UtcNow.AddMinutes(-1), ClientRequestId = Guid.NewGuid(),
            Mortality = new MortalityInput { Count = -10 },
        }));
        await ThrowsAny(() => logs.Create(new SaveLogInput
        {
            BatchId = batchId, LogType = LogType.GrowthSampling, ObservedAt = DateTime.UtcNow.AddMinutes(-1), ClientRequestId = Guid.NewGuid(),
            Growth = new GrowthInput { SampleCount = 0, TotalSampleWeightG = 100 },
        }));
        await ThrowsAny(() => logs.Create(new SaveLogInput
        {
            BatchId = batchId, LogType = LogType.WaterQuality, ObservedAt = DateTime.UtcNow.AddDays(2), ClientRequestId = Guid.NewGuid(),
            Readings = new List<ReadingInput> { new() { ParameterCode = ParameterCodes.PH, Value = 7.5m } },
        }));
        await ThrowsAny(() => Resolve<InventoryAppService>().RecordReceipt(new RecordReceiptInput
        {
            ItemId = Q(c => c.InventoryItems.IgnoreQueryFilters().First().Id), LotNumber = "NEG-1", ReceivedDate = FarmToday(), Quantity = -3,
        }));

        Q(c => c.ProductionLogs.IgnoreQueryFilters().Count()).ShouldBe(before);
        LotQty(LotId(FeedLot)).ShouldBe(lotBefore);
        Q(c => c.InventoryLots.IgnoreQueryFilters().Count(l => l.LotNumber == "NEG-1")).ShouldBe(0);
    }

    // ---------------------------------------------------------------- AC-21
    [Fact]
    public async Task AC21_another_farm_cannot_write_to_or_report_on_pilot_records()
    {
        var pilotBatch = BatchId(CurrentBatch);
        var pilotCycle = CycleId("C-2026-01");
        var pilotPond = PondId("GP-01");
        var pilotLot = LotId(FeedLot);
        var pilotHarvest = Q(c => c.Harvests.IgnoreQueryFilters().First().Id);
        var logsBefore = Q(c => c.ProductionLogs.IgnoreQueryFilters().Count());
        var salesBefore = Q(c => c.Sales.IgnoreQueryFilters().Count());

        LoginAsSecondFarmOwner();
        await ThrowsAny(() => Resolve<LogAppService>().Create(new SaveLogInput
        {
            BatchId = pilotBatch, LogType = LogType.GeneralNote, ObservedAt = DateTime.UtcNow.AddMinutes(-1), Notes = "intrusion", ClientRequestId = Guid.NewGuid(),
        }));
        await ThrowsAny(() => Resolve<CycleAppService>().CreateBatches(new CreateBatchesInput
        {
            CycleId = pilotCycle, Batches = new() { new() { PondId = pilotPond, PlCount = 10, StockedAt = DateTime.UtcNow.AddHours(-1), Readings = Baseline() } },
        }));
        await ThrowsAny(() => Resolve<BatchAppService>().DeclareFailure(new FailureInput { Id = pilotBatch, Reason = "x", FailureDate = FarmToday() }));
        await ThrowsAny(() => Resolve<InventoryAppService>().GetMovements(pilotLot));
        await ThrowsAny(() => Resolve<InventoryAppService>().RecordAdjustment(new RecordAdjustmentInput { LotId = pilotLot, Quantity = -100, Reason = "intrusion" }));
        await ThrowsAny(() => Resolve<ReportAppService>().GetCyclePerformance(pilotCycle));
        await ThrowsAny(() => Resolve<HarvestAppService>().Get(pilotHarvest));
        await ThrowsAny(() => Resolve<SaleAppService>().Create(new SaveSaleInput
        {
            BuyerId = Q(c => c.Buyers.IgnoreQueryFilters().First().Id), SaleDate = FarmToday(),
            Lines = new() { new() { HarvestGradeLineId = Q(c => c.HarvestGradeLines.IgnoreQueryFilters().First(g => g.HarvestId == pilotHarvest).Id), Kg = 1, PricePerKg = 1 } },
        }));
        (await Resolve<ReportAppService>().GetWaterQualityExceptions(new Reports.Dto.WaterQualityExceptionInput())).Items.ShouldBeEmpty();
        (await Resolve<LogAppService>().GetList(new GetLogsInput { BatchId = pilotBatch })).Items.ShouldBeEmpty();

        Q(c => c.ProductionLogs.IgnoreQueryFilters().Count()).ShouldBe(logsBefore);
        Q(c => c.Sales.IgnoreQueryFilters().Count()).ShouldBe(salesBefore);
        LoginAsPilotOwner();
        Q(c => c.ProductionCycles.IgnoreQueryFilters().Single(x => x.Id == pilotCycle).Status).ShouldBe(CycleStatus.Active);
    }
}
