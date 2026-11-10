using Abp.UI;
using Capstone.Domain;
using Capstone.Harvests;
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
/// DEC-80: the harvest tally sheet. An optional crate tally sets the harvest's total kg and boxes, an optional ABW sample
/// sets its ABW, and a sale line can be priced from a base price at a base ABW plus a step per gram. The worked example is
/// the partner farm's sheet: 16 crates of 30 kg and one of 23 kg = 503 kg; 5,002 g ÷ 414 pcs = 12.08 g;
/// ₱210 at 10 g + ₱5/g → ₱220.40/kg; 503 × 220.40 = ₱110,861.20.
/// </summary>
public class HarvestTally_Tests : FpmsTestBase
{
    private static DateOnly Today => FarmClock.Today(FarmClock.Resolve(FarmClock.DefaultTimeZone));

    private Guid Grade(string label) => Q(c => c.SizeGrades.IgnoreQueryFilters().Single(g => g.Label == label && g.TenantId == GetTenantId(PilotFarm)).Id);

    private Guid Buyer => Q(c => c.Buyers.IgnoreQueryFilters().First(b => b.Name.StartsWith("GenSan")).Id);

    /// <summary>The tally sheet's harvest: the total kg passed in is ignored because the crates decide it.</summary>
    private SaveHarvestInput TallySheet() => new()
    {
        BatchId = BatchId(CurrentBatch), HarvestedAt = DateTime.UtcNow.AddHours(-2), HarvestType = HarvestType.Partial, TotalKg = 1,
        AbwSampleWeightG = 5002, AbwSamplePieces = 414,
        Crates = Enumerable.Repeat(30m, 16).Append(23m).Select(kg => new CrateInput { Kg = kg }).ToList(),
        GradeLines = new() { new() { SizeGradeId = Grade(SizeGrade.UngradedLabel), Kg = 503 } },
    };

    private static SaleLineInput BaseAbwLine(Guid gradeLineId, decimal price) => new()
    {
        HarvestGradeLineId = gradeLineId, Kg = 503, PricePerKg = price,
        PriceMethod = PriceMethod.BaseAbw, BasePricePerKg = 210, BaseAbwG = 10, StepPerG = 5,
    };

    [Fact]
    public void Base_abw_price_rounds_the_abw_then_the_price()
    {
        SaleLine.BaseAbwPrice(210, 10, 5, 12.08m).ShouldBe(220.40m);
        SaleLine.BaseAbwPrice(210, 10, 5, 5002m / 414m).ShouldBe(220.40m); // 12.0821 g is priced as 12.08 g, as on the sheet
        SaleLine.BaseAbwPrice(210, 10, 5, 9.5m).ShouldBe(207.50m);         // below the base ABW lowers the price
        Harvest.AbwFromSample(5002, 414).ShouldBe(12.08m);
    }

