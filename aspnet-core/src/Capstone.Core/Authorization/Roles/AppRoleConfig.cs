using Abp.MultiTenancy;
using Abp.Zero.Configuration;

namespace Capstone.Authorization.Roles;

public static class AppRoleConfig
{
    public static void Configure(IRoleManagementConfig roleManagementConfig)
    {
        // Static host role
        roleManagementConfig.StaticRoles.Add(
            new StaticRoleDefinition(StaticRoleNames.Host.SystemAdministrator, MultiTenancySides.Host, grantAllPermissionsByDefault: false));

        // Static farm roles, created in every farm (decision D-07)
        roleManagementConfig.StaticRoles.Add(
            new StaticRoleDefinition(StaticRoleNames.Tenants.FarmOwner, MultiTenancySides.Tenant, grantAllPermissionsByDefault: false));
        roleManagementConfig.StaticRoles.Add(
            new StaticRoleDefinition(StaticRoleNames.Tenants.FarmTechnician, MultiTenancySides.Tenant, grantAllPermissionsByDefault: false));
    }
}
