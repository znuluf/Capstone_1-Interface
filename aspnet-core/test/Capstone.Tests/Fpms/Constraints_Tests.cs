using Abp.Runtime.Validation;
using Abp.UI;
using Capstone.Authorization.Accounts;
using Capstone.Compliance;
using Capstone.Domain;
using Capstone.Farms;
using Capstone.Ponds;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Farm profile, pond and compliance rules introduced by decisions D-30 to D-32.</summary>
public class Constraints_Tests : FpmsTestBase
{
    private static DateOnly FarmToday() => FarmClock.Today(FarmClock.Resolve(FarmClock.DefaultTimeZone));

    private Guid Category(string name)
    {
        var tenantId = GetTenantId(PilotFarm);
        return Q(c => c.DocumentCategories.IgnoreQueryFilters().Single(x => x.TenantId == tenantId && x.Name == name).Id);
    }

    private Guid Preset(string name)
    {
        var tenantId = GetTenantId(PilotFarm);
        return Q(c => c.DocumentPresets.IgnoreQueryFilters().Single(x => x.TenantId == tenantId && x.Name == name).Id);
    }

    private SaveDocumentInput Ecc(string number = "ECC-R12-2026-8891") => new()
    {
        CategoryId = Category("Environmental (DENR)"),
        PresetId = Preset("Environmental Compliance Certificate (ECC)"),
        DocumentNumber = number,
        IssuingAgency = "DENR - EMB Regional Office XII",
        IssueDate = FarmToday().AddDays(-30),
        IsPerpetual = true,
        Notes = "Hard copy stored in Binder #2 at Farm Office",
    };

    private SaveDocumentInput MayorsPermit(string number = "BP-2026-0042") => new()
    {
        CategoryId = Category("Business and Local Permits"),
        PresetId = Preset("Mayor's / Business Permit"),
        DocumentNumber = number,
        IssueDate = FarmToday().AddDays(-300),
        ExpiryDate = FarmToday().AddDays(20),
    };

    // ---------------------------------------------------------------- compliance (D-30)

    [Fact]
    public async Task Record_is_saved_from_a_preset_with_reference_number_agency_and_notes()
    {
        var compliance = Resolve<ComplianceAppService>();
        var id = await compliance.CreateDocument(Ecc());
        var d = await compliance.GetDocument(id);
        d.Title.ShouldBe("Environmental Compliance Certificate (ECC)");
        d.DocumentNumber.ShouldBe("ECC-R12-2026-8891");
        d.IssuingAgency.ShouldBe("DENR - EMB Regional Office XII");
        d.Notes.ShouldBe("Hard copy stored in Binder #2 at Farm Office");
        d.IsPerpetual.ShouldBeTrue();
        d.ExpiryStatus.ShouldBe(ExpiryStatus.NoExpiry);
        (await compliance.GetStatus()).MissingPermits.ShouldNotContain("Environmental Compliance Certificate (ECC)");
    }

    [Fact]
    public async Task Perpetual_is_refused_when_the_category_requires_an_expiry_date()
    {
        var input = MayorsPermit();
        input.IsPerpetual = true;
        input.ExpiryDate = null;
        var ex = await Should.ThrowAsync<UserFriendlyException>(() => Resolve<ComplianceAppService>().CreateDocument(input));
        ex.Message.ShouldContain("cannot be perpetual");
    }

    [Fact]
    public async Task Expiry_date_is_required_unless_perpetual_and_not_before_the_issue_date()
    {
        var compliance = Resolve<ComplianceAppService>();
        var noExpiry = Ecc();
        noExpiry.IsPerpetual = false;
        await Should.ThrowAsync<UserFriendlyException>(() => compliance.CreateDocument(noExpiry));

        var backwards = MayorsPermit();
        backwards.ExpiryDate = backwards.IssueDate.Value.AddDays(-1);
        await Should.ThrowAsync<UserFriendlyException>(() => compliance.CreateDocument(backwards));

        var futureIssue = MayorsPermit();
        futureIssue.IssueDate = FarmToday().AddDays(1);
        await Should.ThrowAsync<UserFriendlyException>(() => compliance.CreateDocument(futureIssue));
    }

    [Fact]
    public async Task Perpetual_records_ignore_a_submitted_expiry_date()
    {
        var input = Ecc();
        input.ExpiryDate = FarmToday().AddYears(3);
        var compliance = Resolve<ComplianceAppService>();
        var d = await compliance.GetDocument(await compliance.CreateDocument(input));
        d.ExpiryDate.ShouldBeNull();
    }

