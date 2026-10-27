using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Capstone.Common;

/// <summary>A number written as-is (never treated as text, so a negative value is not given a formula-guard prefix).</summary>
public readonly record struct CsvNumber(string Text)
{
    public static CsvNumber Of(decimal? value, int decimals = 2) =>
        new(value.HasValue ? Math.Round(value.Value, decimals, MidpointRounding.AwayFromZero).ToString("F" + decimals, CultureInfo.InvariantCulture) : string.Empty);
}

/// <summary>
/// Builds a CSV file for Excel (spec Section 6, AC-27): UTF-8 with a byte-order mark, ISO 8601 dates and times in farm time
/// with the UTC offset, plain numbers without thousands separators, and a guard against formula injection: a text cell that
/// starts with =, +, -, @, a tab or a carriage return is prefixed with an apostrophe so Excel opens it as text.
/// </summary>
public sealed class CsvBuilder
{
    private readonly TimeZoneInfo _zone;
    private readonly StringBuilder _text = new();
    private readonly int _columns;

    public int RowCount { get; private set; }

    public CsvBuilder(TimeZoneInfo zone, params string[] headers)
    {
        _zone = zone;
        _columns = headers.Length;
        WriteLine(headers.Select(h => (object)h));
    }

    /// <summary>Adds a row. Supported cells: string, bool, DateOnly, DateTime (UTC), integers, decimal, <see cref="CsvNumber"/>, enums and null.</summary>
    public CsvBuilder Add(params object[] cells)
    {
        if (cells.Length != _columns)
        {
            throw new ArgumentException($"A row needs {_columns} cells but has {cells.Length}.");
        }

        WriteLine(cells);
        RowCount++;
        return this;
    }

    public byte[] ToBytes() => new UTF8Encoding(encoderShouldEmitUTF8Identifier: true).GetPreamble().Concat(Encoding.UTF8.GetBytes(_text.ToString())).ToArray();

    /// <summary>Quotes a text cell and applies the formula-injection guard.</summary>
    public static string Text(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        if (value[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
        {
            value = "'" + value;
        }

        return value.IndexOfAny(new[] { ',', '"', '\r', '\n' }) >= 0 ? "\"" + value.Replace("\"", "\"\"") + "\"" : value;
    }

    private string Cell(object cell) => cell switch
    {
        null => string.Empty,
        string s => Text(s),
        CsvNumber n => n.Text,
        bool b => b ? "Yes" : "No",
        DateOnly d => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        DateTime t => TimeZoneInfo.ConvertTime(new DateTimeOffset(DateTime.SpecifyKind(t, DateTimeKind.Utc)), _zone)
            .ToString("yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture),
        decimal m => CsvNumber.Of(m).Text,
        int or long or short or byte => Convert.ToString(cell, CultureInfo.InvariantCulture),
        Enum e => Text(e.ToString()),
        _ => Text(Convert.ToString(cell, CultureInfo.InvariantCulture)),
    };

    private void WriteLine(IEnumerable<object> cells) => _text.Append(string.Join(",", cells.Select(Cell))).Append("\r\n");
}
