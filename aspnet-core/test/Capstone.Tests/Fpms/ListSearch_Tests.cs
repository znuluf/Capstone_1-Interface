using Capstone.Common;
using Capstone.Production;
using Capstone.Production.Dto;
using Shouldly;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>The list toolbar's text search: every typed word must appear somewhere in the row, case does not matter.</summary>
public class ListSearch_Tests : FpmsTestBase
{
    [Fact]
    public void Search_text_needs_every_word_in_some_field_and_ignores_case()
    {
        SearchText.Matches(null, "GP-01").ShouldBeTrue();
        SearchText.Matches("  ", "GP-01").ShouldBeTrue();
        SearchText.Matches("gp-01", "GP-01", "Batch A").ShouldBeTrue();
        SearchText.Matches("gp-01 batch", "GP-01", "Batch A").ShouldBeTrue();
        SearchText.Matches("gp-02", "GP-01", "Batch A").ShouldBeFalse();
        SearchText.Matches("gp-01 zzz", "GP-01", "Batch A").ShouldBeFalse();
        SearchText.Matches("x", null, "").ShouldBeFalse();
    }

    [Fact]
    public async Task Cycle_search_narrows_the_page_and_the_status_counts()
    {
        var cycles = Resolve<CycleAppService>();
        var all = await cycles.GetPage(new GetCyclePageInput());
        all.TotalCount.ShouldBeGreaterThan(0);
        var code = all.Items.First().CycleCode;

        var hit = await cycles.GetPage(new GetCyclePageInput { Search = code });
        hit.Items.ShouldContain(c => c.CycleCode == code);
        (await cycles.GetPage(new GetCyclePageInput { Search = "no-such-cycle-zzz" })).TotalCount.ShouldBe(0);

        var counts = await cycles.GetStatusCounts(new GetCyclePageInput { Search = code });
        counts.Sum(c => c.Count).ShouldBe(hit.TotalCount);
    }
}
