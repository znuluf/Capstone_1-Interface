using Capstone.Domain;
using System;

namespace Capstone.Compliance;

public enum ExpiryStatus
{
    NoExpiry = 0,
    Active = 1,
    ExpiringSoon = 2,
    Expired = 3,
}

/// <summary>A group of regulatory records (for example Environmental Compliance). Configured per farm.</summary>
public class DocumentCategory : FarmEntity
{
    public const int MaxNameLength = 100;

    public string Name { get; set; }

    /// <summary>When true, records in this category cannot be marked Perpetual / No expiry date.</summary>
    public bool RequiresExpiryDate { get; set; }

    public bool IsActive { get; set; } = true;
}

/// <summary>A preset document title inside a category (for example ECC under Environmental Compliance).</summary>
public class DocumentPreset : FarmEntity
{
    public const int MaxNameLength = 200;
    public const int MaxAgencyLength = 200;

    public Guid CategoryId { get; set; }
    public DocumentCategory Category { get; set; }
    public string Name { get; set; }

    /// <summary>Suggested issuing agency, copied into a new record and editable there.</summary>
    public string DefaultIssuingAgency { get; set; }

    /// <summary>
    /// Required permit: when no active record uses this preset, the dashboard and the first stocking of a cycle show a
    /// reminder. It never blocks (decision D-30).
    /// </summary>
    public bool IsRequired { get; set; }

    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

/// <summary>
/// A regulatory record tracked by reference number and dates only (decision D-30): no file is stored and there is no
/// approval step. Expiry status is computed at read time.
/// </summary>
public class ComplianceDocument : FarmEntity
{
    public const int MaxTitleLength = 200;
    public const int MaxNumberLength = 100;
    public const int MaxAgencyLength = 200;
    public const int MaxNotesLength = 500;

    public Guid CategoryId { get; set; }
    public DocumentCategory Category { get; set; }

    /// <summary>Preset used for the title, or null for a custom title.</summary>
    public Guid? PresetId { get; set; }
    public DocumentPreset Preset { get; set; }

    public string Title { get; set; }
    public string DocumentNumber { get; set; }
    public string IssuingAgency { get; set; }
    public DateOnly? IssueDate { get; set; }

    /// <summary>Null means Perpetual / No expiry date.</summary>
    public DateOnly? ExpiryDate { get; set; }

    /// <summary>Notes or where the hard copy is kept (for example "Binder #2, farm office").</summary>
    public string Notes { get; set; }

    public bool IsArchived { get; set; }

    /// <summary>The record this one renewed; the earlier record is archived when the renewal is saved.</summary>
    public Guid? RenewedFromId { get; set; }

    public bool IsPerpetual => !ExpiryDate.HasValue;

    public ExpiryStatus GetExpiryStatus(DateOnly today, int alertDays)
    {
        if (!ExpiryDate.HasValue)
        {
            return ExpiryStatus.NoExpiry;
        }

        if (ExpiryDate.Value < today)
        {
            return ExpiryStatus.Expired;
        }

        return ExpiryDate.Value <= today.AddDays(alertDays) ? ExpiryStatus.ExpiringSoon : ExpiryStatus.Active;
    }

    /// <summary>A record is current when it is not archived and not expired.</summary>
    public bool IsCurrent(DateOnly today) => !IsArchived && (!ExpiryDate.HasValue || ExpiryDate.Value >= today);
}
