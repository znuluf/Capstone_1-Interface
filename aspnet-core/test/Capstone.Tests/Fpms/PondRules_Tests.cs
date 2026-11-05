using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.UI;
using Capstone.Ponds;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Which pond fields lock once a pond has been in production, and how a preparation round can be reopened or abandoned.</summary>
public class PondRules_Tests : FpmsTestBase
{
    // Seed: GP-01 has a closed batch and a running one, GP-03 only a running one, GP-02 only a closed one.
    private const string OpenPond = "GP-03";
    private const string ClosedOnlyPond = "GP-02";

    private async Task<Guid> NewPondAsync(int number)
    {
        var id = await Resolve<PondAppService>().Create(new PondEditDto
        {
            PrefixId = PrefixId("GP"), Number = number, AreaM2 = 1000, AverageDepthM = 1.2m, MaxDepthM = 1.5m,
        });
        return id;
    }

    [Fact]
    public async Task Area_depth_and_farming_system_are_locked_while_a_batch_is_open()
    {
        var ponds = Resolve<PondAppService>();
        var area = await ponds.Get(PondId(OpenPond));
        area.AreaM2 += 100;
        area.ChangeNote = "Re-surveyed";
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.Update(area));

        var depth = await ponds.Get(PondId(OpenPond));
        depth.MaxDepthM += 0.5m;
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.Update(depth));

        var system = await ponds.Get(PondId(OpenPond));
        system.FarmingSystemOverride = system.FarmingSystemOverride == FarmingSystem.Extensive ? FarmingSystem.Intensive : FarmingSystem.Extensive;
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.Update(system));
    }

    [Fact]
    public async Task Other_details_can_still_be_edited_while_a_batch_is_open()
    {
        var ponds = Resolve<PondAppService>();
        var pond = await ponds.Get(PondId(OpenPond));
        pond.AerationSystem = "4 x 1 HP paddlewheel";
        await ponds.Update(pond);
        (await ponds.Get(PondId(OpenPond))).AerationSystem.ShouldBe("4 x 1 HP paddlewheel");
    }

    [Fact]
    public async Task Area_can_be_corrected_after_the_batch_closes_but_needs_a_note_and_leaves_old_batches_alone()
    {
        var ponds = Resolve<PondAppService>();
        var pond = await ponds.Get(PondId(ClosedOnlyPond));
        var oldArea = pond.AreaM2;
        pond.AreaM2 = oldArea + 50;
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.Update(pond)); // no note

        pond.ChangeNote = "Re-surveyed after dredging";
        await ponds.Update(pond);

        var saved = await ponds.Get(PondId(ClosedOnlyPond));
        saved.AreaM2.ShouldBe(oldArea + 50);
        saved.History.First().Description.ShouldContain("Re-surveyed after dredging");
        Q(c => c.PondBatches.IgnoreQueryFilters().Where(b => b.PondId == saved.Id).Select(b => b.PondAreaM2AtStocking).Distinct().ToList())
            .ShouldAllBe(a => a == oldArea);
    }

    [Fact]
    public async Task Purpose_is_locked_once_any_batch_exists_but_free_before()
    {
        var ponds = Resolve<PondAppService>();
        var used = await ponds.Get(PondId(ClosedOnlyPond)); // closed batch only
        used.Purpose = PondPurpose.Nursery;
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.Update(used));

        var fresh = await ponds.Get(await NewPondAsync(30));
        fresh.Purpose = PondPurpose.Nursery;
        await ponds.Update(fresh);
        (await ponds.Get(fresh.Id)).Purpose.ShouldBe(PondPurpose.Nursery);
    }

    [Fact]
    public async Task A_pond_without_batches_can_change_everything()
    {
        var ponds = Resolve<PondAppService>();
        var pond = await ponds.Get(await NewPondAsync(31));
        pond.AreaM2 = 1500;
        pond.MaxDepthM = 2m;
        pond.ConstructionType = PondConstructionType.Concrete;
        pond.FarmingSystemOverride = FarmingSystem.Intensive;
        await ponds.Update(pond);
        var saved = await ponds.Get(pond.Id);
        saved.AreaM2.ShouldBe(1500);
        saved.ConstructionType.ShouldBe(PondConstructionType.Concrete);
    }

    [Fact]
    public async Task Inactive_default_prefix_gives_a_clear_message()
    {
        var ponds = Resolve<PondAppService>();
        await ponds.Create(new PondEditDto { AreaM2 = 1000, AverageDepthM = 1.2m, MaxDepthM = 1.5m, ConstructionType = PondConstructionType.Earthen }); // creates EP
        var ep = (await ponds.GetPrefixes()).Single(p => p.ShortCode == "EP");
        ep.IsActive = false;
        await ponds.UpdatePrefix(ep);

        var ex = await Should.ThrowAsync<UserFriendlyException>(() => ponds.Create(
            new PondEditDto { AreaM2 = 1000, AverageDepthM = 1.2m, MaxDepthM = 1.5m, ConstructionType = PondConstructionType.Earthen }));
        ex.Message.ShouldContain("default prefix");
    }

    private async Task<Guid> PondUnderPreparationAsync(int number, bool markPrepared)
    {
        var ponds = Resolve<PondAppService>();
        var id = await NewPondAsync(number);
        await ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = id, ObservedAt = DateTime.UtcNow.AddDays(-2), Description = "Drained and limed" });
        if (markPrepared)
        {
            await ponds.MarkPrepared(new EntityDto<Guid>(id));
        }

        return id;
    }

    [Fact]
    public async Task A_prepared_pond_can_be_reopened_and_prepared_again()
    {
        var ponds = Resolve<PondAppService>();
        var id = await PondUnderPreparationAsync(32, markPrepared: true);
        (await ponds.Get(id)).Status.ShouldBe(PondDisplayStatus.Prepared);

        await ponds.ReopenPreparation(new PreparationChangeInput { PondId = id, Reason = "Heavy rain flooded the pond" });
        var reopened = await ponds.Get(id);
        reopened.Status.ShouldBe(PondDisplayStatus.UnderPreparation);
        reopened.History.First().ChangeType.ShouldBe(PondChangeType.PreparationChange);
        reopened.History.First().Description.ShouldContain("Heavy rain");

        await ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = id, ObservedAt = DateTime.UtcNow.AddHours(-1), Description = "Pumped out and limed again" });
        await ponds.MarkPrepared(new EntityDto<Guid>(id));
        (await ponds.Get(id)).Status.ShouldBe(PondDisplayStatus.Prepared);
    }

    [Fact]
    public async Task Reopen_needs_a_prepared_round_and_a_reason()
    {
        var ponds = Resolve<PondAppService>();
        var id = await PondUnderPreparationAsync(33, markPrepared: false);
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.ReopenPreparation(new PreparationChangeInput { PondId = id, Reason = "x" })); // not prepared yet
        await ponds.MarkPrepared(new EntityDto<Guid>(id));
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.ReopenPreparation(new PreparationChangeInput { PondId = id, Reason = " " }));
    }

    [Fact]
    public async Task An_abandoned_round_frees_the_pond_and_keeps_the_record()
    {
        var ponds = Resolve<PondAppService>();
        var id = await PondUnderPreparationAsync(34, markPrepared: true);
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.SetManualStatus(new SetPondStatusInput { Id = id, ManualStatus = PondManualStatus.UnderMaintenance })); // round in progress

        await ponds.AbandonPreparation(new PreparationChangeInput { PondId = id, Reason = "Stocking postponed to next season" });
        var detail = await ponds.Get(id);
        detail.OpenRound.ShouldBeNull();
        detail.PastRounds.Count.ShouldBe(1);
        detail.Status.ShouldBe(PondDisplayStatus.Available);

        await ponds.SetManualStatus(new SetPondStatusInput { Id = id, ManualStatus = PondManualStatus.UnderMaintenance });
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.AbandonPreparation(new PreparationChangeInput { PondId = id, Reason = "again" })); // nothing open
    }

    [Fact]
    public async Task Technician_cannot_reopen_or_abandon_a_round()
    {
        var id = await PondUnderPreparationAsync(35, markPrepared: true);
        LoginAsPilotTechnician();
        var ponds = Resolve<PondAppService>();
        await Should.ThrowAsync<AbpAuthorizationException>(() => ponds.ReopenPreparation(new PreparationChangeInput { PondId = id, Reason = "x" }));
        await Should.ThrowAsync<AbpAuthorizationException>(() => ponds.AbandonPreparation(new PreparationChangeInput { PondId = id, Reason = "x" }));
    }

    private Guid FirstEntryId(Guid pondId) =>
        Q(c => c.PondPreparationEntries.IgnoreQueryFilters().Where(e => !e.IsDeleted && c.PondPreparationRounds.IgnoreQueryFilters().Any(r => r.Id == e.RoundId && r.PondId == pondId))
            .OrderBy(e => e.ObservedAtUtc).Select(e => e.Id).First());

    [Fact]
    public async Task A_preparation_entry_can_be_corrected_and_the_old_text_stays_in_the_history()
    {
        var ponds = Resolve<PondAppService>();
        var id = await PondUnderPreparationAsync(36, markPrepared: false);
        var when = DateTime.UtcNow.AddDays(-5);
        await ponds.EditPreparationEntry(new EditPreparationEntryInput { EntryId = FirstEntryId(id), ObservedAt = when, Description = "  Drained, limed and dried  " });

        var detail = await ponds.Get(id);
        detail.OpenRound.Entries.Single().Description.ShouldBe("Drained, limed and dried");
        detail.OpenRound.StartedAtUtc.ShouldBe(when, TimeSpan.FromSeconds(1));
        detail.History.First().ChangeType.ShouldBe(PondChangeType.PreparationChange);
        detail.History.First().Description.ShouldContain("Drained and limed");

        await Should.ThrowAsync<UserFriendlyException>(() => ponds.EditPreparationEntry(
            new EditPreparationEntryInput { EntryId = FirstEntryId(id), ObservedAt = DateTime.UtcNow.AddDays(2), Description = "Future" }));
    }

    [Fact]
    public async Task A_mistaken_entry_can_be_removed_with_a_reason_but_not_once_prepared()
    {
        var ponds = Resolve<PondAppService>();
        var id = await PondUnderPreparationAsync(37, markPrepared: false);
        await ponds.AddPreparationEntry(new AddPreparationEntryInput { PondId = id, ObservedAt = DateTime.UtcNow.AddDays(-1), Description = "Entered on the wrong pond" });
        var wrong = (await ponds.Get(id)).OpenRound.Entries.Single(e => e.Description.StartsWith("Entered")).Id;

        await Should.ThrowAsync<UserFriendlyException>(() => ponds.VoidPreparationEntry(new VoidPreparationEntryInput { EntryId = wrong, Reason = " " }));
        await ponds.VoidPreparationEntry(new VoidPreparationEntryInput { EntryId = wrong, Reason = "Wrong pond" });
        (await ponds.Get(id)).OpenRound.Entries.Count.ShouldBe(1);

        await ponds.MarkPrepared(new EntityDto<Guid>(id));
        var remaining = (await ponds.Get(id)).OpenRound.Entries.Single().Id;
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.VoidPreparationEntry(new VoidPreparationEntryInput { EntryId = remaining, Reason = "Oops" }));
        await Should.ThrowAsync<UserFriendlyException>(() => ponds.EditPreparationEntry(
            new EditPreparationEntryInput { EntryId = remaining, ObservedAt = DateTime.UtcNow.AddHours(-1), Description = "Changed" }));
    }

    [Fact]
    public async Task A_pond_prepared_a_long_time_ago_shows_a_warning()
    {
        var ponds = Resolve<PondAppService>();
        var id = await PondUnderPreparationAsync(38, markPrepared: true);
        var fresh = await ponds.Get(id);
        fresh.PreparedDaysAgo.ShouldBe(0);
        fresh.PreparationWarning.ShouldBeNull();

        UsingDbContext(null, c =>
        {
            var round = c.PondPreparationRounds.IgnoreQueryFilters().Single(r => r.PondId == id && r.UsedAtUtc == null);
            round.PreparedAtUtc = DateTime.UtcNow.AddDays(-(PondPreparationRound.StaleAfterDays + 5));
        });
        var stale = await Resolve<PondAppService>().Get(id);
        stale.PreparedDaysAgo.ShouldBeGreaterThanOrEqualTo(PondPreparationRound.StaleAfterDays);
        stale.PreparationWarning.ShouldNotBeNull();
    }

    [Fact]
    public async Task The_pond_detail_reports_which_fields_are_locked_and_why()
    {
        var ponds = Resolve<PondAppService>();

        var open = await ponds.Get(PondId(OpenPond));
        open.LockedFields.Keys.ShouldBe(new[] { "constructionType", "purpose", "areaM2", "averageDepthM", "maxDepthM", "farmingSystemOverride" }, ignoreOrder: true);
        open.LockedFields["areaM2"].ShouldContain(open.CurrentBatchCode);
        open.SizeChangeNeedsNote.ShouldBeFalse();

        var closed = await ponds.Get(PondId(ClosedOnlyPond));
        closed.LockedFields.Keys.ShouldBe(new[] { "constructionType", "purpose" }, ignoreOrder: true);
        closed.SizeChangeNeedsNote.ShouldBeTrue();

        var fresh = await ponds.Get(await NewPondAsync(39));
        fresh.LockedFields.ShouldBeEmpty();
        fresh.SizeChangeNeedsNote.ShouldBeFalse();
    }
}
