using Capstone.Common;
using Capstone.Ponds;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Capstone.Production.Dto;

public class IndicatorsDto
{
    public decimal? StockingDensityPerM2 { get; set; }
    public int? Doc { get; set; }
    public decimal CumulativeFeedKg { get; set; }
    public decimal? CurrentAbwG { get; set; }
    public decimal? LatestSampleAbwG { get; set; }
    public long CumulativeMortality { get; set; }
    public decimal HarvestedPieces { get; set; }
    public decimal TotalHarvestKg { get; set; }
    public decimal? EstimatedPopulation { get; set; }
    public decimal? EstimatedBiomassKg { get; set; }
    public decimal? FcrToDate { get; set; }
    public decimal? FinalFcr { get; set; }
    public decimal? SurvivalRatePct { get; set; }
    public decimal? EstimatedSurvivalPct { get; set; }

    /// <summary>"Estimate" or "Mortality": what remaining population and biomass are based on (DEC-53).</summary>
    public string PopulationBasis { get; set; }

    public int? CultureDays { get; set; }
    public decimal? FinalAbwG { get; set; }

    public static IndicatorsDto From(BatchIndicators i) => new()
    {
        StockingDensityPerM2 = i.StockingDensityPerM2,
        Doc = i.Doc,
        CumulativeFeedKg = i.CumulativeFeedKg,
        CurrentAbwG = i.CurrentAbwG,
        LatestSampleAbwG = i.LatestAbwG,
        CumulativeMortality = i.CumulativeMortality,
        HarvestedPieces = i.HarvestedPieces,
        TotalHarvestKg = i.TotalHarvestKg,
        EstimatedPopulation = i.EstimatedPopulation,
        EstimatedBiomassKg = i.EstimatedBiomassKg,
        FcrToDate = i.FcrToDate,
        FinalFcr = i.FinalFcr,
        SurvivalRatePct = i.SurvivalRatePct,
        EstimatedSurvivalPct = i.EstimatedSurvivalPct,
        PopulationBasis = i.PopulationBasis,
        CultureDays = i.CultureDays,
        FinalAbwG = i.FinalAbwG,
    };
}

public class CycleListDto
{
    public Guid Id { get; set; }
    public string CycleCode { get; set; }
    public CycleStatus Status { get; set; }
    public Guid FryDeliveryId { get; set; }
    public string HatcheryName { get; set; }
    public string HatcheryShortCode { get; set; }
    public string HatcheryBatchNumber { get; set; }

    /// <summary>Earliest stocking date of its batches (computed).</summary>
    public DateOnly? StartDate { get; set; }

    public int BatchCount { get; set; }
    public int OpenBatchCount { get; set; }
    public long PlReceived { get; set; }
    public long PlStocked { get; set; }
    public long PlLeft { get; set; }

    /// <summary>Confirmed at closing (DEC-64).</summary>
    public CycleOutcome? Outcome { get; set; }
}

/// <summary>A reopening shown in a batch's or cycle's history (DEC-64).</summary>
public class ReopenEventDto
{
    public DateTime ReopenedAtUtc { get; set; }
    public string ReopenedBy { get; set; }
    public string Reason { get; set; }
}

public class ReopenInput
{
    public Guid Id { get; set; }

    [Required, StringLength(ReopenEvent.MaxReasonLength, MinimumLength = 3)]
    public string Reason { get; set; }

    public string RowVersion { get; set; }
}

public class CycleDetailDto : CycleListDto
{
    /// <summary>Pre-selected outcome at closing: Failed when every batch failed, else Completed (DEC-64).</summary>
    public CycleOutcome SuggestedOutcome { get; set; }

