using Abp.Domain.Repositories;
using Abp.Domain.Services;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Compliance;

/// <summary>
/// Finds required permits (presets marked IsRequired) with no current record. Used for reminders on the dashboard and at
/// a cycle's first stocking; it never blocks production (decision D-30, replacing D-15).
/// </summary>
public class ComplianceChecker : DomainService
{
    private readonly IRepository<DocumentPreset, Guid> _presets;
    private readonly IRepository<ComplianceDocument, Guid> _documents;

    public ComplianceChecker(IRepository<DocumentPreset, Guid> presets, IRepository<ComplianceDocument, Guid> documents)
    {
        _presets = presets;
        _documents = documents;
    }

    /// <summary>Names of required permits without a non-archived, non-expired record.</summary>
    public async Task<List<string>> GetMissingRequiredPermitsAsync(DateOnly today)
    {
        var required = await _presets.GetAll().AsNoTracking()
            .Where(p => p.IsActive && p.IsRequired && p.Category.IsActive)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Name)
            .Select(p => new { p.Id, p.Name })
            .ToListAsync();
        if (required.Count == 0)
        {
            return new List<string>();
        }

        var ids = required.Select(p => p.Id).ToList();
        var current = await _documents.GetAll().AsNoTracking()
            .Where(d => d.PresetId != null && ids.Contains(d.PresetId.Value) && !d.IsArchived && (d.ExpiryDate == null || d.ExpiryDate >= today))
            .Select(d => d.PresetId.Value)
            .Distinct()
            .ToListAsync();

        return required.Where(p => !current.Contains(p.Id)).Select(p => p.Name).ToList();
    }
}
