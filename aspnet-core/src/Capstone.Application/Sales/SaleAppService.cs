using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.UI;
using Capstone.Authorization;
using Capstone.Common;
using Capstone.Production.Dto;
using Capstone.Compliance;
using Capstone.Domain;
using Capstone.Harvests;
using Capstone.Production;
using Capstone.ReferenceData;
using Capstone.Resources;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Sales;

/// <summary>A page of sales plus the totals of every sale that matches the filter.</summary>
public class SalePageDto : PagedResultDto<SaleDto>
{
    public decimal TotalKg { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalBalance { get; set; }
    public int OverdueCount { get; set; }
}

public class SaleLineInput
{
    public Guid HarvestGradeLineId { get; set; }

    [Range(0.001, 100000000, ErrorMessage = "Kg must be greater than zero.")]
    public decimal Kg { get; set; }

    [Range(0, 100000000, ErrorMessage = "The buyer's accepted kg cannot be negative.")]
    public decimal? BuyerAcceptedKg { get; set; }

    [Range(0, 100000000, ErrorMessage = "Price per kg cannot be negative.")]
    public decimal PricePerKg { get; set; }

    /// <summary>Fixed (default) or BaseAbw (DEC-80). With BaseAbw the three terms are required.</summary>
    public PriceMethod PriceMethod { get; set; } = PriceMethod.Fixed;

    [Range(0, 100000000, ErrorMessage = "The base price cannot be negative.")]
    public decimal? BasePricePerKg { get; set; }

    [Range(0.01, 60, ErrorMessage = "The base ABW must be between 0.01 and 60 g.")]
    public decimal? BaseAbwG { get; set; }

    [Range(0, 1000000, ErrorMessage = "The step per gram cannot be negative.")]
    public decimal? StepPerG { get; set; }

    /// <summary>The ABW the price uses; empty takes the harvest's sampled ABW.</summary>
    [Range(0.01, 60, ErrorMessage = "The pricing ABW must be between 0.01 and 60 g.")]
    public decimal? PriceAbwG { get; set; }

    /// <summary>BaseCount (DEC-82): the count the base price is for, and the amount per piece below it.</summary>
    [Range(1, 10000, ErrorMessage = "The base count must be at least 1 piece per kg.")]
    public decimal? BaseCountPerKg { get; set; }

    [Range(0, 1000000, ErrorMessage = "The step per piece cannot be negative.")]
    public decimal? StepPerCount { get; set; }

    /// <summary>BaseCount and Table: the shrimp's count; empty takes the grade's middle count, else 1000 ÷ the harvest ABW.</summary>
    [Range(1, 10000, ErrorMessage = "The count must be at least 1 piece per kg.")]
    public decimal? PriceCountPerKg { get; set; }

    /// <summary>Table (DEC-82): the price table to read the price from.</summary>
    public Guid? PriceTableId { get; set; }
}

/// <summary>
/// A buyer's pricing from their latest priced (non-fixed) sale line, to prefill a new sale (DEC-80, DEC-82); when there is
/// none, the buyer's active price table. Only the fields of the method are set.
/// </summary>
public class BuyerPriceTermsDto
{
    public PriceMethod PriceMethod { get; set; } = PriceMethod.BaseAbw;
    public decimal? BasePricePerKg { get; set; }
    public decimal? BaseAbwG { get; set; }
    public decimal? StepPerG { get; set; }
    public decimal? BaseCountPerKg { get; set; }
    public decimal? StepPerCount { get; set; }
    public Guid? PriceTableId { get; set; }
    public DateOnly? FromSaleDate { get; set; }
    public string FromDispatchReceiptNo { get; set; }
}

public class PaymentInput
{
    public DateOnly PaidOn { get; set; }

    [Range(0.01, 1000000000, ErrorMessage = "A payment must be greater than zero.")]
    public decimal Amount { get; set; }

    [StringLength(50)]
    public string Method { get; set; }

    [StringLength(SalePayment.MaxTextLength)]
    public string Note { get; set; }
}

public class AddPaymentInput : PaymentInput
{
    public Guid SaleId { get; set; }
}

public class SaveSaleInput
{
    public Guid? Id { get; set; }
    public Guid BuyerId { get; set; }
    public DateOnly SaleDate { get; set; }

    [StringLength(Sale.MaxTextLength)]
    public string PaymentTerms { get; set; }

    public DateOnly? DueDate { get; set; }

    [StringLength(Sale.MaxShortLength)]
    public string Transporter { get; set; }

    [StringLength(Sale.MaxShortLength)]
    public string DriverName { get; set; }

    [StringLength(20)]
    public string PlateNo { get; set; }

    public DateTime? LoadedAt { get; set; }

    [StringLength(Sale.MaxTextLength)]
    public string Destination { get; set; }

    [StringLength(Sale.MaxShortLength)]
    public string LocalTransportPermitNo { get; set; }

    [StringLength(Sale.MaxTextLength)]
    public string TemperatureNote { get; set; }

    public List<SaleLineInput> Lines { get; set; } = new();

    /// <summary>Create only: a payment received with the sale.</summary>
    public PaymentInput InitialPayment { get; set; }
}

public class VoidSaleInput
{
    public Guid Id { get; set; }

    [Required, StringLength(Sale.MaxTextLength)]
    public string Reason { get; set; }
}

public class SaleLineDto
{
    public Guid Id { get; set; }
    public Guid HarvestGradeLineId { get; set; }
    public Guid HarvestId { get; set; }
    public DateTime HarvestedAtUtc { get; set; }
    public Guid BatchId { get; set; }
    public string BatchCode { get; set; }
    public string PondCode { get; set; }
    public string CycleCode { get; set; }
    public string SizeLabel { get; set; }
    public decimal Kg { get; set; }
    public decimal? BuyerAcceptedKg { get; set; }

