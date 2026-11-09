using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.UI;
using Capstone.Authorization;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Harvests;

public class ContainerTypeDto
{
    public Guid Id { get; set; }

    [Required, StringLength(ContainerType.MaxNameLength)]
    public string Name { get; set; }

    [Range(0.001, 10000, ErrorMessage = "The usual kg must be greater than zero.")]
    public decimal? NominalKg { get; set; }

    [Range(0.001, 1000, ErrorMessage = "The empty weight must be greater than zero; leave it empty when the shrimp are weighed without the crate.")]
    public decimal? TareKg { get; set; }

    public int SortOrder { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// The farm's crate types for the crate tally (DEC-80); "Crate" is the standard word, a type only names it. Everyone with harvest access reads them; Owners edit them.
/// Deactivate instead of deleting: tallies already saved keep the container's name and empty weight.
/// </summary>
[AbpAuthorize(PermissionNames.Harvests)]
public class ContainerTypeAppService : CapstoneAppServiceBase
{
    private readonly IRepository<ContainerType, Guid> _types;

    public ContainerTypeAppService(IRepository<ContainerType, Guid> types)
    {
        _types = types;
    }

    /// <summary>Active first, then by order and name. The harvest form shows only the active ones.</summary>
    public virtual async Task<List<ContainerTypeDto>> GetAll()
    {
        var list = await _types.GetAll().AsNoTracking()
            .OrderByDescending(t => t.IsActive).ThenBy(t => t.SortOrder).ThenBy(t => t.Name).ToListAsync();
        return list.Select(t => new ContainerTypeDto
        {
            Id = t.Id, Name = t.Name, NominalKg = t.NominalKg, TareKg = t.TareKg, SortOrder = t.SortOrder, IsDefault = t.IsDefault, IsActive = t.IsActive,
        }).ToList();
    }

    /// <summary>Creates (empty Id) or updates a container type. Making one the default clears the others.</summary>
    [AbpAuthorize(PermissionNames.Harvests_EditAny)]
    public virtual async Task<Guid> Save(ContainerTypeDto input)
    {
        var name = input.Name.Trim();
        if (await _types.GetAll().AnyAsync(t => t.Name == name && t.Id != input.Id))
        {
            throw new UserFriendlyException($"The crate type '{name}' already exists.");
        }

        if (input.IsDefault && !input.IsActive)
        {
            throw new UserFriendlyException("An inactive crate type cannot be the default.");
        }

        if (input.NominalKg.HasValue && input.TareKg.HasValue && input.TareKg.Value >= input.NominalKg.Value)
        {
            throw new UserFriendlyException("The empty weight must be less than the usual kg of shrimp.");
        }

        var isNew = input.Id == Guid.Empty;
        var type = isNew ? new ContainerType() : await _types.GetAsync(input.Id);
        type.Name = name;
        type.NominalKg = input.NominalKg;
        type.TareKg = input.TareKg;
        type.SortOrder = input.SortOrder > 0 || !isNew ? input.SortOrder : (await _types.GetAll().MaxAsync(t => (int?)t.SortOrder) ?? 0) + 1;
        type.IsActive = input.IsActive;
        type.IsDefault = input.IsDefault;

        if (input.IsDefault)
        {
            foreach (var other in await _types.GetAll().Where(t => t.IsDefault && t.Id != input.Id).ToListAsync())
            {
                other.IsDefault = false;
            }
        }

        return isNew ? await _types.InsertAndGetIdAsync(type) : type.Id;
    }
}
