using Capstone.Domain;
using Capstone.Harvests;
using Capstone.Resources;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Capstone.Sales;

/// <summary>Computed from payments vs the sale total; Overdue is shown separately from DueDate (DEC-67).</summary>
public enum PaymentStatus { Unpaid = 1, Partial = 2, Paid = 3 }

/// <summary>
/// How a sale line's price per kg was agreed (DEC-80). Fixed: the price is typed. BaseAbw: a base price at a base ABW,
/// plus a step for each gram of ABW above it (minus below it), e.g. ₱210 at 10 g + ₱5/g → ₱220.40 at 12.08 g.
/// New methods (by count, price table) get new values; existing values never change meaning.
/// </summary>
public enum PriceMethod { Fixed = 1, BaseAbw = 2 }

/// <summary>
/// Harvest sale (Ref 7.3). One sale can include grades from several harvests. The printable dispatch receipt is an
/// internal document, not an official receipt (D-18). Its number comes from NumberSequence and is never reused.
/// </summary>
public class Sale : FarmEntity
{
    public const int MaxTextLength = 200;
    public const int MaxShortLength = 100;
    public const int MaxReceiptNoLength = 30;

    public Guid BuyerId { get; set; }
    public Buyer Buyer { get; set; }
    public DateOnly SaleDate { get; set; }

    /// <summary>Generated at save (e.g. "DR-2026-0001"), unique per farm; a voided sale keeps its number.</summary>
    public string DispatchReceiptNo { get; set; }

    public string PaymentTerms { get; set; }

    /// <summary>Optional credit due date; unpaid or partly paid past it shows Overdue (DEC-67).</summary>
    public DateOnly? DueDate { get; set; }

    // Optional transport details (DEC-55)
    public string Transporter { get; set; }
    public string DriverName { get; set; }
    public string PlateNo { get; set; }
    public DateTime? LoadedAtUtc { get; set; }
    public string Destination { get; set; }
    public string LocalTransportPermitNo { get; set; }
    public string TemperatureNote { get; set; }

    public string VoidReason { get; set; }

    public List<SaleLine> Lines { get; set; } = new();
    public List<SalePayment> Payments { get; set; } = new();

    public decimal Total => Lines.Sum(l => l.Amount);
    public decimal Paid => Payments.Sum(p => p.Amount);

    public PaymentStatus Status => Paid <= 0 ? PaymentStatus.Unpaid : Paid >= Total ? PaymentStatus.Paid : PaymentStatus.Partial;

    public bool IsOverdue(DateOnly today) => DueDate.HasValue && DueDate.Value < today && Status != PaymentStatus.Paid;
}

/// <summary>Kg sold from one harvest grade line (farm weight), with the buyer's accepted kg when re-weighed (DEC-67).</summary>
public class SaleLine : FarmChildEntity
{
    public Guid SaleId { get; set; }
    public Guid HarvestGradeLineId { get; set; }
    public HarvestGradeLine HarvestGradeLine { get; set; }
    public decimal Kg { get; set; }
    public decimal? BuyerAcceptedKg { get; set; }
    /// <summary>The agreed price; with BaseAbw it is normally the computed price but may be overridden (warns, DEC-80).</summary>
    public decimal PricePerKg { get; set; }

    public PriceMethod PriceMethod { get; set; } = PriceMethod.Fixed;

    // BaseAbw inputs, kept on the line so later changes to the buyer's terms never alter this sale (DEC-80).
    public decimal? BasePricePerKg { get; set; }
    public decimal? BaseAbwG { get; set; }
    public decimal? StepPerG { get; set; }

    /// <summary>The ABW the price was based on (the harvest's sampled ABW unless the buyer sampled their own).</summary>
    public decimal? PriceAbwG { get; set; }

    /// <summary>(BuyerAcceptedKg or Kg) × PricePerKg, rounded to centavos.</summary>
    public decimal Amount => Math.Round((BuyerAcceptedKg ?? Kg) * PricePerKg, 2, MidpointRounding.AwayFromZero);

    /// <summary>Base + (ABW − base ABW) × step, ABW to 0.01 g and the result to centavos (DEC-80).</summary>
    public static decimal BaseAbwPrice(decimal basePricePerKg, decimal baseAbwG, decimal stepPerG, decimal abwG) =>
        Math.Round(basePricePerKg + (Math.Round(abwG, 2, MidpointRounding.AwayFromZero) - baseAbwG) * stepPerG, 2, MidpointRounding.AwayFromZero);
}

/// <summary>A payment received for a sale. Payments can be recorded after the batch and cycle are closed.</summary>
public class SalePayment : FarmEntity
{
    public const int MaxTextLength = 200;

    public Guid SaleId { get; set; }
    public DateOnly PaidOn { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; }
    public string Note { get; set; }
}
