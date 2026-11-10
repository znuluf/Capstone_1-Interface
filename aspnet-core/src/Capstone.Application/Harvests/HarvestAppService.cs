using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Runtime.Session;
using Abp.UI;
using Capstone.Authorization;
using Capstone.Common;
using Capstone.Production.Dto;
using Capstone.Domain;
using Capstone.Production;
using Capstone.Sales;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Harvests;

public class GradeLineInput
{
    public Guid SizeGradeId { get; set; }

    [Range(0.001, 100000000, ErrorMessage = "Grade kg must be greater than zero.")]
    public decimal Kg { get; set; }
}

public class DisposalInput
{
    [Range(0.001, 100000000, ErrorMessage = "Not-sold kg must be greater than zero.")]
    public decimal Kg { get; set; }

    public DisposalReason Reason { get; set; }

    [StringLength(HarvestDisposal.MaxNoteLength)]
    public string Note { get; set; }
}

/// <summary>One weighed crate on the tally sheet (DEC-80); crate numbers follow the list order.</summary>
public class CrateInput
{
    /// <summary>The scale reading. With an empty-container weight it includes the container; otherwise it is shrimp only.</summary>
    [Range(0.001, 10000, ErrorMessage = "Crate kg must be greater than zero.")]
    public decimal Kg { get; set; }

    public Guid? ContainerTypeId { get; set; }

    /// <summary>
    /// The crate's size grade when crates are graded one by one (DEC-82). When any crate has one, the harvest's grade lines are
    /// worked out from the crates (ungraded crates go to "Ungraded / mixed") and the typed grade lines are ignored.
    /// </summary>
    public Guid? SizeGradeId { get; set; }

    /// <summary>
    /// Empty container weight to subtract. Empty takes the container type's current value; an edited harvest sends back
    /// the value it was saved with, so changing the type later does not change this tally.
    /// </summary>
    [Range(0, 1000, ErrorMessage = "The empty crate weight cannot be negative.")]
    public decimal? TareKg { get; set; }
}

public class CrateDto
{
    public int CrateNo { get; set; }

    /// <summary>Net shrimp kg.</summary>
    public decimal Kg { get; set; }

    public Guid? SizeGradeId { get; set; }
    public string SizeLabel { get; set; }
    public Guid? ContainerTypeId { get; set; }
    public string ContainerName { get; set; }
    public decimal? TareKg { get; set; }

    /// <summary>Scale reading with the container; null when no tare was subtracted.</summary>
    public decimal? GrossKg { get; set; }
}

public class SaveHarvestInput
{
    public Guid? Id { get; set; }
    public Guid BatchId { get; set; }
    public DateTime HarvestedAt { get; set; }
    public HarvestType HarvestType { get; set; }

    /// <summary>Optional buyer the harvest was for (DEC-81).</summary>
    public Guid? BuyerId { get; set; }

    /// <summary>Optional: whose scale was used (DEC-81).</summary>
    public WeighedBy? WeighedBy { get; set; }

    [Range(0.001, 100000000, ErrorMessage = "Total kg must be greater than zero.")]
    public decimal TotalKg { get; set; }

    [Range(0, 100000)]
    public int? Boxes { get; set; }

    [Range(0.01, 60, ErrorMessage = "Sampled ABW must be between 0.01 and 60 g.")]
    public decimal? AbwG { get; set; }

    /// <summary>Optional ABW sample weight (g); with the piece count it sets the ABW (DEC-80).</summary>
    [Range(0.01, 1000000, ErrorMessage = "The sample weight must be greater than zero.")]
    public decimal? AbwSampleWeightG { get; set; }

    [Range(1, 100000, ErrorMessage = "The sample piece count must be at least 1.")]
    public int? AbwSamplePieces { get; set; }

    [Range(0, 100000000)]
    public long? FinalCount { get; set; }

    [Range(0, 100000000)]
    public long? DeadAtHarvest { get; set; }

    public bool? SmoothShell { get; set; }
    public bool? IntactAppendages { get; set; }
    public bool? NoNecrosis { get; set; }

    [StringLength(Harvest.MaxNotesLength)]
    public string QualityNotes { get; set; }

    public List<GradeLineInput> GradeLines { get; set; } = new();
    public List<DisposalInput> Disposals { get; set; } = new();

