namespace Capstone.Authorization.Accounts.Dto;

public class IsTenantAvailableOutput
{
    public TenantAvailabilityState State { get; set; }

    public int? TenantId { get; set; }

    /// <summary>Set when the code was the code of a farm that has since changed it (DEC-78): the farm's current code.</summary>
    public string ReplacedByFarmCode { get; set; }

    public IsTenantAvailableOutput()
    {
    }

    public IsTenantAvailableOutput(TenantAvailabilityState state, int? tenantId = null)
    {
        State = state;
        TenantId = tenantId;
    }
}
