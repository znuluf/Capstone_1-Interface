/**
 * Sale pricing methods (DEC-80, DEC-82), the same arithmetic as the server's SaleLine helpers, so a form shows the price
 * the server will check. The server stays the authority: it recomputes and warns when the agreed price differs.
 *
 * 1 Fixed · 2 Base ABW (base price at a base ABW + step per gram) · 3 Base count (base price at a base count + step per
 * piece fewer) · 4 Price table (the row covering the count).
 */
export const PRICE_METHODS = [
    { value: 1, label: 'Fixed price' },
    { value: 2, label: 'Base ABW price' },
    { value: 3, label: 'Base count price' },
    { value: 4, label: 'From a price table' },
];

const money = (v: number) => Math.round(v * 100) / 100;

export function num(v: any): number | null {
    return v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
}

export function wholeCount(count: number): number {
    return Math.round(count);
}

/** Pieces per kg from ABW, whole: 1000 ÷ 12.08 g = 82.8 → 83. */
export function countFromAbw(abwG: number | null): number | null {
    return abwG && abwG > 0 ? wholeCount(1000 / (Math.round(abwG * 100) / 100)) : null;
}

export function baseAbwPrice(base: number, baseAbwG: number, stepPerG: number, abwG: number): number {
    return money(base + (Math.round(abwG * 100) / 100 - baseAbwG) * stepPerG);
}

/** Fewer pieces per kg (bigger shrimp) pay more. */
export function baseCountPrice(base: number, baseCount: number, stepPerCount: number, count: number): number {
    return money(base + (baseCount - wholeCount(count)) * stepPerCount);
}

/** The table row covering a whole count, or null. Rows: { minCountPerKg, maxCountPerKg, pricePerKg, label }. */
export function tableRow(table: any, count: number | null): any {
    if (!table || count == null) {
        return null;
    }
    const c = wholeCount(count);
    return (
        [...(table.rows ?? [])]
            .sort((a, b) => (a.minCountPerKg ?? 0) - (b.minCountPerKg ?? 0))
            .find((r) => (r.minCountPerKg == null || c >= r.minCountPerKg) && (r.maxCountPerKg == null || c <= r.maxCountPerKg)) ?? null
    );
}

/**
 * The price a line's method gives, or null while a term is missing (and for Fixed). `abwG` and `countPerKg` are the values
 * the line uses (typed, else the harvest's ABW or the grade's middle count); `tables` are the price tables loaded.
 */
export function referencePrice(t: any, abwG: number | null, countPerKg: number | null, tables: any[]): number | null {
    const base = num(t.basePricePerKg);
    switch (t.priceMethod) {
        case 2: {
            const baseAbw = num(t.baseAbwG), step = num(t.stepPerG);
            return base == null || baseAbw == null || step == null || abwG == null ? null : baseAbwPrice(base, baseAbw, step, abwG);
        }
        case 3: {
            const baseCount = num(t.baseCountPerKg), step = num(t.stepPerCount);
            return base == null || baseCount == null || step == null || countPerKg == null ? null : baseCountPrice(base, baseCount, step, countPerKg);
        }
        case 4: {
            const row = tableRow(tables.find((x) => x.id === t.priceTableId), countPerKg);
            return row ? Number(row.pricePerKg) : null;
        }
        default:
            return null;
    }
}

/** The fields to send for a method; the others are sent empty. */
export function pricingBody(t: any): any {
    const m = t.priceMethod ?? 1;
    return {
        priceMethod: m,
        basePricePerKg: m === 2 || m === 3 ? num(t.basePricePerKg) : null,
        baseAbwG: m === 2 ? num(t.baseAbwG) : null,
        stepPerG: m === 2 ? num(t.stepPerG) : null,
        priceAbwG: m === 2 ? num(t.priceAbwG) : null,
        baseCountPerKg: m === 3 ? num(t.baseCountPerKg) : null,
        stepPerCount: m === 3 ? num(t.stepPerCount) : null,
        priceCountPerKg: m === 3 || m === 4 ? num(t.priceCountPerKg) : null,
        priceTableId: m === 4 ? t.priceTableId || null : null,
    };
}

/** Copies a buyer's last terms (from Sale/GetBuyerPriceTerms) onto a line when the method matches and nothing is typed yet. */
export function applyTerms(target: any, terms: any): boolean {
    if (!terms || terms.priceMethod !== target.priceMethod) {
        return false;
    }
    switch (terms.priceMethod) {
        case 2:
            Object.assign(target, { basePricePerKg: terms.basePricePerKg, baseAbwG: terms.baseAbwG, stepPerG: terms.stepPerG });
            return true;
        case 3:
            Object.assign(target, { basePricePerKg: terms.basePricePerKg, baseCountPerKg: terms.baseCountPerKg, stepPerCount: terms.stepPerCount });
            return true;
        case 4:
            target.priceTableId = terms.priceTableId;
            return true;
    }
    return false;
}

/** True when nothing of the method's own terms has been typed. */
export function termsEmpty(t: any): boolean {
    switch (t.priceMethod) {
        case 2:
            return num(t.basePricePerKg) == null && num(t.baseAbwG) == null && num(t.stepPerG) == null;
        case 3:
            return num(t.basePricePerKg) == null && num(t.baseCountPerKg) == null && num(t.stepPerCount) == null;
        case 4:
            return !t.priceTableId;
        default:
            return false;
    }
}
