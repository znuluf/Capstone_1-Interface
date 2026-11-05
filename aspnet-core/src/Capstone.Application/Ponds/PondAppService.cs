using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.UI;
using Capstone.Authorization;
using Capstone.Domain;
using Capstone.Production;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Ponds;

public class PondEditDto : IValidatableObject
{
    public Guid Id { get; set; }

    /// <summary>Create only: an explicit pond name prefix. Left empty, the construction type decides it (Earthen Pond, Concrete Pond, HDPE-lined Pond). Fixed after creation.</summary>
    public Guid? PrefixId { get; set; }

    /// <summary>Create only: number within the prefix; left empty, the next free number is used. Fixed after creation.</summary>
    [Range(1, Pond.MaxNumber)]
    public int? Number { get; set; }

    [Range(0.01, 100000000)]
    public decimal AreaM2 { get; set; }

    [Range(0.01, 100)]
    public decimal AverageDepthM { get; set; }

    [Range(0.01, 100)]
    public decimal MaxDepthM { get; set; }

    public PondPurpose Purpose { get; set; } = PondPurpose.GrowOut;
    public PondConstructionType ConstructionType { get; set; } = PondConstructionType.Earthen;

    [StringLength(Pond.MaxTypeLength)]
    public string InletType { get; set; }

    [StringLength(Pond.MaxTypeLength)]
    public string OutletType { get; set; }

    [StringLength(Pond.MaxAerationLength)]
    public string AerationSystem { get; set; }

    /// <summary>Empty means the pond uses the farm's farming system.</summary>
    public FarmingSystem? FarmingSystemOverride { get; set; }

    [Range(-90, 90)]
    public decimal? Latitude { get; set; }

    [Range(-180, 180)]
    public decimal? Longitude { get; set; }

    [StringLength(Pond.MaxNotesLength)]
    public string Notes { get; set; }

    /// <summary>Optional note recorded in the pond history for an infrastructure change.</summary>
    [StringLength(500)]
    public string ChangeNote { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (MaxDepthM < AverageDepthM)
        {
            yield return new ValidationResult("Maximum depth cannot be less than average depth.", new[] { nameof(MaxDepthM) });
        }
    }
}

public class PondListDto
{
    public Guid Id { get; set; }
    public string PondCode { get; set; }

    /// <summary>Prefix name plus number, e.g. "Grow-out Pond 3".</summary>
    public string Name { get; set; }

    public Guid PrefixId { get; set; }
    public int Number { get; set; }
    public decimal AreaM2 { get; set; }
    public decimal AverageDepthM { get; set; }
    public decimal MaxDepthM { get; set; }
    public PondPurpose Purpose { get; set; }
    public PondConstructionType ConstructionType { get; set; }

    /// <summary>Effective farming system (the pond's override, else the farm's).</summary>
    public FarmingSystem FarmingSystem { get; set; }

    public FarmingSystem? FarmingSystemOverride { get; set; }
    public PondManualStatus ManualStatus { get; set; }
    public PondDisplayStatus Status { get; set; }
    public Guid? CurrentBatchId { get; set; }
    public string CurrentBatchCode { get; set; }
    public BatchStatus? CurrentBatchStatus { get; set; }

    /// <summary>Set when the farming system is unusual for the construction type (warning only).</summary>
    public string SystemWarning { get; set; }
}

public class PondDetailDto : PondEditDto
{
    public string PondCode { get; set; }
    public string Name { get; set; }
    public string PrefixName { get; set; }

    /// <summary>Effective farming system (override, else the farm's).</summary>
    public FarmingSystem FarmingSystem { get; set; }

    /// <summary>The farm's farming system, shown as the inherited value.</summary>
    public FarmingSystem FarmFarmingSystem { get; set; }

    public PondManualStatus ManualStatus { get; set; }
    public PondDisplayStatus Status { get; set; }
    public Guid? CurrentBatchId { get; set; }
    public string CurrentBatchCode { get; set; }
    public string SystemWarning { get; set; }

