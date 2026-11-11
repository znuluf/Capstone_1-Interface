import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { CrateGridComponent } from '@shared/fpms/crate-grid.component';
import { printPage } from '@shared/fpms/print-page';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * A blank harvest tally sheet to fill in by hand at the pond (DEC-86): the farm's letterhead, lines for the customer,
 * pond, date and ABW sample, numbered crate boxes in rows of ten with a row total, the price, and lines to sign. The
 * weights are typed into the harvest's crate tally afterwards, in the same order.
 */
@Component({
    standalone: true,
    imports: [...FPMS_IMPORTS, CrateGridComponent],
    template: `
        <fpms-page-header title="Blank tally sheet" subtitle="Print it, write each crate's weight in its box at the pond, then type the weights into the harvest's crate tally in the same order." backLink="/app/harvests" backLabel="Harvests">
            <button class="btn btn-primary" (click)="print()"><i class="fas fa-print mr-1"></i>Print</button>
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="card no-print">
                    <div class="card-body">
                        <div class="form-row align-items-end">
                            <div class="form-group col-md-5 mb-md-0">
                                <label for="pond">Pond</label>
                                <select id="pond" class="form-control" [(ngModel)]="pond">
                                    <option value="">Blank (write in)</option>
                                    @for (p of ponds; track p.id) {
                                        <option [value]="p.pondCode + (p.currentBatchCode ? ' · ' + p.currentBatchCode : '')">{{ p.pondCode }}{{ p.currentBatchCode ? ' · ' + p.currentBatchCode : '' }}</option>
                                    }
                                </select>
                            </div>
                            <div class="form-group col-md-3 mb-0">
                                <label for="boxes">Crate boxes</label>
                                <select id="boxes" class="form-control" [(ngModel)]="boxes">
                                    <option [ngValue]="100">100 (one page)</option>
                                    <option [ngValue]="150">150</option>
                                    <option [ngValue]="200">200</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="fpms-paper fpms-print-doc fpms-doc">
                    <div class="fpms-doc-head">
                        <div>
                            <div class="fpms-doc-farm">{{ session.tenant?.name }}</div>
                            <div class="small">Fill in at the pond; enter into FPMS afterwards</div>
                        </div>
                        <div class="text-right">
                            <div class="fpms-doc-title">HARVEST TALLY SHEET</div>
                            <div class="small">Sheet no. <span class="fpms-blank short"></span></div>
                        </div>
                    </div>
                    <div class="fpms-doc-meta">
                        <div class="fpms-doc-fields">
                            <span>Name of customer</span>
                            <div class="blank"></div>
                            <span>Address</span>
                            <div class="blank"></div>
                            <span>Pond · batch</span>
                            <div [class.blank]="!pond"><strong>{{ pond }}</strong></div>
                            <span>Date and time</span>
                            <div class="blank"></div>
                        </div>
                        <div class="fpms-doc-fields fpms-blank-checks">
                            <span>Harvest</span>
                            <div>☐ Partial &nbsp; ☐ Total</div>
                            <span>Weighed on</span>
                            <div>☐ Farm's scale &nbsp; ☐ Buyer's scale</div>
                            <span>ABW sample</span>
                            <div><span class="fpms-blank short"></span> g ÷ <span class="fpms-blank short"></span> pcs = <span class="fpms-blank short"></span> g</div>
                        </div>
                    </div>

                    <fpms-crate-grid [blank]="boxes" heading="Crate no. — write the kg in each box"></fpms-crate-grid>

                    <div class="fpms-doc-fields mb-3 mt-2" style="max-width: 30rem">
                        <span>Total kilos</span>
                        <div class="blank"></div>
                        <span>Price per kilo</span>
                        <div class="blank"></div>
                        <span>Total amount</span>
                        <div class="blank"></div>
                    </div>

                    <div class="row mt-5 mb-3 small fpms-doc-signs">
                        <div class="col-4"><div class="fpms-sign">Weighed by</div></div>
                        <div class="col-4"><div class="fpms-sign">Checked by (farm)</div></div>
                        <div class="col-4"><div class="fpms-sign">Customer / representative</div></div>
                    </div>
                    <p class="small text-center text-muted mb-0">Tally sheet for the farm's records; not an official receipt.</p>
                </div>
            </div>
        </section>
    `,
})
export class BlankTallyComponent extends FpmsPage implements OnInit {
    ponds: any[] = [];
    pond = '';
    boxes = 100;
    protected readonly page = printPage('fpms-blank-tally-page', 'Harvest tally sheet');

    async ngOnInit(): Promise<void> {
        this.page(`${this.session.tenant?.name ?? ''} · Harvest tally sheet`);
        // Without access to ponds the pond line is simply left blank to write in.
        try {
            const ponds = await this.api.get<any[]>('Pond', 'GetAll');
            this.ponds = (ponds ?? []).filter((p) => p.purpose === 1 && p.manualStatus !== 3);
        } catch {
            this.ponds = [];
        }
        this.pond = this.query('pond') ?? '';
    }
}
