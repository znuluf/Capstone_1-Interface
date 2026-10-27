using System;
using System.Threading.Tasks;

namespace Capstone.Domain;

/// <summary>Parent rows that cross-row checks lock before checking (spec Section 6, DEC-38).</summary>
public enum RowLockTarget { FryDelivery = 1, HarvestGradeLine = 2 }

/// <summary>
/// Takes an update lock on a parent row inside the current transaction, so two saves that check the same total
/// (for example PL left in a fry delivery) run one after the other instead of both passing the check.
/// </summary>
public interface IRowLocker
{
    Task LockAsync(RowLockTarget target, Guid id);
}