    /// <summary>Buyer kg − farm kg, when the buyer re-weighed.</summary>
    public decimal? WeightDifferenceKg { get; set; }

    public decimal PricePerKg { get; set; }
    public decimal Amount { get; set; }

    public PriceMethod PriceMethod { get; set; }
    public decimal? BasePricePerKg { get; set; }
    public decimal? BaseAbwG { get; set; }
    public decimal? StepPerG { get; set; }
    public decimal? PriceAbwG { get; set; }

    public decimal? BaseCountPerKg { get; set; }
    public decimal? StepPerCount { get; set; }
    public decimal? PriceCountPerKg { get; set; }
    public Guid? PriceTableId { get; set; }
    public string PriceTableName { get; set; }
    public string PriceTableRowLabel { get; set; }

    /// <summary>The price the method gave when saved; differs from PricePerKg only when the price was overridden (DEC-80, DEC-82).</summary>
    public decimal? FormulaPricePerKg { get; set; }
}

public class SalePaymentDto
{
    public Guid Id { get; set; }
    public DateOnly PaidOn { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; }
    public string Note { get; set; }
    public string RecordedBy { get; set; }
}

public class SaleDto
{
    public Guid Id { get; set; }
    public string DispatchReceiptNo { get; set; }
    public Guid BuyerId { get; set; }
    public string BuyerName { get; set; }
    public string BuyerContact { get; set; }
    public string BuyerPhone { get; set; }
    public string BuyerAddress { get; set; }
    public DateOnly SaleDate { get; set; }
    public string PaymentTerms { get; set; }
    public DateOnly? DueDate { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public bool IsOverdue { get; set; }
    public decimal Total { get; set; }
    public decimal Paid { get; set; }
    public decimal Balance { get; set; }

    /// <summary>Paid more than the total (shown, not blocked).</summary>
    public decimal Overpaid { get; set; }

    public decimal TotalKg { get; set; }
    public decimal? TotalBuyerKg { get; set; }
    public string Transporter { get; set; }
    public string DriverName { get; set; }
    public string PlateNo { get; set; }
    public DateTime? LoadedAtUtc { get; set; }
    public string Destination { get; set; }
    public string LocalTransportPermitNo { get; set; }
    public string TemperatureNote { get; set; }
    public List<SaleLineDto> Lines { get; set; } = new();
    public List<SalePaymentDto> Payments { get; set; } = new();
    public string RecordedBy { get; set; }
    public DateTime CreationTime { get; set; }

    /// <summary>Batches and harvests on the sale, for the list ("P-01 · B-2026-01-P01").</summary>
    public string Batches { get; set; }

    // Printable dispatch receipt header
    public string FarmName { get; set; }
    public string FarmAddress { get; set; }
    public string FarmContact { get; set; }

    /// <summary>The farm's BFAR registration number from a current permit record (DEC-55).</summary>
    public string BfarRegistrationNo { get; set; }

    /// <summary>SFSC numbers of the fry deliveries behind the sold batches, for the dispatch receipt (DEC-70). Detail only.</summary>
    public string SfscNos { get; set; }

    /// <summary>D-18 notice shown on the printable record.</summary>
    public string DocumentNotice { get; set; } = "Dispatch receipt for the farm's records. This is not an official receipt or invoice.";

    public List<WarningDto> Warnings { get; set; } = new();
}

public class SellableLineDto
{
    public Guid HarvestGradeLineId { get; set; }
    public Guid HarvestId { get; set; }
    public DateTime HarvestedAtUtc { get; set; }
    public DateOnly HarvestDate { get; set; }
    public Guid BatchId { get; set; }
    public string BatchCode { get; set; }
    public string PondCode { get; set; }
    public string SizeLabel { get; set; }
    public decimal Kg { get; set; }
    public decimal SoldKg { get; set; }
    public decimal UnsoldKg { get; set; }

    /// <summary>The harvest's sampled ABW, the default ABW for base-ABW pricing (DEC-80).</summary>
    public decimal? HarvestAbwG { get; set; }

    /// <summary>The buyer the harvest was for, to prefill "Sell this harvest" (DEC-81).</summary>
    public Guid? HarvestBuyerId { get; set; }

    /// <summary>The count count-based prices use by default: the grade's middle count, else 1000 ÷ the harvest ABW (DEC-82).</summary>
    public decimal? DefaultCountPerKg { get; set; }
}

public class GetSalesInput : PagedInput
{
    public Guid? BuyerId { get; set; }
    public Guid? BatchId { get; set; }
    public PaymentStatus? PaymentStatus { get; set; }
    public bool OverdueOnly { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}

/// <summary>
/// Harvest sales and dispatch receipts (Ref 7.3, step E). A sale sells kg from harvest grade lines, possibly from several
/// harvests; the amount uses the buyer's accepted kg when given (DEC-67). Payments are separate rows and can be recorded
/// after the batch and cycle are closed. A voided sale keeps its dispatch receipt number.
/// </summary>
[AbpAuthorize(PermissionNames.Sales)]
public class SaleAppService : CapstoneAppServiceBase
{
    public const string BfarPreset = "BFAR Fishpond / Aquafarm Registration";

