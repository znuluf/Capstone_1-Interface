using Abp.Configuration;
using Abp.Localization;
using Abp.MultiTenancy;
using Abp.Net.Mail;
using Abp.Zero.Configuration;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace Capstone.EntityFrameworkCore.Seed.Host;

public class DefaultSettingsCreator
{
    private readonly CapstoneDbContext _context;

    public DefaultSettingsCreator(CapstoneDbContext context)
    {
        _context = context;
    }

    public void Create()
    {
        int? tenantId = null;

        if (CapstoneConsts.MultiTenancyEnabled == false)
        {
            tenantId = MultiTenancyConsts.DefaultTenantId;
        }

        // Emailing (not used in Phase 1; kept for the framework)
        AddSettingIfNotExists(EmailSettingNames.DefaultFromAddress, "noreply@fpms.local", tenantId);
        AddSettingIfNotExists(EmailSettingNames.DefaultFromDisplayName, "FPMS", tenantId);

        // Languages
        AddSettingIfNotExists(LocalizationSettingNames.DefaultLanguage, "en", tenantId);

        // Password policy for new and changed passwords (Ref 1.2)
        AddSettingIfNotExists(AbpZeroSettingNames.UserManagement.PasswordComplexity.RequiredLength, "8", tenantId);
        AddSettingIfNotExists(AbpZeroSettingNames.UserManagement.PasswordComplexity.RequireDigit, "true", tenantId);
        AddSettingIfNotExists(AbpZeroSettingNames.UserManagement.PasswordComplexity.RequireLowercase, "true", tenantId);
        AddSettingIfNotExists(AbpZeroSettingNames.UserManagement.PasswordComplexity.RequireUppercase, "true", tenantId);
        AddSettingIfNotExists(AbpZeroSettingNames.UserManagement.PasswordComplexity.RequireNonAlphanumeric, "false", tenantId);

        // Lockout after repeated failed sign-ins
        AddSettingIfNotExists(AbpZeroSettingNames.UserManagement.UserLockOut.IsEnabled, "true", tenantId);
        AddSettingIfNotExists(AbpZeroSettingNames.UserManagement.UserLockOut.MaxFailedAccessAttemptsBeforeLockout, "5", tenantId);
        AddSettingIfNotExists(AbpZeroSettingNames.UserManagement.UserLockOut.DefaultAccountLockoutSeconds, "900", tenantId);
    }

    private void AddSettingIfNotExists(string name, string value, int? tenantId = null)
    {
        if (_context.Settings.IgnoreQueryFilters().Any(s => s.Name == name && s.TenantId == tenantId && s.UserId == null))
        {
            return;
        }

        _context.Settings.Add(new Setting(tenantId, null, name, value));
        _context.SaveChanges();
    }
}
