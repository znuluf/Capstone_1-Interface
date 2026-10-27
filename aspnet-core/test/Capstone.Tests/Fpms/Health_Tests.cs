using Abp.Auditing;
using Abp.Authorization;
using Capstone.Health;
using Shouldly;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Step F2: the health page, backup history and the AC-26 alert rules.</summary>
public class Health_Tests : FpmsTestBase
{
    private static readonly DateTime Now = new(2026, 10, 27, 12, 0, 0, DateTimeKind.Utc);

    /// <summary>Facts for a healthy server: every job ran recently, plenty of disk, small database, certificate far from expiry.</summary>
    private static HealthFacts Healthy() => new()
    {
        NowUtc = Now,
        DatabaseSizeGb = 2,
        FreeDiskPct = 60,
        LastFullBackupUtc = Now.AddHours(-5),
        LastLogBackupUtc = Now.AddMinutes(-20),
        LastIntegrityCheckUtc = Now.AddDays(-3),
        LastOffsiteCopyUtc = Now.AddDays(-3),
        CertificateExpiresUtc = Now.AddDays(200),
        ErrorsLast24Hours = 0,
    };

    private static string[] Codes(HealthFacts f) => HealthEvaluator.Evaluate(f).Select(a => a.Code).ToArray();

    // ---------------------------------------------------------------- the alert rules (AC-26)
    [Fact]
    public void A_healthy_server_raises_no_alert()
    {
        HealthEvaluator.Evaluate(Healthy()).ShouldBeEmpty();
    }

    [Fact]
    public void The_log_backup_alert_fires_after_one_hour_and_when_none_was_ever_recorded()
    {
        var f = Healthy();
        f.LastLogBackupUtc = Now.AddMinutes(-59);
        Codes(f).ShouldBeEmpty();
        f.LastLogBackupUtc = Now.AddMinutes(-61);
        var alert = HealthEvaluator.Evaluate(f).Single();
        alert.Code.ShouldBe("LOG_BACKUP");
        alert.Severity.ShouldBe(AlertSeverity.Critical);
        alert.Message.ShouldContain("61 minutes");
        f.LastLogBackupUtc = null;
        Codes(f).ShouldBe(new[] { "LOG_BACKUP" });
    }

    [Fact]
    public void The_full_backup_alert_fires_after_26_hours()
    {
        var f = Healthy();
        f.LastFullBackupUtc = Now.AddHours(-25);
        Codes(f).ShouldBeEmpty();
        f.LastFullBackupUtc = Now.AddHours(-27);
        HealthEvaluator.Evaluate(f).Single().Severity.ShouldBe(AlertSeverity.Critical);
        Codes(f).ShouldBe(new[] { "FULL_BACKUP" });
        f.LastFullBackupUtc = null;
        Codes(f).ShouldBe(new[] { "FULL_BACKUP" });
    }

    [Fact]
    public void Weekly_jobs_warn_after_eight_days()
    {
        var f = Healthy();
        f.LastIntegrityCheckUtc = Now.AddDays(-9);
        f.LastOffsiteCopyUtc = Now.AddDays(-9);
        var alerts = HealthEvaluator.Evaluate(f);
        alerts.Select(a => a.Code).ShouldBe(new[] { "INTEGRITY_CHECK", "OFFSITE_COPY" });
        alerts.ShouldAllBe(a => a.Severity == AlertSeverity.Warning);
    }

    [Fact]
    public void Database_size_warns_at_7_gb_and_is_critical_at_9_gb()
    {
        var f = Healthy();
        f.DatabaseSizeGb = 6.9;
        Codes(f).ShouldBeEmpty();
        f.DatabaseSizeGb = 7.2;
        HealthEvaluator.Evaluate(f).Single().Severity.ShouldBe(AlertSeverity.Warning);
        f.DatabaseSizeGb = 9.4;
        HealthEvaluator.Evaluate(f).Single().Severity.ShouldBe(AlertSeverity.Critical);
    }

    [Fact]
    public void Free_disk_below_15_percent_is_critical_and_unknown_free_disk_is_not_an_alert()
    {
        var f = Healthy();
        f.FreeDiskPct = 15;
        Codes(f).ShouldBeEmpty();
        f.FreeDiskPct = 14.9;
        HealthEvaluator.Evaluate(f).Single().Code.ShouldBe("DISK_FREE");
        f.FreeDiskPct = null;
        Codes(f).ShouldBeEmpty();
    }

