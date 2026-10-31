using Capstone.Domain;
using System;

namespace Capstone.Production;

/// <summary>
/// One feeding session (AM or PM) of a batch on a farm-local day (Ref 6.1, spec Section 5). The lots and kilograms
/// fed are its usage stock movements (one or more lots); the session stores no quantity. A session marked Not fed has
/// no movements; a slot with no row is shown as not logged (DEC-50). Unique per batch, day and session among
/// non-voided rows.
/// </summary>
public class FeedingSession : FarmEntity
{
    public const int MaxNotesLength = 500;
    public const int MaxVoidReasonLength = 500;
    public const int MaxFedAtLength = 5;
    public const decimal MaxKg = 1000m;

    public Guid BatchId { get; set; }
    public PondBatch Batch { get; set; }
    public DateOnly FeedDate { get; set; }
    public FeedingSessionTime Session { get; set; }
    public FeedingStatus Status { get; set; } = FeedingStatus.Fed;
    public string Notes { get; set; }

    /// <summary>Optional time of feeding typed by the user, farm-local 24-hour "HH:mm" (DEC-71). AM/PM stays the session key.</summary>
    public string FedAtTime { get; set; }

    public Guid ClientRequestId { get; set; }
    public string VoidReason { get; set; }
}