    /// <summary>True once a batch has been stocked: the construction type can no longer change.</summary>
    public bool ConstructionLocked { get; set; }

    public List<PondHistoryDto> History { get; set; } = new();
    public List<PondBatchSummaryDto> Batches { get; set; } = new();

    /// <summary>The open preparation round (null when none), then earlier rounds, newest first.</summary>
    public PreparationRoundDto OpenRound { get; set; }
    public List<PreparationRoundDto> PastRounds { get; set; } = new();
    public bool CanAddPreparationEntry { get; set; }
    public bool CanMarkPrepared { get; set; }
}

public class PondPrefixDto
{
    public Guid Id { get; set; }

    [Required, StringLength(PondNamePrefix.MaxNameLength)]
    public string Name { get; set; }

    /// <summary>Create only: 1–6 capital letters; suggested from the name's initials when empty. Fixed after creation.</summary>
    [StringLength(PondNamePrefix.MaxShortCodeLength)]
    public string ShortCode { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Read only.</summary>
    public int PondCount { get; set; }

    /// <summary>Read only: the number the next pond with this prefix gets by default.</summary>
    public int NextNumber { get; set; }
}

public class PreparationRoundDto
{
    public Guid Id { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public DateTime? PreparedAtUtc { get; set; }
    public string PreparedBy { get; set; }
    public DateTime? UsedAtUtc { get; set; }
    public string UsedByBatchCode { get; set; }
    public List<PreparationEntryDto> Entries { get; set; } = new();
}

public class PreparationEntryDto
{
    public Guid Id { get; set; }
    public DateTime ObservedAtUtc { get; set; }
    public string Description { get; set; }
    public string RecordedBy { get; set; }
}

public class AddPreparationEntryInput
{
    public Guid PondId { get; set; }

    /// <summary>When the work was done (ISO with offset); not in the future.</summary>
    public DateTime ObservedAt { get; set; }

    [Required, StringLength(PondPreparationEntry.MaxDescriptionLength)]
    public string Description { get; set; }

    /// <summary>Client-generated id that makes retries duplicate-safe (spec Section 5).</summary>
    public Guid ClientRequestId { get; set; }
}

public class PondHistoryDto
{
    public DateTime ChangeDateUtc { get; set; }
    public PondChangeType ChangeType { get; set; }
    public string Description { get; set; }
    public string RecordedBy { get; set; }
}

public class PondBatchSummaryDto
{
    public Guid Id { get; set; }
    public string BatchCode { get; set; }
    public string CycleCode { get; set; }
    public BatchStatus Status { get; set; }
    public DateOnly? StockingDate { get; set; }
}

public class SetPondStatusInput
{
    public Guid Id { get; set; }
    public PondManualStatus ManualStatus { get; set; }

    [StringLength(500)]
    public string Note { get; set; }
}

/// <summary>Pond Configuration and Status Tracking (Refs 4.1, 4.2), with the farm's pond name prefixes.</summary>
[AbpAuthorize(PermissionNames.Ponds)]
public class PondAppService : CapstoneAppServiceBase
{
    private readonly IRepository<Pond, Guid> _ponds;
    private readonly IRepository<PondNamePrefix, Guid> _prefixes;
    private readonly IRepository<PondHistory, Guid> _history;
    private readonly IRepository<PondBatch, Guid> _batches;
    private readonly IRepository<PondPreparationRound, Guid> _rounds;
    private readonly IRepository<PondPreparationEntry, Guid> _entries;

    public PondAppService(IRepository<Pond, Guid> ponds, IRepository<PondNamePrefix, Guid> prefixes, IRepository<PondHistory, Guid> history,
        IRepository<PondBatch, Guid> batches, IRepository<PondPreparationRound, Guid> rounds, IRepository<PondPreparationEntry, Guid> entries)
    {
        _ponds = ponds;
        _prefixes = prefixes;
        _history = history;
        _batches = batches;
        _rounds = rounds;
        _entries = entries;
    }