    [Fact]
    public void The_certificate_warns_30_days_before_expiry_and_is_critical_once_expired()
    {
        var f = Healthy();
        f.CertificateExpiresUtc = Now.AddDays(31);
        Codes(f).ShouldBeEmpty();
        f.CertificateExpiresUtc = Now.AddDays(30).AddHours(-1);
        var warn = HealthEvaluator.Evaluate(f).Single();
        warn.Severity.ShouldBe(AlertSeverity.Warning);
        warn.Message.ShouldContain("29 days");
        f.CertificateExpiresUtc = Now.AddDays(-1);
        HealthEvaluator.Evaluate(f).Single().Severity.ShouldBe(AlertSeverity.Critical);
        f.CertificateExpiresUtc = null;
        Codes(f).ShouldBeEmpty();
    }

    [Fact]
    public void A_failed_latest_run_is_critical_and_quotes_the_message()
    {
        var f = Healthy();
        f.LatestRunPerKind = new List<BackupRun>
        {
            new() { Kind = BackupKind.Full, StartedAtUtc = Now.AddHours(-1), Succeeded = false, Message = "Disk full" },
            new() { Kind = BackupKind.Log, StartedAtUtc = Now.AddMinutes(-10), Succeeded = true },
        };
        var alert = HealthEvaluator.Evaluate(f).Single();
        alert.Code.ShouldBe("RUN_FAILED_FULL");
        alert.Severity.ShouldBe(AlertSeverity.Critical);
        alert.Message.ShouldContain("Disk full");
    }

    [Fact]
    public void Many_server_errors_warn()
    {
        var f = Healthy();
        f.ErrorsLast24Hours = 24;
        Codes(f).ShouldBeEmpty();
        f.ErrorsLast24Hours = 25;
        Codes(f).ShouldBe(new[] { "ERRORS" });
    }

    [Fact]
    public void Critical_alerts_are_listed_before_warnings()
    {
        var f = Healthy();
        f.LastOffsiteCopyUtc = null;
        f.LastLogBackupUtc = null;
        HealthEvaluator.Evaluate(f).Select(a => a.Severity).ShouldBe(new[] { AlertSeverity.Critical, AlertSeverity.Warning });
    }

    // ---------------------------------------------------------------- the health page
    private void AddRun(BackupKind kind, DateTime startedAt, bool ok = true, string message = null) =>
        UsingDbContext(null, c => c.BackupRuns.Add(new BackupRun
        {
            Kind = kind, StartedAtUtc = startedAt, FinishedAtUtc = startedAt.AddMinutes(1), Succeeded = ok, Message = message,
            FileName = kind + ".bak", SizeBytes = 1024, Host = "farm-pc",
        }));

    private void AddAllRecentRuns()
    {
        AddRun(BackupKind.Full, DateTime.UtcNow.AddHours(-3));
        AddRun(BackupKind.Log, DateTime.UtcNow.AddMinutes(-10));
        AddRun(BackupKind.IntegrityCheck, DateTime.UtcNow.AddDays(-2));
        AddRun(BackupKind.OffsiteCopy, DateTime.UtcNow.AddDays(-2));
    }

    [Fact]
    public async Task The_health_page_reports_version_and_alerts_when_no_backup_was_ever_recorded()
    {
        LoginAsHostAdmin();
        var health = await Resolve<SystemHealthAppService>().GetHealth();
        health.AppVersion.ShouldBe(AppVersionHelper.Version);
        health.TimeZone.ShouldNotBeNullOrEmpty();
        health.LastFullBackupUtc.ShouldBeNull();
        health.Alerts.Select(a => a.Code).ShouldContain("LOG_BACKUP");
        health.Alerts.Select(a => a.Code).ShouldContain("FULL_BACKUP");
    }

    [Fact]
    public async Task Recorded_backup_runs_clear_the_backup_alerts_and_show_the_last_times()
    {
        AddAllRecentRuns();
        AddRun(BackupKind.Log, DateTime.UtcNow.AddHours(-5)); // older runs do not move "last"
        LoginAsHostAdmin();
        var health = await Resolve<SystemHealthAppService>().GetHealth();
        health.Alerts.ShouldBeEmpty();
        health.LastLogBackupUtc.Value.ShouldBeGreaterThan(DateTime.UtcNow.AddMinutes(-15));
        health.LastFullBackupUtc.ShouldNotBeNull();
    }

