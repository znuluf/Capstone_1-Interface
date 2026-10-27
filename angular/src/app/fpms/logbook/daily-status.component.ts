import { Component, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * Daily log status (DEC-50): for every stocked pond, whether the AM feeding, PM feeding and water-quality reading of each
 * day were logged, marked Not fed, or left blank; and how long since the last mortality, growth sampling and chemical
 * entry. A blank cell is a missing record, not a skipped feeding. Nothing here sends a notification (DEC-49).
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Daily log status" subtitle="Which daily records are in, by pond" backLink="/app/logbook" backLabel="Logbooks"></fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="card">
                    <div class="card-body pb-1">
                        <div class="form-row align-items-end">
                            <div class="form-group col-6 col-md-3">
                                <label for="end">Up to</label>
                                <input id="end" type="date" class="form-control" [(ngModel)]="endDate" [max]="today" (ngModelChange)="load()" />
                            </div>
                            <div class="form-group col-6 col-md-2">
                                <label for="days">Days</label>
                                <select id="days" class="form-control" [(ngModel)]="days" (ngModelChange)="load()">
                                    @for (n of [7, 14, 31]; track n) { <option [ngValue]="n">{{ n }}</option> }
                                </select>
                            </div>
                            <div class="form-group col-md-7 small text-muted">
                                <span class="fpms-ds-cell ok mr-1">✓</span>logged
                                <span class="fpms-ds-cell nf ml-3 mr-1">–</span>not fed
                                <span class="fpms-ds-cell blank ml-3 mr-1">!</span>blank
                                <span class="fpms-ds-cell na ml-3 mr-1"></span>not expected
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-body p-0 table-responsive">
                        @if (!s()) {
                            <fpms-loading></fpms-loading>
                        } @else if (!s().rows.length) {
                            <fpms-empty text="No pond is stocked in this period." icon="fas fa-calendar-check"></fpms-empty>
                        } @else {
                            <table class="table table-sm table-bordered mb-0 fpms-ds">
                                <thead>
                                    <tr>
                                        <th rowspan="2" class="align-bottom">Pond / batch</th>
                                        @for (d of dates(); track d) {
                                            <th colspan="3" class="text-center small text-nowrap">{{ d | farmDate }}</th>
                                        }
                                        <th colspan="3" class="text-center small">Days since last</th>
                                    </tr>
                                    <tr class="small text-muted">
                                        @for (d of dates(); track d) {
                                            <th class="text-center">AM</th><th class="text-center">PM</th><th class="text-center">WQ</th>
                                        }
                                        <th class="text-center">Mort.</th><th class="text-center">Growth</th><th class="text-center">Chem.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (r of s().rows; track r.batchId) {
                                        <tr>
                                            <td class="text-nowrap">
                                                <a [routerLink]="['/app/production/batches', r.batchId]">{{ r.pondCode }}</a>
                                                <div class="small text-muted">{{ r.batchCode }}</div>
                                            </td>
                                            @for (d of dates(); track d) {
                                                @let c = cell(r, d);
                                                @if (!c) {
                                                    <td class="fpms-ds-cell na" colspan="3" title="Not stocked yet"></td>
                                                } @else {
                                                    <td class="fpms-ds-cell" [ngClass]="cls(c.am)" [title]="'AM feeding: ' + text(c.am)">
                                                        @if (c.am === 0 && canCreate) { <a [routerLink]="['/app/logbook/feeding']" [queryParams]="{ batchId: r.batchId, date: d }">!</a> } @else { {{ mark(c.am) }} }
                                                    </td>
                                                    <td class="fpms-ds-cell" [ngClass]="cls(c.pm)" [title]="'PM feeding: ' + text(c.pm)">
                                                        @if (c.pm === 0 && canCreate) { <a [routerLink]="['/app/logbook/feeding']" [queryParams]="{ batchId: r.batchId, date: d }">!</a> } @else { {{ mark(c.pm) }} }
                                                    </td>
                                                    <td class="fpms-ds-cell" [ngClass]="cls(c.water)" [title]="'Water quality: ' + text(c.water)">{{ mark(c.water) }}</td>
                                                }
                                            }
                                            <td class="text-center small">{{ since(r.daysSinceMortality) }}</td>
                                            <td class="text-center small" [class.text-warning-dark]="r.daysSinceGrowthSampling == null || r.daysSinceGrowthSampling > 14">{{ since(r.daysSinceGrowthSampling) }}</td>
                                            <td class="text-center small">{{ since(r.daysSinceChemical) }}</td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        }
                    </div>
                </div>
                <p class="small text-muted">
                    <i class="fas fa-info-circle mr-1"></i>Mortality, growth sampling and chemical entries are recorded when they happen, so they show the days since the last entry rather than a daily cell.
                    Use <strong>Not fed</strong> on the feeding sheet when a session was skipped on purpose.
                </p>
            </div>
        </section>
    `,
    styles: [
        `
            .fpms-ds td,
            .fpms-ds th {
                vertical-align: middle;
            }
            .fpms-ds-cell {
                text-align: center;
                width: 1.75rem;
                min-width: 1.75rem;
                font-weight: 700;
                display: table-cell;
            }
            span.fpms-ds-cell {
                display: inline-block;
                border: 1px solid #dee2e6;
                line-height: 1.4;
            }
            .fpms-ds-cell.ok {
                background: #e6f4ea;
                color: #1e7e34;
            }
            .fpms-ds-cell.nf {
                background: #f1f3f5;
                color: #6c757d;
            }
            .fpms-ds-cell.blank {
                background: #fff3cd;
                color: #856404;
            }
            .fpms-ds-cell.blank a {
                color: inherit;
                display: block;
            }
            .fpms-ds-cell.na {
                background: repeating-linear-gradient(45deg, #fff, #fff 4px, #f1f3f5 4px, #f1f3f5 8px);
            }
        `,
    ],
})
export class DailyStatusComponent extends FpmsPage implements OnInit {
    s = signal<any>(null);
    dates = signal<string[]>([]);
    endDate = FarmTime.today();
    days = 7;

    get canCreate(): boolean {
        return this.can('Farm.Logs.Create');
    }

    ngOnInit(): void {
        this.load();
    }

    async load(): Promise<void> {
        this.s.set(null);
        const data = await this.run(() => this.api.get<any>('Feeding', 'GetDailyStatus', { endDate: this.endDate || this.today, days: this.days }));
        if (!data) {
            this.s.set({ rows: [] });
            return;
        }
        const out: string[] = [];
        for (let d = data.from; d <= data.to; d = FarmTime.addDays(d, 1)) {
            out.push(d);
        }
        this.dates.set(out);
        this.s.set(data);
    }

    cell(r: any, d: string): any {
        return r.days.find((c: any) => String(c.date).substring(0, 10) === d) ?? null;
    }

    cls(v: number): string {
        return v === 1 ? 'ok' : v === 2 ? 'nf' : 'blank';
    }

    mark(v: number): string {
        return v === 1 ? '✓' : v === 2 ? '–' : '!';
    }

    text(v: number): string {
        return v === 1 ? 'logged' : v === 2 ? 'not fed' : 'blank';
    }

    since(n: number | null): string {
        return n == null ? 'never' : n === 0 ? 'today' : `${n} d`;
    }
}
