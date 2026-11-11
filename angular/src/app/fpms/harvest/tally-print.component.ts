import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { printPage } from '@shared/fpms/print-page';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * Printable Harvest Tally Sheet (DEC-82), laid out like the farm's paper sheet: customer, pond, date, ABW and its sample,
 * the crates in columns of 30, total kilos, and the price and amount of each sale of this harvest, with lines to sign at the
 * pond. Without a crate tally it prints the total only; without sales (or for users who cannot see sales) the price block
 * is left blank to fill in by hand.
 *
 * Layout (DEC-85 step 6): the letterhead and boxed lot code shared with the dispatch receipt, the crate tally in ruled
 * blocks with a subtotal each, tare as separate columns, a boxed summary, A4 portrait with page numbers.
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
                    <div class="fpms-paper fpms-print-doc fpms-doc">
                        <div class="fpms-doc-head">
                            <div>
                                <div class="fpms-doc-farm">{{ t.farmName }}</div>
                                <div class="small">{{ t.farmAddress }}</div>
                                @if (t.farmContact) { <div class="small">{{ t.farmContact }}</div> }
                            </div>
                            <div class="text-right">
                                <div class="fpms-doc-title">HARVEST TALLY SHEET</div>
                                <div class="small">Date: <strong>{{ h.harvestedAtUtc | farmDateTime }}</strong></div>
                                <div class="small">{{ h.harvestType === 2 ? 'Total' : 'Partial' }} harvest</div>
                            </div>
                        </div>
                        <div class="fpms-doc-meta">
                            <div class="fpms-doc-fields">
                                <span>Name of customer</span>
                                <div [class.blank]="!t.buyerName"><strong>{{ t.buyerName }}</strong></div>
                                <span>Address</span>
                                <div [class.blank]="!t.buyerAddress">{{ t.buyerAddress }}</div>
                                <span>Pond · batch</span>
                                <div><strong>{{ h.pondCode }}</strong> · {{ h.batchCode }}</div>
                                @if (h.weighedBy) {
                                    <span>Weighed on</span>
                                    <div>The {{ h.weighedBy === 2 ? "buyer's" : "farm's" }} scale</div>
                                }
                            </div>
                            <div class="fpms-lot-box">
                                <span>Lot code</span>
                                <strong>{{ h.lotCode }}</strong>
                            </div>
                        </div>

                        @if (h.crates.length) {
                            @for (band of bands(); track $index) {
                                <table class="fpms-doc-table fpms-doc-crates">
                                    <caption class="sr-only">Crate tally</caption>
                                    <thead>
                                        <tr>
                                            @for (col of band; track $index) {
                                                <th scope="col" class="num blk">No.</th>
                                                @if (showDetail()) { <th scope="col">{{ hasGrades() ? 'Grade' : 'Type' }}</th> }
                                                @if (hasTare()) {
                                                    <th scope="col" class="num">Scale kg</th>
                                                    <th scope="col" class="num">Crate kg</th>
                                                }
                                                <th scope="col" class="num">{{ hasTare() ? 'Shrimp kg' : 'Kg' }}</th>
                                            }
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @for (r of rowIndexes(band); track r) {
                                            <tr>
                                                @for (col of band; track $index) {
                                                    @if (col[r]; as c) {
                                                        <td class="num blk">{{ c.crateNo }}</td>
                                                        @if (showDetail()) { <td class="detail">{{ hasGrades() ? (c.sizeLabel || 'Ungraded') : (c.containerName || '') }}</td> }
                                                        @if (hasTare()) {
                                                            <td class="num">{{ (c.grossKg ?? c.kg) | num: 2 }}</td>
                                                            <td class="num">{{ c.tareKg ? (c.tareKg | num: 2) : '—' }}</td>
                                                        }
                                                        <td class="num">{{ c.kg | num: 2 }}</td>
                                                    } @else {
                                                        <td class="blk" [attr.colspan]="blockSpan()"></td>
                                                    }
                                                }
                                            </tr>
                                        }
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            @for (col of band; track $index) {
                                                <td class="blk" [attr.colspan]="blockSpan() - 1">Crates {{ col[0].crateNo }}–{{ col[col.length - 1].crateNo }}</td>
                                                <td class="num">{{ blockKg(col) | num: 2 }}</td>
                                            }
                                        </tr>
                                    </tfoot>
                                </table>
                            }
                        } @else {
                            <p class="small text-muted">Weighed as a total only; no crate tally was recorded.</p>
                        }

                        <div class="fpms-doc-summary">
                            <div>
                                <span>Crates</span>
                                <strong>{{ h.crates.length ? h.crates.length : h.boxes != null ? h.boxes : '—' }}</strong>
                                @if (tareTotal() > 0) { <small>{{ tareTotal() | num: 2 }} kg of crate weight subtracted</small> }
                            </div>
                            <div class="main">
                                <span>Total kilos</span>
                                <strong>{{ h.totalKg | num: 2 }} kg</strong>
                            </div>
                            <div>
                                <span>ABW</span>
                                <strong>{{ h.abwG != null ? (h.abwG | num: 2) + ' g' : '—' }}</strong>
                                @if (h.abwSampleWeightG) { <small>{{ h.abwSampleWeightG | num: 0 }} g ÷ {{ h.abwSamplePieces | num: 0 }} pcs</small> }
                            </div>
                        </div>
                        @if (h.gradeLines.length > 1 || hasGrades()) {
                            <table class="fpms-doc-table" style="max-width: 22rem">
                                <caption class="sr-only">Kilograms per size grade</caption>
                                <thead><tr><th scope="col">Size grade</th><th scope="col" class="num">Kg</th></tr></thead>
                                <tbody>
                                    @for (g of h.gradeLines; track g.id) {
                                        <tr><td>{{ g.sizeLabel }}</td><td class="num">{{ g.kg | num: 2 }}</td></tr>
                                    }
                                </tbody>
                            </table>
                        }

                        @if (t.showsSales && t.sales.length) {
                            @for (s of t.sales; track s.saleId) {
                                <table class="fpms-doc-table">
                                    <caption class="text-left small font-weight-bold" style="caption-side: top; color: #111">{{ s.buyerName }} · dispatch receipt {{ s.dispatchReceiptNo }} · {{ s.saleDate | farmDate }}</caption>
                                    <thead>
                                        <tr><th scope="col">Grade</th><th scope="col" class="num">Kg</th><th scope="col" class="num">Price per kilo</th><th scope="col" class="num">Amount</th></tr>
                                    </thead>
                                    <tbody>
                                        @for (l of s.lines; track l.id) {
                                            <tr>
                                                <td>{{ l.sizeLabel }}</td>
                                                <td class="num">{{ (l.buyerAcceptedKg ?? l.kg) | num: 2 }}</td>
                                                <td class="num">
                                                    {{ l.pricePerKg | php }}
                                                    @switch (l.priceMethod) {
                                                        @case (2) { <div class="working">base {{ l.basePricePerKg | php }} at {{ l.baseAbwG | num: 2 }} g + {{ l.stepPerG | php }}/g</div> }
                                                        @case (3) { <div class="working">base {{ l.basePricePerKg | php }} at {{ l.baseCountPerKg }} pcs + {{ l.stepPerCount | php }}/piece; count {{ l.priceCountPerKg }}</div> }
                                                        @case (4) { <div class="working">{{ l.priceTableName }}, {{ l.priceTableRowLabel }}</div> }
                                                    }
                                                </td>
                                                <td class="num">{{ l.amount | php }}</td>
                                            </tr>
                                        }
                                    </tbody>
                                    <tfoot><tr><td>Total</td><td class="num">{{ s.kg | num: 2 }}</td><td></td><td class="num">{{ s.amount | php }}</td></tr></tfoot>
                                </table>
                            }
                            @if (t.sales.length > 1) { <p class="font-weight-bold text-right">TOTAL AMOUNT: {{ salesTotal() | php }}</p> }
                        } @else {
                            <div class="fpms-doc-fields mb-3" style="max-width: 24rem">
                                <span>Agreed base price</span>
                                <div class="blank"></div>
                                <span>Price per kilo</span>
                                <div class="blank"></div>
                                <span>Total amount</span>
                                <div class="blank"></div>
                            </div>
                        }

                        <div class="row mt-5 mb-3 small fpms-doc-signs">
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
})
export class TallyPrintComponent extends FpmsPage implements OnInit {
    /** Rows per crate column, as on the paper sheet (1–30, 31–60, …). */
    private readonly perColumn = 30;
    t: any = null;
    private readonly setFooter = printPage('fpms-tally-page');

