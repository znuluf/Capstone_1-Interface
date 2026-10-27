using System;

namespace Capstone.Common;

public class LookupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public bool IsActive { get; set; } = true;
}

public class IdInput
{
    public Guid Id { get; set; }
}

public class SetActiveInput
{
    public Guid Id { get; set; }
    public bool IsActive { get; set; }
}

public class DateRangeInput
{
    /// <summary>Farm-local date (inclusive).</summary>
    public DateOnly? From { get; set; }

    /// <summary>Farm-local date (inclusive).</summary>
    public DateOnly? To { get; set; }
}

/// <summary>Validation messages that do not block saving (out-of-range readings, stock shortfalls, compliance gaps).</summary>
public class WarningDto
{
    public string Kind { get; set; }
    public string Message { get; set; }
}
