using Capstone.Domain;
using System;

namespace Capstone.Production;

/// <summary>
/// One feeding of a batch on a farm-local day, numbered 1, 2, 3... in the day's order (DEC-61). Feeding 1 and 2 were
/// AM and PM before DEC-61, so old rows keep their meaning (Ref 6.1, spec Section 5). The lots and kilograms fed are
/// its usage stock movements (one or more lots, so mixed feeds are two lots); the session stores no quantity. A session
/// marked Not fed has no movements; a slot with no row is shown as not logged (DEC-50). Unique per batch, day and
/// feeding number among non-voided rows.
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
    /// <summary>The feeding's number in the day, 1 to <see cref="FeedingSchedule.MaxFeedingsPerDay"/> (DEC-61).</summary>
    public int Session { get; set; }
    public FeedingStatus Status { get; set; } = FeedingStatus.Fed;
    public string Notes { get; set; }

    /// <summary>Optional time of feeding typed by the user, farm-local 24-hour "HH:mm" (DEC-71). The feeding number is the key (DEC-61).</summary>
    public string FedAtTime { get; set; }

    public Guid ClientRequestId { get; set; }
    public string VoidReason { get; set; }
}
