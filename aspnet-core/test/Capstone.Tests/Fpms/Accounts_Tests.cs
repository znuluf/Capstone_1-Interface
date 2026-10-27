using Abp.Authorization;
using Abp.Configuration;
using Abp.UI;
using Capstone.Authorization.Accounts;
using Capstone.Authorization.Accounts.Dto;
using Capstone.Authorization.Roles;
using Capstone.Configuration;
using Capstone.Farms;
using Capstone.Farms.Dto;
using Capstone.Ponds;
using Capstone.Profile;
using Capstone.SystemAdmin;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Registration, farm accounts and System Administrator recovery (AC-01, AC-02, AC-22).</summary>
public class Accounts_Tests : FpmsTestBase
{
    private static RegisterFarmInput NewFarm(string code) => new()
    {
        FarmCode = code, FarmName = "Registered Test Farm", AddressLine1 = "Purok 3, Brgy. Tinoto", CityMunicipality = "Maasim", Province = "Sarangani",
        PostalCode = "9502", TotalAreaHectares = 12.5m,
        OwnerName = "Rita", OwnerSurname = "Registrant", OwnerUserName = "rita", OwnerEmailAddress = "rita@example.test", OwnerPassword = "Register1x",
    };

    [Fact]
    public async Task Registration_creates_farm_profile_roles_categories_and_owner()
    {
        AbpSession.TenantId = null;
        AbpSession.UserId = null;
        var output = await Resolve<AccountAppService>().RegisterFarm(NewFarm("new-farm"));

        var tenantId = output.TenantId;
        var profile = Q(c => c.FarmProfiles.IgnoreQueryFilters().Single(p => p.Id == tenantId));
        profile.FarmName.ShouldBe("Registered Test Farm");
        profile.FormatAddress().ShouldBe("Purok 3, Brgy. Tinoto, Maasim, Sarangani 9502, Philippines");
        profile.TotalAreaHectares.ShouldBe(12.5m);
        Q(c => c.DocumentCategories.IgnoreQueryFilters().Count(x => x.TenantId == tenantId)).ShouldBe(8);
        Q(c => c.PondNamePrefixes.IgnoreQueryFilters().Count(x => x.TenantId == tenantId)).ShouldBe(3);
        Q(c => c.SizeGrades.IgnoreQueryFilters().Count(x => x.TenantId == tenantId)).ShouldBe(9); // 8 count grades + "Ungraded / mixed" (DEC-67)
        Q(c => c.DocumentPresets.IgnoreQueryFilters().Count(x => x.TenantId == tenantId)).ShouldBe(14);
        Q(c => c.DocumentPresets.IgnoreQueryFilters().Count(x => x.TenantId == tenantId && x.IsRequired)).ShouldBe(3);
        Q(c => c.Roles.IgnoreQueryFilters().Count(r => r.TenantId == tenantId)).ShouldBe(2);
        var owner = Q(c => c.Users.IgnoreQueryFilters().Single(u => u.TenantId == tenantId && u.UserName == "rita"));
        owner.Password.ShouldNotBe("Register1x");

        LoginAsTenant("new-farm", "rita");
        (await Resolve<PondAppService>().GetAll()).ShouldBeEmpty();
        (await Resolve<FarmUserAppService>().GetAll()).Single().RoleName.ShouldBe(StaticRoleNames.Tenants.FarmOwner);
    }

    [Fact]
    public async Task Duplicate_farm_code_is_rejected_and_nothing_is_created()
    {
        AbpSession.TenantId = null;
        AbpSession.UserId = null;
        var before = Q(c => c.Tenants.Count());
        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<AccountAppService>().RegisterFarm(NewFarm(PilotFarm)));
        Q(c => c.Tenants.Count()).ShouldBe(before);
    }

    [Fact]
    public async Task Registration_can_be_disabled_by_the_system_administrator()
    {
        LoginAsHostAdmin();
        await Resolve<SystemFarmAppService>().SetRegistrationSetting(new RegistrationSettingDto { IsEnabled = false });
        AbpSession.UserId = null;
        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<AccountAppService>().RegisterFarm(NewFarm("blocked-farm")));
    }

    [Fact]
    public async Task Owner_creates_technician_who_must_change_the_temporary_password()
    {
        var users = Resolve<FarmUserAppService>();
        var created = await users.Create(new CreateFarmUserInput
        {
            Name = "Nina", Surname = "New", UserName = "nina", EmailAddress = "nina@example.test", RoleName = StaticRoleNames.Tenants.FarmTechnician, TemporaryPassword = "Temp1234x",
        });
        created.MustChangePassword.ShouldBeTrue();
        created.RoleName.ShouldBe(StaticRoleNames.Tenants.FarmTechnician);

        LoginAsTenant(PilotFarm, "nina");
        await Resolve<ProfileAppService>().ChangeMyPassword(new ChangeMyPasswordInput { CurrentPassword = "Temp1234x", NewPassword = "MyOwnPass9" });
        Q(c => c.Users.IgnoreQueryFilters().Single(u => u.UserName == "nina").ShouldChangePasswordOnNextLogin).ShouldBeFalse();
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<FarmUserAppService>().GetAll());
    }

    [Fact]
    public async Task Weak_temporary_password_is_rejected()
    {
        await ThrowsAny(() => Resolve<FarmUserAppService>().Create(new CreateFarmUserInput
        {
            Name = "W", Surname = "K", UserName = "weak", EmailAddress = "weak@example.test", RoleName = StaticRoleNames.Tenants.FarmTechnician, TemporaryPassword = "abc",
        }));
    }

    [Fact]
    public async Task Last_active_owner_cannot_be_deactivated()
    {
        LoginAsSecondFarmOwner();
        var users = Resolve<FarmUserAppService>();
        var me = (await users.GetAll()).Single(u => u.IsCurrentUser);
        await Should.ThrowAsync<UserFriendlyException>(() => users.SetActive(new SetUserActiveInput { Id = me.Id, IsActive = false }));
    }

    [Fact]
    public async Task System_administrator_issues_a_temporary_password_after_identity_check()
    {
        var tenantId = GetTenantId(PilotFarm);
        LoginAsHostAdmin();
        var recovery = Resolve<AccountRecoveryAppService>();
        var owner = (await recovery.GetFarmUsers(tenantId)).Single(u => u.UserName == "owner");

        await Should.ThrowAsync<UserFriendlyException>(() => recovery.IssueTemporaryPassword(new RecoveryActionInput { TenantId = tenantId, UserId = owner.UserId }));

        var temp = await recovery.IssueTemporaryPassword(new RecoveryActionInput
        {
            TenantId = tenantId, UserId = owner.UserId, IdentityVerified = true, VerificationMethod = IdentityVerificationMethod.SecondFarmOwner,
        });
        temp.TemporaryPassword.Length.ShouldBe(12);
        Q(c => c.Users.IgnoreQueryFilters().Single(u => u.Id == owner.UserId).ShouldChangePasswordOnNextLogin).ShouldBeTrue();
    }

    [Fact]
    public async Task Farm_users_cannot_call_system_administration()
    {
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<SystemFarmAppService>().GetFarms());
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<AccountRecoveryAppService>().GetFarmUsers(1));
    }
}
