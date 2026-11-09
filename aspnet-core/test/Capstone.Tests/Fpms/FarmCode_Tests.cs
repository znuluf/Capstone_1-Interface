using Abp.UI;
using Capstone.Authorization.Accounts;
using Capstone.Authorization.Accounts.Dto;
using Capstone.Farms;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Changing the farm code (DEC-78): owner only, unique, old codes stay reserved and point to the new one.</summary>
public class FarmCode_Tests : FpmsTestBase
{
    private FarmProfileAppService Profiles => Resolve<FarmProfileAppService>();

    private async Task<ChangeFarmCodeResultDto> Change(string code) => await Profiles.ChangeFarmCode(new ChangeFarmCodeInput { NewCode = code });

    /// <summary>Moves the farm's history back so the 30 day wait is over.</summary>
    private void FinishWaiting() =>
        UsingDbContext(null, c =>
        {
            foreach (var x in c.FarmCodeChanges.ToList())
            {
                x.ChangedAt = x.ChangedAt.AddDays(-(FarmCodeManager.CooldownDays + 1));
            }

            c.SaveChanges();
        });

    private async Task<IsTenantAvailableOutput> SignInLookup(string code)
    {
        AbpSession.TenantId = null;
        AbpSession.UserId = null;
        return await Resolve<AccountAppService>().IsTenantAvailable(new IsTenantAvailableInput { TenancyName = code });
    }

    [Fact]
    public async Task Owner_can_change_the_code_and_the_old_code_points_to_the_new_one()
    {
        (await Profiles.Get()).CanChangeFarmCode.ShouldBeTrue();

        var result = await Change("PILOT-NEW");
        result.OldCode.ShouldBe(PilotFarm);
        result.FarmCode.ShouldBe("PILOT-NEW");

        var profile = await Profiles.Get();
        profile.FarmCode.ShouldBe("PILOT-NEW");
        profile.NextFarmCodeChange.ShouldNotBeNull();

        var history = Q(c => c.FarmCodeChanges.Single());
        history.OldCode.ShouldBe(PilotFarm);
        history.NewCode.ShouldBe("PILOT-NEW");
        history.ChangedByName.ShouldNotBeNullOrWhiteSpace();

        var old = await SignInLookup(PilotFarm);
        old.State.ShouldBe(TenantAvailabilityState.NotFound);
        old.ReplacedByFarmCode.ShouldBe("PILOT-NEW");
        (await SignInLookup("pilot-farm")).ReplacedByFarmCode.ShouldBe("PILOT-NEW"); // case is ignored

        var current = await SignInLookup("PILOT-NEW");
        current.State.ShouldBe(TenantAvailabilityState.Available);
        current.ReplacedByFarmCode.ShouldBeNull();

        (await SignInLookup("no-such-farm")).ReplacedByFarmCode.ShouldBeNull();
    }

    [Fact]
    public async Task The_technician_cannot_change_or_check_the_code()
    {
        LoginAsPilotTechnician();
        (await Profiles.Get()).CanChangeFarmCode.ShouldBeFalse();
        await ThrowsAny(() => Change("TECH-TRY"));
        Q(c => c.FarmCodeChanges.Count()).ShouldBe(0);
    }

    [Fact]
    public async Task A_code_used_by_another_farm_is_rejected_ignoring_case()
    {
        await Should.ThrowAsync<UserFriendlyException>(() => Change(SecondFarm));
        await Should.ThrowAsync<UserFriendlyException>(() => Change(SecondFarm.ToUpperInvariant()));
        var check = await Profiles.GetFarmCodeAvailability(new FarmCodeCheckInput { Code = SecondFarm });
        check.Available.ShouldBeFalse();
        check.Message.ShouldContain("already taken");
        Q(c => c.FarmCodeChanges.Count()).ShouldBe(0);
    }

    [Fact]
    public async Task A_badly_formed_code_is_rejected()
    {
        foreach (var bad in new[] { "1farm", "a", "has space", "dot.dot", "  " })
        {
            await ThrowsAny(() => Change(bad));
        }

        (await Profiles.GetFarmCodeAvailability(new FarmCodeCheckInput { Code = "x" })).Available.ShouldBeFalse();
        (await Profiles.GetFarmCodeAvailability(new FarmCodeCheckInput { Code = "good-code" })).Available.ShouldBeTrue();
        (await Profiles.Get()).FarmCode.ShouldBe(PilotFarm);
    }

    [Fact]
    public async Task The_code_cannot_be_changed_again_for_thirty_days()
    {
        await Change("PILOT-ONE");
        var ex = await Should.ThrowAsync<UserFriendlyException>(() => Change("PILOT-TWO"));
        ex.Message.ShouldContain("changed recently");
        (await Profiles.Get()).FarmCode.ShouldBe("PILOT-ONE");

        FinishWaiting();
        (await Profiles.Get()).NextFarmCodeChange.ShouldBeNull();
        (await Change("PILOT-TWO")).OldCode.ShouldBe("PILOT-ONE");
        Q(c => c.FarmCodeChanges.Count()).ShouldBe(2);
    }

    [Fact]
    public async Task A_retired_code_is_reserved_for_every_farm_including_the_one_that_had_it()
    {
        await Change("PILOT-ONE");
        FinishWaiting();

        // The same farm cannot go back to it.
        var back = await Should.ThrowAsync<UserFriendlyException>(() => Change(PilotFarm));
        back.Message.ShouldContain("stays reserved");

        // Another farm cannot take it either.
        LoginAsSecondFarmOwner();
        var other = await Should.ThrowAsync<UserFriendlyException>(() => Change(PilotFarm));
        other.Message.ShouldContain("stays reserved");
        (await Profiles.Get()).FarmCode.ShouldBe(SecondFarm);
    }

    [Fact]
    public async Task Staff_can_still_sign_in_with_the_new_code()
    {
        await Change("PILOT-NEW");
        LoginAsTenant("PILOT-NEW", "owner");
        (await Profiles.Get()).FarmCode.ShouldBe("PILOT-NEW");
    }
}