    private readonly IRepository<Sale, Guid> _sales;
    private readonly IRepository<SaleLine, Guid> _lines;
    private readonly IRepository<SalePayment, Guid> _payments;
    private readonly IRepository<HarvestGradeLine, Guid> _gradeLines;
    private readonly IRepository<Harvest, Guid> _harvests;
    private readonly IRepository<Buyer, Guid> _buyers;
    private readonly IRepository<ComplianceDocument, Guid> _documents;
    private readonly INumberSequenceGenerator _sequences;
    private readonly FarmStandardsProvider _standards;
    private readonly IRepository<PriceTable, Guid> _priceTables;

    public SaleAppService(IRepository<Sale, Guid> sales, IRepository<SaleLine, Guid> lines, IRepository<SalePayment, Guid> payments,
        IRepository<HarvestGradeLine, Guid> gradeLines, IRepository<Harvest, Guid> harvests, IRepository<Buyer, Guid> buyers,
        IRepository<ComplianceDocument, Guid> documents, INumberSequenceGenerator sequences, FarmStandardsProvider standards, IRepository<PriceTable, Guid> priceTables)
    {
        _sales = sales;
        _lines = lines;
        _payments = payments;
        _gradeLines = gradeLines;
        _harvests = harvests;
        _buyers = buyers;
        _documents = documents;
        _sequences = sequences;
        _standards = standards;
        _priceTables = priceTables;
    }

    private static readonly string[] SaleSortKeys = { "saleDate", "dispatchReceiptNo", "buyerName", "total", "paid", "balance", "paymentStatus" };

    /// <summary>
    /// One page of sales (AC-27) with the totals of every matching sale. Payment status and Overdue are computed from the
    /// payments, so the matching sales are worked out first and then cut into pages.
    /// Sort keys: saleDate (default, newest first), dispatchReceiptNo, buyerName, total, paid, balance, paymentStatus.
    /// </summary>
    public virtual async Task<SalePageDto> GetAll(GetSalesInput input)
    {
        var matching = await FilteredAsync(input);
        var sort = SortSpec.Parse(input.Sorting, SaleSortKeys, "saleDate", true);
        IOrderedEnumerable<SaleDto> ordered = sort.Key switch
        {
            "dispatchReceiptNo" => sort.Apply(matching, s => s.DispatchReceiptNo ?? string.Empty),
            "buyerName" => sort.Apply(matching, s => s.BuyerName ?? string.Empty),
            "total" => sort.Apply(matching, s => s.Total),
            "paid" => sort.Apply(matching, s => s.Paid),
            "balance" => sort.Apply(matching, s => s.Balance),
            "paymentStatus" => sort.Apply(matching, s => (int)s.PaymentStatus),
            _ => sort.Apply(matching, s => s.SaleDate),
        };
        var list = ordered.ThenByDescending(s => s.CreationTime).ToList();
        var page = list.ToPage(input);
        return new SalePageDto
        {
            TotalCount = page.TotalCount, Items = page.Items,
            TotalKg = list.Sum(s => s.TotalKg), TotalAmount = list.Sum(s => s.Total), TotalPaid = list.Sum(s => s.Paid), TotalBalance = list.Sum(s => s.Balance),
            OverdueCount = list.Count(s => s.IsOverdue),
        };
    }

    /// <summary>Every sale matching the filter, newest first. For CSV export and reports only; not exposed as an API.</summary>
    internal async Task<List<SaleDto>> ListAllAsync(GetSalesInput input) =>
        (await FilteredAsync(input)).OrderByDescending(s => s.SaleDate).ThenByDescending(s => s.CreationTime).ToList();

    private async Task<List<SaleDto>> FilteredAsync(GetSalesInput input)
    {
        var sales = await Query()
            .Where(s => !input.BuyerId.HasValue || s.BuyerId == input.BuyerId)
            .Where(s => !input.From.HasValue || s.SaleDate >= input.From)
            .Where(s => !input.To.HasValue || s.SaleDate <= input.To)
            .OrderByDescending(s => s.SaleDate).ThenByDescending(s => s.CreationTime)
            .ToListAsync();
        var list = await MapAsync(sales, detail: false);
        if (input.BatchId.HasValue)
        {
            list = list.Where(s => s.Lines.Any(l => l.BatchId == input.BatchId)).ToList();
        }

        return list
            .Where(s => SearchText.Matches(input.Search, s.DispatchReceiptNo, s.BuyerName, s.Batches))
            .Where(s => !input.PaymentStatus.HasValue || s.PaymentStatus == input.PaymentStatus)
            .Where(s => !input.OverdueOnly || s.IsOverdue)
            .ToList();
    }

    /// <summary>Sales per payment status for the toolbar chips: follows every filter except the payment status.</summary>
    public virtual async Task<List<StatusCountDto>> GetPaymentStatusCounts(GetSalesInput input)
    {
        input.PaymentStatus = null;
        return (await FilteredAsync(input)).GroupBy(s => s.PaymentStatus).Select(g => new StatusCountDto { Status = (int)g.Key, Count = g.Count() }).ToList();
    }

    public virtual async Task<SaleDto> Get(Guid id)
    {
        var sale = await Query().FirstOrDefaultAsync(s => s.Id == id) ?? throw new UserFriendlyException("Sale not found.");
        return (await MapAsync(new List<Sale> { sale }, detail: true)).Single();
    }

