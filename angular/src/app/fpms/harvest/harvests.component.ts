import { Component, OnInit, computed, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { PagerState } from '@shared/fpms/pager';
import { FPMS_IMPORTS } from '../shared-imports';
import { ToolbarChip } from '@shared/fpms/ui';

/**
 * Harvest list (Ref 7.1). A summary strip totals every harvest in the search and filter; each row shows the weight with
 * boxes and ABW, the size grades, and a bar of where the weight went: sold, not sold and unaccounted (DEC-67).
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Harvests" subtitle="Partial, final and emergency harvests by batch.">
            @if (can('Farm.Reports')) {
                <button
                    class="btn btn-outline-secondary mr-2"
                    (click)="exportCsv('ExportList', { list: 'Harvests', harvestType: type, search: search || null })"
                    [disabled]="busy()">
                    <i class="fas fa-file-csv mr-1"></i>
                    Export CSV
                </button>
            }
            <a routerLink="/app/harvests/size-grades" class="btn btn-default mr-2">
                <i class="fas fa-ruler-horizontal mr-1"></i>
                Size grades
            </a>
            @if (can('Farm.Harvests.Create')) {
                <a routerLink="/app/harvests/new" class="btn btn-primary">
                    <i class="fas fa-plus mr-1"></i>
                    Record harvest
                </a>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (summary(); as s) {
                    @if (s.count) {
                        <div
                            class="fpms-stats fpms-harvest-stats"
                            role="group"
                            aria-label="Harvest totals for the current search and filter">
                            <div class="fpms-stat">
                                <div class="v">{{ s.totalKg | num: 2 }} kg</div>
                                <div class="l">Harvested</div>
                                <div class="s">
                                    {{ s.count === 1 ? '1 harvest' : (s.count | num: 0) + ' harvests' }}
                                </div>
                            </div>
                            <div class="fpms-stat">
                                <div class="v">
                                    <i class="sq sold" aria-hidden="true"></i>
                                    {{ s.soldKg | num: 2 }} kg
                                </div>
                                <div class="l">Sold</div>
                                <div class="s">{{ share(s.soldKg, s.totalKg) | num: 0 }}% of harvested</div>
                            </div>
                            <div class="fpms-stat">
                                <div class="v">
                                    <i class="sq kept" aria-hidden="true"></i>
                                    {{ s.notSoldKg | num: 2 }} kg
                                </div>
                                <div class="l">Not sold</div>
                                <div class="s">
                                    Kept, given away or lost · {{ share(s.notSoldKg, s.totalKg) | num: 0 }}%
                                </div>
                            </div>
                            <div class="fpms-stat" [class.warn]="s.unaccountedKg > 0">
                                @if (s.unaccountedKg > 0) {
                                    <div class="v">
                                        <i class="sq open" aria-hidden="true"></i>
                                        {{ s.unaccountedKg | num: 2 }} kg
                                    </div>
                                    <div class="l">Unaccounted</div>
                                    <div class="s">
                                        In
                                        {{
                                            s.withUnaccounted === 1
                                                ? '1 harvest'
                                                : (s.withUnaccounted | num: 0) + ' harvests'
                                        }}: record a sale or a not-sold entry
                                    </div>
                                } @else {
                                    <div class="v text-success">
                                        <i class="fas fa-check-circle mr-1" aria-hidden="true"></i>
                                        0 kg
                                    </div>
                                    <div class="l">Unaccounted</div>
                                    <div class="s">Every kilogram is sold or recorded</div>
                                }
                            </div>
                        </div>
                    }
                }
                <div class="card">
                    <div class="card-header">
                        <fpms-list-toolbar
                            placeholder="Search by pond, batch or cycle"
                            [search]="search"
                            [resultText]="resultText()"
                            [chips]="chips()"
                            [chip]="type"
                            (searchChange)="onSearch($event)"
                            (chipChange)="onType($event)"></fpms-list-toolbar>
                    </div>
                    <div class="card-body p-0 table-responsive">
                        @if (!list()) {
                            <fpms-loading></fpms-loading>
                        } @else if (!list().length) {
                            <fpms-empty
                                [text]="
                                    search || type !== null
                                        ? 'No harvests match. Clear the search or the filter.'
                                        : 'No harvests recorded yet.'
                                "
                                icon="fas fa-shrimp"></fpms-empty>
                        } @else {
                            <table class="table table-hover mb-0 fpms-harvest-table">
                                <caption class="sr-only">
                                    Harvests, with their size grades and how much of each was sold, not sold or not yet
                                    accounted for
                                </caption>
                                <thead>
                                    <tr>
                                        <th fpmsSort="harvestedAt" [pager]="pager" (sorted)="load()">Harvested</th>
                                        <th>Pond · batch</th>
                                        <th fpmsSort="harvestType" [pager]="pager" (sorted)="load()">Type</th>
                                        <th class="text-right" fpmsSort="totalKg" [pager]="pager" (sorted)="load()">
                                            Weight
                                        </th>
                                        <th>Size grades</th>
                                        <th class="fpms-acct-col">Where it went</th>
                                        <th><span class="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (h of list(); track h.id) {
                                        <tr [class.fpms-row-warn]="h.unaccountedKg > 0">
                                            <td class="text-nowrap">
                                                <a [routerLink]="['/app/harvests', h.id]">
                                                    {{ h.harvestedAtUtc | farmDate }}
                                                </a>
                                                <div class="small text-muted">{{ h.harvestedAtUtc | farmTime }}</div>
                                            </td>
                                            <td class="text-nowrap">
                                                <a [routerLink]="['/app/production/batches', h.batchId]">
                                                    {{ h.pondCode }} · {{ h.batchCode }}
                                                </a>
                                                <div class="small text-muted">{{ h.cycleCode }}</div>
                                            </td>
                                            <td>
                                                <fpms-badge
                                                    [text]="h.harvestType | label: L.HarvestTypes"
                                                    [tone]="h.harvestType === 2 ? 'primary' : 'secondary'"></fpms-badge>
                                            </td>
                                            <td class="text-right text-nowrap">
                                                <div class="font-weight-bold">{{ h.totalKg | num: 2 }} kg</div>
                                                @if (h.boxes != null || h.abwG) {
                                                    <div class="small text-muted">
                                                        @if (h.boxes != null) {
                                                            {{ h.boxes | num: 0 }} {{ h.boxes === 1 ? 'box' : 'boxes' }}
                                                        }
                                                        @if (h.boxes != null && h.abwG) {
                                                            ·
                                                        }
                                                        @if (h.abwG) {
                                                            <span title="Sampled average body weight">
                                                                ABW {{ h.abwG | num: 1 }} g ≈
                                                                {{ 1000 / h.abwG | num: 0 }}/kg
                                                            </span>
                                                        }
                                                    </div>
                                                }
                                            </td>
                                            <td>
                                                @if (h.gradeLines?.length) {
                                                    <span class="fpms-chips">
                                                        @for (g of h.gradeLines; track $index) {
                                                            <span
                                                                class="fpms-chip"
                                                                [class.fpms-chip-done]="g.unsoldKg <= 0"
                                                                [title]="
                                                                    g.unsoldKg > 0
                                                                        ? (g.unsoldKg | num: 2) + ' kg not yet sold'
                                                                        : 'All sold'
                                                                ">
                                                                <b>{{ g.sizeLabel }}</b>
                                                                {{ g.kg | num: 1 }} kg
                                                            </span>
                                                        }
                                                    </span>
                                                    @if (h.ungradedRemainderKg > 0) {
                                                        <div class="small text-muted mt-1">
                                                            {{ h.ungradedRemainderKg | num: 1 }} kg not graded
                                                        </div>
                                                    }
                                                } @else {
                                                    <span class="fpms-none">Not graded</span>
                                                }
                                            </td>
                                            <td class="fpms-acct-col">
                                                <div class="fpms-split" role="img" [attr.aria-label]="splitLabel(h)">
                                                    <span
                                                        class="sold"
                                                        [style.width.%]="share(h.soldKg, h.totalKg)"></span>
                                                    <span
                                                        class="kept"
                                                        [style.width.%]="share(h.notSoldKg, h.totalKg)"></span>
                                                    <span
                                                        class="open"
                                                        [style.width.%]="share(h.unaccountedKg, h.totalKg)"></span>
                                                </div>
                                                <div class="small text-nowrap mt-1" aria-hidden="true">
                                                    <span>
                                                        <i class="sq sold"></i>
                                                        Sold {{ h.soldKg | num: 2 }}
                                                    </span>
                                                    @if (h.notSoldKg > 0) {
                                                        <span class="ml-2">
                                                            <i class="sq kept"></i>
                                                            Not sold {{ h.notSoldKg | num: 2 }}
                                                        </span>
                                                    }
                                                </div>
                                                @if (h.unaccountedKg > 0) {
                                                    <div
                                                        class="small text-warning-dark font-weight-bold text-nowrap"
                                                        aria-hidden="true">
                                                        <i class="fas fa-exclamation-triangle mr-1"></i>
                                                        {{ h.unaccountedKg | num: 2 }} kg unaccounted
                                                    </div>
                                                } @else {
                                                    <div class="small text-success text-nowrap" aria-hidden="true">
                                                        <i class="fas fa-check mr-1"></i>
                                                        All accounted for
                                                    </div>
                                                }
                                            </td>
                                            <td class="text-right text-nowrap">
                                                @if (can('Farm.Sales') && sellable(h) > 0) {
                                                    <a
                                                        class="btn btn-sm btn-outline-primary"
                                                        routerLink="/app/sales/new"
                                                        [title]="
                                                            (sellable(h) | num: 2) + ' kg graded and not yet sold'
                                                        ">
                                                        Record sale
                                                    </a>
                                                }
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        }
                    </div>
                    <fpms-pager [state]="pager" (changed)="load()"></fpms-pager>
                </div>
            </div>
        </section>
    `,
    styles: [
        `
            .fpms-stat .s {
                font-size: 0.8rem;
                color: var(--fpms-muted);
                margin-top: 0.15rem;
            }
            .fpms-stat .v .sq {
                vertical-align: 0.2em;
                margin-right: 0.45rem;
            }
            .sq {
                display: inline-block;
                width: 0.65rem;
                height: 0.65rem;
                border-radius: 2px;
                margin-right: 0.3rem;
            }
            .sq.sold,
            .fpms-split .sold {
                background: var(--fpms-accent);
            }
            .sq.kept,
            .fpms-split .kept {
                background: #8fa3ad;
            }
            .sq.open,
            .fpms-split .open {
                background: repeating-linear-gradient(135deg, var(--fpms-warning) 0 3px, var(--fpms-warn-line) 3px 6px);
            }
            .fpms-acct-col {
                min-width: 12rem;
            }
            .fpms-split {
                display: flex;
                height: 0.5rem;
                border-radius: 999px;
                overflow: hidden;
                background: var(--fpms-ground-muted);
                gap: 1px;
            }
            .fpms-split span {
                display: block;
                height: 100%;
            }
            .fpms-chip-done {
                background: var(--fpms-accent-50);
                border-color: #b9d9d9;
            }
            .fpms-harvest-table tbody tr.fpms-row-warn > td:first-child {
                box-shadow: inset 3px 0 0 var(--fpms-warning);
            }
            .fpms-harvest-table td {
                vertical-align: top;
            }
        `,
    ],
})
export class HarvestsComponent extends FpmsPage implements OnInit {
    list = signal<any[] | null>(null);
    counts = signal<Record<number, number>>({});
    /** Totals for every harvest matching the search and filter, across all pages. */
    summary = signal<any | null>(null);
    total = signal(0);
    type: number | null = null;
    search = '';

    pager = new PagerState('harvestedAt desc');

    chips = computed<ToolbarChip[]>(() => {
        const c = this.counts();
        const all = (Object.values(c) as number[]).reduce((n, v) => n + v, 0);
        return [
            { value: null, label: 'All types', count: all },
            ...this.Options.harvestType.map((o: any) => ({ value: o.value, label: o.label, count: c[o.value] ?? 0 })),
        ];
    });

    resultText = computed(() => (this.total() === 1 ? '1 harvest' : `${this.total()} harvests`));

    ngOnInit(): void {
        this.restoreList(this.pager, this, { type: 'number', search: 'string' });
        this.load();
    }

    onSearch(value: string): void {
        this.search = value;
        this.pager.reset();
        this.load();
    }

    onType(value: unknown): void {
        this.type = value as number | null;
        this.pager.reset();
        this.load();
    }

    async load(): Promise<void> {
        await this.run(async () => {
            const q = { search: this.search || undefined };
            const [r, counts, summary] = await Promise.all([
                this.api.get<any>('Harvest', 'GetList', { harvestType: this.type, ...q, ...this.pager.params }),
                this.api.get<any[]>('Harvest', 'GetTypeCounts', q),
                // The strip is extra: if the summary fails, the list still loads.
                this.api.get<any>('Harvest', 'GetSummary', { harvestType: this.type, ...q }).catch(() => null),
            ]);
            this.list.set(r.items);
            this.total.set(r.totalCount);
            this.summary.set(summary);
            this.counts.set(Object.fromEntries((counts ?? []).map((x) => [x.status, x.count])));
            const reload = this.pager.update(r.totalCount);
            this.syncPager(this.pager);
            if (reload) {
                await this.load();
            }
        });
    }

    /** Percentage of a harvest's weight, for the bar widths and the summary tiles. */
    share(kg: number | null | undefined, total: number | null | undefined): number {
        const t = Number(total) || 0;
        return t > 0 ? Math.min(100, Math.max(0, ((Number(kg) || 0) / t) * 100)) : 0;
    }

    /** The bar's text for screen readers, since the bar itself is only shapes. */
    splitLabel(h: any): string {
        const n = (v: number) =>
            (Number(v) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `Of ${n(h.totalKg)} kg: ${n(h.soldKg)} sold, ${n(h.notSoldKg)} not sold, ${n(h.unaccountedKg)} unaccounted`;
    }

    sellable(h: any): number {
        return (h.gradeLines ?? []).reduce((sum: number, g: any) => sum + (g.unsoldKg || 0), 0);
    }
}
