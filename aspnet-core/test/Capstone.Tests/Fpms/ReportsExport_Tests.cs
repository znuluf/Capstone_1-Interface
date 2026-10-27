using Abp.Authorization;
using Abp.Runtime.Validation;
using Abp.UI;
using Capstone.ActivityLogs;
using Capstone.Common;
using Capstone.Domain;
using Capstone.Harvests;
using Capstone.Logbooks;
using Capstone.Logbooks.Dto;
using Capstone.Production;
using Capstone.Production.Dto;
using Capstone.Reports;
using Capstone.Reports.Dto;
using Capstone.Resources;
using Capstone.Sales;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Step F1: server-side paging (AC-27), the six reports with their date limit (AC-18) and CSV export.</summary>
public class ReportsExport_Tests : FpmsTestBase
{
    private static DateOnly Today => FarmClock.Today(FarmClock.Resolve(FarmClock.DefaultTimeZone));

    private Guid Grade(string label) => Q(c => c.SizeGrades.IgnoreQueryFilters().Single(g => g.Label == label && g.TenantId == GetTenantId(PilotFarm)).Id);

    private Guid Buyer => Q(c => c.Buyers.IgnoreQueryFilters().First(b => b.Name.StartsWith("GenSan")).Id);

    private static string Decode(ExportFileDto file)
    {
        var bytes = Convert.FromBase64String(file.ContentBase64);
        bytes.Take(3).ShouldBe(new byte[] { 0xEF, 0xBB, 0xBF }); // UTF-8 byte-order mark, so Excel reads the file as UTF-8
        return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
    }

    /// <summary>Three more sales on top of the seeded one, with different totals.</summary>
    private async Task<Guid> ThreeSalesAsync()
    {
        var harvest = await Resolve<HarvestAppService>().Create(new SaveHarvestInput
        {
            BatchId = BatchId(CurrentBatch), HarvestedAt = DateTime.UtcNow.AddHours(-2), HarvestType = HarvestType.Partial, TotalKg = 300, AbwG = 9,
            GradeLines = new() { new GradeLineInput { SizeGradeId = Grade("100/120"), Kg = 300 } },
        });
        var line = harvest.GradeLines.Single().Id;
        foreach (var price in new[] { 200m, 300m, 400m })
        {
            await Resolve<SaleAppService>().Create(new SaveSaleInput { BuyerId = Buyer, SaleDate = Today, Lines = new() { new() { HarvestGradeLineId = line, Kg = 50, PricePerKg = price } } });
        }

        return line;
    }

    // ---------------------------------------------------------------- CSV rules
    [Fact]
    public void Csv_text_cells_that_could_run_as_formulas_are_opened_as_text()
    {
        CsvBuilder.Text("=1+1").ShouldBe("'=1+1");
        CsvBuilder.Text("+63917").ShouldBe("'+63917");
        CsvBuilder.Text("-5 kg").ShouldBe("'-5 kg");
        CsvBuilder.Text("@SUM(A1)").ShouldBe("'@SUM(A1)");
        CsvBuilder.Text("\tx").ShouldBe("'\tx");
        CsvBuilder.Text("Grow-out, pond 3").ShouldBe("\"Grow-out, pond 3\""); // a dash inside text is fine; a comma is quoted
        CsvBuilder.Text("say \"hi\"").ShouldBe("\"say \"\"hi\"\"\"");
    }

    [Fact]
    public void Csv_writes_dates_in_farm_time_with_offset_and_plain_numbers()
    {
        var csv = new CsvBuilder(FarmClock.Resolve(FarmClock.DefaultTimeZone), "When", "Day", "Amount", "Negative", "Count", "Flag", "Note")
            .Add(new DateTime(2026, 10, 22, 6, 30, 0, DateTimeKind.Utc), new DateOnly(2026, 10, 22), 12450m, CsvNumber.Of(-3.5m, 1), 1234567, true, null);
        var text = Encoding.UTF8.GetString(csv.ToBytes(), 3, csv.ToBytes().Length - 3);
        var row = text.Split("\r\n")[1];
        row.ShouldBe("2026-10-22T14:30:00+08:00,2026-10-22,12450.00,-3.5,1234567,Yes,");
    }

