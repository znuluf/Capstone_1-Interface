using Capstone.Domain;
using Capstone.Resources;
using System;
using System.ComponentModel.DataAnnotations;

namespace Capstone.Production;

/// <summary>
/// A production cycle: the batches stocked from one fry delivery (spec Section 5). Created Active by the first
/// Create Batch (Stocking); closed by the Owner once every batch is Closed. Hatchery comes from the delivery.
/// </summary>
public class ProductionCycle : FarmEntity
{
    public const int MaxCodeLength = 50;

    /// <summary>Generated once ("2026-11-SHI-01") or kept from before step C; never changed.</summary>
    public string CycleCode { get; set; }

    public CycleStatus Status { get; set; } = CycleStatus.Active;

    public Guid FryDeliveryId { get; set; }
    public FryDelivery FryDelivery { get; set; }

    /// <summary>Confirmed by the Owner at closing; cleared when the cycle is reopened (DEC-64).</summary>
    public CycleOutcome? Outcome { get; set; }

    public DateTime? ClosedAtUtc { get; set; }
    public long? ClosedByUserId { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; }

    public bool IsClosed => Status == CycleStatus.Closed;
}

/// <summary>An Owner reopening a Closed batch or cycle, with the required reason (DEC-64). Shown in the record's history.</summary>
public class ReopenEvent : FarmEntity
{
    public const int MaxReasonLength = 500;

    public ReopenedEntityType EntityType { get; set; }
    public Guid EntityId { get; set; }
    public DateTime ReopenedAtUtc { get; set; }
    public long ReopenedByUserId { get; set; }
    public string Reason { get; set; }
}
