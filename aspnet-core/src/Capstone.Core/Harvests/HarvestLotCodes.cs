using Abp.Dependency;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Capstone.Domain;
using Capstone.Farms;
using Capstone.Ponds;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Harvests;

/// <summary>
/// The place codes of the harvest lot code (DEC-83): area 0 is General Santos City, numbered by barangay; area 1 is the
/// province of Sarangani, numbered by municipality. Our own fixed lists, in the order of the address dropdowns. A number,
/// once given, never changes meaning: a new barangay or municipality gets the next free number, never a reused one.
/// </summary>
public static class LotPlaces
{
    public const int GenSanArea = 0;
    public const int SaranganiArea = 1;

    /// <summary>General Santos City barangays, 01–26 (the farm address's barangay list).</summary>
    public static readonly IReadOnlyList<string> GenSanBarangays = new[]
    {
        "Apopong", "Baluan", "Batomelong", "Buayan", "Bula", "Calumpang", "City Heights", "Conel", "Dadiangas East", "Dadiangas North",
        "Dadiangas South", "Dadiangas West", "Fatima", "Katangawan", "Labangal", "Lagao (1st & 3rd)", "Ligaya", "Mabuhay", "Olympog",
        "San Isidro (Lagao 2nd)", "San Jose", "Siguel (Bawing)", "Sinawal", "Tambler", "Tinagacan", "Upper Labay",
    };

    /// <summary>Sarangani municipalities, 01–07.</summary>
    public static readonly IReadOnlyList<string> SaranganiMunicipalities = new[] { "Alabel", "Glan", "Kiamba", "Maasim", "Maitum", "Malapatan", "Malungon" };

    /// <summary>The area and place code for a farm address, or the reason none can be given.</summary>
    public static (int Area, int Place)? Resolve(string province, string city, string barangay, out string problem)
    {
        problem = null;
        static string Norm(string s) => (s ?? string.Empty).Trim();
        static bool Same(string a, string b) => string.Equals(Norm(a), Norm(b), StringComparison.OrdinalIgnoreCase);

        if (Same(city, "General Santos City") || Same(city, "General Santos"))
        {
            var i = GenSanBarangays.ToList().FindIndex(b => Same(b, barangay));
            if (i < 0)
            {
                problem = string.IsNullOrWhiteSpace(barangay)
                    ? "Choose the farm's barangay in Farm profile; General Santos lot codes include it."
                    : $"The barangay \"{Norm(barangay)}\" is not on the General Santos list. Choose it from the list in Farm profile.";
                return null;
            }

            return (GenSanArea, i + 1);
        }

        if (Same(province, "Sarangani"))
        {
            var i = SaranganiMunicipalities.ToList().FindIndex(m => Same(m, city));
            if (i >= 0)
            {
                return (SaranganiArea, i + 1);
            }

            problem = "Choose the farm's municipality in Farm profile; Sarangani lot codes include it.";
            return null;
        }

        problem = "Lot codes cover General Santos City and Sarangani. Set the farm's address in Farm profile to one of them.";
        return null;
    }
}

/// <summary>The result of trying to give a harvest its lot code: the code, or the reason it could not be given yet.</summary>
public record LotCodeResult(string Code, string Problem);

/// <summary>
/// Issues harvest lot codes (DEC-83): <c>YY-A-LL-FF-PP-HH</c>, e.g. <c>26-0-24-03-07-02</c> = 2026, General Santos (0),
/// barangay 24 (Tambler), farm 03 of that barangay, pond 07 of the farm, the pond's 2nd harvest of 2026.
/// A code is given once, when the harvest is saved, and never changes or is reused, so it always matches what was printed.
/// </summary>
public class HarvestLotCoder : ITransientDependency
{
    public const int MaxLength = 24;

    private readonly IRepository<FarmProfile, int> _profiles;
    private readonly IRepository<Pond, Guid> _ponds;
    private readonly INumberSequenceGenerator _sequences;
    private readonly IUnitOfWorkManager _uow;

    public HarvestLotCoder(IRepository<FarmProfile, int> profiles, IRepository<Pond, Guid> ponds, INumberSequenceGenerator sequences, IUnitOfWorkManager uow)
    {
        _profiles = profiles;
        _ponds = ponds;
        _sequences = sequences;
        _uow = uow;
    }

    public static string Format(int year, int area, int place, int farm, int pond, int harvest) =>
        $"{year % 100:00}-{area}-{place:00}-{farm:00}-{pond:00}-{harvest:00}";

    /// <summary>
    /// Gives the farm its lot identity (area, place, farm number) the first time; it is then fixed, so a later address
    /// change does not change the farm's lot codes. The farm number is the next free one for that place across all farms.
    /// </summary>
    public async Task<(FarmProfile Profile, string Problem)> EnsureFarmIdentityAsync(int tenantId)
    {
        var profile = await _profiles.FirstOrDefaultAsync(p => p.Id == tenantId);
        if (profile == null)
        {
            return (null, "Fill in Farm profile first; lot codes use the farm's address.");
        }

        if (profile.LotFarmNumber.HasValue)
        {
            return (profile, null);
        }

        var place = LotPlaces.Resolve(profile.Province, profile.CityMunicipality, profile.AddressLine2, out var problem);
        if (place == null)
        {
            return (profile, problem);
        }

        int next;
        using (_uow.Current.DisableFilter(AbpDataFilters.MustHaveTenant, AbpDataFilters.MayHaveTenant))
        {
            next = (await _profiles.GetAll().Where(p => p.LotAreaCode == place.Value.Area && p.LotPlaceCode == place.Value.Place)
                .MaxAsync(p => p.LotFarmNumber) ?? 0) + 1;
        }

        profile.LotAreaCode = place.Value.Area;
        profile.LotPlaceCode = place.Value.Place;
        profile.LotFarmNumber = next;
        return (profile, null);
    }

    /// <summary>The pond's farm-wide lot number; given now (the next free one) when the pond has none yet.</summary>
    public async Task<int> EnsurePondNumberAsync(Pond pond)
    {
        if (!pond.LotNumber.HasValue)
        {
            pond.LotNumber = (await _ponds.GetAll().MaxAsync(p => p.LotNumber) ?? 0) + 1;
        }

        return pond.LotNumber.Value;
    }

    /// <summary>Issues the lot code for a harvest of a pond on a farm-local date, or says why it cannot yet.</summary>
    public async Task<LotCodeResult> IssueAsync(int tenantId, Guid pondId, DateOnly harvestDate)
    {
        var (profile, problem) = await EnsureFarmIdentityAsync(tenantId);
        if (problem != null)
        {
            return new LotCodeResult(null, problem);
        }

        var pond = await _ponds.GetAsync(pondId);
        var pondNo = await EnsurePondNumberAsync(pond);
        var harvestNo = await _sequences.NextAsync(NumberSequenceType.HarvestLot, $"P{pondNo}-{harvestDate.Year}");
        var code = Format(harvestDate.Year, profile.LotAreaCode.Value, profile.LotPlaceCode.Value, profile.LotFarmNumber.Value, pondNo, harvestNo);
        return new LotCodeResult(code, null);
    }
}
