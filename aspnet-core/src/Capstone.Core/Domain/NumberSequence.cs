using Abp.Domain.Entities;
using System;
using System.Threading.Tasks;

namespace Capstone.Domain;

public enum NumberSequenceType { CycleCode = 1, DispatchReceipt = 2 }

/// <summary>
/// Per-farm counters for generated numbers (spec Section 5, DEC-43). A number is taken in the same transaction as the
/// record that uses it, under a row lock, so two saves can never get the same number. Numbers are never reused.
/// </summary>
public class NumberSequence : Entity<Guid>, IMustHaveTenant
{
    public const int MaxScopeLength = 30;

    public int TenantId { get; set; }
    public NumberSequenceType SequenceType { get; set; }

    /// <summary>What the counter restarts for, e.g. "2026-11-SHI" for cycle codes or "2026" for dispatch receipts.</summary>
    public string Scope { get; set; }

    /// <summary>The value the next caller receives.</summary>
    public int NextValue { get; set; } = 1;
}

/// <summary>Takes the next number of a sequence inside the current unit of work.</summary>
public interface INumberSequenceGenerator
{
    Task<int> NextAsync(NumberSequenceType type, string scope);
}
