using Abp.Application.Services.Dto;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace Capstone.Common;

/// <summary>
/// Server-side paging for every operational list (AC-27, spec Section 6): 25 rows by default, 100 at most.
/// A request for more than 100 is rejected by validation, not silently cut.
/// </summary>
public class PagedInput
{
    public const int DefaultPageSize = 25;
    public const int MaxPageSize = 100;

    [Range(0, int.MaxValue)]
    public int SkipCount { get; set; }

    [Range(1, MaxPageSize)]
    public int MaxResultCount { get; set; } = DefaultPageSize;

    /// <summary>Column key, optionally followed by "desc" (for example "saleDate desc"). Unknown keys fall back to the list's default order.</summary>
    [StringLength(60)]
    public string Sorting { get; set; }

    /// <summary>Free-text search typed in the list toolbar. Each list says which columns it matches; blank means no search.</summary>
    [StringLength(60)]
    public string Search { get; set; }
}

/// <summary>A sort request after it has been checked against the list's allowed columns.</summary>
public readonly record struct SortSpec(string Key, bool Descending)
{
    /// <summary>
    /// Reads "key" or "key desc" / "key asc". Keys are compared without case; a key that is not in
    /// <paramref name="allowed"/> is ignored and the default is used, so a client can never sort by an unindexed or private column.
    /// </summary>
    public static SortSpec Parse(string sorting, IReadOnlyCollection<string> allowed, string defaultKey, bool defaultDescending)
    {
        if (string.IsNullOrWhiteSpace(sorting))
        {
            return new SortSpec(defaultKey, defaultDescending);
        }

        var parts = sorting.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var key = allowed.FirstOrDefault(a => string.Equals(a, parts[0], StringComparison.OrdinalIgnoreCase));
        if (key == null)
        {
            return new SortSpec(defaultKey, defaultDescending);
        }

        var descending = parts.Length > 1 ? string.Equals(parts[1], "desc", StringComparison.OrdinalIgnoreCase) : false;
        return new SortSpec(key, descending);
    }

    public IOrderedQueryable<T> Apply<T, TKey>(IQueryable<T> query, System.Linq.Expressions.Expression<Func<T, TKey>> key) =>
        Descending ? query.OrderByDescending(key) : query.OrderBy(key);

    public IOrderedEnumerable<T> Apply<T, TKey>(IEnumerable<T> source, Func<T, TKey> key) =>
        Descending ? source.OrderByDescending(key) : source.OrderBy(key);
}

public static class PagingExtensions
{
    /// <summary>Counts, then reads one page of an already ordered query.</summary>
    public static async Task<PagedResultDto<T>> ToPageAsync<T>(this IQueryable<T> ordered, PagedInput input)
    {
        var total = await ordered.CountAsync();
        var items = await ordered.Skip(input.SkipCount).Take(input.MaxResultCount).ToListAsync();
        return new PagedResultDto<T>(total, items);
    }

    /// <summary>Pages a list that had to be built in memory first (computed filters such as payment status).</summary>
    public static PagedResultDto<T> ToPage<T>(this IReadOnlyList<T> ordered, PagedInput input) =>
        new(ordered.Count, ordered.Skip(input.SkipCount).Take(input.MaxResultCount).ToList());
}
