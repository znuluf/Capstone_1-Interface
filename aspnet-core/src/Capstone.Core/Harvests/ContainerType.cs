using Capstone.Domain;

namespace Capstone.Harvests;

/// <summary>
/// A farm's crate type (banyera, tub, box), used by the crate tally's quick add (DEC-80). "Crate" is the standard word on
/// screens; a crate with no type is just "Crate". The class keeps the name ContainerType. Farm-editable reference
/// data like size grades: deactivate instead of deleting. One active type can be the default.
/// </summary>
public class ContainerType : FarmEntity
{
    public const int MaxNameLength = 40;

    public string Name { get; set; }

    /// <summary>The usual shrimp kg in a full container; prefills the quick add. Optional.</summary>
    public decimal? NominalKg { get; set; }

    /// <summary>
    /// The empty container's weight. When set, crate weights of this type are read with the container on the scale and
    /// the tare is subtracted to give net shrimp kg. Leave empty when the farm weighs shrimp only.
    /// </summary>
    public decimal? TareKg { get; set; }

    public int SortOrder { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
}
