using Abp.Authorization.Users;
using Abp.Extensions;
using System;
using System.Collections.Generic;

namespace Capstone.Authorization.Users;

public class User : AbpUser<User>
{
    /// <summary>
    /// Set for new and reset accounts (temporary password): the user must choose a new password at the next
    /// sign-in before using the system (Ref 1.2, AC-02, AC-22).
    /// </summary>
    public bool ShouldChangePasswordOnNextLogin { get; set; }

    public static string CreateRandomPassword()
    {
        return Guid.NewGuid().ToString("N").Truncate(16);
    }

    public static User CreateTenantAdminUser(int tenantId, string emailAddress)
    {
        var user = new User
        {
            TenantId = tenantId,
            UserName = AdminUserName,
            Name = AdminUserName,
            Surname = AdminUserName,
            EmailAddress = emailAddress,
            Roles = new List<UserRole>()
        };

        user.SetNormalizedNames();

        return user;
    }
}
