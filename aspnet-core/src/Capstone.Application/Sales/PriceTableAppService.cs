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

namespace Capstone.Sales;

public class PriceTableRowDto
{
    [Range(1, 10000, ErrorMessage = "Counts are pieces per kg, at least 1.")]
    public int? MinCountPerKg { get; set; }

    [Range(1, 10000, ErrorMessage = "Counts are pieces per kg, at least 1.")]
    public int? MaxCountPerKg { get; set; }

    [Range(0, 100000000, ErrorMessage = "A price cannot be negative.")]
    public decimal PricePerKg { get; set; }

    public string Label { get; set; }
}

public class PriceTableDto
{
    public Guid Id { get; set; }

    [Required, StringLength(PriceTable.MaxNameLength)]
    public string Name { get; set; }

    public Guid? BuyerId { get; set; }
    public string BuyerName { get; set; }
    public bool IsActive { get; set; } = true;
    public List<PriceTableRowDto> Rows { get; set; } = new();
}

/// <summary>
/// Price tables by count (DEC-82): a buyer's or the farm's price per kg for each count range. Everyone with sales access
/// reads them; Owners edit them. Sale lines keep a copy of the row and price used, so editing a table changes no sale.
/// </summary>
[AbpAuthorize(PermissionNames.Sales)]
public class PriceTableAppService : CapstoneAppServiceBase
{
    private readonly IRepository<PriceTable, Guid> _tables;
    private readonly IRepository<PriceTableRow, Guid> _rows;
    private readonly IRepository<Resources.Buyer, Guid> _buyers;

    public PriceTableAppService(IRepository<PriceTable, Guid> tables, IRepository<PriceTableRow, Guid> rows, IRepository<Resources.Buyer, Guid> buyers)
    {
        _tables = tables;
        _rows = rows;
        _buyers = buyers;
    }

    /// <summary>Active first, then by name; rows from the smallest count (biggest shrimp) up.</summary>
    public virtual async Task<List<PriceTableDto>> GetAll()
    {
        var list = await _tables.GetAll().AsNoTracking().Include(t => t.Rows).Include(t => t.Buyer)
            .OrderByDescending(t => t.IsActive).ThenBy(t => t.Name).ToListAsync();
        return list.Select(t => new PriceTableDto
        {
            Id = t.Id, Name = t.Name, BuyerId = t.BuyerId, BuyerName = t.Buyer?.Name, IsActive = t.IsActive,
            Rows = t.Rows.OrderBy(r => r.MinCountPerKg ?? 0).ThenBy(r => r.MaxCountPerKg ?? int.MaxValue)
                .Select(r => new PriceTableRowDto { MinCountPerKg = r.MinCountPerKg, MaxCountPerKg = r.MaxCountPerKg, PricePerKg = r.PricePerKg, Label = r.Label }).ToList(),
        }).ToList();
    }

    /// <summary>Creates (empty Id) or updates a table, replacing its rows. Rows may not overlap.</summary>
    [AbpAuthorize(PermissionNames.Production_Manage)]
    public virtual async Task<Guid> Save(PriceTableDto input)
    {
        var name = input.Name.Trim();
        if (await _tables.GetAll().AnyAsync(t => t.Name == name && t.Id != input.Id))
        {
            throw new UserFriendlyException($"The price table '{name}' already exists.");
        }

        if (input.BuyerId.HasValue && !await _buyers.GetAll().AnyAsync(b => b.Id == input.BuyerId.Value))
        {
            throw new UserFriendlyException("Choose a buyer of this farm.");
        }

        var rows = input.Rows ?? new List<PriceTableRowDto>();
        if (rows.Count == 0)
        {
            throw new UserFriendlyException("Add at least one count range with its price.");
        }

        if (rows.Any(r => r.MinCountPerKg.HasValue && r.MaxCountPerKg.HasValue && r.MaxCountPerKg < r.MinCountPerKg))
        {
            throw new UserFriendlyException("In each row, the highest count cannot be below the lowest.");
        }

        // No overlap: sorted by lower bound, each row must end before the next starts.
        var sorted = rows.OrderBy(r => r.MinCountPerKg ?? 0).ToList();
        for (var i = 1; i < sorted.Count; i++)
        {
            var prevMax = sorted[i - 1].MaxCountPerKg;
            var min = sorted[i].MinCountPerKg ?? 0;
            if (!prevMax.HasValue || prevMax.Value >= min)
            {
                throw new UserFriendlyException($"Count ranges overlap at {min} pcs/kg. Each count may have one price.");
            }
        }

        var isNew = input.Id == Guid.Empty;
        var table = isNew ? new PriceTable { Id = Guid.NewGuid() } : await _tables.GetAll().Include(t => t.Rows).FirstAsync(t => t.Id == input.Id);
        table.Name = name;
        table.BuyerId = input.BuyerId;
        table.IsActive = input.IsActive;
        foreach (var r in table.Rows.ToList())
        {
            table.Rows.Remove(r);
            await _rows.DeleteAsync(r);
        }

        foreach (var r in sorted)
        {
            table.Rows.Add(new PriceTableRow { PriceTableId = table.Id, MinCountPerKg = r.MinCountPerKg, MaxCountPerKg = r.MaxCountPerKg, PricePerKg = r.PricePerKg });
        }

        if (isNew)
        {
            await _tables.InsertAsync(table);
        }

        return table.Id;
    }
}
