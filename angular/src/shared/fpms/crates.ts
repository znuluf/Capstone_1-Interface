/**
 * Crate numbers typed as a list (DEC-86), e.g. "1-10, 15": the crates of a harvest's tally that went on one sale.
 * Shared by the Sales form (typing them) and the prints (laying crates out in blocks).
 */

/** The numbers in "1-10, 15 17" in ascending order without repeats, or an error message for the first bad part. */
export function parseCrateNos(text: string): { nos: number[]; error: string | null } {
    const nos = new Set<number>();
    for (const part of (text ?? '').split(/[\s,;]+/).filter((p) => p)) {
        const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part);
        if (!m) {
            return { nos: [], error: `"${part}" is not a crate number or a range such as 1-10.` };
        }
        const from = Number(m[1]);
        const to = m[2] ? Number(m[2]) : from;
        if (from < 1 || to < from || to - from > 2000) {
            return { nos: [], error: `"${part}" is not a valid range.` };
        }
        for (let n = from; n <= to; n++) {
            nos.add(n);
        }
    }
    return { nos: [...nos].sort((a, b) => a - b), error: null };
}

/** Crate numbers as the shortest list of ranges: [1,2,3,5] → "1-3, 5". */
export function formatCrateNos(nos: number[]): string {
    const sorted = [...new Set(nos)].sort((a, b) => a - b);
    const parts: string[] = [];
    for (let i = 0; i < sorted.length; i++) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) {
            j++;
        }
        parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : `${sorted[i]}`);
        i = j;
    }
    return parts.join(', ');
}

/** Crates in blocks of `perBlock`, and the blocks in rows of as many as fit the page: `span` is the columns one block takes. */
export function crateBands(crates: any[], perBlock: number, span: number): any[][][] {
    const blocks: any[][] = [];
    for (let i = 0; i < crates.length; i += perBlock) {
        blocks.push(crates.slice(i, i + perBlock));
    }
    const perBand = Math.max(2, Math.floor(15 / span));
    const bands: any[][][] = [];
    for (let i = 0; i < blocks.length; i += perBand) {
        bands.push(blocks.slice(i, i + perBand));
    }
    return bands;
}

export function crateKg(crates: any[]): number {
    return Math.round((crates ?? []).reduce((s: number, c: any) => s + (Number(c.kg) || 0), 0) * 1000) / 1000;
}
