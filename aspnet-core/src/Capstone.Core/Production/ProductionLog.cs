using Capstone.Domain;
using System;
using System.Collections.Generic;

namespace Capstone.Production;

/// <summary>Logbook entry header; one type-specific detail row per log (D-11). Recorder = CreatorUserId.</summary>
public class ProductionLog : FarmEntity
{
    public const int MaxNotesLength = 2000;
    public const int MaxVoidReasonLength = 500;

    public Guid BatchId { get; set; }
    public PondBatch Batch { get; set; }
    public Guid PondId { get; set; }
    public LogType LogType { get; set; }
    public DateTime ObservedAtUtc { get; set; }
    public string Notes { get; set; }
    /// <summary>Client-generated id; a resubmission with the same id returns the saved log (AC-10).</summary>
    public Guid ClientRequestId { get; set; }

    /// <summary>Set when an Owner voids the entry (soft delete with a reason; spec Section 5).</summary>
    public string VoidReason { get; set; }

    public PondPreparationDetail PondPreparation { get; set; }
    public GrowthSamplingDetail GrowthSampling { get; set; }
    public ChemicalApplicationDetail ChemicalApplication { get; set; }
    public MortalityDetail Mortality { get; set; }
    public PostProductionDetail PostProduction { get; set; }
    public List<WaterQualityMeasurement> Measurements { get; set; } = new();
}

/// <summary>Detail rows share the log's Id (LogId PK/FK).</summary>
public abstract class LogDetail : FarmChildEntity
{
}

/// <summary>Historical only: pond preparation is recorded on the pond since step C.</summary>
public class PondPreparationDetail : LogDetail
{
    public PondPreparationActivity ActivityType { get; set; }
    public DateOnly? DrainingDate { get; set; }
    public int? DryingDays { get; set; }
    public DateOnly? FillingDate { get; set; }
    public decimal? SeawaterPct { get; set; }
    public decimal? FreshwaterPct { get; set; }
}

public class GrowthSamplingDetail : LogDetail
{
    public int SampleCount { get; set; }
    public decimal TotalSampleWeightG { get; set; }
    /// <summary>TotalSampleWeightG ÷ SampleCount, stored at save.</summary>
    public decimal AbwG { get; set; }

    /// <summary>
    /// Staff estimate of live shrimp as a share of the stocking count (0–100), for example from cast-net sampling or feed
    /// trays. The latest estimate drives remaining population and biomass (DEC-53).
    /// </summary>
    public decimal? EstimatedSurvivalPct { get; set; }
}

/// <summary>Chemical and Supplement Application (Ref 6.4). Its lot and quantity live only in its usage movement(s).</summary>
public class ChemicalApplicationDetail : LogDetail
{
    public const int MaxReasonLength = 500;
    public const int MaxShortLength = 50;
    public const int MaxMethodLength = 100;
    public const int MaxPrescriptionLength = 100;
    public const int MaxWithdrawalDays = 365;

    public string Reason { get; set; }

    // Treatment record (DEC-57): all optional; a record, not a protocol.
    public decimal? Dosage { get; set; }
    public string DosageUnit { get; set; }
    public string Method { get; set; }

    /// <summary>Last day of the treatment when it ran over several days (farm-local).</summary>
    public DateOnly? EndDate { get; set; }

    /// <summary>Days after the last treatment day before the shrimp may be harvested (pre-filled from the item).</summary>
    public int? WithdrawalDays { get; set; }

    public string PrescriptionRef { get; set; }

    /// <summary>Earliest safe harvest date = (EndDate or the log's farm date) + WithdrawalDays; null without withdrawal days.</summary>
    public static DateOnly? SafeHarvestDate(DateOnly logDate, DateOnly? endDate, int? withdrawalDays) =>
        withdrawalDays is > 0 ? (endDate ?? logDate).AddDays(withdrawalDays.Value) : null;
}

public class MortalityDetail : LogDetail
{
    public const int MaxTextLength = 500;

    public const int MaxNameLength = 100;

    public int Count { get; set; }
    public MortalityCause Cause { get; set; } = MortalityCause.Others;

    /// <summary>Only when the cause is Disease (e.g. "WSSV").</summary>
    public string DiseaseName { get; set; }

    /// <summary>Only when the cause is Others (e.g. "Predation by birds").</summary>
    public string OtherCause { get; set; }

    public string Symptoms { get; set; }
    public string ResponseAction { get; set; }

    /// <summary>True when the count was above 1% of the estimated population when saved (judged once, like water flags).</summary>
    public bool IsHighMortality { get; set; }
}

/// <summary>Historical only: post-production logging was removed (DEC-32); old rows stay read-only.</summary>
public class PostProductionDetail : LogDetail
{
    public PostProductionActivity ActivityType { get; set; }
}

public class WaterQualityMeasurement : FarmChildEntity
{
    public const int MaxCodeLength = 20;

    public Guid LogId { get; set; }
    public string ParameterCode { get; set; }
    public decimal Value { get; set; }
    public string UnitCode { get; set; }
    /// <summary>Computed against the GAqP optimal range at save (D-09).</summary>
    public bool IsOutOfRange { get; set; }

    /// <summary>Low or High when out of range.</summary>
    public ReadingSide? Side { get; set; }
}