    /// <summary>Grade lines with unsold kg (plus the lines already on the sale being edited), oldest harvest first.</summary>
    public virtual async Task<List<SellableLineDto>> GetSellableLines(Guid? saleId)
    {
        var zone = await Farm.GetTimeZoneAsync();
        var lines = await _gradeLines.GetAll().AsNoTracking().Include(g => g.SizeGrade).ToListAsync();
        var harvestIds = lines.Select(l => l.HarvestId).Distinct().ToList();
        var harvests = await _harvests.GetAll().AsNoTracking().Include(h => h.Batch).ThenInclude(b => b.Pond).Include(h => h.Disposals)
            .Where(h => harvestIds.Contains(h.Id)).ToDictionaryAsync(h => h.Id);
        var sold = await SoldByGradeLineAsync(lines.Select(l => l.Id).ToList(), saleId);
        var onSale = saleId.HasValue ? await _lines.GetAll().Where(l => l.SaleId == saleId).Select(l => l.HarvestGradeLineId).ToListAsync() : new List<Guid>();
        return lines.Where(l => harvests.ContainsKey(l.HarvestId))
            .Select(l =>
            {
                var h = harvests[l.HarvestId];
                var s = sold.TryGetValue(l.Id, out var kg) ? kg : 0m;
                return new SellableLineDto
                {
                    HarvestGradeLineId = l.Id, HarvestId = h.Id, HarvestedAtUtc = h.HarvestedAtUtc, HarvestDate = FarmClock.LocalDate(h.HarvestedAtUtc, zone),
                    BatchId = h.BatchId, BatchCode = h.Batch?.BatchCode, PondCode = h.Batch?.Pond?.PondCode, SizeLabel = l.SizeGrade?.Label, Kg = l.Kg, SoldKg = s, UnsoldKg = l.Kg - s,
                    HarvestAbwG = h.AbwG, HarvestBuyerId = h.BuyerId, DefaultCountPerKg = DefaultCount(l, h),
                };
            })
            .Where(l => l.UnsoldKg > 0 || onSale.Contains(l.HarvestGradeLineId))
            .OrderBy(l => l.HarvestedAtUtc).ThenBy(l => l.SizeLabel)
            .ToList();
    }

    /// <summary>
    /// The buyer's pricing from their latest priced (non-fixed) sale line; when there is none, their active price table;
    /// else null. Prefills a new sale; every value stays editable (DEC-80, DEC-82).
    /// </summary>
    public virtual async Task<BuyerPriceTermsDto> GetBuyerPriceTerms(Guid buyerId)
    {
        var last = await (from l in _lines.GetAll().AsNoTracking()
                          join s in _sales.GetAll().AsNoTracking() on l.SaleId equals s.Id
                          where s.BuyerId == buyerId && l.PriceMethod != PriceMethod.Fixed
                          orderby s.SaleDate descending, s.CreationTime descending
                          select new { Line = l, s.SaleDate, s.DispatchReceiptNo }).FirstOrDefaultAsync();
        if (last != null)
        {
            var l = last.Line;
            var t = new BuyerPriceTermsDto { PriceMethod = l.PriceMethod, FromSaleDate = last.SaleDate, FromDispatchReceiptNo = last.DispatchReceiptNo };
            switch (l.PriceMethod)
            {
                case PriceMethod.BaseAbw:
                    (t.BasePricePerKg, t.BaseAbwG, t.StepPerG) = (l.BasePricePerKg, l.BaseAbwG, l.StepPerG);
                    break;
                case PriceMethod.BaseCount:
                    (t.BasePricePerKg, t.BaseCountPerKg, t.StepPerCount) = (l.BasePricePerKg, l.BaseCountPerKg, l.StepPerCount);
                    break;
                case PriceMethod.Table:
                    t.PriceTableId = l.PriceTableId;
                    break;
            }

            return t;
        }

        var table = await _priceTables.GetAll().AsNoTracking().Where(x => x.BuyerId == buyerId && x.IsActive).OrderBy(x => x.Name).FirstOrDefaultAsync();
        return table == null ? null : new BuyerPriceTermsDto { PriceMethod = PriceMethod.Table, PriceTableId = table.Id };
    }

    /// <summary>The grade's middle count when graded, else 1000 ÷ the harvest's ABW, as a whole count (DEC-82).</summary>
    private static decimal? DefaultCount(HarvestGradeLine grade, Harvest harvest)
    {
        var mid = grade.SizeGrade?.MidCountPerKg;
        if (mid.HasValue)
        {
            return SaleLine.WholeCount(mid.Value);
        }

        return harvest.AbwG > 0 ? SaleLine.CountFromAbw(harvest.AbwG.Value) : null;
    }

    public virtual async Task<SaleDto> Create(SaveSaleInput input)
    {
        var sale = new Sale { Id = Guid.NewGuid() };
        var warnings = await ApplyAsync(sale, input, isNew: true);
        sale.DispatchReceiptNo = $"DR-{input.SaleDate:yyyy}-{await _sequences.NextAsync(NumberSequenceType.DispatchReceipt, input.SaleDate.ToString("yyyy")):0000}";
        await _sales.InsertAsync(sale);
        if (input.InitialPayment is { Amount: > 0 } p)
        {
            ValidatePayment(sale, p);
            await _payments.InsertAsync(new SalePayment { SaleId = sale.Id, PaidOn = p.PaidOn, Amount = p.Amount, Method = Clean(p.Method), Note = Clean(p.Note) });
        }

        await CurrentUnitOfWork.SaveChangesAsync();
        return await WithWarningsAsync(sale.Id, warnings);
    }

    public virtual async Task<SaleDto> Update(SaveSaleInput input)
    {
        if (!input.Id.HasValue)
        {
            throw new UserFriendlyException("Sale id is required.");
        }

        var sale = await _sales.GetAll().Include(s => s.Lines).Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == input.Id.Value)
                   ?? throw new UserFriendlyException("Sale not found.");
        var warnings = await ApplyAsync(sale, input, isNew: false);
        await CurrentUnitOfWork.SaveChangesAsync();
        return await WithWarningsAsync(sale.Id, warnings);
    }

