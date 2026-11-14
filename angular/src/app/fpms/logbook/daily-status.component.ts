import { Component, OnInit, computed, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { FPMS_IMPORTS } from '../shared-imports';
import { CalendarCell, LOG_CALENDAR_STYLES, buildCalendarCells, shortDate } from '../log-calendar';

interface StatusRow {
    batchId: string;
    pondCode: string;
    batchCode: string;
    cycleCode: string;
    cells: CalendarCell[];
    gaps: number;
    daysSinceMortality: number | null;
    daysSinceGrowthSampling: number | null;
    daysSinceChemical: number | null;
    waterAlert: string | null;
    waterAlertDate: string | null;
    waterAlertLogId: string | null;
}

/**
 * Daily log status (DEC-50): for every stocked batch, how many of the day's feedings (the farm's schedule, DEC-61) and water-quality entries
 * were made each day (Not fed counts as entered), dots for mortality, growth sampling and chemical entries, and how long
 * since the last of each. A blank day is a gap to fill in, never "overdue", and nothing here sends a notification
 * (DEC-31, DEC-49).
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header
            title="Daily log status"
            subtitle="Every open batch, day by day: what was entered, and how long since the last mortality, growth sample and chemical."></fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <!-- Same look as the dashboard's ponds calendar (DEC-102, DEC-103): a toolbar on the page ground, then one panel. -->
                <div class="fpms-toolbar">
                    <label class="fpms-search">
                        <i class="fas fa-search" aria-hidden="true"></i>
                        <input type="text" aria-label="Search" placeholder="Search a pond, batch or cycle" [ngModel]="q()" (ngModelChange)="q.set($event)" />
                    </label>
                    <label class="fpms-field">
                        <span>Show the last</span>
                        <select class="form-control form-control-sm" [ngModel]="days()" (ngModelChange)="setDays($event)">
                            @for (n of [7, 14, 31]; track n) {
                                <option [ngValue]="n">{{ n }} days</option>
                            }
                        </select>
                    </label>
                    <label class="fpms-field">
                        <span>Up to</span>
                        <input type="date" class="form-control form-control-sm" [ngModel]="endDate()" [max]="today" (ngModelChange)="setEnd($event)" />
                    </label>
                    @if (cycles().length > 1) {
                        <label class="fpms-field">
                            <span>Cycle</span>
                            <select class="form-control form-control-sm" [ngModel]="cycle()" (ngModelChange)="cycle.set($event)">
                                <option value="">All cycles</option>
                                @for (c of cycles(); track c) {
                                    <option [value]="c">{{ c }}</option>
                                }
                            </select>
                        </label>
                    }
                </div>
                <div class="fpms-toolbar">
                    <div role="group" aria-label="Show">
                        <button type="button" class="fpms-chip" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all')">All batches · {{ base().length }}</button>
                        <button type="button" class="fpms-chip" [attr.aria-pressed]="filter() === 'gaps'" (click)="filter.set('gaps')">With gaps · {{ withGaps() }}</button>
                        <button type="button" class="fpms-chip" [attr.aria-pressed]="filter() === 'alerts'" (click)="filter.set('alerts')">Water alerts · {{ withAlerts() }}</button>
                    </div>
                    <span class="small text-muted ml-auto" role="status">{{ resultText() }}</span>
                </div>

                <div class="fpms-pcal-panel">
                    @if (!loaded()) {
                        <fpms-loading></fpms-loading>
                    } @else if (!rows().length) {
                        <fpms-empty
                            [text]="s().rows.length ? 'No batches match. Clear the search or the filter.' : 'No pond is stocked in this period.'"
                            icon="fas fa-calendar-check"></fpms-empty>
                    } @else {
                        <div class="fpms-pcal-scroll">
                            <!-- Each pond is two lines: the pond and its days, then what was last logged under the days. -->
                            <div class="fpms-dls" [class.is-month]="days() > 14" [style.--fpms-dls-days]="dates().length" role="table" aria-label="Daily log status">
                                <div class="fpms-dls-row head" role="row">
                                    <div role="columnheader" class="pond">Pond</div>
                                    @for (dh of heads(); track dh.date) {
                                        <div role="columnheader" class="dh" [class.is-today]="dh.date === today">
                                            <span class="n">{{ dh.n }}</span>
                                            @if (dh.w) { <span class="w">{{ dh.w }}</span> }
                                        </div>
                                    }
                                </div>
                                @for (r of rows(); track r.batchId) {
                                    @let staleSample = r.daysSinceGrowthSampling === null || r.daysSinceGrowthSampling > 14;
                                    <div class="fpms-dls-row" role="row" [class.is-alert]="!!r.waterAlert">
                                        <div class="pond" role="cell">
                                            <a [routerLink]="['/app/production/batches', r.batchId]" [title]="r.batchCode">
                                                <span class="fpms-pond-tag">{{ r.pondCode }}</span>
                                                <span class="batch">{{ batchShort(r.batchCode) }}</span>
                                            </a>
                                            @if (r.cycleCode) { <span class="cycle">Cycle {{ r.cycleCode }}</span> }
                                        </div>
                                        @for (c of r.cells; track c.date) {
                                            <div role="cell" class="day">
                                                <a class="sq" [ngClass]="c.state" [class.is-today]="c.today" [title]="c.title" [attr.aria-label]="r.pondCode + ', ' + c.title"
                                                    [routerLink]="['/app/production/batches', r.batchId]" [queryParams]="{ tab: 'daily', date: c.date }">
                                                    {{ c.state === 'na' || c.state === 'today-empty' ? '' : c.count }}
                                                    @for (dt of c.dots; track dt.kind) {
                                                        <span class="dot" [ngClass]="'dot-' + dt.kind"></span>
                                                    }
                                                    @if (c.water !== 'na') { <span class="wq" [class.in]="c.water === 'in'" [class.out]="c.waterOut" aria-hidden="true"></span> }
                                                </a>
                                            </div>
                                        }
                                        <div class="meta" role="cell">
                                            <span><span class="k">Last mortality</span> {{ since(r.daysSinceMortality) }}</span>
                                            <span [class.warn]="staleSample">
                                                @if (staleSample) { <i class="fas fa-exclamation-triangle" aria-hidden="true"></i> }
                                                <span class="k">Last growth sample</span> {{ since(r.daysSinceGrowthSampling) }}
                                            </span>
                                            <span><span class="k">Last chemical</span> {{ since(r.daysSinceChemical) }}</span>
                                            @if (r.waterAlert) {
                                                <a class="fpms-pcal-water warn" [routerLink]="['/app/logbook', r.waterAlertLogId]" title="Open the reading">
                                                    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>{{ r.waterAlert }} · {{ shortDate(r.waterAlertDate ?? '') }}
                                                </a>
                                            } @else {
                                                <span class="fpms-pcal-water"><i class="fas fa-check" aria-hidden="true"></i>Water in range</span>
                                            }
                                        </div>
                                    </div>
                                }
                            </div>
                        </div>
                        <div class="fpms-pcal-foot">
                            <div class="fpms-legend">
                                <span><i class="sq gap"></i>No feedings</span>
                                <span><i class="sq c1"></i>Some feedings</span>
                                <span><i class="sq c3"></i>All feedings</span>
                                <span><i class="sq today-empty is-today"></i>Today</span>
                                <span><i class="wq-key in"></i>Water tested</span>
                                @if (hasWaterOut()) { <span><i class="wq-key in out"></i>Water out of range</span> }
                                @if (hasWaterGaps()) { <span><i class="wq-key"></i>Water not tested</span> }
                                <span><i class="dot-key dot-m"></i>Mortality</span>
                                <span><i class="dot-key dot-g"></i>Growth sampling</span>
                                <span><i class="dot-key dot-c"></i>Chemical</span>
                            </div>
                            <p class="mb-0">Click a day to open that pond's Daily record, where Record for this day fills a gap. A blank day is a gap, never "overdue"; Not fed counts as entered.</p>
                        </div>
                    }
                </div>
            </div>
        </section>
    `,
    styles: [
        LOG_CALENDAR_STYLES,
        `
            .fpms-toolbar {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 0.6rem 1rem;
                margin-bottom: 0.75rem;
            }
            .fpms-search {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                min-height: 38px;
                padding: 0 0.7rem;
                margin: 0;
                border: 1px solid var(--fpms-line-strong);
                border-radius: 8px;
                background: var(--fpms-surface);
                flex: 1 1 220px;
                max-width: 340px;
                color: var(--fpms-muted);
            }
            .fpms-search input {
                border: 0;
                outline: 0;
                flex: 1;
                min-width: 0;
                background: transparent;
                color: var(--fpms-text);
            }
            .fpms-field {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin: 0;
                font-weight: 400;
                font-size: 0.9rem;
                color: var(--fpms-muted);
            }
            .fpms-field .form-control {
                height: 38px;
                width: auto;
            }
            .fpms-chip {
                min-height: 36px;
                padding: 0 0.9rem;
                margin-right: 0.4rem;
                border-radius: 18px;
                border: 1px solid var(--fpms-line-strong);
                background: var(--fpms-surface);
                font-size: 0.9rem;
                cursor: pointer;
            }
            .fpms-chip[aria-pressed='true'] {
                background: var(--fpms-primary);
                border-color: var(--fpms-primary);
                color: var(--fpms-surface);
            }
        `,
    ],
})
export class DailyStatusComponent extends FpmsPage implements OnInit {
    s = signal<any>({ rows: [] });
    loaded = signal(false);
    q = signal('');
    filter = signal<'all' | 'gaps' | 'alerts'>('all');
    days = signal(14);
    endDate = signal(FarmTime.today());

    private readonly weekday = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    ngOnInit(): void {
        this.load();
    }

    setDays(n: number): void {
        this.days.set(n);
        this.load();
    }

    setEnd(date: string): void {
        this.endDate.set(date || this.today);
        this.load();
    }

    async load(): Promise<void> {
        this.loaded.set(false);
        const data = await this.run(() =>
            this.api.get<any>('Feeding', 'GetDailyStatus', { endDate: this.endDate(), days: this.days() })
        );
        this.s.set(data ?? { rows: [] });
        this.loaded.set(true);
    }

    dates = computed<string[]>(() => {
        const st = this.s();
        if (!st.from || !st.to) {
            return [];
        }
        const out: string[] = [];
        for (
            let d = String(st.from).substring(0, 10);
            d <= String(st.to).substring(0, 10);
            d = FarmTime.addDays(d, 1)
        ) {
            out.push(d);
        }
        return out;
    });

    heads = computed(() =>
        this.dates().map((date) => {
            const [y, m, d] = date.split('-').map(Number);
            // Weekday letters only while they fit, as in the mockup.
            return {
                date,
                n: String(d),
                w: this.days() <= 14 ? this.weekday[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] : '',
            };
        })
    );

    /** "Batch B" from "2026-09-SNA-01-B"; the full code is in the tooltip. */
    batchShort(code: string): string {
        const m = /-([A-Z])$/.exec(code ?? '');
        return m ? `Batch ${m[1]}` : code;
    }

    /** The "not tested" key appears only when some day is missing a water reading the farm requires (DEC-94). */
    hasWaterGaps = computed(() => this.rows().some((r: any) => r.cells.some((c: any) => c.water === 'missing')));

    /** Rows matching the search, before the gaps filter (chip counts follow the search). */
    /** One cycle at a time when several run at once; the list comes from the batches on the page. */
    cycle = signal<string>('');
    cycles = computed(() => [...new Set(((this.s().rows as any[]) ?? []).map((r) => r.cycleCode).filter(Boolean))].sort() as string[]);

    base = computed<StatusRow[]>(() => {
        const q = this.q().trim().toLowerCase();
        const dates = this.dates();
        return ((this.s().rows as any[]) ?? [])
            .filter((r) => !this.cycle() || r.cycleCode === this.cycle())
            .filter((r) => !q || `${r.pondCode} ${r.batchCode} ${r.cycleCode ?? ''}`.toLowerCase().includes(q))
            .map((r) => {
                const { cells, gapDates } = buildCalendarCells(r, dates, this.today);
                return {
                    batchId: r.batchId,
                    pondCode: r.pondCode,
                    batchCode: r.batchCode,
                    cycleCode: r.cycleCode ?? '',
                    cells,
                    gaps: gapDates.length,
                    daysSinceMortality: r.daysSinceMortality ?? null,
                    daysSinceGrowthSampling: r.daysSinceGrowthSampling ?? null,
                    daysSinceChemical: r.daysSinceChemical ?? null,
                    waterAlert: r.waterAlert ?? null,
                    waterAlertDate: r.waterAlertDate ? String(r.waterAlertDate).substring(0, 10) : null,
                    waterAlertLogId: r.waterAlertLogId ?? null,
                };
            });
    });

    withGaps = computed(() => this.base().filter((r) => r.gaps > 0).length);

    withAlerts = computed(() => this.base().filter((r) => !!r.waterAlert).length);

    rows = computed(() =>
        this.base().filter((r) => this.filter() === 'all' || (this.filter() === 'gaps' ? r.gaps > 0 : !!r.waterAlert))
    );

    /** The "out of range" key appears only when some day in view had a reading outside the farm's range (DEC-103). */
    hasWaterOut = computed(() => this.rows().some((r) => r.cells.some((c) => !!c.waterOut)));

    shortDate = shortDate;

    resultText = computed(() => `${this.rows().length} of ${((this.s().rows as any[]) ?? []).length} batches`);

    since(n: number | null): string {
        return n === null ? 'None' : n === 0 ? 'Today' : n === 1 ? '1 day ago' : `${n} days ago`;
    }
}
