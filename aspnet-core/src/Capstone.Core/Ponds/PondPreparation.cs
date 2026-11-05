using Capstone.Domain;
using System;

namespace Capstone.Ponds;

/// <summary>
/// One round of pond preparation (Ref 4.3, AC-07). The first entry opens it (pond Under preparation); Mark Prepared sets
/// PreparedAtUtc (pond Prepared); stocking a batch from it sets UsedAtUtc. One open round (UsedAtUtc null) per pond.
/// </summary>
public class PondPreparationRound : FarmEntity
{
    public Guid PondId { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public DateTime? PreparedAtUtc { get; set; }
    public long? PreparedByUserId { get; set; }
    public DateTime? UsedAtUtc { get; set; }

    /// <summary>A Prepared pond waiting this many days gets a warning to re-check it before stocking.</summary>
    public const int StaleAfterDays = 30;

    public bool IsOpen => UsedAtUtc == null;
    public bool IsPrepared => PreparedAtUtc != null;
}

/// <summary>A dated free-text description of preparation work (structured fields come after consulting the technician).</summary>
public class PondPreparationEntry : FarmEntity
{
    public const int MaxDescriptionLength = 1000;

    public Guid RoundId { get; set; }
    public DateTime ObservedAtUtc { get; set; }
    public string Description { get; set; }

    /// <summary>Client-generated id; a retried request returns the saved entry instead of adding a second one.</summary>
    public Guid ClientRequestId { get; set; } = Guid.NewGuid();
}
