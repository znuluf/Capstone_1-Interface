using Abp.Authorization;
using Abp.UI;
using Capstone.Compliance;
using Capstone.Domain;
using Capstone.Farms;
using Capstone.Harvests;
using Capstone.ReferenceData;
using Shouldly;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Step B: size grades, farm display settings, permit categories, recommendations and the number sequence.</summary>
public class ReferenceSetup_Tests : FpmsTestBase
{
    [Fact]
    public async Task Farm_has_the_default_size_grades_and_owner_can_edit_them()
    {
        var service = Resolve<SizeGradeAppService>();
        var grades = await service.GetAll();
        grades.Select(g => g.Label).ShouldContain("60/70");
        grades.Select(g => g.Label).ShouldContain(SizeGrade.UngradedLabel);
        grades.Count.ShouldBe(FarmDefaults.SizeGrades.Count + 1);

        var id = await service.Save(new SizeGradeDto { Label = "20/30", MinCountPerKg = 20, MaxCountPerKg = 30 });
        (await service.GetAll()).Single(g => g.Id == id).IsActive.ShouldBeTrue();
        await Should.ThrowAsync<UserFriendlyException>(() => service.Save(new SizeGradeDto { Label = "20/30" }));
        await Should.ThrowAsync<UserFriendlyException>(() => service.Save(new SizeGradeDto { Label = "bad", MinCountPerKg = 50, MaxCountPerKg = 40 }));
    }

    [Fact]
    public async Task Technician_reads_but_cannot_edit_size_grades()
    {
        LoginAsPilotTechnician();
        (await Resolve<SizeGradeAppService>().GetAll()).ShouldNotBeEmpty();
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<SizeGradeAppService>().Save(new SizeGradeDto { Label = "20/30" }));
    }

    [Fact]
    public async Task Date_order_and_clock_settings_are_saved()
    {
        var profiles = Resolve<FarmProfileAppService>();
        var p = await profiles.Get();
        p.DateOrder.ShouldBe(FarmDateOrder.MonthFirst);
        p.Use24HourTime.ShouldBeFalse();
        p.DateOrder = FarmDateOrder.DayFirst;
        p.Use24HourTime = true;
        await profiles.Update(p);
        var saved = await Resolve<FarmProfileAppService>().Get();
        saved.DateOrder.ShouldBe(FarmDateOrder.DayFirst);
        saved.Use24HourTime.ShouldBeTrue();
    }

    [Fact]
    public async Task Permit_categories_use_the_new_names()
    {
        var names = (await Resolve<ComplianceAppService>().GetCategories()).Select(c => c.Name).ToList();
        names.ShouldBe(FarmDefaults.DocumentCategories.Select(c => c.Name), ignoreOrder: true);
        names.ShouldContain("Water Rights (NWRB)");
    }

    [Fact]
    public void Recommendation_depends_on_the_side_of_the_range()
    {
        var p = new ParameterDefinition { OptimalMin = 5m, OptimalMax = 9m, LowRecommendation = "low", HighRecommendation = "high" };
        p.RecommendationFor(4.9m).ShouldBe("low");
        p.RecommendationFor(9.1m).ShouldBe("high");
        p.RecommendationFor(7m).ShouldBeNull();
    }

    [Fact]
    public async Task Seeded_parameters_have_recommendations()
    {
        var parameters = await Resolve<ReferenceDataAppService>().GetParameters();
        parameters.Single(x => x.Code == ParameterCodes.DO).LowRecommendation.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Number_sequence_counts_up_per_scope()
    {
        var generator = Resolve<INumberSequenceGenerator>();
        var values = await InUow(async () => new[]
        {
            await generator.NextAsync(NumberSequenceType.DispatchReceipt, "2026"),
            await generator.NextAsync(NumberSequenceType.DispatchReceipt, "2026"),
            await generator.NextAsync(NumberSequenceType.DispatchReceipt, "2027"),
            await generator.NextAsync(NumberSequenceType.CycleCode, "2026-11-SBH"),
        });
        values.ShouldBe(new[] { 1, 2, 1, 1 });
    }
}
