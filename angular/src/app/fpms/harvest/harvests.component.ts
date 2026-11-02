import { Component, OnInit, computed, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { PagerState } from '@shared/fpms/pager';
import { FPMS_IMPORTS } from '../shared-imports';
import { ToolbarChip } from '@shared/fpms/ui';

/** Harvest list (Ref 7.1) with sold, not-sold and unaccounted kilograms (DEC-67). */
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
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th fpmsSort="harvestedAt" [pager]="pager" (sorted)="load()">Harvested</th>
                                        <th>Pond / batch</th>
                                        <th>Cycle</th>
                                        <th fpmsSort="harvestType" [pager]="pager" (sorted)="load()">Type</th>
                                        <th class="text-right" fpmsSort="totalKg" [pager]="pager" (sorted)="load()">
                                            Total kg
                                        </th>
                                        <th class="text-right">Boxes</th>
                                        <th class="text-right">Total kg</th>
                                        <th class="text-right">Boxes</th>
                                        <th class="text-right">ABW (g)</th>
                                        <th>Grades</th>
                                        <th class="text-right">Sold kg</th>
                                        <th class="text-right">Not sold kg</th>
                                        <th class="text-right">Unaccounted kg</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (h of list(); track h.id) {
                                        <tr>
                                            <td class="text-nowrap">
                                                <a [routerLink]="['/app/harvests', h.id]">
                                                    {{ h.harvestedAtUtc | farmDateTime }}
                                                </a>
                                            </td>
                                            <td>
                                                <a [routerLink]="['/app/production/batches', h.batchId]">
                                                    {{ h.pondCode }} · {{ h.batchCode }}
                                                </a>
                                            </td>
                                            <td>{{ h.cycleCode }}</td>
                                            <td>{{ h.harvestType | label: L.HarvestTypes }}</td>
                                            <td class="text-right">{{ h.totalKg | num: 2 }}</td>
                                            <td class="text-right">{{ h.boxes ?? '—' }}</td>
                                            <td class="text-right">{{ h.abwG | num: 2 }}</td>
                                            <td class="small">
                                                @for (g of h.gradeLines; track $index) {
                                                    <span class="mr-2">{{ g.sizeLabel }}: {{ g.kg | num: 1 }} kg</span>
                                                }
                                            </td>
                                            <td class="text-right">{{ h.soldKg | num: 2 }}</td>
                                            <td class="text-right">{{ h.notSoldKg | num: 2 }}</td>
                                            <td class="text-right" [class.text-warning-dark]="h.unaccountedKg > 0">
                                                {{ h.unaccountedKg | num: 2 }}
                                            </td>
                                            <td class="text-right text-nowrap">
                                                @if (can('Farm.Sales') && sellable(h) > 0) {
                                                    <a
                                                        class="btn btn-sm btn-outline-primary"
                                                        routerLink="/app/sales/new">
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
})
export class HarvestsComponent extends FpmsPage implements OnInit {
    list = signal<any[] | null>(null);
    counts = signal<Record<number, number>>({});
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
            const [r, counts] = await Promise.all([
                this.api.get<any>('Harvest', 'GetList', { harvestType: this.type, ...q, ...this.pager.params }),
                this.api.get<any[]>('Harvest', 'GetTypeCounts', q),
            ]);
            this.list.set(r.items);
            this.total.set(r.totalCount);
            this.counts.set(Object.fromEntries((counts ?? []).map((x) => [x.status, x.count])));
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
