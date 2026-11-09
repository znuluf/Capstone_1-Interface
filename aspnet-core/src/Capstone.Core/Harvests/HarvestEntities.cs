using Capstone.Domain;
using Capstone.Production;
using System;
using System.Collections.Generic;

namespace Capstone.Harvests;

/// <summary>
/// Partial or Total harvest (spec Section 5). Value 3 (Emergency) was removed in step E: emergency harvests became
/// Total on a Failed batch, otherwise Partial (conversion 7). The Total harvest marks a Stocked batch Harvested.
/// </summary>
public enum HarvestType { Partial = 1, Total = 2 }

/// <summary>Why harvested kg were not sold (DEC-67).</summary>
public enum DisposalReason { StaffOrHomeUse = 1, GivenAway = 2, SpoiledOrLost = 3, Other = 4 }

/// <summary>Harvest record (Ref 7.1). Quality checks are optional: null means not assessed.</summary>
public class Harvest : FarmEntity
{
    public const int MaxNotesLength = 1000;

    public Guid BatchId { get; set; }
    public PondBatch Batch { get; set; }
    public DateTime HarvestedAtUtc { get; set; }
    public HarvestType HarvestType { get; set; }
    public decimal TotalKg { get; set; }
    public int? Boxes { get; set; }

    /// <summary>Sampled ABW at harvest (g). Worked out from the sample when both sample fields are given (DEC-80).</summary>
    public decimal? AbwG { get; set; }

    /// <summary>Optional ABW sample: total weight of the counted shrimp (g), e.g. 5,002 g (DEC-80).</summary>
    public decimal? AbwSampleWeightG { get; set; }

    /// <summary>Optional ABW sample: pieces counted, e.g. 414 (DEC-80). ABW = weight ÷ pieces, rounded to 0.01 g.</summary>
    public int? AbwSamplePieces { get; set; }

    /// <summary>Optional counted pieces; when given it replaces the estimate from grades and ABW (R-36).</summary>
    public long? FinalCount { get; set; }

    /// <summary>Shrimp found dead during the harvest (DEC-55).</summary>
    public long? DeadAtHarvest { get; set; }

    public bool? SmoothShell { get; set; }
    public bool? IntactAppendages { get; set; }
    public bool? NoNecrosis { get; set; }
    public string QualityNotes { get; set; }

    public List<HarvestGradeLine> GradeLines { get; set; } = new();
    public List<HarvestDisposal> Disposals { get; set; } = new();

    /// <summary>Optional crate-by-crate weigh tally (DEC-80). When present, TotalKg is its sum and Boxes its count.</summary>
    public List<HarvestCrate> Crates { get; set; } = new();

    /// <summary>ABW from a sample, rounded to 0.01 g like the paper tally (5,002 g ÷ 414 = 12.08 g).</summary>
    public static decimal AbwFromSample(decimal weightG, int pieces) =>
        Math.Round(weightG / pieces, 2, MidpointRounding.AwayFromZero);
}

/// <summary>One weighed crate (tub, box, banyera) on the harvest tally sheet (DEC-80).</summary>
public class HarvestCrate : FarmChildEntity
{
    public const int MaxCrates = 1000;

    public Guid HarvestId { get; set; }

    /// <summary>1, 2, 3 … in the order weighed; set by the server from the list order.</summary>
    public int CrateNo { get; set; }

    /// <summary>Net shrimp kg (the scale reading minus TareKg); the harvest total is Σ Kg.</summary>
    public decimal Kg { get; set; }

    /// <summary>The farm's container type, when one was chosen. Optional.</summary>
    public System.Guid? ContainerTypeId { get; set; }

    /// <summary>The container type's name when saved, so renaming the type does not change this tally.</summary>
    public string ContainerName { get; set; }

    /// <summary>Empty container weight subtracted when saved; null when the weight was shrimp only.</summary>
    public decimal? TareKg { get; set; }

    /// <summary>The scale reading with the container (Kg + TareKg); null when no tare was subtracted.</summary>
    public decimal? GrossKg { get; set; }
}

/// <summary>Kg of one size grade in a harvest. Sale lines sell from a grade line (Σ sold kg ≤ its kg).</summary>
public class HarvestGradeLine : FarmChildEntity
{
    public Guid HarvestId { get; set; }
    public Guid SizeGradeId { get; set; }
    public SizeGrade SizeGrade { get; set; }
    public decimal Kg { get; set; }
}

/// <summary>Harvested kg kept, given away or lost instead of sold (DEC-67).</summary>
public class HarvestDisposal : FarmChildEntity
{
    public const int MaxNoteLength = 300;

    public Guid HarvestId { get; set; }
    public decimal Kg { get; set; }
    public DisposalReason Reason { get; set; }
    public string Note { get; set; }
}
