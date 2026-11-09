using Abp.UI;
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
}
