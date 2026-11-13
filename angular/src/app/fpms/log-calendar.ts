export type CellState = 'na' | 'gap' | 'c1' | 'c2' | 'c3' | 'today-empty';

export interface CalendarDot {
    kind: 'm' | 'g' | 'c';
    label: string;
}

export interface CalendarCell {
    date: string;
    count: number;
    state: CellState;
    title: string;
    dots: CalendarDot[];
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
    const all = [...feedingsOf(d), d?.water ?? 0];
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
            return { date, count: 0, state: 'na', title: `${shortDate(date)}: not stocked yet`, dots: [] };
        }
        const { count, total } = dayRecords(c);
        const dots = dotsOf(c);
        if (count === 0 && date === today) {
            return { date, count, state: 'today-empty', title: `${shortDate(date)}: no entry yet`, dots };
        }
        if (count < total && date !== today) {
            gapDates.push(date);
        }
        const scale = recordScale(count, total);
        const state: CellState = scale === 0 ? 'gap' : (`c${scale}` as CellState);
        const extra = dots.length ? '. ' + dots.map((x) => x.label).join(', ') : '';
        return { date, count, state, title: `${shortDate(date)}: ${count} of ${total} entered${extra}`, dots };
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
                color: #232d36;
            }
            i.sq {
                display: inline-block;
                width: 16px;
                height: 16px;
                vertical-align: middle;
                margin-right: 6px;
            }
            .sq.na {
                border-color: #e6eceb;
                background: transparent;
                pointer-events: none;
            }
            .sq.gap {
                background: #f0b84b;
                border-color: #f0b84b;
            }
            .sq.c1 {
                background: #cbe6d2;
                border-color: #cbe6d2;
            }
            .sq.c2 {
                background: #7cc08f;
                border-color: #7cc08f;
            }
            .sq.c3 {
                background: #287a4b;
                border-color: #287a4b;
                color: #fff;
            }
            .sq.today-empty {
                background: #fff;
                border: 1px dashed #8fa0a0;
            }
            .dot,
            i.dot-key {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                border: 1px solid #fff;
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
                background: #b33a3a;
            }
            .dot-g {
                background: #2b6f9b;
            }
            .dot-c {
                background: #6b4c9a;
            }
            a.sq:hover {
                text-decoration: none;
                box-shadow: 0 0 0 2px var(--fpms-primary);
            }
`;
