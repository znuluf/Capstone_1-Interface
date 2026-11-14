import { Component, OnInit, computed, signal } from '@angular/core';
import { batchShort } from '@shared/fpms/labels';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { PagerState } from '@shared/fpms/pager';
import { FPMS_IMPORTS } from '../shared-imports';
import { ToolbarChip } from '@shared/fpms/ui';

/**
 * Harvest list (Ref 7.1). Each row shows where its kilograms went as one balance (sold, not sold, not yet accounted for;
 * DEC-67) and a sale status. Filters: search, sale status chips, type, buyer and dates, shown as removable tags
 * (DEC-85 step 5).
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Harvests" subtitle="Partial, final and emergency harvests by batch.">
            <a routerLink="/app/harvests/blank-tally" class="btn btn-outline-secondary mr-2"><i class="fas fa-clipboard-list mr-1" aria-hidden="true"></i>Blank tally sheet</a>
            @if (can('Farm.Reports')) {
                <button
                    class="btn btn-outline-secondary"
                    (click)="exportCsv('ExportList', { list: 'Harvests', harvestType: f.type, search: f.search || null })"
                    [disabled]="busy()">
                    <i class="fas fa-file-csv mr-1"></i>
                    Export CSV
                </button>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="card">
                    <div class="card-header">
                        <fpms-list-toolbar
                            placeholder="Search by lot code, pond, batch or cycle"
                            [search]="f.search"
                            [resultText]="resultText()"
                            [chips]="chips()"
                            [chip]="f.unaccountedOnly ? 'open' : f.saleStatus"
                            (searchChange)="onSearch($event)"
                            (chipChange)="onStatus($event)">
                            <label class="sl-field">
                                <span>Type</span>
                                <select class="form-control form-control-sm" [(ngModel)]="f.type" (ngModelChange)="apply()">
                                    <option [ngValue]="null">All types</option>
                                    @for (o of Options.harvestType; track o.value) {
                                        <option [ngValue]="o.value">{{ o.label }} ({{ typeCounts()[o.value] ?? 0 }})</option>
                                    }
                                </select>
                            </label>
                            <label class="sl-field">
                                <span>Buyer</span>
                                <select class="form-control form-control-sm" [(ngModel)]="f.buyerId" (ngModelChange)="apply()">
                                    <option [ngValue]="null">All buyers</option>
                                    @for (b of buyers(); track b.id) {
                                        <option [ngValue]="b.id">{{ b.name }}</option>
                                    }
                                </select>
                            </label>
                            <span class="sl-range" role="group" aria-label="Dates">
                            <label class="sl-field">
                                <span>From</span>
                                <input type="date" class="form-control form-control-sm" [(ngModel)]="f.from" (ngModelChange)="apply()" />
                            </label>
                            <label class="sl-field">
                                <span>To</span>
                                <input type="date" class="form-control form-control-sm" [(ngModel)]="f.to" (ngModelChange)="apply()" />
                            </label>
                            </span>
                        </fpms-list-toolbar>
                        @if (filterTags().length) {
                            <div class="fpms-filter-tags" role="group" aria-label="Filters in use">
                                <span class="small text-muted">Filters:</span>
                                @for (t of filterTags(); track t.label) {
                                    <button type="button" class="fpms-filter-tag" (click)="t.clear()" [attr.aria-label]="'Remove filter ' + t.label">{{ t.label }} <i class="fas fa-times" aria-hidden="true"></i></button>
                                }
                                <button type="button" class="btn btn-link btn-sm p-0 ml-1" (click)="clearFilters()">Clear all</button>
                            </div>
                        }
                    </div>
                    <div class="card-body p-0 table-responsive">
                        @if (!list()) {
                            <fpms-loading></fpms-loading>
                        } @else if (!list().length) {
                            <fpms-empty [text]="filterTags().length ? 'No harvests match these filters.' : 'No harvests recorded yet.'" icon="fas fa-shrimp">
                                @if (filterTags().length) {
                                    <button type="button" class="btn btn-sm btn-outline-primary" (click)="clearFilters()">Clear all filters</button>
                                }
                            </fpms-empty>
                        } @else {
                            <table class="table table-hover mb-0 fpms-harvest-table">
                                <caption class="sr-only">Harvests, with where each one's kilograms went and its sale status</caption>
                                <thead>
                                    <tr>
                                        <!-- The lot code sits under the date it was harvested (DEC-99). -->
                                        <th fpmsSort="harvestedAt" [pager]="pager" (sorted)="load()">Harvested · lot</th>
                                        <th fpmsSort="pondCode" [pager]="pager" (sorted)="load()">Pond · batch</th>
                                        <th fpmsSort="harvestType" [pager]="pager" (sorted)="load()">Type</th>
                                        <th class="text-right" fpmsSort="totalKg" [pager]="pager" (sorted)="load()">Total kg</th>
                                        @if (grading) { <th>Size grades</th> }
                                        <th fpmsSort="unaccountedKg" [pager]="pager" (sorted)="load()">Sales · where it went</th>
                                        <th><span class="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (h of list(); track h.id) {
                                        <tr>
                                            <td class="text-nowrap">
                                                <a [routerLink]="['/app/harvests', h.id]">
                                                    {{ h.harvestedAtUtc | farmDateTime }}
                                                </a>
                                                <div class="text-monospace small">
                                                    @if (h.lotCode && can('Farm.Reports')) {
                                                        <a [routerLink]="['/app/reports/trace/lot', h.lotCode]" [queryParams]="{ from: 'harvests' }" title="Trace this lot">{{ h.lotCode }}</a>
                                                    } @else {
                                                        <span class="text-muted">{{ h.lotCode || 'No lot code' }}</span>
                                                    }
                                                </div>
                                            </td>
                                            <td class="text-nowrap">
                                                <a [routerLink]="['/app/production/batches', h.batchId]" [title]="h.batchCode"><span class="fpms-pond-tag">{{ h.pondCode }}</span> {{ batchShort(h.batchCode) }}</a>
                                                <div class="small text-muted">Cycle {{ h.cycleCode }}</div>
                                            </td>
                                            <td class="text-nowrap">{{ h.harvestType | label: L.HarvestTypes }}</td>
                                            <td class="text-right font-weight-bold">{{ h.totalKg | num: 2 }}</td>
                                            @if (grading) {
                                            <td>
                                                @if (h.gradeLines?.length) {
                                                    <span class="fpms-chips">
                                                        @for (g of h.gradeLines; track $index) {
                                                            <span class="fpms-chip"><b>{{ g.sizeLabel }}</b> {{ g.kg | num: 1 }} kg</span>
                                                        }
                                                    </span>
                                                } @else {
                                                    <span class="fpms-none">—</span>
                                                }
                                            </td>
                                            }
                                            <!-- The sale status heads the bar it sums up, instead of a column of its own (DEC-99). -->
                                            <td style="min-width: 12rem">
                                                <fpms-badge class="d-inline-block mb-1" [text]="statusLabel(h)"></fpms-badge>
                                                <div class="fpms-balance" aria-hidden="true">
                                                    @if (h.soldKg > 0) { <div class="sold" [style.flex-grow]="h.soldKg"></div> }
                                                    @if (h.notSoldKg > 0) { <div class="notsold" [style.flex-grow]="h.notSoldKg"></div> }
                                                    @if (h.unaccountedKg > 0) { <div class="open" [style.flex-grow]="h.unaccountedKg"></div> }
                                                </div>
                                                <div class="small text-muted mt-1">
                                                    Sold {{ h.soldKg | num: 2 : true }} kg{{ h.notSoldKg > 0 ? ' · not sold ' + (h.notSoldKg | num: 2 : true) + ' kg' : '' }}
                                                    @if (h.unaccountedKg > 0) {
                                                        <div class="text-warning-dark font-weight-bold"><i class="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>{{ h.unaccountedKg | num: 2 : true }} kg not accounted for</div>
                                                    }
                                                </div>
                                            </td>
                                            <td class="text-right text-nowrap">
                                                <a class="btn btn-sm btn-outline-secondary" [class.mr-1]="can('Farm.Sales') && sellable(h) > 0" [routerLink]="['/app/harvests', h.id, 'tally']" [attr.aria-label]="'Tally sheet of the ' + (h.harvestedAtUtc | farmDate) + ' harvest'">
                                                    <i class="fas fa-clipboard-list mr-1" aria-hidden="true"></i>Tally sheet
                                                </a>
                                                @if (can('Farm.Sales') && sellable(h) > 0) {
                                                    <a
                                                        class="btn btn-sm btn-outline-primary"
                                                        routerLink="/app/sales/new"
                                                        [queryParams]="{ harvestId: h.id }">
                                                        Record sale
                                                    </a>
                                                }
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="3">{{ list()!.length === total() ? 'All matching harvests' : 'This page' }}</td>
                                        <td class="text-right">{{ pageTotals().kg | num: 2 }}</td>
                                        @if (grading) { <td></td> }
                                        <td class="small text-wrap">Sold {{ pageTotals().sold | num: 2 }} · not sold {{ pageTotals().notSold | num: 2 }} · not accounted for {{ pageTotals().unaccounted | num: 2 }}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        }
                    </div>
                    <fpms-pager [state]="pager" (changed)="load()"></fpms-pager>
                </div>
            </div>
        </section>
    `,
})
export class HarvestsComponent extends FpmsPage implements OnInit {
    /** "Batch B" from the batch code; the full code is in the link's tooltip. */
    readonly batchShort = batchShort;

    list = signal<any[] | null>(null);
    typeCounts = signal<Record<number, number>>({});
    statusCounts = signal<Record<number, number>>({});
    total = signal(0);
    buyers = signal<any[]>([]);
    f: any = { search: '', type: null, saleStatus: null, unaccountedOnly: false, buyerId: null, from: null, to: null };

    pager = new PagerState('harvestedAt desc');

    private readonly statuses = [
        { value: 1, label: 'No sales yet' },
        { value: 2, label: 'Partly sold' },
        { value: 3, label: 'Sold' },
    ];

    /** Sale status chips; "Not accounted for" (count 9 from the server) cuts across them: kilos neither sold nor recorded as not sold. */
    chips = computed<ToolbarChip[]>(() => {
        const c = this.statusCounts();
        return [
            { value: null, label: 'All', count: this.statuses.reduce((n, s) => n + (c[s.value] ?? 0), 0) },
            ...this.statuses.map((s) => ({ value: s.value, label: s.label, count: c[s.value] ?? 0 })),
            { value: 'open', label: 'Not accounted for', count: c[9] ?? 0 },
        ];
    });

    /** Sums of the rows on this page, shown in the table footer. */
    pageTotals = computed(() => {
        const rows = this.list() ?? [];
        const sum = (f: (h: any) => number | null | undefined) => rows.reduce((n, h) => n + (Number(f(h)) || 0), 0);
        return {
            kg: sum((h) => h.totalKg),
            sold: sum((h) => h.soldKg),
            notSold: sum((h) => h.notSoldKg),
            unaccounted: sum((h) => h.unaccountedKg),
        };
    });

    resultText = computed(() => (this.total() === 1 ? '1 harvest' : `${this.total()} harvests`));

    ngOnInit(): void {
        this.restoreList(this.pager, this.f, {
            search: 'string',
            type: 'number',
            saleStatus: 'number',
            unaccountedOnly: 'boolean',
            buyerId: 'string',
            from: 'string',
            to: 'string',
        });
        this.api.get<any[]>('TallySheet', 'GetBuyerOptions').then((b) => this.buyers.set(b ?? []), () => this.buyers.set([]));
        this.load();
    }

    apply(): void {
        this.pager.reset();
        this.load();
    }

    onSearch(value: string): void {
        this.f.search = value;
        this.apply();
    }

    onStatus(value: unknown): void {
        this.f.unaccountedOnly = value === 'open';
        this.f.saleStatus = value === 'open' ? null : (value as number | null);
        this.apply();
    }

    statusLabel(h: any): string {
        return this.statuses.find((s) => s.value === h.saleStatus)?.label ?? '';
    }

    /** Every filter in use as a removable tag, so a filtered list never looks like an empty one. */
    filterTags(): { label: string; clear: () => void }[] {
        const f = this.f;
        const tags: { label: string; clear: () => void }[] = [];
        const add = (label: string, clear: () => void) => tags.push({ label, clear: () => { clear(); this.apply(); } });
        if (f.search) { add(`"${f.search}"`, () => (f.search = '')); }
        if (f.unaccountedOnly) { add('Not accounted for', () => (f.unaccountedOnly = false)); }
        if (f.saleStatus != null) { add(this.statuses.find((s) => s.value === f.saleStatus)?.label ?? 'Status', () => (f.saleStatus = null)); }
        if (f.type != null) { add(this.Options.harvestType.find((o: any) => o.value === f.type)?.label ?? 'Type', () => (f.type = null)); }
        if (f.buyerId) { add(this.buyers().find((b) => b.id === f.buyerId)?.name ?? 'Buyer', () => (f.buyerId = null)); }
        if (f.from) { add('From ' + FarmTime.date(f.from), () => (f.from = null)); }
        if (f.to) { add('To ' + FarmTime.date(f.to), () => (f.to = null)); }
        return tags;
    }

    clearFilters(): void {
        Object.assign(this.f, { search: '', type: null, saleStatus: null, unaccountedOnly: false, buyerId: null, from: null, to: null });
        this.apply();
    }

    async load(): Promise<void> {
        await this.run(async () => {
            const f = this.f;
            const q = {
                search: f.search || undefined, harvestType: f.type, saleStatus: f.saleStatus, unaccountedOnly: f.unaccountedOnly || undefined,
                buyerId: f.buyerId || undefined, from: f.from || undefined, to: f.to || undefined,
            };
            const [r, types, statuses] = await Promise.all([
                this.api.get<any>('Harvest', 'GetList', { ...q, ...this.pager.params }),
                this.api.get<any[]>('Harvest', 'GetTypeCounts', q),
                this.api.get<any[]>('Harvest', 'GetSaleStatusCounts', q),
            ]);
            this.list.set(r.items);
            this.total.set(r.totalCount);
            this.typeCounts.set(Object.fromEntries((types ?? []).map((x) => [x.status, x.count])));
            this.statusCounts.set(Object.fromEntries((statuses ?? []).map((x) => [x.status, x.count])));
            const reload = this.pager.update(r.totalCount);
            this.syncPager(this.pager);
            if (reload) {
                await this.load();
            }
        });
    }

    sellable(h: any): number {
        return (h.gradeLines ?? []).reduce((sum: number, g: any) => sum + (g.unsoldKg || 0), 0);
    }
}
