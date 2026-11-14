import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FpmsApiService } from '@shared/fpms/api.service';
import { FarmTime } from '@shared/fpms/farm-time';
import { logSummary } from '@shared/fpms/log-summary';
import { LogTypes, MortalityCauses } from '@shared/fpms/labels';
import { FPMS_IMPORTS } from '../shared-imports';
import { dayFeedings } from '../log-calendar';
import { BatchFiguresComponent } from './batch-figures.component';

/** Log types (labels.ts LogTypes). */
const WATER = 4;
const GROWTH = 5;
const CHEMICAL = 6;
const MORTALITY = 7;
const NOTE = 9;
const ACTIVITY = 10;
/** FeedingStatuses: 2 is Not fed. */
const NOT_FED = 2;
/** The list endpoints return at most 100 rows; a week of one batch stays well under that. */
const PAGE = 100;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type CellKind = 'value' | 'warn' | 'notfed' | 'missing' | 'open' | 'none';

interface Cell {
    text: string;
    kind: CellKind;
}

/** yyyy-MM-dd of a DateOnly or ISO value. */
function ymd(value: unknown): string {
    return value ? String(value).substring(0, 10) : '';
}

function utc(date: string): number {
    return Date.UTC(+date.substring(0, 4), +date.substring(5, 7) - 1, +date.substring(8, 10));
}

/** Whole days from a to b (both yyyy-MM-dd). */
function daysBetween(a: string, b: string): number {
    return Math.round((utc(b) - utc(a)) / 86400000);
}

/**
 * Daily record (farm partner's request): everything logged for one batch on one day, or one week of culture, read-only.
 * Week 1 starts on the stocking day (day of culture 0, as in IndicatorCalculator.Doc). The week view follows the farm's
 * paper logbook: one row per day of culture, one column per feeding. Recording still goes through the log drawer.
 */
