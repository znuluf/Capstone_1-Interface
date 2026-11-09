using Abp.Configuration;
using Abp.UI;
using Capstone.Authorization.Accounts.Dto;
using Capstone.Configuration;
using Capstone.Farms;
using System.Threading.Tasks;

namespace Capstone.Authorization.Accounts;

public class AccountAppService : CapstoneAppServiceBase, IAccountAppService
{
    private readonly FarmProvisioningManager _provisioning;
    private readonly AccountNameGenerator _names;

    public FarmCodeManager FarmCodes { get; set; }

    public AccountAppService(FarmProvisioningManager provisioning, AccountNameGenerator names)
    {
        _provisioning = provisioning;
        _names = names;
    }

    public virtual async Task<IsTenantAvailableOutput> IsTenantAvailable(IsTenantAvailableInput input)
    {
        var tenant = await TenantManager.FindByTenancyNameAsync(input.TenancyName);
        if (tenant == null)
        {
            // DEC-78: a code that a farm has since changed points to that farm's current code.
            return new IsTenantAvailableOutput(TenantAvailabilityState.NotFound)
            {
                ReplacedByFarmCode = await FarmCodes.FindCurrentCodeAsync(input.TenancyName),
            };
        }

        if (!tenant.IsActive)
        {
            return new IsTenantAvailableOutput(TenantAvailabilityState.InActive);
        }

        return new IsTenantAvailableOutput(TenantAvailabilityState.Available, tenant.Id);
    }

    public virtual async Task<RegistrationStatusOutput> GetRegistrationStatus()
    {
        return new RegistrationStatusOutput
        {
            IsEnabled = await SettingManager.GetSettingValueForApplicationAsync<bool>(AppSettingNames.RegistrationEnabled),
        };
    }

    /// <summary>
    /// Suggested farm code (from the farm name, numbered when taken) and Owner username (first initial and surname)
    /// for the registration form (DEC-75). Only while registration is open. The farm does not exist yet, so the
    /// Owner username needs no number.
    /// </summary>
    public virtual async Task<RegistrationSuggestionsOutput> GetRegistrationSuggestions(GetRegistrationSuggestionsInput input)
    {
        if (!(await GetRegistrationStatus()).IsEnabled)
        {
            throw new UserFriendlyException("Farm registration is currently disabled. Contact the System Administrator.");
        }

        var hasOwnerName = !string.IsNullOrWhiteSpace(input.OwnerName) || !string.IsNullOrWhiteSpace(input.OwnerSurname);
        return new RegistrationSuggestionsOutput
        {
            FarmCode = string.IsNullOrWhiteSpace(input.FarmName) ? null : await _names.SuggestFarmCodeAsync(input.FarmName),
            OwnerUserName = hasOwnerName ? await _names.SuggestUserNameAsync(null, input.OwnerName, input.OwnerSurname) : null,
        };
    }

    /// <summary>Farm Account Registration (Ref 1.1, AC-01): everything is created in one transaction.</summary>
    public virtual async Task<RegisterFarmOutput> RegisterFarm(RegisterFarmInput input)
    {
        if (AbpSession.UserId.HasValue)
        {
            throw new UserFriendlyException("Sign out before registering a new farm account.");
        }

        if (!(await GetRegistrationStatus()).IsEnabled)
        {
            throw new UserFriendlyException("Farm registration is currently disabled. Contact the System Administrator.");
        }

        // Registration runs in host context; the new farm becomes the tenant of the created records.
        using var hostScope = CurrentUnitOfWork.SetTenantId(null);
        var (tenant, _) = await _provisioning.CreateFarmAsync(new FarmRegistration
        {
            FarmCode = input.FarmCode,
            FarmName = input.FarmName,
            AddressLine1 = input.AddressLine1,
            AddressLine2 = input.AddressLine2,
            CityMunicipality = input.CityMunicipality,
            Province = input.Province,
            PostalCode = input.PostalCode,
            Country = input.Country,
            TotalAreaHectares = input.TotalAreaHectares,
            ContactName = input.ContactName,
            ContactPhone = input.ContactPhone,
            ContactEmail = input.ContactEmail,

            OwnerName = input.OwnerName,
            OwnerSurname = input.OwnerSurname,
            OwnerUserName = input.OwnerUserName,
            OwnerEmailAddress = input.OwnerEmailAddress,
            OwnerPassword = input.OwnerPassword,
        });

        return new RegisterFarmOutput { FarmCode = tenant.TenancyName, TenantId = tenant.Id, CanLogin = true };
    }
}