    /// <summary>Records a payment; allowed after the batch and cycle are closed. Paying more than the total warns.</summary>
    public virtual async Task<SaleDto> AddPayment(AddPaymentInput input)
    {
        var sale = await _sales.GetAll().Include(s => s.Lines).Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == input.SaleId)
                   ?? throw new UserFriendlyException("Sale not found.");
        ValidatePayment(sale, input);
        await _payments.InsertAsync(new SalePayment { SaleId = sale.Id, PaidOn = input.PaidOn, Amount = input.Amount, Method = Clean(input.Method), Note = Clean(input.Note) });
        await CurrentUnitOfWork.SaveChangesAsync();
        var warnings = new List<WarningDto>();
        var paid = sale.Payments.Sum(p => p.Amount) + input.Amount;
        if (paid > sale.Total)
        {
            warnings.Add(new WarningDto { Kind = "Overpayment", Message = $"Payments (₱{paid:N2}) are more than the sale total (₱{sale.Total:N2}); the difference shows as overpaid." });
        }

        return await WithWarningsAsync(sale.Id, warnings);
    }

    /// <summary>Removes a payment entered by mistake (the change stays in the activity log).</summary>
    [AbpAuthorize(PermissionNames.Production_Manage)]
    public virtual async Task<SaleDto> RemovePayment(Abp.Application.Services.Dto.EntityDto<Guid> input)
    {
        var payment = await _payments.GetAsync(input.Id);
        await _payments.DeleteAsync(payment);
        await CurrentUnitOfWork.SaveChangesAsync();
        return await Get(payment.SaleId);
    }

    /// <summary>Voids a sale with a reason: its kg become unsold again; the dispatch receipt number is never reused.</summary>
    [AbpAuthorize(PermissionNames.Production_Manage)]
    public virtual async Task Void(VoidSaleInput input)
    {
        var sale = await _sales.GetAsync(input.Id);
        sale.VoidReason = input.Reason.Trim();
        await CurrentUnitOfWork.SaveChangesAsync();
        await _sales.DeleteAsync(sale);
    }

    private IQueryable<Sale> Query() => _sales.GetAll().AsNoTracking()
        .Include(s => s.Buyer).Include(s => s.Payments)
        .Include(s => s.Lines).ThenInclude(l => l.HarvestGradeLine).ThenInclude(g => g.SizeGrade);

