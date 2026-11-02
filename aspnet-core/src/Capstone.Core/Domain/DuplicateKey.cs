using System;

namespace Capstone.Domain;

/// <summary>
/// Recognises a SQL Server unique-index violation (errors 2601 and 2627) inside a save exception, without a
/// reference to the SQL client from the domain layer. Used where two people can save the same code at once.
/// </summary>
public static class DuplicateKey
{
    public static bool Is(Exception exception)
    {
        for (var e = exception; e != null; e = e.InnerException)
        {
            if (e.GetType().Name == "SqlException" && e.GetType().GetProperty("Number")?.GetValue(e) is int number &&
                (number == 2601 || number == 2627))
            {
                return true;
            }
        }

        return false;
    }
}