    /// <summary>Optional crate tally (DEC-80). When given, TotalKg becomes the crate sum and Boxes the crate count.</summary>
    public List<CrateInput> Crates { get; set; } = new();
}

public class GradeLineDto
{
    public Guid Id { get; set; }
    public Guid SizeGradeId { get; set; }
    public string SizeLabel { get; set; }
    public int? MinCountPerKg { get; set; }
    public int? MaxCountPerKg { get; set; }
    public bool IsUngraded { get; set; }
    public decimal Kg { get; set; }
    public decimal SoldKg { get; set; }
    public decimal UnsoldKg { get; set; }
}

public class DisposalDto
{
    public decimal Kg { get; set; }
    public DisposalReason Reason { get; set; }
    public string Note { get; set; }
}

public class GetHarvestsInput : PagedInput
{
    public Guid? BatchId { get; set; }
    public HarvestType? HarvestType { get; set; }
}

public class HarvestDto
{
    public Guid Id { get; set; }
    public Guid BatchId { get; set; }
    public string BatchCode { get; set; }
    public string PondCode { get; set; }
    public string CycleCode { get; set; }
    public BatchStatus BatchStatus { get; set; }
    public DateTime HarvestedAtUtc { get; set; }
    public HarvestType HarvestType { get; set; }
    public Guid? BuyerId { get; set; }
    public string BuyerName { get; set; }
    public WeighedBy? WeighedBy { get; set; }
    public decimal TotalKg { get; set; }
    public int? Boxes { get; set; }
    public decimal? AbwG { get; set; }
    public decimal? AbwSampleWeightG { get; set; }
    public int? AbwSamplePieces { get; set; }
    public long? FinalCount { get; set; }
    public long? DeadAtHarvest { get; set; }
    public bool? SmoothShell { get; set; }
    public bool? IntactAppendages { get; set; }
    public bool? NoNecrosis { get; set; }
    public string QualityNotes { get; set; }
    public List<GradeLineDto> GradeLines { get; set; } = new();
    public List<DisposalDto> Disposals { get; set; } = new();

    /// <summary>The crate tally in weighing order; empty when only the total was recorded (DEC-80).</summary>
    public List<CrateDto> Crates { get; set; } = new();
    public decimal GradedKg { get; set; }

    /// <summary>Total kg not on any grade line (shown as the ungraded remainder).</summary>
    public decimal UngradedRemainderKg { get; set; }

    public decimal HarvestedPieces { get; set; }
    public decimal SoldKg { get; set; }
    public decimal NotSoldKg { get; set; }

    /// <summary>Kg neither sold nor recorded as not sold (DEC-67).</summary>
    public decimal UnaccountedKg { get; set; }

    public string RecordedBy { get; set; }
    public DateTime CreationTime { get; set; }
    public bool CanEdit { get; set; }

    /// <summary>Set on save: e.g. a harvest before a treatment's safe harvest date (DEC-57).</summary>
    public List<WarningDto> Warnings { get; set; } = new();
}

public class SizeGradeOptionDto
{
    public Guid Id { get; set; }
    public string Label { get; set; }
    public int? MinCountPerKg { get; set; }
    public int? MaxCountPerKg { get; set; }
    public bool IsUngraded { get; set; }
}

/// <summary>
/// Harvests (Ref 7.1, step E): Partial or Total, opened from the batch. The Total harvest marks a Stocked batch Harvested
/// and must be the batch's last harvest. Grade lines use the farm's size grades; sale lines sell from them.
/// Not-sold entries account for harvest kept, given away or lost (DEC-67).
/// </summary>
[AbpAuthorize(PermissionNames.Harvests)]
public class HarvestAppService : CapstoneAppServiceBase
{
    private readonly IRepository<Harvest, Guid> _harvests;
    private readonly IRepository<HarvestGradeLine, Guid> _gradeLines;
    private readonly IRepository<HarvestDisposal, Guid> _disposals;
    private readonly IRepository<HarvestCrate, Guid> _crates;
    private readonly IRepository<ContainerType, Guid> _containerTypes;
    private readonly IRepository<Resources.Buyer, Guid> _buyers;
    private readonly IRepository<SizeGrade, Guid> _grades;
    private readonly IRepository<PondBatch, Guid> _batches;
    private readonly IRepository<SaleLine, Guid> _saleLines;
    private readonly IRepository<Sale, Guid> _sales;
    private readonly TreatmentWithdrawal _withdrawal;