    public bool CanReopen { get; set; }
    public List<ReopenEventDto> Reopenings { get; set; } = new();
    public decimal? DeliveryCostPhp { get; set; }
    public long PlNotStocked { get; set; }
    public bool IsStockingFinished { get; set; }
    public DateOnly DeliveryDate { get; set; }
    public int? PlAgeDays { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public string ClosedBy { get; set; }
    public string RowVersion { get; set; }
    public List<BatchListDto> Batches { get; set; } = new();
    public decimal TotalHarvestKg { get; set; }
    public decimal TotalFeedKg { get; set; }

    /// <summary>Active, PL left in the delivery, and the user may stock.</summary>
    public bool CanCreateBatch { get; set; }

    /// <summary>Owner, Active, every batch Closed.</summary>
    public bool CanClose { get; set; }
}

public class FailureInput
{
    public Guid Id { get; set; }

    [Required, StringLength(BatchFailure.MaxReasonLength)]
    public string Reason { get; set; }

    public DateOnly FailureDate { get; set; }

    [Range(0, 1000000000)]
    public decimal? EstimatedLossPhp { get; set; }

    public string RowVersion { get; set; }
}

public class CloseCycleInput
{
    public Guid Id { get; set; }

    /// <summary>Completed or Failed, confirmed by the Owner (DEC-64).</summary>
    public CycleOutcome? Outcome { get; set; }

    public string RowVersion { get; set; }
}

public class CloseBatchInput
{
    public Guid Id { get; set; }

    /// <summary>The Owner confirms that records become read-only.</summary>
    public bool ConfirmReadOnly { get; set; }

    public string RowVersion { get; set; }
}

public class StatusChangeInput
{
    public Guid Id { get; set; }
    public string RowVersion { get; set; }
}

public class GetBatchPageInput : Capstone.Common.PagedInput
{
    public Guid? CycleId { get; set; }
    public Guid? PondId { get; set; }
    public BatchStatus? Status { get; set; }
    public bool OpenOnly { get; set; }
}

public class BatchListDto
{
    public Guid Id { get; set; }
    public string BatchCode { get; set; }
    public string Letter { get; set; }
    public Guid CycleId { get; set; }
    public string CycleCode { get; set; }
    public Guid PondId { get; set; }
    public string PondCode { get; set; }
    public BatchStatus Status { get; set; }
    public DateOnly? StockingDate { get; set; }
    public long? PlCountStocked { get; set; }
    public int? Doc { get; set; }
    public decimal? CurrentAbwG { get; set; }
    public decimal? FcrToDate { get; set; }
    public decimal? EstimatedSurvivalPct { get; set; }
}

public class BatchDetailDto : BatchListDto
{
    public decimal PondAreaM2AtStocking { get; set; }
    public DateTime? StockedAtUtc { get; set; }
    public TransportMode TransportMode { get; set; }
    public DateTime? TimeProcessedUtc { get; set; }
    public int? AcclimationMinutes { get; set; }
    public decimal? InitialSurvivalEstimatePct { get; set; }
    public Guid FryDeliveryId { get; set; }
    public string HatcheryName { get; set; }
    public string HatcheryBatchNumber { get; set; }
    public int? PlAgeDays { get; set; }
    public string HatcheryCertificationStatusAtStocking { get; set; }
    public decimal? StockingDensityPerM2 { get; set; }
    public long? DeadAtStocking { get; set; }
    public string PlHealthCertificateNo { get; set; }
    public string SfscNo { get; set; }

    /// <summary>Latest (EndDate or log date) + WithdrawalDays across the batch's treatments (DEC-57).</summary>
    public DateOnly? EarliestSafeHarvestDate { get; set; }

    /// <summary>Owner, Closed batch, cycle not Closed, and no other open batch in the pond (DEC-64).</summary>
    public bool CanReopen { get; set; }

    /// <summary>Why the Owner cannot reopen a Closed batch right now (for example the cycle is Closed).</summary>
    public string ReopenBlockedReason { get; set; }

    public List<ReopenEventDto> Reopenings { get; set; } = new();

