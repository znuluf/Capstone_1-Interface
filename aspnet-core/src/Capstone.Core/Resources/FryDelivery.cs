using Capstone.Domain;
using System;
using System.ComponentModel.DataAnnotations;

namespace Capstone.Resources;

/// <summary>Current or past status of a fry delivery. "Stocked" is not stored: it is shown when a cycle uses the delivery.</summary>
public enum FryDeliveryStatus { Ordered = 1, InTransit = 2, Received = 3, Rejected = 4 }

/// <summary>One delivery of post-larvae from a hatchery (Log Fries, Ref 3.1a). Exactly one delivery starts one production cycle.</summary>
public class FryDelivery : FarmEntity
{
    public const int MaxBatchNumberLength = 100;
    public const int MaxNotesLength = 500;
    public const long MaxPl = 10_000_000;
    public const int MaxPermitLength = 100;

    public Guid HatcheryId { get; set; }
    public HatcherySource Hatchery { get; set; }

    /// <summary>The hatchery's own batch number (unique per hatchery).</summary>
    public string HatcheryBatchNumber { get; set; }

    public DateOnly DeliveryDate { get; set; }

    /// <summary>PL age in days (PL12 = 12). Null only for deliveries converted from before step C.</summary>
    public int? PlAgeDays { get; set; }

    public long PlReceived { get; set; }
    public decimal? CostPhp { get; set; }
    public string Notes { get; set; }

    /// <summary>The PL health certificate number that came with this delivery (DEC-59).</summary>
    public string PlHealthCertificateNo { get; set; }

    /// <summary>Optional transport permit number (DEC-59).</summary>
    public string TransportPermitNo { get; set; }

    /// <summary>Set by Finish stocking (DEC-63): the delivery is accounted for and cannot be stocked from again.</summary>
    public DateTime? StockingFinishedAtUtc { get; set; }

    public long? StockingFinishedByUserId { get; set; }

    public bool IsStockingFinished => StockingFinishedAtUtc.HasValue;

    [Timestamp]
    public byte[] RowVersion { get; set; }
}

/// <summary>Dated status history of a delivery (AC-06). The current status is the latest change; who made it is CreatorUserId.</summary>
public class FryDeliveryStatusChange : FarmEntity
{
    public const int MaxNoteLength = 500;

    public Guid DeliveryId { get; set; }
    public FryDeliveryStatus Status { get; set; }
    public DateTime ChangedAtUtc { get; set; }
    public string Note { get; set; }
}

/// <summary>Why PL of a delivery were not stocked (DEC-63).</summary>
public enum ShortfallReason { DeadOnArrival = 1, Discarded = 2, Returned = 3, CountDifference = 4 }

/// <summary>
/// PL of a delivery that were not stocked, recorded at Finish stocking (DEC-63) so that
/// PL received = Σ stocking counts + Σ shortfall counts.
/// </summary>
public class FryDeliveryShortfall : FarmEntity
{
    public const int MaxNoteLength = 500;

    public Guid DeliveryId { get; set; }
    public ShortfallReason Reason { get; set; }
    public long Count { get; set; }
    public string Note { get; set; }
}
