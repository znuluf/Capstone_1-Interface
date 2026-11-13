import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { CrateGridComponent, GridCrate } from '@shared/fpms/crate-grid.component';
import { printPage } from '@shared/fpms/print-page';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * Dispatch receipt (Ref 7.3, D-18, DEC-55): the farm's numbered internal record of what left the farm, with the
 * BFAR registration number, transport details and payments. Priced lines show their terms (DEC-80, DEC-82). Not an official
 * receipt or invoice.
 *
 * Layout (DEC-85 step 6): the letterhead and boxed lot code shared with the tally sheet, a ruled lines table with the lot
 * code in its own column, "Buyer kg" only when one was recorded, transport as a labelled grid, A4 portrait with page
 * numbers, and a Buyer copy / Farm copy switch (the farm copy adds how each price was worked out).
 */
@Component({
    standalone: true,
    imports: [...FPMS_IMPORTS, CrateGridComponent],
    template: `
        <fpms-page-header title="Dispatch receipt" [subtitle]="s ? s.dispatchReceiptNo + ' · ' + s.buyerName : ''" backLink="/app/sales" backLabel="Sales">
            @if (s) {
                @if (can('Farm.Reports')) {
                    @for (b of tracedBatches(); track b.id) {
                        <a class="btn btn-outline-secondary mr-1" [routerLink]="['/app/reports/trace', b.id]" [queryParams]="{ from: 'sales' }">Trace report{{ tracedBatches().length > 1 ? ' · ' + b.label : '' }}</a>
                    }
                }
                <a class="btn btn-outline-secondary mr-1" [routerLink]="['/app/sales', s.id, 'tally']"><i class="fas fa-clipboard-list mr-1" aria-hidden="true"></i>Buyer's tally sheet</a>
                <a class="btn btn-outline-primary mr-1" [routerLink]="['/app/sales', s.id, 'edit']">Edit</a>
                @if (canManage) {
                    <button class="btn btn-outline-danger mr-1" (click)="voiding = { reason: '' }">Void</button>
                }
                <div class="btn-group mr-1" role="group" aria-label="Which copy to print">
                    <button type="button" class="btn btn-outline-secondary" [class.active]="copy === 'buyer'" [attr.aria-pressed]="copy === 'buyer'" (click)="copy = 'buyer'">Buyer copy</button>
                    <button type="button" class="btn btn-outline-secondary" [class.active]="copy === 'farm'" [attr.aria-pressed]="copy === 'farm'" (click)="copy = 'farm'" title="Shows how each price was worked out">Farm copy</button>
                </div>
                <button class="btn btn-primary" (click)="print()"><i class="fas fa-print mr-1"></i>Print</button>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (!s) {
                    <fpms-loading></fpms-loading>
                } @else {
                    @if (voiding) {
                        <div class="card card-outline card-danger d-print-none">
                            <div class="card-body">
                                <label for="vr">Why is this sale void? <span class="text-danger">*</span></label>
                                <input id="vr" class="form-control" [(ngModel)]="voiding.reason" maxlength="200" placeholder="e.g. entered twice, buyer cancelled" />
                                <small class="form-text text-muted">Its kilograms become unsold again. The number {{ s.dispatchReceiptNo }} is not reused.</small>
                            </div>
                            <div class="card-footer">
                                <button class="btn btn-danger mr-2" [disabled]="busy() || !voiding.reason.trim()" (click)="voidSale()">Void sale</button>
                                <button class="btn btn-default" (click)="voiding = null">Cancel</button>
                            </div>
                        </div>
                    }
                    <div class="fpms-paper fpms-print-doc fpms-doc">
                        <div class="fpms-doc-head">
                            <div>
                                <div class="fpms-doc-farm">{{ s.farmName }}</div>
                                <div class="small">{{ s.farmAddress }}</div>
                                @if (s.farmContact) { <div class="small">{{ s.farmContact }}</div> }
                                <div class="small">BFAR registration no.: {{ s.bfarRegistrationNo || '—' }}</div>
                                @if (s.sfscNos) {
                                    <div class="small">Shrimp Fry Source Certificate no.: {{ s.sfscNos }}</div>
                                }
                            </div>
                            <div class="text-right">
                                <div class="fpms-doc-title">DISPATCH RECEIPT</div>
                                <div><strong>No. {{ s.dispatchReceiptNo }}</strong></div>
                                <div class="small">Date: <strong>{{ s.saleDate | farmDate }}</strong></div>
                                @if (s.dueDate) { <div class="small">Due: {{ s.dueDate | farmDate }}</div> }
                                <div class="fpms-doc-copy">{{ copy === 'farm' ? 'Farm copy' : 'Buyer copy' }}</div>
                            </div>
                        </div>
                        <div class="fpms-doc-meta">
                            <div class="fpms-doc-fields">
                                <span>Buyer</span>
                                <div>
                                    <strong>{{ s.buyerName }}</strong>
                                    @if (s.buyerContact || s.buyerPhone) { <div class="small">{{ s.buyerContact }} {{ s.buyerPhone ? '· ' + s.buyerPhone : '' }}</div> }
                                    @if (s.buyerAddress) { <div class="small">{{ s.buyerAddress }}</div> }
                                </div>
                                <span>Source</span>
                                <div>{{ s.batches }}</div>
                            </div>
                            <div class="fpms-lot-box">
                                <span>{{ lots().length > 1 ? 'Lot codes' : 'Lot code' }}</span>
                                @for (c of lots(); track c) {
                                    <strong>{{ c }}</strong>
                                } @empty {
                                    <strong>—</strong>
                                }
                            </div>
                        </div>
                        <table class="fpms-doc-table">
                            <caption class="sr-only">What was sold</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Lot code</th>
                                    <th scope="col">Harvest</th>
                                    <th scope="col">Size</th>
                                    <th scope="col" class="num">{{ hasBuyerKg() ? 'Farm kg' : 'Kg' }}</th>
                                    @if (hasBuyerKg()) { <th scope="col" class="num">Buyer kg</th> }
                                    <th scope="col" class="num">Price per kg</th>
                                    <th scope="col" class="num">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (l of s.lines; track l.id) {
                                    <tr>
                                        <td class="text-monospace text-nowrap">
                                            {{ l.lotCode || '—' }}
                                            @if (l.lotCode && can('Farm.Reports')) { <a class="no-print d-block small" [routerLink]="['/app/reports/trace/lot', l.lotCode]" [queryParams]="{ from: 'sales' }">Trace this lot</a> }
                                        </td>
                                        <td>{{ l.harvestedAtUtc | farmDayOf }} · {{ l.pondCode }} · {{ l.batchCode }}</td>
                                        <td>{{ l.sizeLabel }}</td>
                                        <td class="num">{{ l.kg | num: 2 }}</td>
                                        @if (hasBuyerKg()) { <td class="num">{{ l.buyerAcceptedKg != null ? (l.buyerAcceptedKg | num: 2) : '—' }}</td> }
                                        <td class="num">
                                            {{ l.pricePerKg | php }}
                                            @if (copy === 'farm') {
                                                @switch (l.priceMethod) {
                                                    @case (2) { <div class="working">{{ l.basePricePerKg | php }} at {{ l.baseAbwG | num: 2 }} g + {{ l.stepPerG | php }}/g; ABW {{ l.priceAbwG | num: 2 }} g</div> }
                                                    @case (3) { <div class="working">{{ l.basePricePerKg | php }} at {{ l.baseCountPerKg }} pcs/kg + {{ l.stepPerCount | php }} per piece fewer; count {{ l.priceCountPerKg }}</div> }
                                                    @case (4) { <div class="working">{{ l.priceTableName }}, {{ l.priceTableRowLabel }}; count {{ l.priceCountPerKg }}</div> }
                                                }
                                            }
                                        </td>
                                        <td class="num">{{ l.amount | php }}</td>
                                    </tr>
                                }
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3">Total</td>
                                    <td class="num">{{ s.totalKg | num: 2 }}</td>
                                    @if (hasBuyerKg()) { <td class="num">{{ s.totalBuyerKg != null ? (s.totalBuyerKg | num: 2) : '' }}</td> }
                                    <td></td>
                                    <td class="num">{{ s.total | php }}</td>
                                </tr>
                                <tr class="plain"><td [attr.colspan]="hasBuyerKg() ? 6 : 5" class="num">Paid</td><td class="num">{{ s.paid | php }}</td></tr>
                                <tr class="plain"><td [attr.colspan]="hasBuyerKg() ? 6 : 5" class="num">{{ s.overpaid > 0 ? 'Overpaid' : 'Balance' }}</td><td class="num"><strong>{{ (s.overpaid > 0 ? s.overpaid : s.balance) | php }}</strong></td></tr>
                            </tfoot>
                        </table>
                        <p class="small mb-2">
                            {{ hasBuyerKg() ? "Amounts use the buyer's weight where one is shown, otherwise the farm's weight." : 'Amounts are on the weight shown.' }}
                            Payment terms: {{ s.paymentTerms || '—' }} · Status: {{ s.paymentStatus | label: L.PaymentStatuses }}
                            @if (s.isOverdue) { <strong class="text-danger"> · Overdue</strong> }
                        </p>
                        @if (s.payments.length) {
                            <table class="fpms-doc-table">
                                <caption class="sr-only">Payments received</caption>
                                <thead><tr><th scope="col">Payment date</th><th scope="col">Method</th><th scope="col">Note</th><th scope="col" class="num">Amount</th><th class="d-print-none"><span class="sr-only">Actions</span></th></tr></thead>
                                <tbody>
                                    @for (p of s.payments; track p.id) {
                                        <tr>
                                            <td>{{ p.paidOn | farmDate }}</td>
                                            <td>{{ p.method || '—' }}</td>
                                            <td>{{ p.note }}</td>
                                            <td class="num">{{ p.amount | php }}</td>
                                            <td class="num d-print-none">
                                                @if (canManage) {
                                                    <button class="btn btn-xs btn-link text-danger p-0" [disabled]="busy()" (click)="removePayment(p)">Remove</button>
                                                }
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        }
                        @for (g of crateGroups; track g.harvestId) {
                            <div class="fpms-doc-section">Crate tally{{ g.lotCode ? ' · lot ' + g.lotCode : '' }}</div>
                            <fpms-crate-grid [crates]="g.crates" [gradeSummary]="true"></fpms-crate-grid>
                        }
                        @if (hasTransport()) {
                            <div class="fpms-doc-grid">
                                <div><span>Transporter</span>{{ s.transporter || '—' }}</div>
                                <div><span>Driver</span>{{ s.driverName || '—' }}</div>
                                <div><span>Plate no.</span>{{ s.plateNo || '—' }}</div>
                                <div><span>Loaded</span>{{ s.loadedAtUtc ? (s.loadedAtUtc | farmDateTime) : '—' }}</div>
                                <div><span>Destination</span>{{ s.destination || '—' }}</div>
                                <div><span>Transport permit no.</span>{{ s.localTransportPermitNo || '—' }}</div>
                                <div><span>Temperature / icing</span>{{ s.temperatureNote || '—' }}</div>
                            </div>
                        }
                        <div class="row mt-5 mb-3 small fpms-doc-signs">
                            <div class="col-4"><div class="fpms-sign">Released by (farm)</div></div>
                            <div class="col-4"><div class="fpms-sign">Driver</div></div>
                            <div class="col-4"><div class="fpms-sign">Received by (buyer)</div></div>
                        </div>
                        <p class="small text-center border-top pt-2 mb-0"><strong>{{ s.documentNotice }}</strong></p>
                        <p class="small text-center text-muted mb-0">Recorded by {{ s.recordedBy }} on {{ s.creationTime | farmDateTime }}</p>
                    </div>
                }
            </div>
        </section>
    `,
})
export class SalePrintComponent extends FpmsPage implements OnInit {
    /** The batches this receipt sold from, for the Trace report link (one button per batch). */
    tracedBatches(): { id: string; label: string }[] {
        const seen = new Map<string, string>();
        for (const l of this.s?.lines ?? []) {
            if (!seen.has(l.batchId)) {
                seen.set(l.batchId, `${l.pondCode} ${l.batchCode}`);
            }
        }
        return Array.from(seen, ([id, label]) => ({ id, label }));
    }