    /// <summary>Snapshots at stocking (DEC-52).</summary>
    public FarmingSystem? FarmingSystemAtStocking { get; set; }
    public PondConstructionType? ConstructionTypeAtStocking { get; set; }
    public DensityFlag? DensityFlag { get; set; }
    public string FailureReason { get; set; }
    public DateOnly? FailureDate { get; set; }
    public decimal? EstimatedLossPhp { get; set; }
    public decimal? FinalAbwG { get; set; }
    public decimal? FinalFcr { get; set; }
    public decimal? SurvivalRatePct { get; set; }
    public decimal? TotalHarvestKg { get; set; }
    public decimal? TotalFeedKg { get; set; }
    public int? CultureDays { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public string ClosedBy { get; set; }
    public string RowVersion { get; set; }
    public IndicatorsDto Indicators { get; set; }
    public Dictionary<string, int> LogCounts { get; set; } = new();
    public bool HasFinalHarvest { get; set; }
    public bool HasRecords { get; set; }
    public List<string> AllowedLogTypes { get; set; } = new();
    public bool CanDeclareFailure { get; set; }
    public bool CanClose { get; set; }
    public bool CanAddHarvest { get; set; }
    public bool IsReadOnly { get; set; }
}

public class GetBatchesInput
{
    public Guid? CycleId { get; set; }
    public Guid? PondId { get; set; }
    public BatchStatus? Status { get; set; }
    public bool OpenOnly { get; set; }
}

public class ReadingInput
{
    [Required]
    public string ParameterCode { get; set; }

    public decimal Value { get; set; }
}

// ---------------------------------------------------------------- Create Batch (Stocking) stepper (Refs 5.1–5.3, AC-08 to AC-10)

public class GetStockingOptionsInput
{
    /// <summary>Set when adding batches to an Active cycle; empty when starting a new cycle.</summary>
    public Guid? CycleId { get; set; }
}

public class StockingOptionsDto
{
    /// <summary>The farm's stocking window in days after a delivery's received date (DEC-63).</summary>
    public int StockingWindowDays { get; set; }

    /// <summary>New cycle: Received deliveries no cycle uses yet. Adding to a cycle: only that cycle's delivery.</summary>
    public List<StockingDeliveryDto> Deliveries { get; set; } = new();

    /// <summary>Prepared grow-out ponds with no open batch.</summary>
    public List<StockingPondDto> Ponds { get; set; } = new();

    /// <summary>Prepared ponds that cannot be stocked yet, with the reason (for example a batch not yet closed).</summary>
    public List<StockingPondDto> BlockedPonds { get; set; } = new();

    public Guid? CycleId { get; set; }
    public string CycleCode { get; set; }
}

public class StockingDeliveryDto
{
    public Guid Id { get; set; }
    public string HatcheryName { get; set; }
    public string HatcheryShortCode { get; set; }
    public string HatcheryBatchNumber { get; set; }
    public DateOnly DeliveryDate { get; set; }
    public int? PlAgeDays { get; set; }
    public long PlReceived { get; set; }
    public long PlLeft { get; set; }
    public string PlHealthCertificateNo { get; set; }

    /// <summary>Days since the delivery was received (farm-local).</summary>
    public int DaysSinceReceived { get; set; }

    /// <summary>Last day its ponds may be stocked (received date + stocking window; DEC-63).</summary>
    public DateOnly StockingWindowEnds { get; set; }

    /// <summary>False when today is past the window: shown under "Show older deliveries" (DEC-63).</summary>
    public bool IsWithinWindow { get; set; }
}

public class StockingPondDto
{
    public Guid Id { get; set; }
    public string PondCode { get; set; }
    public string Name { get; set; }
    public decimal AreaM2 { get; set; }
    public decimal AverageDepthM { get; set; }
    public Ponds.FarmingSystem FarmingSystem { get; set; }
    public Ponds.PondConstructionType ConstructionType { get; set; }

    /// <summary>The farm's effective density band for this pond (DEC-65), for the live check in the stepper.</summary>
    public decimal? BandMinPlM2 { get; set; }
    public decimal? BandMaxPlM2 { get; set; }
    public string BandSource { get; set; }
    public DateTime? PreparedAtUtc { get; set; }
    public string BlockedReason { get; set; }
}

public class BatchStockingInput
{
    public Guid PondId { get; set; }