    /// <summary>
    /// Pond operating status precedence (spec Section 5): manual status; a Stocked batch; an open preparation round
    /// (Prepared or Under preparation); a Harvested or Failed batch not yet closed; otherwise Available.
    /// </summary>
    public static PondDisplayStatus DeriveStatus(PondManualStatus manual, BatchStatus? openBatch, bool hasOpenRound = false, bool roundPrepared = false)
    {
        if (manual == PondManualStatus.Inactive)
        {
            return PondDisplayStatus.Inactive;
        }

        if (manual == PondManualStatus.UnderMaintenance)
        {
            return PondDisplayStatus.UnderMaintenance;
        }

        if (openBatch == BatchStatus.Stocked)
        {
            return PondDisplayStatus.InProduction;
        }

        if (hasOpenRound)
        {
            return roundPrepared ? PondDisplayStatus.Prepared : PondDisplayStatus.UnderPreparation;
        }

        return openBatch is BatchStatus.Harvested or BatchStatus.Failed ? PondDisplayStatus.PostHarvest : PondDisplayStatus.Available;
    }

    public virtual async Task<List<PondListDto>> GetAll()
    {
        var farmSystem = (await Farm.GetProfileAsync()).FarmingSystem;
        var ponds = await _ponds.GetAll().AsNoTracking().Include(p => p.Prefix).OrderBy(p => p.PondCode).ToListAsync();
        var open = await _batches.GetAll().AsNoTracking().Where(b => b.Status != BatchStatus.Closed)
            .Select(b => new { b.PondId, b.Id, b.BatchCode, b.Status }).ToListAsync();
        var rounds = await _rounds.GetAll().AsNoTracking().Where(r => r.UsedAtUtc == null).Select(r => new { r.PondId, r.PreparedAtUtc }).ToListAsync();
        return ponds.Select(p =>
        {
            var batch = open.FirstOrDefault(b => b.PondId == p.Id);
            var round = rounds.FirstOrDefault(r => r.PondId == p.Id);
            var system = p.EffectiveFarmingSystem(farmSystem);
            return new PondListDto
            {
                Id = p.Id, PondCode = p.PondCode, Name = PondNaming.DisplayName(p.Prefix?.Name, p.Number), PrefixId = p.PrefixId, Number = p.Number,
                AreaM2 = p.AreaM2, AverageDepthM = p.AverageDepthM, MaxDepthM = p.MaxDepthM,
                Purpose = p.Purpose, ConstructionType = p.ConstructionType, FarmingSystem = system, FarmingSystemOverride = p.FarmingSystemOverride,
                ManualStatus = p.ManualStatus,
                Status = DeriveStatus(p.ManualStatus, batch?.Status, round != null, round?.PreparedAtUtc != null),
                CurrentBatchId = batch?.Id, CurrentBatchCode = batch?.BatchCode, CurrentBatchStatus = batch?.Status,
                SystemWarning = PondSystemRules.GetWarning(p.ConstructionType, system),
            };
        }).ToList();
    }

