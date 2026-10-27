import { Component, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { PagerState } from '@shared/fpms/pager';
import { FPMS_IMPORTS } from '../shared-imports';

/** All pond batches with live indicators (Ref 5.2). */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Pond batches" subtitle="One batch per grow-out pond per cycle">
            @if (can('Farm.Reports')) {
                <button class="btn btn-outline-secondary" (click)="exportCsv('ExportList', { list: 'Batches', batchStatus: status, openOnly: openOnly })" [disabled]="busy()"><i class="fas fa-file-csv mr-1"></i>Export CSV</button>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="card">
                    <div class="card-header d-flex flex-wrap align-items-center">
                        <select class="form-control form-control-sm w-auto mr-2" aria-label="Filter by status" [(ngModel)]="status" (ngModelChange)="pager.reset(); load()">
                            <option [ngValue]="null">All statuses</option>
                            @for (o of Options.batchStatus; track o.value) {
                                <option [ngValue]="o.value">{{ o.label }}</option>
                            }
                        </select>
                        <div class="custom-control custom-checkbox">
                            <input type="checkbox" class="custom-control-input" id="open" [(ngModel)]="openOnly" (ngModelChange)="pager.reset(); load()" />
                            <label class="custom-control-label small" for="open">Open batches only</label>
                        </div>
                    </div>
                    <div class="card-body p-0 table-responsive">
                        @if (!batches()) {
                            <fpms-loading></fpms-loading>
                        } @else if (!batches().length) {
                            <fpms-empty text="No batches match. Batches are created with Create Batch (Stocking)." icon="fas fa-seedling">
                                <a routerLink="/app/production/cycles" class="btn btn-sm btn-primary">Go to cycles</a>
                            </fpms-empty>
                        } @else {
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th fpmsSort="batchCode" [pager]="pager" (sorted)="load()">Batch</th><th fpmsSort="cycleCode" [pager]="pager" (sorted)="load()">Cycle</th><th fpmsSort="pondCode" [pager]="pager" (sorted)="load()">Pond</th><th fpmsSort="status" [pager]="pager" (sorted)="load()">Status</th><th fpmsSort="stockingDate" [pager]="pager" (sorted)="load()">Stocking</th><th class="text-right" fpmsSort="plCountStocked" [pager]="pager" (sorted)="load()">PL</th>
                                        <th class="text-right">DOC</th><th class="text-right">ABW (g)</th><th class="text-right">FCR</th><th class="text-right">Est. survival</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (b of batches(); track b.id) {
                                        <tr>
                                            <td><a [routerLink]="['/app/production/batches', b.id]">{{ b.batchCode }}</a></td>
                                            <td><a [routerLink]="['/app/production/cycles', b.cycleId]">{{ b.cycleCode }}</a></td>
                                            <td>{{ b.pondCode }}</td>
                                            <td><fpms-badge [text]="b.status | label: L.BatchStatuses"></fpms-badge></td>
                                            <td class="text-nowrap">
                                                {{ b.stockingDate | farmDate }}
                                            </td>
                                            <td class="text-right">{{ b.plCountStocked | num: 0 }}</td>
                                            <td class="text-right">{{ b.doc ?? '—' }}</td>
                                            <td class="text-right">{{ b.currentAbwG | num: 2 }}</td>
                                            <td class="text-right">{{ b.fcrToDate | num: 2 }}</td>
                                            <td class="text-right">
                                                @if (b.estimatedSurvivalPct !== null && b.estimatedSurvivalPct !== undefined) { {{ b.estimatedSurvivalPct | num: 1 }}% } @else { — }
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
export class BatchesComponent extends FpmsPage implements OnInit {
    batches = signal<any[] | null>(null);
    status: number | null = null;
    openOnly = true;
    pager = new PagerState('default');

    ngOnInit(): void {
        this.restorePager(this.pager);
        this.load();
    }

    async load(): Promise<void> {
        const r = await this.api.get<any>('Batch', 'GetPage', { status: this.status, openOnly: this.openOnly, ...this.pager.params });
        this.batches.set(r.items);
        const reload = this.pager.update(r.totalCount);
        this.syncPager(this.pager);
        if (reload) {
            await this.load();
        }
    }
}
