import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { CrateGridComponent, GridCrate } from '@shared/fpms/crate-grid.component';
import { printPage } from '@shared/fpms/print-page';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * The buyer's harvest tally sheet (DEC-86): the farm's tally sheet cut down to one sale, so the buyer takes away proof of
 * their own load and nothing of another buyer's. One sheet per harvest the sale took from (usually one): the buyer as the
 * customer, the lot code, only the crates on this sale, the grades, kilos, price and amount, and lines to sign. Price
 * workings stay on the farm's copy of the dispatch receipt.
 */
@Component({
    standalone: true,
    imports: [...FPMS_IMPORTS, CrateGridComponent],
    template: `
        <fpms-page-header title="Buyer's tally sheet" [subtitle]="s ? s.buyerName + ' · ' + s.dispatchReceiptNo : ''" [backLink]="s ? ['/app/sales', s.id] : '/app/sales'" backLabel="Dispatch receipt">
            @if (s) {
                <button class="btn btn-primary" (click)="print()"><i class="fas fa-print mr-1"></i>Print</button>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (!s) {
                    <fpms-loading></fpms-loading>
                } @else {
                    @for (g of sheets; track g.harvestId) {
                        <div class="fpms-paper fpms-print-doc fpms-doc">
                            <div class="fpms-doc-head">
                                <div>
                                    <div class="fpms-doc-farm">{{ s.farmName }}</div>
                                    <div class="small">{{ s.farmAddress }}</div>
                                    @if (s.farmContact) { <div class="small">{{ s.farmContact }}</div> }
                                </div>
                                <div class="text-right">
                                    <div class="fpms-doc-title">HARVEST TALLY SHEET</div>
                                    <div class="small">Date: <strong>{{ g.harvestedAtUtc | farmDateTime }}</strong></div>
                                    @if (g.harvestType) { <div class="small">{{ g.harvestType === 2 ? 'Final' : 'Partial' }} harvest</div> }
                                    <div class="fpms-doc-copy">Buyer's copy</div>
                                </div>
                            </div>
                            <div class="fpms-doc-meta">
                                <div class="fpms-doc-fields">
                                    <span>Name of customer</span>
                                    <div><strong>{{ s.buyerName }}</strong></div>
                                    <span>Address</span>
                                    <div [class.blank]="!s.buyerAddress">{{ s.buyerAddress }}</div>
                                    <span>Pond · batch</span>
                                    <div><strong>{{ g.pondCode }}</strong> · {{ g.batchCode }}</div>
                                    <span>Dispatch receipt</span>
                                    <div>{{ s.dispatchReceiptNo }} · {{ s.saleDate | farmDate }}</div>
                                    @if (g.weighedBy) {
                                        <span>Weighed on</span>
                                        <div>The {{ g.weighedBy === 2 ? "buyer's" : "farm's" }} scale</div>
                                    }
                                </div>
                                <div class="fpms-lot-box">
                                    <span>Lot code</span>
                                    <strong>{{ g.lotCode || '—' }}</strong>
                                </div>
                            </div>

                            @if (g.crates.length) {
                                <fpms-crate-grid [crates]="g.crates" [gradeSummary]="true"></fpms-crate-grid>
                            } @else {
                                <p class="small text-muted">No crates were marked for this sale, so only the kilos sold are listed. Mark them under "Crates for this buyer" when editing the sale.</p>
                            }

                            <div class="fpms-doc-summary">
                                <div>
                                    <span>Crates</span>
                                    <strong>{{ g.crates.length || '—' }}</strong>
                                </div>
                                <div class="main">
                                    <span>Total kilos</span>
                                    <strong>{{ g.kg | num: 2 }} kg</strong>
                                    @if (g.buyerKg !== null) { <small>{{ g.buyerKg | num: 2 }} kg on the buyer's weighing</small> }
                                </div>
                                <div>
                                    <span>ABW</span>
                                    <strong>{{ g.abwG != null ? (g.abwG | num: 2) + ' g' : '—' }}</strong>
                                </div>
                            </div>

                            <table class="fpms-doc-table">
                                <caption class="sr-only">Grades, kilos, price and amount</caption>
                                <thead>
                                    <tr><th scope="col">Size grade</th><th scope="col" class="num">Kg</th><th scope="col" class="num">Price per kilo</th><th scope="col" class="num">Amount</th></tr>
                                </thead>
                                <tbody>
                                    @for (l of g.lines; track l.id) {
                                        <tr>
                                            <td>{{ l.sizeLabel }}</td>
                                            <td class="num">{{ (l.buyerAcceptedKg ?? l.kg) | num: 2 }}</td>
                                            <td class="num">{{ l.pricePerKg | php }}</td>
                                            <td class="num">{{ l.amount | php }}</td>
                                        </tr>
                                    }
                                </tbody>
                                <tfoot>
                                    <tr><td>Total</td><td class="num">{{ g.paidKg | num: 2 }}</td><td></td><td class="num">{{ g.amount | php }}</td></tr>
                                </tfoot>
                            </table>
                            @if (g.buyerKg !== null) {
                                <p class="small">Amounts use the buyer's weight where one was recorded.</p>
                            }

                            <div class="row mt-5 mb-3 small fpms-doc-signs">
                                <div class="col-4"><div class="fpms-sign">Weighed by</div></div>
                                <div class="col-4"><div class="fpms-sign">Checked by (farm)</div></div>
                                <div class="col-4"><div class="fpms-sign">Customer / representative</div></div>
                            </div>
                            <p class="small text-center text-muted mb-0">Tally sheet of dispatch receipt {{ s.dispatchReceiptNo }}, for the buyer. Not an official receipt.</p>
                        </div>
                    }
                }
            </div>
        </section>
    `,
})
export class BuyerTallyComponent extends FpmsPage implements OnInit {
    s: any = null;
    sheets: any[] = [];
    private readonly page = printPage('fpms-buyer-tally-page', "Buyer's tally sheet");