    public virtual async Task<PondDetailDto> Get(Guid id)
    {
        var farmSystem = (await Farm.GetProfileAsync()).FarmingSystem;
        var p = await _ponds.GetAll().AsNoTracking().Include(x => x.Prefix).FirstOrDefaultAsync(x => x.Id == id) ?? throw new UserFriendlyException("Pond not found.");
        var history = await _history.GetAll().AsNoTracking().Where(h => h.PondId == id).OrderByDescending(h => h.ChangeDateUtc).ToListAsync();
        var batches = await _batches.GetAll().AsNoTracking().Include(b => b.Cycle).Where(b => b.PondId == id)
            .OrderByDescending(b => b.StockedAtUtc).ToListAsync();
        var rounds = await _rounds.GetAll().AsNoTracking().Where(r => r.PondId == id).OrderByDescending(r => r.StartedAtUtc).ToListAsync();
        var roundIds = rounds.Select(r => r.Id).ToList();
        var entries = await _entries.GetAll().AsNoTracking().Where(e => roundIds.Contains(e.RoundId)).OrderBy(e => e.ObservedAtUtc).ToListAsync();
        var names = await GetUserNamesAsync(history.Select(h => h.CreatorUserId).Concat(entries.Select(e => e.CreatorUserId)).Concat(rounds.Select(r => r.PreparedByUserId)));
        var open = batches.FirstOrDefault(b => b.Status != BatchStatus.Closed);
        var openRound = rounds.FirstOrDefault(r => r.UsedAtUtc == null);
        var system = p.EffectiveFarmingSystem(farmSystem);
        PreparationRoundDto MapRound(PondPreparationRound r) => new()
        {
            Id = r.Id, StartedAtUtc = r.StartedAtUtc, PreparedAtUtc = r.PreparedAtUtc, PreparedBy = NameOf(names, r.PreparedByUserId), UsedAtUtc = r.UsedAtUtc,
            UsedByBatchCode = batches.FirstOrDefault(b => b.PreparationRoundId == r.Id)?.BatchCode,
            Entries = entries.Where(e => e.RoundId == r.Id).Select(e => new PreparationEntryDto { Id = e.Id, ObservedAtUtc = e.ObservedAtUtc, Description = e.Description, RecordedBy = NameOf(names, e.CreatorUserId) }).ToList(),
        };
        var status = DeriveStatus(p.ManualStatus, open?.Status, openRound != null, openRound?.PreparedAtUtc != null);
        var canPrepare = await IsGrantedAsync(PermissionNames.Ponds_Prepare);
        return new PondDetailDto
        {
            Id = p.Id, PondCode = p.PondCode, Name = PondNaming.DisplayName(p.Prefix?.Name, p.Number), PrefixId = p.PrefixId, PrefixName = p.Prefix?.Name,
            Number = p.Number, AreaM2 = p.AreaM2, AverageDepthM = p.AverageDepthM, MaxDepthM = p.MaxDepthM,
            Purpose = p.Purpose, ConstructionType = p.ConstructionType, InletType = p.InletType, OutletType = p.OutletType,
            AerationSystem = p.AerationSystem, FarmingSystemOverride = p.FarmingSystemOverride, FarmingSystem = system, FarmFarmingSystem = farmSystem,
            Latitude = p.Latitude, Longitude = p.Longitude, Notes = p.Notes,
            ManualStatus = p.ManualStatus, Status = status, CurrentBatchId = open?.Id, CurrentBatchCode = open?.BatchCode,
            OpenRound = openRound == null ? null : MapRound(openRound),
            PastRounds = rounds.Where(r => r.UsedAtUtc != null).Select(MapRound).ToList(),
            CanAddPreparationEntry = canPrepare && CanPrepare(p, open?.Status, openRound),
            CanMarkPrepared = canPrepare && openRound != null && openRound.PreparedAtUtc == null && entries.Any(e => e.RoundId == openRound.Id),
            SystemWarning = PondSystemRules.GetWarning(p.ConstructionType, system),
            ConstructionLocked = batches.Count > 0,
            History = history.Select(h => new PondHistoryDto { ChangeDateUtc = h.ChangeDateUtc, ChangeType = h.ChangeType, Description = h.Description, RecordedBy = NameOf(names, h.CreatorUserId) }).ToList(),
            Batches = batches.Select(b => new PondBatchSummaryDto { Id = b.Id, BatchCode = b.BatchCode, CycleCode = b.Cycle?.CycleCode, Status = b.Status, StockingDate = b.StockingDate }).ToList(),
        };
    }