    public HarvestAppService(IRepository<Harvest, Guid> harvests, IRepository<HarvestGradeLine, Guid> gradeLines, IRepository<HarvestDisposal, Guid> disposals,
        IRepository<SizeGrade, Guid> grades, IRepository<PondBatch, Guid> batches, IRepository<SaleLine, Guid> saleLines, IRepository<Sale, Guid> sales,
        TreatmentWithdrawal withdrawal, IRepository<HarvestCrate, Guid> crates, IRepository<ContainerType, Guid> containerTypes,
        IRepository<Resources.Buyer, Guid> buyers)
    {
        _buyers = buyers;
        _crates = crates;
        _containerTypes = containerTypes;
        _harvests = harvests;
        _gradeLines = gradeLines;
        _disposals = disposals;
        _grades = grades;
        _batches = batches;
        _saleLines = saleLines;
        _sales = sales;
        _withdrawal = withdrawal;
    }

    private static readonly string[] HarvestSortKeys = { "harvestedAt", "totalKg", "harvestType" };

    private IQueryable<Harvest> Filtered(GetHarvestsInput input)
    {
        var query = Query()
            .Where(h => !input.BatchId.HasValue || h.BatchId == input.BatchId)
            .Where(h => !input.HarvestType.HasValue || h.HarvestType == input.HarvestType);
        var s = input.Search?.Trim();
        return string.IsNullOrEmpty(s) ? query : query.Where(h => h.Batch.BatchCode.Contains(s) || h.Batch.Pond.PondCode.Contains(s) || h.Batch.Cycle.CycleCode.Contains(s));
    }

    /// <summary>Harvests per type for the toolbar chips: follows the search but not the chosen type.</summary>
    public virtual async Task<List<StatusCountDto>> GetTypeCounts(GetHarvestsInput input)
    {
        input.HarvestType = null;
        return await Filtered(input).GroupBy(h => h.HarvestType).Select(g => new StatusCountDto { Status = (int)g.Key, Count = g.Count() }).ToListAsync();
    }

    /// <summary>One page of harvests (AC-27). Sort keys: harvestedAt (default, newest first), totalKg, harvestType.</summary>
    public virtual async Task<PagedResultDto<HarvestDto>> GetList(GetHarvestsInput input)
    {
        var query = Filtered(input);
        var total = await query.CountAsync();
        var sort = SortSpec.Parse(input.Sorting, HarvestSortKeys, "harvestedAt", true);
        var ordered = sort.Key switch
        {
            "totalKg" => sort.Apply(query, h => h.TotalKg).ThenByDescending(h => h.HarvestedAtUtc),
            "harvestType" => sort.Apply(query, h => h.HarvestType).ThenByDescending(h => h.HarvestedAtUtc),
            _ => sort.Apply(query, h => h.HarvestedAtUtc),
        };
        var harvests = await ordered.Skip(input.SkipCount).Take(input.MaxResultCount).ToListAsync();
        return new PagedResultDto<HarvestDto>(total, await MapAsync(harvests));
    }

    /// <summary>Every harvest matching the filter, newest first. For CSV export only; not exposed as an API.</summary>
    internal async Task<List<HarvestDto>> ListAllAsync(GetHarvestsInput input) =>
        await MapAsync(await Filtered(input).OrderByDescending(h => h.HarvestedAtUtc).ToListAsync());

    public virtual async Task<HarvestDto> Get(Guid id)
    {
        var h = await Query().FirstOrDefaultAsync(x => x.Id == id) ?? throw new UserFriendlyException("Harvest not found.");
        return (await MapAsync(new List<Harvest> { h })).Single();
    }

    /// <summary>Active size grades for the harvest form (the "Ungraded / mixed" grade last).</summary>
    public virtual async Task<List<SizeGradeOptionDto>> GetGradeOptions()
    {
        var grades = await _grades.GetAll().AsNoTracking().Where(g => g.IsActive).ToListAsync();
        return grades.OrderBy(g => g.IsUngraded).ThenBy(g => g.SortOrder).ThenBy(g => g.MinCountPerKg)
            .Select(g => new SizeGradeOptionDto { Id = g.Id, Label = g.Label, MinCountPerKg = g.MinCountPerKg, MaxCountPerKg = g.MaxCountPerKg, IsUngraded = g.IsUngraded })
            .ToList();
    }

