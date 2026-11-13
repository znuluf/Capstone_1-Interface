export type CellState = 'na' | 'gap' | 'c1' | 'c2' | 'c3' | 'today-empty';

export interface CalendarDot {
    kind: 'm' | 'g' | 'c';
    label: string;
}

export interface CalendarCell {
    date: string;
    /** Feedings entered (Not fed counts as entered), out of the farm's schedule. */
    count: number;
    state: CellState;
    title: string;
    dots: CalendarDot[];
    /** Water quality: 'in' when entered, 'missing' when not, 'na' outside the culture period. */
    water: 'in' | 'missing' | 'na';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 3" from a yyyy-MM-dd farm date. */
export function shortDate(date: string): string {
    const [, m, d] = date.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
}

export function dotsOf(c: any): CalendarDot[] {
    const out: CalendarDot[] = [];
    if (c.mortality) out.push({ kind: 'm', label: 'mortality entered' });
    if (c.growthSampling) out.push({ kind: 'g', label: 'growth sampling entered' });
    if (c.chemical) out.push({ kind: 'c', label: 'chemical entered' });
    return out;
}

/** A day's feeding cells, feeding 1 first (DEC-61): 0 blank, 1 logged, 2 not fed. */
export function feedingsOf(d: any): number[] {
    return (d?.feedings as number[]) ?? [];
}

/**
 * The day's daily records (DEC-50, DEC-61): one per feeding in the farm's schedule plus water quality. Not fed counts
 * as entered.
 */
export function dayRecords(d: any): { count: number; total: number } {
    // Water quality not required daily (3, DEC-94) is not one of the day's records.
    const all = d?.water === 3 ? [...feedingsOf(d)] : [...feedingsOf(d), d?.water ?? 0];
    return { count: all.filter((v) => v !== 0).length, total: all.length };
}

/** 0 nothing, 3 everything, 1 under half, 2 half or more: the shade of a day's square. */
export function recordScale(count: number, total: number): 0 | 1 | 2 | 3 {
    if (count === 0) return 0;
    if (count >= total) return 3;
    return count * 2 < total ? 1 : 2;
}

/** "feeding 2", "feedings 2, 3" for the blank or not-fed feedings of a day. */
export function feedingList(d: any, status: number): string {
    const nos = feedingsOf(d).map((v, i) => (v === status ? i + 1 : 0)).filter((n) => n);
    return nos.length ? (nos.length === 1 ? 'feeding ' : 'feedings ') + nos.join(', ') : '';
}

/** A day's feedings entered (Not fed counts) out of the farm's schedule (DEC-61). */
export function dayFeedings(d: any): { count: number; total: number } {
    const all = feedingsOf(d);
    return { count: all.filter((v) => v !== 0).length, total: all.length };
}

/**
 * One square per day for a Daily log status row (DEC-50): how many of the day's feedings (the farm's schedule, DEC-61)
 * and its water quality were entered (Not fed counts as entered). Days before stocking are blank; today with nothing
 * entered is "no entry yet"; an earlier day with records missing is a gap to fill in, never "overdue" (DEC-31).
 */
export function buildCalendarCells(
    row: any,
    dates: string[],
    today: string
): { cells: CalendarCell[]; gapDates: string[] } {
    const gapDates: string[] = [];
    const cells = dates.map<CalendarCell>((date) => {
        const c = (row.days as any[]).find((x) => String(x.date).substring(0, 10) === date);
        if (!c) {
            return { date, count: 0, state: 'na', title: `${shortDate(date)}: not stocked yet`, dots: [], water: 'na' };
        }
        // The square shows feedings only; water quality is the circle in its corner (DEC-89).
        const all = dayRecords(c);
        const fed = dayFeedings(c);
        const water = c.water === 1 ? 'in' : 'missing';
        const dots = dotsOf(c);
        const extra = dots.length ? '. ' + dots.map((x) => x.label).join(', ') : '';
        const title = `${shortDate(date)}: ${fed.count} of ${fed.total} feedings, water quality ${water === 'in' ? 'entered' : 'not entered'}${extra}`;
        if (all.count === 0 && date === today) {
            return { date, count: 0, state: 'today-empty', title: `${shortDate(date)}: no entry yet`, dots, water };
        }
        if (all.count < all.total && date !== today) {
            gapDates.push(date);
        }
        const scale = fed.total ? recordScale(fed.count, fed.total) : recordScale(all.count, all.total);
        const state: CellState = scale === 0 ? 'gap' : (`c${scale}` as CellState);
        return { date, count: fed.total ? fed.count : all.count, state, title, dots, water };
    });
    return { cells, gapDates };
}

/** Component styles for the squares, dots and legend keys. */
export const LOG_CALENDAR_STYLES = `
            .sq {
                position: relative;
                height: 28px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.72rem;
                font-weight: 600;
                border: 1px solid transparent;
                box-sizing: border-box;
                color: var(--fpms-text);
            }
            i.sq {
                display: inline-block;
                width: 16px;
                height: 16px;
                vertical-align: middle;
                margin-right: 6px;
            }
            .sq.na {
                border-color: var(--fpms-line);
                background: transparent;
                pointer-events: none;
            }
            .sq.gap {
                background: var(--fpms-blank-fill);
                border-color: var(--fpms-blank-fill);
            }
            .sq.c1 {
                background: var(--fpms-success-100);
                border-color: var(--fpms-success-100);
            }
            .sq.c2 {
                background: var(--fpms-success-300);
                border-color: var(--fpms-success-300);
            }
            .sq.c3 {
                background: var(--fpms-success);
                border-color: var(--fpms-success);
                color: var(--fpms-surface);
            }
            .sq.today-empty {
                background: var(--fpms-surface);
                border: 1px dashed var(--fpms-control-border);
            }
            .dot,
            i.dot-key {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                border: 1px solid var(--fpms-surface);
                box-sizing: border-box;
            }
            .dot {
                position: absolute;
                top: 2px;
                right: 2px;
            }
            .dot + .dot {
                right: 11px;
            }
            .dot + .dot + .dot {
                right: 20px;
            }
            i.dot-key {
                display: inline-block;
                margin-right: 6px;
            }
            .dot-m {
                background: var(--fpms-error);
            }
            .dot-g {
                background: var(--fpms-info);
            }
            .dot-c {
                background: var(--fpms-chemical);
            }
            a.sq:hover {
                text-decoration: none;
                box-shadow: 0 0 0 2px var(--fpms-primary);
            }
`;
