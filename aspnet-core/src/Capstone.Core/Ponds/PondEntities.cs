using Capstone.Domain;
using System;
using System.Linq;

namespace Capstone.Ponds;

public enum PondPurpose { GrowOut = 1, Nursery = 2, Reservoir = 3, Treatment = 4 }

/// <summary>Pond construction (DEC-65). Value 4 (Other) was removed in v2.6; old rows were reassigned by the Fpms_V26Production migration.</summary>
public enum PondConstructionType { Earthen = 1, Concrete = 2, HdpeLined = 3 }

/// <summary>Farming system (DEC-65). Value 4 (Super-intensive) was removed in v2.6; old rows became Intensive.</summary>
public enum FarmingSystem { Extensive = 1, SemiIntensive = 2, Intensive = 3 }

public enum PondManualStatus { Active = 1, UnderMaintenance = 2, Inactive = 3 }

/// <summary>Status shown to users: manual status first, else derived from the pond's open batch.</summary>
public enum PondDisplayStatus { Available = 1, UnderPreparation = 2, InProduction = 3, PostHarvest = 4, UnderMaintenance = 5, Inactive = 6, Prepared = 7 }

public enum PondChangeType { Created = 1, StatusChange = 2, InfrastructureModification = 3 }

/// <summary>
/// Farm-editable pond name prefix (spec Section 5, DEC-20): the pond name is the prefix name plus a number
/// ("Grow-out Pond 3") and the pond code is the short code plus a two-digit number ("GP-03").
/// The short code is fixed once the prefix is created, so renaming a prefix never changes existing pond codes.
/// </summary>
public class PondNamePrefix : FarmEntity
{
    public const int MaxNameLength = 60;
    public const int MaxShortCodeLength = 6;

    public string Name { get; set; }
    public string ShortCode { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>Pond master data, manuscript Table 3 (Ref 4.1).</summary>
public class Pond : FarmEntity
{
    public const int MaxCodeLength = 30;
    public const int MaxTypeLength = 100;
    public const int MaxAerationLength = 300;
    public const int MaxNotesLength = 1000;
    public const int MaxNumber = 999;

    public Guid PrefixId { get; set; }
    public PondNamePrefix Prefix { get; set; }

    /// <summary>Number within the prefix (1–999); unique together with the prefix in a farm.</summary>
    public int Number { get; set; }

    /// <summary>Generated once at creation (or kept from before prefixes existed); never changed.</summary>
    public string PondCode { get; set; }

    public decimal AreaM2 { get; set; }
    public decimal AverageDepthM { get; set; }
    public decimal MaxDepthM { get; set; }
    public PondPurpose Purpose { get; set; } = PondPurpose.GrowOut;
    public PondConstructionType ConstructionType { get; set; } = PondConstructionType.Earthen;
    public string InletType { get; set; }
    public string OutletType { get; set; }
    public string AerationSystem { get; set; }

    /// <summary>Null means the pond uses the farm's farming system (FarmProfile.FarmingSystem).</summary>
    public FarmingSystem? FarmingSystemOverride { get; set; }

    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public PondManualStatus ManualStatus { get; set; } = PondManualStatus.Active;
    public string Notes { get; set; }

    public FarmingSystem EffectiveFarmingSystem(FarmingSystem farmSystem) => FarmingSystemOverride ?? farmSystem;
}

/// <summary>Pond naming rules (spec Section 2 naming table: pond code = prefix initials + two-digit number).</summary>
public static class PondNaming
{
    /// <summary>Initials of the words in a prefix name: "Grow-out Pond" → "GP", "Reservoir" → "R".</summary>
    public static string SuggestShortCode(string prefixName)
    {
        var letters = (prefixName ?? string.Empty)
            .Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(w => w.FirstOrDefault(char.IsLetter))
            .Where(c => c != default)
            .Select(char.ToUpperInvariant);
        var code = new string(letters.ToArray());
        return code.Length > PondNamePrefix.MaxShortCodeLength ? code[..PondNamePrefix.MaxShortCodeLength] : code;
    }

    public static bool IsValidShortCode(string shortCode) =>
        !string.IsNullOrEmpty(shortCode) && shortCode.Length <= PondNamePrefix.MaxShortCodeLength && shortCode.All(c => c is >= 'A' and <= 'Z');

    public static string FormatCode(string shortCode, int number) => $"{shortCode}-{number:00}";

    public static string DisplayName(string prefixName, int number) => $"{prefixName} {number}";
}

public class PondHistory : FarmEntity
{
    public const int MaxDescriptionLength = 1000;

    public Guid PondId { get; set; }
    public DateTime ChangeDateUtc { get; set; }
    public PondChangeType ChangeType { get; set; }
    public string Description { get; set; }
}

/// <summary>
/// Farming system vs construction (pond type): unusual combinations are flagged, never rejected (flag-not-block).
/// Intensive culture in earthen ponds is common in Mindanao and is not flagged.
/// </summary>
public static class PondSystemRules
{
    public static string GetWarning(PondConstructionType construction, FarmingSystem system) => (system, construction) switch
    {
        (FarmingSystem.Extensive, PondConstructionType.Concrete or PondConstructionType.HdpeLined) =>
            "Extensive culture relies on natural food from an earthen pond bottom; a concrete or HDPE-lined pond is unusual for this system.",
        _ => null,
    };
}
