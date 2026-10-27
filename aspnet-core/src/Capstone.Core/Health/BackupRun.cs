using Abp.Domain.Entities;
using System;

namespace Capstone.Health;

public enum BackupKind
{
    Full = 1,
    Log = 2,
    IntegrityCheck = 3,
    RestoreTest = 4,
    OffsiteCopy = 5,
}

/// <summary>
/// One run of a backup or maintenance job on the farm server (AC-26). The scripts in scripts/backup write a row after every run,
/// success or failure, so the System Administrator health page can tell when a backup has stopped. A system-level record:
/// it holds no farm data and belongs to no farm.
/// </summary>
public class BackupRun : Entity<long>
{
    public const int MaxFileNameLength = 260;
    public const int MaxMessageLength = 1000;
    public const int MaxHostLength = 100;

    public BackupKind Kind { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public DateTime? FinishedAtUtc { get; set; }
    public bool Succeeded { get; set; }
    public string FileName { get; set; }
    public long? SizeBytes { get; set; }
    public string Message { get; set; }
    public string Host { get; set; }
}

/// <summary>Size and free space of the database and its disk, read from SQL Server. Null values mean the server did not report them.</summary>
public class DatabaseMetrics
{
    public double? DataSizeGb { get; set; }
    public double? FreeDiskGb { get; set; }
    public double? FreeDiskPct { get; set; }
}

public interface IDatabaseMetrics
{
    /// <summary>Returns empty metrics (never throws) when the provider cannot report them.</summary>
    System.Threading.Tasks.Task<DatabaseMetrics> GetAsync();
}