    ngOnInit(): void {
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        this.s = await this.api.get<any>('Sale', 'Get', { id: this.param('id') });
        this.sheets = this.buildSheets();
        this.page(this.s ? `${this.s.farmName} · Harvest tally sheet, ${this.s.dispatchReceiptNo}, ${this.s.buyerName}` : "Buyer's tally sheet");
        this.setPageTitle(this.s ? `Tally sheet ${this.s.dispatchReceiptNo}` : null);
    }

    /** One sheet per harvest the sale took from, with that harvest's lines and the crates on this sale. */
    private buildSheets(): any[] {
        const byHarvest = new Map<string, any[]>();
        for (const l of this.s?.lines ?? []) {
            byHarvest.set(l.harvestId, [...(byHarvest.get(l.harvestId) ?? []), l]);
        }
        return Array.from(byHarvest, ([harvestId, lines]) => {
            const first = lines[0];
            const own = (this.s.crates ?? []).filter((c: any) => c.harvestId === harvestId);
            const graded = own.some((c: any) => c.sizeGradeId);
            const crates: GridCrate[] = own.map((c: any) => ({ crateNo: c.crateNo, kg: c.kg, tareKg: c.tareKg, sizeLabel: graded ? c.sizeLabel || 'Ungraded' : null }));
            const sum = (f: (l: any) => number) => Math.round(lines.reduce((n: number, l: any) => n + (Number(f(l)) || 0), 0) * 1000) / 1000;
            const reweighed = lines.some((l: any) => l.buyerAcceptedKg != null);
            return {
                harvestId,
                lotCode: first.lotCode,
                harvestedAtUtc: first.harvestedAtUtc,
                harvestType: first.harvestType,
                weighedBy: first.harvestWeighedBy,
                abwG: first.harvestAbwG,
                pondCode: first.pondCode,
                batchCode: first.batchCode,
                lines,
                crates,
                kg: sum((l) => l.kg),
                buyerKg: reweighed ? sum((l) => l.buyerAcceptedKg ?? l.kg) : null,
                paidKg: sum((l) => l.buyerAcceptedKg ?? l.kg),
                amount: sum((l) => l.amount),
            };
        });
    }
}