    s: any = null;
    voiding: any = null;
    /** Which copy shows (DEC-85 step 6): the buyer copy has the agreed prices only; the farm copy adds their workings. */
    copy: 'buyer' | 'farm' = 'buyer';
    private readonly setFooter = printPage('fpms-receipt-page');

    /** The crates dispatched on this receipt (DEC-86), one group per harvest, for the crate tally grid. */
    crateGroups: any[] = [];

    private buildCrateGroups(): any[] {
        const byHarvest = new Map<string, any[]>();
        for (const c of this.s?.crates ?? []) {
            byHarvest.set(c.harvestId, [...(byHarvest.get(c.harvestId) ?? []), c]);
        }
        return Array.from(byHarvest, ([harvestId, crates]) => {
            const graded = crates.some((c: any) => c.sizeGradeId);
            return {
                harvestId,
                lotCode: crates[0].lotCode,
                crates: crates.map((c: any): GridCrate => ({ crateNo: c.crateNo, kg: c.kg, tareKg: c.tareKg, sizeLabel: graded ? c.sizeLabel || 'Ungraded' : null })),
            };
        });
    }

    /** The lot codes this receipt sold from, for the box at the top. */
    lots(): string[] {
        return Array.from(new Set<string>((this.s?.lines ?? []).map((l: any) => l.lotCode).filter((c: any) => !!c)));
    }

