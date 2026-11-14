using Capstone.Domain;
using System;

namespace Capstone.Inventory;

public enum InventoryCategory { Feed = 1, AdditiveSupplement = 2, Chemical = 3 }

public enum StockMovementType { Receipt = 1, Usage = 2, Adjustment = 3 }

/// <summary>Feed, additive/supplement or chemical product (Refs 3.2, 3.3).</summary>
public class InventoryItem : FarmEntity
{
    public const int MaxNameLength = 150;
    public const int MaxShortLength = 100;

    public InventoryCategory Category { get; set; }
    public string Brand { get; set; }
    public string ProductName { get; set; }
    public string FeedType { get; set; }
    public string BaiRegistrationNo { get; set; }
    public string Unit { get; set; } = "kg";
    public decimal? ReorderLevel { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Base units per pack (for example 25 kg per bag); a receipt can be entered in packs (DEC-68).</summary>
    public decimal? PackSize { get; set; }

    /// <summary>Chemicals and drugs: the active ingredient, recorded for the treatment record (DEC-57).</summary>
    public string ActiveIngredient { get; set; }

    /// <summary>Default withdrawal period, pre-filled on a chemical application (DEC-57).</summary>
    public int? DefaultWithdrawalDays { get; set; }

    /// <summary>
    /// The short code the farm uses for the product, e.g. "N314" for a feed by stage (DEC-98). Technicians know feeds by
    /// it, so it leads wherever the product is shown.
    /// </summary>
    public string Code { get; set; }

    public const int MaxCodeLength = 20;

    /// <summary>"N314 · Uni-President Nu Ri" when the product has a code (the code is not repeated), else "Brand Product".</summary>
    public string DisplayName
    {
        get
        {
            var name = string.IsNullOrWhiteSpace(Brand) ? ProductName : $"{Brand} {ProductName}";
            if (string.IsNullOrWhiteSpace(Code))
            {
                return name;
            }

            var rest = System.Text.RegularExpressions.Regex.Replace(name ?? string.Empty, $@"\s*\b{System.Text.RegularExpressions.Regex.Escape(Code)}\b", string.Empty,
                System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
            return string.IsNullOrEmpty(rest) ? Code : $"{Code} · {rest}";
        }
    }
}

public class InventoryLot : FarmEntity
{
    public const int MaxLotLength = 100;

    public Guid ItemId { get; set; }
    public InventoryItem Item { get; set; }
    public string LotNumber { get; set; }
    public DateOnly ReceivedDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string Supplier { get; set; }

    /// <summary>Unit cost in PHP from the lot's receipt (lot-based cost, DEC-43). Null when the receipt had no cost.</summary>
    public decimal? UnitCost { get; set; }

    /// <summary>Set when a usage takes the lot below zero; the Owner reconciles it (AC-12).</summary>
    public bool NeedsReconciliation { get; set; }
}

/// <summary>
/// Ledger row. Quantity is positive for receipts, negative for usage, signed for adjustments.
/// Movements are never edited; corrections use reversing adjustments.
/// </summary>
public class StockMovement : FarmEntity
{
    public const int MaxReasonLength = 500;

    public Guid LotId { get; set; }
    public InventoryLot Lot { get; set; }
    public DateTime MovementDateUtc { get; set; }
    public StockMovementType Type { get; set; }
    public decimal Quantity { get; set; }
    /// <summary>The lot's unit cost (receipt price), copied for cost reports.</summary>
    public decimal? UnitCost { get; set; }
    public string Reason { get; set; }

    /// <summary>Usage source, one way only: a chemical application log (or, historically, a preparation log)…</summary>
    public Guid? SourceLogId { get; set; }

    /// <summary>…or a feeding session. Exactly one source per usage movement and its reversals.</summary>
    public Guid? FeedingSessionId { get; set; }

    public Guid? BatchId { get; set; }
    /// <summary>For reversing adjustments: the movement being reversed.</summary>
    public Guid? ReversesMovementId { get; set; }
}