@Component({
    selector: 'fpms-batch-daily-record',
    standalone: true,
    imports: [FPMS_IMPORTS, BatchFiguresComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (!start()) {
            <fpms-empty text="This batch has no stocking date yet, so it has no daily record." icon="fas fa-calendar-day"></fpms-empty>
        } @else {
            <div class="fpms-dr-toolbar no-print">
                <div class="btn-group" role="group" aria-label="Show">
                    <button type="button" class="btn" [class.btn-primary]="mode() === 'day'" [class.btn-outline-primary]="mode() !== 'day'" [attr.aria-pressed]="mode() === 'day'" (click)="mode.set('day')">Day</button>
                    <button type="button" class="btn" [class.btn-primary]="mode() === 'week'" [class.btn-outline-primary]="mode() !== 'week'" [attr.aria-pressed]="mode() === 'week'" (click)="mode.set('week')">Week</button>
                </div>
                <div class="fpms-dr-steps">
                    <button type="button" class="btn btn-outline-secondary" [attr.aria-label]="mode() === 'day' ? 'Previous day' : 'Previous week'" [disabled]="!canStep(-1)" (click)="step(-1)"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                    <button type="button" class="btn btn-outline-secondary" [attr.aria-label]="mode() === 'day' ? 'Next day' : 'Next week'" [disabled]="!canStep(1)" (click)="step(1)"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                </div>
                <div class="fpms-dr-title">
                    @if (mode() === 'day') {
                        <h3>{{ longDate(day()) }}</h3>
                        <div class="text-muted">Day of culture {{ docOf(day()) }} · week {{ weekNo() }}{{ day() === today ? ' · today' : '' }}</div>
                    } @else {
                        <h3>Week {{ weekNo() }} of culture</h3>
                        <div class="text-muted">{{ weekDates()[0] | farmDate }} to {{ weekDates()[6] | farmDate }} · days of culture {{ docOf(weekDates()[0]) }} to {{ docOf(weekDates()[6]) }}</div>
                    }
                </div>
                <label class="fpms-dr-goto">
                    <span>{{ mode() === 'day' ? 'Go to' : 'Go to the week of' }}</span>
                    <input type="date" class="form-control" [min]="start()" [max]="end()" [value]="day()" (change)="goTo($any($event.target).value)" />
                </label>
                @if (canRecord() && mode() === 'day') {
                    <button type="button" class="btn btn-primary" (click)="record.emit(day())"><i class="fas fa-plus mr-1" aria-hidden="true"></i>Record for this day</button>
                }
            </div>

            <div class="fpms-dr-strip" role="group" [attr.aria-label]="'Week ' + weekNo() + ' of culture'">
                @for (d of weekDates(); track d) {
                    @let st = statusOf(d);
                    <button
                        type="button"
                        class="fpms-dr-daybtn"
                        [class.is-full]="st.kind === 'full'"
                        [class.is-part]="st.kind === 'part'"
                        [class.is-gap]="st.kind === 'gap'"
                        [class.is-open]="st.kind === 'open'"
                        [class.is-today]="d === today"
                        [attr.aria-current]="mode() === 'day' && d === day() ? 'date' : null"
                        [disabled]="st.kind === 'later'"
                        (click)="openDay(d)">
                        <span class="fpms-dr-dayname">{{ weekdayShort(d) }} {{ dayOfMonth(d) }}<span class="fpms-dr-doc">{{ d === today ? 'Today' : 'Day ' + docOf(d) }}</span></span>
                        <span>{{ st.text }}</span>
                        @if (st.water) { <span class="fpms-dr-water">{{ st.water }}</span> }
                    </button>
                }
            </div>

            @if (error()) {
                <div class="alert alert-warning d-flex align-items-center" role="alert">
                    <span class="mr-auto"><i class="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>The records for these dates could not be loaded. {{ error() }}</span>
                    <button type="button" class="btn btn-sm btn-outline-secondary" (click)="reload()">Try again</button>
                </div>
            } @else if (loading()) {
                <fpms-loading></fpms-loading>
            } @else if (mode() === 'day') {
                @let fs = feedingsOn(day());
                @let ls = logsOn(day());
                <!-- The batch's figures as they stood at the end of this day, each opening its working (DEC-101). -->
                @if (asOf()) {
                    <section class="fpms-summary" [attr.aria-label]="day() === today ? 'Figures so far today' : 'Figures at the end of this day'">
                        <h4 class="fpms-dr-asof-h">{{ day() === today ? 'Figures so far today' : 'Figures at the end of ' + longDate(day()) }}</h4>
                        <fpms-batch-figures [indicators]="asOf()" [stockingDate]="start()" [compact]="true"></fpms-batch-figures>
                    </section>
                }

                <div class="fpms-dr-columns">
                    <div class="fpms-dr-main">
                        <div class="card">
                            <div class="card-header d-flex align-items-center">
                                <h4 class="card-title mr-auto">Feeding</h4>
                                <span class="text-muted">{{ statusOf(day()).text }} · {{ feedKg(fs) | num: 1 }} kg</span>
                            </div>
                            <div class="card-body p-0 table-responsive">
                                <table class="table table-sm mb-0">
                                    <thead><tr><th class="text-nowrap">Feeding</th><th class="text-right">Kg</th><th>Feed lot</th><th>Entered by</th></tr></thead>
                                    <tbody>
                                        @for (n of slots(); track n) {
                                            @let s = sessionOf(day(), n);
                                            <tr>
                                                <td class="text-nowrap">
                                                    Feeding {{ n }}
                                                    @if (s?.fedAtTime) { <div class="text-muted">fed {{ s.fedAtTime }}</div> }
                                                </td>
                                                <td class="text-right">
                                                    @let c = feedCell(day(), n);
                                                    <span [class]="cellClass(c)">{{ c.text }}</span>
                                                </td>
                                                <td>
                                                    @for (l of s?.lines ?? []; track l.lotId) {
                                                        <div>{{ l.label }}{{ s.lines.length > 1 ? ': ' + (l.kg | num: 3) + ' kg' : '' }}</div>
                                                    }
                                                    @if (s?.notes) { <div class="text-muted">{{ s.notes }}</div> }
                                                </td>
                                                <td>
                                                    @if (s) {
                                                        {{ s.recordedBy }}
                                                        <div class="text-muted">entered {{ s.creationTime | farmDateTime }}</div>
                                                    }
                                                </td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header d-flex align-items-center">
                                <h4 class="card-title mr-auto">Water quality</h4>
                                @if (outOfRange(ls).length) {
                                    <span class="text-warning-dark"><i class="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>{{ outOfRange(ls).length }} out of range</span>
                                }
                            </div>
                            <div class="card-body p-0">
                                @for (l of byType(ls, WATER); track l.id) {
                                    <div class="fpms-dr-entry">
                                        <div class="text-muted">{{ time(l.observedAtUtc) }} · {{ l.recordedBy }}</div>
                                        <div class="fpms-dr-readings">
                                            @for (m of l.measurements; track m.parameterCode) {
                                                <span [class.fpms-dr-warn]="m.isOutOfRange">
                                                    {{ m.parameterName ?? m.parameterCode }} {{ m.value }} {{ m.unitCode }}{{ m.isOutOfRange ? ' · ' + sideText(m) : '' }}
                                                </span>
                                            }
                                        </div>
                                    </div>
                                } @empty {
                                    <p class="text-muted px-3 py-2 mb-0">{{ isPast(day()) ? 'No water quality entered for this day.' : 'None entered yet.' }}</p>
                                }
                            </div>
                        </div>
                    </div>

                    <div class="fpms-dr-side">
                        <div class="card">
                            <div class="card-header d-flex align-items-center">
                                <h4 class="card-title mr-auto">Other entries</h4>
                                @if (deadOn(ls)) { <span class="text-muted">{{ deadOn(ls) | num: 0 }} dead</span> }
                            </div>
                            <div class="card-body p-0">
                                @for (l of otherLogs(ls); track l.id) {
                                    <div class="fpms-dr-entry">
                                        <div class="text-muted">{{ l.logType | label: LogTypes }} · {{ time(l.observedAtUtc) }}</div>
                                        <div>{{ summary(l) || '—' }}</div>
                                        <div class="text-muted">{{ l.recordedBy }}</div>
                                    </div>
                                } @empty {
                                    <p class="text-muted px-3 py-2 mb-0">No growth sample, mortality, chemical, pond activity or note this day.</p>
                                }
                            </div>
                        </div>
                    </div>
                </div>
            } @else {
                <div class="card">
                    <div class="card-body p-0 table-responsive">
                        <table class="table table-sm mb-0 fpms-dr-week">
                            <thead>
                                <tr>
                                    <th scope="col">Day of culture</th>
                                    @for (n of slots(); track n) { <th scope="col" class="text-right">Feeding {{ n }}</th> }
                                    <th scope="col" class="text-right">Total kg</th>
                                    <th scope="col">Water quality</th>
                                    <th scope="col" class="text-right">Dead</th>
                                    <th scope="col">Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (d of weekDates(); track d) {
                                    @let ls = logsOn(d);
                                    @let fs = feedingsOn(d);
                                    <tr [class.fpms-dr-today]="d === today" [class.text-muted]="!inRange(d)">
                                        <th scope="row">
                                            @if (inRange(d)) {
                                                <a href="javascript:;" (click)="openDay(d)">Day {{ docOf(d) }}</a>
                                            } @else {
                                                Day {{ docOf(d) }}
                                            }
                                            <div class="font-weight-normal text-muted">{{ weekdayShort(d) }} {{ d | farmDate }}</div>
                                        </th>
                                        @for (n of slots(); track n) {
                                            @let c = feedCell(d, n);
                                            <td class="text-right"><span [class]="cellClass(c)">{{ c.text }}</span></td>
                                        }
                                        <td class="text-right font-weight-bold">{{ fs.length ? (feedKg(fs) | num: 1) : '—' }}</td>
                                        <td>
                                            @let w = waterCell(d, ls);
                                            <span [class]="cellClass(w)">{{ w.text }}</span>
                                        </td>
                                        <td class="text-right">{{ deadOn(ls) ? (deadOn(ls) | num: 0) : '—' }}</td>
                                        <td class="fpms-dr-remarks">{{ remarks(fs, ls) || '—' }}</td>
                                    </tr>
                                }
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th scope="row">Week so far</th>
                                    @for (n of slots(); track n) { <td></td> }
                                    <td class="text-right font-weight-bold">{{ feedKg(feedings()) | num: 1 }}</td>
                                    <td>{{ outOfRange(logs()).length }} out of range</td>
                                    <td class="text-right font-weight-bold">{{ deadOn(logs()) | num: 0 }}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                <p class="text-muted">Week 1 starts on the stocking day (day of culture 0). Select a day to see its full record.</p>
            }
        }
    `,
})
export class BatchDailyRecordComponent {
    private readonly api = inject(FpmsApiService);

    /** The batch from Batch/Get. A new object (after a save) reloads the records shown. */
    readonly batch = input.required<any>();
    /** Batch/GetLogCalendar, for each day's record status. */
    readonly calendar = input<any>(null);
    readonly canRecord = input(false);
    /** The day to open (yyyy-MM-dd), e.g. from a square on Daily log status; empty opens the last day of culture. */
    readonly date = input('');
    /** Asks the page to open the log drawer for a day (yyyy-MM-dd). */
    readonly record = output<string>();

    readonly WATER = WATER;
    readonly LogTypes = LogTypes as Record<number, string>;
    readonly today = FarmTime.today();

    readonly mode = signal<'day' | 'week'>('day');
    private readonly anchor = signal('');
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly feedings = signal<any[]>([]);
    readonly logs = signal<any[]>([]);
    /** Batch/GetIndicatorsOn for the day shown (Day view); null while loading or when it could not be worked out. */
    readonly asOf = signal<any>(null);
    private request = 0;

    readonly start = computed(() => ymd(this.batch()?.stockingDate));
    /** The last day of culture: the calendar's end (Total harvest, failure or today). */
    readonly end = computed(() => ymd(this.calendar()?.to) || this.today);
    readonly day = computed(() => {
        const start = this.start();
        const end = this.end();
        const wanted = this.anchor() || this.date() || end;
        return wanted < start ? start : wanted > end ? end : wanted;
    });
    readonly weekNo = computed(() => Math.floor(Math.max(0, this.docOf(this.day())) / 7) + 1);
    readonly weekDates = computed(() => {
        const first = FarmTime.addDays(this.start(), (this.weekNo() - 1) * 7);
        return Array.from({ length: 7 }, (_, i) => FarmTime.addDays(first, i));
    });
    private readonly calendarDays = computed(() => {
        const map = new Map<string, any>();
        for (const d of this.calendar()?.days ?? []) {
            map.set(ymd(d.date), d);
        }
        return map;
    });
    /** Feedings in the farm's schedule (DEC-61), or more if more were recorded. */
    readonly slots = computed(() => {
        let count = 0;
        for (const d of this.calendarDays().values()) {
            count = Math.max(count, d.feedings?.length ?? 0);
        }
        for (const s of this.feedings()) {
            count = Math.max(count, s.session ?? 0);
        }
        return Array.from({ length: Math.max(count, 1) }, (_, i) => i + 1);
    });

    constructor() {
        effect(() => {
            const batch = this.batch();
            const from = this.mode() === 'day' ? this.day() : this.weekDates()[0];
            const to = this.mode() === 'day' ? this.day() : this.weekDates()[6] > this.end() ? this.end() : this.weekDates()[6];
            if (batch?.id && this.start()) {
                untracked(() => void this.load(batch.id, from, to));
            }
        });
    }

    reload(): void {
        const b = this.batch();
        const from = this.mode() === 'day' ? this.day() : this.weekDates()[0];
        const to = this.mode() === 'day' ? this.day() : this.weekDates()[6] > this.end() ? this.end() : this.weekDates()[6];
        void this.load(b.id, from, to);
    }

    private async load(batchId: string, from: string, to: string): Promise<void> {
        const id = ++this.request;
        this.loading.set(true);
        this.error.set(null);
        try {
            const [feedings, logs, asOf] = await Promise.all([
                this.api.get<any>('Feeding', 'GetList', { batchId, from, to, maxResultCount: PAGE, sorting: 'feedDate asc' }),
                this.api.get<any>('Log', 'GetList', { batchId, from, to, maxResultCount: PAGE, sorting: 'observedAt asc' }),
                // Figures as of the day (Day view only). Missing figures do not hide the day's records.
                from === to ? this.api.get<any>('Batch', 'GetIndicatorsOn', { id: batchId, date: from }).catch(() => null) : Promise.resolve(null),
            ]);
            if (id !== this.request) {
                return;
            }
            this.asOf.set(asOf ?? null);
            this.feedings.set(feedings?.items ?? []);
            this.logs.set(logs?.items ?? []);
        } catch (e: any) {
            if (id === this.request) {
                this.error.set(e?.error?.error?.message ?? e?.message ?? 'Check the connection to the farm server.');
            }
        } finally {
            if (id === this.request) {
                this.loading.set(false);
            }
        }
    }

    // ---- navigation

    openDay(date: string): void {
        this.anchor.set(date);
        this.mode.set('day');
    }

    goTo(date: string): void {
        if (date) {
            this.anchor.set(date);
        }
    }

    canStep(direction: 1 | -1): boolean {
        const first = this.mode() === 'day' ? this.day() : this.weekDates()[0];
        const last = this.mode() === 'day' ? this.day() : this.weekDates()[6];
        return direction < 0 ? first > this.start() : last < this.end();
    }

    step(direction: 1 | -1): void {
        const next = this.stepped(direction);
        // A step past the last day lands on it, so the last (partial) week can still be reached.
        this.anchor.set(next > this.end() ? this.end() : next < this.start() ? this.start() : next);
    }

    private stepped(direction: 1 | -1): string {
        return FarmTime.addDays(this.day(), direction * (this.mode() === 'day' ? 1 : 7));
    }

    // ---- dates

    docOf(date: string): number {
        return daysBetween(this.start(), date);
    }

    inRange(date: string): boolean {
        return date >= this.start() && date <= this.end();
    }

    isPast(date: string): boolean {
        return date < this.today;
    }

    longDate(date: string): string {
        return `${WEEKDAYS[new Date(utc(date)).getUTCDay()]}, ${FarmTime.date(date)}`;
    }

    weekdayShort(date: string): string {
        return WEEKDAYS[new Date(utc(date)).getUTCDay()].substring(0, 3);
    }

    dayOfMonth(date: string): number {
        return +date.substring(8, 10);
    }

    time(value: string): string {
        return FarmTime.time(value);
    }

    // ---- day status (from the log calendar, so it matches Daily log status and Close batch)

    statusOf(date: string): { kind: 'full' | 'part' | 'gap' | 'open' | 'later'; text: string; water: string } {
        if (!this.inRange(date)) {
            return { kind: 'later', text: date > this.end() ? 'Not yet' : 'Before stocking', water: '' };
        }
        const c = this.calendarDays().get(date);
        if (!c) {
            return { kind: 'open', text: '—', water: '' };
        }
        // Feedings decide the day's state; water quality is shown beside it, not counted (DEC-89).
        const { count, total } = dayFeedings(c);
        const water = c.water === 1 ? 'Water entered' : 'No water reading';
        if (date === this.today && count < total) {
            return { kind: 'open', text: `${count} of ${total} fed so far`, water };
        }
        return { kind: count >= total ? 'full' : count === 0 ? 'gap' : 'part', text: `${count} of ${total} fed`, water };
    }

    // ---- records

    feedingsOn(date: string): any[] {
        return this.feedings().filter((s) => ymd(s.feedDate) === date);
    }

    sessionOf(date: string, n: number): any {
        return this.feedings().find((s) => ymd(s.feedDate) === date && s.session === n) ?? null;
    }

    logsOn(date: string): any[] {
        return this.logs().filter((l) => FarmTime.isoDateOf(l.observedAtUtc) === date);
    }

    byType(logs: any[], type: number): any[] {
        return logs.filter((l) => l.logType === type);
    }

    otherLogs(logs: any[]): any[] {
        return logs.filter((l) => [GROWTH, CHEMICAL, MORTALITY, ACTIVITY, NOTE].includes(l.logType));
    }

    feedKg(sessions: any[]): number {
        return sessions.filter((s) => s.status !== NOT_FED).reduce((sum, s) => sum + (Number(s.kg) || 0), 0);
    }

    deadOn(logs: any[]): number {
        return logs.filter((l) => l.logType === MORTALITY).reduce((sum, l) => sum + (Number(l.mortality?.count) || 0), 0);
    }

    outOfRange(logs: any[]): any[] {
        return logs.filter((l) => l.logType === WATER).flatMap((l) => (l.measurements ?? []).filter((m: any) => m.isOutOfRange));
    }

    sideText(m: any): string {
        return m.side === 1 ? 'low' : m.side === 2 ? 'high' : 'out of range';
    }

    summary(l: any): string {
        return logSummary(l);
    }

    feedCell(date: string, n: number): Cell {
        const s = this.sessionOf(date, n);
        if (s) {
            return s.status === NOT_FED ? { text: 'Not fed', kind: 'notfed' } : { text: Number(s.kg).toFixed(1), kind: 'value' };
        }
        if (!this.inRange(date) || date > this.today) {
            return { text: '—', kind: 'none' };
        }
        return date === this.today ? { text: 'not yet', kind: 'open' } : { text: 'missing', kind: 'missing' };
    }

    waterCell(date: string, logs: any[]): Cell {
        const water = this.byType(logs, WATER);
        if (water.length) {
            const bad = this.outOfRange(logs).map((m) => `${m.parameterCode} ${m.value} ${this.sideText(m)}`);
            return bad.length
                ? { text: bad.join(', '), kind: 'warn' }
                : { text: `In range · ${water.length} reading${water.length === 1 ? '' : 's'}`, kind: 'value' };
        }
        if (!this.inRange(date) || date > this.today) {
            return { text: '—', kind: 'none' };
        }
        return { text: 'Not entered', kind: 'open' };
    }

    /** The logbook's remarks column: growth samples, chemicals, mortality causes and notes for the day. */
    remarks(sessions: any[], logs: any[]): string {
        const parts: string[] = [];
        for (const l of logs) {
            if (l.logType === GROWTH && l.abwG != null) {
                parts.push(`ABW ${l.abwG} g`);
            } else if (l.logType === CHEMICAL) {
                const used = (l.usages ?? []).map((u: any) => `${u.label} ${u.quantity} ${u.unit ?? ''}`.trim()).join(', ');
                parts.push(used || 'Chemical applied');
            } else if (l.logType === MORTALITY && l.mortality) {
                parts.push(`${l.mortality.count} dead (${(MortalityCauses as Record<number, string>)[l.mortality.cause] ?? 'cause not given'})`);
            } else if (l.logType === ACTIVITY) {
                parts.push(logSummary(l));
            } else if (l.logType === NOTE && l.notes) {
                parts.push(l.notes);
            }
        }
        for (const s of sessions) {
            if (s.notes) {
                parts.push(`Feeding ${s.session}: ${s.notes}`);
            }
        }
        return parts.join(' · ');
    }

    cellClass(c: Cell): string {
        switch (c.kind) {
            case 'missing':
                return 'fpms-dr-miss';
            case 'warn':
                return 'fpms-dr-warn';
            case 'value':
                return '';
            default:
                return 'text-muted';
        }
    }
}
