using Abp.Authorization;
using Abp.UI;
using Capstone.Farms;
using Capstone.Ponds;
using Shouldly;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Step B: pond name prefixes, generated pond codes and the farm-level farming system (AC-04, DEC-20).</summary>
public class PondNaming_Tests : FpmsTestBase
{
    private static PondEditDto NewPond(System.Guid prefixId, int? number = null) => new()
    {
        PrefixId = prefixId, Number = number, AreaM2 = 1000, AverageDepthM = 1.2m, MaxDepthM = 1.5m,
        Purpose = PondPurpose.GrowOut, ConstructionType = PondConstructionType.Earthen,
    };

    [Theory]
    [InlineData("Grow-out Pond", "GP")]
    [InlineData("Nursery Pond", "NP")]
    [InlineData("Reservoir", "R")]
    [InlineData("  settling   pond ", "SP")]
    public void Short_code_is_suggested_from_the_initials(string name, string expected)
    {
        PondNaming.SuggestShortCode(name).ShouldBe(expected);
    }

    [Fact]
    public void Codes_use_a_two_digit_number()
    {
        PondNaming.FormatCode("GP", 3).ShouldBe("GP-03");
        PondNaming.FormatCode("GP", 120).ShouldBe("GP-120");
        PondNaming.DisplayName("Grow-out Pond", 3).ShouldBe("Grow-out Pond 3");
    }

    [Fact]
    public async Task Every_farm_gets_the_default_prefixes()
    {
        var prefixes = await Resolve<PondAppService>().GetPrefixes();
        prefixes.Select(p => p.ShortCode).ShouldBe(new[] { "GP", "NP", "R" });
        prefixes.Single(p => p.ShortCode == "GP").NextNumber.ShouldBe(4); // seed has GP-01 to GP-03
        prefixes.Single(p => p.ShortCode == "NP").NextNumber.ShouldBe(1);
    }

    [Fact]
    public async Task Next_free_number_is_used_when_none_is_given()
    {
        var ponds = Resolve<PondAppService>();
        var id = await ponds.Create(NewPond(PrefixId("GP")));
        (await ponds.Get(id)).PondCode.ShouldBe("GP-04");
        var nursery = await ponds.Create(NewPond(PrefixId("NP")));
        (await ponds.Get(nursery)).PondCode.ShouldBe("NP-01");
    }

    [Fact]
    public async Task A_taken_number_is_rejected_with_the_next_free_number()
    {
        var ex = await Should.ThrowAsync<UserFriendlyException>(() => Resolve<PondAppService>().Create(NewPond(PrefixId("GP"), 2)));
        ex.Message.ShouldContain("next free number is 4");
    }

    [Fact]
    public async Task Renaming_a_prefix_keeps_existing_codes_and_renames_the_pond()
    {
        var ponds = Resolve<PondAppService>();
        var gp = (await ponds.GetPrefixes()).Single(p => p.ShortCode == "GP");
        gp.Name = "Production Pond";
        await ponds.UpdatePrefix(gp);
        var pond = await ponds.Get(PondId("GP-01"));
        pond.PondCode.ShouldBe("GP-01");
        pond.Name.ShouldBe("Production Pond 1");
    }

    [Fact]
    public async Task New_prefix_gets_a_short_code_and_duplicates_are_rejected()
    {
        var ponds = Resolve<PondAppService>();
        var id = await ponds.CreatePrefix(new PondPrefixDto { Name = "Settling Pond" });
        (await ponds.GetPrefixes()).Single(p => p.Id == id).ShortCode.ShouldBe("SP");
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.CreatePrefix(new PondPrefixDto { Name = "Settling Pond" }));
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.CreatePrefix(new PondPrefixDto { Name = "Sump Pit" })); // SP taken
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.CreatePrefix(new PondPrefixDto { Name = "Test", ShortCode = "T1" }));
        var sump = await ponds.CreatePrefix(new PondPrefixDto { Name = "Sump Pit", ShortCode = "spt" });
        (await ponds.GetPrefixes()).Single(p => p.Id == sump).ShortCode.ShouldBe("SPT");
    }

    [Fact]
    public async Task Inactive_prefix_cannot_be_used_for_a_new_pond()
    {
        var ponds = Resolve<PondAppService>();
        var np = (await ponds.GetPrefixes()).Single(p => p.ShortCode == "NP");
        np.IsActive = false;
        await ponds.UpdatePrefix(np);
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.Create(NewPond(np.Id)));
    }

    [Fact]
    public async Task Technician_cannot_manage_prefixes()
    {
        LoginAsPilotTechnician();
        (await Resolve<PondAppService>().GetPrefixes()).Count.ShouldBe(3);
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<PondAppService>().CreatePrefix(new PondPrefixDto { Name = "Settling Pond" }));
    }

    [Fact]
    public async Task Ponds_inherit_the_farm_farming_system_unless_overridden()
    {
        var ponds = Resolve<PondAppService>();
        (await ponds.Get(PondId("GP-01"))).FarmingSystem.ShouldBe(FarmingSystem.SemiIntensive);
        (await ponds.Get(PondId("GP-03"))).FarmingSystem.ShouldBe(FarmingSystem.Intensive);

        var profiles = Resolve<FarmProfileAppService>();
        var profile = await profiles.Get();
        profile.FarmingSystem = FarmingSystem.Extensive;
        await profiles.Update(profile);

        ponds = Resolve<PondAppService>(); // a new request reads the saved farm setting
        var inherited = await ponds.Get(PondId("GP-01"));
        inherited.FarmingSystem.ShouldBe(FarmingSystem.Extensive);
        inherited.FarmingSystemOverride.ShouldBeNull();
        inherited.SystemWarning.ShouldBeNull(); // extensive in an earthen pond is normal (DEC-65)
        (await ponds.Get(PondId("GP-03"))).FarmingSystem.ShouldBe(FarmingSystem.Intensive);
    }
}
