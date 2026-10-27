using Abp.Authorization;
using Abp.UI;
using Capstone.Common;
using Capstone.Compliance;
using Capstone.Inventory;
using Capstone.Ponds;
using Capstone.Production;
using Capstone.Reports;
using Capstone.Sales;
using Shouldly;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Farm boundary (AC-21) and role permissions (Section 5 matrix, AC-22).</summary>
public class FarmIsolation_Tests : FpmsTestBase
{
    [Fact]
    public async Task Second_farm_sees_only_its_own_ponds()
    {
        LoginAsSecondFarmOwner();
        var ponds = await Resolve<PondAppService>().GetAll();
        ponds.Select(p => p.PondCode).ShouldBe(new[] { "GP-01" });
    }

    [Fact]
    public async Task Another_farms_identifiers_resolve_to_not_found()
    {
        var pilotPond = PondId("GP-01");
        var pilotBatch = BatchId(ReferenceBatch);
        LoginAsSecondFarmOwner();

        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<PondAppService>().Get(pilotPond));
        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<BatchAppService>().Get(pilotBatch));
        await ThrowsAny(() => Resolve<PondAppService>().Update(new PondEditDto { Id = pilotPond, AreaM2 = 1, AverageDepthM = 1, MaxDepthM = 1 }));
        (await Resolve<SaleAppService>().GetAll(new GetSalesInput())).Items.ShouldBeEmpty();
        (await Resolve<ReportAppService>().GetHarvestSummary(new Reports.Dto.HarvestSummaryInput { BatchId = pilotBatch })).Harvests.ShouldBeEmpty();
    }

    [Fact]
    public async Task Technician_cannot_reach_owner_only_areas()
    {
        LoginAsPilotTechnician();
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<SaleAppService>().GetAll(new GetSalesInput()));
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<ComplianceAppService>().GetDocuments(new GetDocumentsInput()));
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<ReportAppService>().GetCyclePerformance(CycleId("C-2026-01")));
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<PondAppService>().Create(new PondEditDto { PrefixId = PrefixId("GP"), AreaM2 = 10, AverageDepthM = 1, MaxDepthM = 1 }));
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<BatchAppService>().DeclareFailure(new Production.Dto.FailureInput { Id = BatchId(CurrentBatch), Reason = "x" }));
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<Resources.FryDeliveryAppService>().Create(new Resources.FryDeliveryEditDto { HatcheryBatchNumber = "X", PlReceived = 1 }));

        // ...but reads ponds, stock on hand and production records
        (await Resolve<PondAppService>().GetAll()).Count.ShouldBe(4);
        (await Resolve<InventoryAppService>().GetItems()).Count.ShouldBe(3);
        (await Resolve<BatchAppService>().GetAll(new Production.Dto.GetBatchesInput())).Count.ShouldBe(2);
    }

    [Fact]
    public async Task System_administrator_cannot_read_farm_records()
    {
        LoginAsHostAdmin();
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<PondAppService>().GetAll());
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<InventoryAppService>().GetItems());
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<SaleAppService>().GetAll(new GetSalesInput()));
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<ComplianceAppService>().GetDocuments(new GetDocumentsInput()));
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<BatchAppService>().GetAll(new Production.Dto.GetBatchesInput()));
    }
}
