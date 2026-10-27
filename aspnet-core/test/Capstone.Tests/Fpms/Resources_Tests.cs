using Abp.UI;
using Capstone.Resources;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Capstone.Tests.Fpms;

/// <summary>Step B: hatchery short codes and certificate history (conversion 11), buyer types and privacy notice (conversion 12).</summary>
public class Resources_Tests : FpmsTestBase
{
    [Theory]
    [InlineData("Sarangani Hatchery Inc", "SHI")]
    [InlineData("Sarangani Bay Hatchery (test)", "SBHT")]
    [InlineData("Ilocos", "IL")]
    [InlineData("A", "AX")]
    public void Hatchery_short_code_is_suggested_from_the_initials(string name, string expected)
    {
        HatcheryNaming.SuggestShortCode(name).ShouldBe(expected);
    }

    [Fact]
    public void Current_certificate_is_the_latest_unexpired_one()
    {
        var today = new DateOnly(2026, 10, 22);
        var old = new HatcheryCertificate { Id = Guid.NewGuid(), CertificateNo = "OLD", ExpiryDate = new DateOnly(2026, 3, 31) };
        var renewed = new HatcheryCertificate { Id = Guid.NewGuid(), CertificateNo = "NEW", IssueDate = new DateOnly(2026, 4, 1), ExpiryDate = new DateOnly(2027, 3, 31) };
        var other = new HatcheryCertificate { Id = Guid.NewGuid(), CertificateNo = "X", CertificateType = CertificateType.Other, ExpiryDate = new DateOnly(2030, 1, 1) };
        HatcheryCertificate.CurrentHealthCertificate(new[] { old, renewed, other }, today).CertificateNo.ShouldBe("NEW");
        HatcheryCertificate.CurrentHealthCertificate(new[] { old }, today).CertificateNo.ShouldBe("OLD"); // expired is still reported
        HatcheryCertificate.CurrentHealthCertificate(new[] { old, renewed }, new DateOnly(2026, 2, 1)).CertificateNo.ShouldBe("OLD"); // NEW not yet issued
        HatcheryCertificate.CurrentHealthCertificate(new[] { other }, today).ShouldBeNull();
    }

    [Fact]
    public async Task New_hatchery_gets_a_short_code_and_duplicates_are_rejected()
    {
        var service = Resolve<HatcheryAppService>();
        var id = await service.Save(new HatcheryDto { Name = "Sarangani Hatchery Inc" });
        (await service.Get(id)).ShortCode.ShouldBe("SHI");
        await Should.ThrowAsync<UserFriendlyException>(() => service.Save(new HatcheryDto { Name = "Another", ShortCode = "SHI" }));
        await Should.ThrowAsync<UserFriendlyException>(() => service.Save(new HatcheryDto { Name = "Bad code", ShortCode = "S1" }));
    }

    [Fact]
    public async Task Short_code_is_fixed_once_a_cycle_uses_the_hatchery()
    {
        var service = Resolve<HatcheryAppService>();
        var seeded = (await service.GetAll()).Single(h => h.ShortCode == "SBH");
        seeded.ShortCode = "ZZZ";
        await Should.ThrowAsync<UserFriendlyException>(() => service.Save(seeded));
    }

    [Fact]
    public async Task Renewal_adds_a_certificate_and_keeps_the_old_one()
    {
        var service = Resolve<HatcheryAppService>();
        var hatchery = (await service.GetAll()).Single(h => h.ShortCode == "SBH");
        hatchery.HealthCertificateNo.ShouldBe("HC-2026-014");

        await service.AddCertificate(new HatcheryCertificateDto
        {
            HatcheryId = hatchery.Id, CertificateNo = "HC-2026-099", IssueDate = new DateOnly(2026, 9, 1), ExpiryDate = new DateOnly(2027, 8, 31),
        });
        var detail = await service.Get(hatchery.Id);
        detail.Certificates.Count.ShouldBe(2);
        detail.HealthCertificateNo.ShouldBe("HC-2026-099");
        detail.Certificates.Single(c => c.IsCurrent).CertificateNo.ShouldBe("HC-2026-099");

        await Should.ThrowAsync<UserFriendlyException>(() => service.AddCertificate(new HatcheryCertificateDto
        {
            HatcheryId = hatchery.Id, CertificateNo = "BAD", IssueDate = new DateOnly(2026, 9, 1), ExpiryDate = new DateOnly(2026, 8, 1),
        }));
    }

    [Fact]
    public async Task Individual_buyer_needs_the_privacy_notice_and_has_no_contact_person()
    {
        var service = Resolve<BuyerAppService>();
        await Should.ThrowAsync<UserFriendlyException>(() => service.Save(new BuyerDto { BuyerType = BuyerType.Individual, Name = "Juan Dela Cruz" }));

        var id = await service.Save(new BuyerDto { BuyerType = BuyerType.Individual, Name = "Juan Dela Cruz", ContactPerson = "ignored", PrivacyNoticeAcknowledged = true });
        var buyer = await service.Get(id);
        buyer.PrivacyNoticeAcknowledgedAtUtc.ShouldNotBeNull();
        buyer.ContactPerson.ShouldBeNull();

        var company = (await service.GetAll()).Single(b => b.Name.StartsWith("GenSan"));
        company.BuyerType.ShouldBe(BuyerType.Company);
        company.ContactPerson.ShouldBe("S. Buyer");
    }
}
