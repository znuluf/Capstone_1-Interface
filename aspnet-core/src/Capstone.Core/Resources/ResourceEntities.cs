using Capstone.Domain;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Capstone.Resources;

public enum AccreditationStatus { Accredited = 1, Pending = 2, NotAccredited = 3, Unknown = 4 }

public enum CertificateType { Health = 1, Other = 2 }

public enum BuyerType { Individual = 1, Company = 2 }

/// <summary>Hatchery profile (Ref 3.1). Certificates are kept over time in <see cref="HatcheryCertificate"/>.</summary>
public class HatcherySource : FarmEntity
{
    public const int MaxNameLength = 150;
    public const int MaxAddressLength = 300;
    public const int MaxShortLength = 100;
    public const int MinShortCodeLength = 2;
    public const int MaxShortCodeLength = 6;

    public string Name { get; set; }

    /// <summary>2–6 capital letters, unique per farm; used in cycle codes and reports (e.g. "SHI").</summary>
    public string ShortCode { get; set; }

    public string Address { get; set; }
    public string ContactPerson { get; set; }
    public string Phone { get; set; }
    public string BfarAccreditationNo { get; set; }
    public AccreditationStatus AccreditationStatus { get; set; } = AccreditationStatus.Unknown;
    public bool IsActive { get; set; } = true;

    /// <summary>Snapshot text stored on a batch at stocking (AC-08).</summary>
    public string DescribeCertification(HatcheryCertificate healthCertificate, DateOnly onDate)
    {
        var cert = healthCertificate == null
            ? "no health certificate on file"
            : healthCertificate.IsExpiredOn(onDate)
                ? $"health certificate {healthCertificate.CertificateNo} EXPIRED {healthCertificate.ExpiryDate:yyyy-MM-dd}"
                : $"health certificate {healthCertificate.CertificateNo}" + (healthCertificate.ExpiryDate.HasValue ? $" valid to {healthCertificate.ExpiryDate:yyyy-MM-dd}" : string.Empty);
        var bfar = string.IsNullOrWhiteSpace(BfarAccreditationNo) ? string.Empty : $" ({BfarAccreditationNo})";
        return $"BFAR {AccreditationStatus}{bfar}; {cert}";
    }
}

/// <summary>Hatchery certificate history (spec Section 5): every certificate is kept; the current one is the latest unexpired.</summary>
public class HatcheryCertificate : FarmEntity
{
    public const int MaxNumberLength = 100;

    public Guid HatcheryId { get; set; }
    public CertificateType CertificateType { get; set; } = CertificateType.Health;
    public string CertificateNo { get; set; }
    public DateOnly? IssueDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }

    public bool IsExpiredOn(DateOnly date) => ExpiryDate.HasValue && ExpiryDate.Value < date;

    /// <summary>
    /// The health certificate that applies on a date: the latest one issued by then that is not expired;
    /// if all have expired, the latest one (so an expired certificate is reported, not hidden). Null if none.
    /// </summary>
    public static HatcheryCertificate CurrentHealthCertificate(IEnumerable<HatcheryCertificate> certificates, DateOnly onDate)
    {
        var health = certificates
            .Where(c => c.CertificateType == CertificateType.Health && (!c.IssueDate.HasValue || c.IssueDate.Value <= onDate))
            .OrderByDescending(c => c.ExpiryDate ?? DateOnly.MaxValue)
            .ThenByDescending(c => c.IssueDate ?? DateOnly.MinValue)
            .ThenByDescending(c => c.CreationTime)
            .ToList();
        return health.FirstOrDefault(c => !c.IsExpiredOn(onDate)) ?? health.FirstOrDefault();
    }
}

/// <summary>Buyer registry (Ref 7.2): an individual or a company.</summary>
public class Buyer : FarmEntity
{
    public const int MaxNameLength = 150;
    public const int MaxAddressLength = 300;
    public const int MaxShortLength = 100;

    public BuyerType BuyerType { get; set; } = BuyerType.Company;

    /// <summary>The person's full name (Individual) or the company name (Company).</summary>
    public string Name { get; set; }

    /// <summary>Company buyers only.</summary>
    public string ContactPerson { get; set; }

    public string Phone { get; set; }
    public string Address { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Individual buyers only: when the Owner confirmed the buyer was told their details are kept for sales records.</summary>
    public DateTime? PrivacyNoticeAcknowledgedAtUtc { get; set; }
}

/// <summary>Short-code rules for hatcheries (spec Section 2 naming table).</summary>
public static class HatcheryNaming
{
    /// <summary>Initials of the words in the name, at least two letters: "Sarangani Hatchery Inc" → "SHI", "Ilocos" → "IL".</summary>
    public static string SuggestShortCode(string name)
    {
        var text = name ?? string.Empty;
        var initials = new List<char>();
        for (var i = 0; i < text.Length; i++)
        {
            if (char.IsAsciiLetter(text[i]) && (i == 0 || " (-/".Contains(text[i - 1])))
            {
                initials.Add(char.ToUpperInvariant(text[i]));
            }
        }

        var code = new string(initials.Take(HatcherySource.MaxShortCodeLength).ToArray());
        if (code.Length < HatcherySource.MinShortCodeLength)
        {
            var letters = new string(text.Where(char.IsAsciiLetter).Select(char.ToUpperInvariant).ToArray());
            code = letters.Length >= HatcherySource.MinShortCodeLength ? letters[..HatcherySource.MinShortCodeLength] : (letters + "XX")[..HatcherySource.MinShortCodeLength];
        }

        return code;
    }

    public static bool IsValidShortCode(string code) =>
        !string.IsNullOrEmpty(code) && code.Length is >= HatcherySource.MinShortCodeLength and <= HatcherySource.MaxShortCodeLength
        && code.All(c => c is >= 'A' and <= 'Z');
}