    get h(): any {
        return this.t?.harvest;
    }

    ngOnInit(): void {
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        this.t = await this.api.get<any>('TallySheet', 'GetPrint', { harvestId: this.param('id') });
        const h = this.t?.harvest;
        this.setFooter(h ? `${this.t.farmName} · Harvest tally sheet${h.lotCode ? ', lot ' + h.lotCode : ''}` : 'Harvest tally sheet');
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

    /** True when any crate was weighed with its container, so scale, crate and shrimp kg print as separate columns. */
    hasTare(): boolean {
        return (this.h?.crates ?? []).some((c: any) => c.tareKg > 0);
    }

    /** Columns one block of crates takes: number, optional grade or type, optional scale and crate kg, and the kg. */
    blockSpan(): number {
        return 2 + (this.showDetail() ? 1 : 0) + (this.hasTare() ? 2 : 0);
    }

    /** The crate blocks in rows of as many as fit the page width; each row is its own table with its own heading. */
    bands(): any[][][] {
        const perBand = Math.max(2, Math.floor(15 / this.blockSpan()));
        const cols = this.columns();
        const out: any[][][] = [];
        for (let i = 0; i < cols.length; i += perBand) {
            out.push(cols.slice(i, i + perBand));
        }
        return out;
    }

    rowIndexes(band: any[][]): number[] {
        const n = Math.max(0, ...band.map((col) => col.length));
        return Array.from({ length: n }, (_, i) => i);
    }

    blockKg(col: any[]): number {
        return col.reduce((s: number, c: any) => s + (Number(c.kg) || 0), 0);
    }

    tareTotal(): number {
        return (this.h?.crates ?? []).reduce((s: number, c: any) => s + (c.tareKg || 0), 0);
    }

    salesTotal(): number {
        return (this.t?.sales ?? []).reduce((s: number, x: any) => s + x.amount, 0);
    }
}