    /** True when a buyer's re-weighed kg was recorded on any line; only then does the "Buyer kg" column print. */
    hasBuyerKg(): boolean {
        return (this.s?.lines ?? []).some((l: any) => l.buyerAcceptedKg != null);
    }
    canManage = false;

    ngOnInit(): void {
        this.canManage = this.can('Farm.Production.Manage');
        // Detail routes reuse this component when only the :id changes, so reload on every change.
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        this.voiding = null;
        this.s = await this.api.get<any>('Sale', 'Get', { id: this.param('id') });
        this.copy = 'buyer';
        this.crateGroups = this.buildCrateGroups();
        this.setFooter(this.s ? `${this.s.farmName} · Dispatch receipt ${this.s.dispatchReceiptNo}` : 'Dispatch receipt');
        this.setPageTitle(this.s ? `Dispatch receipt ${this.s.dispatchReceiptNo}` : null);
    }

    hasTransport(): boolean {
        const s = this.s;
        return !!(s.transporter || s.driverName || s.plateNo || s.loadedAtUtc || s.destination || s.localTransportPermitNo || s.temperatureNote);
    }

    async removePayment(p: any): Promise<void> {
        if (!(await this.confirm(`Remove the ${p.paidOn} payment of ₱${p.amount}?`))) return;
        let sale: any;
        if (await this.act(async () => (sale = await this.api.delete<any>('Sale', 'RemovePayment', { id: p.id })))) {
            this.notifySaved('Payment removed.');
            this.s = sale;
        }
    }

    async voidSale(): Promise<void> {
        if (await this.act(() => this.api.post('Sale', 'Void', { id: this.s.id, reason: this.voiding.reason.trim() }))) {
            this.notifySaved(`Sale ${this.s.dispatchReceiptNo} voided.`);
            this.router.navigate(['/app/sales'], { replaceUrl: true });
        }
    }
}
