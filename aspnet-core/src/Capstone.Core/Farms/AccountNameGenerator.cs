using Abp.Domain.Repositories;
using Abp.Domain.Services;
using Abp.Domain.Uow;
using Capstone.Authorization.Users;
using Capstone.MultiTenancy;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Capstone.Farms;

/// <summary>
/// Suggests a farm code from the farm name and a username from a person's name (DEC-75). Suggestions only:
/// the form shows them and the person can change them before saving, so every saved value still goes through
/// the normal format and uniqueness checks. A suggestion that is free now can be taken before it is saved;
/// the unique indexes on AbpTenants and AbpUsers reject the second save.
/// </summary>
public class AccountNameGenerator : DomainService
{
    /// <summary>Farm codes are 2–20 characters (Capstone-Planning.md, codes rule); generated codes stay inside it.</summary>
    public const int MaxFarmCodeLength = 20;

    /// <summary>Room for the farm code's number suffix ("-2" to "-999").</summary>
    private const int FarmCodeBaseLength = 16;

    /// <summary>Generated usernames are kept short enough to type at the ponds.</summary>
    public const int MaxGeneratedUserNameLength = 32;

    /// <summary>Words that say what every farm is, so they add nothing to a code.</summary>
    private static readonly HashSet<string> FillerWords = new(StringComparer.Ordinal)
    {
        "THE", "AND", "OF", "A", "AN", "FARM", "FARMS", "SHRIMP", "PRAWN", "PRAWNS", "VANNAMEI", "AQUA", "AQUACULTURE",
        "AQUAFARM", "FISHPOND", "FISHPONDS", "POND", "PONDS", "INC", "CORP", "CORPORATION", "CO", "COMPANY", "LTD",
        "ENTERPRISE", "ENTERPRISES",
    };

    private readonly IRepository<Tenant> _tenants;
    private readonly IRepository<User, long> _users;

    public AccountNameGenerator(IRepository<Tenant> tenants, IRepository<User, long> users)
    {
        _tenants = tenants;
        _users = users;
    }

    /// <summary>
    /// The base farm code for a farm name, before any number suffix: the first two words that are not filler
    /// words, in capitals, joined by a hyphen, at most 16 characters ("GenSan Semi-Intensive Shrimp Farm" gives
    /// "GENSAN-SEMI"). Starts with a letter; "FARM" when the name has no usable letters.
    /// </summary>
    public static string FarmCodeBase(string farmName)
    {
        var words = Words(farmName).Select(w => w.ToUpperInvariant()).ToList();
        var meaningful = words.Where(w => !FillerWords.Contains(w)).ToList();
        if (meaningful.Count == 0)
        {
            meaningful = words;
        }

        var code = string.Empty;
        foreach (var word in meaningful.Take(2))
        {
            var next = code.Length == 0 ? word : code + "-" + word;
            if (next.Length > FarmCodeBaseLength)
            {
                if (code.Length == 0)
                {
                    code = word[..FarmCodeBaseLength];
                }

                break;
            }

            code = next;
        }

        if (code.Length == 0)
        {
            return "FARM";
        }

        if (!char.IsLetter(code[0]))
        {
            code = "F-" + code;
            if (code.Length > FarmCodeBaseLength)
            {
                code = code[..FarmCodeBaseLength].TrimEnd('-');
            }
        }

        return code.Length < 2 ? code + "-FARM" : code;
    }

    /// <summary>
    /// The base username for a person, before any number suffix: first letter of the first name and the whole
    /// surname, lower case, letters only ("Juan" "Dela Cruz" gives "jdelacruz"). "user" when nothing is left.
    /// </summary>
    public static string UserNameBase(string name, string surname)
    {
        var first = string.Concat(Words(name)).ToLowerInvariant();
        var last = string.Concat(Words(surname)).ToLowerInvariant();
        var userName = new string((first.Length > 0 ? first[..1] + last : last).Where(c => c is >= 'a' and <= 'z').ToArray());
        if (userName.Length == 0)
        {
            return "user";
        }

        return userName.Length > MaxGeneratedUserNameLength - 3 ? userName[..(MaxGeneratedUserNameLength - 3)] : userName;
    }

    /// <summary>
    /// A free farm code for the farm name: the base, or the base with "-2", "-3" and so on. Codes of deleted
    /// farms count as taken, so old exports and logs never point at a different farm. Case is ignored.
    /// </summary>
    [UnitOfWork]
    public virtual async Task<string> SuggestFarmCodeAsync(string farmName)
    {
        var baseCode = FarmCodeBase(farmName);
        List<string> taken;
        using (CurrentUnitOfWork.SetTenantId(null))
        using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.SoftDelete))
        {
            taken = await _tenants.GetAll()
                .Where(t => t.TenancyName.ToUpper().StartsWith(baseCode))
                .Select(t => t.TenancyName)
                .ToListAsync();
        }

        return NextFree(baseCode, taken.Select(t => t.ToUpperInvariant()), n =>
        {
            var suffix = "-" + n.ToString(CultureInfo.InvariantCulture);
            var stem = baseCode.Length + suffix.Length > MaxFarmCodeLength ? baseCode[..(MaxFarmCodeLength - suffix.Length)].TrimEnd('-') : baseCode;
            return stem + suffix;
        });
    }

    /// <summary>
    /// A free username in the given farm: the base, or the base with "2", "3" and so on. Usernames are unique
    /// within a farm only, because sign-in asks for the farm code first. Deactivated accounts count as taken.
    /// </summary>
    [UnitOfWork]
    public virtual async Task<string> SuggestUserNameAsync(int? tenantId, string name, string surname)
    {
        var baseName = UserNameBase(name, surname);
        if (!tenantId.HasValue)
        {
            return baseName;
        }

        var normalizedBase = baseName.ToUpperInvariant();
        List<string> taken;
        using (CurrentUnitOfWork.SetTenantId(tenantId))
        using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.SoftDelete))
        {
            taken = await _users.GetAll()
                .Where(u => u.TenantId == tenantId && u.NormalizedUserName.StartsWith(normalizedBase))
                .Select(u => u.NormalizedUserName)
                .ToListAsync();
        }

        return NextFree(baseName, taken.Select(t => t.ToLowerInvariant()), n => baseName + n.ToString(CultureInfo.InvariantCulture));
    }

    private static string NextFree(string first, IEnumerable<string> taken, Func<int, string> numbered)
    {
        var set = new HashSet<string>(taken, StringComparer.OrdinalIgnoreCase);
        if (!set.Contains(first))
        {
            return first;
        }

        for (var n = 2; n < 1000; n++)
        {
            var candidate = numbered(n);
            if (!set.Contains(candidate))
            {
                return candidate;
            }
        }

        // 998 farms or people with the same base: leave the choice to the person.
        return numbered(1000);
    }

    /// <summary>Splits text into words of plain letters and digits; accents are removed ("Ñ" becomes "N").</summary>
    private static IEnumerable<string> Words(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            yield break;
        }

        var plain = new StringBuilder();
        foreach (var c in text.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            {
                plain.Append(c);
            }
        }

        var word = new StringBuilder();
        foreach (var c in plain.ToString())
        {
            if (c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9')
            {
                word.Append(c);
            }
            else if (c == '\'' || c == '’')
            {
                // O'Brien is one word.
            }
            else if (word.Length > 0)
            {
                yield return word.ToString();
                word.Clear();
            }
        }

        if (word.Length > 0)
        {
            yield return word.ToString();
        }
    }
}