    [Fact]
    public async Task Crate_tally_sets_total_and_boxes_and_the_sample_sets_abw()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        harvest.TotalKg.ShouldBe(503m);
        harvest.Boxes.ShouldBe(17);
        harvest.AbwG.ShouldBe(12.08m);
        harvest.AbwSampleWeightG.ShouldBe(5002m);
        harvest.AbwSamplePieces.ShouldBe(414);
        harvest.Crates.Select(c => c.CrateNo).ShouldBe(Enumerable.Range(1, 17));
        harvest.Crates.Last().Kg.ShouldBe(23m);
    }

    [Fact]
    public async Task Editing_the_crates_replaces_the_tally_and_removing_them_keeps_the_typed_total()
    {
        var harvests = Resolve<HarvestAppService>();
        var input = TallySheet();
        var harvest = await harvests.Create(input);

        input.Id = harvest.Id;
        input.Crates = new() { new() { Kg = 300 }, new() { Kg = 203 } };
        var edited = await harvests.Update(input);
        edited.Crates.Count.ShouldBe(2);
        edited.TotalKg.ShouldBe(503m);
        edited.Boxes.ShouldBe(2);
        Q(c => c.HarvestCrates.IgnoreQueryFilters().Count(x => x.HarvestId == harvest.Id)).ShouldBe(2);

        input.Crates = new List<CrateInput>();
        input.TotalKg = 510;
        input.Boxes = 20;
        var totalOnly = await harvests.Update(input);
        totalOnly.Crates.ShouldBeEmpty();
        totalOnly.TotalKg.ShouldBe(510m);
        totalOnly.Boxes.ShouldBe(20);
    }

    [Fact]
    public async Task Half_a_sample_or_an_impossible_abw_is_rejected()
    {
        var harvests = Resolve<HarvestAppService>();
        var half = TallySheet();
        half.AbwSamplePieces = null;
        await Should.ThrowAsync<UserFriendlyException>(() => harvests.Create(half));

        var kilograms = TallySheet();
        kilograms.AbwSampleWeightG = 5002;
        kilograms.AbwSamplePieces = 4; // 1,250 g per piece: the weight was not in grams
        await Should.ThrowAsync<UserFriendlyException>(() => harvests.Create(kilograms));
    }

    [Fact]
    public async Task Container_types_have_one_default_and_unique_names()
    {
        var types = Resolve<ContainerTypeAppService>();
        var banyera = await types.Save(new ContainerTypeDto { Name = "Banyera", NominalKg = 30, IsDefault = true });
        var tub = await types.Save(new ContainerTypeDto { Name = "Tub", NominalKg = 10, TareKg = 1.2m, IsDefault = true });

        var all = await types.GetAll();
        all.Single(t => t.IsDefault).Id.ShouldBe(tub);
        all.Single(t => t.Id == banyera).SortOrder.ShouldBe(1);

        await Should.ThrowAsync<UserFriendlyException>(() => types.Save(new ContainerTypeDto { Name = "Banyera" }));
        await Should.ThrowAsync<UserFriendlyException>(() => types.Save(new ContainerTypeDto { Name = "Box", IsDefault = true, IsActive = false }));
        await Should.ThrowAsync<UserFriendlyException>(() => types.Save(new ContainerTypeDto { Name = "Heavy tub", NominalKg = 5, TareKg = 6 }));
    }

    [Fact]
    public async Task A_container_with_an_empty_weight_gives_net_kg_and_keeps_its_saved_tare()
    {
        var types = Resolve<ContainerTypeAppService>();
        var tub = await types.Save(new ContainerTypeDto { Name = "Tub", NominalKg = 30, TareKg = 1.2m });
        var harvests = Resolve<HarvestAppService>();
        var input = TallySheet();
        input.Crates = new() { new() { Kg = 31.2m, ContainerTypeId = tub }, new() { Kg = 31.2m, ContainerTypeId = tub }, new() { Kg = 20 } };
        input.GradeLines = new() { new() { SizeGradeId = Grade(SizeGrade.UngradedLabel), Kg = 80 } };

        var harvest = await harvests.Create(input);
        harvest.TotalKg.ShouldBe(80m); // 30 + 30 net, plus 20 kg weighed without a container
        var first = harvest.Crates.First();
        first.Kg.ShouldBe(30m);
        first.GrossKg.ShouldBe(31.2m);
        first.TareKg.ShouldBe(1.2m);
        first.ContainerName.ShouldBe("Tub");
        harvest.Crates.Last().TareKg.ShouldBeNull();

        // The farm changes the tub's empty weight; re-saving the old harvest with its saved tare keeps the same total.
        await types.Save(new ContainerTypeDto { Id = tub, Name = "Tub", NominalKg = 30, TareKg = 2m });
        input.Id = harvest.Id;
        input.Crates = harvest.Crates.Select(c => new CrateInput { Kg = c.GrossKg ?? c.Kg, ContainerTypeId = c.ContainerTypeId, TareKg = c.TareKg ?? 0 }).ToList();
        (await harvests.Update(input)).TotalKg.ShouldBe(80m);

        // A reading not above the empty weight is rejected.
        input.Crates = new() { new() { Kg = 1.5m, ContainerTypeId = tub } };
        await Should.ThrowAsync<UserFriendlyException>(() => harvests.Update(input));
    }

    [Fact]
    public async Task Removing_crates_cannot_drop_the_total_below_what_is_sold()
    {
        var harvests = Resolve<HarvestAppService>();
        var input = TallySheet();
        var harvest = await harvests.Create(input);
        await Resolve<SaleAppService>().Create(new SaveSaleInput
        {
            BuyerId = Buyer, SaleDate = Today, Lines = new() { BaseAbwLine(harvest.GradeLines.Single().Id, 220.40m) },
        });

        input.Id = harvest.Id;
        input.Crates = input.Crates.Take(10).ToList(); // 300 kg < 503 kg sold
        await Should.ThrowAsync<UserFriendlyException>(() => harvests.Update(input));
    }

    [Fact]
    public async Task Base_abw_sale_matches_the_tally_sheet_and_prefills_the_buyers_next_sale()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        var sales = Resolve<SaleAppService>();
        var sale = await sales.Create(new SaveSaleInput
        {
            BuyerId = Buyer, SaleDate = Today, Lines = new() { BaseAbwLine(harvest.GradeLines.Single().Id, 220.40m) },
        });

        sale.Total.ShouldBe(110861.20m);
        sale.Warnings.ShouldNotContain(w => w.Kind == "PriceFormula");
        var line = sale.Lines.Single();
        line.PriceMethod.ShouldBe(PriceMethod.BaseAbw);
        line.PriceAbwG.ShouldBe(12.08m); // taken from the harvest's sample
        line.FormulaPricePerKg.ShouldBe(220.40m);

        var terms = await sales.GetBuyerPriceTerms(Buyer);
        terms.ShouldNotBeNull();
        terms.BasePricePerKg.ShouldBe(210m);
        terms.BaseAbwG.ShouldBe(10m);
        terms.StepPerG.ShouldBe(5m);
        terms.FromDispatchReceiptNo.ShouldBe(sale.DispatchReceiptNo);
    }

    [Fact]
    public async Task An_overridden_price_warns_and_missing_terms_are_rejected()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        var gradeLine = harvest.GradeLines.Single().Id;
        var sales = Resolve<SaleAppService>();

        var missing = BaseAbwLine(gradeLine, 220.40m);
        missing.StepPerG = null;
        await Should.ThrowAsync<UserFriendlyException>(() => sales.Create(new SaveSaleInput { BuyerId = Buyer, SaleDate = Today, Lines = new() { missing } }));

        var overridden = await sales.Create(new SaveSaleInput { BuyerId = Buyer, SaleDate = Today, Lines = new() { BaseAbwLine(gradeLine, 225m) } });
        overridden.Warnings.ShouldContain(w => w.Kind == "PriceFormula");
        overridden.Lines.Single().PricePerKg.ShouldBe(225m); // saved as agreed
        overridden.Total.ShouldBe(113175m);
    }

    [Fact]
    public async Task Fixed_price_lines_drop_any_base_terms()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        var line = BaseAbwLine(harvest.GradeLines.Single().Id, 220m);
        line.PriceMethod = PriceMethod.Fixed;
        var sale = await Resolve<SaleAppService>().Create(new SaveSaleInput { BuyerId = Buyer, SaleDate = Today, Lines = new() { line } });
        var saved = sale.Lines.Single();
        saved.PriceMethod.ShouldBe(PriceMethod.Fixed);
        saved.BasePricePerKg.ShouldBeNull();
        saved.FormulaPricePerKg.ShouldBeNull();
        (await Resolve<SaleAppService>().GetBuyerPriceTerms(Buyer)).ShouldBeNull();
    }

    // ---------------------------------------------------------------- DEC-81: buyer on the harvest, tally sheet entry
    private SaveTallySheetInput SheetWithSale() => new()
    {
        Harvest = WithBuyer(TallySheet()),
        Sale = new TallySaleInput
        {
            PricePerKg = 220.40m, PriceMethod = PriceMethod.BaseAbw, BasePricePerKg = 210, BaseAbwG = 10, StepPerG = 5, PaymentTerms = "Cash on harvest",
        },
    };

    private SaveHarvestInput WithBuyer(SaveHarvestInput input)
    {
        input.BuyerId = Buyer;
        input.WeighedBy = WeighedBy.Buyer;
        return input;
    }

    [Fact]
    public async Task A_harvest_keeps_its_buyer_and_scale()
    {
        var harvest = await Resolve<HarvestAppService>().Create(WithBuyer(TallySheet()));
        harvest.BuyerId.ShouldBe(Buyer);
        harvest.BuyerName.ShouldStartWith("GenSan");
        harvest.WeighedBy.ShouldBe(WeighedBy.Buyer);
    }

    [Fact]
    public async Task Tally_sheet_saves_the_harvest_and_its_sale_together()
    {
        var result = await Resolve<TallySheetAppService>().Save(SheetWithSale());
        result.Harvest.TotalKg.ShouldBe(503m);
        result.Harvest.SoldKg.ShouldBe(503m);
        result.Harvest.UnaccountedKg.ShouldBe(0m);
        result.Sale.BuyerId.ShouldBe(Buyer);
        result.Sale.Total.ShouldBe(110861.20m);
        result.Sale.DispatchReceiptNo.ShouldNotBeNullOrEmpty();
        result.Sale.Lines.Single().PriceAbwG.ShouldBe(12.08m);
        result.Warnings.ShouldNotContain(w => w.Kind == "PriceFormula");
    }

    [Fact]
    public async Task Tally_sheet_checks_the_sale_before_saving_the_harvest()
    {
        var before = Q(c => c.Harvests.IgnoreQueryFilters().Count());
        var sheets = Resolve<TallySheetAppService>();

        var noTerms = SheetWithSale();
        noTerms.Sale.StepPerG = null;
        await Should.ThrowAsync<UserFriendlyException>(() => sheets.Save(noTerms));

        var noBuyer = SheetWithSale();
        noBuyer.Harvest.BuyerId = null;
        await Should.ThrowAsync<UserFriendlyException>(() => sheets.Save(noBuyer));

        var noGrade = SheetWithSale();
        noGrade.Harvest.GradeLines = new();
        await Should.ThrowAsync<UserFriendlyException>(() => sheets.Save(noGrade));

        Q(c => c.Harvests.IgnoreQueryFilters().Count()).ShouldBe(before);
    }

    [Fact]
    public async Task A_buyers_last_harvest_and_sale_suggest_the_next_one()
    {
        var tub = await Resolve<ContainerTypeAppService>().Save(new ContainerTypeDto { Name = "Tub 30 kg – GenSan", NominalKg = 30 });
        var sheet = SheetWithSale();
        sheet.Harvest.Crates = Enumerable.Repeat(30m, 16).Append(23m).Select(kg => new CrateInput { Kg = kg, ContainerTypeId = tub }).ToList();
        await Resolve<TallySheetAppService>().Save(sheet);

        var defaults = await Resolve<TallySheetAppService>().GetBuyerDefaults(Buyer);
        defaults.ContainerTypeId.ShouldBe(tub);
        defaults.WeighedBy.ShouldBe(WeighedBy.Buyer);
        defaults.PaymentTerms.ShouldBe("Cash on harvest");
        defaults.PriceTerms.BasePricePerKg.ShouldBe(210m);
        (await Resolve<TallySheetAppService>().GetBuyerOptions()).ShouldContain(b => b.Id == Buyer);
    }

    // ---------------------------------------------------------------- DEC-82: count and table pricing, graded crates, print
    private async Task<Guid> Table(string name, Guid? buyerId, params (int? Min, int? Max, decimal Price)[] rows) =>
        await Resolve<PriceTableAppService>().Save(new PriceTableDto
        {
            Name = name, BuyerId = buyerId,
            Rows = rows.Select(r => new PriceTableRowDto { MinCountPerKg = r.Min, MaxCountPerKg = r.Max, PricePerKg = r.Price }).ToList(),
        });

    private static SaleLineInput Line(Guid gradeLineId, decimal kg, decimal price, PriceMethod method) =>
        new() { HarvestGradeLineId = gradeLineId, Kg = kg, PricePerKg = price, PriceMethod = method };

    [Fact]
    public void Count_from_abw_and_base_count_price()
    {
        SaleLine.CountFromAbw(12.08m).ShouldBe(83m); // 1000 ÷ 12.08 = 82.8
        SaleLine.BaseCountPrice(210, 100, 1, 83).ShouldBe(227m); // 17 pieces fewer than the base count
        SaleLine.BaseCountPrice(210, 100, 1, 110).ShouldBe(200m); // smaller shrimp pay less
    }

    [Fact]
    public async Task Base_count_price_uses_the_count_from_the_harvest_abw()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        var line = Line(harvest.GradeLines.Single().Id, 503, 227, PriceMethod.BaseCount);
        line.BasePricePerKg = 210;
        line.BaseCountPerKg = 100;
        line.StepPerCount = 1;
        var sale = await Resolve<SaleAppService>().Create(new SaveSaleInput { BuyerId = Buyer, SaleDate = Today, Lines = new() { line } });

        var saved = sale.Lines.Single();
        saved.PriceCountPerKg.ShouldBe(83m);
        saved.FormulaPricePerKg.ShouldBe(227m);
        sale.Total.ShouldBe(114181m); // 503 × 227
        sale.Warnings.ShouldNotContain(w => w.Kind == "PriceFormula");

        var missing = Line(harvest.GradeLines.Single().Id, 1, 227, PriceMethod.BaseCount);
        missing.BasePricePerKg = 210;
        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<SaleAppService>().Create(new SaveSaleInput { BuyerId = Buyer, SaleDate = Today, Lines = new() { missing } }));
    }

    [Fact]
    public async Task Price_table_reads_the_row_for_the_count_and_keeps_a_copy()
    {
        var table = await Table("GenSan November", Buyer, (null, 70, 260), (71, 90, 220), (91, null, 200));
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        var gradeLine = harvest.GradeLines.Single().Id;
        var sales = Resolve<SaleAppService>();

        var line = Line(gradeLine, 300, 220, PriceMethod.Table);
        line.PriceTableId = table;
        var sale = await sales.Create(new SaveSaleInput { BuyerId = Buyer, SaleDate = Today, Lines = new() { line } });
        var saved = sale.Lines.Single();
        saved.PriceCountPerKg.ShouldBe(83m);
        saved.PriceTableRowLabel.ShouldBe("71–90 pcs/kg");
        saved.PriceTableName.ShouldBe("GenSan November");
        saved.FormulaPricePerKg.ShouldBe(220m);
        sale.Warnings.ShouldNotContain(w => w.Kind == "PriceFormula");

        // Editing the table later does not change the saved sale.
        await Resolve<PriceTableAppService>().Save(new PriceTableDto
        {
            Id = table, Name = "GenSan November", BuyerId = Buyer,
            Rows = new() { new() { MaxCountPerKg = 90, PricePerKg = 999 }, new() { MinCountPerKg = 91, PricePerKg = 200 } },
        });
        (await sales.Get(sale.Id)).Lines.Single().PriceTableRowLabel.ShouldBe("71–90 pcs/kg");

        // A different agreed price warns; a count no row covers is rejected.
        var other = Line(gradeLine, 100, 230, PriceMethod.Table);
        other.PriceTableId = table;
        (await sales.Create(new SaveSaleInput { BuyerId = Buyer, SaleDate = Today, Lines = new() { other } })).Warnings.ShouldContain(w => w.Kind == "PriceFormula");

        var gap = await Table("Big shrimp only", null, (null, 40, 450));
        var outside = Line(gradeLine, 10, 450, PriceMethod.Table);
        outside.PriceTableId = gap;
        await Should.ThrowAsync<UserFriendlyException>(() => sales.Create(new SaveSaleInput { BuyerId = Buyer, SaleDate = Today, Lines = new() { outside } }));
    }

    [Fact]
    public async Task Price_tables_reject_overlaps_and_suggest_a_buyers_table()
    {
        await Should.ThrowAsync<UserFriendlyException>(() => Table("Overlap", null, (41, 50, 400), (50, 60, 380)));
        await Should.ThrowAsync<UserFriendlyException>(() => Table("Open middle", null, (41, null, 400), (51, 60, 380)));
        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<PriceTableAppService>().Save(new PriceTableDto { Name = "Empty" }));

        var table = await Table("GenSan list", Buyer, (null, 60, 380), (61, null, 300));
        var terms = await Resolve<SaleAppService>().GetBuyerPriceTerms(Buyer);
        terms.PriceMethod.ShouldBe(PriceMethod.Table);
        terms.PriceTableId.ShouldBe(table);
    }

    [Fact]
    public async Task Graded_crates_make_the_grade_lines()
    {
        var input = TallySheet();
        input.Crates = new()
        {
            new() { Kg = 30, SizeGradeId = Grade("50/60") },
            new() { Kg = 30, SizeGradeId = Grade("50/60") },
            new() { Kg = 25, SizeGradeId = Grade("100/120") },
            new() { Kg = 20 },
        };
        input.GradeLines = new() { new() { SizeGradeId = Grade("80/90"), Kg = 1 } }; // ignored: the crates decide
        var harvest = await Resolve<HarvestAppService>().Create(input);

        harvest.TotalKg.ShouldBe(105m);
        harvest.GradeLines.Count.ShouldBe(3);
        harvest.GradeLines.Single(g => g.SizeLabel == "50/60").Kg.ShouldBe(60m);
        harvest.GradeLines.Single(g => g.SizeLabel == "100/120").Kg.ShouldBe(25m);
        harvest.GradeLines.Single(g => g.IsUngraded).Kg.ShouldBe(20m);
        harvest.Crates.First().SizeLabel.ShouldBe("50/60");
        harvest.Crates.Last().SizeGradeId.ShouldBeNull();
    }

    [Fact]
    public async Task Tally_sheet_prices_each_grade_from_its_count_with_a_table()
    {
        var table = await Table("GenSan by count", Buyer, (51, 60, 380), (61, 100, 300), (101, 120, 250));
        var sheet = SheetWithSale();
        sheet.Harvest.Crates = new()
        {
            new() { Kg = 30, SizeGradeId = Grade("50/60") },
            new() { Kg = 20, SizeGradeId = Grade("100/120") },
        };
        sheet.Sale = new TallySaleInput { PriceMethod = PriceMethod.Table, PriceTableId = table };
        var result = await Resolve<TallySheetAppService>().Save(sheet);

        result.Sale.Lines.Single(l => l.SizeLabel == "50/60").PricePerKg.ShouldBe(380m);   // 55 pcs/kg
        result.Sale.Lines.Single(l => l.SizeLabel == "100/120").PricePerKg.ShouldBe(250m); // 110 pcs/kg
        result.Sale.Total.ShouldBe(30 * 380m + 20 * 250m);
        result.Warnings.ShouldNotContain(w => w.Kind == "PriceFormula");
    }

    [Fact]
    public async Task Printable_tally_sheet_has_the_crates_and_the_sale()
    {
        var result = await Resolve<TallySheetAppService>().Save(SheetWithSale());
        var print = await Resolve<TallySheetAppService>().GetPrint(result.Harvest.Id);

        print.Harvest.Crates.Count.ShouldBe(17);
        print.BuyerName.ShouldStartWith("GenSan");
        print.ShowsSales.ShouldBeTrue();
        print.Sales.Single().Amount.ShouldBe(110861.20m);
        print.Sales.Single().DispatchReceiptNo.ShouldBe(result.Sale.DispatchReceiptNo);
        print.FarmName.ShouldNotBeNullOrEmpty();
    }

    [Fact]
    public async Task Editing_a_harvest_can_remove_an_unsold_grade_line_and_a_not_sold_entry()
    {
        var harvests = Resolve<HarvestAppService>();
        var input = new SaveHarvestInput
        {
            BatchId = BatchId(CurrentBatch), HarvestedAt = DateTime.UtcNow.AddHours(-2), HarvestType = HarvestType.Partial, TotalKg = 100, AbwG = 9,
            GradeLines = new() { new() { SizeGradeId = Grade("50/60"), Kg = 60 }, new() { SizeGradeId = Grade("100/120"), Kg = 30 } },
            Disposals = new() { new() { Kg = 10, Reason = DisposalReason.StaffOrHomeUse } },
        };
        var harvest = await harvests.Create(input);

        input.Id = harvest.Id;
        input.GradeLines = new() { new() { SizeGradeId = Grade("50/60"), Kg = 90 } };
        input.Disposals = new();
        var edited = await harvests.Update(input);
        edited.GradeLines.Single().Kg.ShouldBe(90m);
        edited.Disposals.ShouldBeEmpty();
    }
}
