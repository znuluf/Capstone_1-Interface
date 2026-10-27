using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.UI;
using Capstone.Authorization;
using Capstone.Common;
using Capstone.Production;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Resources;

public class HatcheryDto
{
    public Guid Id { get; set; }

    [Required, StringLength(HatcherySource.MaxNameLength)]
    public string Name { get; set; }

    /// <summary>2–6 capital letters, unique per farm. Left empty on a new hatchery, the name's initials are used.</summary>
    [StringLength(HatcherySource.MaxShortCodeLength)]
    public string ShortCode { get; set; }

    [StringLength(HatcherySource.MaxAddressLength)]
    public string Address { get; set; }

    [StringLength(HatcherySource.MaxShortLength)]
    public string ContactPerson { get; set; }

    [StringLength(50)]
    public string Phone { get; set; }

    [StringLength(HatcherySource.MaxShortLength)]
    public string BfarAccreditationNo { get; set; }

    public AccreditationStatus AccreditationStatus { get; set; } = AccreditationStatus.Unknown;
    public bool IsActive { get; set; } = true;

    /// <summary>Read only: the current health certificate (latest unexpired, else the latest).</summary>
    public string HealthCertificateNo { get; set; }

    /// <summary>Read only.</summary>
    public DateOnly? HealthCertificateExpiry { get; set; }

    /// <summary>Read only: the current health certificate has expired as of the farm's today.</summary>
    public bool IsCertificateExpired { get; set; }

    public int CycleCount { get; set; }
}

public class HatcheryDetailDto : HatcheryDto
{
    public List<HatcheryCertificateDto> Certificates { get; set; } = new();
}

public class HatcheryCertificateDto
{
    public Guid Id { get; set; }
    public Guid HatcheryId { get; set; }
    public CertificateType CertificateType { get; set; } = CertificateType.Health;

    [Required, StringLength(HatcheryCertificate.MaxNumberLength)]
    public string CertificateNo { get; set; }

    public DateOnly? IssueDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }

    /// <summary>Read only.</summary>
    public bool IsExpired { get; set; }

    /// <summary>Read only: this is the hatchery's current health certificate.</summary>
    public bool IsCurrent { get; set; }

    /// <summary>Read only.</summary>
    public string RecordedBy { get; set; }
}

/// <summary>Hatchery Source Management (Ref 3.1), with certificate history. Owners manage; Technicians read.</summary>
[AbpAuthorize(PermissionNames.Hatcheries)]
public class HatcheryAppService : CapstoneAppServiceBase
{
    private readonly IRepository<HatcherySource, Guid> _hatcheries;
    private readonly IRepository<HatcheryCertificate, Guid> _certificates;
    private readonly IRepository<ProductionCycle, Guid> _cycles;

    public HatcheryAppService(IRepository<HatcherySource, Guid> hatcheries, IRepository<HatcheryCertificate, Guid> certificates, IRepository<ProductionCycle, Guid> cycles)
    {
        _hatcheries = hatcheries;
        _certificates = certificates;
        _cycles = cycles;
    }

    public virtual async Task<List<HatcheryDto>> GetAll()
    {
        var today = await Farm.GetTodayAsync();
        var counts = await _cycles.GetAll().GroupBy(c => c.FryDelivery.HatcheryId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N);
        var list = await _hatcheries.GetAll().AsNoTracking().OrderBy(h => h.Name).ToListAsync();
        var certificates = (await _certificates.GetAll().AsNoTracking().ToListAsync()).ToLookup(c => c.HatcheryId);
        return list.Select(h => Map(new HatcheryDto(), h, certificates[h.Id], today, counts.TryGetValue(h.Id, out var n) ? n : 0)).ToList();
    }

    public virtual async Task<HatcheryDetailDto> Get(Guid id)
    {
        var h = await _hatcheries.GetAsync(id);
        var today = await Farm.GetTodayAsync();
        var certificates = await _certificates.GetAll().AsNoTracking().Where(c => c.HatcheryId == id)
            .OrderByDescending(c => c.ExpiryDate).ThenByDescending(c => c.CreationTime).ToListAsync();
        var dto = Map(new HatcheryDetailDto(), h, certificates, today, await _cycles.CountAsync(c => c.FryDelivery.HatcheryId == id));
        var current = HatcheryCertificate.CurrentHealthCertificate(certificates, today);
        var names = await GetUserNamesAsync(certificates.Select(c => c.CreatorUserId));
        dto.Certificates = certificates.Select(c => new HatcheryCertificateDto
        {
            Id = c.Id, HatcheryId = c.HatcheryId, CertificateType = c.CertificateType, CertificateNo = c.CertificateNo, IssueDate = c.IssueDate,
            ExpiryDate = c.ExpiryDate, IsExpired = c.IsExpiredOn(today), IsCurrent = current != null && c.Id == current.Id, RecordedBy = NameOf(names, c.CreatorUserId),
        }).ToList();
        return dto;
    }

