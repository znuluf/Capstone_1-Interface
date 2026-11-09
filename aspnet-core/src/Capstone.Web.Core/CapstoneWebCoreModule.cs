using Abp.AspNetCore;
using Abp.AspNetCore.Configuration;
using Abp.AspNetCore.SignalR;
using Abp.Modules;
using Abp.Reflection.Extensions;
using Abp.Zero.Configuration;
using Capstone.Authentication.JwtBearer;
using Capstone.Configuration;
using Capstone.EntityFrameworkCore;
using Capstone.EntityFrameworkCore.Seed;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using System;
using System.IO;

namespace Capstone
{
    [DependsOn(
         typeof(CapstoneApplicationModule),
         typeof(CapstoneEntityFrameworkModule),
         typeof(AbpAspNetCoreModule)
        , typeof(AbpAspNetCoreSignalRModule)
     )]
    public class CapstoneWebCoreModule : AbpModule
    {
        private readonly IWebHostEnvironment _env;
        private readonly IConfigurationRoot _appConfiguration;

        public CapstoneWebCoreModule(IWebHostEnvironment env)
        {
            _env = env;
            _appConfiguration = env.GetAppConfiguration();
        }

        public override void PreInitialize()
        {
            Configuration.DefaultNameOrConnectionString = _appConfiguration.GetConnectionString(
                CapstoneConsts.ConnectionStringName
            );

            // Use database for language management
            Configuration.Modules.Zero().LanguageManagement.EnableDbLocalization();

            Configuration.Modules.AbpAspNetCore()
                 .CreateControllersForAppServices(
                     typeof(CapstoneApplicationModule).GetAssembly()
                 );

            ConfigureSeed();
            ConfigureTokenAuth();
        }

        private void ConfigureSeed()
        {
            // The Simple sample farm (FPMS_Simple) is the development data: seeded in the Development environment, or when
            // Seed:SimpleSampleData=true. An explicit Seed:SimpleSampleData=false wins over the environment. Never on the farm server.
            SeedOptions.SeedSimpleSampleData = _appConfiguration.GetValue<bool?>("Seed:SimpleSampleData") ?? _env.IsDevelopment();
            SeedOptions.SystemAdminInitialPassword = _appConfiguration["SystemAdmin:InitialPassword"];
        }

        private void ConfigureTokenAuth()
        {
            IocManager.Register<TokenAuthConfiguration>();
            var tokenAuthConfig = IocManager.Resolve<TokenAuthConfiguration>();

            tokenAuthConfig.SecurityKey = JwtSecurityKey.Create(_appConfiguration);
            tokenAuthConfig.Issuer = _appConfiguration["Authentication:JwtBearer:Issuer"];
            tokenAuthConfig.Audience = _appConfiguration["Authentication:JwtBearer:Audience"];
            tokenAuthConfig.SigningCredentials = new SigningCredentials(tokenAuthConfig.SecurityKey, SecurityAlgorithms.HmacSha256);
            // Token lifetime (D-02): one working shift by default; configurable.
            var minutes = _appConfiguration.GetValue<int?>("Authentication:JwtBearer:ExpirationMinutes") ?? 240; // 4 hours (DEC-37)
            tokenAuthConfig.Expiration = TimeSpan.FromMinutes(minutes);
        }

        public override void Initialize()
        {
            IocManager.RegisterAssemblyByConvention(typeof(CapstoneWebCoreModule).GetAssembly());
        }

        public override void PostInitialize()
        {

            IocManager.Resolve<ApplicationPartManager>()
                .AddApplicationPartsIfNotAddedBefore(typeof(CapstoneWebCoreModule).Assembly);
        }
    }
}
