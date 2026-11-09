namespace Capstone.EntityFrameworkCore.Seed;

/// <summary>Seed switches set by Web.Host / Migrator from configuration.</summary>
public static class SeedOptions
{
    /// <summary>Creates the two development test farms (D-27). Never enable on the farm server.</summary>
    public static bool SeedDevelopmentData { get; set; }

    /// <summary>Creates the single sample farm (gensan-semi) used by the Codespace FPMS_Sample database. Never enable on the farm server.</summary>
    public static bool SeedSampleData { get; set; }

    /// <summary>Creates the small sample farm (rkabubba-aqua, one closed intensive cycle) for the Codespace FPMS_Simple database. Never enable on the farm server.</summary>
    public static bool SeedSimpleSampleData { get; set; }

    /// <summary>SystemAdmin:InitialPassword. When empty, the development password is used.</summary>
    public static string SystemAdminInitialPassword { get; set; }

    /// <summary>Development password for seeded accounts (documented in docs/dev-accounts.md).</summary>
    public const string DevelopmentPassword = "Fpms@2026";
}
