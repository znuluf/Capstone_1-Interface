using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Capstone.Web.Host.Startup
{
    /// <summary>
    /// Reports whether the SQL Server database is reachable. Exposed at /health.
    /// </summary>
    public class DatabaseHealthCheck : IHealthCheck
    {
        private readonly string _connectionString;

        public DatabaseHealthCheck(string connectionString)
        {
            _connectionString = connectionString;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    await connection.OpenAsync(cancellationToken);
                    return HealthCheckResult.Healthy();
                }
            }
            catch (Exception)
            {
                // Do not echo connection details or exception text to unauthenticated callers.
                return HealthCheckResult.Unhealthy("Database unreachable.");
            }
        }
    }
}
