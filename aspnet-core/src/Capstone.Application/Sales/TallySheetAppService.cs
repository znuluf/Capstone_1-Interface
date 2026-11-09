using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.UI;
using Capstone.Authorization;
using Capstone.Common;
using Capstone.Domain;
using Capstone.Harvests;
using Capstone.Production.Dto;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Sales;

/// <summary>The sale half of a tally sheet: one price for every grade line of the harvest (DEC-81).</summary>
public class TallySaleInput
{
    /// <summary>Empty = the harvest's date.</summary>
    public DateOnly? SaleDate { get; set; }

    [StringLength(Sale.MaxTextLength)]
    public string PaymentTerms { get; set; }

    public DateOnly? DueDate { get; set; }

    [Range(0, 100000000, ErrorMessage = "Price per kg cannot be negative.")]
    public decimal PricePerKg { get; set; }

    public PriceMethod PriceMethod { get; set; } = PriceMethod.Fixed;

    [Range(0, 100000000, ErrorMessage = "The base price cannot be negative.")]
    public decimal? BasePricePerKg { get; set; }

    [Range(0.01, 60, ErrorMessage = "The base ABW must be between 0.01 and 60 g.")]
    public decimal? BaseAbwG { get; set; }

    [Range(0, 1000000, ErrorMessage = "The step per gram cannot be negative.")]
    public decimal? StepPerG { get; set; }

    [Range(0.01, 60, ErrorMessage = "The pricing ABW must be between 0.01 and 60 g.")]
    public decimal? PriceAbwG { get; set; }

    public PaymentInput InitialPayment { get; set; }
}

public class SaveTallySheetInput
{
    [Required]
    public SaveHarvestInput Harvest { get; set; }

    [Required]
    public TallySaleInput Sale { get; set; }
}

public class TallySheetResultDto
{
    public HarvestDto Harvest { get; set; }
    public SaleDto Sale { get; set; }
    public List<WarningDto> Warnings { get; set; } = new();
}

/// <summary>What a buyer usually decides, learned from their last harvest and sale (DEC-81). Every value is a suggestion.</summary>
public class BuyerHarvestDefaultsDto
{
    /// <summary>The crate type used most on the buyer's last harvest; null when none.</summary>
    public Guid? ContainerTypeId { get; set; }

    public WeighedBy? WeighedBy { get; set; }
    public string PaymentTerms { get; set; }

    /// <summary>The buyer's last base-ABW terms; null when none or when the user cannot see sales.</summary>
    public BuyerPriceTermsDto PriceTerms { get; set; }
}

/// <summary>
/// Tally sheet entry (DEC-81): the common case of one buyer per harvest, recorded once like the paper sheet. One save
/// creates the harvest and its sale in one unit of work; after that they are ordinary records, edited separately. A
/// harvest split between buyers, kept or graded at different prices uses the separate Harvest and Sale screens.
/// </summary>
[AbpAuthorize(PermissionNames.Harvests)]
public class TallySheetAppService : CapstoneAppServiceBase
{
    private readonly HarvestAppService _harvestService;
    private readonly SaleAppService _saleService;
    private readonly IRepository<Harvest, Guid> _harvests;
    private readonly IRepository<Sale, Guid> _sales;
    private readonly IRepository<Resources.Buyer, Guid> _buyers;

    public TallySheetAppService(HarvestAppService harvestService, SaleAppService saleService, IRepository<Harvest, Guid> harvests, IRepository<Sale, Guid> sales,
        IRepository<Resources.Buyer, Guid> buyers)
    {
        _buyers = buyers;
        _harvestService = harvestService;
        _saleService = saleService;
        _harvests = harvests;
        _sales = sales;
    }

    /// <summary>
    /// Buyers for the harvest form's "Name of Customer": anyone who records harvests can pick one, without the Buyers
    /// permission. Inactive buyers are included so an older harvest still shows its buyer.
    /// </summary>
    public virtual async Task<List<LookupDto>> GetBuyerOptions()
    {
        return await _buyers.GetAll().AsNoTracking().OrderBy(b => b.Name)
            .Select(b => new LookupDto { Id = b.Id, Name = b.Name, IsActive = b.IsActive }).ToListAsync();
    }

