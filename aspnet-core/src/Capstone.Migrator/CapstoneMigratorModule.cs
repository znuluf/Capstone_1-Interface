using Abp.Events.Bus;
using Abp.Modules;
using Abp.Reflection.Extensions;
using Capstone.Configuration;
using Capstone.EntityFrameworkCore;
using Capstone.EntityFrameworkCore.Seed;
using Capstone.Migrator.DependencyInjection;
using Castle.MicroKernel.Registration;
using Microsoft.Extensions.Configuration;
using System;

namespace Capstone.Migrator;

[DependsOn(typeof(CapstoneEntityFrameworkModule))]
public class CapstoneMigratorModule : AbpModule
{
    private readonly IConfigurationRoot _appConfiguration;

    public CapstoneMigratorModule(CapstoneEntityFrameworkModule abpProjectNameEntityFrameworkModule)
    {
        abpProjectNameEntityFrameworkModule.SkipDbSeed = true;

        _appConfiguration = AppConfigurations.Get(
            typeof(CapstoneMigratorModule).GetAssembly().GetDirectoryPathOrNull(),
            addUserSecrets: true
        );
    }

    public override void PreInitialize()
    {
        Configuration.DefaultNameOrConnectionString = _appConfiguration.GetConnectionString(
            CapstoneConsts.ConnectionStringName
        );

        Configuration.BackgroundJobs.IsJobExecutionEnabled = false;

        // Development test farms with --dev-data, or Seed:DevelopmentData=true, or (when that setting is absent) a
        // Development environment (ASPNETCORE_ENVIRONMENT / DOTNET_ENVIRONMENT). An explicit Seed:DevelopmentData=false
        // wins over the environment. Never on the farm server.
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
        SeedOptions.SeedSimpleSampleData = bool.TryParse(_appConfiguration["Seed:SimpleSampleData"], out var simpleData) && simpleData;
        SeedOptions.SeedDevelopmentData = Program.DevData
            || (bool.TryParse(_appConfiguration["Seed:DevelopmentData"], out var devData)
                ? devData
                : string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase));
        SeedOptions.SystemAdminInitialPassword = _appConfiguration["SystemAdmin:InitialPassword"];
        Configuration.ReplaceService(
            typeof(IEventBus),
            () => IocManager.IocContainer.Register(
                Component.For<IEventBus>().Instance(NullEventBus.Instance)
            )
        );
    }

    public override void Initialize()
    {
        IocManager.RegisterAssemblyByConvention(typeof(CapstoneMigratorModule).GetAssembly());
        ServiceCollectionRegistrar.Register(IocManager);
    }
}