    [AbpAuthorize(PermissionNames.Harvests_Create)]
    public virtual async Task<HarvestDto> Create(SaveHarvestInput input)
    {
        var batch = await _batches.FirstOrDefaultAsync(b => b.Id == input.BatchId) ?? throw new UserFriendlyException("Batch not found.");
        batch.EnsureNotClosed();
        if (batch.Status is not (BatchStatus.Stocked or BatchStatus.Failed))
        {
            throw new UserFriendlyException($"This batch is {batch.Status}; its Total harvest is already recorded.");
        }

        var harvest = new Harvest { Id = Guid.NewGuid(), BatchId = batch.Id };
        var warnings = await ApplyAsync(harvest, batch, input, isNew: true);
        await _harvests.InsertAsync(harvest);
        await CurrentUnitOfWork.SaveChangesAsync();
        return await WithWarningsAsync(await Get(harvest.Id), warnings);
    }

    /// <summary>Corrections while the batch is not Closed (D-20). Technicians edit only their own harvests.</summary>
    [AbpAuthorize(PermissionNames.Harvests_Create)]
    public virtual async Task<HarvestDto> Update(SaveHarvestInput input)
    {
        if (!input.Id.HasValue)
        {
            throw new UserFriendlyException("Harvest id is required.");
        }

        var harvest = await _harvests.GetAll().Include(h => h.GradeLines).Include(h => h.Disposals).Include(h => h.Crates).FirstOrDefaultAsync(h => h.Id == input.Id.Value)
                      ?? throw new UserFriendlyException("Harvest not found.");
        var batch = await _batches.GetAsync(harvest.BatchId);
        batch.EnsureNotClosed();
        if (harvest.CreatorUserId != AbpSession.UserId && !await IsGrantedAsync(PermissionNames.Harvests_EditAny))
        {
            throw new AbpAuthorizationException("You can only edit harvests you recorded.");
        }

        if (input.BatchId != Guid.Empty && input.BatchId != harvest.BatchId)
        {
            throw new UserFriendlyException("A harvest cannot move to another batch.");
        }

        var warnings = await ApplyAsync(harvest, batch, input, isNew: false);
        await CurrentUnitOfWork.SaveChangesAsync();
        return await WithWarningsAsync(await Get(harvest.Id), warnings);
    }

    private IQueryable<Harvest> Query() => _harvests.GetAll().AsNoTracking()
        .Include(h => h.GradeLines).ThenInclude(g => g.SizeGrade)
        .Include(h => h.Disposals)
        .Include(h => h.Crates)
        .Include(h => h.Buyer)
        .Include(h => h.Batch).ThenInclude(b => b.Pond)
        .Include(h => h.Batch).ThenInclude(b => b.Cycle);