    [Fact]
    public async Task Reference_number_is_unique_within_a_category_among_current_records()
    {
        var compliance = Resolve<ComplianceAppService>();
        var first = await compliance.CreateDocument(MayorsPermit());
        var ex = await Should.ThrowAsync<UserFriendlyException>(() => compliance.CreateDocument(MayorsPermit()));
        ex.Message.ShouldContain("already recorded");

        // Archived records are history: the number can be used again, but the archived one cannot be restored over it.
        await compliance.SetArchived(new ArchiveDocumentInput { Id = first, IsArchived = true });
        await compliance.CreateDocument(MayorsPermit());
        await Should.ThrowAsync<UserFriendlyException>(() => compliance.SetArchived(new ArchiveDocumentInput { Id = first, IsArchived = false }));
    }

    [Fact]
    public async Task Preset_must_belong_to_the_category_and_custom_records_need_a_title()
    {
        var compliance = Resolve<ComplianceAppService>();
        var mismatch = Ecc();
        mismatch.CategoryId = Category("Business and Local Permits");
        await Should.ThrowAsync<UserFriendlyException>(() => compliance.CreateDocument(mismatch));

        var custom = new SaveDocumentInput { CategoryId = Category("Other"), DocumentNumber = "X-1", IsPerpetual = true };
        await Should.ThrowAsync<UserFriendlyException>(() => compliance.CreateDocument(custom));
        custom.Title = "Lease contract with landowner";
        (await compliance.GetDocument(await compliance.CreateDocument(custom))).Title.ShouldBe("Lease contract with landowner");
    }

    [Fact]
    public async Task Reference_number_is_required()
    {
        var input = MayorsPermit();
        input.DocumentNumber = "";
        await Should.ThrowAsync<AbpValidationException>(() => Resolve<ComplianceAppService>().CreateDocument(input));
    }

    [Fact]
    public async Task Renewal_archives_the_old_record_and_stops_its_reminders()
    {
        var compliance = Resolve<ComplianceAppService>();
        var oldId = await compliance.CreateDocument(MayorsPermit());
        (await compliance.GetDocument(oldId)).ExpiryStatus.ShouldBe(ExpiryStatus.ExpiringSoon);

        var renewal = MayorsPermit("BP-2027-0042");
        var newId = await compliance.RenewDocument(new RenewDocumentInput
        {
            RenewedFromId = oldId, CategoryId = renewal.CategoryId, PresetId = renewal.PresetId, DocumentNumber = renewal.DocumentNumber,
            IssueDate = FarmToday(), ExpiryDate = FarmToday().AddYears(1),
        });

        (await compliance.GetDocument(oldId)).IsArchived.ShouldBeTrue();
        var renewed = await compliance.GetDocument(newId);
        renewed.RenewedFromId.ShouldBe(oldId);
        renewed.ExpiryStatus.ShouldBe(ExpiryStatus.Active);
        (await compliance.GetDocuments(new GetDocumentsInput())).Select(d => d.Id).ShouldNotContain(oldId);

        await Should.ThrowAsync<UserFriendlyException>(() => compliance.RenewDocument(new RenewDocumentInput
        {
            RenewedFromId = oldId, CategoryId = renewal.CategoryId, PresetId = renewal.PresetId, DocumentNumber = "BP-again", ExpiryDate = FarmToday().AddYears(1),
        }));
    }

    [Fact]
    public async Task Failed_renewal_leaves_the_old_record_current()
    {
        var compliance = Resolve<ComplianceAppService>();
        var oldId = await compliance.CreateDocument(MayorsPermit());
        await Should.ThrowAsync<UserFriendlyException>(() => compliance.RenewDocument(new RenewDocumentInput
        {
            RenewedFromId = oldId, CategoryId = Category("Business and Local Permits"), PresetId = Preset("Mayor's / Business Permit"),
            DocumentNumber = "BP-2027-0042", IsPerpetual = true,
        }));
        (await compliance.GetDocument(oldId)).IsArchived.ShouldBeFalse();
    }

    [Fact]
    public async Task Search_matches_title_number_and_agency()
    {
        var compliance = Resolve<ComplianceAppService>();
        await compliance.CreateDocument(Ecc());
        await compliance.CreateDocument(MayorsPermit());
        (await compliance.GetDocuments(new GetDocumentsInput { Search = "8891" })).Count.ShouldBe(1);
        (await compliance.GetDocuments(new GetDocumentsInput { Search = "EMB" })).Count.ShouldBe(1);
        (await compliance.GetDocuments(new GetDocumentsInput { Search = "Mayor" })).Count.ShouldBe(1);
    }

