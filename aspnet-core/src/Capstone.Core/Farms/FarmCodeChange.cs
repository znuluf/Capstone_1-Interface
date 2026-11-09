using Abp.Domain.Entities;
using System;

namespace Capstone.Farms;

/// <summary>
/// One change of a farm's code (DEC-78). The old code stays reserved for ever: no farm, including this one, can take it
/// again, because old exports and logs carry it and the sign-in page uses it to point staff to the new code.
/// Not tied to a farm filter on purpose, so the uniqueness checks see every farm's history.
/// </summary>
public class FarmCodeChange : Entity<Guid>
{
    public const int MaxCodeLength = 64;
    public const int MaxNameLength = 200;

    public int TenantId { get; set; }

    public string OldCode { get; set; }

    public string NewCode { get; set; }

    public long? ChangedByUserId { get; set; }

    public string ChangedByName { get; set; }

    public DateTime ChangedAt { get; set; }
}
