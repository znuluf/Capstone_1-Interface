import { Component, OnInit, computed, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { FPMS_IMPORTS } from '../shared-imports';
import { CalendarCell, LOG_CALENDAR_STYLES, buildCalendarCells, shortDate } from '../log-calendar';

/** Days of squares on the dashboard; Daily log status shows up to 31 (DEC-96). */
const CALENDAR_DAYS = 7;

interface CalendarRow {
    batchId: string;
    pondId: string;
    pondCode: string;
    batchCode: string;
    cells: CalendarCell[];
    gapDates: string[];
    doc: number | null;
    abwG: number | null;
    fcr: number | null;
    survival: number | null;
    sampleDays: number | null;
    hasAlert: boolean;
}

interface AttentionRow {
    title: string;
    detail?: string;
    ownerOnly?: boolean;
    where: string;
    whereSub?: string;
    whereLink?: any[];
    since: string;
    action: string;
    actionLink: any[];
    actionParams?: any;
}

interface GlanceTile {
    key: string;
    label: string;
    main: string;
    sub: string;
    link: any[];
    linkText: string;
}

interface AttentionGroup {
    key: string;
    title: string;
    /** Shown when the group has nothing in it. */
    clear: string;
    icon: string;
    rows: AttentionRow[];
}

/**
 * Dashboard (Ref 9.2, DEC-96): what needs attention, then each pond's last seven days and its own figures. No farm
 * averages: an average of ponds stocked weeks apart, or of FCRs, describes no pond.
 * Everything is derived from what has been entered; a blank day is a gap to fill in, never "overdue" (DEC-31, DEC-50).
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (!d()) {
                    <fpms-loading></fpms-loading>
                } @else {
                    @let x = d();

                    @if (x.isOwner && pendingSetup().length) {
                        <div class="card card-outline card-primary">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <i class="fas fa-tasks" aria-hidden="true"></i>
                                    Set up your farm
                                </h3>
                                <span class="float-right text-muted">{{ doneSetup().length }} of {{ x.setupTasks.length }} done</span>
                            </div>
                            <div class="card-body py-2">
                                <ul class="list-unstyled mb-0 fpms-setup">
                                    @for (t of pendingSetup(); track t.key) {
                                        <li>
                                            <i class="far fa-circle mr-2" aria-hidden="true"></i>
                                            <a [routerLink]="t.route">{{ t.label }}</a>
                                        </li>
                                    }
                                </ul>
                                @if (doneSetup().length) {
                                    <details class="fpms-setup-done mt-1">
                                        <summary class="text-muted">Show {{ doneSetup().length }} finished</summary>
                                        <ul class="list-unstyled mb-0 fpms-setup">
                                            @for (t of doneSetup(); track t.key) {
                                                <li>
                                                    <i class="far fa-check-circle text-success mr-2" aria-hidden="true"></i>
                                                    <span class="text-muted">{{ t.label }}</span>
                                                    <span class="sr-only">(done)</span>
                                                </li>
                                            }
                                        </ul>
                                    </details>
                                }
                            </div>
                        </div>
                    }

                    <!-- Needs attention: three groups with a count each; a group's list opens under the strip (DEC-96). -->
                    <section class="card fpms-att-strip" aria-labelledby="att-h" id="attention">
                        <div class="card-header">
                            <h2 id="att-h" class="card-title fpms-h2">Needs attention</h2>
                        </div>
                        @if (!attentionTotal()) {
                            <p class="fpms-att-none mb-0"><i class="fas fa-check mr-2" aria-hidden="true"></i>Nothing needs attention: no water alerts or high mortality in the last 7 days, nothing missed before today, and stock and permits are in order.</p>
                        } @else {
                        <div class="fpms-att-tiles">
                            <!-- Only the groups with something in them: an empty group would only repeat the counts below (DEC-96). -->
                            @for (g of allGroups(); track g.key) {
                                @if (g.rows.length) {
                                    <button
                                        type="button"
                                        class="fpms-att-tile"
                                        [ngClass]="'grp-' + g.key"
                                        [attr.aria-expanded]="openGroup() === g.key"
                                        [attr.aria-controls]="'att-' + g.key"
                                        (click)="toggleGroup(g.key)">
                                        <span class="t">{{ g.title }}</span>
                                        <span class="c">
                                            <i class="fas fa-fw" [ngClass]="g.icon" aria-hidden="true"></i>
                                            {{ g.rows.length }} {{ g.rows.length === 1 ? 'item' : 'items' }}
                                            <i class="fas fa-chevron-down fpms-att-chev" aria-hidden="true"></i>
                                        </span>
                                        <span class="n">{{ groupSummary(g) }}</span>
                                    </button>
                                }
                            }
                        </div>
                        }
                        @for (g of allGroups(); track g.key) {
                            @if (openGroup() === g.key && g.rows.length) {
                                <ul class="list-unstyled mb-0 fpms-att" [id]="'att-' + g.key" [attr.aria-label]="g.title">
                                    @for (r of g.rows; track $index) {
                                        <li [ngClass]="'grp-' + g.key">
                                            <div class="what">
                                                <span class="font-weight-bold">{{ r.title }}</span>
                                                @if (r.ownerOnly) {
                                                    <span class="badge badge-secondary ml-1">Owner</span>
                                                }
                                                <span class="text-muted">
                                                    ·
                                                    @if (r.whereLink) {
                                                        <a [routerLink]="r.whereLink">{{ r.where }}</a>
                                                    } @else {
                                                        {{ r.where }}
                                                    }
                                                </span>
                                                @if (r.detail) {
                                                    <div class="text-muted">{{ r.detail }}</div>
                                                }
                                            </div>
                                            <a class="btn btn-sm btn-outline-primary" [routerLink]="r.actionLink" [queryParams]="r.actionParams">
                                                {{ r.action }}
                                            </a>
                                        </li>
                                    }
                                </ul>
                            }
                        }
                    </section>

                    <!-- Farm at a glance: one tile per summary that has something to show (DEC-96). -->
                    @if (glance().length) {
                        <section class="fpms-glance" aria-labelledby="glance-h">
                            <h2 id="glance-h" class="fpms-glance-h">Farm at a glance</h2>
                            <div class="fpms-glance-tiles">
                                @for (t of glance(); track t.key) {
                                    <a class="fpms-glance-tile" [routerLink]="t.link">
                                        <span class="l">{{ t.label }}</span>
                                        <span class="v">{{ t.main }}</span>
                                        <span class="s">{{ t.sub }}</span>
                                        <span class="go">{{ t.linkText }} <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
                                    </a>
                                }
                            </div>
                        </section>
                    }

                    <!-- Ponds and log calendar -->
                    <section class="card" aria-labelledby="cal-h">
                        <div class="card-header d-flex flex-wrap align-items-center">
                            <h2 id="cal-h" class="card-title fpms-h2 mr-auto">Ponds</h2>
                            @if (can('Farm.Logs')) {
                                <a routerLink="/app/logbook/status" class="btn btn-outline-primary btn-sm">
                                    Proceed to Operations
                                    <i class="fas fa-arrow-right ml-1" aria-hidden="true"></i>
                                </a>
                            }
                        </div>
                        <div class="card-body">
                            @if (rows().length > 6) {
                            <div class="fpms-toolbar">
                                <label class="fpms-search">
                                    <i class="fas fa-search" aria-hidden="true"></i>
                                    <input
                                        type="text"
                                        aria-label="Search ponds or batches"
                                        placeholder="Search a pond or batch"
                                        [ngModel]="q()"
                                        (ngModelChange)="q.set($event)" />
                                </label>
                                <label class="fpms-sort">
                                    <span>Sort by</span>
                                    <select
                                        class="form-control form-control-sm"
                                        [ngModel]="sort()"
                                        (ngModelChange)="sort.set($event)">
                                        <option value="pond">Pond code</option>
                                        <option value="attention">Needs attention first</option>
                                        <option value="doc">DOC, highest first</option>
                                        <option value="fcr">FCR, highest first</option>
                                    </select>
                                </label>
                            </div>
                            }

                            @if (!s()) {
                                <fpms-loading></fpms-loading>
                            } @else if (!rows().length) {
                                <fpms-empty text="No batch is stocked yet." icon="fas fa-water">
                                    @if (can('Farm.Production.Stock')) {
                                        <a routerLink="/app/production/create-batch" class="btn btn-sm btn-primary">
                                            Stock a batch
                                        </a>
                                    }
                                </fpms-empty>
                            } @else {
                                <div class="fpms-cal-scroll">
                                    <div class="fpms-cal">
                                        <div class="fpms-cal-row head">
                                            <div>Pond and batch</div>
                                            @for (dd of dayHeads(); track dd.date) {
                                                <div class="dh">
                                                    <div class="n">{{ dd.n }}</div>
                                                    <div>{{ dd.w }}</div>
                                                </div>
                                            }
                                            <div class="r">DOC</div>
                                            <div class="r">ABW (g)</div>
                                            <div class="r">FCR</div>
                                            <div class="r">Survival</div>
                                            <div class="fpms-gap">Last sample</div>
                                            <div>Water</div>
                                        </div>
                                        @for (r of visible(); track r.batchId) {
                                            <div class="fpms-cal-row">
                                                <div class="lead">
                                                    <a [routerLink]="['/app/production/batches', r.batchId]">
                                                        <strong>{{ r.pondCode }}</strong>
                                                    </a>
                                                    <div class="small text-muted" [title]="r.batchCode">{{ batchShort(r.batchCode) }}</div>
                                                </div>
                                                @for (c of r.cells; track c.date) {
                                                    <span class="sq" [ngClass]="c.state" [class.is-today]="c.today" [title]="c.title">
                                                        {{
                                                            c.state === 'na' || c.state === 'today-empty' ? '' : c.count
                                                        }}
                                                        @for (dt of c.dots; track dt.kind) {
                                                            <span class="dot" [ngClass]="'dot-' + dt.kind"></span>
                                                        }
                                                    @if (c.water !== 'na') { <span class="wq" [class.in]="c.water === 'in'" aria-hidden="true"></span> }
                                                    </span>
                                                }
                                                <div class="r">{{ r.doc ?? '–' }}</div>
                                                <div class="r">{{ r.abwG === null ? '–' : (r.abwG | num: 1) }}</div>
                                                <div class="r">{{ r.fcr === null ? '–' : (r.fcr | num: 2) }}</div>
                                                <div class="r" [class.text-warning-dark]="r.survival !== null && r.survival > 100">
                                                    {{ r.survival === null ? '–' : (r.survival | num: 0) + '%' }}
                                                    @if (r.survival !== null && r.survival > 100) {
                                                        <span class="fpms-check" title="Above 100%. Check the stocking count and the latest survival estimate."><i class="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>check count</span>
                                                    }
                                                </div>
                                                <div class="fpms-gap" [class.text-warning-dark]="r.sampleDays === null || r.sampleDays > 14">
                                                    {{ sampleText(r.sampleDays) }}
                                                </div>
                                                <div>
                                                    @if (r.hasAlert) {
                                                        <span class="badge badge-warning">Alert</span>
                                                    } @else {
                                                        <span class="text-muted small">In range</span>
                                                    }
                                                </div>
                                            </div>
                                        }
                                    </div>
                                </div>
                                <div class="mt-3">
                                    <a routerLink="/app/logbook/status">See the full status, up to 31 days</a>
                                </div>
                                <div class="fpms-legend">
                                    <span><i class="sq gap"></i>No feedings</span>
                                    <span><i class="sq c1"></i>Some feedings</span>
                                    <span><i class="sq c3"></i>All feedings</span>
                                    <span><i class="sq today-empty is-today"></i>Today</span>
                                    <span><i class="wq-key in"></i>Water tested</span>
                                    @if (hasWaterGaps()) {
                                        <span><i class="wq-key"></i>Water not tested</span>
                                    }
                                    <span>
                                        <i class="dot-key dot-m"></i>
                                        Mortality
                                    </span>
                                    <span>
                                        <i class="dot-key dot-g"></i>
                                        Growth sampling
                                    </span>
                                    <span>
                                        <i class="dot-key dot-c"></i>
                                        Chemical
                                    </span>
                                </div>
                            }
                        </div>
                    </section>

                }
            </div>
        </section>
    `,
    styles: [
        LOG_CALENDAR_STYLES,
        `
            .fpms-h2 {
                float: none;
                margin: 0;
                font-size: 1.15rem;
                font-weight: 600;
                color: var(--fpms-primary);
            }
            .fpms-chip {
                min-height: 36px;
                padding: 0 0.9rem;
                margin-left: 0.4rem;
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
            .fpms-toolbar {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 0.6rem 1rem;
                margin-bottom: 0.9rem;
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
                max-width: 320px;
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
            .fpms-sort {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin: 0;
                font-weight: 400;
                font-size: 0.9rem;
            }
            .fpms-sort select {
                height: 38px;
                width: auto;
            }
            .fpms-cal-scroll {
                overflow-x: auto;
            }
            .fpms-cal {
                min-width: 900px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .fpms-cal-row {
                display: grid;
                /* The day squares keep their size; the pond and figure columns share the rest, so the table fills the card. */
                grid-template-columns:
                    minmax(110px, 1.3fr) repeat(7, 44px) minmax(64px, 0.6fr) minmax(72px, 0.7fr) minmax(64px, 0.6fr)
                    minmax(104px, 0.9fr) minmax(120px, 1fr) minmax(96px, 0.9fr);
                gap: 6px 8px;
                align-items: center;
                font-size: 0.9375rem;
            }
            .fpms-cal-row.head {
                align-items: end;
                padding-bottom: 0.25rem;
                border-bottom: 1px solid var(--fpms-line);
                font-size: 0.875rem;
                color: var(--fpms-muted);
            }
            .fpms-cal-row .r {
                text-align: right;
            }
            /* Survival is right-aligned and the last-sample text left-aligned: keep a clear gap between them. */
            .fpms-cal-row .fpms-gap {
                padding-left: 1rem;
            }
            /* A little air between the last day square and the figures. */
            .fpms-cal-row > :nth-child(9) {
                padding-left: 1rem;
            }
            .fpms-cal-row .dh {
                text-align: center;
                line-height: 1.25;
            }
            .fpms-cal-row .dh .n {
                font-weight: 600;
                color: var(--fpms-text);
            }
            .fpms-legend {
                display: flex;
                flex-wrap: wrap;
                gap: 0.4rem 1.25rem;
                margin-top: 0.9rem;
                padding-top: 0.8rem;
                border-top: 1px solid var(--fpms-line);
                font-size: 0.875rem;
                color: var(--fpms-muted);
            }
            .fpms-att li {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                padding: 0.5rem 1rem;
                border-bottom: 1px solid var(--fpms-line);
                border-left: 4px solid transparent;
            }
            .fpms-att li:last-child {
                border-bottom: 0;
            }
            .fpms-att li.grp-act {
                border-left-color: var(--fpms-warning);
            }
            .fpms-att li.grp-catchup {
                border-left-color: var(--fpms-line-strong);
            }
            .fpms-att li.grp-admin {
                border-left-color: var(--fpms-info);
            }
        `,
    ],
})
export class DashboardComponent extends FpmsPage implements OnInit {
    d = signal<any>(null);
    s = signal<any>(null);
    pendingSetup = signal<any[]>([]);
    doneSetup = signal<any[]>([]);

    q = signal('');
    sort = signal<'pond' | 'attention' | 'doc' | 'fcr'>('pond');

    private readonly weekday = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    async ngOnInit(): Promise<void> {
        const [data, status, sheet] = await Promise.all([
            this.api.get<any>('Dashboard', 'Get'),
            this.can('Farm.Logs')
                ? this.run(() =>
                      this.api.get<any>('Feeding', 'GetDailyStatus', { endDate: this.today, days: CALENDAR_DAYS })
                  )
                : Promise.resolve(null),
            this.can('Farm.Logs')
                ? this.run(() => this.api.get<any>('Feeding', 'GetSheet', { feedDate: this.today }))
                : Promise.resolve(null),
        ]);
        this.sheet.set(sheet ?? null);
        this.pendingSetup.set((data?.setupTasks ?? []).filter((t: any) => !t.done));
        this.doneSetup.set((data?.setupTasks ?? []).filter((t: any) => t.done));
        this.d.set(data);
        this.s.set(status ?? { rows: [] });
    }

    // ---- calendar

    dates = computed<string[]>(() => {
        const out: string[] = [];
        for (let i = CALENDAR_DAYS - 1; i >= 0; i--) {
            out.push(FarmTime.addDays(this.today, -i));
        }
        return out;
    });

    dayHeads = computed(() =>
        this.dates().map((date) => {
            const [y, m, dd] = date.split('-').map(Number);
            return { date, n: String(dd), w: this.weekday[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()] };
        })
    );

    rangeText = computed(() => {
        const ds = this.dates();
        return `${this.shortDate(ds[0])} to ${this.shortDate(ds[ds.length - 1])}`;
    });

    rows = computed<CalendarRow[]>(() => {
        const status = this.s();
        const dash = this.d();
        if (!status?.rows || !dash) {
            return [];
        }
        const tiles = new Map<string, any>((dash.ponds as any[]).filter((p) => p.batchId).map((p) => [p.batchId, p]));
        return (status.rows as any[]).map((r) => {
            const t = tiles.get(r.batchId);
            const { cells, gapDates } = buildCalendarCells(r, this.dates(), this.today);
            return {
                batchId: r.batchId,
                pondId: r.pondId,
                pondCode: r.pondCode,
                batchCode: r.batchCode,
                cells,
                gapDates,
                doc: t?.doc ?? null,
                abwG: t?.abwG ?? null,
                fcr: t?.fcrToDate ?? null,
                survival: t?.estimatedSurvivalPct ?? null,
                sampleDays: r.daysSinceGrowthSampling ?? null,
                hasAlert: !!t?.hasWaterQualityAlert,
            };
        });
    });

    visible = computed<CalendarRow[]>(() => {
        const q = this.q().trim().toLowerCase();
        const num = (v: number | null) => (v === null ? -1 : v);
        return this.rows()
            .filter(
                (r) =>
                    (!q || `${r.pondCode} ${r.batchCode}`.toLowerCase().includes(q))
            )
            .sort((a, b) => {
                switch (this.sort()) {
                    case 'attention':
                        return Number(b.hasAlert) - Number(a.hasAlert) || a.pondCode.localeCompare(b.pondCode);
                    case 'doc':
                        return num(b.doc) - num(a.doc);
                    case 'fcr':
                        return num(b.fcr) - num(a.fcr);
                    default:
                        return a.pondCode.localeCompare(b.pondCode);
                }
            });
    });

    resultText = computed(() =>
        this.visible().length
            ? `${this.visible().length} of ${this.rows().length} ponds`
            : 'No pond matches. Clear the search.'
    );

    /** Latest farm day on which any log was observed, as a plain statement of how current the data is. */
    enteredThrough = computed(() => {
        const logs = (this.d()?.recentLogs as any[]) ?? [];
        if (!logs.length) {
            return 'No entries yet.';
        }
        const latest = logs
            .map((l) => FarmTime.isoDateOf(l.observedAtUtc))
            .sort()
            .pop()!;
        return `Data entered through ${this.shortDate(latest)}`;
    });

    // ---- farm at a glance (DEC-96): fixed-size tiles that summarise; each links to its full page

    sheet = signal<any>(null);

    glance = computed<GlanceTile[]>(() => {
        const dash = this.d();
        if (!dash) {
            return [];
        }
        const tiles: GlanceTile[] = [];
        const fmt = (n: number) => n.toLocaleString('en-US');
        const names = (list: string[]) => (list.length <= 3 ? list.join(', ') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`);

        const cycles = (dash.activeCycles as any[]) ?? [];
        if (cycles.length) {
            const ponds = cycles.reduce((n, c) => n + (c.stockedCount ?? 0), 0);
            const pl = cycles.reduce((n, c) => n + (c.plStocked ?? 0), 0);
            const starts = cycles.map((c) => c.startDate).filter(Boolean).sort();
            const oldest = starts.length ? Math.round((Date.parse(this.today) - Date.parse(starts[0])) / 86400000) : null;
            tiles.push({
                key: 'cycles',
                label: 'Active cycles',
                main: `${cycles.length} ${cycles.length === 1 ? 'cycle' : 'cycles'}`,
                sub: [`${ponds} ${ponds === 1 ? 'pond' : 'ponds'}`, `${fmt(pl)} PL stocked`, oldest !== null ? `${cycles.length === 1 ? 'day' : 'oldest at day'} ${oldest}` : '']
                    .filter(Boolean)
                    .join(' · '),
                link: cycles.length === 1 ? ['/app/production/cycles', cycles[0].id] : ['/app/production/cycles'],
                linkText: cycles.length === 1 ? 'Open cycle' : 'Open cycles',
            });
        }

        // One tile per pond status that has ponds in it; prepared ponds read as "Ready to stock".
        const statuses: { status: number; label: string; link: any[]; linkText: string; note?: string }[] = [
            { status: 3, label: 'Ponds in production', link: ['/app/ponds'], linkText: 'Open ponds' },
            { status: 7, label: 'Ready to stock', link: ['/app/production/create-batch'], linkText: 'Stock a batch', note: 'prepared' },
            { status: 2, label: 'Under preparation', link: ['/app/ponds'], linkText: 'Open ponds' },
            { status: 4, label: 'Post-harvest', link: ['/app/ponds'], linkText: 'Open ponds' },
            { status: 1, label: 'Available', link: ['/app/ponds'], linkText: 'Open ponds' },
            { status: 5, label: 'Under maintenance', link: ['/app/ponds'], linkText: 'Open ponds' },
        ];
        for (const st of statuses) {
            const codes = ((dash.ponds as any[]) ?? []).filter((p) => p.status === st.status).map((p) => p.pondCode);
            if (codes.length) {
                tiles.push({
                    key: 'pond' + st.status,
                    label: st.label,
                    main: `${codes.length} ${codes.length === 1 ? 'pond' : 'ponds'}`,
                    sub: names(codes) + (st.note ? ` · ${st.note}` : ''),
                    link: st.link,
                    linkText: st.linkText,
                });
            }
        }

        const feeding = this.feedingToday();
        if (feeding) {
            tiles.push({ key: 'feeding', label: "Today's feeding", main: feeding.main, sub: feeding.sub, link: ['/app/logbook/feeding'], linkText: 'Open feeding sheet' });
        }

        const fry = (dash.fryLeftToStock as any[]) ?? [];
        if (fry.length) {
            const left = fry.reduce((n, d) => n + Math.max(0, (d.plReceived ?? 0) - (d.plStocked ?? 0)), 0);
            const one = fry.length === 1 ? fry[0] : null;
            tiles.push({
                key: 'fry',
                label: 'Fry left to stock',
                main: `${fmt(left)} PL`,
                sub: one
                    ? `${one.hatcheryBatchNumber}, received ${String(one.deliveryDate).substring(0, 10) === this.today ? 'today' : this.shortDate(String(one.deliveryDate).substring(0, 10))}`
                    : `${fry.length} deliveries`,
                link: one ? ['/app/resources/fry-deliveries', one.id] : ['/app/resources/fry-deliveries'],
                linkText: one ? 'Open delivery' : 'Open fry deliveries',
            });
        }
        return tiles;
    });

    /**
     * Today's sheet in one line: the feeding whose usual time has begun (or begins within half an hour) and how many
     * ponds have it entered, then the next feeding. A pointer, not a deadline (DEC-31).
     */
    private feedingToday(): { main: string; sub: string } | null {
        const sheet = this.sheet();
        const rows = (sheet?.rows as any[]) ?? [];
        const times = (sheet?.feedingTimes as string[]) ?? [];
        if (!rows.length || !times.length) {
            return null;
        }
        const entered = (s: number) => rows.filter((r) => !!r.sessions?.[s - 1]).length;
        const minutes = (t: string) => {
            const m = /^(\d{1,2}):(\d{2})$/.exec(t);
            return m ? Number(m[1]) * 60 + Number(m[2]) : null;
        };
        const [h, mi] = FarmTime.timeNow24().split(':').map(Number);
        const now = h * 60 + mi + 30;
        let current = 0;
        times.forEach((t, i) => {
            const at = minutes(t);
            if (at !== null && at <= now) {
                current = i + 1;
            }
        });
        const label = (s: number) => `Feeding ${s}`;
        if (current === 0) {
            return { main: `${label(1)} at ${times[0]}`, sub: `${entered(1)} of ${rows.length} ponds entered` };
        }
        const main = `${label(current)}: ${entered(current)} of ${rows.length} ponds`;
        const next = current < times.length ? current + 1 : 0;
        return {
            main,
            sub: next ? `${label(next)} at ${times[next - 1]} · ${entered(next)} of ${rows.length} entered` : 'Last feeding of the day',
        };
    }

    // ---- needs attention

    allGroups = computed<AttentionGroup[]>(() => {
        const dash = this.d();
        if (!dash) {
            return [];
        }
        const act: AttentionRow[] = [];
        for (const a of dash.waterQualityAlerts as any[]) {
            act.push({
                title: (a.readings as string[]).join('; '),
                detail: 'Water-quality reading outside the optimal range. See the recommendation in Farm Standards.',
                where: a.pondCode,
                whereSub: a.batchCode,
                whereLink: ['/app/production/batches', a.batchId],
                since: `Observed ${this.shortDate(String(a.farmDate).substring(0, 10))}`,
                action: 'Open log',
                actionLink: ['/app/logbook', a.logId],
            });
        }
        for (const h of dash.highMortality as any[]) {
            act.push({
                title: `High mortality: ${h.count} dead`,
                detail: 'More than 1% of the estimated population in one entry.',
                where: h.pondCode,
                whereSub: h.batchCode,
                whereLink: ['/app/production/batches', h.batchId],
                since: `Observed ${this.shortDate(String(h.farmDate).substring(0, 10))}`,
                action: 'Open log',
                actionLink: ['/app/logbook', h.logId],
            });
        }

        const catchUp: AttentionRow[] = [];
        for (const r of this.rows()) {
            if (!r.gapDates.length) {
                continue;
            }
            const first = r.gapDates[0];
            const listed = r.gapDates
                .slice(0, 3)
                .map((d) => this.shortDate(d))
                .join(', ');
            catchUp.push({
                title:
                    r.gapDates.length === 1
                        ? `No complete entry for ${listed}`
                        : `Missing entries on ${r.gapDates.length} days`,
                detail:
                    r.gapDates.length > 3
                        ? `${listed} and ${r.gapDates.length - 3} more.`
                        : r.gapDates.length > 1
                          ? `${listed}.`
                          : undefined,
                where: r.pondCode,
                whereSub: r.batchCode,
                whereLink: ['/app/production/batches', r.batchId],
                since: `Since ${this.shortDate(first)}`,
                action: this.can('Farm.Logs.Create') ? 'Open feeding sheet' : 'See daily status',
                actionLink: this.can('Farm.Logs.Create') ? ['/app/logbook/feeding'] : ['/app/logbook/status'],
                actionParams: this.can('Farm.Logs.Create') ? { batchId: r.batchId, date: first } : undefined,
            });
        }

        const admin: AttentionRow[] = [];
        // Stock alerts are one line: the farm buys feed per cycle, so several low lots are one task, not one each.
        const stock = dash.stockAlerts as any[];
        if (stock.length) {
            const names = stock.map((st) => `${st.itemName}${st.lotNumber ? ' lot ' + st.lotNumber : ''}`);
            const negative = stock.some((st) => st.kind === 'Negative');
            admin.push({
                title: stock.length === 1
                    ? `${negative ? 'Negative stock' : 'Low stock'}: ${names[0]}`
                    : `${stock.length} lots are low${negative ? ' or below zero' : ''}`,
                detail: stock.length === 1
                    ? `${stock[0].quantity} ${stock[0].unit} on record. Check stock before the next feeding day.`
                    : `${names.slice(0, 3).join(', ')}${stock.length > 3 ? ` and ${stock.length - 3} more` : ''}.`,
                where: 'Inventory',
                whereLink: ['/app/inventory'],
                since: '',
                action: 'Open inventory',
                actionLink: ['/app/inventory'],
            });
        }
        for (const f of (dash.finishStocking as any[]) ?? []) {
            admin.push({
                title: 'Fry delivery with PL not stocked yet',
                detail: 'Record any PL not stocked, then finish stocking.',
                ownerOnly: true,
                where: f.hatcheryBatchNumber,
                whereSub: f.hatcheryName,
                whereLink: ['/app/resources/fry-deliveries', f.id],
                since: `Received ${this.shortDate(String(f.deliveryDate).substring(0, 10))}`,
                action: 'Finish stocking',
                actionLink: ['/app/resources/fry-deliveries', f.id],
            });
        }
        if (dash.isOwner) {
            for (const name of dash.missingRequiredDocuments as string[]) {
                admin.push({
                    title: `No active record for ${name}`,
                    detail: 'Required permit. Record it so compliance checks can pass.',
                    ownerOnly: true,
                    where: 'Permits and licenses',
                    whereSub: 'Farm',
                    whereLink: ['/app/farm/documents'],
                    since: 'Not recorded',
                    action: 'Record permit',
                    actionLink: ['/app/farm/documents'],
                });
            }
            for (const doc of dash.documentAlerts as any[]) {
                admin.push({
                    title: `${doc.categoryName}: ${doc.title}`,
                    detail: 'Permit is expiring or expired. Renewing archives the old record.',
                    ownerOnly: true,
                    where: 'Permits and licenses',
                    whereSub: 'Farm',
                    whereLink: ['/app/farm/documents'],
                    since: doc.expiryDate ? `Expires ${this.shortDate(String(doc.expiryDate).substring(0, 10))}` : '',
                    action: 'Renew permit',
                    actionLink: ['/app/farm/documents'],
                });
            }
        }

        return [
            { key: 'act', title: 'Act today', clear: 'No water alerts or high mortality in the last 7 days.', icon: 'fa-exclamation-triangle', rows: act },
            { key: 'catchup', title: 'Catch up on entry', clear: 'Nothing missed before today.', icon: 'fa-pen', rows: catchUp },
            { key: 'admin', title: 'Admin and supply', clear: 'Stock and permits are in order.', icon: 'fa-clock', rows: admin },
        ];
    });

    attentionTotal = computed(() => this.allGroups().reduce((n, g) => n + g.rows.length, 0));

    /** The group whose list is open: the one picked, else Act today when it has something. */
    picked = signal<string | null | undefined>(undefined);
    openGroup = computed(() => {
        const p = this.picked();
        return p !== undefined ? p : this.allGroups()[0]?.rows.length ? 'act' : this.allGroups().find((g) => g.rows.length)?.key ?? null;
    });

    toggleGroup(key: string): void {
        this.picked.set(this.openGroup() === key ? null : key);
    }

    /** One line under a group's count: its first item, and how many more. */
    groupSummary(g: AttentionGroup): string {
        const first = g.rows[0];
        const what = first.where && !first.title.includes(first.where) ? `${first.where}: ${first.title}` : first.title;
        return g.rows.length > 1 ? `${what}, and ${g.rows.length - 1} more` : what;
    }

    // ---- helpers

    shortDate = shortDate;

    /** "Batch B" from "2026-09-SNA-01-B"; the full code is in the tooltip. Codes without a letter are shown whole. */
    batchShort(code: string): string {
        const m = /-([A-Z])$/.exec(code ?? '');
        return m ? `Batch ${m[1]}` : code;
    }

    /** The "not tested" key appears only when some day is missing a water reading the farm requires (DEC-94). */
    hasWaterGaps = computed(() => this.rows().some((r) => r.cells.some((c) => c.water === 'missing')));

    sampleText(days: number | null): string {
        return days === null ? 'None yet' : days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`;
    }



}