    /// <summary>Creates a pond. Its name and code come from the prefix and number (e.g. "Grow-out Pond 3", "GP-03") and never change.</summary>
    [AbpAuthorize(PermissionNames.Ponds_Manage)]
    public virtual async Task<Guid> Create(PondEditDto input)
    {
        // Without a prefix the name comes from the construction type ("Earthen Pond 3", code EP-03).
        var prefix = input.PrefixId.HasValue
            ? await _prefixes.FirstOrDefaultAsync(x => x.Id == input.PrefixId.Value) ?? throw new UserFriendlyException("Pond name prefix not found.")
            : await EnsureConstructionPrefixAsync(input.ConstructionType);
        if (!prefix.IsActive)
        {
            throw new UserFriendlyException($"The prefix '{prefix.Name}' is inactive. Choose an active prefix.");
        }

        var number = input.Number ?? await NextNumberAsync(prefix.Id);
        if (number < 1 || number > Pond.MaxNumber)
        {
            throw new UserFriendlyException($"The pond number must be between 1 and {Pond.MaxNumber}.");
        }

        if (await _ponds.GetAll().AnyAsync(p => p.PrefixId == prefix.Id && p.Number == number))
        {
            throw new UserFriendlyException($"{PondNaming.DisplayName(prefix.Name, number)} already exists. The next free number is {await NextNumberAsync(prefix.Id)}.");
        }

        var code = PondNaming.FormatCode(prefix.ShortCode, number);
        if (await _ponds.GetAll().AnyAsync(p => p.PondCode == code))
        {
            throw new UserFriendlyException($"Pond ID '{code}' is already used in this farm. Choose another number.");
        }

        var pond = new Pond { PrefixId = prefix.Id, Number = number, PondCode = code };
        Apply(pond, input);
        var id = await _ponds.InsertAndGetIdAsync(pond);
        await _history.InsertAsync(new PondHistory
        {
            PondId = id,
            ChangeDateUtc = DateTime.UtcNow,
            ChangeType = PondChangeType.Created,
            Description = $"Pond {code} ({PondNaming.DisplayName(prefix.Name, number)}) created ({input.AreaM2:0.##} m², {input.Purpose}). Status Available.",
        });
        return id;
    }

    /// <summary>Updates pond details. The prefix, number and code stay as created.</summary>
    [AbpAuthorize(PermissionNames.Ponds_Manage)]
    public virtual async Task Update(PondEditDto input)
    {
        var pond = await _ponds.GetAsync(input.Id);
        if (input.Purpose != PondPurpose.GrowOut && pond.Purpose == PondPurpose.GrowOut
            && await _batches.GetAll().AnyAsync(b => b.PondId == pond.Id && b.Status != BatchStatus.Closed))
        {
            throw new UserFriendlyException("This pond has an open batch, so its purpose must stay Grow-out until the batch is closed.");
        }

        if (input.ConstructionType != pond.ConstructionType && await _batches.GetAll().AnyAsync(b => b.PondId == pond.Id))
        {
            throw new UserFriendlyException("The construction type cannot change once a batch has been stocked in this pond. A different construction is a different pond; add a new pond instead.");
        }

        var changes = DescribeChanges(pond, input);
        Apply(pond, input);
        if (changes.Count > 0 || !string.IsNullOrWhiteSpace(input.ChangeNote))
        {
            var text = string.Join("; ", changes);
            if (!string.IsNullOrWhiteSpace(input.ChangeNote))
            {
                text = string.IsNullOrEmpty(text) ? input.ChangeNote.Trim() : $"{text}. Note: {input.ChangeNote.Trim()}";
            }

            await _history.InsertAsync(new PondHistory
            {
                PondId = pond.Id, ChangeDateUtc = DateTime.UtcNow, ChangeType = PondChangeType.InfrastructureModification,
                Description = text.Length > PondHistory.MaxDescriptionLength ? text[..PondHistory.MaxDescriptionLength] : text,
            });
        }
    }

