using Capstone.Production;
using Shouldly;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>
/// Reference batch indicators (Capstone-Planning.md Section 5 formulas; docs/reference-batch.md hand calculations).
/// 200,000 PL in 2,000 m²; feed 3 × 1,000 kg; mortality 10,000; samples 12 g then 20 g;
/// final harvest 2,500 kg (2,000 kg at 55/kg + 500 kg at 65/kg, ABW 17.5 g) on DOC 99.
/// </summary>
public class Indicator_Tests : FpmsTestBase
{
    [Fact]
    public async Task Reference_batch_indicators_match_hand_calculations()
    {
        var batch = await Resolve<BatchAppService>().Get(BatchId(ReferenceBatch));
        var i = batch.Indicators;

        i.StockingDensityPerM2.ShouldBe(100m);
        i.CumulativeFeedKg.ShouldBe(3000m);
        i.CumulativeMortality.ShouldBe(10000);
        i.HarvestedPieces.ShouldBe(142500m);
        i.TotalHarvestKg.ShouldBe(2500m);
        i.EstimatedPopulation.ShouldBe(47500m);       // 200,000 − 10,000 − 142,500
        i.LatestSampleAbwG.ShouldBe(20m);
        i.EstimatedBiomassKg.ShouldBe(950m);          // 47,500 × 20 g ÷ 1000
        i.FcrToDate.ShouldBe(0.870m);                 // 3,000 ÷ (950 + 2,500)
        i.FinalFcr.ShouldBe(1.2m);                    // 3,000 ÷ 2,500
        i.SurvivalRatePct.ShouldBe(71.25m);           // 142,500 ÷ 200,000 × 100
        i.CultureDays.ShouldBe(99);                   // 8 Sep − 1 Jun (Asia/Manila)
        i.CurrentAbwG.ShouldBe(17.5m);                // harvest ABW after the last sample
        i.FinalAbwG.ShouldBe(17.5m);
    }

    [Fact]
    public void Doc_counts_stocking_day_as_zero()
    {
        IndicatorCalculator.Doc(new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 1)).ShouldBe(0);
        IndicatorCalculator.Doc(new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 11)).ShouldBe(10);
    }

    [Fact]
    public void Abw_and_growth_rate()
    {
        IndicatorCalculator.Abw(2000m, 100).ShouldBe(20m);
        IndicatorCalculator.GrowthRate(12m, new DateOnly(2026, 8, 1), 20m, new DateOnly(2026, 9, 1)).ShouldBe(0.258m); // 8 g ÷ 31 days
    }

    [Fact]
    public void Harvested_pieces_without_grade_lines_use_abw()
    {
        var harvest = new HarvestFact { TotalKg = 100m, AbwG = 20m, GradeLines = new List<(decimal, decimal?)>() };
        IndicatorCalculator.HarvestedPieces(harvest, null).ShouldBe(5000m);
    }

    [Fact]
    public void Harvested_pieces_use_grade_mid_counts_abw_for_the_rest_and_a_final_count_first()
    {
        // 60 kg of 50/60 (mid 55) + 20 kg ungraded line + 20 kg not on any line, ABW 20 g.
        var harvest = new HarvestFact { TotalKg = 100m, AbwG = 20m, GradeLines = new List<(decimal, decimal?)> { (60m, 55m), (20m, null) } };
        IndicatorCalculator.HarvestedPieces(harvest, null).ShouldBe(3300m + 2000m);
        harvest.FinalCount = 5100;
        IndicatorCalculator.HarvestedPieces(harvest, null).ShouldBe(5100m);
    }

    [Fact]
    public void Farm_day_boundaries_use_asia_manila()
    {
        var zone = Domain.FarmClock.Resolve("Asia/Manila");
        // 23:30 Manila on 21 Oct is 15:30 UTC the same day.
        Domain.FarmClock.LocalDate(new DateTime(2026, 10, 21, 15, 30, 0, DateTimeKind.Utc), zone).ShouldBe(new DateOnly(2026, 10, 21));
        // 00:30 Manila on 22 Oct is 16:30 UTC on 21 Oct.
        Domain.FarmClock.LocalDate(new DateTime(2026, 10, 21, 16, 30, 0, DateTimeKind.Utc), zone).ShouldBe(new DateOnly(2026, 10, 22));
        Domain.FarmClock.StartOfDayUtc(new DateOnly(2026, 10, 22), zone).ShouldBe(new DateTime(2026, 10, 21, 16, 0, 0, DateTimeKind.Utc));
    }
}
