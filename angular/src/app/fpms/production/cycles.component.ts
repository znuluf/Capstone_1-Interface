import { Component, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { PagerState } from '@shared/fpms/pager';
import { FPMS_IMPORTS } from '../shared-imports';

/** Production cycles (Ref 5.1). A cycle starts from one fry delivery through Create Batch (Stocking). */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Production cycles" subtitle="Each cycle holds the batches stocked from one fry delivery">
            @if (can('Farm.Reports')) {
                <button class="btn btn-outline-secondary mr-2" (click)="exportCsv('ExportList', { list: 'Cycles', cycleStatus: status })" [disabled]="busy()"><i class="fas fa-file-csv mr-1"></i>Export CSV</button>
            }
            @if (can('Farm.Production.Stock')) {
                <a class="btn btn-primary" routerLink="/app/production/create-batch"><i class="fas fa-fish mr-1"></i>Create Batch (Stocking)</a>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="card">
                    <div class="card-header">
                        <select class="form-control form-control-sm w-auto" aria-label="Filter by status" [(ngModel)]="status" (ngModelChange)="pager.reset(); load()">
                            <option [ngValue]="null">All statuses</option>
                            @for (o of Options.cycleStatus; track o.value) {
                                <option [ngValue]="o.value">{{ o.label }}</option>
                            }
                        </select>
                    </div>
                    <div class="card-body p-0 table-responsive">
                        @if (!cycles()) {
                            <fpms-loading></fpms-loading>
                        } @else if (!cycles().length) {
                            <fpms-empty text="No production cycles yet. Record a fry delivery, prepare a pond, then use Create Batch (Stocking)." icon="fas fa-sync"></fpms-empty>
                        } @else {
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th fpmsSort="cycleCode" [pager]="pager" (sorted)="load()">Cycle</th><th fpmsSort="status" [pager]="pager" (sorted)="load()">Status</th><th fpmsSort="startDate" [pager]="pager" (sorted)="load()">Started</th><th fpmsSort="hatcheryName" [pager]="pager" (sorted)="load()">Hatchery · delivery</th>
                                        <th class="text-right" fpmsSort="plStocked" [pager]="pager" (sorted)="load()">PL stocked / received</th><th>Batches</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (c of cycles(); track c.id) {
                                        <tr>
                                            <td><a [routerLink]="['/app/production/cycles', c.id]">{{ c.cycleCode }}</a></td>
                                            <td><fpms-badge [text]="c.status | label: L.CycleStatuses"></fpms-badge></td>
                                            <td class="text-nowrap">{{ c.startDate | farmDate }}</td>
                                            <td><span [title]="c.hatcheryName">{{ c.hatcheryShortCode || c.hatcheryName }}</span> <span class="small text-muted">· {{ c.hatcheryBatchNumber }}</span></td>
                                            <td class="text-right">{{ c.plStocked | num: 0 }} / {{ c.plReceived | num: 0 }}</td>
                                            <td>{{ c.batchCount }} ({{ c.openBatchCount }} open)</td>
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
export class CyclesComponent extends FpmsPage implements OnInit {
    cycles = signal<any[] | null>(null);
    status: number | null = null;
    pager = new PagerState('default');

    ngOnInit(): void {
        this.restorePager(this.pager);
        this.load();
    }

    async load(): Promise<void> {
        const r = await this.api.get<any>('Cycle', 'GetPage', { status: this.status, ...this.pager.params });
        this.cycles.set(r.items);
        const reload = this.pager.update(r.totalCount);
        this.syncPager(this.pager);
        if (reload) {
            await this.load();
        }
    }
}
