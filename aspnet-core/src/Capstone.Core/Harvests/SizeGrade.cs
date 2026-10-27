using Capstone.Domain;

namespace Capstone.Harvests;

/// <summary>
/// Farm-editable shrimp size grade (spec Section 5), e.g. "60/70" = 60 to 70 pieces per kg. The seeded
/// "Ungraded / mixed" grade has no count range; its pieces are estimated from ABW (DEC-67).
/// </summary>
public class SizeGrade : FarmEntity
{
    public const int MaxLabelLength = 20;
    public const int MaxCount = 1000;

    public string Label { get; set; }
    public int? MinCountPerKg { get; set; }
    public int? MaxCountPerKg { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public const string UngradedLabel = "Ungraded / mixed";

    public bool IsUngraded => !MinCountPerKg.HasValue && !MaxCountPerKg.HasValue;

    /// <summary>Middle of the count range, used to estimate pieces; null for the ungraded grade.</summary>
    public decimal? MidCountPerKg => MinCountPerKg.HasValue && MaxCountPerKg.HasValue ? (MinCountPerKg.Value + MaxCountPerKg.Value) / 2m
        : MinCountPerKg ?? MaxCountPerKg;
}