    public virtual async Task<List<LookupDto>> GetLookup()
    {
        return await _hatcheries.GetAll().AsNoTracking().OrderBy(h => h.Name)
            .Select(h => new LookupDto { Id = h.Id, Name = h.Name + " (" + h.ShortCode + ")", IsActive = h.IsActive }).ToListAsync();
    }

    [AbpAuthorize(PermissionNames.Hatcheries_Manage)]
    public virtual async Task<Guid> Save(HatcheryDto input)
    {
        var name = input.Name.Trim();
        if (await _hatcheries.GetAll().AnyAsync(h => h.Name == name && h.Id != input.Id))
        {
            throw new UserFriendlyException($"A hatchery named '{name}' already exists.");
        }

        var isNew = input.Id == Guid.Empty;
        var h = isNew ? new HatcherySource() : await _hatcheries.GetAsync(input.Id);
        var shortCode = string.IsNullOrWhiteSpace(input.ShortCode)
            ? (isNew ? HatcheryNaming.SuggestShortCode(name) : h.ShortCode)
            : input.ShortCode.Trim().ToUpperInvariant();
        if (!HatcheryNaming.IsValidShortCode(shortCode))
        {
            throw new UserFriendlyException($"The short code must be {HatcherySource.MinShortCodeLength} to {HatcherySource.MaxShortCodeLength} letters A–Z, for example SHI.");
        }

        if (shortCode != h.ShortCode)
        {
            if (!isNew && await _cycles.GetAll().AnyAsync(c => c.FryDelivery.HatcheryId == h.Id))
            {
                throw new UserFriendlyException("The short code cannot change once a production cycle uses this hatchery, because cycle codes include it.");
            }

            if (await _hatcheries.GetAll().AnyAsync(x => x.ShortCode == shortCode && x.Id != input.Id))
            {
                throw new UserFriendlyException($"The short code '{shortCode}' is already used by another hatchery. Enter a different short code.");
            }
        }

        h.Name = name;
        h.ShortCode = shortCode;
        h.Address = input.Address;
        h.ContactPerson = input.ContactPerson;
        h.Phone = input.Phone;
        h.BfarAccreditationNo = input.BfarAccreditationNo;
        h.AccreditationStatus = input.AccreditationStatus;
        h.IsActive = input.IsActive;
        return isNew ? await _hatcheries.InsertAndGetIdAsync(h) : h.Id;
    }

    [AbpAuthorize(PermissionNames.Hatcheries_Manage)]
    public virtual async Task SetActive(SetActiveInput input)
    {
        var h = await _hatcheries.GetAsync(input.Id);
        h.IsActive = input.IsActive;
    }

    /// <summary>Adds a certificate (a renewal adds a new one; earlier ones stay in the history).</summary>
    [AbpAuthorize(PermissionNames.Hatcheries_Manage)]
    public virtual async Task<Guid> AddCertificate(HatcheryCertificateDto input)
    {
        await _hatcheries.GetAsync(input.HatcheryId);
        if (!Enum.IsDefined(input.CertificateType))
        {
            throw new UserFriendlyException("Choose the certificate type.");
        }

        if (input.IssueDate.HasValue && input.ExpiryDate.HasValue && input.ExpiryDate.Value < input.IssueDate.Value)
        {
            throw new UserFriendlyException("The expiry date cannot be before the issue date.");
        }

        if (input.IssueDate.HasValue && input.IssueDate.Value > await Farm.GetTodayAsync())
        {
            throw new UserFriendlyException("The issue date cannot be in the future.");
        }

        return await _certificates.InsertAndGetIdAsync(new HatcheryCertificate
        {
            HatcheryId = input.HatcheryId, CertificateType = input.CertificateType, CertificateNo = input.CertificateNo.Trim(),
            IssueDate = input.IssueDate, ExpiryDate = input.ExpiryDate,
        });
    }

    /// <summary>Removes a certificate entered by mistake (kept in the data-change history).</summary>
    [AbpAuthorize(PermissionNames.Hatcheries_Manage)]
    public virtual async Task DeleteCertificate(EntityDto<Guid> input)
    {
        await _certificates.DeleteAsync(input.Id);
    }

    private static T Map<T>(T dto, HatcherySource h, IEnumerable<HatcheryCertificate> certificates, DateOnly today, int cycles) where T : HatcheryDto
    {
        var current = HatcheryCertificate.CurrentHealthCertificate(certificates, today);
        dto.Id = h.Id;
        dto.Name = h.Name;
        dto.ShortCode = h.ShortCode;
        dto.Address = h.Address;
        dto.ContactPerson = h.ContactPerson;
        dto.Phone = h.Phone;
        dto.BfarAccreditationNo = h.BfarAccreditationNo;
        dto.AccreditationStatus = h.AccreditationStatus;
        dto.IsActive = h.IsActive;
        dto.HealthCertificateNo = current?.CertificateNo;
        dto.HealthCertificateExpiry = current?.ExpiryDate;
        dto.IsCertificateExpired = current != null && current.IsExpiredOn(today);
        dto.CycleCount = cycles;
        return dto;
    }
}