    /// <summary>Manual status: Active, Under maintenance or Inactive (deactivation instead of deletion).</summary>
    [AbpAuthorize(PermissionNames.Ponds_Manage)]
    public virtual async Task SetManualStatus(SetPondStatusInput input)
    {
        var pond = await _ponds.GetAsync(input.Id);
        if (pond.ManualStatus == input.ManualStatus)
        {
            return;
        }

        if (input.ManualStatus != PondManualStatus.Active)
        {
            if (await _batches.GetAll().AnyAsync(b => b.PondId == pond.Id && b.Status != BatchStatus.Closed))
            {
                throw new UserFriendlyException("A pond with an open batch cannot be put under maintenance or made inactive. Close the batch first.");
            }

            if (await _rounds.GetAll().AnyAsync(r => r.PondId == pond.Id && r.UsedAtUtc == null))
            {
                throw new UserFriendlyException("This pond has a preparation round in progress. Stock it or finish the work before changing its status.");
            }
        }

        var old = pond.ManualStatus;
        pond.ManualStatus = input.ManualStatus;
        await _history.InsertAsync(new PondHistory
        {
            PondId = pond.Id, ChangeDateUtc = DateTime.UtcNow, ChangeType = PondChangeType.StatusChange,
            Description = $"Status {old} → {input.ManualStatus}" + (string.IsNullOrWhiteSpace(input.Note) ? string.Empty : $". {input.Note.Trim()}"),
        });
    }

    // ---------------------------------------------------------------- preparation (Ref 4.3, AC-07)

    /// <summary>
    /// Adds a dated preparation entry. The first entry opens a round and the pond becomes Under preparation.
    /// Allowed when the pond is Available, Post-harvest or Under preparation and its manual status is Active.
    /// </summary>
    [AbpAuthorize(PermissionNames.Ponds_Prepare)]
    public virtual async Task<Guid> AddPreparationEntry(AddPreparationEntryInput input)
    {
        if (input.ClientRequestId != Guid.Empty)
        {
            var saved = await _entries.GetAll().Where(e => e.ClientRequestId == input.ClientRequestId).Select(e => (Guid?)e.Id).FirstOrDefaultAsync();
            if (saved.HasValue)
            {
                return saved.Value;
            }
        }

        var pond = await _ponds.FirstOrDefaultAsync(p => p.Id == input.PondId) ?? throw new UserFriendlyException("Pond not found.");
        var open = await _batches.GetAll().Where(b => b.PondId == pond.Id && b.Status != BatchStatus.Closed).Select(b => (BatchStatus?)b.Status).FirstOrDefaultAsync();
        var round = await _rounds.FirstOrDefaultAsync(r => r.PondId == pond.Id && r.UsedAtUtc == null);
        if (!CanPrepare(pond, open, round))
        {
            throw new UserFriendlyException(round?.PreparedAtUtc != null
                ? $"Pond {pond.PondCode} is already marked Prepared. It is ready for Create Batch (Stocking)."
                : $"Pond {pond.PondCode} cannot be prepared now (status: {DeriveStatus(pond.ManualStatus, open, round != null, round?.PreparedAtUtc != null)}).");
        }

        var observedAt = FarmClock.ToUtc(input.ObservedAt);
        if (observedAt > DateTime.UtcNow.AddMinutes(5))
        {
            throw new UserFriendlyException("The preparation date and time cannot be in the future.");
        }

        if (round == null)
        {
            round = new PondPreparationRound { PondId = pond.Id, StartedAtUtc = observedAt };
            round.Id = await _rounds.InsertAndGetIdAsync(round);
        }
        else if (observedAt < round.StartedAtUtc)
        {
            round.StartedAtUtc = observedAt;
        }

        return await _entries.InsertAndGetIdAsync(new PondPreparationEntry
        {
            RoundId = round.Id, ObservedAtUtc = observedAt, Description = input.Description.Trim(),
            ClientRequestId = input.ClientRequestId == Guid.Empty ? Guid.NewGuid() : input.ClientRequestId,
        });
    }

