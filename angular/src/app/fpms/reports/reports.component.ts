import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { printPage } from '@shared/fpms/print-page';
import { PagerState } from '@shared/fpms/pager';
import { FarmTime } from '@shared/fpms/farm-time';
import { FPMS_IMPORTS } from '../shared-imports';
import { batchShort, unbroken } from '@shared/fpms/labels';

type ReportKey = 'cycle' | 'harvest' | 'sales' | 'wq' | 'inventory' | 'failure';

/** Reports (Refs 8.1, 8.2, 7.4; AC-19): filters first, print-friendly results, Asia/Manila day boundaries. */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Reports" subtitle="Computed indicators are derived from source records. Owner only.">
            @if (r) {
                @if (can('Farm.Reports')) {
                    <button class="btn btn-outline-secondary mr-2" (click)="exportReport()" [disabled]="busy()"><i class="fas fa-file-csv mr-1"></i>Export CSV</button>
                }
                <button class="btn btn-primary" (click)="print()"><i class="fas fa-print mr-1"></i>Print</button>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <!-- Trace, report choice and filters on the page ground (DEC-115). -->
                <form class="no-print fpms-list-filters" (ngSubmit)="traceLot()" aria-label="Trace a lot code">
                    <div class="form-row align-items-end">
                        <div class="form-group col-md-4 mb-2">
                            <label for="lot">Trace a lot code</label>
                            <input id="lot" name="lot" class="form-control text-monospace" [(ngModel)]="lotCode" placeholder="e.g. 26-0-24-03-07-02" autocomplete="off" />
                        </div>
                        <div class="form-group col-auto mb-2">
                            <button type="submit" class="btn btn-outline-primary" [disabled]="!lotCode.trim()">Trace</button>
                        </div>
                        <div class="col-md text-muted mb-2">For a recall or buyer question: the code on the crate, dispatch receipt or tally sheet. Shows that one harvest from fry source to buyer.</div>
                    </div>
                </form>
                <div class="no-print fpms-list-filters">
                    <div>
                        <div class="mb-3" role="group" aria-label="Report">
                            @for (o of reports; track o.key) {
                                <button type="button" class="rp-chip" [attr.aria-pressed]="key === o.key" (click)="key = o.key; r = null">{{ o.label }}</button>
                            }
                        </div>
                        <div class="form-row align-items-end">
                            @if (key === 'cycle' || key === 'harvest' || key === 'failure') {
                                <div class="form-group col-md-4">
                                    <label for="cy">Cycle</label>
                                    <select id="cy" class="form-control" [(ngModel)]="f.cycleId" (ngModelChange)="f.batchId = null">
                                        @if (key !== 'cycle') { <option [ngValue]="null">{{ key === 'failure' ? '—' : 'All cycles' }}</option> }
                                        @for (c of cyclesFor(); track c.id) {
                                            <option [ngValue]="c.id">{{ c.cycleCode }} ({{ c.status | label: L.CycleStatuses }})</option>
                                        }
                                    </select>
                                </div>
                            }
                            @if (key === 'harvest' || key === 'failure' || key === 'wq') {
                                <div class="form-group col-md-4">
                                    <label for="bt">Batch</label>
                                    <select id="bt" class="form-control" [(ngModel)]="f.batchId">
                                        <option [ngValue]="null">{{ key === 'failure' ? '—' : 'All batches' }}</option>
                                        @for (b of batchesFor(); track b.id) {
                                            <option [ngValue]="b.id">{{ b.pondCode }} · {{ b.batchCode }}</option>
                                        }
                                    </select>
                                </div>
                            }
                            @if (key === 'sales') {
                                <div class="form-group col-md-4">
                                    <label for="by">Buyer</label>
                                    <select id="by" class="form-control" [(ngModel)]="f.buyerId">
                                        <option [ngValue]="null">All buyers</option>
                                        @for (b of buyers; track b.id) {
                                            <option [ngValue]="b.id">{{ b.name }}</option>
                                        }
                                    </select>
                                </div>
                            }
                            @if (key === 'inventory') {
                                <div class="form-group col-md-4">
                                    <label for="it">Item</label>
                                    <select id="it" class="form-control" [(ngModel)]="f.itemId">
                                        <option [ngValue]="null">All items</option>
                                        @for (i of items; track i.id) {
                                            <option [ngValue]="i.id">{{ i.displayName }}</option>
                                        }
                                    </select>
                                </div>
                            }
                            @if (key !== 'cycle' && key !== 'failure') {
                                <div class="form-group col-6 col-md-3">
                                    <label for="from">From</label>
                                    <input id="from" type="date" class="form-control" [(ngModel)]="f.from" />
                                </div>
                                <div class="form-group col-6 col-md-3">
                                    <label for="to">To</label>
                                    <input id="to" type="date" class="form-control" [(ngModel)]="f.to" [min]="f.from" />
                                </div>
                            }
                            <div class="form-group col-auto">
                                <button class="btn btn-primary" (click)="runReport()" [disabled]="busy() || !canRun()">Run</button>
                            </div>
                        </div>
                        @if (key !== 'cycle' && key !== 'failure') {
                            <p class="small text-muted mb-2">
                                @if (rangeTooLong()) { <span class="text-danger"><i class="fas fa-exclamation-circle mr-1"></i>Choose a range of 24 months or less.</span> }
                                @else { Date range is limited to 24 months{{ key === 'harvest' || key === 'wq' ? ' unless you choose one batch' : '' }}. }
                            </p>
                        }
                        @if (key === 'failure' && !f.cycleId && !f.batchId) {
                            <p class="small text-muted">Choose a failed cycle or a failed batch.</p>
                        }
                    </div>
                </div>

                @if (busy()) {
                    <fpms-loading></fpms-loading>
                }
                @if (r && !busy()) {
                    <div class="fpms-report">
                        @if (r.header) {
                            <div class="fpms-doc-head fpms-report-head">
                                <div>
                                    <div class="fpms-doc-farm">{{ r.header.farmName }}</div>
                                    <div class="small">{{ r.header.farmAddress }}</div>
                                    <div class="small">Farm code {{ r.header.farmCode }}</div>
                                </div>
                                <div class="text-right">
                                    <div class="fpms-doc-title">{{ title() }}</div>
                                    <div class="small"><strong>{{ r.header.scope }}</strong></div>
                                    <div class="small">Generated {{ r.header.generatedAtUtc | farmDateTime }} by {{ r.header.generatedBy }}</div>
                                    <div class="small">Time zone {{ r.header.timeZone }}</div>
                                </div>
                            </div>
                        } @else {
                            <div class="fpms-doc-head fpms-report-head">
                                <div>
                                    <div class="fpms-doc-farm">{{ session.tenant?.name }}</div>
                                </div>
                                <div class="text-right">
                                    <div class="fpms-doc-title">{{ title() }}</div>
                                    <div class="small"><strong>{{ f.from }} → {{ f.to }}</strong></div>
                                    <div class="small">Generated {{ generatedAt | farmDateTime }}</div>
                                </div>
                            </div>
                        }

                        @switch (shown) {
                            @case ('cycle') {
                                <div class="card">
                                    <div class="card-body">
                                        <div class="d-flex flex-wrap justify-content-between">
                                            <div>
                                                <strong>Cycle {{ r.cycleCode }}</strong> · <fpms-badge [text]="r.status | label: L.CycleStatuses"></fpms-badge>
                                                <span class="badge ml-1" [class.badge-success]="r.isFinal" [class.badge-warning]="!r.isFinal">{{ r.isFinal ? 'Final' : 'Provisional (cycle not closed)' }}</span>
                                                <div class="small">Planned {{ r.plannedStartDate | farmDate }} → {{ r.plannedEndDate | farmDate }} · Hatchery <span [title]="r.hatcheryName">{{ r.hatcheryShortCode || r.hatcheryName }}</span> · lot {{ r.hatcheryLotNumber || '—' }}</div>
                                                @if (r.objectives) { <div class="small">Objectives: {{ r.objectives }}</div> }

                                                @if (r.failureReason) { <div class="small text-danger">Failure: {{ r.failureReason }}</div> }
                                            </div>
                                        </div>
                                        <section class="fpms-summary" aria-label="Summary"><dl class="fpms-figures fpms-figures-sm">
                                    <div class="fpms-figure"><dt class="l">PL stocked</dt><dd class="v">{{ r.totalPlStocked | num: 0 }}</dd></div>
                                    <div class="fpms-figure"><dt class="l">Feed (kg)</dt><dd class="v">{{ r.totalFeedKg | num: 1 }}</dd></div>
                                    <div class="fpms-figure"><dt class="l">Harvest (kg)</dt><dd class="v">{{ r.totalHarvestKg | num: 1 }}</dd></div>
                                    <div class="fpms-figure"><dt class="l">Cycle FCR</dt><dd class="v">{{ r.cycleFcr | num: 2 }}</dd></div>
                                    <div class="fpms-figure"><dt class="l">Survival</dt><dd class="v">{{ r.cycleSurvivalPct | num: 1 }}%</dd></div>
                                    <div class="fpms-figure"><dt class="l">Of target</dt><dd class="v">{{ r.targetAchievementPct | num: 0 }}%</dd><dd class="s">{{ r.targetProductionKg | num: 0 }} kg</dd></div>
                                    <div class="fpms-figure"><dt class="l">Margin</dt><dd class="v" [class.text-danger]="r.finance?.margin < 0">{{ r.finance?.margin | php }}</dd><dd class="s">Over feed, chemicals and PL</dd></div>
                                </dl></section>
                                        <h4 class="fpms-section-h">Financial performance</h4>
                                        <ng-container *ngTemplateOutlet="financeTable; context: { $implicit: r.finance }"></ng-container>
                                    </div>
                                </div>
                                @for (b of r.batches; track b.batchId) {
                                    <div class="card fpms-break">
                                        <div class="card-header">
                                            <h3 class="card-title">Batch {{ b.batchCode }} · pond {{ b.pondCode }} ({{ b.pondAreaM2 | num: 0 }} m²) · <fpms-badge [text]="b.status | label: L.BatchStatuses"></fpms-badge></h3>
                                        </div>
                                        <div class="card-body">
                                            <h4 class="fpms-section-h">Stocking</h4>
                                            <p>
                                                {{ b.stockingDate ? (b.stockingDate | farmDate) : 'Not stocked' }} · {{ b.plCountStocked | num: 0 }} PL · PL age {{ b.plAgeDays ?? '—' }} · lot {{ b.hatcheryLotNumber || '—' }} ·
                                                density {{ b.indicators?.stockingDensityPerM2 | num: 2 }} PL/m² · {{ b.hatcheryCertificationStatusAtStocking }}
                                                @if (b.failureReason) { <br /><span class="text-danger">Failure: {{ b.failureReason }}</span> }
                                            </p>
                                            <h4 class="fpms-section-h">Indicators <span class="fpms-section-aside">({{ b.isFinal ? 'final, stored at closure' : 'live' }})</span></h4>
                                            <dl class="fpms-facts mb-3">
                                                <div><dt>Days of culture</dt><dd>{{ b.indicators?.cultureDays ?? b.indicators?.doc ?? '—' }}</dd></div>
                                                <div><dt>ABW (g)</dt><dd>{{ (b.indicators?.finalAbwG ?? b.indicators?.currentAbwG) | num: 2 }}</dd></div>
                                                <div><dt>Feed (kg)</dt><dd>{{ b.indicators?.cumulativeFeedKg | num: 1 }}</dd></div>
                                                <div><dt>Harvest (kg)</dt><dd>{{ b.indicators?.totalHarvestKg | num: 1 }}</dd></div>
                                                <div><dt>{{ b.isFinal ? 'Final FCR' : 'FCR to date' }}</dt><dd>{{ (b.isFinal ? b.indicators?.finalFcr : b.indicators?.fcrToDate) | num: 2 }}</dd></div>
                                                <div><dt>{{ b.isFinal ? 'Survival' : 'Est. survival' }}</dt><dd>{{ (b.isFinal ? b.indicators?.survivalRatePct : b.indicators?.estimatedSurvivalPct) | num: 1 }}%</dd></div>
                                                <div><dt>Mortality</dt><dd>{{ b.indicators?.cumulativeMortality | num: 0 }}</dd></div>
                                                <div><dt>Pieces harvested</dt><dd>{{ b.indicators?.harvestedPieces | num: 0 }}</dd></div>
                                            </dl>
                                            <h4 class="fpms-section-h">Harvests</h4>
                                            <ng-container *ngTemplateOutlet="harvestTable; context: { $implicit: b.harvests }"></ng-container>
                                            <h4 class="fpms-section-h">Financial performance</h4>
                                            <ng-container *ngTemplateOutlet="financeTable; context: { $implicit: b.finance }"></ng-container>
                                            <div class="row">
                                                <div class="col-xl-6">
                                                    <h4 class="fpms-section-h">Feed consumption</h4>
                                                    <div class="table-responsive">
                                                    <table class="table table-sm">
                                                        <thead><tr><th>Feed</th><th>BAI no.</th><th class="text-right">Kg</th><th class="text-right">Cost</th></tr></thead>
                                                        <tbody>
                                                            @for (x of b.feed; track $index) {
                                                                <tr><td>{{ x.itemName }}</td><td>{{ x.baiRegistrationNo }}</td><td class="text-right">{{ x.quantityKg | num: 1 }}</td><td class="text-right">{{ x.cost | php }}</td></tr>
                                                            } @empty {
                                                                <tr><td colspan="4" class="text-muted">No feeding logs.</td></tr>
                                                            }
                                                        </tbody>
                                                    </table>
                                                    </div>
                                                    <h4 class="fpms-section-h">Growth</h4>
                                                    <div class="table-responsive">
                                                    <table class="table table-sm">
                                                        <thead><tr><th>Date</th><th>DOC</th><th class="text-right">Sample</th><th class="text-right">ABW (g)</th><th class="text-right">g/day</th></tr></thead>
                                                        <tbody>
                                                            @for (g of b.growth; track $index) {
                                                                <tr><td>{{ g.date | farmDate }}</td><td>{{ g.doc }}</td><td class="text-right">{{ g.sampleCount }}</td><td class="text-right">{{ g.abwG | num: 2 }}</td><td class="text-right">{{ g.growthRateGPerDay | num: 2 }}</td></tr>
                                                            } @empty {
                                                                <tr><td colspan="5" class="text-muted">No growth samples.</td></tr>
                                                            }
                                                        </tbody>
                                                    </table>
                                                    </div>
                                                </div>
                                                <div class="col-xl-6">
                                                    <h4 class="fpms-section-h">Water quality (weekly)</h4>
                                                    <div class="table-responsive">
                                                    <table class="table table-sm">
                                                        <thead><tr><th>Week of</th><th>Parameter</th><th class="text-right">Avg</th><th class="text-right">Min–max</th><th class="text-right">Out of range</th></tr></thead>
                                                        <tbody>
                                                            @for (w of b.waterQuality; track $index) {
                                                                <tr>
                                                                    <td>{{ w.weekStart | farmDate }}</td><td>{{ w.parameterName }}</td>
                                                                    <td class="text-right">{{ w.average | num: 2 }} {{ w.unitCode }}</td>
                                                                    <td class="text-right">{{ w.min | num: 2 }}–{{ w.max | num: 2 }}</td>
                                                                    <td class="text-right" [class.text-danger]="w.outOfRangeCount > 0">{{ w.outOfRangeCount }} / {{ w.readings }}</td>
                                                                </tr>
                                                            } @empty {
                                                                <tr><td colspan="5" class="text-muted">No water-quality readings.</td></tr>
                                                            }
                                                        </tbody>
                                                    </table>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                }
                            }
                            @case ('harvest') {
                                <section class="fpms-summary" aria-label="Summary"><dl class="fpms-figures fpms-figures-sm">
                                    <div class="fpms-figure"><dt class="l">Harvested kg</dt><dd class="v">{{ r.totalKg | num: 1 }}</dd></div>
                                    <div class="fpms-figure"><dt class="l">Pieces</dt><dd class="v">{{ r.totalPieces | num: 0 }}</dd></div>
                                    <div class="fpms-figure"><dt class="l">Weighted ABW</dt><dd class="v">{{ r.weightedAbwG | num: 2 }} g</dd></div>
                                    <div class="fpms-figure"><dt class="l">Sales</dt><dd class="v">{{ r.salesAmount | php }}</dd><dd class="s">{{ r.soldKg | num: 1 }} kg sold</dd></div>
                                </dl></section>
                                <div class="card"><div class="card-header"><h3 class="card-title">By batch</h3></div>
                                    <div class="card-body p-0">
                                        <div class="table-responsive">
                                        <table class="table table-sm mb-0">
                                            <thead><tr>
                                                <th fpmsSort="pondCode" [pager]="ps('hb')" title="Pond, batch and cycle">Batch</th>
                                                <th class="text-right" fpmsSort="totalKg" [pager]="ps('hb')">Kg</th><th class="text-right" fpmsSort="pieces" [pager]="ps('hb')">Pieces</th>
                                                <th class="text-right" fpmsSort="weightedAbwG" [pager]="ps('hb')">Weighted ABW</th><th class="text-right" fpmsSort="survivalRatePct" [pager]="ps('hb')">Survival</th>
                                            </tr></thead>
                                            <tbody>
                                                @for (b of view('hb', r.batches); track b.batchId) {
                                                    <tr><td><span class="fpms-pond-tag" [title]="b.batchCode">{{ b.pondCode }}</span> {{ batchShort(b.batchCode) }}<div class="text-muted">Cycle {{ unbroken(b.cycleCode) }}</div></td><td class="text-right">{{ b.totalKg | num: 1 }}</td><td class="text-right">{{ b.pieces | num: 0 }}</td><td class="text-right">{{ b.weightedAbwG | num: 2 }}</td><td class="text-right">{{ b.survivalRatePct | num: 1 }}%</td></tr>
                                                }
                                            </tbody>
                                            @if (r.batches?.length > 1) {
                                                <tfoot><tr><td>Total</td><td class="text-right">{{ sum(r.batches, 'totalKg') | num: 1 }}</td><td class="text-right">{{ sum(r.batches, 'pieces') | num: 0 }}</td><td></td><td></td></tr></tfoot>
                                            }
                                        </table>
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-xl-6">
                                        <div class="card"><div class="card-header"><h3 class="card-title">Size distribution</h3></div>
                                            <div class="card-body p-0">
                                                <div class="table-responsive">
                                                <table class="table table-sm mb-0">
                                                    <thead><tr><th>Size grade</th><th class="text-right">Kg</th><th class="text-right">Share</th></tr></thead>
                                                    <tbody>
                                                        @for (s of r.sizeDistribution; track $index) {
                                                            <tr><td>{{ s.sizeLabel }}</td><td class="text-right">{{ s.kg | num: 1 }}</td><td class="text-right">{{ s.pct | num: 1 }}%</td></tr>
                                                        } @empty {
                                                            <tr><td colspan="3" class="text-muted">No grading lines.</td></tr>
                                                        }
                                                    </tbody>
                                                    @if (r.sizeDistribution?.length > 1) {
                                                        <tfoot><tr><td>Total</td><td class="text-right">{{ sum(r.sizeDistribution, 'kg') | num: 1 }}</td><td></td></tr></tfoot>
                                                    }
                                                </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-xl-6">
                                        <div class="card"><div class="card-header"><h3 class="card-title">Buyer allocation</h3></div>
                                            <div class="card-body p-0">
                                                <div class="table-responsive">
                                                <table class="table table-sm mb-0">
                                                    <thead><tr><th>Buyer</th><th class="text-right">Kg</th><th class="text-right">Amount</th><th class="text-right">Share</th></tr></thead>
                                                    <tbody>
                                                        @for (a of r.buyerAllocation; track $index) {
                                                            <tr><td>{{ a.buyerName }}</td><td class="text-right">{{ a.kg | num: 1 }}</td><td class="text-right">{{ a.amount | php }}</td><td class="text-right">{{ a.pct | num: 1 }}%</td></tr>
                                                        } @empty {
                                                            <tr><td colspan="4" class="text-muted">No sales of these harvests.</td></tr>
                                                        }
                                                    </tbody>
                                                    @if (r.buyerAllocation?.length > 1) {
                                                        <tfoot><tr><td>Total</td><td class="text-right">{{ sum(r.buyerAllocation, 'kg') | num: 1 }}</td><td class="text-right">{{ sum(r.buyerAllocation, 'amount') | php }}</td><td></td></tr></tfoot>
                                                    }
                                                </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="card"><div class="card-header"><h3 class="card-title">Harvests</h3></div>
                                    <div class="card-body"><ng-container *ngTemplateOutlet="harvestTable; context: { $implicit: r.harvests }"></ng-container></div>
                                </div>
                            }
                            @case ('failure') {
                                <div class="card">
                                    <div class="card-body">
                                        @if (r.cycleCode) {
                                            <p class="mb-1"><strong>Cycle {{ r.cycleCode }}</strong> · Hatchery <span [title]="r.hatcheryName">{{ r.hatcheryShortCode || r.hatcheryName }}</span> ({{ r.hatcheryAccreditation }})</p>
                                        }
                                        @if (r.cycleFailureReason) {
                                            <p class="mb-1">Cycle failure on {{ r.cycleFailureDate | farmDate }}: {{ r.cycleFailureReason }} · estimated loss {{ r.cycleEstimatedLossPhp | php }}</p>
                                        }

                                    </div>
                                </div>
                                @for (b of r.batches; track $index) {
                                    <div class="card fpms-break">
                                        <div class="card-header"><h3 class="card-title">Batch {{ b.batchCode }} · pond {{ b.pondCode }} ({{ b.pondAreaM2 | num: 0 }} m²)</h3></div>
                                        <div class="card-body">
                                            <dl class="row mb-2 fpms-dl">
                                                <dt class="col-md-3">Stocked</dt><dd class="col-md-3">{{ b.stockingDate | farmDate }} · {{ b.plCountStocked | num: 0 }} PL · lot {{ b.hatcheryLotNumber || '—' }}</dd>
                                                <dt class="col-md-3">Hatchery certification</dt><dd class="col-md-3">{{ b.hatcheryCertificationStatusAtStocking }}</dd>
                                                <dt class="col-md-3">Failure date</dt><dd class="col-md-3">{{ b.failureDate | farmDate }} (DOC {{ b.docAtFailure ?? '—' }})</dd>
                                                <dt class="col-md-3">Estimated loss</dt><dd class="col-md-3">{{ b.estimatedLossPhp | php }}</dd>
                                                <dt class="col-md-3">Reason</dt><dd class="col-md-9">{{ b.failureReason }}</dd>
                                                <dt class="col-md-3">Est. population / biomass</dt><dd class="col-md-3">{{ b.indicators?.estimatedPopulation | num: 0 }} / {{ b.indicators?.estimatedBiomassKg | num: 1 }} kg</dd>
                                                <dt class="col-md-3">Inventory used (cost)</dt><dd class="col-md-3">{{ b.inventoryUsageCost | php }}</dd>
                                            </dl>
                                            <div class="row">
                                                <div class="col-xl-4"><h4 class="fpms-section-h">Mortality events</h4><ul class="pl-3">@for (x of b.mortalityEvents; track $index) { <li>{{ x }}</li> } @empty { <li class="text-muted">None recorded</li> }</ul></div>
                                                <div class="col-xl-4"><h4 class="fpms-section-h">Treatments</h4><ul class="pl-3">@for (x of b.treatments; track $index) { <li>{{ x }}</li> } @empty { <li class="text-muted">None recorded</li> }</ul></div>
                                                <div class="col-xl-4"><h4 class="fpms-section-h">Recent water quality</h4><ul class="pl-3">@for (x of b.recentWaterQuality; track $index) { <li>{{ x }}</li> } @empty { <li class="text-muted">None recorded</li> }</ul></div>
                                            </div>
                                        </div>
                                    </div>
                                } @empty {
                                    <fpms-empty text="No failed batches for this selection."></fpms-empty>
                                }
                                <p class="small text-center"><strong>{{ r.notice }}</strong></p>
                                <div class="row mt-4 small">
                                    <div class="col-6"><div class="fpms-sign">Prepared by</div></div>
                                    <div class="col-6"><div class="fpms-sign">Farm Owner</div></div>
                                </div>
                            }
                            @case ('sales') {
                                <section class="fpms-summary" aria-label="Summary"><dl class="fpms-figures fpms-figures-sm">
                                    <div class="fpms-figure"><dt class="l">Sales</dt><dd class="v">{{ r.totalAmount | php }}</dd><dd class="s">{{ r.saleCount === 1 ? '1 sale' : r.saleCount + ' sales' }}</dd></div>
                                    <div class="fpms-figure"><dt class="l">Kg sold</dt><dd class="v">{{ r.totalKg | num: 1 }}</dd>@if (r.averagePricePerKg != null) { <dd class="s">Average {{ r.averagePricePerKg | php }}/kg</dd> }</div>
                                    <div class="fpms-figure"><dt class="l">Paid</dt><dd class="v">{{ r.totalPaid | php }}</dd></div>
                                    <div class="fpms-figure" [class.warn]="r.overdueCount > 0"><dt class="l">Balance</dt><dd class="v">{{ r.totalBalance | php }}</dd>@if (r.overdueCount) { <dd class="s"><i class="fas fa-exclamation-circle mr-1" aria-hidden="true"></i>{{ r.overdueCount }} overdue, {{ r.overdueBalance | php }}</dd> }</div>
                                </dl></section>
                                <div class="card"><div class="card-header"><h3 class="card-title">By buyer</h3></div>
                                    <div class="card-body p-0 table-responsive">
                                        <table class="table table-sm mb-0">
                                            <thead><tr>
                                                <th fpmsSort="buyerName" [pager]="ps('sb')" title="Buyer and number of sales">Buyer</th><th class="text-right" fpmsSort="kg" [pager]="ps('sb')" title="Kg sold and the average price">Kg</th>
                                                <th class="text-right" fpmsSort="amount" [pager]="ps('sb')">Amount</th><th class="text-right" fpmsSort="paid" [pager]="ps('sb')">Paid</th><th class="text-right" fpmsSort="balance" [pager]="ps('sb')" title="Balance and overdue sales">Balance</th>
                                            </tr></thead>
                                            <tbody>
                                                @for (b of view('sb', r.buyers); track b.buyerId) {
                                                    <tr>
                                                        <td>{{ b.buyerName }}<div class="text-muted">{{ b.saleCount === 1 ? '1 sale' : b.saleCount + ' sales' }}</div></td>
                                                        <td class="text-right">{{ b.kg | num: 2 }}<div class="text-muted text-nowrap">{{ b.averagePricePerKg != null ? (b.averagePricePerKg | php) + '/kg' : '—' }}</div></td>
                                                        <td class="text-right">{{ b.amount | php }}</td><td class="text-right">{{ b.paid | php }}</td>
                                                        <td class="text-right">{{ b.balance | php }}@if (b.overdueCount) { <div class="text-danger text-nowrap"><i class="fas fa-exclamation-circle mr-1" aria-hidden="true"></i>{{ b.overdueCount }} overdue</div> }</td>
                                                    </tr>
                                                } @empty {
                                                    <tr><td colspan="5" class="text-muted text-center py-3">No sales in this period.</td></tr>
                                                }
                                            </tbody>
                                            @if (r.buyers?.length > 1) {
                                                <tfoot><tr>
                                                    <td>Total<div class="text-muted">{{ sum(r.buyers, 'saleCount') | num: 0 }} sales</div></td>
                                                    <td class="text-right">{{ sum(r.buyers, 'kg') | num: 2 }}<div class="text-muted text-nowrap">{{ sum(r.buyers, 'kg') > 0 ? (sum(r.buyers, 'amount') / sum(r.buyers, 'kg') | php) + '/kg' : '—' }}</div></td>
                                                    <td class="text-right">{{ sum(r.buyers, 'amount') | php }}</td><td class="text-right">{{ sum(r.buyers, 'paid') | php }}</td>
                                                    <td class="text-right">{{ sum(r.buyers, 'balance') | php }}@if (sum(r.buyers, 'overdueCount')) { <div class="text-danger">{{ sum(r.buyers, 'overdueCount') }} overdue</div> }</td>
                                                </tr></tfoot>
                                            }
                                        </table>
                                    </div>
                                </div>
                                <div class="card"><div class="card-header"><h3 class="card-title">Sales</h3></div>
                                    <div class="card-body p-0 table-responsive">
                                        <table class="table table-sm mb-0">
                                            <thead><tr>
                                                <th fpmsSort="saleDate" [pager]="ps('ss', 'saleDate desc')" title="Date, receipt and buyer">Sale</th>
                                                <th class="text-right" fpmsSort="kg" [pager]="ps('ss', 'saleDate desc')">Kg</th><th class="text-right" fpmsSort="amount" [pager]="ps('ss', 'saleDate desc')">Amount</th>
                                                <th class="text-right" fpmsSort="balance" [pager]="ps('ss', 'saleDate desc')" title="Balance, and what was paid">Balance</th>
                                                <th fpmsSort="dueDate" [pager]="ps('ss', 'saleDate desc')" title="Payment status and due date">Payment</th>
                                            </tr></thead>
                                            <tbody>
                                                @for (x of view('ss', r.sales, 'saleDate desc'); track x.saleId) {
                                                    <tr>
                                                        <td><a class="text-nowrap" [routerLink]="['/app/sales', x.saleId]">{{ x.saleDate | farmDate }}</a> <span class="text-muted text-nowrap">· {{ unbroken(x.dispatchReceiptNo) }}</span><div>{{ x.buyerName }}</div></td>
                                                        <td class="text-right">{{ x.kg | num: 2 }}</td><td class="text-right">{{ x.amount | php }}</td>
                                                        <td class="text-right">{{ x.balance | php }}<div class="text-muted text-nowrap">{{ x.paid | php }} paid</div></td>
                                                        <td><div class="fpms-badge-stack"><fpms-badge [text]="x.paymentStatus | label: L.PaymentStatuses"></fpms-badge>@if (x.isOverdue) { <fpms-badge text="Overdue" tone="danger"></fpms-badge> }</div><div class="text-muted">{{ x.dueDate ? 'Due ' + (x.dueDate | farmDate) : 'No due date' }}</div></td>
                                                    </tr>
                                                } @empty {
                                                    <tr><td colspan="5" class="text-muted text-center py-3">No sales in this period.</td></tr>
                                                }
                                            </tbody>
                                            @if (r.sales?.length > 1) {
                                                <tfoot><tr>
                                                    <td>Total of {{ r.sales.length }} sales</td><td class="text-right">{{ sum(r.sales, 'kg') | num: 2 }}</td><td class="text-right">{{ sum(r.sales, 'amount') | php }}</td>
                                                    <td class="text-right">{{ sum(r.sales, 'balance') | php }}<div class="text-muted text-nowrap">{{ sum(r.sales, 'paid') | php }} paid</div></td><td></td>
                                                </tr></tfoot>
                                            }
                                        </table>
                                    </div>
                                    <fpms-pager [state]="ps('ss')"></fpms-pager>
                                </div>
                            }
                            @case ('wq') {
                                <section class="fpms-summary" aria-label="Summary"><dl class="fpms-figures fpms-figures-sm">
                                    <div class="fpms-figure" [class.warn]="r.exceptionCount > 0"><dt class="l">Out of range</dt><dd class="v">{{ r.exceptionCount }}</dd><dd class="s">of {{ r.readingsChecked }} readings</dd></div>
                                    <div class="fpms-figure"><dt class="l">Share out of range</dt><dd class="v">{{ r.exceptionRatePct != null ? (r.exceptionRatePct | num: 1) + '%' : '—' }}</dd></div>
                                    <div class="fpms-figure"><dt class="l">Ponds affected</dt><dd class="v">{{ r.pondsAffected }}</dd><dd class="s">{{ r.batchesAffected }} {{ r.batchesAffected === 1 ? 'batch' : 'batches' }}</dd></div>
                                    <div class="fpms-figure"><dt class="l">Most frequent parameter</dt><dd class="v">{{ r.mostFrequentParameter || '—' }}</dd></div>
                                </dl></section>
                                <div class="card">
                                    <div class="card-body p-0 table-responsive">
                                        <table class="table table-sm mb-0">
                                            <thead><tr>
                                                <th fpmsSort="observedAtUtc" [pager]="ps('wq', 'observedAtUtc desc')" title="When, and who recorded it">Observed</th><th fpmsSort="pondCode" [pager]="ps('wq', 'observedAtUtc desc')">Pond</th>
                                                <th fpmsSort="parameterName" [pager]="ps('wq', 'observedAtUtc desc')">Parameter</th><th class="text-right" fpmsSort="value" [pager]="ps('wq', 'observedAtUtc desc')">Reading</th><th>Optimal range</th>
                                            </tr></thead>
                                            <tbody>
                                                @for (x of view('wq', r.items, 'observedAtUtc desc'); track $index) {
                                                    <tr>
                                                        <td class="text-nowrap">{{ x.observedAtUtc | farmDateTime }}<div class="text-muted">{{ x.recordedBy }}</div></td>
                                                        <td><span class="fpms-pond-tag" [title]="x.batchCode">{{ x.pondCode }}</span> {{ batchShort(x.batchCode) }}</td>
                                                        <td>{{ x.parameterName }}</td>
                                                        <td class="text-right text-danger font-weight-bold text-nowrap"><i class="fas fa-exclamation-circle mr-1" aria-hidden="true"></i>{{ x.value }} {{ x.unitCode }}</td>
                                                        <td>{{ x.optimalRange }}</td>
                                                    </tr>
                                                } @empty {
                                                    <tr><td colspan="5" class="text-muted text-center py-3">No out-of-range readings in this range.</td></tr>
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                    <fpms-pager [state]="ps('wq')"></fpms-pager>
                                </div>
                            }
                            @case ('inventory') {
                                <section class="fpms-summary" aria-label="Summary"><dl class="fpms-figures fpms-figures-sm">
                                    <div class="fpms-figure"><dt class="l">Feed used</dt><dd class="v">{{ r.feedUsedKg | num: 1 }} kg</dd></div>
                                    <div class="fpms-figure"><dt class="l">Cost of all used</dt><dd class="v">{{ r.totalUsageCost | php }}</dd></div>
                                    <div class="fpms-figure"><dt class="l">Items with activity</dt><dd class="v">{{ r.items.length }}</dd></div>
                                </dl></section>
                                <div class="card"><div class="card-header"><h3 class="card-title">Summary by item</h3></div>
                                    <div class="card-body p-0 table-responsive">
                                        <table class="table table-sm mb-0">
                                            <thead><tr>
                                                <th fpmsSort="itemName" [pager]="ps('ii')">Item</th><th class="text-right" fpmsSort="opening" [pager]="ps('ii')">Opening</th><th class="text-right" fpmsSort="receipts" [pager]="ps('ii')">In</th>
                                                <th class="text-right" fpmsSort="usage" [pager]="ps('ii')">Used</th><th class="text-right" fpmsSort="adjustments" [pager]="ps('ii')">Adjusted</th><th class="text-right" fpmsSort="closing" [pager]="ps('ii')">Closing</th><th class="text-right" fpmsSort="usageCost" [pager]="ps('ii')">Cost</th>
                                            </tr></thead>
                                            <tbody>
                                                @for (i of view('ii', r.items); track $index) {
                                                    <tr>
                                                        <td>{{ i.itemName }}<div class="text-muted">in {{ i.unit }}</div></td>
                                                        <td class="text-right">{{ i.opening | num: 3 : true }}</td><td class="text-right">{{ i.receipts | num: 3 : true }}</td>
                                                        <td class="text-right">{{ i.usage | num: 3 : true }}</td><td class="text-right">{{ i.adjustments | num: 3 : true }}</td>
                                                        <td class="text-right font-weight-bold" [class.text-danger]="i.closing < 0">{{ i.closing | num: 3 : true }}</td>
                                                        <td class="text-right">{{ i.usageCost | php }}</td>
                                                    </tr>
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div class="card"><div class="card-header"><h3 class="card-title">Movements</h3></div>
                                    <div class="card-body p-0 table-responsive">
                                        <table class="table table-sm mb-0">
                                            <thead><tr>
                                                <th fpmsSort="movementDateUtc" [pager]="ps('im', 'movementDateUtc desc')">Date</th><th fpmsSort="itemName" [pager]="ps('im', 'movementDateUtc desc')" title="Item and lot">Item</th><th>Type</th>
                                                <th class="text-right" fpmsSort="quantity" [pager]="ps('im', 'movementDateUtc desc')" title="Quantity and unit cost">Qty</th><th>Batch</th><th>Reason</th>
                                            </tr></thead>
                                            <tbody>
                                                @for (m of view('im', r.movements, 'movementDateUtc desc'); track $index) {
                                                    <tr>
                                                        <td>{{ m.movementDateUtc | farmDateTime }}</td><td>{{ m.itemName }}<div class="text-muted">Lot {{ m.lotNumber }}</div></td>
                                                        <td>{{ m.type | label: L.MovementTypes }}</td><td class="text-right text-nowrap">{{ m.quantity | num: 3 }} {{ m.unit }}<div class="text-muted">{{ m.unitCost | php }} each</div></td>
                                                        <td>@if (m.batchCode) { <span [title]="m.batchCode">{{ batchShort(m.batchCode) }}</span> } @else { — }</td><td>{{ m.reason }}</td>
                                                    </tr>
                                                } @empty {
                                                    <tr><td colspan="6" class="text-muted text-center py-3">No movements in this range.</td></tr>
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                    <fpms-pager [state]="ps('im')"></fpms-pager>
                                </div>
                            }
                        }
                    </div>
                }

                <ng-template #financeTable let-x>
                    <div class="table-responsive">
                    <table class="table table-sm table-bordered w-auto">
                        <tbody>
                            <tr><th>Revenue (sales, buyer's kg when re-weighed)</th><td class="text-right">{{ x?.revenue | php }}</td></tr>
                            <tr><th>Feed and chemicals used (lot cost)</th><td class="text-right">{{ x?.inventoryUsageCost | php }}</td></tr>
                            <tr><th>PL (share of the delivery cost)</th><td class="text-right">{{ x?.plCost | php }}</td></tr>
                            <tr><th>Production cost</th><td class="text-right">{{ x?.productionCost | php }}</td></tr>
                            <tr class="font-weight-bold"><th>Margin over feed, chemicals and PL</th><td class="text-right" [class.text-danger]="x?.margin < 0">{{ x?.margin | php }}</td></tr>
                            <tr><td colspan="2" class="small text-muted">Labor, power and other costs are not recorded, so this is not a profit figure.</td></tr>
                        </tbody>
                    </table>
                    </div>
                </ng-template>
                <ng-template #harvestTable let-rows>
                    <div class="table-responsive">
                    <table class="table table-sm">
                        <thead><tr><th>Date · batch</th><th>Type</th><th class="text-right" title="Kg and boxes">Kg</th><th class="text-right" title="ABW and pieces">ABW</th><th>Grades</th><th>Quality</th></tr></thead>
                        <tbody>
                            @for (h of rows; track h.harvestId) {
                                <tr>
                                    <td class="text-nowrap">{{ h.date | farmDate }}<div><span class="fpms-pond-tag" [title]="h.batchCode">{{ h.pondCode }}</span> {{ batchShort(h.batchCode) }}</div></td>
                                    <td>{{ h.harvestType | label: L.HarvestTypes }}</td>
                                    <td class="text-right">{{ h.totalKg | num: 1 }}<div class="text-muted text-nowrap">{{ h.boxes != null ? h.boxes + ' boxes' : 'no boxes' }}</div></td>
                                    <td class="text-right">{{ h.abwG | num: 2 }} g<div class="text-muted text-nowrap">{{ h.pieces | num: 0 }} pcs</div></td>
                                    <td><div class="fpms-readings">@for (g of h.grades; track $index) { <span>{{ g.sizeLabel }} {{ g.kg | num: 1 }} kg</span> } @empty { <span class="text-muted">Ungraded</span> }</div></td>
                                    <td>{{ h.qualityChecks }}</td>
                                </tr>
                            } @empty {
                                <tr><td colspan="6" class="text-muted">No harvests.</td></tr>
                            }
                        </tbody>
                        @if (rows?.length > 1) {
                            <tfoot><tr><td colspan="2">Total</td><td class="text-right">{{ sum(rows, 'totalKg') | num: 1 }}<div class="text-muted">{{ sum(rows, 'boxes') | num: 0 }} boxes</div></td><td class="text-right">{{ sum(rows, 'pieces') | num: 0 }} pcs</td><td colspan="2"></td></tr></tfoot>
                        }
                    </table>
                    </div>
                </ng-template>
            </div>
        </section>
    `,
    styles: [
        `
            .rp-chip {
                min-height: 36px;
                padding: 0 0.9rem;
                margin: 0 0.4rem 0.4rem 0;
                border-radius: 18px;
                border: 1px solid var(--fpms-line-strong);
                background: var(--fpms-surface);
                font-size: 0.9rem;
                cursor: pointer;
            }
            .rp-chip[aria-pressed='true'] {
                background: var(--fpms-primary);
                border-color: var(--fpms-primary);
                color: var(--fpms-surface);
            }
        `,
    ],
})
export class ReportsComponent extends FpmsPage implements OnInit {
    readonly batchShort = batchShort;
    readonly unbroken = unbroken;
    /** A4 page with the farm, the report and the page count in the footer, like the other printed documents. */
    private readonly setFooter = printPage('fpms-report-page', 'Report');

    private cdr = inject(ChangeDetectorRef);
    /** True while the browser prints: every row of every table is then shown, not one screen page of it. */
    private printing = false;

    override print(): void {
        window.print();
    }

    /** Fires for the Print button and for Ctrl+P alike, before the page is laid out for paper. */
    @HostListener('window:beforeprint')
    beforePrint(): void {
        this.setFooter(`${this.r?.header?.farmName ?? this.session.tenant?.name ?? ''} · ${this.title()}${this.r?.header?.scope ? ' · ' + this.r.header.scope : ''}`);
        this.printing = true;
        this.cdr.detectChanges();
    }

    @HostListener('window:afterprint')
    afterPrint(): void {
        this.printing = false;
        this.cdr.detectChanges();
    }

    /** The sum of one numeric field over all rows of a table (not only the rows on the screen page), for its totals row. */
    sum(rows: any[] | null | undefined, key: string): number {
        return (rows ?? []).reduce((n: number, x: any) => n + (Number(x?.[key]) || 0), 0);
    }

    readonly reports: { key: ReportKey; label: string }[] = [
        { key: 'cycle', label: 'Production cycle performance' },
        { key: 'harvest', label: 'Batch harvest and survival' },
        { key: 'sales', label: 'Sales by buyer and period' },
        { key: 'wq', label: 'Water quality exceptions' },
        { key: 'inventory', label: 'Feed and supplement use' },
        { key: 'failure', label: 'Batch failures' },
    ];
    key: ReportKey = 'cycle';
    shown: ReportKey = 'cycle';
    /** DEC-84: the lot code typed in "Trace a lot code". */
    lotCode = '';
    r: any = null;
    generatedAt = '';
    cycles: any[] = [];
    batches: any[] = [];
    items: any[] = [];
    buyers: any[] = [];
    private pagers: Record<string, PagerState> = {};
    f: any = { cycleId: null, batchId: null, buyerId: null, itemId: null, from: FarmTime.addDays(FarmTime.today(), -30), to: FarmTime.today() };

    async ngOnInit(): Promise<void> {
        const [cycles, batches, items, buyers] = await Promise.all([
            this.api.get<any>('Cycle', 'GetPage', { maxResultCount: 100, sorting: 'startDate desc' }),
            this.api.get<any>('Batch', 'GetPage', { maxResultCount: 100 }),
            this.api.get<any[]>('Inventory', 'GetItems'),
            this.api.get<any[]>('Buyer', 'GetLookup'),
        ]);
        this.cycles = cycles.items;
        this.batches = batches.items;
        this.items = items;
        this.buyers = buyers ?? [];
        const report = this.query('report') as ReportKey;
        if (report && this.reports.some((x) => x.key === report)) {
            this.key = report;
        }
        this.f.cycleId = this.query('cycleId') ?? (this.key === 'cycle' ? this.cycles[0]?.id ?? null : null);
        this.f.batchId = this.query('batchId');
        if (this.query('cycleId') || this.query('batchId')) {
            this.runReport();
        }
    }

    /** Client-side paging and sorting state for one table of the current report (results are bounded by the 24-month range). */
    ps(id: string, defaultSort = ''): PagerState {
        return (this.pagers[id] ??= new PagerState(defaultSort));
    }

    view(id: string, rows: any[] | null | undefined, defaultSort = ''): any[] {
        const p = this.ps(id, defaultSort);
        let list = rows ?? [];
        const [key, dir] = p.sort.split(' ');
        if (key) {
            const sign = dir === 'desc' ? -1 : 1;
            list = [...list].sort((a, b) => {
                const x = a[key];
                const y = b[key];
                if (x == null && y == null) { return 0; }
                if (x == null) { return 1; }
                if (y == null) { return -1; }
                return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sign;
            });
        }
        p.total = list.length;
        p.page = Math.min(p.page, p.pages);
        return this.printing ? list : list.slice((p.page - 1) * p.size, p.page * p.size);
    }

    cyclesFor(): any[] {
        return this.key === 'failure' ? this.cycles.filter((c) => c.status === 3 || c.status === 4) : this.cycles;
    }

    batchesFor(): any[] {
        let list = this.f.cycleId ? this.batches.filter((b) => b.cycleId === this.f.cycleId) : this.batches;
        if (this.key === 'failure') {
            list = list.filter((b) => b.status === 4 || b.status === 5);
        }
        return list;
    }

    /** More than 24 months between From and To (the server rejects it too; one-batch reports are exempt). */
    rangeTooLong(): boolean {
        if (!this.f.from || !this.f.to || ((this.key === 'harvest' || this.key === 'wq') && this.f.batchId)) {
            return false;
        }
        return this.f.to > FarmTime.addMonths(this.f.from, 24);
    }

    canRun(): boolean {
        if (this.key === 'cycle') {
            return !!this.f.cycleId;
        }
        if (this.key === 'failure') {
            return !!this.f.cycleId || !!this.f.batchId;
        }
        return (!this.f.from || !this.f.to || this.f.from <= this.f.to) && !this.rangeTooLong();
    }

    title(): string {
        return this.reports.find((x) => x.key === this.shown)?.label ?? '';
    }

    async runReport(): Promise<void> {
        const f = this.f;
        const range = { from: f.from || null, to: f.to || null };
        const key = this.key;
        let result: any;
        const ok = await this.act(async () => {
            switch (key) {
                case 'cycle':
                    result = await this.api.get('Report', 'GetCyclePerformance', { cycleId: f.cycleId });
                    break;
                case 'harvest':
                    result = await this.api.get('Report', 'GetHarvestSummary', { ...range, cycleId: f.cycleId, batchId: f.batchId });
                    break;
                case 'sales':
                    result = await this.api.get('Report', 'GetSalesByBuyer', { ...range, buyerId: f.buyerId });
                    break;
                case 'wq':
                    result = await this.api.get('Report', 'GetWaterQualityExceptions', { ...range, batchId: f.batchId });
                    break;
                case 'inventory':
                    result = await this.api.get('Report', 'GetInventoryMovements', { ...range, itemId: f.itemId });
                    break;
                case 'failure':
                    result = await this.api.get('Report', 'GetFailureReport', f.batchId ? { batchId: f.batchId } : { cycleId: f.cycleId });
                    break;
            }
        });
        if (ok) {
            this.shown = key;
            this.pagers = {};
            this.generatedAt = new Date().toISOString();
            this.r = result;
        }
    }

    /** Downloads the CSV of the report on screen with the same filters (Owner only; the server logs the export). */
    async exportReport(): Promise<void> {
        const f = this.f;
        const kinds: Record<ReportKey, string> = {
            cycle: 'CyclePerformance',
            harvest: 'BatchHarvestAndSurvival',
            sales: 'SalesByBuyerAndPeriod',
            wq: 'WaterQualityExceptions',
            inventory: 'FeedAndAdditivesUsage',
            failure: 'BatchFailure',
        };
        const ranged = this.shown !== 'cycle' && this.shown !== 'failure';
        await this.exportCsv('ExportReport', {
            report: kinds[this.shown],
            cycleId: this.shown === 'cycle' || this.shown === 'harvest' || this.shown === 'failure' ? f.cycleId : null,
            batchId: this.shown === 'harvest' || this.shown === 'wq' || this.shown === 'failure' ? f.batchId : null,
            buyerId: this.shown === 'sales' ? f.buyerId : null,
            itemId: this.shown === 'inventory' ? f.itemId : null,
            from: ranged ? f.from || null : null,
            to: ranged ? f.to || null : null,
        });
    }

    /** Opens the trace report for the typed lot code (DEC-84); a code no harvest has is reported on that page. */
    traceLot(): void {
        const code = this.lotCode.trim().split(/[\s.\u2013\u2014/-]+/).filter((p) => p).join('-');
        if (code) {
            this.router.navigate(['/app/reports/trace/lot', code], { queryParams: { from: 'reports' } });
        }
    }
}
