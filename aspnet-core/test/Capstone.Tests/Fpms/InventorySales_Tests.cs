using Abp.UI;
using Capstone.Harvests;
using Capstone.Inventory;
using Capstone.Production;
using Capstone.Sales;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Inventory ledger, cycle report finance and harvest summary (AC-05, AC-12, AC-14; D-19; DEC-15, DEC-68).</summary>
public class InventorySales_Tests : FpmsTestBase
{
    [Fact]
    public async Task Costed_receipt_creates_a_lot_with_its_own_cost()
    {
        var feedItem = Q(c => c.InventoryItems.IgnoreQueryFilters().Single(i => i.ProductName == "Shrimp Grower #3").Id);
        var inventory = Resolve<InventoryAppService>();
        var result = await inventory.RecordReceipt(new RecordReceiptInput
        {
            ItemId = feedItem, LotNumber = "FG-1020", ReceivedDate = new DateOnly(2026, 10, 20), Quantity = 1700, UnitCost = 85, Supplier = "Feed Dealer",
        });

        result.QuantityOnHand.ShouldBe(1700m);
        result.UnitCost.ShouldBe(85m); // lot-based cost: the older lot keeps its 75
        Q(c => c.InventoryLots.IgnoreQueryFilters().Single(l => l.LotNumber == "FG-0601").UnitCost).ShouldBe(75m);
        await Should.ThrowAsync<UserFriendlyException>(() => inventory.RecordReceipt(new RecordReceiptInput
        {
            ItemId = feedItem, LotNumber = "FG-1020", ReceivedDate = new DateOnly(2026, 10, 21), Quantity = 10, UnitCost = 85,
        }));
    }

    [Fact]
    public async Task Stock_on_hand_equals_the_movement_ledger()
    {
        var lots = await Resolve<InventoryAppService>().GetLots(null);
        foreach (var lot in lots)
        {
            var ledger = Q(c => c.StockMovements.IgnoreQueryFilters().Where(m => m.LotId == lot.Id).Sum(m => m.Quantity));
            lot.QuantityOnHand.ShouldBe(ledger);
        }

        lots.Single(l => l.LotNumber == "FG-0601").QuantityOnHand.ShouldBe(1700m);
        lots.Single(l => l.LotNumber == "LM-0515").QuantityOnHand.ShouldBe(500m);
    }

    [Fact]
    public async Task Adjustment_requires_a_reason()
    {
        await ThrowsAny(() => Resolve<InventoryAppService>().RecordAdjustment(new RecordAdjustmentInput { LotId = LotId(FeedLot), Quantity = -5, Reason = "" }));
        var qty = await Resolve<InventoryAppService>().RecordAdjustment(new RecordAdjustmentInput { LotId = LotId(FeedLot), Quantity = -5, Reason = "Wet bags discarded" });
        qty.ShouldBe(1695m);
    }

    [Fact]
    public async Task Cycle_report_shows_margin_over_feed_chemicals_and_pl()
    {
        var report = await Resolve<Reports.ReportAppService>().GetCyclePerformance(CycleId("C-2026-01"));
        var reference = report.Batches.Single(b => b.BatchCode == ReferenceBatch);
        reference.Finance.Revenue.ShouldBe(930000m);
        reference.Finance.InventoryUsageCost.ShouldBe(225000m); // 3,000 kg × 75
        // DEC-68: the whole ₱135,000 delivery cost shared by stocking count: 200k of 450k stocked → 60,000.
        reference.Finance.PlCost.ShouldBe(60000m);
        reference.Finance.Margin.ShouldBe(930000m - 225000m - 60000m);
        reference.Finance.MarginLabel.ShouldContain("feed, chemicals and PL");
        report.TotalFeedKg.ShouldBe(3300m);
        report.TotalHarvestKg.ShouldBe(2500m);
        reference.Feed.Single().QuantityKg.ShouldBe(3000m);
        reference.Growth.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Harvest_summary_uses_farm_day_boundaries()
    {
        // The seeded Total harvest is at 06:00 on 8 Sep (Asia/Manila) = 22:00 UTC on 7 Sep.
        var reports = Resolve<Reports.ReportAppService>();
        (await reports.GetHarvestSummary(new Reports.Dto.HarvestSummaryInput { From = new DateOnly(2026, 9, 8), To = new DateOnly(2026, 9, 8) })).TotalKg.ShouldBe(2500m);
        (await reports.GetHarvestSummary(new Reports.Dto.HarvestSummaryInput { From = new DateOnly(2026, 9, 7), To = new DateOnly(2026, 9, 7) })).Harvests.ShouldBeEmpty();
        var summary = await reports.GetHarvestSummary(new Reports.Dto.HarvestSummaryInput { CycleId = CycleId("C-2026-01") });
        summary.BuyerAllocation.Single().Kg.ShouldBe(2500m);
        summary.SalesAmount.ShouldBe(930000m);
        summary.SizeDistribution.Single(s => s.SizeLabel == "50/60").Pct.ShouldBe(80m);
        summary.Batches.Single().SurvivalRatePct.ShouldBe(71.25m);
    }
}
