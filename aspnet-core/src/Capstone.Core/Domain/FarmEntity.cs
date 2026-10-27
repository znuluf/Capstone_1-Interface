using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;
using System;

namespace Capstone.Domain;

/// <summary>
/// Base class for every farm-owned record. TenantId is the FarmId of the specification:
/// ABP's IMustHaveTenant data filter scopes every query to the signed-in farm and stamps new rows.
/// Keys are GUIDs (sequential on SQL Server) so that Phase 2 offline capture can create keys on devices.
/// </summary>
public abstract class FarmEntity : FullAuditedEntity<Guid>, IMustHaveTenant
{
    public int TenantId { get; set; }
}

/// <summary>Marker for farm-owned child rows that are not soft-deleted on their own.</summary>
public abstract class FarmChildEntity : Entity<Guid>, IMustHaveTenant
{
    public int TenantId { get; set; }
}