    /// <summary>Suggestions for a harvest for this buyer: crate type, whose scale, payment and price terms.</summary>
    public virtual async Task<BuyerHarvestDefaultsDto> GetBuyerDefaults(Guid buyerId)
    {
        var dto = new BuyerHarvestDefaultsDto();
        var last = await _harvests.GetAll().AsNoTracking().Include(h => h.Crates)
            .Where(h => h.BuyerId == buyerId).OrderByDescending(h => h.HarvestedAtUtc).FirstOrDefaultAsync();
        if (last != null)
        {
            dto.WeighedBy = last.WeighedBy;
            dto.ContainerTypeId = last.Crates.Where(c => c.ContainerTypeId.HasValue).GroupBy(c => c.ContainerTypeId)
                .OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault();
        }

        if (await IsGrantedAsync(PermissionNames.Sales))
        {
            dto.PaymentTerms = await _sales.GetAll().AsNoTracking().Where(s => s.BuyerId == buyerId && s.PaymentTerms != null)
                .OrderByDescending(s => s.SaleDate).ThenByDescending(s => s.CreationTime).Select(s => s.PaymentTerms).FirstOrDefaultAsync();
            dto.PriceTerms = await _saleService.GetBuyerPriceTerms(buyerId);
        }

        return dto;
    }

    /// <summary>Saves the harvest and its sale together; if the sale cannot be saved, neither is.</summary>
    [AbpAuthorize(PermissionNames.Harvests_Create, PermissionNames.Sales, RequireAllPermissions = true)]
    public virtual async Task<TallySheetResultDto> Save(SaveTallySheetInput input)
    {
        var h = input.Harvest;
        var s = input.Sale;
        if (h.Id.HasValue)
        {
            throw new UserFriendlyException("A tally sheet records a new harvest. Edit a saved harvest and its sale on their own pages.");
        }

        if (!h.BuyerId.HasValue)
        {
            throw new UserFriendlyException("Choose the buyer (Name of Customer).");
        }

        if (h.GradeLines == null || h.GradeLines.Count == 0)
        {
            throw new UserFriendlyException($"Put the harvest kg on a grade line (for example \"{SizeGrade.UngradedLabel}\") to sell it.");
        }

        // Checked before anything is saved, so a bad price does not leave a harvest without its sale.
        if (!Enum.IsDefined(s.PriceMethod))
        {
            throw new UserFriendlyException("Choose how the price was agreed.");
        }

        if (s.PriceMethod == PriceMethod.BaseAbw && (!s.BasePricePerKg.HasValue || !s.BaseAbwG.HasValue || !s.StepPerG.HasValue))
        {
            throw new UserFriendlyException("Enter the base price, the base ABW and the step per gram.");
        }

        if (s.PriceMethod == PriceMethod.BaseAbw && !s.PriceAbwG.HasValue && !h.AbwG.HasValue && !h.AbwSampleWeightG.HasValue)
        {
            throw new UserFriendlyException("Enter the ABW sample or the ABW the price is based on.");
        }

        var harvest = await _harvestService.Create(h);
        var zone = await Farm.GetTimeZoneAsync();
        var saleDate = s.SaleDate ?? FarmClock.LocalDate(harvest.HarvestedAtUtc, zone);
        var byAbw = s.PriceMethod == PriceMethod.BaseAbw;
        var sale = await _saleService.Create(new SaveSaleInput
        {
            BuyerId = h.BuyerId.Value, SaleDate = saleDate, PaymentTerms = s.PaymentTerms, DueDate = s.DueDate, InitialPayment = s.InitialPayment,
            Lines = harvest.GradeLines.Where(g => g.UnsoldKg > 0).Select(g => new SaleLineInput
            {
                HarvestGradeLineId = g.Id, Kg = g.UnsoldKg, PricePerKg = s.PricePerKg, PriceMethod = s.PriceMethod,
                BasePricePerKg = byAbw ? s.BasePricePerKg : null, BaseAbwG = byAbw ? s.BaseAbwG : null, StepPerG = byAbw ? s.StepPerG : null,
                PriceAbwG = byAbw ? s.PriceAbwG : null,
            }).ToList(),
        });

        var saved = await _harvestService.Get(harvest.Id);
        return new TallySheetResultDto
        {
            Harvest = saved, Sale = sale,
            Warnings = harvest.Warnings.Concat(sale.Warnings).GroupBy(w => w.Message).Select(g => g.First()).ToList(),
        };
    }
}
