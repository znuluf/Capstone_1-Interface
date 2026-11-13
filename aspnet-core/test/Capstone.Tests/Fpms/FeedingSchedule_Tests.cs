using Abp.UI;
using Capstone.Production;
using Shouldly;
using System;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>DEC-61: the farm's feeding schedule (number of feedings a day and their usual times).</summary>
public class FeedingSchedule_Tests
{
    [Fact]
    public void Blank_schedule_is_the_default_four_feedings()
    {
        FeedingSchedule.Parse(null).ShouldBe(new[] { "06:00", "10:00", "14:00", "18:00" });
        FeedingSchedule.Parse("  ").Count.ShouldBe(4);
    }

    [Fact]
    public void Schedule_is_read_trimmed_and_normalised()
    {
        FeedingSchedule.Parse(" 06:00 , 10:30,14:00 ").ShouldBe(new[] { "06:00", "10:30", "14:00" });
        FeedingSchedule.Parse("07:00").ShouldBe(new[] { "07:00" });
    }

    [Theory]
    [InlineData("6am,10am")]
    [InlineData("10:00,06:00")]
    [InlineData("06:00,06:00")]
    [InlineData("01:00,02:00,03:00,04:00,05:00,06:00,07:00,08:00,09:00")]
    public void Unreadable_or_unordered_schedules_are_rejected(string value)
    {
        Should.Throw<UserFriendlyException>(() => FeedingSchedule.Parse(value));
    }

    [Fact]
    public void Stored_garbage_falls_back_to_the_default()
    {
        FeedingSchedule.Times("not a schedule").Count.ShouldBe(4);
    }

    [Fact]
    public void Movement_time_prefers_the_typed_time_then_the_schedule()
    {
        var times = FeedingSchedule.Parse("06:00,10:00,14:00,18:00");
        FeedingSchedule.MovementTime(2, "09:45", times).ShouldBe(new TimeOnly(9, 45));
        FeedingSchedule.MovementTime(3, null, times).ShouldBe(new TimeOnly(14, 0));
        FeedingSchedule.MovementTime(5, null, times).ShouldBe(new TimeOnly(19, 0)); // a feeding beyond the schedule
        FeedingSchedule.MovementTime(8, null, FeedingSchedule.Parse("22:00")).ShouldBe(new TimeOnly(23, 59)); // never wraps past midnight
    }
}