    [Fact]
    public async Task A_failed_run_does_not_count_as_the_last_good_backup()
    {
        AddAllRecentRuns();
        AddRun(BackupKind.Log, DateTime.UtcNow.AddMinutes(-2), ok: false, message: "Login failed");
        LoginAsHostAdmin();
        var health = await Resolve<SystemHealthAppService>().GetHealth();
        health.Alerts.Select(a => a.Code).ShouldContain("RUN_FAILED_LOG");
        health.LastLogBackupUtc.Value.ShouldBeLessThan(DateTime.UtcNow.AddMinutes(-5));
    }

    [Fact]
    public async Task Backup_history_is_paged_newest_first_and_can_show_failures_only()
    {
        for (var i = 0; i < 30; i++)
        {
            AddRun(BackupKind.Log, DateTime.UtcNow.AddMinutes(-30 * (i + 1)), ok: i != 4);
        }

        LoginAsHostAdmin();
        var service = Resolve<SystemHealthAppService>();
        var page = await service.GetBackupRuns(new BackupRunsInput());
        page.TotalCount.ShouldBe(30);
        page.Items.Count.ShouldBe(25);
        page.Items.Select(r => r.StartedAtUtc).ShouldBe(page.Items.Select(r => r.StartedAtUtc).OrderByDescending(x => x));
        var failed = await service.GetBackupRuns(new BackupRunsInput { FailedOnly = true });
        failed.TotalCount.ShouldBe(1);
        (await service.GetBackupRuns(new BackupRunsInput { Kind = BackupKind.Full })).TotalCount.ShouldBe(0);
    }

    [Fact]
    public async Task Only_the_system_administrator_opens_the_health_page()
    {
        LoginAsPilotOwner();
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<SystemHealthAppService>().GetHealth());
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<SystemHealthAppService>().GetBackupRuns(new BackupRunsInput()));
        LoginAsPilotTechnician();
        await Should.ThrowAsync<AbpAuthorizationException>(() => Resolve<SystemHealthAppService>().GetHealth());
    }

    // ---------------------------------------------------------------- the banner
    [Fact]
    public async Task The_banner_gives_the_owner_a_short_message_and_the_administrator_the_details()
    {
        LoginAsPilotOwner();
        var owner = await Resolve<HealthBannerAppService>().Get();
        owner.NeedsAttention.ShouldBeTrue(); // nothing is recorded yet in the test database
        owner.Message.ShouldContain("System Administrator");
        owner.Details.ShouldBeEmpty();

        LoginAsHostAdmin();
        var admin = await Resolve<HealthBannerAppService>().Get();
        admin.NeedsAttention.ShouldBeTrue();
        admin.Details.ShouldContain(d => d.Contains("transaction-log backup"));
    }

    [Fact]
    public async Task The_banner_is_empty_when_all_is_well_and_for_technicians()
    {
        AddAllRecentRuns();
        LoginAsPilotOwner();
        (await Resolve<HealthBannerAppService>().Get()).NeedsAttention.ShouldBeFalse();

        UsingDbContext(null, c => c.BackupRuns.RemoveRange(c.BackupRuns));
        LoginAsPilotTechnician();
        var tech = await Resolve<HealthBannerAppService>().Get();
        tech.NeedsAttention.ShouldBeFalse();
        tech.Details.ShouldBeEmpty();
    }

    // ---------------------------------------------------------------- retention
    [Fact]
    public void Request_audit_logs_older_than_12_months_are_purged_in_batches()
    {
        UsingDbContext(null, c =>
        {
            for (var i = 0; i < 620; i++)
            {
                c.AuditLogs.Add(new AuditLog { ServiceName = "Old", MethodName = "M", ExecutionTime = DateTime.UtcNow.AddMonths(-13).AddMinutes(i) });
            }

            c.AuditLogs.Add(new AuditLog { ServiceName = "Recent", MethodName = "M", ExecutionTime = DateTime.UtcNow.AddMonths(-11) });
        });
        var before = UsingDbContext(null, c => c.AuditLogs.Count());

        var worker = Resolve<AuditLogPurgeWorker>();
        worker.Purge(DateTime.UtcNow);

        UsingDbContext(null, c => c.AuditLogs.Count(a => a.ServiceName == "Old")).ShouldBe(0);
        UsingDbContext(null, c => c.AuditLogs.Count(a => a.ServiceName == "Recent")).ShouldBe(1);
        UsingDbContext(null, c => c.AuditLogs.Count()).ShouldBe(before - 620);
    }
}
