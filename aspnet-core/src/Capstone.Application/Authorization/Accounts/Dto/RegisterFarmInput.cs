using Abp.Auditing;
using Abp.Authorization.Users;
using Capstone.Farms;
using Capstone.Validation;
using System.ComponentModel.DataAnnotations;

namespace Capstone.Authorization.Accounts.Dto;

public class RegisterFarmInput
{
    [Required]
    [StringLength(20, MinimumLength = 2)]
    [RegularExpression("^\\s*[a-zA-Z][a-zA-Z0-9-]{1,19}\\s*$", ErrorMessage = FarmProvisioningManager.FarmCodeRuleMessage)]
    public string FarmCode { get; set; }

    [Required]
    [StringLength(FarmProfile.MaxFarmNameLength)]
    public string FarmName { get; set; }

    [Required]
    [StringLength(FarmProfile.MaxAddressLineLength)]
    public string AddressLine1 { get; set; }

    [StringLength(FarmProfile.MaxAddressLineLength)]
    public string AddressLine2 { get; set; }

    [Required]
    [StringLength(FarmProfile.MaxCityLength)]
    public string CityMunicipality { get; set; }

    [Required]
    [StringLength(FarmProfile.MaxProvinceLength)]
    public string Province { get; set; }

    [StringLength(FarmProfile.MaxPostalCodeLength)]
    public string PostalCode { get; set; }

    [Required]
    [StringLength(FarmProfile.MaxCountryLength)]
    public string Country { get; set; } = FarmProfile.DefaultCountry;

    [Range(typeof(decimal), "0.01", "100000", ErrorMessage = "Total area must be between 0.01 and 100,000 hectares.")]
    public decimal? TotalAreaHectares { get; set; }

    [StringLength(100)]
    public string ContactName { get; set; }

    [StringLength(50)]
    public string ContactPhone { get; set; }

    [OptionalEmailAddress]
    [StringLength(256)]
    public string ContactEmail { get; set; }


    [Required]
    [StringLength(AbpUserBase.MaxNameLength)]
    public string OwnerName { get; set; }

    [Required]
    [StringLength(AbpUserBase.MaxSurnameLength)]
    public string OwnerSurname { get; set; }

    [Required]
    [StringLength(AbpUserBase.MaxUserNameLength)]
    public string OwnerUserName { get; set; }

    [Required]
    [EmailAddress]
    [StringLength(AbpUserBase.MaxEmailAddressLength)]
    public string OwnerEmailAddress { get; set; }

    [Required]
    [StringLength(AbpUserBase.MaxPlainPasswordLength)]
    [DisableAuditing]
    public string OwnerPassword { get; set; }
}

public class RegisterFarmOutput
{
    public string FarmCode { get; set; }
    public int TenantId { get; set; }
    public bool CanLogin { get; set; }
}

public class RegistrationStatusOutput
{
    public bool IsEnabled { get; set; }
}

/// <summary>What the person has typed so far on the registration form (DEC-75).</summary>
public class GetRegistrationSuggestionsInput
{
    [StringLength(FarmProfile.MaxFarmNameLength)]
    public string FarmName { get; set; }

    [StringLength(AbpUserBase.MaxNameLength)]
    public string OwnerName { get; set; }

    [StringLength(AbpUserBase.MaxSurnameLength)]
    public string OwnerSurname { get; set; }
}

/// <summary>Suggested farm code and Owner username; the form fills them in and the person can change them.</summary>
public class RegistrationSuggestionsOutput
{
    /// <summary>Null when no farm name was given.</summary>
    public string FarmCode { get; set; }

    /// <summary>Null when the Owner's first name and surname are both blank.</summary>
    public string OwnerUserName { get; set; }
}
