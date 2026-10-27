using Microsoft.EntityFrameworkCore;
using System.Data.Common;

namespace Capstone.EntityFrameworkCore;

public static class CapstoneDbContextConfigurer
{
    /// <summary>
    /// Id lists in queries (for example <c>ids.Contains(x.Id)</c>) are sent as literal values instead of a JSON
    /// parameter: with the D-26 dataset the JSON form made SQL Server choose scan plans (3.6 s for 100 logs).
    /// </summary>
    private static void Sql(Microsoft.EntityFrameworkCore.Infrastructure.SqlServerDbContextOptionsBuilder sql)
    {
        sql.TranslateParameterizedCollectionsToConstants();
    }

    public static void Configure(DbContextOptionsBuilder<CapstoneDbContext> builder, string connectionString)
    {
        builder.UseSqlServer(connectionString, Sql);
    }

    public static void Configure(DbContextOptionsBuilder<CapstoneDbContext> builder, DbConnection connection)
    {
        builder.UseSqlServer(connection, Sql);
    }
}