    [Range(1, 10000000, ErrorMessage = "The stocking count must be greater than zero.")]
    public long PlCount { get; set; }

    /// <summary>Stocking date and time (ISO with offset). Not before the delivery date; not in the future.</summary>
    public DateTime StockedAt { get; set; }

    public TransportMode TransportMode { get; set; } = TransportMode.Truck;

    /// <summary>When the fry were processed (packed) at the hatchery; not after stocking.</summary>
    public DateTime? TimeProcessed { get; set; }

    [Range(0, 600)]
    public int? AcclimationMinutes { get; set; }

    [Range(0, 100)]
    public decimal? InitialSurvivalEstimatePct { get; set; }

    /// <summary>PL found dead at stocking (DEC-59); shown separately, not deducted.</summary>
    [Range(0, 10000000)]
    public long? DeadAtStocking { get; set; }

    /// <summary>Pre-stocking water quality: DO, temperature, pH and salinity required; others optional.</summary>
    public List<ReadingInput> Readings { get; set; } = new();
}

public class CreateBatchesInput
{
    /// <summary>New cycle: the Received delivery to stock from.</summary>
    public Guid? FryDeliveryId { get; set; }

    /// <summary>Adding batches: the Active cycle.</summary>
    public Guid? CycleId { get; set; }

    [Required]
    public List<BatchStockingInput> Batches { get; set; } = new();

    /// <summary>Makes a retried submit safe: the same id returns the batches already created.</summary>
    public Guid? ClientRequestId { get; set; }
}

public class CreatedBatchDto
{
    public Guid Id { get; set; }
    public string BatchCode { get; set; }
    public string PondCode { get; set; }
    public decimal? StockingDensityPerM2 { get; set; }
    public DensityFlag? DensityFlag { get; set; }
}

public class CreateBatchesResultDto
{
    public Guid CycleId { get; set; }
    public string CycleCode { get; set; }
    public bool CycleCreated { get; set; }
    public bool WasDuplicate { get; set; }
    public List<CreatedBatchDto> Batches { get; set; } = new();
    public long PlLeft { get; set; }
    public List<WarningDto> Warnings { get; set; } = new();
}

/// <summary>What Close Batch shows before the confirmation (DEC-50): blank daily records from stocking to the end of culture.</summary>
public class CloseCheckDto
{
    public Guid BatchId { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public int BlankFeedingSlots { get; set; }
    public int NotFedSlots { get; set; }
    public int BlankWaterDays { get; set; }

    /// <summary>Days with at least one blank, oldest first (at most 60).</summary>
    public List<BlankDayDto> BlankDays { get; set; } = new();
    public int BlankDaysTotal { get; set; }

    /// <summary>DEC-67: harvested kg, sold, recorded as not sold, and neither.</summary>
    public decimal HarvestedKg { get; set; }
    public decimal SoldKg { get; set; }
    public decimal NotSoldKg { get; set; }
    public decimal UnaccountedKg { get; set; }
}

public class BlankDayDto
{
    public DateOnly Date { get; set; }
    public string Missing { get; set; }
}

/// <summary>One day of the batch log calendar: the daily records (DEC-50) plus markers for the event records logged that day.</summary>
public class BatchLogCalendarDayDto
{
    public DateOnly Date { get; set; }
    public DailyCellStatus Am { get; set; }
    public DailyCellStatus Pm { get; set; }
    public DailyCellStatus Water { get; set; }
    public bool HasMortality { get; set; }
    public bool HasGrowthSampling { get; set; }
    public bool HasChemical { get; set; }
}

/// <summary>Every day of a batch from stocking to the end of culture, for the calendar grid on Batch detail. Status only: nothing is overdue.</summary>
public class BatchLogCalendarDto
{
    public Guid BatchId { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public List<BatchLogCalendarDayDto> Days { get; set; } = new();
}
