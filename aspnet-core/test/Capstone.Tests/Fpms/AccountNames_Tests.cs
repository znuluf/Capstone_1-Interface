using Capstone.Authorization.Accounts;
using Capstone.Authorization.Accounts.Dto;
using Capstone.Authorization.Roles;
using Capstone.Farms;
using Capstone.Farms.Dto;
using Shouldly;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Suggested farm codes and usernames (DEC-75, AC-43). Suggestions only: the person can change them.</summary>
public class AccountNames_Tests : FpmsTestBase
{
    [Theory]
    [InlineData("GenSan Semi-Intensive Shrimp Farm", "GENSAN-SEMI")]
    [InlineData("Maasim Shrimp Farm", "MAASIM")]
    [InlineData("The Dela Cruz Aquafarm Inc.", "DELA-CRUZ")]
    [InlineData("Shrimp Farm", "SHRIMP-FARM")]
    [InlineData("Peñaflor Prawn Ponds", "PENAFLOR")]
    [InlineData("3 Brothers Farm", "F-3-BROTHERS")]
    [InlineData("Kiamba Mariculture Development Center", "KIAMBA")]
    [InlineData("Glan", "GLAN")]
    [InlineData("J Farm", "J-FARM")]
    [InlineData("!!!", "FARM")]
    public void Farm_code_base_comes_from_the_farm_name(string farmName, string expected)
    {
        var code = AccountNameGenerator.FarmCodeBase(farmName);
        code.ShouldBe(expected);
        FarmProvisioningManager.FarmCodeRegex.IsMatch(code).ShouldBeTrue();
        code.Length.ShouldBeLessThanOrEqualTo(16);
    }

    [Theory]
    [InlineData("Juan", "Dela Cruz", "jdelacruz")]
    [InlineData("Ma. Teresa", "Santos", "msantos")]
    [InlineData("José", "Peña", "jpena")]
    [InlineData("Liam", "O'Brien", "lobrien")]
    [InlineData("", "Reyes", "reyes")]
    [InlineData("Ana", "", "a")]
    [InlineData("", "", "user")]
    public void Username_base_is_first_initial_and_surname(string name, string surname, string expected)
    {
        AccountNameGenerator.UserNameBase(name, surname).ShouldBe(expected);
    }

    [Fact]
    public async Task Taken_farm_code_gets_the_next_number_and_case_is_ignored()
    {
        AbpSession.TenantId = null;
        AbpSession.UserId = null;
        var account = Resolve<AccountAppService>();
        var input = new GetRegistrationSuggestionsInput { FarmName = "Maasim Shrimp Farm", OwnerName = "Rita", OwnerSurname = "Registrant" };

        var first = await account.GetRegistrationSuggestions(input);
        first.FarmCode.ShouldBe("MAASIM");
        first.OwnerUserName.ShouldBe("rregistrant");

        // Registered by hand in lower case: still counts as taken.
        await account.RegisterFarm(NewFarm("maasim"));
        (await account.GetRegistrationSuggestions(input)).FarmCode.ShouldBe("MAASIM-2");

        await account.RegisterFarm(NewFarm("MAASIM-2"));
        (await account.GetRegistrationSuggestions(input)).FarmCode.ShouldBe("MAASIM-3");
    }

    [Fact]
    public async Task Suggestion_is_blank_until_the_name_is_typed()
    {
        AbpSession.TenantId = null;
        AbpSession.UserId = null;
        var r = await Resolve<AccountAppService>().GetRegistrationSuggestions(new GetRegistrationSuggestionsInput());
        r.FarmCode.ShouldBeNull();
        r.OwnerUserName.ShouldBeNull();
    }

    [Fact]
    public async Task Taken_username_in_the_same_farm_gets_the_next_number()
    {
        var users = Resolve<FarmUserAppService>();
        var name = new GetSuggestedUserNameInput { Name = "Juan", Surname = "Dela Cruz" };

        var first = (await users.GetSuggestedUserName(name)).UserName;
        first.ShouldBe("jdelacruz");
        await users.Create(NewUser(first, "juan1@example.test"));

        var second = (await users.GetSuggestedUserName(name)).UserName;
        second.ShouldBe("jdelacruz2");
        await users.Create(NewUser(second, "juan2@example.test"));

        (await users.GetSuggestedUserName(name)).UserName.ShouldBe("jdelacruz3");

        // Usernames are unique within a farm only: the second farm can still use the plain one.
        LoginAsSecondFarmOwner();
        (await Resolve<FarmUserAppService>().GetSuggestedUserName(name)).UserName.ShouldBe("jdelacruz");
    }

    [Fact]
    public async Task A_changed_suggestion_is_saved_as_typed()
    {
        var users = Resolve<FarmUserAppService>();
        (await users.GetSuggestedUserName(new GetSuggestedUserNameInput { Name = "Pedro", Surname = "Reyes" })).UserName.ShouldBe("preyes");
        var created = await users.Create(NewUser("pedro.r", "pedro@example.test", "Pedro", "Reyes"));
        created.UserName.ShouldBe("pedro.r");
    }

    private static RegisterFarmInput NewFarm(string code) => new()
    {
        FarmCode = code, FarmName = "Maasim Shrimp Farm", AddressLine1 = "Purok 3, Brgy. Tinoto", CityMunicipality = "Maasim", Province = "Sarangani",
        PostalCode = "9502",
        OwnerName = "Rita", OwnerSurname = "Registrant", OwnerUserName = "rregistrant", OwnerEmailAddress = "rita@example.test", OwnerPassword = "Register1x",
    };

    private static CreateFarmUserInput NewUser(string userName, string email, string name = "Juan", string surname = "Dela Cruz") => new()
    {
        Name = name, Surname = surname, UserName = userName, EmailAddress = email,
        RoleName = StaticRoleNames.Tenants.FarmTechnician, TemporaryPassword = "Temp1234x",
    };
}
