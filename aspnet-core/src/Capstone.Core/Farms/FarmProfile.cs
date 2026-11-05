using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;
using Abp.UI;
using Capstone.Domain;
using Capstone.Ponds;
using System.Linq;
using System.Text.RegularExpressions;

namespace Capstone.Farms;

/// <summary>Date display order: Month first (Oct 22, 2026) or Day first (22 Oct 2026).</summary>
public enum FarmDateOrder { MonthFirst = 1, DayFirst = 2 }

/// <summary>Farm details (Ref 2.1). Id equals the farm's TenantId (1-to-1 with AbpTenants).</summary>
public class FarmProfile : AuditedEntity<int>, IMustHaveTenant
{
    public const int MaxFarmNameLength = 150;
    public const int MaxAddressLineLength = 200;
    public const int MaxCityLength = 100;
    public const int MaxProvinceLength = 100;
    public const int MaxPostalCodeLength = 10;
    public const int MaxCountryLength = 100;
    public const string DefaultCountry = "Philippines";

    public int TenantId { get; set; }

    public string FarmName { get; set; }

    /// <summary>House number, street, purok or sitio, apartment/unit. Required.</summary>
    public string AddressLine1 { get; set; }

    /// <summary>Building, suite, floor, or barangay. Optional.</summary>
    public string AddressLine2 { get; set; }

    public string CityMunicipality { get; set; }
    public string Province { get; set; }
    public string PostalCode { get; set; }
    public string Country { get; set; } = DefaultCountry;

    /// <summary>Total farm area in hectares. Optional; pond areas (m²) are compared against it with a warning only.</summary>
    public decimal? TotalAreaHectares { get; set; }

    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string ContactName { get; set; }
    public string ContactPhone { get; set; }
    public string ContactEmail { get; set; }
    public string TimeZone { get; set; } = FarmClock.DefaultTimeZone;
    public int DocumentExpiryAlertDays { get; set; } = 30;

    /// <summary>No longer used: the stocking window was removed (DEC-76). The column stays so no migration is needed.</summary>
    public int StockingWindowDays { get; set; } = ReferenceData.FarmThresholds.DefaultStockingWindowDays;

    /// <summary>When an Owner confirmed the Farm Standards (onboarding checklist step, DEC-58).</summary>
    public System.DateTime? StandardsReviewedAtUtc { get; set; }

    /// <summary>Farm-level farming system; each pond inherits it unless the pond has its own override (spec Ref 4.1).</summary>
    public FarmingSystem FarmingSystem { get; set; } = FarmingSystem.SemiIntensive;

    /// <summary>How dates are shown on screens and printouts (spec Section 2, DEC-42).</summary>
    public FarmDateOrder DateOrder { get; set; } = FarmDateOrder.MonthFirst;

    /// <summary>False: 12-hour times (2:30 PM); true: 24-hour times (14:30).</summary>
    public bool Use24HourTime { get; set; }

    /// <summary>One-line address for printouts and report headers.</summary>
    public string FormatAddress() => FarmAddress.Format(AddressLine1, AddressLine2, CityMunicipality, Province, PostalCode, Country);
}

/// <summary>Address rules shared by sign-up and the farm profile.</summary>
public static class FarmAddress
{
    private static readonly Regex PhilippinePostalCode = new("^[0-9]{4}$");

    public static string Format(string line1, string line2, string city, string province, string postalCode, string country)
    {
        var provincePart = string.Join(" ", new[] { province, postalCode }.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()));
        return string.Join(", ", new[] { line1, line2, city, provincePart, country }.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()));
    }

    /// <summary>Required parts are enforced by the DTO attributes; this checks the postal code format.</summary>
    public static void Validate(string postalCode, string country)
    {
        if (string.IsNullOrWhiteSpace(postalCode))
        {
            return;
        }

        var isPhilippines = string.IsNullOrWhiteSpace(country) || country.Trim().Equals(FarmProfile.DefaultCountry, System.StringComparison.OrdinalIgnoreCase);
        if (isPhilippines && !PhilippinePostalCode.IsMatch(postalCode.Trim()))
        {
            throw new UserFriendlyException("A Philippine postal code has 4 digits (for example 9502).");
        }
    }

    public static string Clean(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

/// <summary>Map pin rules shared by sign-up and the farm profile (DEC-78).</summary>
public static class FarmLocation
{
    /// <summary>Ranges are enforced by the DTO attributes; this checks that a pin has both parts.</summary>
    public static void Validate(decimal? latitude, decimal? longitude)
    {
        if (latitude.HasValue != longitude.HasValue)
        {
            throw new UserFriendlyException("Enter both latitude and longitude, or leave both blank.");
        }
    }
}