    // ---------------------------------------------------------------- paging
    [Fact]
    public async Task Lists_page_on_the_server_25_by_default_and_100_at_most()
    {
        new GetSalesInput().MaxResultCount.ShouldBe(25);
        new GetLogsInput().MaxResultCount.ShouldBe(25);
        await Should.ThrowAsync<AbpValidationException>(() => Resolve<SaleAppService>().GetAll(new GetSalesInput { MaxResultCount = 101 }));
        await Should.ThrowAsync<AbpValidationException>(() => Resolve<LogAppService>().GetList(new GetLogsInput { MaxResultCount = 500 }));
        await Should.ThrowAsync<AbpValidationException>(() => Resolve<SaleAppService>().GetAll(new GetSalesInput { SkipCount = -1 }));
        (await Resolve<SaleAppService>().GetAll(new GetSalesInput { MaxResultCount = 100 })).TotalCount.ShouldBe(1);
    }

    [Fact]
    public async Task Sales_are_cut_into_pages_with_totals_of_every_match_and_sort_only_by_listed_columns()
    {
        await ThreeSalesAsync();
        var sales = Resolve<SaleAppService>();

        var first = await sales.GetAll(new GetSalesInput { MaxResultCount = 2, Sorting = "total asc" });
        first.TotalCount.ShouldBe(4);
        first.Items.Count.ShouldBe(2);
        first.Items.Select(s => s.Total).ShouldBe(new[] { 10000m, 15000m });
        first.TotalAmount.ShouldBe(930000m + 10000m + 15000m + 20000m); // totals cover all 4 sales, not just the page

        var last = await sales.GetAll(new GetSalesInput { SkipCount = 2, MaxResultCount = 2, Sorting = "total asc" });
        last.Items.Select(s => s.Total).ShouldBe(new[] { 20000m, 930000m });
        first.Items.Select(s => s.Id).Intersect(last.Items.Select(s => s.Id)).ShouldBeEmpty();

        (await sales.GetAll(new GetSalesInput { MaxResultCount = 1, Sorting = "total desc" })).Items.Single().Total.ShouldBe(930000m);

        // A column that is not on the list is ignored; the default order (newest sale date first) applies.
        var unknown = await sales.GetAll(new GetSalesInput { Sorting = "Buyer.Password desc; drop table" });
        unknown.Items.First().SaleDate.ShouldBe(Today);

        var overdue = await sales.GetAll(new GetSalesInput { OverdueOnly = true });
        overdue.TotalCount.ShouldBe(1);
        overdue.OverdueCount.ShouldBe(1);
    }