    private async Task<List<WarningDto>> ApplyAsync(Harvest harvest, PondBatch batch, SaveHarvestInput input, bool isNew)
    {
        var warnings = new List<WarningDto>();
        if (!Enum.IsDefined(input.HarvestType))
        {
            throw new UserFriendlyException("Choose Partial or Total harvest.");
        }

        var zone = await Farm.GetTimeZoneAsync();
        var at = FarmClock.ToUtc(input.HarvestedAt);
        if (at > DateTime.UtcNow.AddMinutes(5))
        {
            throw new UserFriendlyException("The harvest time cannot be in the future.");
        }

        var day = FarmClock.LocalDate(at, zone);
        if (batch.StockingDate.HasValue && day < batch.StockingDate.Value)
        {
            throw new UserFriendlyException($"The harvest date cannot be before the stocking date ({batch.StockingDate:yyyy-MM-dd}).");
        }

        // One Total harvest per batch, and it is the batch's last harvest (DEC-51).
        var others = await _harvests.GetAll().AsNoTracking().Where(h => h.BatchId == batch.Id && h.Id != harvest.Id)
            .Select(h => new { h.HarvestType, h.HarvestedAtUtc }).ToListAsync();
        var otherTotal = others.FirstOrDefault(o => o.HarvestType == HarvestType.Total);
        if (input.HarvestType == HarvestType.Total && otherTotal != null)
        {
            throw new UserFriendlyException("This batch already has its Total harvest. Record this one as Partial or correct the Total harvest.");
        }

        if (otherTotal != null && day > FarmClock.LocalDate(otherTotal.HarvestedAtUtc, zone))
        {
            throw new UserFriendlyException($"The batch had its Total harvest on {FarmClock.LocalDate(otherTotal.HarvestedAtUtc, zone):yyyy-MM-dd}; a harvest cannot be dated after it.");
        }

        if (input.HarvestType == HarvestType.Total && others.Any(o => FarmClock.LocalDate(o.HarvestedAtUtc, zone) > day))
        {
            throw new UserFriendlyException("The Total harvest must be the batch's last harvest; a partial harvest is dated after it.");
        }

        // Buyer the harvest was for (DEC-81): this farm's; a new choice must be active.
        if (input.BuyerId.HasValue)
        {
            var buyer = await _buyers.FirstOrDefaultAsync(b => b.Id == input.BuyerId.Value) ?? throw new UserFriendlyException("Choose a buyer of this farm.");
            if (!buyer.IsActive && buyer.Id != harvest.BuyerId)
            {
                throw new UserFriendlyException("The selected buyer is inactive.");
            }
        }

        if (input.WeighedBy.HasValue && !Enum.IsDefined(input.WeighedBy.Value))
        {
            throw new UserFriendlyException("Choose whose scale was used.");
        }

        // Crate tally (DEC-80): when weighed crate by crate, the total is their sum and the box count their number.
        var crates = input.Crates ?? new List<CrateInput>();
        if (crates.Count > HarvestCrate.MaxCrates)
        {
            throw new UserFriendlyException($"A harvest can have at most {HarvestCrate.MaxCrates} crates.");
        }

        if (crates.Any(c => c.Kg <= 0))
        {
            throw new UserFriendlyException("Each crate must weigh more than zero kg.");
        }

        // Container types (DEC-80): a crate weighed with its container has the empty weight subtracted.
        var typeIds = crates.Where(c => c.ContainerTypeId.HasValue).Select(c => c.ContainerTypeId.Value).Distinct().ToList();
        var types = await _containerTypes.GetAll().AsNoTracking().Where(t => typeIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id);
        if (types.Count != typeIds.Count)
        {
            throw new UserFriendlyException("Choose a crate type of this farm, or none, for every crate.");
        }

        var tally = new List<HarvestCrate>();
        for (var i = 0; i < crates.Count; i++)
        {
            var c = crates[i];
            var type = c.ContainerTypeId.HasValue ? types[c.ContainerTypeId.Value] : null;
            var tare = c.TareKg ?? type?.TareKg;
            tare = tare > 0 ? tare : null;
            var net = c.Kg - (tare ?? 0m);
            if (net <= 0)
            {
                throw new UserFriendlyException($"Crate {i + 1}: {c.Kg:0.###} kg is not more than the empty crate ({type?.Name ?? "Crate"}, {tare:0.###} kg).");
            }

            tally.Add(new HarvestCrate
            {
                CrateNo = i + 1, Kg = net, SizeGradeId = c.SizeGradeId, ContainerTypeId = type?.Id, ContainerName = type?.Name, TareKg = tare, GrossKg = tare.HasValue ? c.Kg : null,
            });
        }

        if (crates.Count > 0)
        {
            input.TotalKg = tally.Sum(c => c.Kg);
            input.Boxes = crates.Count;
        }

        // Graded crates (DEC-82): the grade lines are the crates' sums per grade; ungraded crates go to "Ungraded / mixed".
        if (tally.Any(c => c.SizeGradeId.HasValue))
        {
            var crateGradeIds = tally.Where(c => c.SizeGradeId.HasValue).Select(c => c.SizeGradeId.Value).Distinct().ToList();
            if (await _grades.GetAll().CountAsync(g => crateGradeIds.Contains(g.Id)) != crateGradeIds.Count)
            {
                throw new UserFriendlyException("Choose a size grade of this farm for every graded crate.");
            }

            Guid? ungradedId = null;
            if (tally.Any(c => !c.SizeGradeId.HasValue))
            {
                ungradedId = await _grades.GetAll().Where(g => g.MinCountPerKg == null && g.MaxCountPerKg == null).OrderByDescending(g => g.IsActive)
                                 .Select(g => (Guid?)g.Id).FirstOrDefaultAsync()
                             ?? throw new UserFriendlyException($"Some crates have no size grade. Grade every crate, or add the \"{SizeGrade.UngradedLabel}\" grade.");
            }

            input.GradeLines = tally.GroupBy(c => c.SizeGradeId ?? ungradedId.Value)
                .Select(g => new GradeLineInput { SizeGradeId = g.Key, Kg = g.Sum(c => c.Kg) }).ToList();
        }

        // ABW sample (DEC-80): both fields or neither; together they set the ABW.
        if (input.AbwSampleWeightG.HasValue != input.AbwSamplePieces.HasValue)
        {
            throw new UserFriendlyException("Enter both the sample weight and the number of pieces, or leave both empty.");
        }

        if (input.AbwSampleWeightG.HasValue)
        {
            var abw = Harvest.AbwFromSample(input.AbwSampleWeightG.Value, input.AbwSamplePieces.Value);
            if (abw < 0.01m || abw > 60m)
            {
                throw new UserFriendlyException($"The sample gives an ABW of {abw:0.##} g; it must be between 0.01 and 60 g. Check the weight (in grams) and the piece count.");
            }

            input.AbwG = abw;
        }

        if (input.FinalCount.HasValue && batch.PlCountStocked.HasValue && input.FinalCount.Value > batch.PlCountStocked.Value)
        {
            throw new UserFriendlyException($"The final count cannot be more than the stocking count ({batch.PlCountStocked:N0}).");
        }

        // Grade lines: one per grade, Σ kg ≤ total, and not below what is already sold from them.
        var lines = input.GradeLines ?? new List<GradeLineInput>();
        if (lines.GroupBy(l => l.SizeGradeId).Any(g => g.Count() > 1))
        {
            throw new UserFriendlyException("Each size grade can appear only once in a harvest.");
        }

        var gradeIds = lines.Select(l => l.SizeGradeId).ToList();
        var grades = await _grades.GetAll().Where(g => gradeIds.Contains(g.Id)).ToListAsync();
        if (grades.Count != gradeIds.Count)
        {
            throw new UserFriendlyException("Choose a size grade of this farm for every grade line.");
        }

        var gradedKg = lines.Sum(l => l.Kg);
        if (gradedKg > input.TotalKg)
        {
            throw new UserFriendlyException($"Grade lines total {gradedKg:0.###} kg, which is more than the harvest total of {input.TotalKg:0.###} kg.");
        }

        var soldByLine = isNew ? new Dictionary<Guid, decimal>() : await SoldByGradeLineAsync(harvest.GradeLines.Select(g => g.Id).ToList());
        foreach (var existing in harvest.GradeLines)
        {
            var sold = soldByLine.TryGetValue(existing.Id, out var s) ? s : 0m;
            var replacement = lines.FirstOrDefault(l => l.SizeGradeId == existing.SizeGradeId);
            if (sold > 0 && (replacement == null || replacement.Kg < sold))
            {
                var label = (await _grades.GetAsync(existing.SizeGradeId)).Label;
                throw new UserFriendlyException($"{sold:0.###} kg of grade {label} is already sold; that grade line cannot be removed or go below it.");
            }
        }

        // Not-sold entries: Σ sold + Σ not sold ≤ total (DEC-67).
        var disposals = input.Disposals ?? new List<DisposalInput>();
        if (disposals.Any(d => !Enum.IsDefined(d.Reason)))
        {
            throw new UserFriendlyException("Choose a reason for each not-sold entry.");
        }

        var soldTotal = soldByLine.Values.Sum();
        var notSold = disposals.Sum(d => d.Kg);
        if (soldTotal + notSold > input.TotalKg)
        {
            throw new UserFriendlyException($"Sold {soldTotal:0.###} kg + not sold {notSold:0.###} kg is more than the harvest total of {input.TotalKg:0.###} kg.");
        }

        var wasTotal = !isNew && harvest.HarvestType == HarvestType.Total;
        harvest.HarvestedAtUtc = at;
        harvest.HarvestType = input.HarvestType;
        harvest.BuyerId = input.BuyerId;
        harvest.WeighedBy = input.WeighedBy;
        harvest.TotalKg = input.TotalKg;
        harvest.Boxes = input.Boxes;
        harvest.AbwG = input.AbwG;
        harvest.AbwSampleWeightG = input.AbwSampleWeightG;
        harvest.AbwSamplePieces = input.AbwSamplePieces;
        harvest.FinalCount = input.FinalCount;
        harvest.DeadAtHarvest = input.DeadAtHarvest;
        harvest.SmoothShell = input.SmoothShell;
        harvest.IntactAppendages = input.IntactAppendages;
        harvest.NoNecrosis = input.NoNecrosis;
        harvest.QualityNotes = string.IsNullOrWhiteSpace(input.QualityNotes) ? null : input.QualityNotes.Trim();

        // Grade lines are updated in place so sale lines keep pointing at them.
        foreach (var existing in harvest.GradeLines.ToList())
        {
            var replacement = lines.FirstOrDefault(l => l.SizeGradeId == existing.SizeGradeId);
            if (replacement == null)
            {
                harvest.GradeLines.Remove(existing);
                await _gradeLines.DeleteAsync(existing);
            }
            else
            {
                existing.Kg = replacement.Kg;
            }
        }

        foreach (var l in lines.Where(l => harvest.GradeLines.All(g => g.SizeGradeId != l.SizeGradeId)))
        {
            harvest.GradeLines.Add(new HarvestGradeLine { HarvestId = harvest.Id, SizeGradeId = l.SizeGradeId, Kg = l.Kg });
        }

        foreach (var d in harvest.Disposals.ToList())
        {
            harvest.Disposals.Remove(d);
            await _disposals.DeleteAsync(d);
        }

        foreach (var d in disposals)
        {
            harvest.Disposals.Add(new HarvestDisposal { HarvestId = harvest.Id, Kg = d.Kg, Reason = d.Reason, Note = string.IsNullOrWhiteSpace(d.Note) ? null : d.Note.Trim() });
        }

        foreach (var c in harvest.Crates.ToList())
        {
            harvest.Crates.Remove(c);
            await _crates.DeleteAsync(c);
        }

        // New child rows get no Id here: EF Core treats a row with a key already set as existing and would update it.
        foreach (var c in tally)
        {
            c.HarvestId = harvest.Id;
            harvest.Crates.Add(c);
        }

        // The Total harvest marks a Stocked batch Harvested; a Failed batch stays Failed (salvage).
        if (input.HarvestType == HarvestType.Total && batch.Status == BatchStatus.Stocked)
        {
            batch.Status = BatchStatus.Harvested;
        }
        else if (wasTotal && input.HarvestType != HarvestType.Total && batch.Status == BatchStatus.Harvested)
        {
            batch.Status = BatchStatus.Stocked;
        }

        if (gradedKg > 0 && gradedKg < input.TotalKg)
        {
            warnings.Add(new WarningDto { Kind = "Grades", Message = $"{input.TotalKg - gradedKg:0.###} kg is not on any grade line. Add it as \"{SizeGrade.UngradedLabel}\" to sell it." });
        }

        return warnings;
    }

