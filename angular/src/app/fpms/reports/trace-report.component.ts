import { Component, OnInit, computed, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * Trace report for one batch (DEC-72; PNS/BAFS 338:2022), or for one harvest lot code (DEC-84, /app/reports/trace/lot/:code):
 * the same sheet limited to that harvest, with feed and treatments up to its harvest and only its sales. Trace report for one batch: the fry source and certificates, the feed and chemical lots used,
 * the harvests, and every sale and disposal of that harvest. Read-only. Missing optional data reads "Not recorded".
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [title]="lotCode ? 'Trace · lot ' + lotCode : t ? 'Trace · batch ' + t.batchCode : 'Trace report'" [subtitle]="t ? (t.lotCode ? 'Batch ' + t.batchCode + ' · ' : '') + 'Pond ' + t.pondCode + ' · Cycle ' + t.cycleCode + ' · ' + (t.batchStatus | label: L.BatchStatuses) + '.' : ''" [backLink]="back().link" [backLabel]="back().label">
            @if (t) {
                <button class="btn btn-primary" (click)="print()"><i class="fas fa-print mr-1"></i>Print</button>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (notFound) {
                    <div class="alert alert-warning">
                        No harvest has the lot code <strong class="text-monospace">{{ lotCode }}</strong>. Check the code on the crate, receipt or tally sheet,
                        or search for it in <a routerLink="/app/harvests">Harvests</a>.
                    </div>
                } @else if (!t) {
                    <fpms-loading></fpms-loading>
                } @else {
                    @if (t.lotCode) {
                        <div class="alert alert-info no-print">
                            This sheet covers lot <strong class="text-monospace">{{ t.lotCode }}</strong> only, harvested {{ t.lotHarvestDate | farmDate }}:
                            feed and treatments up to that harvest, and only this lot's sales. <a [routerLink]="['/app/reports/trace', t.batchId]">Trace the whole batch {{ t.batchCode }}</a>
                        </div>
                    }
                    @if (t.lotCode && !buyerCopy() && t.withdrawalNotMetCount) {
                        <div class="alert alert-danger no-print">
                            <i class="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>
                            <strong>{{ t.withdrawalNotMetCount }} {{ t.withdrawalNotMetCount === 1 ? 'treatment was' : 'treatments were' }} still in the withdrawal period on {{ t.lotHarvestDate | farmDate }}.</strong>
                            This lot was harvested before the earliest safe harvest date. See section 4.
                        </div>
                    }
                    <div class="card no-print">
                        <div class="card-body py-2 d-flex flex-wrap align-items-center">
                            <span class="font-weight-bold mr-2">Prepare as</span>
                            <button type="button" class="tr-chip" [attr.aria-pressed]="!buyerCopy()" (click)="buyerCopy.set(false)">Internal copy</button>
                            <button type="button" class="tr-chip" [attr.aria-pressed]="buyerCopy()" (click)="setBuyerCopy()" [disabled]="!buyers().length">Buyer copy</button>
                            @if (buyerCopy()) {
                                <label class="mb-0 ml-3 small text-muted">
                                    Prepared for
                                    <select class="form-control form-control-sm d-inline-block w-auto ml-1" [ngModel]="who()" (ngModelChange)="who.set($event)">
                                        @for (b of buyers(); track b) { <option [ngValue]="b">{{ b }}</option> }
                                    </select>
                                </label>
                            }
                            <div class="small text-muted w-100 mt-1">
                                @if (buyerCopy()) {
                                    For a buyer who asks where their shrimp came from. It shows only their own purchase and leaves out other buyers, unsold quantities and the list of missing items.
                                } @else {
                                    The full record, for the farm and for inspectors. Missing items are listed above the sheet.
                                }
                            </div>
                        </div>
                    </div>
                    @if (!buyerCopy() && gaps().length) {
                        <div class="alert alert-warning no-print">
                            <strong>{{ gaps().length }} {{ gaps().length === 1 ? 'item' : 'items' }} not recorded.</strong>
                            Record {{ gaps().length === 1 ? 'it' : 'them' }} before a buyer or inspector asks. The sheet still prints with "Not recorded" in their place.
                            <ul class="list-unstyled mb-0 mt-2">
                                @for (g of gaps(); track $index) {
                                    <li class="d-flex flex-wrap align-items-center py-1 border-top">
                                        <span class="flex-fill">{{ g.what }}<span class="small text-muted"> · {{ g.where }}</span></span>
                                        <a class="btn btn-sm btn-outline-secondary" [routerLink]="g.link">{{ g.action }}</a>
                                    </li>
                                }
                            </ul>
                        </div>
                    }
                    <div class="fpms-paper fpms-print-doc">
                        @if (t.lotCode) {
                            <!-- DEC-84: a lot sheet leads with the code and the recall answer, then the detail. -->
                            <div class="d-flex flex-wrap justify-content-between align-items-start mb-2">
                                <div>
                                    <div class="small text-muted">{{ t.farmName }} · Trace report</div>
                                    <h4 class="mb-0">Lot <span class="tr-lot">{{ t.lotCode }}</span></h4>
                                </div>
                                <div class="small text-md-right">
                                    BFAR registration no.: {{ t.bfarRegistrationNo || 'Not recorded' }}<br />
                                    Run {{ t.generatedAtUtc | farmDateTime }}@if (buyerCopy()) { · Prepared for {{ who() }} }
                                </div>
                            </div>
                            <ol class="tr-chain small" aria-label="From fry source to buyer">
                                <li><span class="text-muted">Hatchery</span> {{ t.frySource?.hatcheryShortCode || t.frySource?.hatcheryName || 'Not recorded' }}</li>
                                <li><span class="text-muted">Fry delivered</span> {{ t.frySource ? (t.frySource.deliveryDate | farmDate) : 'Not recorded' }}</li>
                                <li><span class="text-muted">Pond</span> {{ t.pondCode }} · {{ t.batchCode }}</li>
                                <li class="tr-chain-here"><span class="text-muted">Harvested</span> {{ t.lotHarvestDate | farmDate }}</li>
                                <li><span class="text-muted">{{ buyerCopy() ? 'Buyer' : 'Buyers' }}</span> {{ buyerCopy() ? who() : buyers().length ? buyers().join(', ') : 'None yet' }}</li>
                            </ol>
                            <div class="row tr-glance">
                                @if (t.harvests[0]; as h) {
                                    <div class="col-6" [class.col-md-3]="!buyerCopy()" [class.col-md-4]="buyerCopy()">
                                        <div class="fpms-kpi"><div class="v">{{ h.totalKg | num: 1 }} kg</div><div class="l">{{ h.harvestType | label: L.HarvestTypes }} harvest · {{ h.harvestedAtUtc | farmDateTime }}</div></div>
                                    </div>
                                }
                                <div class="col-6" [class.col-md-3]="!buyerCopy()" [class.col-md-4]="buyerCopy()">
                                    @if (buyerCopy()) {
                                        <div class="fpms-kpi"><div class="v">{{ suppliedKg() | num: 1 }} kg</div><div class="l">Supplied to {{ who() }}</div></div>
                                    } @else {
                                        <div class="fpms-kpi" [class.fpms-kpi-warn]="t.unaccountedKg > 0">
                                            <div class="v">{{ t.soldKg | num: 1 }} kg sold</div>
                                            <div class="l">{{ buyers().length }} {{ buyers().length === 1 ? 'buyer' : 'buyers' }} · not sold {{ t.disposedKg | num: 1 }} kg · not accounted for {{ t.unaccountedKg | num: 1 }} kg</div>
                                        </div>
                                    }
                                </div>
                                <div class="col-6" [class.col-md-3]="!buyerCopy()" [class.col-md-4]="buyerCopy()">
                                    <div class="fpms-kpi" [class.fpms-kpi-warn]="!t.frySource || !t.frySource.sfscNo">
                                        <div class="v">{{ t.frySource?.hatcheryShortCode || t.frySource?.hatcheryName || 'Not recorded' }}</div>
                                        <div class="l">@if (t.frySource; as f) { Hatchery batch {{ f.hatcheryBatchNumber }} · {{ f.sfscNo ? 'SFSC ' + f.sfscNo : 'SFSC not recorded' }} } @else { Fry source not recorded }</div>
                                    </div>
                                </div>
                                @if (!buyerCopy()) {
                                    <div class="col-6 col-md-3">
                                        @if (t.withdrawalNotMetCount) {
                                            <div class="fpms-kpi tr-kpi-bad" role="alert">
                                                <div class="v">Withdrawal not over</div>
                                                <div class="l">{{ t.withdrawalNotMetCount }} {{ t.withdrawalNotMetCount === 1 ? 'treatment' : 'treatments' }} still withdrawing on {{ t.lotHarvestDate | farmDate }}. See section 4.</div>
                                            </div>
                                        } @else if (lastSafeDate()) {
                                            <div class="fpms-kpi tr-kpi-ok">
                                                <div class="v">Withdrawal ended</div>
                                                <div class="l">Every withdrawal period ended by {{ lastSafeDate() | farmDate }}, on or before the harvest.</div>
                                            </div>
                                        } @else {
                                            <div class="fpms-kpi">
                                                <div class="v">No withdrawal</div>
                                                <div class="l">{{ t.treatments.length ? 'No treatment before this harvest has a withdrawal period recorded.' : 'No treatment recorded before this harvest.' }}</div>
                                            </div>
                                        }
                                    </div>
                                }
                            </div>
                            <div class="small text-muted mb-3">Pond {{ t.pondCode }} · Batch {{ t.batchCode }} · Cycle {{ t.cycleCode }} · Batch status {{ t.batchStatus | label: L.BatchStatuses }}. Feed and treatments below stop at this harvest; sales are this lot's only.</div>
                        } @else {
                            <h4 class="mb-0">{{ t.farmName }}</h4>
                            <div class="small mb-3">
                                BFAR registration no.: {{ t.bfarRegistrationNo || 'Not recorded' }} · Batch {{ t.batchCode }} · Pond {{ t.pondCode }} · Cycle {{ t.cycleCode }}
                                · Status {{ t.batchStatus | label: L.BatchStatuses }} · Run {{ t.generatedAtUtc | farmDateTime }}@if (buyerCopy()) { · Prepared for {{ who() }} }
                            </div>
                        }

                        <h5>1. Fry source</h5>
                        @if (t.frySource; as f) {
                            <dl class="row small mb-3">
                                <dt class="col-sm-4">Hatchery</dt><dd class="col-sm-8">{{ f.hatcheryName }}{{ f.hatcheryShortCode ? ' (' + f.hatcheryShortCode + ')' : '' }}</dd>
                                <dt class="col-sm-4">BFAR accreditation</dt><dd class="col-sm-8">{{ f.accreditationStatus | label: L.AccreditationStatuses }} · {{ f.bfarAccreditationNo || 'Not recorded' }}</dd>
                                <dt class="col-sm-4">Hatchery batch no.</dt><dd class="col-sm-8">{{ f.hatcheryBatchNumber }}</dd>
                                <dt class="col-sm-4">Delivered</dt><dd class="col-sm-8">{{ f.deliveryDate | farmDate }} · {{ f.plReceived | num: 0 }} PL received{{ f.plAgeDays != null ? ' · PL' + f.plAgeDays : '' }}</dd>
                                <dt class="col-sm-4">PL health certificate</dt><dd class="col-sm-8">{{ f.plHealthCertificateNo || 'Not recorded' }}</dd>
                                <dt class="col-sm-4">Shrimp Fry Source Certificate no.</dt><dd class="col-sm-8">@if (f.sfscNo) { {{ f.sfscNo }} } @else { <span class="text-warning"><i class="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>Not recorded: required by BFAR FAO 225-1</span> }</dd>
                                <dt class="col-sm-4">Transport permit (DTP/LTP)</dt><dd class="col-sm-8">{{ f.transportPermitNo || 'Not recorded' }}</dd>
                            </dl>
                        } @else {
                            <p class="small text-muted">Not recorded.</p>
                        }

                        <h5>2. Pond and stocking</h5>
                        <dl class="row small mb-3">
                            <dt class="col-sm-4">Stocked</dt><dd class="col-sm-8">{{ t.stocking.stockingDate ? (t.stocking.stockingDate | farmDate) : 'Not recorded' }} · {{ t.stocking.plStocked != null ? (t.stocking.plStocked | num: 0) + ' PL' : 'count not recorded' }}{{ t.stocking.deadAtStocking != null ? ' · ' + (t.stocking.deadAtStocking | num: 0) + ' dead at stocking' : '' }}</dd>
                            <dt class="col-sm-4">Pond when stocked</dt><dd class="col-sm-8">{{ t.stocking.pondAreaM2 | num: 0 }} m²{{ t.stocking.constructionType ? ' · ' + (t.stocking.constructionType | label: L.ConstructionTypes) : '' }}{{ t.stocking.farmingSystem ? ' · ' + (t.stocking.farmingSystem | label: L.FarmingSystems) : '' }}</dd>
                            <dt class="col-sm-4">Density</dt><dd class="col-sm-8">{{ t.stocking.densityPerM2 != null ? (t.stocking.densityPerM2 | num: 1) + ' PL/m²' : 'Not recorded' }}{{ t.stocking.densityFlag ? ' · ' + (t.stocking.densityFlag | label: L.DensityFlags) : '' }}</dd>
                        </dl>

                        <h5>3. Feed used{{ t.lotCode ? ' up to the harvest day' : '' }}</h5>
                        <p class="small text-muted mb-1">{{ t.feedingSessionsFed }} fed session{{ t.feedingSessionsFed === 1 ? '' : 's' }}, {{ t.feedingSessionsNotFed }} marked not fed. Sessions are recorded as AM or PM, with an optional time fed.</p>
                        @if (t.feedLots.length) {
                            <div class="table-responsive">
                                <table class="table table-sm small mb-3">
                                    <thead><tr><th>Product</th><th>Type</th><th>Lot</th><th>Supplier</th><th>First fed</th><th>Last fed</th><th class="text-right">Kg</th></tr></thead>
                                    <tbody>
                                        @for (l of t.feedLots; track $index) {
                                            <tr>
                                                <td>{{ l.product }}</td><td>{{ l.feedType || 'Not recorded' }}</td><td>{{ l.lotNumber || 'Not recorded' }}@if (l.needsReconciliation) { <span class="badge badge-warning ml-1" title="Stock for this lot is flagged for reconciliation, so the kg may be unreliable">stock not reconciled</span> }</td><td>{{ l.supplier || 'Not recorded' }}</td>
                                                <td>{{ l.firstFedOn ? (l.firstFedOn | farmDate) : '' }}</td><td>{{ l.lastFedOn ? (l.lastFedOn | farmDate) : '' }}</td><td class="text-right">{{ l.kg | num: 1 }}</td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                        } @else {
                            <p class="small text-muted">No feed recorded.</p>
                        }

                        <h5>4. Chemicals and supplements{{ t.lotCode ? ' up to the harvest' : '' }}</h5>
                        @if (t.treatments.length) {
                            <div class="table-responsive">
                                <table class="table table-sm small mb-3">
                                    <thead><tr><th>Date</th><th>Product</th><th>Lot / supplier</th><th>Qty</th><th>Reason</th><th>Dose / method</th><th>Withdrawal</th><th>Safe harvest from</th><th>Prescription</th></tr></thead>
                                    <tbody>
                                        @for (x of t.treatments; track $index) {
                                            <tr [class.table-danger]="x.withdrawalNotMet">
                                                <td>{{ x.date | farmDate }}{{ x.endDate ? ' – ' + (x.endDate | farmDate) : '' }}</td>
                                                <td>{{ x.product || 'No stock drawn' }}{{ x.activeIngredient ? ' (' + x.activeIngredient + ')' : '' }}</td>
                                                <td>{{ x.lotNumber || '' }}{{ x.supplier ? ' · ' + x.supplier : '' }}@if (x.needsReconciliation) { <span class="badge badge-warning ml-1" title="Stock for this lot is flagged for reconciliation">stock not reconciled</span> }</td>
                                                <td>{{ x.quantity || '' }}</td>
                                                <td>{{ x.reason || 'Not recorded' }}</td>
                                                <td>{{ x.dosage != null ? x.dosage + ' ' + (x.dosageUnit || '') : '' }}{{ x.method ? ' · ' + x.method : '' }}</td>
                                                <td>{{ x.withdrawalDays != null ? x.withdrawalDays + ' d' : 'Not recorded' }}</td>
                                                <td>{{ x.earliestSafeHarvestDate ? (x.earliestSafeHarvestDate | farmDate) : '' }}@if (x.withdrawalNotMet) { <span class="badge badge-danger ml-1" title="The withdrawal period had not ended when this lot was harvested">not over at harvest</span> }</td>
                                                <td>{{ x.prescriptionRef || '' }}</td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                        } @else {
                            <p class="small text-muted">None recorded.</p>
                        }

                        <h5>5. Harvest{{ t.lotCode ? ' (this lot)' : '' }}</h5>
                        @for (h of t.harvests; track h.harvestId) {
                            <div class="small mb-2">
                                @if (h.lotCode) { <strong>Lot {{ h.lotCode }}</strong> · }<strong>{{ h.harvestedAtUtc | farmDateTime }}</strong> · {{ h.harvestType | label: L.HarvestTypes }} · {{ h.totalKg | num: 1 }} kg
                                {{ h.deadAtHarvest != null ? ' · ' + (h.deadAtHarvest | num: 0) + ' dead at harvest' : '' }}{{ h.finalCount != null ? ' · final count ' + (h.finalCount | num: 0) : '' }}
                                <div class="text-muted">
                                    @for (g of h.grades; track g.gradeLineId) { <span class="mr-3">{{ g.sizeLabel }}: {{ g.kg | num: 1 }} kg</span> }
                                </div>
                            </div>
                        } @empty {
                            <p class="small text-muted">No harvest recorded.</p>
                        }

                        <h5>6. Where it went</h5>
                        @if (visibleSales().length) {
                            <div class="table-responsive">
                                <table class="table table-sm small mb-2">
                                    <thead><tr><th>Sale</th><th>Date</th><th>Buyer</th><th>Grade</th><th class="text-right">Farm kg</th><th class="text-right">Buyer kg</th><th>Transport</th></tr></thead>
                                    <tbody>
                                        @for (s of visibleSales(); track $index) {
                                            <tr>
                                                <td><a [routerLink]="['/app/sales', s.saleId]">{{ s.dispatchReceiptNo }}</a></td>
                                                <td>{{ s.saleDate | farmDate }}</td><td>{{ s.buyerName }}</td><td>{{ s.sizeLabel }}</td>
                                                <td class="text-right">{{ s.kg | num: 1 }}</td><td class="text-right">{{ s.buyerAcceptedKg != null ? (s.buyerAcceptedKg | num: 1) : '' }}</td>
                                                <td>
                                                    {{ s.transporter || '' }}{{ s.driverName ? ' · ' + s.driverName : '' }}{{ s.plateNo ? ' · ' + s.plateNo : '' }}{{ s.destination ? ' · To ' + s.destination : '' }}
                                                    {{ s.localTransportPermitNo ? ' · Permit ' + s.localTransportPermitNo : '' }}
                                                    @if (!s.transporter && !s.driverName && !s.plateNo && !s.destination && !s.localTransportPermitNo) { Not recorded }
                                                </td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                        } @else {
                            <p class="small text-muted">No sale recorded.</p>
                        }
                        @if (buyerCopy()) {
                            <p class="small mt-2 mb-0">Quantity supplied to {{ who() }}: {{ suppliedKg() | num: 1 }} kg. Other buyers, unsold quantities and internal notes are left out of this copy.</p>
                        } @else {
                            @for (d of t.disposals; track $index) {
                                <div class="small">Not sold: {{ d.kg | num: 1 }} kg · {{ d.reason | label: L.DisposalReasons }}{{ d.note ? ' · ' + d.note : '' }}</div>
                            }
                            <p class="small mt-2 mb-0">
                                Harvested {{ t.harvestedKg | num: 1 }} kg · sold {{ t.soldKg | num: 1 }} kg · not sold {{ t.disposedKg | num: 1 }} kg ·
                                <strong>not accounted for {{ t.unaccountedKg | num: 1 }} kg</strong>
                            </p>
                        }
                        <p class="small text-muted border-top pt-2 mt-3 mb-0">Voided entries are not listed here; the activity log keeps them. This sheet reads the farm's records and is not an official certificate.</p>
                    </div>
                }
            </div>
        </section>
    `,
    styles: [
        `
            .fpms-print-doc h5 {
                margin-top: 1.25rem;
                padding-bottom: 0.25rem;
                border-bottom: 1px solid var(--fpms-line);
                break-after: avoid;
            }
            .tr-lot {
                font-family: var(--fpms-mono, monospace);
                letter-spacing: 0.02em;
            }
            .tr-chain {
                display: flex;
                flex-wrap: wrap;
                list-style: none;
                padding: 0;
                margin: 0 0 0.75rem;
            }
            .tr-chain li {
                padding: 0.25rem 0.6rem;
                margin: 0 0.25rem 0.25rem 0;
                border: 1px solid var(--fpms-line-strong);
                border-radius: 4px;
            }
            .tr-chain li + li::before {
                content: '→';
                margin: 0 0.5rem 0 -0.1rem;
                color: var(--fpms-muted);
            }
            .tr-chain .tr-chain-here {
                border-color: var(--fpms-primary);
                font-weight: 600;
            }
            .tr-glance .fpms-kpi {
                height: calc(100% - 1rem);
            }
            .tr-glance .fpms-kpi .v {
                white-space: normal;
            }
            .tr-kpi-bad {
                border-left-color: var(--fpms-error);
                background: #fbeeee;
            }
            .tr-kpi-bad .v {
                color: var(--fpms-error);
            }
            .tr-kpi-ok {
                border-left-color: var(--fpms-success);
            }
            @media print {
                .tr-glance .fpms-kpi {
                    box-shadow: none;
                    border: 1px solid #999;
                    border-left-width: 4px;
                    break-inside: avoid;
                }
                .tr-kpi-bad {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }
            .tr-chip {
                min-height: 36px;
                padding: 0 0.9rem;
                margin-right: 0.4rem;
                border-radius: 18px;
                border: 1px solid var(--fpms-line-strong);
                background: var(--fpms-surface);
                font-size: 0.9rem;
                cursor: pointer;
            }
            .tr-chip[aria-pressed='true'] {
                background: var(--fpms-primary);
                border-color: var(--fpms-primary);
                color: #fff;
            }
        `,
    ],
})
export class TraceReportComponent extends FpmsPage implements OnInit {
    t: any = null;
    batchId = '';
    /** Set for a lot trace (DEC-84). */
    lotCode = '';
    notFound = false;
    /** Where the sheet was opened from (?from=sales|harvests|reports); the page then belongs to that section. */
    readonly from = this.query('from');

    back(): { link: any; label: string } {
        if (this.from === 'sales') return { link: '/app/sales', label: 'Sales' };
        if (this.from === 'harvests') return { link: '/app/harvests', label: 'Harvests' };
        if (this.from === 'reports') return { link: '/app/reports', label: 'Reports' };
        const batch = this.batchId || this.t?.batchId;
        return batch ? { link: ['/app/production/batches', batch], label: 'Batch' } : { link: '/app/reports', label: 'Reports' };
    }
    private readonly tick = signal(0);
    buyerCopy = signal(false);
    who = signal('');

    /** The buyers that bought from this batch, for the "Prepared for" choice. */
    buyers = computed<string[]>(() => {
        this.tick();
        return Array.from(new Set<string>((this.t?.sales ?? []).map((s: any) => s.buyerName))).sort();
    });

    /** Sales shown on the sheet: all of them, or only the chosen buyer's in a buyer copy. */
    visibleSales = computed<any[]>(() => {
        this.tick();
        const all: any[] = this.t?.sales ?? [];
        return this.buyerCopy() ? all.filter((s) => s.buyerName === this.who()) : all;
    });

    suppliedKg = computed(() => {
        this.tick();
        return this.visibleSales().reduce((n, s) => n + (s.buyerAcceptedKg ?? s.kg), 0);
    });

    /** Lot sheet: the latest earliest-safe-harvest date among the treatments before the harvest, if any has a withdrawal period. */
    lastSafeDate = computed<string | null>(() => {
        this.tick();
        const dates: string[] = (this.t?.treatments ?? []).map((x: any) => x.earliestSafeHarvestDate).filter((d: string | null) => !!d);
        return dates.length ? dates.sort()[dates.length - 1] : null;
    });

    /** Things the sheet prints as "Not recorded", each with the place to record it. */
    gaps = computed<{ what: string; where: string; action: string; link: any[] }[]>(() => {
        this.tick();
        const t = this.t;
        if (!t) {
            return [];
        }
        const out: { what: string; where: string; action: string; link: any[] }[] = [];
        const f = t.frySource;
        const delivery = f ? ['/app/resources/fry-deliveries', f.deliveryId] : ['/app/resources/fry-deliveries'];
        if (f) {
            if (!f.plHealthCertificateNo) out.push({ what: 'PL health certificate number', where: 'Fry source · ' + f.hatcheryBatchNumber, action: 'Open fry delivery', link: delivery });
            if (!f.sfscNo) out.push({ what: 'Shrimp Fry Source Certificate number', where: 'Fry source · ' + f.hatcheryBatchNumber, action: 'Open fry delivery', link: delivery });
            if (!f.transportPermitNo) out.push({ what: 'Transport permit (DTP/LTP)', where: 'Fry source · ' + f.hatcheryBatchNumber, action: 'Open fry delivery', link: delivery });
            if (!f.bfarAccreditationNo) out.push({ what: 'Hatchery BFAR accreditation number', where: 'Fry source · ' + f.hatcheryName, action: 'Open hatcheries', link: ['/app/resources/hatcheries'] });
        }
        if (!t.bfarRegistrationNo) out.push({ what: 'Farm BFAR registration number', where: 'Farm profile', action: 'Open farm profile', link: ['/app/farm/profile'] });
        for (const l of t.feedLots ?? []) {
            if (!l.lotNumber) out.push({ what: `Lot number for ${l.product}`, where: 'Feed used', action: 'Open inventory', link: ['/app/inventory'] });
        }
        for (const x of t.treatments ?? []) {
            if (x.withdrawalDays == null) out.push({ what: `Withdrawal period for ${x.product || 'a treatment'}`, where: 'Chemicals and supplements', action: 'Open inventory', link: ['/app/inventory'] });
        }
        for (const s of t.sales ?? []) {
            if (!s.transporter && !s.driverName && !s.plateNo && !s.destination && !s.localTransportPermitNo) {
                out.push({ what: `Transport details for ${s.dispatchReceiptNo}`, where: `Where it went · sale to ${s.buyerName}`, action: 'Open sale', link: ['/app/sales', s.saleId, 'edit'] });
            }
        }
        return out;
    });

    setBuyerCopy(): void {
        if (!this.who() || !this.buyers().includes(this.who())) {
            this.who.set(this.buyers()[0] ?? '');
        }
        this.buyerCopy.set(true);
    }

    ngOnInit(): void {
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        this.lotCode = this.param('code') ?? '';
        this.batchId = this.lotCode ? '' : (this.param('id') ?? '');
        this.t = null;
        this.notFound = false;
        this.t = this.lotCode
            ? await this.run(() => this.api.get<any>('Trace', 'GetLotTrace', { lotCode: this.lotCode }))
            : await this.run(() => this.api.get<any>('Trace', 'GetBatchTrace', { batchId: this.batchId }));
        this.notFound = !!this.lotCode && !this.t;
        this.buyerCopy.set(false);
        this.who.set('');
        this.tick.update((n) => n + 1);
        this.setPageTitle(this.lotCode ? `Trace lot ${this.lotCode}` : this.t ? `Trace ${this.t.batchCode}` : null);
    }
}