    [Fact]
    public async Task Batches_cycles_logs_harvests_feeding_and_deliveries_return_pages_with_a_total()
    {
        var batches = Resolve<BatchAppService>();
        var all = await batches.GetAll(new GetBatchesInput());
        var page1 = await batches.GetPage(new GetBatchPageInput { MaxResultCount = 1 });
        var page2 = await batches.GetPage(new GetBatchPageInput { SkipCount = 1, MaxResultCount = 1 });
        page1.TotalCount.ShouldBe(all.Count);
        page1.Items.Single().Id.ShouldNotBe(page2.Items.Single().Id);
        (await batches.GetPage(new GetBatchPageInput { Sorting = "batchCode desc" })).Items.First().BatchCode.ShouldBe(all.Max(b => b.BatchCode));
        (await batches.GetPage(new GetBatchPageInput { OpenOnly = true })).Items.ShouldAllBe(b => b.Status != BatchStatus.Closed);

        var cycles = Resolve<CycleAppService>();
        var cyclePage = await cycles.GetPage(new GetCyclePageInput { MaxResultCount = 1 });
        cyclePage.TotalCount.ShouldBe((await cycles.GetAll(new GetCyclesInput())).Count);
        cyclePage.Items.Count.ShouldBe(1);

        var logs = Resolve<LogAppService>();
        var logPage = await logs.GetList(new GetLogsInput { BatchId = BatchId(ReferenceBatch), MaxResultCount = 2 });
        logPage.Items.Count.ShouldBe(2);
        logPage.TotalCount.ShouldBeGreaterThan(2);
        var older = await logs.GetList(new GetLogsInput { BatchId = BatchId(ReferenceBatch), MaxResultCount = 2, SkipCount = 2 });
        older.Items.Select(l => l.Id).Intersect(logPage.Items.Select(l => l.Id)).ShouldBeEmpty();
        logPage.Items.Select(l => l.ObservedAtUtc).ShouldBe(logPage.Items.Select(l => l.ObservedAtUtc).OrderByDescending(x => x));
        (await logs.GetList(new GetLogsInput { BatchId = BatchId(ReferenceBatch), LogType = LogType.WaterQuality, MaxResultCount = 100 })).Items
            .ShouldAllBe(l => l.LogType == LogType.WaterQuality);

        var feeding = await Resolve<FeedingAppService>().GetList(new GetFeedingSessionsInput { BatchId = BatchId(ReferenceBatch), MaxResultCount = 2 });
        feeding.Items.Count.ShouldBe(2);
        feeding.TotalCount.ShouldBeGreaterThan(2);

        (await Resolve<HarvestAppService>().GetList(new GetHarvestsInput { MaxResultCount = 1 })).TotalCount.ShouldBeGreaterThanOrEqualTo(1);
        (await Resolve<FryDeliveryAppService>().GetAll(new GetFryDeliveriesInput { MaxResultCount = 1 })).Items.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Activity_log_pages_actions_and_data_changes_inside_the_farm()
    {
        var activity = Resolve<ActivityLogAppService>();
        var changes = await activity.GetDataChanges(new ActivityLogInput { MaxResultCount = 3 });
        changes.Items.Count.ShouldBeLessThanOrEqualTo(3);
        (await activity.GetActions(new ActivityLogInput { MaxResultCount = 3 })).Items.Count.ShouldBeLessThanOrEqualTo(3);
        await Should.ThrowAsync<AbpValidationException>(() => activity.GetActions(new ActivityLogInput { MaxResultCount = 1000 }));
        (await activity.GetRecordTypes()).ShouldNotBeNull();
    }

    // ---------------------------------------------------------------- the six reports
    [Fact]
    public async Task Sales_by_buyer_totals_each_buyer_and_flags_overdue_sales()
    {
        await ThreeSalesAsync();
        var report = await Resolve<ReportAppService>().GetSalesByBuyer(new SalesByBuyerInput { From = new DateOnly(2026, 9, 1), To = Today });
        report.SaleCount.ShouldBe(4);
        report.TotalKg.ShouldBe(2500m + 150m);
        report.TotalAmount.ShouldBe(930000m + 45000m);
        report.TotalPaid.ShouldBe(500000m);
        report.TotalBalance.ShouldBe(475000m); // 430,000 on the seeded sale + three unpaid sales (45,000)
        report.OverdueCount.ShouldBe(1);
        report.OverdueBalance.ShouldBe(430000m);
        var buyer = report.Buyers.Single();
        buyer.SaleCount.ShouldBe(4);
        buyer.Amount.ShouldBe(975000m);
        buyer.AveragePricePerKg.ShouldBe(Math.Round(975000m / 2650m, 2));
        report.Sales.Select(s => s.SaleDate).ShouldBe(report.Sales.Select(s => s.SaleDate).OrderByDescending(x => x));

        // The buyer filter and the date range narrow it.
        (await Resolve<ReportAppService>().GetSalesByBuyer(new SalesByBuyerInput { From = Today, To = Today })).SaleCount.ShouldBe(3);
        (await Resolve<ReportAppService>().GetSalesByBuyer(new SalesByBuyerInput { BuyerId = Guid.NewGuid() })).SaleCount.ShouldBe(0);
    }

    [Fact]
    public async Task Report_date_ranges_are_limited_to_24_months_unless_the_report_is_about_one_batch_or_cycle()
    {
        var reports = Resolve<ReportAppService>();
        await Should.ThrowAsync<UserFriendlyException>(() => reports.GetSalesByBuyer(new SalesByBuyerInput { From = Today.AddMonths(-30), To = Today }));
        await Should.ThrowAsync<UserFriendlyException>(() => reports.GetWaterQualityExceptions(new WaterQualityExceptionInput { From = new DateOnly(2020, 1, 1) }));
        await Should.ThrowAsync<UserFriendlyException>(() => reports.GetInventoryMovements(new InventoryMovementInput { From = Today.AddMonths(-25), To = Today }));
        await Should.ThrowAsync<UserFriendlyException>(() => reports.GetHarvestSummary(new HarvestSummaryInput { From = Today.AddMonths(-25), To = Today }));
        await Should.ThrowAsync<UserFriendlyException>(() => reports.GetSalesByBuyer(new SalesByBuyerInput { From = Today, To = Today.AddDays(-1) }));

        (await reports.GetSalesByBuyer(new SalesByBuyerInput { From = Today.AddMonths(-24), To = Today })).Header.Scope.ShouldContain("to");
        (await reports.GetSalesByBuyer(new SalesByBuyerInput())).SaleCount.ShouldBe(1); // no dates: the last 24 months
        (await reports.GetHarvestSummary(new HarvestSummaryInput { BatchId = BatchId(ReferenceBatch), From = new DateOnly(2020, 1, 1), To = Today })).Harvests.ShouldNotBeEmpty();
        (await reports.GetWaterQualityExceptions(new WaterQualityExceptionInput { BatchId = BatchId(ReferenceBatch), From = new DateOnly(2020, 1, 1) })).ReadingsChecked.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task Water_quality_exceptions_summarise_the_share_of_readings_out_of_range()
    {
        var report = await Resolve<ReportAppService>().GetWaterQualityExceptions(new WaterQualityExceptionInput { BatchId = BatchId(ReferenceBatch) });
        report.ExceptionCount.ShouldBe(report.Items.Count);
        report.ReadingsChecked.ShouldBeGreaterThanOrEqualTo(report.ExceptionCount);
        if (report.ExceptionCount > 0)
        {
            report.ExceptionRatePct.ShouldBe(Math.Round((decimal)report.ExceptionCount / report.ReadingsChecked * 100, 1));
            report.PondsAffected.ShouldBeGreaterThan(0);
            report.MostFrequentParameter.ShouldNotBeNullOrEmpty();
        }
    }

    [Fact]
    public async Task Cycle_report_names_the_hatchery_by_short_code_and_lot()
    {
        var report = await Resolve<ReportAppService>().GetCyclePerformance(CycleId("C-2026-01"));
        report.HatcheryShortCode.ShouldNotBeNullOrEmpty();
        report.HatcheryLotNumber.ShouldNotBeNullOrEmpty();
    }

    [Fact]
    public async Task Feed_and_additives_report_totals_feed_in_kg_and_cost()
    {
        var report = await Resolve<ReportAppService>().GetInventoryMovements(new InventoryMovementInput { From = new DateOnly(2026, 1, 1), To = Today });
        report.TotalUsageCost.ShouldBe(report.Items.Sum(i => i.UsageCost));
        report.FeedUsedKg.ShouldBeGreaterThan(0);
    }

    // ---------------------------------------------------------------- CSV export
    [Fact]
    public async Task List_export_is_a_named_utf8_csv_of_the_filtered_rows()
    {
        await ThreeSalesAsync();
        var export = Resolve<ExportAppService>();
        var file = await export.ExportList(new ExportListInput { List = ExportListKind.Sales });
        Regex.IsMatch(file.FileName, $"^{PilotFarm.ToUpperInvariant()}_Sales_\\d{{8}}-\\d{{4}}\\.csv$").ShouldBeTrue(file.FileName);
        file.RowCount.ShouldBe(4);
        var lines = Decode(file).TrimEnd().Split("\r\n");
        lines.Length.ShouldBe(5);
        lines[0].ShouldStartWith("Dispatch receipt,Sale date,Buyer");
        lines.ShouldContain(l => l.StartsWith("SR-2026-0001,2026-09-08,GenSan Seafood Trading (test)"));

        var filtered = await export.ExportList(new ExportListInput { List = ExportListKind.Sales, OverdueOnly = true });
        filtered.RowCount.ShouldBe(1);
        (await export.ExportList(new ExportListInput { List = ExportListKind.Harvests })).RowCount.ShouldBeGreaterThanOrEqualTo(2);
        foreach (var kind in Enum.GetValues<ExportListKind>())
        {
            var f = await export.ExportList(new ExportListInput { List = kind });
            Decode(f).ShouldNotBeNullOrEmpty();
            f.FileName.ShouldEndWith(".csv");
        }
    }

    [Fact]
    public async Task Export_keeps_a_buyer_name_that_starts_with_an_equals_sign_from_running_as_a_formula()
    {
        await Resolve<BuyerAppService>().Save(new BuyerDto { Name = "=HYPERLINK(\"http://example.test\",\"Pay\")", BuyerType = BuyerType.Company, IsActive = true });
        var text = Decode(await Resolve<ExportAppService>().ExportList(new ExportListInput { List = ExportListKind.Buyers }));
        text.ShouldContain("\"'=HYPERLINK(\"\"http://example.test\"\",\"\"Pay\"\")\"");
        text.ShouldNotContain("\n=HYPERLINK");
    }

    [Fact]
    public async Task Report_export_names_the_file_by_period_or_by_record()
    {
        var export = Resolve<ExportAppService>();
        var sales = await export.ExportReport(new ExportReportInput { Report = ExportReportKind.SalesByBuyerAndPeriod, From = new DateOnly(2026, 1, 1), To = new DateOnly(2026, 10, 22) });
        Regex.IsMatch(sales.FileName, $"^{PilotFarm.ToUpperInvariant()}_SalesByBuyerAndPeriod_2026-01-01_2026-10-22_\\d{{8}}-\\d{{4}}\\.csv$").ShouldBeTrue(sales.FileName);
        sales.RowCount.ShouldBe(1);

        var cycle = await export.ExportReport(new ExportReportInput { Report = ExportReportKind.CyclePerformance, CycleId = CycleId("C-2026-01") });
        cycle.FileName.ShouldBe($"{PilotFarm.ToUpperInvariant()}_ProductionCyclePerformance_C-2026-01.csv");
        cycle.RowCount.ShouldBe(2); // one row per batch of the cycle
        Decode(cycle).ShouldContain("Margin over feed, chemicals and PL");

        foreach (var kind in new[] { ExportReportKind.BatchHarvestAndSurvival, ExportReportKind.WaterQualityExceptions, ExportReportKind.FeedAndAdditivesUsage })
        {
            var file = await export.ExportReport(new ExportReportInput { Report = kind, From = new DateOnly(2026, 1, 1), To = Today });
            Decode(file).ShouldNotBeNullOrEmpty();
        }
    }

    [Fact]
    public async Task Only_the_owner_exports()
    {
        LoginAsPilotTechnician();
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<ExportAppService>().ExportList(new ExportListInput { List = ExportListKind.Batches }));
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<ExportAppService>().ExportReport(new ExportReportInput { Report = ExportReportKind.SalesByBuyerAndPeriod }));
    }

    [Fact]
    public async Task Export_holds_only_this_farms_rows()
    {
        LoginAsSecondFarmOwner();
        var file = await Resolve<ExportAppService>().ExportList(new ExportListInput { List = ExportListKind.Ponds });
        file.RowCount.ShouldBe(1);
        file.FileName.ShouldStartWith(SecondFarm.ToUpperInvariant());
        Decode(file).ShouldNotContain("GP-04");
    }
}