    /// <summary>DEC-57 withdrawal check and the dead-at-harvest check, after the harvest is saved.</summary>
    private async Task<HarvestDto> WithWarningsAsync(HarvestDto dto, List<WarningDto> warnings)
    {
        dto.Warnings.AddRange(warnings);
        var zone = await Farm.GetTimeZoneAsync();
        var safe = await _withdrawal.EarliestSafeHarvestDateAsync(dto.BatchId, zone);
        var day = FarmClock.LocalDate(dto.HarvestedAtUtc, zone);
        if (safe.HasValue && day < safe.Value)
        {
            dto.Warnings.Add(new WarningDto
            {
                Kind = "Withdrawal",
                Message = $"This harvest ({day:yyyy-MM-dd}) is before the earliest safe harvest date ({safe:yyyy-MM-dd}) from a treatment's withdrawal period. Check before selling the shrimp for food.",
            });
        }

        if (dto.DeadAtHarvest.HasValue && dto.HarvestedPieces > 0 && dto.DeadAtHarvest.Value > dto.HarvestedPieces)
        {
            dto.Warnings.Add(new WarningDto { Kind = "DeadAtHarvest", Message = $"Dead at harvest ({dto.DeadAtHarvest:N0}) is more than the harvested pieces ({dto.HarvestedPieces:N0}). Check both numbers." });
        }

        return dto;
    }

