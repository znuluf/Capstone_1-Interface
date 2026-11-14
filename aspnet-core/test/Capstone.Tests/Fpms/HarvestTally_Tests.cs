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

    /// <summary>DEC-85: recording a sale on the harvest form or on the Sales form gives the same price and amount.</summary>
    [Fact]
    public async Task The_harvest_form_and_the_sales_form_price_the_same_terms_the_same()
    {
        var together = await Resolve<TallySheetAppService>().Save(SheetWithSale());

        var later = TallySheet();
        later.HarvestedAt = DateTime.UtcNow.AddHours(-1);
        var harvest = await Resolve<HarvestAppService>().Create(later);
        var separate = await Resolve<SaleAppService>().Create(new SaveSaleInput
        {
            BuyerId = Buyer, SaleDate = Today, Lines = new() { BaseAbwLine(harvest.GradeLines.Single().Id, 220.40m) },
        });

        var onHarvestForm = together.Sale.Lines.Single();
        var onSalesForm = separate.Lines.Single();
        onSalesForm.PricePerKg.ShouldBe(onHarvestForm.PricePerKg);
        onSalesForm.FormulaPricePerKg.ShouldBe(onHarvestForm.FormulaPricePerKg);
        onSalesForm.PriceAbwG.ShouldBe(onHarvestForm.PriceAbwG);
        separate.Total.ShouldBe(together.Sale.Total);
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

        // A farm that grades must put the kg on a grade line; one that does not (DEC-100) sells it as one ungraded line.
        SetSizeGrading(true);
        var noGrade = SheetWithSale();
        noGrade.Harvest.GradeLines = new();
        await Should.ThrowAsync<UserFriendlyException>(() => sheets.Save(noGrade));

        Q(c => c.Harvests.IgnoreQueryFilters().Count()).ShouldBe(before);

        SetSizeGrading(false);
        var ungraded = SheetWithSale();
        ungraded.Harvest.GradeLines = new();
        await sheets.Save(ungraded);
        Q(c => c.Harvests.IgnoreQueryFilters().Count()).ShouldBe(before + 1);
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
    // ---- Crates dispatched per sale (DEC-86)

    private static List<SaleCrateInput> Crates(Guid harvestId, int from, int to) =>
        Enumerable.Range(from, to - from + 1).Select(n => new SaleCrateInput { HarvestId = harvestId, CrateNo = n }).ToList();

    private SaveSaleInput SaleOf(Guid gradeLineId, decimal kg, List<SaleCrateInput> crates) => new()
    {
        BuyerId = Buyer, SaleDate = Today, Lines = new() { Line(gradeLineId, kg, 200, PriceMethod.Fixed) }, Crates = crates,
    };

    [Fact]
    public async Task Each_sale_lists_its_own_crates_and_a_crate_goes_on_one_sale_only()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet()); // 16 crates of 30 kg and one of 23 kg
        var gradeLine = harvest.GradeLines.Single().Id;
        var sales = Resolve<SaleAppService>();

        var first = await sales.Create(SaleOf(gradeLine, 300, Crates(harvest.Id, 1, 10)));
        first.Crates.Select(c => c.CrateNo).ShouldBe(Enumerable.Range(1, 10));
        first.Crates.Sum(c => c.Kg).ShouldBe(300m);
        first.Crates.ShouldAllBe(c => c.LotCode == harvest.LotCode);
        first.Warnings.ShouldNotContain(w => w.Kind == "CrateTally");

        // Crate 10 is already on the first receipt.
        await Should.ThrowAsync<UserFriendlyException>(() => sales.Create(SaleOf(gradeLine, 203, Crates(harvest.Id, 10, 17))));

        var second = await sales.Create(SaleOf(gradeLine, 203, Crates(harvest.Id, 11, 17)));
        second.Crates.Count.ShouldBe(7);
        second.Crates.Sum(c => c.Kg).ShouldBe(203m);

        var saved = await Resolve<HarvestAppService>().Get(harvest.Id);
        saved.Crates.Count(c => c.SaleId == first.Id).ShouldBe(10);
        saved.Crates.Count(c => c.SaleId == second.Id).ShouldBe(7);
    }

    [Fact]
    public async Task Crates_that_do_not_add_up_to_the_kg_sold_warn_but_save()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        var sale = await Resolve<SaleAppService>().Create(SaleOf(harvest.GradeLines.Single().Id, 295, Crates(harvest.Id, 1, 10)));
        sale.Crates.Count.ShouldBe(10);
        sale.Warnings.ShouldContain(w => w.Kind == "CrateTally");
    }

    [Fact]
    public async Task A_sale_without_crates_saves_as_before_and_editing_it_keeps_its_crates()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        var gradeLine = harvest.GradeLines.Single().Id;
        var sales = Resolve<SaleAppService>();

        var plain = await sales.Create(SaleOf(gradeLine, 100, null));
        plain.Crates.ShouldBeEmpty();
        plain.Warnings.ShouldNotContain(w => w.Kind == "CrateTally");

        var withCrates = await sales.Create(SaleOf(gradeLine, 60, Crates(harvest.Id, 1, 2)));
        var edit = SaleOf(gradeLine, 60, null); // no crate list: the crates stay as they are
        edit.Id = withCrates.Id;
        (await sales.Update(edit)).Crates.Count.ShouldBe(2);

        edit.Crates = new(); // an empty list takes them all off
        (await sales.Update(edit)).Crates.ShouldBeEmpty();
    }

    [Fact]
    public async Task Voiding_a_sale_frees_its_crates()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        var gradeLine = harvest.GradeLines.Single().Id;
        var sales = Resolve<SaleAppService>();
        var sale = await sales.Create(SaleOf(gradeLine, 300, Crates(harvest.Id, 1, 10)));

        LoginAsPilotOwner();
        await sales.Void(new VoidSaleInput { Id = sale.Id, Reason = "Buyer cancelled" });
        (await Resolve<HarvestAppService>().Get(harvest.Id)).Crates.ShouldAllBe(c => c.SaleId == null);

        var again = await sales.Create(SaleOf(gradeLine, 300, Crates(harvest.Id, 1, 10)));
        again.Crates.Count.ShouldBe(10);
    }

    [Fact]
    public async Task A_dispatched_crate_cannot_be_re_weighed_or_removed_from_the_harvest()
    {
        var harvests = Resolve<HarvestAppService>();
        var input = TallySheet();
        var harvest = await harvests.Create(input);
        // The last two crates (30 kg and 23 kg) go on a sale.
        var sale = await Resolve<SaleAppService>().Create(SaleOf(harvest.GradeLines.Single().Id, 53, Crates(harvest.Id, 16, 17)));

        input.Id = harvest.Id;
        var crates = input.Crates;
        input.Crates = crates.Select((c, i) => new CrateInput { Kg = i == 16 ? 24 : c.Kg }).ToList(); // crate 17 re-weighed
        await Should.ThrowAsync<UserFriendlyException>(() => harvests.Update(input));

        input.Crates = crates.Skip(1).ToList(); // crate 1 removed: crate 16 would become the 23 kg one and crate 17 would be gone
        await Should.ThrowAsync<UserFriendlyException>(() => harvests.Update(input));

        // Saving the harvest with its tally unchanged keeps the crates on the sale.
        input.Crates = crates;
        (await harvests.Update(input)).Crates.Count(c => c.SaleId == sale.Id).ShouldBe(2);
    }

    [Fact]
    public async Task A_harvest_saved_with_its_sale_puts_every_crate_on_that_sale()
    {
        var result = await Resolve<TallySheetAppService>().Save(SheetWithSale());
        result.Sale.Crates.Count.ShouldBe(17);
        result.Sale.Crates.Sum(c => c.Kg).ShouldBe(503m);
        result.Harvest.Crates.ShouldAllBe(c => c.SaleId == result.Sale.Id);
        result.Warnings.ShouldNotContain(w => w.Kind == "CrateTally");
    }

    // ---- List filters and sorting (DEC-85 step 5)

    [Fact]
    public async Task The_harvest_list_filters_by_sale_status_buyer_and_date()
    {
        var harvests = Resolve<HarvestAppService>();
        var unsold = await harvests.Create(TallySheet());
        var later = TallySheet();
        later.HarvestedAt = DateTime.UtcNow.AddHours(-1);
        var partly = await harvests.Create(later);
        await Resolve<SaleAppService>().Create(SaleOf(partly.GradeLines.Single().Id, 300, null));

        var byStatus = await harvests.GetList(new GetHarvestsInput { SaleStatus = HarvestSaleStatus.PartlySold, MaxResultCount = 100 });
        byStatus.Items.ShouldContain(h => h.Id == partly.Id);
        byStatus.Items.ShouldAllBe(h => h.SaleStatus == HarvestSaleStatus.PartlySold);

        var counts = await harvests.GetSaleStatusCounts(new GetHarvestsInput());
        counts.Single(c => c.Status == (int)HarvestSaleStatus.PartlySold).Count.ShouldBeGreaterThanOrEqualTo(1);
        counts.Single(c => c.Status == HarvestAppService.UnaccountedCountStatus).Count.ShouldBeGreaterThanOrEqualTo(2);

        // The buyer filter finds a harvest by a sale to that buyer; the unsold harvest names no buyer.
        var forBuyer = await harvests.GetList(new GetHarvestsInput { BuyerId = Buyer, MaxResultCount = 100 });
        forBuyer.Items.ShouldContain(h => h.Id == partly.Id);
        forBuyer.Items.ShouldNotContain(h => h.Id == unsold.Id);

        (await harvests.GetList(new GetHarvestsInput { From = Today.AddDays(1), MaxResultCount = 100 })).Items.ShouldBeEmpty();
        var byBalance = await harvests.GetList(new GetHarvestsInput { To = Today, UnaccountedOnly = true, Sorting = "unaccountedKg desc", MaxResultCount = 100 });
        byBalance.Items.ShouldContain(h => h.Id == unsold.Id);
        byBalance.Items.Select(h => h.UnaccountedKg).ShouldBeInOrder(SortDirection.Descending);
    }

    [Fact]
    public async Task The_sales_list_sorts_by_kg_and_counts_overdue_sales()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        var gradeLine = harvest.GradeLines.Single().Id;
        var sales = Resolve<SaleAppService>();
        var small = await sales.Create(SaleOf(gradeLine, 30, null));
        var big = await sales.Create(SaleOf(gradeLine, 200, null));

        var ids = (await sales.GetAll(new GetSalesInput { From = Today, Sorting = "totalKg desc", MaxResultCount = 100 })).Items.Select(s => s.Id).ToList();
        ids.IndexOf(big.Id).ShouldBeLessThan(ids.IndexOf(small.Id));

        (await sales.GetPaymentStatusCounts(new GetSalesInput { OverdueOnly = true })).ShouldContain(c => c.Status == SaleAppService.OverdueCountStatus);
    }

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

        // And add them back in a later edit.
        input.GradeLines = new() { new() { SizeGradeId = Grade("50/60"), Kg = 60 }, new() { SizeGradeId = Grade("100/120"), Kg = 30 } };
        input.Disposals = new() { new() { Kg = 5, Reason = DisposalReason.GivenAway } };
        var again = await harvests.Update(input);
        again.GradeLines.Count.ShouldBe(2);
        again.Disposals.Single().Kg.ShouldBe(5m);
    }

    [Fact]
    public async Task Editing_a_sale_replaces_its_lines()
    {
        var harvest = await Resolve<HarvestAppService>().Create(TallySheet());
        var sales = Resolve<SaleAppService>();
        var input = new SaveSaleInput { BuyerId = Buyer, SaleDate = Today, Lines = new() { Line(harvest.GradeLines.Single().Id, 300, 220, PriceMethod.Fixed) } };
        var sale = await sales.Create(input);

        input.Id = sale.Id;
        input.Lines = new() { Line(harvest.GradeLines.Single().Id, 250, 230, PriceMethod.Fixed) };
        var edited = await sales.Update(input);
        edited.Lines.Single().Kg.ShouldBe(250m);
        edited.Total.ShouldBe(57500m);
        edited.DispatchReceiptNo.ShouldBe(sale.DispatchReceiptNo);
    }

    // ---------------------------------------------------------------- DEC-83: harvest lot code YY-A-LL-FF-PP-HH
    private void SetAddress(string province, string city, string barangay) => UsingDbContext(null, c =>
    {
        var p = c.FarmProfiles.IgnoreQueryFilters().Single(x => x.Id == GetTenantId(PilotFarm));
        (p.Province, p.CityMunicipality, p.AddressLine2) = (province, city, barangay);
        c.SaveChanges();
    });

    private static string Yy => (DateTime.UtcNow.Year % 100).ToString("00");

    [Fact]
    public void Lot_places_and_format()
    {
        LotPlaces.Resolve("South Cotabato", "General Santos City", "Tambler", out _).ShouldBe((0, 24));
        LotPlaces.Resolve("Sarangani", "Maasim", "Tinoto", out _).ShouldBe((1, 4));
        LotPlaces.Resolve("South Cotabato", "General Santos City", "", out var noBarangay).ShouldBeNull();
        noBarangay.ShouldContain("barangay");
        LotPlaces.Resolve("Davao del Sur", "Davao City", "Poblacion", out _).ShouldBeNull();
        HarvestLotCoder.Format(2026, 0, 24, 3, 7, 2).ShouldBe("26-0-24-03-07-02");
    }

    [Fact]
    public async Task Harvests_get_lot_codes_numbered_per_pond_and_year_that_never_change()
    {
        // The pilot farm is in Maasim, Sarangani: area 1, municipality 04; it is the first farm there (01).
        var harvests = Resolve<HarvestAppService>();
        var first = await harvests.Create(TallySheet());
        first.LotCode.ShouldMatch($@"^{Yy}-1-04-01-\d\d-01$");
        var second = await harvests.Create(TallySheet());
        second.LotCode.ShouldBe(first.LotCode[..^2] + "02"); // same pond, next harvest

        // Correcting the date or kg keeps the code: it may already be on crates and receipts.
        var edit = TallySheet();
        edit.Id = first.Id;
        edit.HarvestedAt = DateTime.UtcNow.AddHours(-5);
        (await harvests.Update(edit)).LotCode.ShouldBe(first.LotCode);

        // The farm's area, place and number are fixed once given: moving the address does not change new codes.
        SetAddress("South Cotabato", "General Santos City", "Tambler");
        (await harvests.Create(TallySheet())).LotCode.ShouldStartWith($"{Yy}-1-04-01-");

        // Found by lot code in the harvest list.
        (await harvests.GetList(new GetHarvestsInput { Search = first.LotCode, MaxResultCount = 10 })).Items.Single().Id.ShouldBe(first.Id);
    }

    [Fact]
    public async Task Without_a_usable_address_the_harvest_saves_and_gets_its_lot_code_later()
    {
        SetAddress("South Cotabato", "General Santos City", null);
        var harvests = Resolve<HarvestAppService>();
        var input = TallySheet();
        var harvest = await harvests.Create(input);
        harvest.LotCode.ShouldBeNull();
        harvest.Warnings.ShouldContain(w => w.Kind == "LotCode");

        SetAddress("South Cotabato", "General Santos City", "Tambler");
        input.Id = harvest.Id;
        (await harvests.Update(input)).LotCode.ShouldMatch($@"^{Yy}-0-24-01-\d\d-01$");
    }

    [Fact]
    public async Task The_lot_code_shows_on_the_sale_and_finds_it()
    {
        var result = await Resolve<TallySheetAppService>().Save(SheetWithSale());
        result.Sale.Lines.Single().LotCode.ShouldBe(result.Harvest.LotCode);
        var page = await Resolve<SaleAppService>().GetAll(new GetSalesInput { Search = result.Harvest.LotCode, MaxResultCount = 10 });
        page.Items.ShouldContain(s => s.Id == result.Sale.Id);
    }
}