    [Fact]
    public async Task Presets_can_be_added_and_marked_required()
    {
        var compliance = Resolve<ComplianceAppService>();
        var category = Category("Environmental (DENR)");
        var saved = await compliance.SavePreset(new DocumentPresetDto { CategoryId = category, Name = "Mangrove Rehabilitation Agreement", IsRequired = true });
        saved.Id.ShouldNotBe(Guid.Empty);
        (await compliance.GetStatus()).MissingPermits.ShouldContain("Mangrove Rehabilitation Agreement");
        await Should.ThrowAsync<UserFriendlyException>(() => compliance.SavePreset(new DocumentPresetDto { CategoryId = category, Name = "Mangrove Rehabilitation Agreement" }));
        (await compliance.GetCategories()).Single(c => c.Id == category).Presets.ShouldContain(p => p.Name == "Mangrove Rehabilitation Agreement" && p.IsRequired);
    }

    // ---------------------------------------------------------------- farm profile (D-31)

    private async Task<FarmProfileDto> Profile() => await Resolve<FarmProfileAppService>().Get();

    [Fact]
    public async Task Profile_saves_the_split_address_and_formats_it_on_one_line()
    {
        var service = Resolve<FarmProfileAppService>();
        var p = await Profile();
        p.AddressLine1 = "Purok 5, Sitio Lote";
        p.AddressLine2 = "Brgy. Tinoto";
        p.PostalCode = "9502";
        await service.Update(p);
        var saved = await Profile();
        saved.FullAddress.ShouldBe("Purok 5, Sitio Lote, Brgy. Tinoto, Maasim, Sarangani 9502, Philippines");
        saved.Country.ShouldBe("Philippines");
    }

    [Fact]
    public async Task Philippine_postal_code_must_have_four_digits()
    {
        var p = await Profile();
        p.PostalCode = "95O2";
        await Should.ThrowAsync<UserFriendlyException>(() => Resolve<FarmProfileAppService>().Update(p));
        p.Country = "Indonesia";
        p.PostalCode = "95123";
        await Resolve<FarmProfileAppService>().Update(p);
    }

    [Fact]
    public async Task Required_address_parts_are_enforced()
    {
        var p = await Profile();
        p.CityMunicipality = "";
        await Should.ThrowAsync<AbpValidationException>(() => Resolve<FarmProfileAppService>().Update(p));
    }

    [Fact]
    public async Task Pond_area_larger_than_the_farm_area_is_a_warning_not_an_error()
    {
        var service = Resolve<FarmProfileAppService>();
        var p = await Profile();
        p.PondAreaHectares.ShouldBeGreaterThan(0m);

        p.TotalAreaHectares = 0.01m;
        var warnings = await service.Update(p);
        warnings.ShouldContain(w => w.Kind == "FarmArea");
        (await Profile()).TotalAreaHectares.ShouldBe(0.01m);

        p.TotalAreaHectares = 500m;
        (await service.Update(p)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Registration_requires_the_address_parts()
    {
        AbpSession.TenantId = null;
        AbpSession.UserId = null;
        await Should.ThrowAsync<AbpValidationException>(() => Resolve<AccountAppService>().RegisterFarm(new Authorization.Accounts.Dto.RegisterFarmInput
        {
            FarmCode = "no-city", FarmName = "No City Farm", AddressLine1 = "Purok 1", Province = "Sarangani",
            OwnerName = "N", OwnerSurname = "C", OwnerUserName = "nocity", OwnerEmailAddress = "nocity@example.test", OwnerPassword = "Register1x",
        }));
    }

    // ---------------------------------------------------------------- ponds (D-32)

    [Theory]
    [InlineData(PondConstructionType.Concrete, FarmingSystem.Extensive, true)]
    [InlineData(PondConstructionType.HdpeLined, FarmingSystem.Extensive, true)]
    [InlineData(PondConstructionType.Earthen, FarmingSystem.Extensive, false)]
    [InlineData(PondConstructionType.Earthen, FarmingSystem.Intensive, false)]
    [InlineData(PondConstructionType.HdpeLined, FarmingSystem.Intensive, false)]
    [InlineData(PondConstructionType.Concrete, FarmingSystem.SemiIntensive, false)]
    public void Unusual_farming_system_and_pond_type_combinations_are_flagged(PondConstructionType construction, FarmingSystem system, bool flagged)
    {
        (PondSystemRules.GetWarning(construction, system) != null).ShouldBe(flagged);
    }

    [Fact]
    public async Task Unusual_pond_is_saved_and_shows_the_warning()
    {
        var ponds = Resolve<PondAppService>();
        var id = await ponds.Create(new PondEditDto
        {
            PrefixId = PrefixId("GP"), AreaM2 = 800, AverageDepthM = 1.4m, MaxDepthM = 1.6m,
            Purpose = PondPurpose.GrowOut, ConstructionType = PondConstructionType.Concrete, FarmingSystemOverride = FarmingSystem.Extensive,
        });
        (await ponds.Get(id)).SystemWarning.ShouldNotBeNull();
        (await ponds.GetAll()).Single(p => p.Id == id).SystemWarning.ShouldNotBeNull();
    }
}
