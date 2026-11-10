import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
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
                            This lot was harvested before the earliest safe harvest date. See 2, Grow-out.
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
                                                <div class="l">{{ t.withdrawalNotMetCount }} {{ t.withdrawalNotMetCount === 1 ? 'treatment' : 'treatments' }} still withdrawing on {{ t.lotHarvestDate | farmDate }}. See 2, Grow-out.</div>
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

                        <!-- 1. Origin: one step back (PNS/BAFS 338:2022) -->
                        <section class="tr-part">
                            <h5 class="tr-h"><span class="tr-n">1</span>Origin<small>Where the fry came from and how the pond was stocked{{ t.lotCode ? ". A lot shares its batch's origin." : "." }}</small></h5>
                            @if (t.frySource; as f) {
                                <dl class="tr-facts">
                                    <div><dt>Hatchery</dt><dd>{{ f.hatcheryName }}{{ f.hatcheryShortCode ? ' (' + f.hatcheryShortCode + ')' : '' }}</dd></div>
                                    <div><dt>BFAR accreditation</dt><dd>{{ f.accreditationStatus | label: L.AccreditationStatuses }} · @if (f.bfarAccreditationNo) { {{ f.bfarAccreditationNo }} } @else { <span class="tr-missing"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Not recorded</span> }</dd></div>
                                    <div><dt>Hatchery batch no.</dt><dd>{{ f.hatcheryBatchNumber }}</dd></div>
                                    <div><dt>Fry delivered</dt><dd>{{ f.deliveryDate | farmDate }} · {{ f.plReceived | num: 0 }} PL{{ f.plAgeDays != null ? ' · PL' + f.plAgeDays : '' }}</dd></div>
                                    <div><dt>Shrimp Fry Source Certificate</dt><dd>@if (f.sfscNo) { {{ f.sfscNo }} } @else { <span class="tr-missing"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Not recorded (required by BFAR FAO 225-1)</span> }</dd></div>
                                    <div><dt>PL health certificate</dt><dd>@if (f.plHealthCertificateNo) { {{ f.plHealthCertificateNo }} } @else { <span class="tr-missing"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Not recorded</span> }</dd></div>
                                    <div><dt>Transport permit (DTP/LTP)</dt><dd>@if (f.transportPermitNo) { {{ f.transportPermitNo }} } @else { <span class="tr-missing"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Not recorded</span> }</dd></div>
                                </dl>
                            } @else {
                                <p class="small"><span class="tr-missing"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Not recorded</span>: no fry delivery is linked to this batch.</p>
                            }
                            <dl class="tr-facts">
                                <div><dt>Stocked</dt><dd>@if (t.stocking.stockingDate) { {{ t.stocking.stockingDate | farmDate }} } @else { <span class="tr-missing"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Not recorded</span> }{{ t.stocking.plStocked != null ? ' · ' + (t.stocking.plStocked | num: 0) + ' PL' : '' }}{{ t.stocking.deadAtStocking != null ? ' · ' + (t.stocking.deadAtStocking | num: 0) + ' dead' : '' }}</dd></div>
                                <div><dt>Pond {{ t.pondCode }} when stocked</dt><dd>{{ t.stocking.pondAreaM2 | num: 0 }} m²{{ t.stocking.constructionType ? ' · ' + (t.stocking.constructionType | label: L.ConstructionTypes) : '' }}{{ t.stocking.farmingSystem ? ' · ' + (t.stocking.farmingSystem | label: L.FarmingSystems) : '' }}</dd></div>
                                <div><dt>Density</dt><dd>{{ t.stocking.densityPerM2 != null ? (t.stocking.densityPerM2 | num: 1) + ' PL/m²' : '—' }}{{ t.stocking.densityFlag ? ' · ' + (t.stocking.densityFlag | label: L.DensityFlags) : '' }}</dd></div>
                            </dl>
                        </section>

                        <!-- 2. Grow-out: what went into the shrimp -->
                        <section class="tr-part">
                            <h5 class="tr-h"><span class="tr-n">2</span>Grow-out<small>{{ t.lotCode ? 'Feed up to the harvest day and treatments up to the harvest.' : "Feed and treatments over the batch's life." }}</small></h5>
                            <h6 class="tr-sub">Feed <span class="text-muted font-weight-normal">· {{ t.feedingSessionsFed }} fed session{{ t.feedingSessionsFed === 1 ? '' : 's' }}{{ t.feedingSessionsNotFed ? ', ' + t.feedingSessionsNotFed + ' not fed' : '' }}</span></h6>
                            @if (t.feedLots.length) {
                                <div class="table-responsive">
                                    <table class="table table-sm tr-table">
                                        <thead><tr><th>Product</th><th>Lot and supplier</th><th>Fed</th><th class="text-right">Kg</th></tr></thead>
                                        <tbody>
                                            @for (l of t.feedLots; track $index) {
                                                <tr>
                                                    <td>{{ l.product }}@if (l.feedType) { <div class="tr-sub2">{{ l.feedType }}</div> }</td>
                                                    <td>
                                                        @if (l.lotNumber) { <span class="text-monospace">{{ l.lotNumber }}</span> } @else { <span class="tr-missing"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Not recorded</span> }
                                                        @if (l.needsReconciliation) { <span class="badge badge-warning ml-1" title="Stock for this lot is flagged for reconciliation, so the kg may be unreliable">stock not reconciled</span> }
                                                        <div class="tr-sub2">{{ l.supplier || 'Supplier not recorded' }}</div>
                                                    </td>
                                                    <td class="text-nowrap">{{ l.firstFedOn ? (l.firstFedOn | farmDate) : '' }}@if (l.lastFedOn && l.lastFedOn !== l.firstFedOn) { <div class="tr-sub2">to {{ l.lastFedOn | farmDate }}</div> }</td>
                                                    <td class="text-right">{{ l.kg | num: 1 }}</td>
                                                </tr>
                                            }
                                        </tbody>
                                        <tfoot><tr><td colspan="3">Total feed</td><td class="text-right">{{ feedKg() | num: 1 }}</td></tr></tfoot>
                                    </table>
                                </div>
                            } @else {
                                <p class="small text-muted">No feed recorded.</p>
                            }

                            <h6 class="tr-sub">Chemicals and supplements</h6>
                            @if (t.treatments.length) {
                                <div class="table-responsive">
                                    <table class="table table-sm tr-table">
                                        <thead><tr><th>Date</th><th>Product and lot</th><th>Reason</th><th>Withdrawal</th>@if (t.lotCode) { <th>At harvest</th> }</tr></thead>
                                        <tbody>
                                            @for (x of t.treatments; track $index) {
                                                <tr [class.tr-row-bad]="x.withdrawalNotMet">
                                                    <td class="text-nowrap">{{ x.date | farmDate }}@if (x.endDate) { <div class="tr-sub2">to {{ x.endDate | farmDate }}</div> }</td>
                                                    <td>
                                                        {{ x.product || 'No stock drawn' }}{{ x.activeIngredient ? ' (' + x.activeIngredient + ')' : '' }}
                                                        @if (x.needsReconciliation) { <span class="badge badge-warning ml-1" title="Stock for this lot is flagged for reconciliation">stock not reconciled</span> }
                                                        <div class="tr-sub2">
                                                            {{ x.lotNumber ? 'Lot ' + x.lotNumber : '' }}{{ x.supplier ? ' · ' + x.supplier : '' }}{{ x.quantity ? ' · ' + x.quantity : '' }}{{ x.dosage != null ? ' · ' + x.dosage + ' ' + (x.dosageUnit || '') : '' }}{{ x.method ? ' · ' + x.method : '' }}{{ x.prescriptionRef ? ' · Rx ' + x.prescriptionRef : '' }}
                                                        </div>
                                                    </td>
                                                    <td>{{ x.reason || '—' }}</td>
                                                    <td class="text-nowrap">
                                                        @if (x.withdrawalDays != null) { {{ x.withdrawalDays }} days } @else { <span class="tr-missing"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Not recorded</span> }
                                                        @if (x.earliestSafeHarvestDate) { <div class="tr-sub2">safe from {{ x.earliestSafeHarvestDate | farmDate }}</div> }
                                                    </td>
                                                    @if (t.lotCode) {
                                                        <td class="text-nowrap">
                                                            @if (x.withdrawalNotMet) { <span class="tr-pill tr-pill-bad"><i class="fas fa-times" aria-hidden="true"></i> Not over</span> }
                                                            @else if (x.earliestSafeHarvestDate) { <span class="tr-pill tr-pill-ok"><i class="fas fa-check" aria-hidden="true"></i> Ended</span> }
                                                            @else { <span class="text-muted">—</span> }
                                                        </td>
                                                    }
                                                </tr>
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            } @else {
                                <p class="small text-muted">None recorded.</p>
                            }
                        </section>

                        <!-- 3. Harvest -->
                        <section class="tr-part">
                            <h5 class="tr-h"><span class="tr-n">3</span>Harvest<small>{{ t.lotCode ? 'This lot.' : t.harvests.length + (t.harvests.length === 1 ? ' harvest.' : ' harvests.') }}</small></h5>
                            @for (h of t.harvests; track h.harvestId) {
                                <div class="tr-harvest">
                                    <div class="d-flex flex-wrap justify-content-between">
                                        <div>
                                            @if (h.lotCode) { <strong class="tr-lot">{{ h.lotCode }}</strong> · }{{ h.harvestType | label: L.HarvestTypes }} harvest · {{ h.harvestedAtUtc | farmDateTime }}
                                        </div>
                                        <strong>{{ h.totalKg | num: 1 }} kg</strong>
                                    </div>
                                    <div class="small mt-1">
                                        @for (g of h.grades; track g.gradeLineId) { <span class="tr-chip-grade">{{ g.sizeLabel }} · {{ g.kg | num: 1 }} kg</span> }
                                        @if (h.deadAtHarvest != null) { <span class="text-muted mr-2">{{ h.deadAtHarvest | num: 0 }} dead at harvest</span> }
                                        @if (h.finalCount != null) { <span class="text-muted">final count {{ h.finalCount | num: 0 }}</span> }
                                    </div>
                                </div>
                            } @empty {
                                <p class="small text-muted">No harvest recorded.</p>
                            }
                        </section>

                        <!-- 4. Where it went: one step forward -->
                        <section class="tr-part">
                            <h5 class="tr-h"><span class="tr-n">4</span>Where it went<small>{{ buyerCopy() ? 'Your purchase only.' : 'Every sale and not-sold entry.' }}</small></h5>
                            @if (!buyerCopy() && t.harvestedKg > 0) {
                                <div class="tr-flow" role="img" [attr.aria-label]="'Harvested ' + t.harvestedKg + ' kg: sold ' + t.soldKg + ', not sold ' + t.disposedKg + ', not accounted for ' + t.unaccountedKg">
                                    <span class="tr-flow-sold" [style.width.%]="pct(t.soldKg)"></span>
                                    <span class="tr-flow-not" [style.width.%]="pct(t.disposedKg)"></span>
                                    <span class="tr-flow-gap" [style.width.%]="pct(t.unaccountedKg)"></span>
                                </div>
                                <div class="tr-flow-key small mb-3">
                                    <span><i class="tr-key tr-flow-sold"></i>Sold {{ t.soldKg | num: 1 }} kg</span>
                                    <span><i class="tr-key tr-flow-not"></i>Not sold {{ t.disposedKg | num: 1 }} kg</span>
                                    <span [class.font-weight-bold]="t.unaccountedKg > 0"><i class="tr-key tr-flow-gap"></i>Not accounted for {{ t.unaccountedKg | num: 1 }} kg</span>
                                    <span class="text-muted">of {{ t.harvestedKg | num: 1 }} kg harvested</span>
                                </div>
                            }
                            @for (b of salesByBuyer(); track b.buyer) {
                                <div class="table-responsive">
                                    <table class="table table-sm tr-table">
                                        <thead>
                                            <tr class="tr-buyer"><th colspan="4">{{ b.buyer }}</th><th class="text-right">{{ b.kg | num: 1 }} kg</th></tr>
                                            <tr><th>Dispatch receipt</th><th>Date</th><th>Grade</th><th class="text-right">Farm kg</th><th class="text-right">Buyer kg</th></tr>
                                        </thead>
                                        <tbody>
                                            @for (s of b.lines; track $index) {
                                                <tr>
                                                    <td>
                                                        <a [routerLink]="['/app/sales', s.saleId]">{{ s.dispatchReceiptNo }}</a>
                                                        <div class="tr-sub2">
                                                            @if (s.transporter || s.driverName || s.plateNo || s.destination || s.localTransportPermitNo) {
                                                                {{ s.transporter || '' }}{{ s.driverName ? ' · ' + s.driverName : '' }}{{ s.plateNo ? ' · ' + s.plateNo : '' }}{{ s.destination ? ' · to ' + s.destination : '' }}{{ s.localTransportPermitNo ? ' · permit ' + s.localTransportPermitNo : '' }}
                                                            } @else { <span class="tr-missing"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Transport not recorded</span> }
                                                        </div>
                                                    </td>
                                                    <td class="text-nowrap">{{ s.saleDate | farmDate }}</td>
                                                    <td>{{ s.sizeLabel }}</td>
                                                    <td class="text-right">{{ s.kg | num: 1 }}</td>
                                                    <td class="text-right">{{ s.buyerAcceptedKg != null ? (s.buyerAcceptedKg | num: 1) : '—' }}</td>
                                                </tr>
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            } @empty {
                                <p class="small text-muted">No sale recorded.</p>
                            }
                            @if (buyerCopy()) {
                                <p class="small mb-0">Quantity supplied to {{ who() }}: <strong>{{ suppliedKg() | num: 1 }} kg</strong>. Other buyers, unsold quantities and internal notes are left out of this copy.</p>
                            } @else if (t.disposals.length) {
                                <h6 class="tr-sub">Not sold</h6>
                                <ul class="small pl-3 mb-0">
                                    @for (d of t.disposals; track $index) { <li>{{ d.kg | num: 1 }} kg · {{ d.reason | label: L.DisposalReasons }}{{ d.note ? ' · ' + d.note : '' }}</li> }
                                </ul>
                            }
                        </section>
                        <div class="tr-print-only tr-signoff">
                            @if (buyerCopy()) {
                                <div><div class="fpms-sign">Released by (farm)</div></div>
                                <div><div class="fpms-sign">Date</div></div>
                                <div><div class="fpms-sign">Received by ({{ who() }})</div></div>
                            } @else {
                                <div><div class="fpms-sign">Prepared by</div></div>
                                <div><div class="fpms-sign">Checked by (Farm Owner)</div></div>
                                <div><div class="fpms-sign">Date</div></div>
                            }
                        </div>
                        <p class="small text-muted border-top pt-2 mt-3 mb-0">Voided entries are not listed here; the activity log keeps them. This sheet reads the farm's records and is not an official certificate.</p>
                    </div>
                }
            </div>
        </section>
    `,
    styles: [
        `
            .tr-part {
                margin-top: 1.5rem;
            }
            .tr-h {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: 0 0.5rem;
                font-weight: 700;
                padding-bottom: 0.35rem;
                margin-bottom: 0.75rem;
                border-bottom: 2px solid var(--fpms-line-strong);
                break-after: avoid;
            }
            .tr-h small {
                font-size: 0.85rem;
                font-weight: 400;
                color: var(--fpms-muted);
            }
            .tr-n {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 1.6rem;
                height: 1.6rem;
                border-radius: 50%;
                background: var(--fpms-primary);
                color: #fff;
                font-size: 0.85rem;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .tr-sub {
                font-size: 0.95rem;
                font-weight: 600;
                margin: 1rem 0 0.4rem;
                break-after: avoid;
            }
            .tr-facts {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
                gap: 0.6rem 1.5rem;
                margin-bottom: 0.75rem;
            }
            .tr-facts dt {
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                color: var(--fpms-muted);
                margin: 0;
            }
            .tr-facts dd {
                margin: 0;
            }
            .tr-missing {
                color: var(--fpms-warning);
                font-weight: 600;
                font-size: 0.85rem;
            }
            .tr-table {
                font-size: 0.875rem;
                margin-bottom: 0.75rem;
            }
            .tr-table thead th {
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                color: var(--fpms-muted);
                border-top: 0;
            }
            .tr-table td {
                vertical-align: top;
            }
            .tr-table tfoot td {
                font-weight: 700;
                border-top: 2px solid var(--fpms-line-strong);
            }
            .tr-table tr {
                break-inside: avoid;
            }
            .tr-sub2 {
                font-size: 0.8rem;
                color: var(--fpms-muted);
            }
            .tr-row-bad td {
                background: #fbeeee;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .tr-pill {
                display: inline-block;
                padding: 0.1rem 0.5rem;
                border-radius: 999px;
                font-size: 0.8rem;
                font-weight: 600;
                border: 1px solid currentColor;
            }
            .tr-pill-bad {
                color: var(--fpms-error);
            }
            .tr-pill-ok {
                color: var(--fpms-success);
            }
            .tr-harvest {
                border: 1px solid var(--fpms-line);
                border-radius: 4px;
                padding: 0.6rem 0.8rem;
                margin-bottom: 0.5rem;
                break-inside: avoid;
            }
            .tr-chip-grade {
                display: inline-block;
                padding: 0.05rem 0.5rem;
                margin: 0 0.35rem 0.25rem 0;
                border-radius: 4px;
                background: var(--fpms-bg);
                border: 1px solid var(--fpms-line);
            }
            .tr-buyer th {
                font-size: 0.95rem !important;
                text-transform: none !important;
                letter-spacing: 0 !important;
                color: var(--fpms-text, inherit) !important;
                border-bottom: 1px solid var(--fpms-line-strong);
            }
            .tr-flow {
                display: flex;
                height: 0.9rem;
                border-radius: 4px;
                overflow: hidden;
                background: var(--fpms-bg);
                border: 1px solid var(--fpms-line);
                margin-bottom: 0.35rem;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .tr-flow-key {
                display: flex;
                flex-wrap: wrap;
                gap: 0.25rem 1.25rem;
            }
            .tr-key {
                display: inline-block;
                width: 0.75rem;
                height: 0.75rem;
                border-radius: 2px;
                margin-right: 0.35rem;
                vertical-align: -1px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .tr-flow-sold {
                background: var(--fpms-success);
            }
            .tr-flow-not {
                background: var(--fpms-muted);
            }
            .tr-flow-gap {
                background: var(--fpms-warning);
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
            .tr-print-only {
                display: none;
            }
            @media print {
                /* One A4 document: no forced blank page after it, black text, compact type. */
                .fpms-paper {
                    page-break-after: auto;
                }
                .fpms-print-doc {
                    max-width: none;
                    font-size: 9.5pt;
                    color: #000;
                }
                .fpms-print-doc h4 {
                    font-size: 16pt;
                }
                .tr-print-only {
                    display: grid;
                }
                .tr-glance {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
                    gap: 6pt;
                    margin: 0 0 8pt;
                }
                .tr-glance > div {
                    flex: none;
                    max-width: none;
                    width: auto;
                    padding: 0;
                }
                .tr-glance .fpms-kpi {
                    height: 100%;
                    margin: 0;
                    padding: 5pt 7pt;
                    box-shadow: none;
                    border: 1px solid #999;
                    border-left-width: 4px;
                    break-inside: avoid;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .tr-glance .fpms-kpi .v {
                    font-size: 12pt;
                }
                .tr-glance .fpms-kpi .l {
                    font-size: 8pt;
                    color: #333;
                }
                .tr-chain li {
                    border-color: #999;
                    padding: 2pt 5pt;
                }
                .tr-part {
                    margin-top: 12pt;
                }
                .tr-h {
                    font-size: 11.5pt;
                    margin-bottom: 6pt;
                    border-bottom-color: #666;
                }
                .tr-n {
                    width: 15pt;
                    height: 15pt;
                    font-size: 8pt;
                }
                .tr-facts {
                    grid-template-columns: repeat(3, 1fr);
                    gap: 4pt 12pt;
                }
                .tr-facts dt {
                    font-size: 7pt;
                    color: #444;
                }
                .tr-table {
                    font-size: 8.5pt;
                }
                .tr-table th,
                .tr-table td {
                    padding: 2pt 4pt;
                }
                .tr-table thead th {
                    font-size: 7pt;
                    color: #444;
                }
                /* Column headings repeat on each page; totals print once. */
                .tr-table thead {
                    display: table-header-group;
                }
                .tr-table tfoot {
                    display: table-row-group;
                }
                .tr-sub2 {
                    font-size: 7.5pt;
                    color: #444;
                }
                .tr-missing,
                .tr-pill,
                .tr-chip-grade,
                .badge {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .badge {
                    border: 1px solid #999;
                }
                .tr-harvest {
                    border-color: #999;
                    padding: 4pt 6pt;
                }
                .tr-buyer th {
                    font-size: 9.5pt !important;
                }
                .tr-signoff {
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0 12pt;
                    margin-top: 36pt;
                    break-inside: avoid;
                }
                .tr-signoff .fpms-sign {
                    margin: 0;
                    font-size: 8pt;
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

    /** Total kg of feed listed. */
    feedKg = computed(() => {
        this.tick();
        return (this.t?.feedLots ?? []).reduce((n: number, l: any) => n + (l.kg || 0), 0);
    });

    /** The visible sales grouped by buyer, with each buyer's farm kg. */
    salesByBuyer = computed<{ buyer: string; kg: number; lines: any[] }[]>(() => {
        this.tick();
        const by = new Map<string, { buyer: string; kg: number; lines: any[] }>();
        for (const s of this.visibleSales()) {
            const g = by.get(s.buyerName) ?? { buyer: s.buyerName, kg: 0, lines: [] };
            g.kg += s.kg;
            g.lines.push(s);
            by.set(s.buyerName, g);
        }
        return Array.from(by.values());
    });

    /** Share of the harvested kg, for the "where it went" bar. */
    pct(kg: number): number {
        const total = this.t?.harvestedKg || 0;
        return total > 0 ? Math.max(0, Math.min(100, (kg / total) * 100)) : 0;
    }

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
            if (!f.plHealthCertificateNo) out.push({ what: 'PL health certificate number', where: 'Origin · ' + f.hatcheryBatchNumber, action: 'Open fry delivery', link: delivery });
            if (!f.sfscNo) out.push({ what: 'Shrimp Fry Source Certificate number', where: 'Origin · ' + f.hatcheryBatchNumber, action: 'Open fry delivery', link: delivery });
            if (!f.transportPermitNo) out.push({ what: 'Transport permit (DTP/LTP)', where: 'Origin · ' + f.hatcheryBatchNumber, action: 'Open fry delivery', link: delivery });
            if (!f.bfarAccreditationNo) out.push({ what: 'Hatchery BFAR accreditation number', where: 'Origin · ' + f.hatcheryName, action: 'Open hatcheries', link: ['/app/resources/hatcheries'] });
        }
        if (!t.bfarRegistrationNo) out.push({ what: 'Farm BFAR registration number', where: 'Farm profile', action: 'Open farm profile', link: ['/app/farm/profile'] });
        for (const l of t.feedLots ?? []) {
            if (!l.lotNumber) out.push({ what: `Lot number for ${l.product}`, where: 'Grow-out · feed', action: 'Open inventory', link: ['/app/inventory'] });
        }
        for (const x of t.treatments ?? []) {
            if (x.withdrawalDays == null) out.push({ what: `Withdrawal period for ${x.product || 'a treatment'}`, where: 'Grow-out · chemicals and supplements', action: 'Open inventory', link: ['/app/inventory'] });
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

    /** A4 page with a footer naming the sheet and the page count (Chrome and Edge print margin boxes). */
    private readonly pageStyle = (() => {
        const el = document.createElement('style');
        el.id = 'fpms-trace-page';
        document.head.appendChild(el);
        inject(DestroyRef).onDestroy(() => el.remove());
        return el;
    })();

    private setPageFooter(): void {
        const t = this.t;
        const quote = (v: string) => '"' + (v ?? '').replace(/["\\]/g, '').replace(/\s+/g, ' ') + '"';
        const name = !t ? 'Trace report' : t.lotCode ? `${t.farmName} · Trace report, lot ${t.lotCode}` : `${t.farmName} · Trace report, batch ${t.batchCode}`;
        this.pageStyle.textContent =
            `@page { size: A4; margin: 14mm 12mm 16mm 12mm; ` +
            `@bottom-left { content: ${quote(name)}; font-size: 8pt; color: #555; } ` +
            `@bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #555; } }`;
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
        this.setPageFooter();
        this.setPageTitle(this.lotCode ? `Trace lot ${this.lotCode}` : this.t ? `Trace ${this.t.batchCode}` : null);
    }
}
