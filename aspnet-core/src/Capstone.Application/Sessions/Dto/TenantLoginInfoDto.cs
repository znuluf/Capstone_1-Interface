using Abp.Application.Services.Dto;
using Abp.AutoMapper;
using Capstone.MultiTenancy;

namespace Capstone.Sessions.Dto;

[AutoMapFrom(typeof(Tenant))]
public class TenantLoginInfoDto : EntityDto
{
    public string TenancyName { get; set; }

    public string Name { get; set; }

    public string FarmName { get; set; }

    public string TimeZone { get; set; }

    /// <summary>1 = Month first, 2 = Day first (FarmDateOrder).</summary>
    public int DateOrder { get; set; } = 1;

    public bool Use24HourTime { get; set; }

    /// <summary>The farm grades harvests by size (DEC-100); the screens leave grades out when false.</summary>
    public bool UsesSizeGrading { get; set; }
}