    /// <summary>Mark Prepared: the open round needs at least one entry. The pond becomes Prepared and appears in the stepper.</summary>
    [AbpAuthorize(PermissionNames.Ponds_Prepare)]
    public virtual async Task MarkPrepared(EntityDto<Guid> input)
    {
        var round = await _rounds.FirstOrDefaultAsync(r => r.PondId == input.Id && r.UsedAtUtc == null)
                    ?? throw new UserFriendlyException("Add a preparation entry first; there is no preparation in progress for this pond.");
        if (round.PreparedAtUtc != null)
        {
            throw new UserFriendlyException("This pond is already marked Prepared.");
        }

        if (!await _entries.GetAll().AnyAsync(e => e.RoundId == round.Id))
        {
            throw new UserFriendlyException("Add at least one preparation entry before marking the pond Prepared.");
        }

        round.PreparedAtUtc = DateTime.UtcNow;
        round.PreparedByUserId = AbpSession.UserId;
    }

    private static bool CanPrepare(Pond pond, BatchStatus? openBatch, PondPreparationRound openRound) =>
        pond.ManualStatus == PondManualStatus.Active
        && openBatch != BatchStatus.Stocked
        && (openRound == null || openRound.PreparedAtUtc == null);

    // ---------------------------------------------------------------- prefixes

    /// <summary>The farm's pond name prefixes, active first, with the next free number for each.</summary>
    public virtual async Task<List<PondPrefixDto>> GetPrefixes()
    {
        var prefixes = await _prefixes.GetAll().AsNoTracking().OrderByDescending(x => x.IsActive).ThenBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync();
        var usage = await _ponds.GetAll().GroupBy(p => p.PrefixId)
            .Select(g => new { PrefixId = g.Key, Count = g.Count(), Max = g.Max(p => p.Number) }).ToListAsync();
        return prefixes.Select(x =>
        {
            var u = usage.FirstOrDefault(y => y.PrefixId == x.Id);
            return new PondPrefixDto
            {
                Id = x.Id, Name = x.Name, ShortCode = x.ShortCode, SortOrder = x.SortOrder, IsActive = x.IsActive,
                PondCount = u?.Count ?? 0, NextNumber = Math.Min((u?.Max ?? 0) + 1, Pond.MaxNumber),
            };
        }).ToList();
    }

    [AbpAuthorize(PermissionNames.Ponds_Manage)]
    public virtual async Task<Guid> CreatePrefix(PondPrefixDto input)
    {
        var name = input.Name.Trim();
        var shortCode = string.IsNullOrWhiteSpace(input.ShortCode) ? PondNaming.SuggestShortCode(name) : input.ShortCode.Trim().ToUpperInvariant();
        if (!PondNaming.IsValidShortCode(shortCode))
        {
            throw new UserFriendlyException($"The short code must be 1 to {PondNamePrefix.MaxShortCodeLength} letters A–Z, for example GP.");
        }

        await EnsureUniquePrefixNameAsync(name, null);
        if (await _prefixes.GetAll().AnyAsync(x => x.ShortCode == shortCode))
        {
            throw new UserFriendlyException($"The short code '{shortCode}' is already used by another prefix. Enter a different short code.");
        }

        var sortOrder = input.SortOrder > 0 ? input.SortOrder : (await _prefixes.GetAll().MaxAsync(x => (int?)x.SortOrder) ?? 0) + 1;
        return await _prefixes.InsertAndGetIdAsync(new PondNamePrefix { Name = name, ShortCode = shortCode, SortOrder = sortOrder, IsActive = true });
    }

