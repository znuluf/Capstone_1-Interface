using Capstone.Domain;
using Capstone.Ponds;
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Capstone.Production;

/// <summary>
/// One batch: the fry stocked into one pond within a cycle (spec "ShrimpBatch"; the code keeps the name PondBatch).
/// Created Stocked by Create Batch (Stocking). All logs and harvests attach to a batch.
/// </summary>
public class PondBatch : FarmEntity
{
    public const int MaxCodeLength = 50;
    public const int MaxLetterLength = 2;

    public Guid CycleId { get; set; }
    public ProductionCycle Cycle { get; set; }
    public Guid PondId { get; set; }
    public Pond Pond { get; set; }

    /// <summary>The preparation round this batch was stocked from (unique). Null for batches from before step C.</summary>
    public Guid? PreparationRoundId { get; set; }

    /// <summary>A, B, … within the cycle.</summary>
    public string Letter { get; set; }

    /// <summary>Generated once (cycle code + letter) or kept from before step C; never changed.</summary>
    public string BatchCode { get; set; }

    public BatchStatus Status { get; set; } = BatchStatus.Stocked;

    public DateTime? StockedAtUtc { get; set; }

    /// <summary>Farm-local stocking date; DOC 0 (D-10).</summary>
    public DateOnly? StockingDate { get; set; }

    /// <summary>Stocking count (PL).</summary>
    public long? PlCountStocked { get; set; }

    /// <summary>Pond area when stocked; later pond edits do not change it.</summary>
    public decimal PondAreaM2AtStocking { get; set; }

    public TransportMode TransportMode { get; set; } = TransportMode.Other;
    public DateTime? TimeProcessedUtc { get; set; }
    public int? AcclimationMinutes { get; set; }
    public decimal? InitialSurvivalEstimatePct { get; set; }
    public string HatcheryCertificationStatusAtStocking { get; set; }

    /// <summary>PL found dead at stocking (DEC-59). Shown separately; not deducted from the stocking count (DEC-68).</summary>
    public long? DeadAtStocking { get; set; }

    /// <summary>The pond's effective farming system when stocked; later pond or farm changes do not change it (DEC-52).</summary>
    public FarmingSystem? FarmingSystemAtStocking { get; set; }

    /// <summary>The pond's construction type when stocked (DEC-52).</summary>
    public PondConstructionType? ConstructionTypeAtStocking { get; set; }

    /// <summary>Density judged against the band at stocking; null when no band applies (DEC-52).</summary>
    public DensityFlag? DensityFlag { get; set; }

    // Final indicators, stored at closure (Ref 5.5)
    public decimal? FinalAbwG { get; set; }
    public decimal? FinalFcr { get; set; }
    public decimal? SurvivalRatePct { get; set; }
    public decimal? TotalHarvestKg { get; set; }
    public decimal? TotalFeedKg { get; set; }
    public int? CultureDays { get; set; }

    public DateTime? ClosedAtUtc { get; set; }
    public long? ClosedByUserId { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; }

    /// <summary>PL per m², from the stocking count and the area snapshot (computed, not stored).</summary>
    [NotMapped]
    public decimal? StockingDensityPerM2 => IndicatorCalculator.StockingDensity(PlCountStocked, PondAreaM2AtStocking);

    public bool IsOpen => Status != BatchStatus.Closed;

    public void EnsureNotClosed()
    {
        if (Status == BatchStatus.Closed)
        {
            throw FpmsErrors.Rule(FpmsErrors.ReadOnlyClosed);
        }
    }

    /// <summary>
    /// Which new log types the batch status allows (spec Section 5 lifecycle guards): Stocked takes every operational log;
    /// Harvested and Failed take corrections and notes until Close Batch. Feeding is recorded as feeding sessions,
    /// preparation on the pond, and post-production logging was removed.
    /// </summary>
    public bool AllowsNewLog(LogType type) =>
        type is not (LogType.PondPreparation or LogType.Feeding or LogType.PostProduction)
        && Status is BatchStatus.Stocked or BatchStatus.Harvested or BatchStatus.Failed;

    /// <summary>Feeding sessions follow the same rule as logs.</summary>
    public bool AllowsFeeding => Status is BatchStatus.Stocked or BatchStatus.Harvested or BatchStatus.Failed;
}

/// <summary>Declare Batch Failure (Ref 7.4): one row per failed batch.</summary>
public class BatchFailure : FarmEntity
{
    public const int MaxReasonLength = 1000;

    public Guid BatchId { get; set; }
    public DateOnly FailedOn { get; set; }
    public string Reason { get; set; }
    public decimal? EstimatedLossPhp { get; set; }
}
