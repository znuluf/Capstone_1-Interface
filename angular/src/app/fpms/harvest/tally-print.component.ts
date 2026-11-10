import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * Printable Harvest Tally Sheet (DEC-82), laid out like the farm's paper sheet: customer, pond, date, ABW and its sample,
 * the crates in columns of 30, total kilos, and the price and amount of each sale of this harvest, with lines to sign at the
 * pond. Without a crate tally it prints the total only; without sales (or for users who cannot see sales) the price block
 * is left blank to fill in by hand.
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Harvest tally sheet" [subtitle]="t ? t.harvest.pondCode + ' · ' + t.harvest.batchCode : ''" [backLink]="t ? '/app/harvests/' + t.harvest.id : '/app/harvests'" backLabel="Harvest">
            @if (t && t.harvest.lotCode && can('Farm.Reports')) {
                <a class="btn btn-outline-secondary mr-1" [routerLink]="['/app/reports/trace/lot', t.harvest.lotCode]" [queryParams]="{ from: 'harvests' }"><i class="fas fa-project-diagram mr-1"></i>Trace this lot</a>
            }
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
                        <div class="text-center mb-2">
                            <h5 class="mb-0">{{ t.farmName }}</h5>
                            <div class="small">{{ t.farmAddress }}{{ t.farmContact ? ' · ' + t.farmContact : '' }}</div>
                            <h4 class="mt-2 mb-0 font-weight-bold">HARVEST TALLY SHEET</h4>
                        </div>
                        <div class="row small mb-2">
                            <div class="col-7">
                                <div>Name of customer: <strong>{{ t.buyerName || '________________________' }}</strong></div>
                                <div>Address: {{ t.buyerAddress || '________________________' }}</div>
                                <div>Pond no.: <strong>{{ h.pondCode }}</strong> · Batch {{ h.batchCode }} · {{ h.harvestType === 2 ? 'Total' : 'Partial' }} harvest</div>
                            </div>
                            <div class="col-5 text-right">
                                <div>Lot code: <strong class="text-monospace">{{ h.lotCode || '______________' }}</strong></div>
                                <div>Date: <strong>{{ h.harvestedAtUtc | farmDateTime }}</strong></div>
                                <div>ABW: <strong>{{ h.abwG != null ? (h.abwG | num: 2) + ' g' : '______' }}</strong>
                                    @if (h.abwSampleWeightG) { ({{ h.abwSampleWeightG | num: 0 }} g ÷ {{ h.abwSamplePieces | num: 0 }} pcs) }
                                </div>
                                @if (h.weighedBy) { <div>Weighed on the {{ h.weighedBy === 2 ? "buyer's" : "farm's" }} scale</div> }
                            </div>
                        </div>

                        @if (h.crates.length) {
                            <div class="table-responsive">
                                <table class="table table-bordered table-sm small text-center mb-2 tally-grid">
                                    <thead>
                                        <tr>
                                            @for (c of columns(); track $index) {
                                                <th>Crate no.</th>
                                                @if (showDetail()) { <th>{{ hasGrades() ? 'Grade' : 'Type' }}</th> }
                                                <th>Weight (kg)</th>
                                            }
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @for (r of rowIndexes(); track r) {
                                            <tr>
                                                @for (col of columns(); track $index) {
                                                    @if (col[r]; as c) {
                                                        <td>{{ c.crateNo }}</td>
                                                        @if (showDetail()) { <td class="text-truncate" style="max-width: 6rem">{{ hasGrades() ? (c.sizeLabel || 'Ungraded') : (c.containerName || '') }}</td> }
                                                        <td class="text-right">{{ c.grossKg != null ? (c.grossKg | num: 2) + ' − ' + (c.tareKg | num: 2) : (c.kg | num: 2) }}</td>
                                                    } @else {
                                                        <td></td>
                                                        @if (showDetail()) { <td></td> }
                                                        <td></td>
                                                    }
                                                }
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                        } @else {
                            <p class="small text-muted">Weighed as a total only; no crate tally was recorded.</p>
                        }

                        <div class="row mb-2">
                            <div class="col-6">
                                <div>TOTAL KILOS: <strong>{{ h.totalKg | num: 3 }} kg</strong></div>
                                @if (h.crates.length) { <div class="small">{{ h.crates.length }} crate(s){{ tareTotal() > 0 ? '; ' + (tareTotal() | num: 2) + ' kg of crate weight subtracted' : '' }}</div> }
                                @if (h.gradeLines.length > 1 || hasGrades()) {
                                    <div class="small">
                                        @for (g of h.gradeLines; track g.id) { <span class="mr-2">{{ g.sizeLabel }}: {{ g.kg | num: 3 }} kg</span> }
                                    </div>
                                }
                            </div>
                        </div>

                        @if (t.showsSales && t.sales.length) {
                            @for (s of t.sales; track s.saleId) {
                                <table class="table table-sm small mb-2">
                                    <thead>
                                        <tr><th colspan="4">{{ s.buyerName }} · dispatch receipt {{ s.dispatchReceiptNo }} · {{ s.saleDate | farmDate }}</th></tr>
                                        <tr><th>Grade</th><th class="text-right">Kg</th><th class="text-right">Price per kilo</th><th class="text-right">Amount</th></tr>
                                    </thead>
                                    <tbody>
                                        @for (l of s.lines; track l.id) {
                                            <tr>
                                                <td>{{ l.sizeLabel }}</td>
                                                <td class="text-right">{{ (l.buyerAcceptedKg ?? l.kg) | num: 3 }}</td>
                                                <td class="text-right">
                                                    {{ l.pricePerKg | php }}
                                                    @switch (l.priceMethod) {
                                                        @case (2) { <div class="text-muted">base {{ l.basePricePerKg | php }} at {{ l.baseAbwG | num: 0 }} g + {{ l.stepPerG | php }}/g</div> }
                                                        @case (3) { <div class="text-muted">base {{ l.basePricePerKg | php }} at {{ l.baseCountPerKg }} pcs + {{ l.stepPerCount | php }}/piece; count {{ l.priceCountPerKg }}</div> }
                                                        @case (4) { <div class="text-muted">{{ l.priceTableName }}, {{ l.priceTableRowLabel }}</div> }
                                                    }
                                                </td>
                                                <td class="text-right">{{ l.amount | php }}</td>
                                            </tr>
                                        }
                                    </tbody>
                                    <tfoot><tr class="font-weight-bold"><td>Total</td><td class="text-right">{{ s.kg | num: 3 }}</td><td></td><td class="text-right">{{ s.amount | php }}</td></tr></tfoot>
                                </table>
                            }
                            @if (t.sales.length > 1) { <p class="font-weight-bold text-right">TOTAL AMOUNT: {{ salesTotal() | php }}</p> }
                        } @else {
                            <div class="row small mb-2">
                                <div class="col-6">
                                    <div class="mb-2">Agreed base price: ____________________</div>
                                    <div class="mb-2">Price per kilo: ____________________</div>
                                    <div>TOTAL AMOUNT: ____________________</div>
                                </div>
                            </div>
                        }

                        <div class="row mt-5 mb-3 small">
                            <div class="col-4"><div class="fpms-sign">Weighed by</div></div>
                            <div class="col-4"><div class="fpms-sign">Checked by (farm)</div></div>
                            <div class="col-4"><div class="fpms-sign">Customer / representative</div></div>
                        </div>
                        <p class="small text-center text-muted mb-0">Recorded by {{ h.recordedBy }} on {{ h.creationTime | farmDateTime }}. Tally sheet for the farm's records; not an official receipt.</p>
                    </div>
                }
            </div>
        </section>
    `,
    styles: [
        `
            .tally-grid td,
            .tally-grid th {
                padding: 0.1rem 0.25rem;
            }
        `,
    ],
})
export class TallyPrintComponent extends FpmsPage implements OnInit {
    /** Rows per crate column, as on the paper sheet (1–30, 31–60, …). */
    private readonly perColumn = 30;
    t: any = null;

    get h(): any {
        return this.t?.harvest;
    }

    ngOnInit(): void {
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        this.t = await this.api.get<any>('TallySheet', 'GetPrint', { harvestId: this.param('id') });
        this.setPageTitle(this.t ? `Tally sheet ${this.t.harvest.pondCode} ${this.t.harvest.batchCode}` : null);
    }

    hasGrades(): boolean {
        return (this.h?.crates ?? []).some((c: any) => c.sizeGradeId);
    }

    /** A second column per crate: its grade when graded, else its crate type when any has one. */
    showDetail(): boolean {
        return this.hasGrades() || (this.h?.crates ?? []).some((c: any) => c.containerName);
    }

    columns(): any[][] {
        const crates = this.h?.crates ?? [];
        const cols: any[][] = [];
        for (let i = 0; i < crates.length; i += this.perColumn) {
            cols.push(crates.slice(i, i + this.perColumn));
        }
        return cols;
    }

    rowIndexes(): number[] {
        const n = Math.min(this.perColumn, (this.h?.crates ?? []).length);
        return Array.from({ length: n }, (_, i) => i);
    }

    tareTotal(): number {
        return (this.h?.crates ?? []).reduce((s: number, c: any) => s + (c.tareKg || 0), 0);
    }

    salesTotal(): number {
        return (this.t?.sales ?? []).reduce((s: number, x: any) => s + x.amount, 0);
    }
}