    /// <summary>Renames, reorders or (de)activates a prefix. Existing pond codes never change; pond names show the new prefix name.</summary>
    [AbpAuthorize(PermissionNames.Ponds_Manage)]
    public virtual async Task UpdatePrefix(PondPrefixDto input)
    {
        var prefix = await _prefixes.GetAsync(input.Id);
        var name = input.Name.Trim();
        await EnsureUniquePrefixNameAsync(name, prefix.Id);
        prefix.Name = name;
        prefix.SortOrder = input.SortOrder;
        prefix.IsActive = input.IsActive;
    }

    /// <summary>The prefix that names ponds of a construction type; made on first use so every farm gets it without a migration.</summary>
    private async Task<PondNamePrefix> EnsureConstructionPrefixAsync(PondConstructionType construction)
    {
        var (name, shortCode) = construction switch
        {
            PondConstructionType.Earthen => ("Earthen Pond", "EP"),
            PondConstructionType.Concrete => ("Concrete Pond", "CP"),
            _ => ("HDPE-lined Pond", "HP"),
        };

        var existing = await _prefixes.FirstOrDefaultAsync(x => x.ShortCode == shortCode);
        if (existing != null)
        {
            return existing;
        }

        await EnsureUniquePrefixNameAsync(name, null);
        var sortOrder = (await _prefixes.GetAll().MaxAsync(x => (int?)x.SortOrder) ?? 0) + 1;
        // Return the inserted entity itself: re-reading it by id can miss it (EntityNotFoundException) before the unit of work completes.
        var prefix = new PondNamePrefix { Name = name, ShortCode = shortCode, SortOrder = sortOrder, IsActive = true };
        await _prefixes.InsertAndGetIdAsync(prefix);
        return prefix;
    }

    private async Task EnsureUniquePrefixNameAsync(string name, Guid? exceptId)
    {
        if (await _prefixes.GetAll().AnyAsync(x => x.Name == name && x.Id != exceptId))
        {
            throw new UserFriendlyException($"A prefix named '{name}' already exists.");
        }
    }

    private async Task<int> NextNumberAsync(Guid prefixId) =>
        (await _ponds.GetAll().Where(p => p.PrefixId == prefixId).MaxAsync(p => (int?)p.Number) ?? 0) + 1;

    private static void Apply(Pond pond, PondEditDto input)
    {
        pond.AreaM2 = input.AreaM2;
        pond.AverageDepthM = input.AverageDepthM;
        pond.MaxDepthM = input.MaxDepthM;
        pond.Purpose = input.Purpose;
        pond.ConstructionType = input.ConstructionType;
        pond.InletType = input.InletType;
        pond.OutletType = input.OutletType;
        pond.AerationSystem = input.AerationSystem;
        pond.FarmingSystemOverride = input.FarmingSystemOverride;
        pond.Latitude = input.Latitude;
        pond.Longitude = input.Longitude;
        pond.Notes = input.Notes;
    }

    private static List<string> DescribeChanges(Pond p, PondEditDto i)
    {
        var list = new List<string>();
        void Check<T>(string label, T a, T b)
        {
            if (!Equals(a, b))
            {
                list.Add($"{label}: {a} → {b}");
            }
        }

        Check("Area (m²)", p.AreaM2, i.AreaM2);
        Check("Average depth (m)", p.AverageDepthM, i.AverageDepthM);
        Check("Max depth (m)", p.MaxDepthM, i.MaxDepthM);
        Check("Purpose", p.Purpose, i.Purpose);
        Check("Construction", p.ConstructionType, i.ConstructionType);
        Check("Inlet", p.InletType, i.InletType);
        Check("Outlet", p.OutletType, i.OutletType);
        Check("Aeration", p.AerationSystem, i.AerationSystem);
        Check("Farming system", p.FarmingSystemOverride?.ToString() ?? "farm setting", i.FarmingSystemOverride?.ToString() ?? "farm setting");
        return list;
    }
}
