import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * Trace report for one batch (DEC-72; PNS/BAFS 338:2022): the fry source and certificates, the feed and chemical lots used,
 * the harvests, and every sale and disposal of that harvest. Read-only. Missing optional data reads "Not recorded".
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [title]="t ? 'Trace · batch ' + t.batchCode : 'Trace report'" [subtitle]="t ? 'Pond ' + t.pondCode + ' · Cycle ' + t.cycleCode : ''" [backLink]="['/app/production/batches', batchId]" backLabel="Batch">
            @if (t) {
                <button class="btn btn-primary" (click)="print()"><i class="fas fa-print mr-1"></i>Print</button>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (!t) {
                    <fpms-loading></fpms-loading>
                } @else {
                    <div class="fpms-paper fpms-print-doc">
                        <h4 class="mb-0">{{ t.farmName }}</h4>
                        <div class="small mb-3">
                            BFAR registration no.: {{ t.bfarRegistrationNo || 'Not recorded' }} · Batch {{ t.batchCode }} · Pond {{ t.pondCode }} · Cycle {{ t.cycleCode }}
                            · Status {{ t.batchStatus | label: L.BatchStatuses }} · Run {{ t.generatedAtUtc | farmDateTime }}
                        </div>

                        <h5>1. Fry source</h5>
                        @if (t.frySource; as f) {
                            <dl class="row small mb-3">
                                <dt class="col-sm-4">Hatchery</dt><dd class="col-sm-8">{{ f.hatcheryName }}{{ f.hatcheryShortCode ? ' (' + f.hatcheryShortCode + ')' : '' }}</dd>
                                <dt class="col-sm-4">BFAR accreditation</dt><dd class="col-sm-8">{{ f.accreditationStatus | label: L.AccreditationStatuses }} · {{ f.bfarAccreditationNo || 'Not recorded' }}</dd>
                                <dt class="col-sm-4">Hatchery batch no.</dt><dd class="col-sm-8">{{ f.hatcheryBatchNumber }}</dd>
                                <dt class="col-sm-4">Delivered</dt><dd class="col-sm-8">{{ f.deliveryDate | farmDate }} · {{ f.plReceived | num: 0 }} PL received{{ f.plAgeDays != null ? ' · PL' + f.plAgeDays : '' }}</dd>
                                <dt class="col-sm-4">PL health certificate</dt><dd class="col-sm-8">{{ f.plHealthCertificateNo || 'Not recorded' }}</dd>
                                <dt class="col-sm-4">SFSC no.</dt><dd class="col-sm-8">{{ f.sfscNo || 'Not recorded' }}</dd>
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

                        <h5>3. Feed used</h5>
                        <p class="small text-muted mb-1">{{ t.feedingSessionsFed }} fed session{{ t.feedingSessionsFed === 1 ? '' : 's' }}, {{ t.feedingSessionsNotFed }} marked not fed. Sessions are recorded as AM or PM, with an optional time fed.</p>
                        @if (t.feedLots.length) {
                            <div class="table-responsive">
                                <table class="table table-sm small mb-3">
                                    <thead><tr><th>Product</th><th>Type</th><th>Lot</th><th>Supplier</th><th>First fed</th><th>Last fed</th><th class="text-right">Kg</th></tr></thead>
                                    <tbody>
                                        @for (l of t.feedLots; track $index) {
                                            <tr>
                                                <td>{{ l.product }}</td><td>{{ l.feedType || 'Not recorded' }}</td><td>{{ l.lotNumber || 'Not recorded' }}</td><td>{{ l.supplier || 'Not recorded' }}</td>
                                                <td>{{ l.firstFedOn ? (l.firstFedOn | farmDate) : '' }}</td><td>{{ l.lastFedOn ? (l.lastFedOn | farmDate) : '' }}</td><td class="text-right">{{ l.kg | num: 1 }}</td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                        } @else {
                            <p class="small text-muted">No feed recorded.</p>
                        }

                        <h5>4. Chemicals and supplements</h5>
                        @if (t.treatments.length) {
                            <div class="table-responsive">
                                <table class="table table-sm small mb-3">
                                    <thead><tr><th>Date</th><th>Product</th><th>Lot / supplier</th><th>Qty</th><th>Reason</th><th>Dose / method</th><th>Withdrawal</th><th>Safe harvest from</th><th>Prescription</th></tr></thead>
                                    <tbody>
                                        @for (x of t.treatments; track $index) {
                                            <tr>
                                                <td>{{ x.date | farmDate }}{{ x.endDate ? ' – ' + (x.endDate | farmDate) : '' }}</td>
                                                <td>{{ x.product || 'No stock drawn' }}{{ x.activeIngredient ? ' (' + x.activeIngredient + ')' : '' }}</td>
                                                <td>{{ x.lotNumber || '' }}{{ x.supplier ? ' · ' + x.supplier : '' }}</td>
                                                <td>{{ x.quantity || '' }}</td>
                                                <td>{{ x.reason || 'Not recorded' }}</td>
                                                <td>{{ x.dosage != null ? x.dosage + ' ' + (x.dosageUnit || '') : '' }}{{ x.method ? ' · ' + x.method : '' }}</td>
                                                <td>{{ x.withdrawalDays != null ? x.withdrawalDays + ' d' : 'Not recorded' }}</td>
                                                <td>{{ x.earliestSafeHarvestDate ? (x.earliestSafeHarvestDate | farmDate) : '' }}</td>
                                                <td>{{ x.prescriptionRef || '' }}</td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                        } @else {
                            <p class="small text-muted">None recorded.</p>
                        }

                        <h5>5. Harvest</h5>
                        @for (h of t.harvests; track h.harvestId) {
                            <div class="small mb-2">
                                <strong>{{ h.harvestedAtUtc | farmDateTime }}</strong> · {{ h.harvestType | label: L.HarvestTypes }} · {{ h.totalKg | num: 1 }} kg
                                {{ h.deadAtHarvest != null ? ' · ' + (h.deadAtHarvest | num: 0) + ' dead at harvest' : '' }}{{ h.finalCount != null ? ' · final count ' + (h.finalCount | num: 0) : '' }}
                                <div class="text-muted">
                                    @for (g of h.grades; track g.gradeLineId) { <span class="mr-3">{{ g.sizeLabel }}: {{ g.kg | num: 1 }} kg</span> }
                                </div>
                            </div>
                        } @empty {
                            <p class="small text-muted">No harvest recorded.</p>
                        }

                        <h5>6. Where it went</h5>
                        @if (t.sales.length) {
                            <div class="table-responsive">
                                <table class="table table-sm small mb-2">
                                    <thead><tr><th>Sale</th><th>Date</th><th>Buyer</th><th>Grade</th><th class="text-right">Farm kg</th><th class="text-right">Buyer kg</th><th>Transport</th></tr></thead>
                                    <tbody>
                                        @for (s of t.sales; track $index) {
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
                        @for (d of t.disposals; track $index) {
                            <div class="small">Not sold: {{ d.kg | num: 1 }} kg · {{ d.reason | label: L.DisposalReasons }}{{ d.note ? ' · ' + d.note : '' }}</div>
                        }
                        <p class="small mt-2 mb-0">
                            Harvested {{ t.harvestedKg | num: 1 }} kg · sold {{ t.soldKg | num: 1 }} kg · not sold {{ t.disposedKg | num: 1 }} kg ·
                            <strong>not accounted for {{ t.unaccountedKg | num: 1 }} kg</strong>
                        </p>
                        <p class="small text-muted border-top pt-2 mt-3 mb-0">Voided entries are not listed here; the activity log keeps them. This sheet reads the farm's records and is not an official certificate.</p>
                    </div>
                }
            </div>
        </section>
    `,
})
export class TraceReportComponent extends FpmsPage implements OnInit {
    t: any = null;
    batchId = '';

    ngOnInit(): void {
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        this.batchId = this.param('id') ?? '';
        this.t = null;
        this.t = await this.run(() => this.api.get<any>('Trace', 'GetBatchTrace', { batchId: this.batchId }));
        this.setPageTitle(this.t ? `Trace ${this.t.batchCode}` : null);
    }
}
