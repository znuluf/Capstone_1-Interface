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

        // The Simple sample farm (FPMS_Simple) is the development data: seeded with --sample, or Seed:SimpleSampleData=true,
        // or (when that setting is absent) a Development environment (ASPNETCORE_ENVIRONMENT / DOTNET_ENVIRONMENT).
        // An explicit Seed:SimpleSampleData=false wins over the environment. Never on the farm server.
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
        SeedOptions.SeedSimpleSampleData = Program.SampleData
            || (bool.TryParse(_appConfiguration["Seed:SimpleSampleData"], out var simpleData)
                ? simpleData
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
