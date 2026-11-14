using Capstone.Production;
using Shouldly;
using System;
using System.Collections.Generic;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>DEC-101: figures as of a day use only the records up to that day, and say which records they came from.</summary>
public class IndicatorsAsOf_Tests
{
    private static readonly DateOnly Stocked = new(2026, 9, 14);
    private static DateOnly Day(int doc) => Stocked.AddDays(doc);
    private static DateTime At(int doc) => Day(doc).ToDateTime(new TimeOnly(1, 0), DateTimeKind.Utc);

    private static readonly Guid FirstSample = Guid.NewGuid();
    private static readonly Guid SecondSample = Guid.NewGuid();

    private static BatchFacts Facts() => new()
    {
        PlCountStocked = 100_000,
        PondAreaM2 = 1000,
        StockingDate = Stocked,
        CumulativeFeedKg = 300,
        CumulativeMortality = 3_000,
        Feeds = new List<FeedFact> { new() { Date = Day(10), Kg = 100 }, new() { Date = Day(30), Kg = 200 } },
        Mortalities = new List<MortalityFact>
        {
            new() { Date = Day(20), ObservedAtUtc = At(20), Count = 1_000 },
            new() { Date = Day(40), ObservedAtUtc = At(40), Count = 2_000 },
        },
        GrowthSamples = new List<GrowthSampleFact>
        {
            new() { LogId = FirstSample, Date = Day(25), ObservedAtUtc = At(25), AbwG = 5, EstimatedSurvivalPct = 90, SampleCount = 100, TotalSampleWeightG = 500 },
            new() { LogId = SecondSample, Date = Day(45), ObservedAtUtc = At(45), AbwG = 10 },
        },
    };

    [Fact]
    public void As_of_a_day_counts_only_the_records_up_to_that_day()
    {
        var day30 = IndicatorCalculator.Compute(Facts().AsOf(Day(30)), Day(30));
        day30.Doc.ShouldBe(30);
        day30.CumulativeFeedKg.ShouldBe(300m);
        day30.CumulativeMortality.ShouldBe(1_000);
        day30.CurrentAbwG.ShouldBe(5m);
        // 100,000 × 90% = 90,000 at the day-25 estimate; no mortality after it by day 30.
        day30.EstimatedPopulation.ShouldBe(90_000m);
        day30.EstimatedBiomassKg.ShouldBe(450m);
        day30.FcrToDate.ShouldBe(0.667m);

        var day15 = IndicatorCalculator.Compute(Facts().AsOf(Day(15)), Day(15));
        day15.CumulativeFeedKg.ShouldBe(100m);
        day15.CurrentAbwG.ShouldBeNull();
        day15.PopulationBasis.ShouldBe("Mortality");
    }

    [Fact]
    public void Figures_say_which_records_they_came_from()
    {
        var now = IndicatorCalculator.Compute(Facts(), Day(50));
        now.AbwSource.ShouldBe("Sample");
        now.AbwSourceId.ShouldBe(SecondSample);
        now.AbwSourceDate.ShouldBe(Day(45));

        // The population starts from the day-25 estimate, less the 2,000 dead logged after it.
        now.SurvivalEstimatePct.ShouldBe(90m);
        now.SurvivalEstimateLogId.ShouldBe(FirstSample);
        now.MortalitySubtracted.ShouldBe(2_000);
        now.EstimatedPopulation.ShouldBe(88_000m);
        now.PlCountStocked.ShouldBe(100_000);

        var day30 = IndicatorCalculator.Compute(Facts().AsOf(Day(30)), Day(30));
        day30.AbwSourceId.ShouldBe(FirstSample);
        day30.AbwSampleCount.ShouldBe(100);
        day30.AbwSampleWeightG.ShouldBe(500m);
    }
}
