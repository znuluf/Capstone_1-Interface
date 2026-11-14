import { Component, OnInit, computed, effect, signal, untracked } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { ClientListFilter } from '@shared/fpms/client-list';
import { FarmTime } from '@shared/fpms/farm-time';
import { FPMS_IMPORTS } from '../shared-imports';
import { batchShort } from '@shared/fpms/labels';
import { CalendarCell, LOG_CALENDAR_STYLES, buildCalendarCells, shortDate, feedingsOf } from '../log-calendar';

interface PondCard {
    id: string;
    code: string;
    name: string;
    areaM2: number;
    purpose: number;
    status: number;
    archived: boolean;
    purposeLabel: string;
    batchId: string | null;
    batchCode: string | null;
    doc: number | null;
    abwG: number | null;
    fcr: number | null;
    survival: number | null;
    biomassKg: number | null;
    feedKg: number | null;
    sampleDays: number | null;
    water: { name: string; value: number; unit: string; bad: boolean }[];
    waterDate: string | null;
    strip: CalendarCell[];
    today: { label: string; done: boolean }[] | null;
    alert: string | null;
    alertLog: string | null;
}

/**
 * Ponds: one card per pond. A pond with an open batch shows its figures, latest water reading and the last seven days of
 * the log; a pond without one says what it is waiting for. Values are what has been entered so far, with the day each
 * was observed, never a live reading. Pond master data is edited on the pond's own page.
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header
            title="Ponds"
            subtitle="Every pond with its batch, latest water reading and last 7 days. Values are what was entered, with the day it was observed.">
            @if (can('Farm.Ponds.Manage')) {
                <a routerLink="/app/ponds/new" class="btn btn-primary">Add pond</a>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <!-- Filters on the page ground and the pond cards straight under them, two to a row on a laptop (DEC-108). -->
                <div class="fpms-list-filters">
                    <fpms-list-toolbar
                        placeholder="Search by pond, purpose or batch"
                        [search]="f.search()"
                        [resultText]="f.resultText()"
                        [chips]="f.chips()"
                        [chip]="f.chip()"
                        (searchChange)="onSearch($event)"
                        (chipChange)="onChip($event)"></fpms-list-toolbar>
                </div>
                @if (!cards()) {
                    <fpms-loading></fpms-loading>
                } @else if (!cards()!.length) {
                    <div class="card">
                        <fpms-empty text="No ponds yet. Add your ponds before planning a production cycle." icon="fas fa-water">
                            @if (can('Farm.Ponds.Manage')) {
                                <a routerLink="/app/ponds/new" class="btn btn-sm btn-primary">Add a pond</a>
                            }
                        </fpms-empty>
                    </div>
                } @else if (f.noMatch()) {
                    <div class="card"><fpms-empty text="No ponds match. Clear the search or the filter." icon="fas fa-water"></fpms-empty></div>
                } @else {
                    <div class="pd-grid">
                        @for (p of shownCards(); track p.id) {
                            <article class="pd-card" [class.pd-alert]="!!p.alert" [class.pd-archived]="p.archived">
                                <div class="pd-head">
                                    <div>
                                        <a [routerLink]="['/app/ponds', p.id]" class="fpms-pond-tag pd-tag">{{ p.code }}</a>
                                        <div class="text-muted">{{ p.name }} · {{ p.areaM2 | num: 0 }} m²</div>
                                    </div>
                                    <fpms-badge [text]="p.status | label: L.PondDisplayStatuses"></fpms-badge>
                                </div>

                                @if (p.batchId) {
                                    <a class="pd-batch" [routerLink]="['/app/production/batches', p.batchId]" [title]="p.batchCode">
                                        {{ batchShort(p.batchCode) }}@if (p.doc !== null) { <span class="text-muted"> · Day {{ p.doc }}</span> }
                                    </a>
                                    <!-- Three figures, then the rest on one line (DEC-99). -->
                                    <dl class="pd-figs">
                                        <div><dt>ABW</dt><dd>{{ p.abwG === null ? '–' : (p.abwG | num: 1) }}@if (p.abwG !== null) {<span class="u">g</span>}</dd></div>
                                        <div><dt>FCR</dt><dd>{{ p.fcr === null ? '–' : (p.fcr | num: 2) }}</dd></div>
                                        <div [class.warn]="p.survival !== null && p.survival > 100"><dt>Survival</dt><dd>{{ p.survival === null ? '–' : (p.survival | num: 0) }}@if (p.survival !== null) {<span class="u">%</span>}</dd></div>
                                    </dl>
                                    <div class="pd-more">
                                        <span>Biomass <strong>{{ p.biomassKg === null ? '–' : (p.biomassKg | num: 0) + ' kg' }}</strong></span>
                                        <span>Feed <strong>{{ p.feedKg === null ? '–' : (p.feedKg | num: 0) + ' kg' }}</strong></span>
                                        <span [class.text-warning-dark]="p.sampleDays === null || p.sampleDays > 14">Last sample <strong>{{ sampleText(p.sampleDays) }}</strong></span>
                                    </div>

                                    <div class="pd-water-line">
                                        <span class="k">Water{{ p.waterDate ? ', ' + p.waterDate : '' }}</span>
                                        @for (w of p.water; track w.name) {
                                            <span class="pd-reading" [class.bad]="w.bad">{{ w.name }} {{ w.value | num: 1 }}{{ w.bad ? ' · out of range' : (w.unit ? ' ' + w.unit : '') }}</span>
                                        } @empty {
                                            <span class="text-muted">None entered yet</span>
                                        }
                                    </div>

                                    @if (p.strip.length) {
                                        <!-- The last 7 days; a day opens this batch's Daily record on that day (DEC-102). -->
                                        <div class="pd-days" role="group" [attr.aria-label]="p.code + ', last 7 days'">
                                            @for (c of p.strip; track c.date; let i = $index) {
                                                <a class="pd-day" [routerLink]="['/app/production/batches', p.batchId]" [queryParams]="{ tab: 'daily', date: c.date }" [title]="c.title" [attr.aria-label]="p.code + ', ' + c.title">
                                                    <span class="pd-dl" [class.is-today]="c.today" aria-hidden="true">{{ dayHead(c.date) }}</span>
                                                    <span class="sq" [ngClass]="c.state" [class.is-today]="c.today">
                                                        {{ c.state === 'na' || c.state === 'today-empty' ? '' : c.count }}
                                                        @for (dt of c.dots; track dt.kind) { <span class="dot" [ngClass]="'dot-' + dt.kind"></span> }
                                                        @if (c.water !== 'na') { <span class="wq" [class.in]="c.water === 'in'" aria-hidden="true"></span> }
                                                    </span>
                                                </a>
                                            }
                                        </div>
                                    }

                                    @if (p.alert) {
                                        <div class="pd-alertline" role="status">
                                            <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                                            <span class="mr-auto">{{ p.alert }}</span>
                                            @if (p.alertLog) { <a [routerLink]="['/app/logbook', p.alertLog]">Open log</a> }
                                        </div>
                                    }
                                } @else {
                                    <div class="pd-note">
                                        <div class="font-weight-bold">{{ note(p).title }}</div>
                                        <div class="text-muted">{{ note(p).body }}</div>
                                    </div>
                                    @if (p.status === 7 && can('Farm.Production.Stock')) {
                                        <div class="pd-foot">
                                            <a class="btn btn-sm btn-primary" routerLink="/app/production/create-batch">Stock a batch</a>
                                        </div>
                                    }
                                }
                            </article>
                        }
                    </div>
                    @if (f.visible().length > shownCards().length) {
                        <div class="text-center mt-3">
                            <button type="button" class="btn btn-outline-secondary" (click)="showMore()">
                                Show {{ pageSize }} more ({{ f.visible().length - shownCards().length | num: 0 }} not shown)
                            </button>
                        </div>
                    }
                }
            </div>
        </section>
    `,
    styles: [LOG_CALENDAR_STYLES],
})
export class PondsComponent extends FpmsPage implements OnInit {
    /** Every pond, archived ones included. Archived ponds come last, so the working ponds stay at the top. */
    private readonly allCards = signal<PondCard[] | null>(null);
    cards = computed<PondCard[] | null>(() => {
        const all = this.allCards();
        return all && [...all.filter((c) => !c.archived), ...all.filter((c) => c.archived)];
    });
    /** The cards are shown a page at a time, so a farm with very many ponds still opens quickly. */
    readonly pageSize = 24;
    private readonly limit = signal(this.pageSize);
    shownCards = computed(() => this.f.visible().slice(0, this.limit()));
    f = new ClientListFilter<PondCard>(
        () => this.cards(),
        (p) => [p.code, p.name, p.batchCode, p.purposeLabel],
        (p) => p.status,
        Object.entries(this.L.PondDisplayStatuses).map(([value, label]) => ({
            value: Number(value),
            label: label as string,
        })),
        'All ponds',
        ['pond', 'ponds']
    );

    /** Reloads the cards when something is saved in the log drawer beside them. */
    private readonly reloadOnDrawerSave = (() => {
        let first = true;
        return effect(() => {
            this.drawer.saved();
            if (first) {
                first = false;
                return;
            }
            untracked(() => void this.ngOnInit());
        });
    })();

    async ngOnInit(): Promise<void> {
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
            dates.push(FarmTime.addDays(this.today, -i));
        }
        const [ponds, dash, status] = await Promise.all([
            this.api.get<any[]>('Pond', 'GetAll', { includeArchived: true }),
            this.can('Farm.Dashboard') ? this.api.get<any>('Dashboard', 'Get') : Promise.resolve(null),
            this.can('Farm.Logs')
                ? this.run(() => this.api.get<any>('Feeding', 'GetDailyStatus', { endDate: this.today, days: 7 }))
                : Promise.resolve(null),
        ]);
        const tiles = new Map<string, any>(((dash?.ponds as any[]) ?? []).map((t) => [t.pondId, t]));
        const rows = new Map<string, any>(((status?.rows as any[]) ?? []).map((r) => [r.batchId, r]));
        const alerts = new Map<string, any>(((dash?.waterQualityAlerts as any[]) ?? []).map((a) => [a.batchId, a]));
        this.allCards.set(
            ponds.map((p) => {
                const t = tiles.get(p.id);
                const row = t?.batchId ? rows.get(t.batchId) : null;
                const al = t?.batchId ? alerts.get(t.batchId) : null;
                const today = row
                    ? (row.days as any[]).find((d) => String(d.date).substring(0, 10) === this.today)
                    : null;
                return {
                    id: p.id,
                    code: p.pondCode,
                    name: p.name,
                    areaM2: p.areaM2,
                    purpose: p.purpose,
                    status: p.status,
                    archived: !!p.isArchived,
                    purposeLabel: this.L.PondPurposes[p.purpose] ?? '',
                    batchId: t?.batchId ?? null,
                    batchCode: t?.batchCode ?? null,
                    doc: t?.doc ?? null,
                    abwG: t?.abwG ?? null,
                    fcr: t?.fcrToDate ?? null,
                    survival: t?.estimatedSurvivalPct ?? null,
                    biomassKg: t?.estimatedBiomassKg ?? null,
                    feedKg: t?.cumulativeFeedKg ?? null,
                    sampleDays: row?.daysSinceGrowthSampling ?? null,
                    water: ((t?.latestWater as any[]) ?? []).map((w) => ({
                        name: w.name,
                        value: w.value,
                        unit: w.unit,
                        bad: w.isOutOfRange,
                    })),
                    waterDate: t?.latestWaterObservedAtUtc ? shortDate(this.isoDate(t.latestWaterObservedAtUtc)) : null,
                    strip: row ? buildCalendarCells(row, dates, this.today).cells : [],
                    today: today
                        ? [
                              {
                                  label: `Feeding ${feedingsOf(today).filter((v) => v !== 0).length}/${feedingsOf(today).length}`,
                                  done: feedingsOf(today).every((v) => v !== 0),
                              },
                              { label: 'Water', done: today.water === 1 },
                          ]
                        : null,
                    alert: al ? (al.readings as string[])[0] : null,
                    alertLog: al ? al.logId : null,
                } as PondCard;
            })
        );
    }

    onSearch(value: string): void {
        this.f.search.set(value);
        this.limit.set(this.pageSize);
    }

    onChip(value: unknown): void {
        this.f.chip.set(value);
        this.limit.set(this.pageSize);
    }

    showMore(): void {
        this.limit.update((n) => n + this.pageSize);
    }

    /** What a pond without an open batch is waiting for. */
    note(p: PondCard): { title: string; body: string } {
        switch (p.status) {
            case 7:
                return { title: 'Ready for stocking', body: 'Marked prepared. Create a batch to stock it.' };
            case 2:
                return {
                    title: 'Preparation in progress',
                    body: 'Add the steps on the pond page and mark it prepared when it is ready.',
                };
            case 1:
                return {
                    title: 'Not in use',
                    body:
                        p.purpose === 1
                            ? 'Start a preparation round on the pond page to begin the next batch.'
                            : 'This pond is not used for growing shrimp.',
                };
            case 5:
                return {
                    title: 'Under maintenance',
                    body: 'Not available for stocking until the status is changed on the pond page.',
                };
            case 6:
                return { title: 'Inactive', body: 'Not used by the farm at the moment.' };
            case 8:
                return { title: 'Archived', body: 'Kept for the record. Open the pond page to restore it.' };
            default:
                return { title: 'No open batch', body: '' };
        }
    }

    /** "Batch B" from the batch code; the full code is in the link's tooltip. */
    readonly batchShort = batchShort;

    /** "S 8": the weekday's letter and the day of the month, over a day square. */
    dayHead(date: string): string {
        const [y, m, d] = date.split('-').map(Number);
        return `${'SMTWTFS'[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
    }

    sampleText(days: number | null): string {
        return days === null ? 'None yet' : days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`;
    }

    private isoDate(utc: string): string {
        return FarmTime.isoDateOf(utc);
    }
}
