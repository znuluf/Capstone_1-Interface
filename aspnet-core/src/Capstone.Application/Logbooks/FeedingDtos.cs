using Capstone.Common;
using Capstone.Production;
using Capstone.Production.Dto;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Capstone.Logbooks.Dto;

public class FeedingLineInput
{
    public Guid LotId { get; set; }

    [Range(0.001, 1000, ErrorMessage = "Feed per lot must be more than 0 and at most 1,000 kg.")]
    public decimal Kg { get; set; }
}

/// <summary>An AM or PM feeding session of one batch on one farm-local day (Ref 6.1). Saving again updates it.</summary>
public class SaveFeedingSessionInput
{
    public Guid BatchId { get; set; }
    public DateOnly FeedDate { get; set; }
    public FeedingSessionTime Session { get; set; }

    /// <summary>Fed (with lots) or Not fed (no lots, no stock movement) (DEC-50).</summary>
    public FeedingStatus Status { get; set; } = FeedingStatus.Fed;

    /// <summary>One or more feed lots and the kilograms taken from each (Fed sessions only).</summary>
    public List<FeedingLineInput> Lines { get; set; } = new();

    [StringLength(FeedingSession.MaxNotesLength)]
    public string Notes { get; set; }

    /// <summary>Client-generated id that makes retries duplicate-safe.</summary>
    public Guid ClientRequestId { get; set; }
}

public class FeedingLineDto
{
    public Guid LotId { get; set; }
    public string Label { get; set; }
    public decimal Kg { get; set; }
}

public class FeedingSessionDto
{
    public Guid Id { get; set; }
    public Guid BatchId { get; set; }
    public string BatchCode { get; set; }
    public string PondCode { get; set; }
    public DateOnly FeedDate { get; set; }
    public FeedingSessionTime Session { get; set; }
    public FeedingStatus Status { get; set; }
    public decimal Kg { get; set; }
    public List<FeedingLineDto> Lines { get; set; } = new();
    public string Notes { get; set; }
    public string RecordedBy { get; set; }
    public DateTime CreationTime { get; set; }
    public bool CanEdit { get; set; }
    public bool CanVoid { get; set; }
}

public class SaveFeedingResultDto
{
    public FeedingSessionDto Session { get; set; }
    public bool WasDuplicate { get; set; }

    /// <summary>True when the batch already had this day's session and it was updated.</summary>
    public bool WasUpdate { get; set; }

    public List<WarningDto> Warnings { get; set; } = new();
    public IndicatorsDto Indicators { get; set; }
}

public class GetFeedingSessionsInput : Capstone.Common.PagedInput
{
    public Guid? BatchId { get; set; }
    public Guid? CycleId { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}

public class GetFeedingSheetInput
{
    /// <summary>Optional: limit the sheet to one cycle. Without it the sheet lists every open batch on the farm (DEC-54).</summary>
    public Guid? CycleId { get; set; }

    public DateOnly FeedDate { get; set; }
}

/// <summary>The daily feeding sheet: every open batch on the farm, grouped by pond, with its AM and PM sessions (Ref 6.1, DEC-54).</summary>
public class FeedingSheetDto
{
    public Guid? CycleId { get; set; }
    public string CycleCode { get; set; }
    public DateOnly FeedDate { get; set; }
    public List<FeedingSheetRowDto> Rows { get; set; } = new();
}

public class FeedingSheetRowDto
{
    public Guid BatchId { get; set; }
    public string BatchCode { get; set; }
    public string PondCode { get; set; }
    public Guid CycleId { get; set; }
    public string CycleCode { get; set; }
    public BatchStatus Status { get; set; }
    public FeedingSessionDto Am { get; set; }
    public FeedingSessionDto Pm { get; set; }
}

public class SaveFeedingSheetInput
{
    public List<SaveFeedingSessionInput> Sessions { get; set; } = new();
}

public class GetDailyLogStatusInput
{
    /// <summary>Last farm-local day shown; defaults to today.</summary>
    public DateOnly? EndDate { get; set; }

    /// <summary>Number of days shown, 1–31 (default 7).</summary>
    public int Days { get; set; } = 7;
}

public class DailyLogCellDto
{
    public DateOnly Date { get; set; }
    public DailyCellStatus Am { get; set; }
    public DailyCellStatus Pm { get; set; }
    public DailyCellStatus Water { get; set; }
}

/// <summary>One open batch in the Daily log status view (DEC-50): daily records per day, event records as time since the last log.</summary>
public class DailyLogStatusRowDto
{
    public Guid BatchId { get; set; }
    public string BatchCode { get; set; }
    public Guid PondId { get; set; }
    public string PondCode { get; set; }
    public string CycleCode { get; set; }
    public DateOnly? StockingDate { get; set; }
    public List<DailyLogCellDto> Days { get; set; } = new();
    public int? DaysSinceMortality { get; set; }
    public int? DaysSinceGrowthSampling { get; set; }
    public int? DaysSinceChemical { get; set; }
}

public class DailyLogStatusDto
{
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    public List<DailyLogStatusRowDto> Rows { get; set; } = new();
}
