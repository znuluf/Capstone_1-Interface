import { Component, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FPMS_IMPORTS } from '../shared-imports';
import { batchShort } from '@shared/fpms/labels';

/** Cycle detail: its fry delivery, batches and totals; Create Batch while PL is left; Close Production Cycle (Refs 5.1, 5.6; AC-10, AC-17). */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        @let c = cycle();
        <fpms-page-header [title]="'Cycle ' + (c?.cycleCode ?? '')" [subtitle]="c ? (c.startDate ? 'Started ' + (c.startDate | farmDate) + '. ' : '') + 'Holds the batches stocked from fry delivery ' + c.hatcheryBatchNumber + '.' : ''" backLink="/app/production/cycles" backLabel="Production cycles">
            @if (c) {
                <fpms-badge [text]="c.status | label: L.CycleStatuses"></fpms-badge>
                @if (c.outcome) { <span class="badge ml-1" [class.badge-success]="c.outcome === 1" [class.badge-danger]="c.outcome === 2">{{ c.outcome | label: L.CycleOutcomes }}</span> }
                @if (c.canCreateBatch) {
                    <a class="btn btn-primary" routerLink="/app/production/create-batch" [queryParams]="{ cycleId: c.id }"><i class="fas fa-shrimp mr-1"></i>Add batch to this cycle</a>
                }
                @if (c.canClose) {
                    <button class="btn btn-outline-secondary" (click)="closing = { confirm: false, outcome: c.suggestedOutcome }">Close production cycle</button>
                }
                @if (c.canReopen) {
                    <button class="btn btn-outline-secondary" (click)="reopening = { reason: '' }">Reopen cycle</button>
                }
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (!c) {
                    <fpms-loading></fpms-loading>
                } @else {
                    @if (reopening) {
                        <div class="fpms-dialog-backdrop"><div class="fpms-dialog fpms-dialog-sm"><div class="fpms-dialog-body p-0"><div class="card card-outline card-warning mb-0 border-0">
                            <div class="card-header"><h3 class="card-title">Reopen cycle {{ c.cycleCode }}</h3></div>
                            <div class="card-body">
                                <p class="small">The cycle becomes Active again and its outcome is cleared. Its batches stay Closed; reopen a batch from its page to correct it. The reason is kept in the cycle's history.</p>
                                <label for="rr">Reason <span class="text-danger">*</span></label>
                                <input id="rr" class="form-control" [(ngModel)]="reopening.reason" maxlength="500" placeholder="e.g. a harvest weight was entered wrong" />
                            </div>
                            <div class="card-footer">
                                <button class="btn btn-warning mr-2" [disabled]="busy() || reopening.reason.trim().length < 3" (click)="reopen()">Reopen cycle</button>
                                <button class="btn btn-default" (click)="reopening = null">Cancel</button>
                            </div>
                        </div></div></div></div>
                    }
                    @if (closing) {
                        <div class="fpms-dialog-backdrop"><div class="fpms-dialog fpms-dialog-sm"><div class="fpms-dialog-body p-0"><div class="card card-outline card-warning mb-0 border-0">
                            <div class="card-header"><h3 class="card-title">Close production cycle {{ c.cycleCode }}</h3></div>
                            <div class="card-body">
                                <p>Every batch is closed. Closing the cycle makes all its records read-only. Sales and payment status can still be updated.</p>
                                <div class="form-group">
                                    <label class="d-block">Outcome <span class="text-danger">*</span></label>
                                    @for (o of Options.cycleOutcome; track o.value) {
                                        <div class="custom-control custom-radio custom-control-inline">
                                            <input type="radio" class="custom-control-input" [id]="'oc' + o.value" name="outcome" [value]="o.value" [(ngModel)]="closing.outcome" />
                                            <label class="custom-control-label" [for]="'oc' + o.value">{{ o.label }}</label>
                                        </div>
                                    }
                                    <small class="form-text text-muted">
                                        Pre-selected as {{ c.suggestedOutcome | label: L.CycleOutcomes }}{{ c.suggestedOutcome === 2 ? ' because every batch failed' : '' }}. Change it if that is not right.
                                    </small>
                                </div>
                                <div class="custom-control custom-checkbox">
                                    <input type="checkbox" class="custom-control-input" id="cc" [(ngModel)]="closing.confirm" />
                                    <label class="custom-control-label" for="cc">I understand every record of this cycle will become read-only.</label>
                                </div>
                            </div>
                            <div class="card-footer">
                                <button class="btn btn-warning mr-2" [disabled]="busy() || !closing.confirm || !closing.outcome" (click)="close()">Close cycle</button>
                                <button class="btn btn-default" (click)="closing = null">Cancel</button>
                            </div>
                        </div></div></div></div>
                    }
                    <!-- Summary band (DEC-99, DEC-112): where the delivery's PL went, what the cycle has used and produced, then what stands. -->
                    <section class="fpms-summary" aria-label="Summary">
                        <dl class="fpms-figures">
                            <div class="fpms-figure"><dt class="l">PL received</dt><dd class="v">{{ c.plReceived | num: 0 }}</dd><dd class="s">{{ c.plAgeDays != null ? 'PL' + c.plAgeDays + ' on ' : 'Delivered ' }}{{ c.deliveryDate | farmDate }}</dd></div>
                            <div class="fpms-figure"><dt class="l">Stocked</dt><dd class="v">{{ c.plStocked | num: 0 }}</dd><dd class="s">{{ c.isStockingFinished ? (c.plNotStocked | num: 0) + ' not stocked' : (c.plLeft | num: 0) + ' left to stock' }}</dd></div>
                            <div class="fpms-figure"><dt class="l">Feed to date</dt><dd class="v">{{ c.totalFeedKg | num: 1 }}<span class="u">kg</span></dd><dd class="s">All batches</dd></div>
                            <div class="fpms-figure"><dt class="l">Harvested</dt><dd class="v">{{ c.totalHarvestKg | num: 1 }}<span class="u">kg</span></dd><dd class="s">All batches</dd></div>
                        </dl>
                        @if (c.status === 4 || (c.status === 2 && c.openBatchCount > 0 && can('Farm.Production.Manage'))) {
                            <ul class="fpms-notices">
                                @if (c.status === 4) {
                                    <li><i class="fas fa-lock" aria-hidden="true"></i><span>Closed {{ c.closedAtUtc | farmDateTime }} by {{ c.closedBy }} as <strong>{{ c.outcome | label: L.CycleOutcomes }}</strong>. Its records are read-only; sales and payments can still be updated.</span></li>
                                } @else {
                                    <li><i class="fas fa-info-circle" aria-hidden="true"></i><span>To close the cycle, close every batch first (each batch must be Harvested or Failed).</span></li>
                                }
                            </ul>
                        }
                    </section>
                    <!-- Batches across the width; six columns that each hold what belongs together, so the table fits 1,000 px (DEC-112). -->
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">Batches <span class="text-muted font-weight-normal">· {{ c.openBatchCount }} of {{ c.batches?.length ?? 0 }} open</span></h3></div>
                        <div class="card-body p-0 table-responsive">
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr><th>Batch</th><th>Stocked</th><th class="text-right">DOC</th><th class="text-right">ABW (g)</th><th class="text-right">FCR</th><th class="text-right" title="Estimated survival">Survival</th></tr>
                                </thead>
                                <tbody>
                                    @for (b of c.batches; track b.id) {
                                        <tr>
                                            <td>
                                                <a class="text-nowrap" [routerLink]="['/app/production/batches', b.id]" [title]="b.batchCode"><span class="fpms-pond-tag">{{ b.pondCode }}</span> {{ batchShort(b.batchCode) }}</a>
                                                <div class="mt-1"><fpms-badge [text]="b.status | label: L.BatchStatuses"></fpms-badge></div>
                                            </td>
                                            <td class="text-nowrap">
                                                {{ b.stockingDate | farmDate }}
                                                <div class="text-muted">{{ b.plCountStocked | num: 0 }} PL</div>
                                            </td>
                                            <td class="text-right">{{ b.doc ?? '—' }}</td>
                                            <td class="text-right">{{ b.currentAbwG | num: 2 }}</td>
                                            <td class="text-right">{{ b.fcrToDate | num: 2 }}</td>
                                            <td class="text-right" [class.text-warning-dark]="b.estimatedSurvivalPct > 100">
                                                <span class="text-nowrap">{{ b.estimatedSurvivalPct | num: 1 }}%@if (b.estimatedSurvivalPct > 100) { <i class="fas fa-exclamation-triangle ml-1" aria-hidden="true"></i> }</span>
                                                @if (b.estimatedSurvivalPct > 100) { <div>Above 100%</div> }
                                            </td>
                                        </tr>
                                    } @empty {
                                        <tr><td colspan="6" class="text-center text-muted py-3">No batches yet.{{ c.canCreateBatch ? ' Use Add batch to this cycle.' : '' }}</td></tr>
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <!-- Reference below: the fry delivery as facts, then the cycle's history (DEC-112). -->
                    <div class="fpms-split">
                        <div class="card">
                            <div class="card-body">
                                <h3 class="fpms-section-h">Fry delivery</h3>
                                <dl class="fpms-facts">
                                    <div><dt>Hatchery</dt><dd>{{ c.hatcheryName }} <span class="fpms-pond-tag ml-1">{{ c.hatcheryShortCode }}</span></dd></div>
                                    <div><dt>Hatchery batch number</dt><dd><a [routerLink]="['/app/resources/fry-deliveries', c.fryDeliveryId]">{{ c.hatcheryBatchNumber }}</a></dd></div>
                                    <div><dt>Delivered</dt><dd>{{ c.deliveryDate | farmDate }}</dd></div>
                                    <div><dt>PL age</dt><dd>{{ c.plAgeDays != null ? 'PL' + c.plAgeDays : '—' }}</dd></div>
                                    <div><dt>PL received</dt><dd>{{ c.plReceived | num: 0 }}</dd></div>
                                    <div><dt>PL stocked</dt><dd>{{ c.plStocked | num: 0 }}</dd></div>
                                    @if (c.isStockingFinished) {
                                        <div><dt>PL not stocked</dt><dd>{{ c.plNotStocked | num: 0 }} <span class="text-muted font-weight-normal">(stocking finished)</span></dd></div>
                                    } @else {
                                        <div><dt>PL left</dt><dd>{{ c.plLeft | num: 0 }}</dd></div>
                                    }
                                    <div><dt>Cycle started</dt><dd>{{ c.startDate ? (c.startDate | farmDate) : 'Not stocked yet' }}</dd></div>
                                </dl>
                            </div>
                        </div>
                        <aside>
                            <div class="card">
                                <div class="card-body">
                                    <h3 class="fpms-section-h">Reopened</h3>
                                    @if (c.reopenings?.length) {
                                        <ul class="list-unstyled mb-0">
                                            @for (r of c.reopenings; track $index) {
                                                <li class="mb-2">{{ r.reopenedAtUtc | farmDateTime }} by {{ r.reopenedBy }}<div class="text-muted">{{ r.reason }}</div></li>
                                            }
                                        </ul>
                                    } @else {
                                        <p class="text-muted mb-0">Never reopened.</p>
                                    }
                                </div>
                            </div>
                        </aside>
                    </div>
                }
            </div>
        </section>
    `,
})
export class CycleDetailComponent extends FpmsPage implements OnInit {
    readonly cycle = signal<any>(null);
    readonly batchShort = batchShort;
    closing: any = null;
    reopening: { reason: string } | null = null;

    ngOnInit(): void {
        // Detail routes reuse this component when only the :id changes, so reload on every change.
        this.route.paramMap.subscribe(() => this.load());
    }

    async load(): Promise<void> {
        this.closing = null;
        this.reopening = null;
        const c = await this.api.get<any>('Cycle', 'Get', { id: this.param('id') });
        this.cycle.set(c);
        this.setPageTitle(c ? `Cycle ${c.cycleCode}` : null);
    }

    async close(): Promise<void> {
        if (await this.act(() => this.api.post('Cycle', 'Close', { id: this.cycle().id, outcome: this.closing.outcome, rowVersion: this.cycle().rowVersion }))) {
            this.notifySaved('Production cycle closed.');
            this.load();
        }
    }

    async reopen(): Promise<void> {
        if (await this.act(() => this.api.post('Cycle', 'Reopen', { id: this.cycle().id, reason: this.reopening!.reason.trim(), rowVersion: this.cycle().rowVersion }))) {
            this.notifySaved('Cycle reopened.');
            this.load();
        }
    }
}
