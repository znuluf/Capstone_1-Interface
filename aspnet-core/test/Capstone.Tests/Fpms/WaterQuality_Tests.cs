using Abp.UI;
using Capstone.ReferenceData;
using Shouldly;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>GAqP flag-not-block behaviour and boundaries (D-09, AC-11, AC-20; Section 6 logbook checkpoints).</summary>
public class WaterQuality_Tests : FpmsTestBase
{
    [Theory]
    // PNS/BAFS 197:2025 Annex B defaults (DEC-56); boundaries from the spec's test list.
    [InlineData(ParameterCodes.DO, "4.0", false)]
    [InlineData(ParameterCodes.DO, "3.9", true)]
    [InlineData(ParameterCodes.DO, "12", false)]
    [InlineData(ParameterCodes.Temperature, "30.0", false)]
    [InlineData(ParameterCodes.Temperature, "30.1", true)]
    [InlineData(ParameterCodes.Temperature, "24.9", true)]
    [InlineData(ParameterCodes.PH, "7.5", false)]
    [InlineData(ParameterCodes.PH, "9.0", false)]
    [InlineData(ParameterCodes.PH, "7.4", true)]
    [InlineData(ParameterCodes.PH, "9.1", true)]
    [InlineData(ParameterCodes.Salinity, "25.0", false)]
    [InlineData(ParameterCodes.Salinity, "25.1", true)]
    [InlineData(ParameterCodes.Salinity, "14.9", true)]
    [InlineData(ParameterCodes.Tan, "1.0", false)]
    [InlineData(ParameterCodes.Tan, "1.01", true)]
    [InlineData(ParameterCodes.Tan, "0.01", false)] // low TAN is not flagged
    [InlineData(ParameterCodes.Nitrite, "0.50", false)]
    [InlineData(ParameterCodes.Nitrite, "0.51", true)]
    [InlineData(ParameterCodes.Alkalinity, "100", false)]
    [InlineData(ParameterCodes.Alkalinity, "200", false)]
    [InlineData(ParameterCodes.Alkalinity, "99", true)]
    [InlineData(ParameterCodes.Alkalinity, "201", true)]
    [InlineData(ParameterCodes.Nitrate, "1.2", false)]
    [InlineData(ParameterCodes.Nitrate, "1.3", true)]
    public async Task Readings_are_flagged_against_optimal_ranges(string code, string value, bool expectedOutOfRange)
    {
        var result = await InUow(() => Resolve<WaterQualityEvaluator>().EvaluateAsync(new[] { (code, decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture)) }, requireStockingSet: false));
        result.Single().IsOutOfRange.ShouldBe(expectedOutOfRange);
    }

    [Theory]
    [InlineData(ParameterCodes.PH, "15")]
    [InlineData(ParameterCodes.DO, "-1")]
    [InlineData(ParameterCodes.Temperature, "46")]
    public async Task Physically_impossible_readings_are_rejected(string code, string value)
    {
        await Should.ThrowAsync<UserFriendlyException>(() =>
            InUow(() => Resolve<WaterQualityEvaluator>().EvaluateAsync(new[] { (code, decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture)) }, requireStockingSet: false)));
    }

    [Fact]
    public async Task Stocking_requires_temperature_salinity_ph_and_do()
    {
        await Should.ThrowAsync<UserFriendlyException>(() =>
            InUow(() => Resolve<WaterQualityEvaluator>().EvaluateAsync(new[] { (ParameterCodes.PH, 7.5m) }, requireStockingSet: true)));
    }
}