    private static string Clean(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void ValidatePayment(Sale sale, PaymentInput p)
    {
        if (p.Amount <= 0)
        {
            throw new UserFriendlyException("A payment must be greater than zero.");
        }

        if (p.PaidOn < sale.SaleDate)
        {
            throw new UserFriendlyException("A payment cannot be dated before the sale date.");
        }
    }

    private async Task<List<WarningDto>> ApplyAsync(Sale sale, SaveSaleInput input, bool isNew)
    {
        var warnings = new List<WarningDto>();
        var buyer = await _buyers.FirstOrDefaultAsync(b => b.Id == input.BuyerId) ?? throw new UserFriendlyException("Choose a buyer.");
        if (!buyer.IsActive && buyer.Id != sale.BuyerId)
        {
            throw new UserFriendlyException("The selected buyer is inactive.");
        }

        if (input.DueDate.HasValue && input.DueDate.Value < input.SaleDate)
        {
            throw new UserFriendlyException("The due date cannot be before the sale date.");
        }

        var lines = input.Lines ?? new List<SaleLineInput>();
        if (lines.Count == 0)
        {
            throw new UserFriendlyException("Add at least one grade line.");
        }

        if (lines.GroupBy(l => l.HarvestGradeLineId).Any(g => g.Count() > 1))
        {
            throw new UserFriendlyException("Each harvest grade can appear only once on a sale.");
        }

        if (!isNew && sale.Payments.Any(p => p.PaidOn < input.SaleDate))
        {
            throw new UserFriendlyException("A payment is dated before this sale date.");
        }

        var zone = await Farm.GetTimeZoneAsync();
        var gradeIds = lines.Select(l => l.HarvestGradeLineId).ToList();
        var gradeLines = await _gradeLines.GetAll().Include(g => g.SizeGrade).Where(g => gradeIds.Contains(g.Id)).ToListAsync();
        if (gradeLines.Count != gradeIds.Count)
        {
            throw new UserFriendlyException("Choose harvest grades of this farm for every line.");
        }

        var harvestIds = gradeLines.Select(g => g.HarvestId).Distinct().ToList();
        var harvests = await _harvests.GetAll().Include(h => h.Disposals).Include(h => h.GradeLines).Where(h => harvestIds.Contains(h.Id)).ToDictionaryAsync(h => h.Id);
        var exceptSale = isNew ? (Guid?)null : sale.Id;
        var soldElsewhere = await SoldByGradeLineAsync(harvests.Values.SelectMany(h => h.GradeLines).Select(g => g.Id).ToList(), exceptSale);
        var diffPct = await _standards.GetAsync(FarmThresholds.BuyerWeightDiffPct);
        var references = new Dictionary<SaleLineInput, LineReference>();

        foreach (var l in lines)
        {
            var grade = gradeLines.Single(g => g.Id == l.HarvestGradeLineId);
            var harvest = harvests[grade.HarvestId];
            if (input.SaleDate < FarmClock.LocalDate(harvest.HarvestedAtUtc, zone))
            {
                throw new UserFriendlyException($"The sale date cannot be before the harvest date of grade {grade.SizeGrade?.Label} ({FarmClock.LocalDate(harvest.HarvestedAtUtc, zone):yyyy-MM-dd}).");
            }

            var unsold = grade.Kg - (soldElsewhere.TryGetValue(grade.Id, out var s) ? s : 0m);
            if (l.Kg > unsold)
            {
                throw new UserFriendlyException($"Grade {grade.SizeGrade?.Label}: {l.Kg:0.###} kg is more than the {unsold:0.###} kg unsold.");
            }

            // Priced lines (DEC-80, DEC-82): the method's terms are required; the agreed price may differ (warns).
            if (!Enum.IsDefined(l.PriceMethod))
            {
                throw new UserFriendlyException($"Grade {grade.SizeGrade?.Label}: choose how the price was agreed.");
            }

            var reference = await ReferencePriceAsync(l, grade, harvest);
            references[l] = reference;
            if (reference.Price.HasValue && reference.Price.Value < 0)
            {
                warnings.Add(new WarningDto { Kind = "PriceFormula", Message = $"Grade {grade.SizeGrade?.Label}: the {reference.Name} gives a negative price (₱{reference.Price:N2}). Check its terms." });
            }
            else if (reference.Price.HasValue && Math.Abs(l.PricePerKg - reference.Price.Value) >= 0.01m)
            {
                warnings.Add(new WarningDto
                {
                    Kind = "PriceFormula",
                    Message = $"Grade {grade.SizeGrade?.Label}: the price ₱{l.PricePerKg:N2}/kg differs from the {reference.Name} price ₱{reference.Price:N2}/kg ({reference.Working}). Saved as entered.",
                });
            }

            if (l.PricePerKg == 0)
            {
                warnings.Add(new WarningDto { Kind = "Price", Message = $"Grade {grade.SizeGrade?.Label} is priced at ₱0." });
            }

            if (l.BuyerAcceptedKg.HasValue && l.Kg > 0 && Math.Abs(l.BuyerAcceptedKg.Value - l.Kg) / l.Kg * 100m > diffPct)
            {
                warnings.Add(new WarningDto
                {
                    Kind = "BuyerWeight",
                    Message = $"Grade {grade.SizeGrade?.Label}: the buyer accepted {l.BuyerAcceptedKg:0.###} kg of {l.Kg:0.###} kg, more than {diffPct:0.#}% different. Check both weights.",
                });
            }
        }

        // Σ sold + Σ not sold ≤ the harvest's total (DEC-67).
        foreach (var h in harvests.Values)
        {
            var soldHere = lines.Where(l => h.GradeLines.Any(g => g.Id == l.HarvestGradeLineId)).Sum(l => l.Kg);
            var soldOther = h.GradeLines.Sum(g => soldElsewhere.TryGetValue(g.Id, out var kg) ? kg : 0m);
            var notSold = h.Disposals.Sum(d => d.Kg);
            if (soldHere + soldOther + notSold > h.TotalKg)
            {
                throw new UserFriendlyException($"The harvest of {FarmClock.LocalDate(h.HarvestedAtUtc, zone):yyyy-MM-dd} would have {soldHere + soldOther:0.###} kg sold and {notSold:0.###} kg not sold, more than its {h.TotalKg:0.###} kg.");
            }
        }

        // DEC-79: shrimp sold from a batch whose fry delivery has no SFSC number can be confiscated (FAO 225-1). Warn, never block.
        var noSfsc = await _harvests.GetAll().AsNoTracking().Where(h => harvestIds.Contains(h.Id))
            .Where(h => h.Batch.Cycle.FryDelivery.SfscNo == null || h.Batch.Cycle.FryDelivery.SfscNo == "")
            .Select(h => h.Batch.BatchCode).Distinct().ToListAsync();
        if (noSfsc.Count > 0)
        {
            warnings.Add(new WarningDto
            {
                Kind = "Sfsc",
                Message = $"Batch {string.Join(", ", noSfsc.OrderBy(c => c))}: the fry delivery has no Shrimp Fry Source Certificate number. Without it the shrimp can be confiscated (BFAR FAO 225-1); add it on the fry delivery before dispatch.",
            });
        }

        sale.BuyerId = buyer.Id;
        sale.SaleDate = input.SaleDate;
        sale.PaymentTerms = Clean(input.PaymentTerms);
        sale.DueDate = input.DueDate;
        sale.Transporter = Clean(input.Transporter);
        sale.DriverName = Clean(input.DriverName);
        sale.PlateNo = Clean(input.PlateNo);
        sale.LoadedAtUtc = input.LoadedAt.HasValue ? FarmClock.ToUtc(input.LoadedAt.Value) : null;
        sale.Destination = Clean(input.Destination);
        sale.LocalTransportPermitNo = Clean(input.LocalTransportPermitNo);
        sale.TemperatureNote = Clean(input.TemperatureNote);

        foreach (var existing in sale.Lines.ToList())
        {
            sale.Lines.Remove(existing);
            await _lines.DeleteAsync(existing);
        }

        foreach (var l in lines)
        {
            var m = l.PriceMethod;
            var r = references[l];
            sale.Lines.Add(new SaleLine
            {
                Id = Guid.NewGuid(), SaleId = sale.Id, HarvestGradeLineId = l.HarvestGradeLineId, Kg = l.Kg, BuyerAcceptedKg = l.BuyerAcceptedKg, PricePerKg = l.PricePerKg,
                PriceMethod = m,
                BasePricePerKg = m is PriceMethod.BaseAbw or PriceMethod.BaseCount ? l.BasePricePerKg : null,
                BaseAbwG = m == PriceMethod.BaseAbw ? l.BaseAbwG : null, StepPerG = m == PriceMethod.BaseAbw ? l.StepPerG : null, PriceAbwG = m == PriceMethod.BaseAbw ? l.PriceAbwG : null,
                BaseCountPerKg = m == PriceMethod.BaseCount ? l.BaseCountPerKg : null, StepPerCount = m == PriceMethod.BaseCount ? l.StepPerCount : null,
                PriceCountPerKg = m is PriceMethod.BaseCount or PriceMethod.Table ? l.PriceCountPerKg : null,
                PriceTableId = m == PriceMethod.Table ? l.PriceTableId : null, PriceTableName = r.TableName, PriceTableRowLabel = r.RowLabel,
                ReferencePricePerKg = r.Price,
            });
        }

        return warnings;
    }

    private async Task<SaleDto> WithWarningsAsync(Guid id, List<WarningDto> warnings)
    {
        var dto = await Get(id);
        dto.Warnings.AddRange(warnings);
        return dto;
    }

    private async Task<Dictionary<Guid, decimal>> SoldByGradeLineAsync(List<Guid> gradeLineIds, Guid? exceptSaleId)
    {
        return await (from l in _lines.GetAll()
                      join s in _sales.GetAll() on l.SaleId equals s.Id
                      where gradeLineIds.Contains(l.HarvestGradeLineId) && s.Id != exceptSaleId
                      group l by l.HarvestGradeLineId into g
                      select new { g.Key, Kg = g.Sum(x => x.Kg) }).ToDictionaryAsync(x => x.Key, x => x.Kg);
    }

    private async Task<List<SaleDto>> MapAsync(List<Sale> sales, bool detail)
    {
        var profile = await Farm.GetProfileAsync();
        var today = FarmClock.Today(await Farm.GetTimeZoneAsync());
        var names = await GetUserNamesAsync(sales.Select(s => s.CreatorUserId).Concat(sales.SelectMany(s => s.Payments).Select(p => p.CreatorUserId)));
        var harvestIds = sales.SelectMany(s => s.Lines).Select(l => l.HarvestGradeLine?.HarvestId ?? Guid.Empty).Distinct().ToList();
        var harvests = await _harvests.GetAll().AsNoTracking().Include(h => h.Batch).ThenInclude(b => b.Pond).Include(h => h.Batch).ThenInclude(b => b.Cycle).ThenInclude(c => c.FryDelivery)
            .Where(h => harvestIds.Contains(h.Id)).ToDictionaryAsync(h => h.Id);
        string bfar = null;
        if (detail)
        {
            var docs = await _documents.GetAll().AsNoTracking().Include(d => d.Preset).Where(d => !d.IsArchived && d.Preset != null && d.Preset.Name == BfarPreset).ToListAsync();
            bfar = docs.Where(d => d.IsCurrent(today)).OrderByDescending(d => d.IssueDate).Select(d => d.DocumentNumber).FirstOrDefault(n => !string.IsNullOrWhiteSpace(n));
        }

        return sales.Select(s =>
        {
            var lines = s.Lines.Select(l =>
            {
                var h = l.HarvestGradeLine != null && harvests.TryGetValue(l.HarvestGradeLine.HarvestId, out var hv) ? hv : null;
                return new SaleLineDto
                {
                    Id = l.Id, HarvestGradeLineId = l.HarvestGradeLineId, HarvestId = h?.Id ?? Guid.Empty, HarvestedAtUtc = h?.HarvestedAtUtc ?? default, BatchId = h?.BatchId ?? Guid.Empty,
                    BatchCode = h?.Batch?.BatchCode, PondCode = h?.Batch?.Pond?.PondCode, CycleCode = h?.Batch?.Cycle?.CycleCode, SizeLabel = l.HarvestGradeLine?.SizeGrade?.Label,
                    Kg = l.Kg, BuyerAcceptedKg = l.BuyerAcceptedKg, WeightDifferenceKg = l.BuyerAcceptedKg.HasValue ? l.BuyerAcceptedKg - l.Kg : null,
                    PricePerKg = l.PricePerKg, Amount = l.Amount,
                    PriceMethod = l.PriceMethod, BasePricePerKg = l.BasePricePerKg, BaseAbwG = l.BaseAbwG, StepPerG = l.StepPerG, PriceAbwG = l.PriceAbwG,
                    BaseCountPerKg = l.BaseCountPerKg, StepPerCount = l.StepPerCount, PriceCountPerKg = l.PriceCountPerKg,
                    PriceTableId = l.PriceTableId, PriceTableName = l.PriceTableName, PriceTableRowLabel = l.PriceTableRowLabel,
                    FormulaPricePerKg = l.ReferencePricePerKg,
                };
            }).OrderBy(l => l.HarvestedAtUtc).ThenBy(l => l.SizeLabel).ToList();
            var sfscNos = detail
                ? string.Join(", ", s.Lines
                    .Select(l => l.HarvestGradeLine != null && harvests.TryGetValue(l.HarvestGradeLine.HarvestId, out var hx) ? hx.Batch?.Cycle?.FryDelivery?.SfscNo : null)
                    .Where(n => !string.IsNullOrWhiteSpace(n)).Distinct())
                : null;
            return new SaleDto
            {
                Id = s.Id, DispatchReceiptNo = s.DispatchReceiptNo, BuyerId = s.BuyerId, BuyerName = s.Buyer?.Name, BuyerContact = s.Buyer?.ContactPerson,
                BuyerPhone = s.Buyer?.Phone, BuyerAddress = s.Buyer?.Address, SaleDate = s.SaleDate, PaymentTerms = s.PaymentTerms, DueDate = s.DueDate,
                PaymentStatus = s.Status, IsOverdue = s.IsOverdue(today), Total = s.Total, Paid = s.Paid, Balance = Math.Max(0, s.Total - s.Paid), Overpaid = Math.Max(0, s.Paid - s.Total),
                TotalKg = lines.Sum(l => l.Kg), TotalBuyerKg = lines.Any(l => l.BuyerAcceptedKg.HasValue) ? lines.Sum(l => l.BuyerAcceptedKg ?? l.Kg) : null,
                Transporter = s.Transporter, DriverName = s.DriverName, PlateNo = s.PlateNo, LoadedAtUtc = s.LoadedAtUtc, Destination = s.Destination,
                LocalTransportPermitNo = s.LocalTransportPermitNo, TemperatureNote = s.TemperatureNote,
                Lines = lines,
                Payments = s.Payments.OrderBy(p => p.PaidOn).ThenBy(p => p.CreationTime)
                    .Select(p => new SalePaymentDto { Id = p.Id, PaidOn = p.PaidOn, Amount = p.Amount, Method = p.Method, Note = p.Note, RecordedBy = NameOf(names, p.CreatorUserId) }).ToList(),
                Batches = string.Join(", ", lines.Select(l => $"{l.PondCode} · {l.BatchCode}").Distinct()),
                RecordedBy = NameOf(names, s.CreatorUserId), CreationTime = s.CreationTime,
                FarmName = profile.FarmName, FarmAddress = profile.FormatAddress(),
                FarmContact = string.Join(" · ", new[] { profile.ContactName, profile.ContactPhone, profile.ContactEmail }.Where(x => !string.IsNullOrWhiteSpace(x))),
                BfarRegistrationNo = bfar,
                SfscNos = string.IsNullOrEmpty(sfscNos) ? null : sfscNos,
            };
        }).ToList();
    }

    /// <summary>The price a line's method gives, with copies to keep on the line (DEC-80, DEC-82). Fixed gives none.</summary>
    private sealed record LineReference(decimal? Price, string Name, string Working, string TableName = null, string RowLabel = null);

    /// <summary>
    /// Checks a priced line's terms and works out its reference price. Fills in the line's ABW or count when empty (from the
    /// harvest's ABW, or the grade's middle count), so the saved line shows what the price was based on.
    /// </summary>
    private async Task<LineReference> ReferencePriceAsync(SaleLineInput l, HarvestGradeLine grade, Harvest harvest)
    {
        var label = grade.SizeGrade?.Label;
        switch (l.PriceMethod)
        {
            case PriceMethod.BaseAbw:
            {
                if (!l.BasePricePerKg.HasValue || !l.BaseAbwG.HasValue || !l.StepPerG.HasValue)
                {
                    throw new UserFriendlyException($"Grade {label}: enter the base price, the base ABW and the step per gram.");
                }

                var abw = l.PriceAbwG ?? harvest.AbwG ?? throw new UserFriendlyException($"Grade {label}: enter the ABW the price is based on; the harvest has no sampled ABW.");
                l.PriceAbwG = Math.Round(abw, 2, MidpointRounding.AwayFromZero);
                var price = SaleLine.BaseAbwPrice(l.BasePricePerKg.Value, l.BaseAbwG.Value, l.StepPerG.Value, l.PriceAbwG.Value);
                return new LineReference(price, "base-ABW", $"₱{l.BasePricePerKg:N2} at {l.BaseAbwG:0.##} g + ₱{l.StepPerG:N2}/g, ABW {l.PriceAbwG:0.##} g");
            }

            case PriceMethod.BaseCount:
            {
                if (!l.BasePricePerKg.HasValue || !l.BaseCountPerKg.HasValue || !l.StepPerCount.HasValue)
                {
                    throw new UserFriendlyException($"Grade {label}: enter the base price, the base count and the step per piece.");
                }

                l.PriceCountPerKg = SaleLine.WholeCount(l.PriceCountPerKg ?? DefaultCount(grade, harvest)
                    ?? throw new UserFriendlyException($"Grade {label}: enter the count the price is based on; the grade has no count range and the harvest has no ABW."));
                var price = SaleLine.BaseCountPrice(l.BasePricePerKg.Value, l.BaseCountPerKg.Value, l.StepPerCount.Value, l.PriceCountPerKg.Value);
                return new LineReference(price, "base-count", $"₱{l.BasePricePerKg:N2} at {l.BaseCountPerKg:0} pcs/kg + ₱{l.StepPerCount:N2} per piece fewer, count {l.PriceCountPerKg:0}");
            }

            case PriceMethod.Table:
            {
                if (!l.PriceTableId.HasValue)
                {
                    throw new UserFriendlyException($"Grade {label}: choose the price table.");
                }

                var table = await _priceTables.GetAll().AsNoTracking().Include(t => t.Rows).FirstOrDefaultAsync(t => t.Id == l.PriceTableId.Value)
                            ?? throw new UserFriendlyException($"Grade {label}: choose a price table of this farm.");
                l.PriceCountPerKg = SaleLine.WholeCount(l.PriceCountPerKg ?? DefaultCount(grade, harvest)
                    ?? throw new UserFriendlyException($"Grade {label}: enter the count to look up in the price table; the grade has no count range and the harvest has no ABW."));
                var row = table.Find(l.PriceCountPerKg.Value)
                          ?? throw new UserFriendlyException($"Grade {label}: no row of the price table \"{table.Name}\" covers {l.PriceCountPerKg:0} pcs/kg.");
                return new LineReference(row.PricePerKg, "price-table", $"{table.Name}, {row.Label}, count {l.PriceCountPerKg:0}", table.Name, row.Label);
            }

            default:
                return new LineReference(null, null, null);
        }
    }
}
