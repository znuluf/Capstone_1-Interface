using Abp.UI;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Capstone.Production;

/// <summary>
/// The farm's feeding schedule (DEC-61): how many feedings a day and their usual times. Feedings are numbered 1, 2, 3...
/// in the day's order; the number is the feeding session's key. Stored on the farm profile as "HH:mm" times separated by
/// commas, so the number of feedings is the number of times. The partner farm feeds four times: 6 AM, 10 AM, 2 PM, 6 PM.
/// </summary>
public static class FeedingSchedule
{
    /// <summary>The most feedings a day the system accepts, whatever the farm's schedule says.</summary>
    public const int MaxFeedingsPerDay = 8;

    public const int MaxTimesLength = 6 * MaxFeedingsPerDay;

    public const string DefaultTimes = "06:00,10:00,14:00,18:00";

    /// <summary>The schedule's times in order. A blank or unreadable stored value falls back to the default schedule.</summary>
    public static List<string> Times(string stored)
    {
        try
        {
            return Parse(stored);
        }
        catch (UserFriendlyException)
        {
            return Parse(DefaultTimes);
        }
    }

    /// <summary>
    /// Reads and checks a schedule typed on the farm profile: 1 to 8 times, each "HH:mm", in increasing order. A blank
    /// value is the default schedule. Returns the times in their stored form.
    /// </summary>
    public static List<string> Parse(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            value = DefaultTimes;
        }

        var times = new List<TimeOnly>();
        foreach (var part in value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!TimeOnly.TryParseExact(part, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t))
            {
                throw new UserFriendlyException($"'{part}' is not a time. Enter each feeding time as hours and minutes, for example 06:00.");
            }

            times.Add(t);
        }

        if (times.Count == 0 || times.Count > MaxFeedingsPerDay)
        {
            throw new UserFriendlyException($"Enter between 1 and {MaxFeedingsPerDay} feeding times.");
        }

        for (var i = 1; i < times.Count; i++)
        {
            if (times[i] <= times[i - 1])
            {
                throw new UserFriendlyException("List the feeding times from earliest to latest, each time once.");
            }
        }

        return times.Select(t => t.ToString("HH:mm", CultureInfo.InvariantCulture)).ToList();
    }

    /// <summary>The stored form of a checked schedule.</summary>
    public static string Format(IEnumerable<string> times) => string.Join(",", times);

    /// <summary>"Feeding 2", used in messages, the stock ledger and exports.</summary>
    public static string Label(int feedingNo) => $"Feeding {feedingNo}";

    /// <summary>
    /// The time of day used for a feeding's stock movements: the typed time of feeding (DEC-71) if any, else the schedule's
    /// usual time for that feeding, else (a feeding beyond the schedule) one hour after the schedule's last time.
    /// </summary>
    public static TimeOnly MovementTime(int feedingNo, string fedAtTime, IReadOnlyList<string> times)
    {
        if (!string.IsNullOrEmpty(fedAtTime) && TimeOnly.TryParseExact(fedAtTime, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var typed))
        {
            return typed;
        }

        TimeOnly At(int index) => TimeOnly.ParseExact(times[index], "HH:mm", CultureInfo.InvariantCulture);
        if (feedingNo >= 1 && feedingNo <= times.Count)
        {
            return At(feedingNo - 1);
        }

        var last = At(times.Count - 1);
        var later = last.AddHours(feedingNo - times.Count);
        return later < last ? new TimeOnly(23, 59) : later;
    }
}
