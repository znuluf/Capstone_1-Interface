import { Component, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { PagerState } from '@shared/fpms/pager';
import { logSummary } from '@shared/fpms/log-summary';
import { FPMS_IMPORTS } from '../shared-imports';

/** Logbook history across batches, with filters and out-of-range flags (Refs 6.2–6.5, AC-11). Feeding has its own page. */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Logbooks" subtitle="Daily production records by pond">
            @if (can('Farm.Logs.Create')) {
                <a routerLink="/app/logbook/feeding" class="btn btn-primary mr-1"><i class="fas fa-utensils mr-1"></i>Feeding</a>
                <a routerLink="/app/logbook/new" class="btn btn-primary mr-1"><i class="fas fa-plus mr-1"></i>Record operations</a>
            }
            @if (can('Farm.Reports')) {
                <button class="btn btn-outline-secondary mr-1" (click)="exportCsv('ExportList', exportBody())" [disabled]="busy()"><i class="fas fa-file-csv mr-1"></i>Export CSV</button>
            }
            <a routerLink="/app/logbook/status" class="btn btn-outline-secondary mr-1"><i class="fas fa-calendar-check mr-1"></i>Daily log status</a>
            <a routerLink="/app/logbook/sheets" class="btn btn-outline-secondary"><i class="fas fa-print mr-1"></i>Paper log sheets</a>
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="card">
                    <div class="card-body pb-1">
                        <div class="form-row align-items-end">
                            <div class="form-group col-md-3">
                                <label for="b">Pond</label>
                                <select id="b" class="form-control" [(ngModel)]="f.batchId">
                                    <option [ngValue]="null">All ponds</option>
                                    @for (x of batches(); track x.id) {
                                        <option [ngValue]="x.id">{{ x.pondCode }} · {{ x.batchCode }}</option>
                                    }
                                </select>
                            </div>
                            <div class="form-group col-md-3">
                                <label for="t">Log type</label>
                                <select id="t" class="form-control" [(ngModel)]="f.logType">
                                    <option [ngValue]="null">All types</option>
                                    @for (o of Options.logType; track o.value) {
                                        <option [ngValue]="o.value">{{ o.label }}</option>
                                    }
                                </select>
                            </div>
                            <div class="form-group col-6 col-md-2">
                                <label for="from">From</label>
                                <input id="from" type="date" class="form-control" [(ngModel)]="f.from" />
                            </div>
                            <div class="form-group col-6 col-md-2">
                                <label for="to">To</label>
                                <input id="to" type="date" class="form-control" [(ngModel)]="f.to" />
                            </div>
                            <div class="form-group col-md-2">
                                <div class="custom-control custom-checkbox mb-2">
                                    <input type="checkbox" class="custom-control-input" id="oor" [(ngModel)]="f.outOfRangeOnly" />
                                    <label class="custom-control-label" for="oor">Out of range only</label>
                                </div>
                                <button class="btn btn-primary btn-block" (click)="apply()" [disabled]="busy()">Apply</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-body p-0 table-responsive">
                        @if (!logs()) {
                            <fpms-loading></fpms-loading>
                        } @else if (!logs().length) {
                            <fpms-empty text="No log entries match these filters." icon="fas fa-book"></fpms-empty>
                        } @else {
                            <table class="table table-hover table-sm mb-0">
                                <thead><tr><th>Pond / batch</th><th fpmsSort="observedAt" [pager]="pager" (sorted)="load()">Observed</th><th fpmsSort="logType" [pager]="pager" (sorted)="load()">Type</th><th>Details</th><th fpmsSort="recordedAt" [pager]="pager" (sorted)="load()">Recorded by</th></tr></thead>
                                <tbody>
                                    @for (l of logs(); track l.id) {
                                        <tr [class.fpms-row-warn]="l.hasOutOfRange">
                                            <td class="text-nowrap"><a [routerLink]="['/app/production/batches', l.batchId]"><strong>{{ l.pondCode }}</strong></a> <span class="small text-muted">{{ l.batchCode }}</span></td>
                                            <td class="text-nowrap"><a [routerLink]="['/app/logbook', l.id]">{{ l.observedAtUtc | farmDateTime }}</a></td>
                                            <td>
                                                {{ l.logType | label: L.LogTypes }}
                                                @if (l.hasOutOfRange) { <span class="badge badge-warning ml-1"><i class="fas fa-exclamation-triangle mr-1"></i>Out of range</span> }
                                                @if (l.isHighMortality) { <span class="badge badge-danger ml-1">High mortality</span> }
                                            </td>
                                            <td class="small">
                                                @if (l.measurements?.length) {
                                                    @for (m of l.measurements; track m.parameterCode) {
                                                        <span class="mr-2" [class.text-danger]="m.isOutOfRange" [class.font-weight-bold]="m.isOutOfRange">{{ m.parameterName }} {{ m.value }} {{ m.unitCode }}{{ m.isOutOfRange ? (m.side === 1 ? ' (low)' : m.side === 2 ? ' (high)' : ' (out of range)') : '' }}</span>
                                                    }
                                                } @else {
                                                    {{ summary(l) }}
                                                }
                                                @if (l.notes && l.logType !== 9) { <div class="text-muted">{{ l.notes }}</div> }
                                            </td>
                                            <td class="small text-muted">{{ l.recordedBy }}<div>recorded {{ l.creationTime | farmDateTime }}</div></td>
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
export class LogbookComponent extends FpmsPage implements OnInit {
    logs = signal<any[] | null>(null);
    batches = signal<any[]>([]);
    pager = new PagerState('observedAt desc');
    f: any = { batchId: null, logType: null, from: FarmTime.addDays(FarmTime.today(), -14), to: FarmTime.today(), outOfRangeOnly: false };

    ngOnInit(): void {
        this.f.batchId = this.query('batchId');
        this.api
            .get<any[]>('Batch', 'GetAll', {})
            .then((b) => this.batches.set((b ?? []).slice().sort((x, y) => String(x.pondCode).localeCompare(String(y.pondCode)) || String(x.batchCode).localeCompare(String(y.batchCode)))));
        this.load();
    }

    summary(l: any): string {
        return logSummary(l);
    }

    async load(): Promise<void> {
        await this.run(async () => {
            const r = await this.api.get<any>('Log', 'GetList', { ...this.f, ...this.pager.params });
            this.logs.set(r.items);
            if (this.pager.update(r.totalCount)) {
                await this.load();
            }
        });
    }

    apply(): void {
        this.pager.reset();
        this.load();
    }

    exportBody(): Record<string, unknown> {
        return { list: 'Logs', batchId: this.f.batchId, logType: this.f.logType, from: this.f.from, to: this.f.to, outOfRangeOnly: this.f.outOfRangeOnly };
    }
}