    internal async Task<Dictionary<Guid, decimal>> SoldByGradeLineAsync(List<Guid> gradeLineIds)
    {
        return await (from l in _saleLines.GetAll()
                      join s in _sales.GetAll() on l.SaleId equals s.Id
                      where gradeLineIds.Contains(l.HarvestGradeLineId)
                      group l by l.HarvestGradeLineId into g
                      select new { g.Key, Kg = g.Sum(x => x.Kg) }).ToDictionaryAsync(x => x.Key, x => x.Kg);
    }

    private async Task<List<HarvestDto>> MapAsync(List<Harvest> harvests)
    {
        var zone = await Farm.GetTimeZoneAsync();
        var sold = await SoldByGradeLineAsync(harvests.SelectMany(h => h.GradeLines).Select(g => g.Id).ToList());
        var names = await GetUserNamesAsync(harvests.Select(h => h.CreatorUserId));
        var canEditAny = await IsGrantedAsync(PermissionNames.Harvests_EditAny);
        var canCreate = await IsGrantedAsync(PermissionNames.Harvests_Create);
        return harvests.Select(h =>
        {
            var lines = h.GradeLines
                .OrderBy(g => g.SizeGrade?.IsUngraded == true).ThenBy(g => g.SizeGrade?.MinCountPerKg)
                .Select(g =>
                {
                    var s = sold.TryGetValue(g.Id, out var kg) ? kg : 0m;
                    return new GradeLineDto
                    {
                        Id = g.Id, SizeGradeId = g.SizeGradeId, SizeLabel = g.SizeGrade?.Label, MinCountPerKg = g.SizeGrade?.MinCountPerKg, MaxCountPerKg = g.SizeGrade?.MaxCountPerKg,
                        IsUngraded = g.SizeGrade?.IsUngraded ?? false, Kg = g.Kg, SoldKg = s, UnsoldKg = g.Kg - s,
                    };
                }).ToList();
            var soldKg = lines.Sum(l => l.SoldKg);
            var notSold = h.Disposals.Sum(d => d.Kg);
            var graded = lines.Sum(l => l.Kg);
            return new HarvestDto
            {
                Id = h.Id, BatchId = h.BatchId, BatchCode = h.Batch?.BatchCode, PondCode = h.Batch?.Pond?.PondCode, CycleCode = h.Batch?.Cycle?.CycleCode,
                BatchStatus = h.Batch?.Status ?? BatchStatus.Stocked, HarvestedAtUtc = h.HarvestedAtUtc, HarvestType = h.HarvestType, TotalKg = h.TotalKg,
                BuyerId = h.BuyerId, BuyerName = h.Buyer?.Name, WeighedBy = h.WeighedBy,
                Boxes = h.Boxes, AbwG = h.AbwG, AbwSampleWeightG = h.AbwSampleWeightG, AbwSamplePieces = h.AbwSamplePieces, FinalCount = h.FinalCount, DeadAtHarvest = h.DeadAtHarvest,
                SmoothShell = h.SmoothShell, IntactAppendages = h.IntactAppendages, NoNecrosis = h.NoNecrosis, QualityNotes = h.QualityNotes,
                GradeLines = lines,
                Disposals = h.Disposals.OrderBy(d => d.Reason).Select(d => new DisposalDto { Kg = d.Kg, Reason = d.Reason, Note = d.Note }).ToList(),
                Crates = h.Crates.OrderBy(c => c.CrateNo)
                    .Select(c => new CrateDto
                    {
                        CrateNo = c.CrateNo, Kg = c.Kg, SizeGradeId = c.SizeGradeId,
                        SizeLabel = c.SizeGradeId.HasValue ? h.GradeLines.FirstOrDefault(g => g.SizeGradeId == c.SizeGradeId)?.SizeGrade?.Label : null,
                        ContainerTypeId = c.ContainerTypeId, ContainerName = c.ContainerName, TareKg = c.TareKg, GrossKg = c.GrossKg,
                    })
                    .ToList(),
                GradedKg = graded, UngradedRemainderKg = Math.Max(0, h.TotalKg - graded),
                HarvestedPieces = Math.Round(IndicatorCalculator.HarvestedPieces(HarvestFact.From(h, FarmClock.LocalDate(h.HarvestedAtUtc, zone)), null), 0),
                SoldKg = soldKg, NotSoldKg = notSold, UnaccountedKg = Math.Max(0, h.TotalKg - soldKg - notSold),
                RecordedBy = NameOf(names, h.CreatorUserId), CreationTime = h.CreationTime,
                CanEdit = canCreate && h.Batch?.Status != BatchStatus.Closed && (canEditAny || h.CreatorUserId == AbpSession.UserId),
            };
        }).ToList();
    }
}
