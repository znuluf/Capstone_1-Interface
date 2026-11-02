using Abp.UI;
using Capstone.Authorization.Accounts;
using Capstone.Authorization.Accounts.Dto;
using Capstone.Authorization.Roles;
using Capstone.Farms;
using Capstone.Farms.Dto;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>
/// Letter case of farm codes and usernames (DEC-76, AC-44): farm codes are saved in capitals and follow the spec rule,
/// usernames are saved in lower case, and sign-in ignores case. Existing lower-case codes keep working.
/// </summary>
public class CodeCase_Tests : FpmsTestBase
{
    private static RegisterFarmInput NewFarm(string code, string ownerUserName = "rita") => new()
    {
        FarmCode = code, FarmName = "Case Test Farm", AddressLine1 = "Purok 3, Brgy. Tinoto", CityMunicipality = "Maasim", Province = "Sarangani",
        OwnerName = "Rita", OwnerSurname = "Registrant", OwnerUserName = ownerUserName, OwnerEmailAddress = "rita@example.test", OwnerPassword = "Register1x",
    };

    private AccountAppService Account()
    {
        AbpSession.TenantId = null;
        AbpSession.UserId = null;
        return Resolve<AccountAppService>();
    }

    [Fact]
    public async Task Farm_code_is_saved_in_capitals_and_found_in_any_case()
    {
        var account = Account();
        var output = await account.RegisterFarm(NewFarm("  Maasim-Farm "));
        output.FarmCode.ShouldBe("MAASIM-FARM");
        Q(c => c.Tenants.Single(t => t.Id == output.TenantId).TenancyName).ShouldBe("MAASIM-FARM");

        foreach (var typed in new[] { "MAASIM-FARM", "maasim-farm", "Maasim-Farm", " maasim-farm " })
        {
            var r = await account.IsTenantAvailable(new IsTenantAvailableInput { TenancyName = typed });
            r.State.ShouldBe(TenantAvailabilityState.Available);
            r.TenantId.ShouldBe(output.TenantId);
        }
    }

    [Fact]
    public async Task Existing_lower_case_codes_keep_working_in_any_case()
    {
        var account = Account();
        var pilot = GetTenantId(PilotFarm); // "pilot-farm", seeded before the rule
        (await account.IsTenantAvailable(new IsTenantAvailableInput { TenancyName = "PILOT-FARM" })).TenantId.ShouldBe(pilot);
        (await account.IsTenantAvailable(new IsTenantAvailableInput { TenancyName = "pilot-farm" })).TenantId.ShouldBe(pilot);
    }

    [Fact]
    public async Task A_code_that_differs_only_in_case_is_taken()
    {
        var account = Account();
        var before = Q(c => c.Tenants.Count());
        await Should.ThrowAsync<UserFriendlyException>(() => account.RegisterFarm(NewFarm("Pilot-Farm")));
        Q(c => c.Tenants.Count()).ShouldBe(before);
    }

    [Theory]
    [InlineData("new_farm")]                // underscore
    [InlineData("1farm")]                   // starts with a digit
    [InlineData("F")]                       // too short
    [InlineData("ABCDEFGHIJKLMNOPQRSTU")]   // 21 characters
    [InlineData("farm code")]               // space inside
    public async Task Farm_code_outside_the_rule_is_rejected(string code)
    {
        var account = Account();
        await Should.ThrowAsync<Exception>(() => account.RegisterFarm(NewFarm(code)));
    }

    [Fact]
    public void Server_rule_matches_the_spec()
    {
        FarmProvisioningManager.FarmCodeRegex.IsMatch("GENSAN-SEMI").ShouldBeTrue();
        FarmProvisioningManager.FarmCodeRegex.IsMatch("ABCDEFGHIJKLMNOPQRST").ShouldBeTrue(); // 20
        FarmProvisioningManager.FarmCodeRegex.IsMatch("gensan-semi").ShouldBeFalse();         // checked after capitals
        FarmProvisioningManager.FarmCodeRegex.IsMatch("GEN_SAN").ShouldBeFalse();
    }

    [Fact]
    public async Task Owner_username_is_saved_in_lower_case()
    {
        var output = await Account().RegisterFarm(NewFarm("CASE-OWNER", ownerUserName: "Rita.Registrant"));
        var tenantId = output.TenantId;
        Q(c => c.Users.IgnoreQueryFilters().Single(u => u.TenantId == tenantId).UserName).ShouldBe("rita.registrant");
    }

    [Fact]
    public async Task Staff_username_is_saved_in_lower_case_and_case_does_not_make_a_new_one()
    {
        var users = Resolve<FarmUserAppService>();
        var created = await users.Create(new CreateFarmUserInput
        {
            Name = "Juan", Surname = "Dela Cruz", UserName = " JDelaCruz ", EmailAddress = "juan@example.test",
            RoleName = StaticRoleNames.Tenants.FarmTechnician, TemporaryPassword = "Temp1234x",
        });
        created.UserName.ShouldBe("jdelacruz");

        await Should.ThrowAsync<Exception>(() => users.Create(new CreateFarmUserInput
        {
            Name = "Juan", Surname = "Dela Cruz", UserName = "JDELACRUZ", EmailAddress = "juan2@example.test",
            RoleName = StaticRoleNames.Tenants.FarmTechnician, TemporaryPassword = "Temp1234x",
        }));
    }
}
