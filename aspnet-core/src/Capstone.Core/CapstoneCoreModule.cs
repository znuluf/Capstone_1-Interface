using Abp;
using Abp.Auditing;
using Abp.Localization;
using Abp.Modules;
using Abp.Reflection.Extensions;
using Abp.Runtime.Security;
using Abp.Timing;
using Abp.Zero;
using Abp.Zero.Configuration;
using Capstone.Authorization;
using Capstone.Authorization.Roles;
using Capstone.Authorization.Users;
using Capstone.Configuration;
using Capstone.Domain;
using Capstone.Farms;
using Capstone.Localization;
using Capstone.MultiTenancy;
using Capstone.Compliance;
using Capstone.Harvests;
using Capstone.Inventory;
using Capstone.Ponds;
using Capstone.Production;
using Capstone.Resources;
using Capstone.Sales;
using Capstone.Timing;
using System;
using System.Linq;

namespace Capstone;

[DependsOn(typeof(AbpZeroCoreModule))]
public class CapstoneCoreModule : AbpModule
{
    /// <summary>Entities whose changes are kept in ABP entity history (spec Section 6, DEC-43).</summary>
    private static readonly Type[] TrackedEntityTypes =
    {
        typeof(FarmProfile), typeof(HatcherySource), typeof(HatcheryCertificate), typeof(InventoryItem), typeof(InventoryLot), typeof(Pond),
        typeof(FryDelivery), typeof(ProductionCycle), typeof(PondBatch), typeof(BatchFailure), typeof(Harvest), typeof(Sale), typeof(ComplianceDocument),
    };

    public override void PreInitialize()
    {
        // Store all timestamps in UTC; the client displays farm time (D-10).
        Clock.Provider = ClockProviders.Utc;

        Configuration.Auditing.IsEnabledForAnonymousUsers = true;
        Configuration.Auditing.SaveReturnValues = false;

        // Entity change history for farm records (farm activity log, Ref 9.1).
        Configuration.EntityHistory.IsEnabled = true;
        // DEC-43: data-change history only for low-volume records that have History panels; high-volume
        // records (logs, measurements, feeding) rely on their own audit and void fields.
        Configuration.EntityHistory.Selectors.Add(new NamedTypeSelector(
            "Fpms.TrackedEntities",
            type => TrackedEntityTypes.Contains(type)));

        // Declare entity types
        Configuration.Modules.Zero().EntityTypes.Tenant = typeof(Tenant);
        Configuration.Modules.Zero().EntityTypes.Role = typeof(Role);
        Configuration.Modules.Zero().EntityTypes.User = typeof(User);

        CapstoneLocalizationConfigurer.Configure(Configuration.Localization);

        Configuration.MultiTenancy.IsEnabled = CapstoneConsts.MultiTenancyEnabled;

        // Configure roles and permissions (permissions are needed by the Migrator seed too).
        AppRoleConfig.Configure(Configuration.Modules.Zero().RoleManagement);
        Configuration.Authorization.Providers.Add<CapstoneAuthorizationProvider>();

        Configuration.Settings.Providers.Add<AppSettingProvider>();

        Configuration.Settings.SettingEncryptionConfiguration.DefaultPassPhrase = CapstoneConsts.DefaultPassPhrase;
        SimpleStringCipher.DefaultPassPhrase = CapstoneConsts.DefaultPassPhrase;
    }

    public override void Initialize()
    {
        IocManager.RegisterAssemblyByConvention(typeof(CapstoneCoreModule).GetAssembly());
    }

    public override void PostInitialize()
    {
        IocManager.Resolve<AppTimes>().StartupTime = Clock.Now;
    }
}
