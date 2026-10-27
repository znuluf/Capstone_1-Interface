using Capstone.Harvests;
using Capstone.Ponds;
using Abp.Authorization.Users;
using Capstone.Authorization.Users;
using Capstone.Compliance;
using Capstone.Domain;
using Capstone.Editions;
using Capstone.Farms;
using Capstone.MultiTenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System;
using System.Linq;

namespace Capstone.EntityFrameworkCore.Seed.Farms;

/// <summary>Context-level farm creation for seeds (registration uses FarmProvisioningManager).</summary>
public class FarmSeedBuilder
{
    private readonly CapstoneDbContext _context;

    public FarmSeedBuilder(CapstoneDbContext context)
    {
        _context = context;
    }

    public Tenant EnsureFarm(string code, string farmName, string addressLine1, string cityMunicipality, string province)
    {
        var tenant = _context.Tenants.IgnoreQueryFilters().FirstOrDefault(t => t.TenancyName == code);
        if (tenant == null)
        {
            tenant = new Tenant(code, farmName) { IsActive = true };
            var edition = _context.Editions.IgnoreQueryFilters().FirstOrDefault(e => e.Name == EditionManager.DefaultEditionName);
            tenant.EditionId = edition?.Id;
            _context.Tenants.Add(tenant);
            _context.SaveChanges();
        }

        new FarmRoleSynchronizer(_context).SyncFarm(tenant.Id);

        if (!_context.FarmProfiles.IgnoreQueryFilters().Any(p => p.Id == tenant.Id))
        {
            _context.FarmProfiles.Add(new FarmProfile
            {
                Id = tenant.Id,
                TenantId = tenant.Id,
                FarmName = farmName,
                AddressLine1 = addressLine1,
                CityMunicipality = cityMunicipality,
                Province = province,
                Country = FarmProfile.DefaultCountry,
                TimeZone = FarmClock.DefaultTimeZone,
                DocumentExpiryAlertDays = 30,
                ContactName = "Test Owner",
                ContactPhone = "0917 000 0000",
            });
        }

        foreach (var c in FarmDefaults.DocumentCategories)
        {
            var category = _context.DocumentCategories.IgnoreQueryFilters().FirstOrDefault(x => x.TenantId == tenant.Id && x.Name == c.Name);
            if (category == null)
            {
                category = new DocumentCategory { Id = Guid.NewGuid(), TenantId = tenant.Id, Name = c.Name, RequiresExpiryDate = c.RequiresExpiryDate };
                _context.DocumentCategories.Add(category);
            }

            var order = 0;
            foreach (var p in c.Presets)
            {
                order++;
                if (!_context.DocumentPresets.IgnoreQueryFilters().Any(x => x.TenantId == tenant.Id && x.Name == p.Name))
                {
                    _context.DocumentPresets.Add(new DocumentPreset
                    {
                        TenantId = tenant.Id, CategoryId = category.Id, Name = p.Name, DefaultIssuingAgency = p.DefaultIssuingAgency,
                        IsRequired = p.IsRequired, SortOrder = order,
                    });
                }
            }
        }

        var prefixOrder = 0;
        foreach (var x in FarmDefaults.PondNamePrefixes)
        {
            prefixOrder++;
            if (!_context.PondNamePrefixes.IgnoreQueryFilters().Any(p => p.TenantId == tenant.Id && p.Name == x.Name))
            {
                _context.PondNamePrefixes.Add(new PondNamePrefix { TenantId = tenant.Id, Name = x.Name, ShortCode = x.ShortCode, SortOrder = prefixOrder });
            }
        }

        var gradeOrder = 0;
        foreach (var g in FarmDefaults.SizeGrades)
        {
            gradeOrder++;
            if (!_context.SizeGrades.IgnoreQueryFilters().Any(x => x.TenantId == tenant.Id && x.Label == g.Label))
            {
                _context.SizeGrades.Add(new SizeGrade { TenantId = tenant.Id, Label = g.Label, MinCountPerKg = g.MinCountPerKg, MaxCountPerKg = g.MaxCountPerKg, SortOrder = gradeOrder });
            }
        }

        if (!_context.SizeGrades.IgnoreQueryFilters().Any(x => x.TenantId == tenant.Id && x.Label == SizeGrade.UngradedLabel))
        {
            _context.SizeGrades.Add(new SizeGrade { TenantId = tenant.Id, Label = SizeGrade.UngradedLabel, SortOrder = gradeOrder + 1 });
        }

        _context.SaveChanges();
        return tenant;
    }

    public User EnsureUser(int tenantId, string userName, string name, string surname, string roleName, string password)
    {
        var user = _context.Users.IgnoreQueryFilters().FirstOrDefault(u => u.TenantId == tenantId && u.UserName == userName);
        if (user == null)
        {
            user = new User
            {
                TenantId = tenantId,
                UserName = userName,
                Name = name,
                Surname = surname,
                EmailAddress = $"{userName}@{tenantId}.fpms.local",
                IsEmailConfirmed = true,
                IsActive = true,
                IsLockoutEnabled = true,
            };
            user.Password = new PasswordHasher<User>(new OptionsWrapper<PasswordHasherOptions>(new PasswordHasherOptions())).HashPassword(user, password);
            user.SetNormalizedNames();
            _context.Users.Add(user);
            _context.SaveChanges();

            var role = new FarmRoleSynchronizer(_context).EnsureRole(tenantId, roleName);
            _context.UserRoles.Add(new UserRole(tenantId, user.Id, role.Id));
            _context.SaveChanges();
        }

        return user;
    }
}
