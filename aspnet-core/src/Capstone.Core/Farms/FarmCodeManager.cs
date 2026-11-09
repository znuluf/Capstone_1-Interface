using Abp.Domain.Repositories;
using Abp.Domain.Services;
using Abp.Domain.Uow;
using Abp.UI;
using Capstone.Domain;
using Capstone.MultiTenancy;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Farms;

/// <summary>
/// Changes a farm's code (DEC-78). The code is the sign-in key, so a change is checked against every farm's current
/// code and every retired code, can happen only once in <see cref="CooldownDays"/> days, and leaves a history row
/// so the old code keeps pointing to the farm's current code.
/// </summary>
public class FarmCodeManager : DomainService
{
    public const int CooldownDays = 30;

    private readonly IRepository<Tenant, int> _tenants;
    private readonly IRepository<FarmCodeChange, Guid> _changes;

    public FarmCodeManager(IRepository<Tenant, int> tenants, IRepository<FarmCodeChange, Guid> changes)
    {
        _tenants = tenants;
        _changes = changes;
    }

    /// <summary>Null when the code can be used by this farm, otherwise the reason it cannot.</summary>
    [UnitOfWork]
    public virtual async Task<string> CheckAvailabilityAsync(int tenantId, string code)
    {
        code = (code ?? string.Empty).Trim();
        if (!FarmProvisioningManager.FarmCodeRegex.IsMatch(code))
        {
            return "The farm code must start with a letter and use 2–64 letters, digits, '-' or '_'.";
        }

        var upper = code.ToUpperInvariant();
        using (CurrentUnitOfWork.SetTenantId(null))
        using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.SoftDelete))
        {
            var owner = await _tenants.GetAll().Where(t => t.TenancyName.ToUpper() == upper).Select(t => (int?)t.Id).FirstOrDefaultAsync();
            if (owner.HasValue)
            {
                return owner.Value == tenantId ? "That is already this farm's code." : $"The farm code '{code}' is already taken.";
            }

            if (await _changes.GetAll().AnyAsync(x => x.OldCode.ToUpper() == upper))
            {
                return $"The farm code '{code}' was used before and stays reserved. Choose a different code.";
            }
        }

        return null;
    }

    /// <summary>The earliest time the farm may change its code again, or null when it may do so now.</summary>
    [UnitOfWork]
    public virtual async Task<DateTime?> GetNextChangeAllowedAsync(int tenantId)
    {
        DateTime? last;
        using (CurrentUnitOfWork.SetTenantId(null))
        {
            last = await _changes.GetAll().Where(x => x.TenantId == tenantId).OrderByDescending(x => x.ChangedAt)
                .Select(x => (DateTime?)x.ChangedAt).FirstOrDefaultAsync();
        }

        var next = last?.AddDays(CooldownDays);
        return next.HasValue && next.Value > Abp.Timing.Clock.Now ? next : null;
    }

    [UnitOfWork]
    public virtual async Task<FarmCodeChange> ChangeAsync(int tenantId, string newCode, long? userId, string userName)
    {
        var next = await GetNextChangeAllowedAsync(tenantId);
        if (next.HasValue)
        {
            throw new UserFriendlyException(
                $"The farm code was changed recently. It can be changed again from {next.Value:d MMM yyyy}. Ask the System Administrator if it is urgent.");
        }

        var reason = await CheckAvailabilityAsync(tenantId, newCode);
        if (reason != null)
        {
            throw new UserFriendlyException(reason);
        }

        var code = newCode.Trim();
        Tenant tenant;
        using (CurrentUnitOfWork.SetTenantId(null))
        {
            tenant = await _tenants.GetAsync(tenantId);
            var change = new FarmCodeChange
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                OldCode = tenant.TenancyName,
                NewCode = code,
                ChangedByUserId = userId,
                ChangedByName = userName,
                ChangedAt = Abp.Timing.Clock.Now,
            };
            tenant.TenancyName = code;
            await _changes.InsertAsync(change);
            try
            {
                await _tenants.UpdateAsync(tenant);
                await CurrentUnitOfWork.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (DuplicateKey.Is(ex))
            {
                // Another farm saved the same code a moment earlier; the unique index caught it.
                throw new UserFriendlyException($"The farm code '{code}' was just taken. Choose a different code.");
            }

            return change;
        }
    }

    /// <summary>
    /// The current code of the farm that once used <paramref name="oldCode"/>, or null when no farm did. Lets the
    /// sign-in page say which code to use instead of "no farm uses this code".
    /// </summary>
    [UnitOfWork]
    public virtual async Task<string> FindCurrentCodeAsync(string oldCode)
    {
        var upper = (oldCode ?? string.Empty).Trim().ToUpperInvariant();
        if (upper.Length == 0)
        {
            return null;
        }

        using (CurrentUnitOfWork.SetTenantId(null))
        {
            var tenantId = await _changes.GetAll().Where(x => x.OldCode.ToUpper() == upper).OrderByDescending(x => x.ChangedAt)
                .Select(x => (int?)x.TenantId).FirstOrDefaultAsync();
            return tenantId.HasValue ? await _tenants.GetAll().Where(t => t.Id == tenantId.Value).Select(t => t.TenancyName).FirstOrDefaultAsync() : null;
        }
    }
}
