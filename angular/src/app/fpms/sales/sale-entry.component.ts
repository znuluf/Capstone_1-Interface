import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { FPMS_IMPORTS } from '../shared-imports';
import { PRICE_METHODS, applyTerms, countFromAbw, num, pricingBody, referencePrice, tableRow, termsEmpty } from '@shared/fpms/pricing';

/**
 * Record or edit a sale (Ref 7.3, AC-15, step E). Lines sell kg from harvest grade lines, possibly from several harvests.
 * The buyer's accepted kg, when the buyer re-weighs, sets the amount (DEC-67). Optional due date, transport details
 * (DEC-55) and a payment received with the sale. The dispatch receipt number is assigned on save. A line's price can be
 * fixed, worked out from a base price at a base ABW or a base count, or read from a price table by count (DEC-80, DEC-82),
 * prefilled from the buyer's last terms or their price table.
 * "Sell this harvest" (?harvestId=) starts with that harvest's unsold grades and its buyer (DEC-81).
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [narrow]="true" [title]="isNew ? 'Record sale' : 'Edit sale ' + (original?.dispatchReceiptNo ?? '')" [subtitle]="isNew ? 'Sell harvested kilograms to a buyer. The dispatch receipt number is made when you save.' : ''" backLink="/app/sales" backLabel="Sales"></fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid fpms-narrow">
                @if (loading) {
                    <fpms-loading></fpms-loading>
                } @else if (!buyers.length || !sellable.length) {
                    <div class="card">
                        <div class="card-body">
                            @if (!buyers.length) {
                                <fpms-empty text="Add an active buyer first." icon="fas fa-handshake"><a routerLink="/app/resources/buyers" class="btn btn-sm btn-primary">Go to buyers</a></fpms-empty>
                            } @else {
                                <fpms-empty text="No harvest grade has unsold kilograms. Record a harvest with its size grades first." icon="fas fa-shrimp"><a routerLink="/app/harvests" class="btn btn-sm btn-primary">Go to harvests</a></fpms-empty>
                            }
                        </div>
                    </div>
                } @else {
                    <form #f="ngForm" (ngSubmit)="review = true" novalidate>
                        <div class="card">
                            <div class="card-body">
                                <div class="form-row">
                                    <div class="form-group col-md-6">
                                        <label for="by">Buyer <span class="text-danger">*</span></label>
                                        <select id="by" class="form-control" name="buyerId" [(ngModel)]="m.buyerId" (ngModelChange)="terms = {}" required>
                                            @for (b of buyers; track b.id) { <option [value]="b.id">{{ b.name }}</option> }
                                        </select>
                                    </div>
                                    <div class="form-group col-md-3">
                                        <label for="sd">Sale date <span class="text-danger">*</span></label>
                                        <input id="sd" type="date" class="form-control" name="saleDate" [(ngModel)]="m.saleDate" required [max]="today" />
                                    </div>
                                    <div class="form-group col-md-3">
                                        <label for="dd">Due date</label>
                                        <input id="dd" type="date" class="form-control" name="dueDate" [(ngModel)]="m.dueDate" [min]="m.saleDate" />
                                        <small class="form-text text-muted">For credit; shows Overdue when unpaid after it.</small>
                                    </div>
                                </div>
                                <div class="form-group mb-0">
                                    <label for="pt">Payment terms</label>
                                    <input id="pt" class="form-control" name="paymentTerms" [(ngModel)]="m.paymentTerms" maxlength="200" placeholder="e.g. cash, 50% on delivery, balance in 15 days" />
                                </div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-cash-register" aria-hidden="true"></i>What was sold</h3></div>
                            <div class="card-body p-0 table-responsive">
                                <table class="table table-sm mb-0">
                                    <thead><tr><th>Harvest grade</th><th style="width: 7rem">Farm kg</th><th style="width: 7rem">Buyer kg</th><th style="width: 8rem">Price / kg (₱)</th><th class="text-right">Amount</th><th><span class="sr-only">Actions</span></th></tr></thead>
                                    <tbody>
                                        @for (l of m.lines; track $index) {
                                            <tr>
                                                <td>
                                                    <select class="form-control form-control-sm" [name]="'g' + $index" [(ngModel)]="l.harvestGradeLineId" (ngModelChange)="l.priceMethod > 1 && applyFormula(l)" required aria-label="Harvest grade">
                                                        @for (o of sellable; track o.harvestGradeLineId) {
                                                            <option [value]="o.harvestGradeLineId" [disabled]="used(o.harvestGradeLineId, l)">{{ o.harvestDate | farmDate }} · {{ o.pondCode }} · {{ o.sizeLabel }} ({{ unsold(o) | num: 3 }} kg left)</option>
                                                        }
                                                    </select>
                                                    @if (over(l)) { <small class="text-danger">More than the {{ unsold(option(l)) | num: 3 }} kg unsold.</small> }
                                                </td>
                                                <td><input type="number" min="0.001" step="0.001" class="form-control form-control-sm" [name]="'k' + $index" [(ngModel)]="l.kg" required aria-label="Farm kg" /></td>
                                                <td>
                                                    <input type="number" min="0" step="0.001" class="form-control form-control-sm" [name]="'bk' + $index" [(ngModel)]="l.buyerAcceptedKg" aria-label="Buyer's accepted kg" placeholder="same" />
                                                    @if (diffPct(l) > 10) { <small class="text-warning-dark">{{ diffPct(l) | num: 1 }}% off</small> }
                                                </td>
                                                <td>
                                                    <select class="custom-select custom-select-sm mb-1" [name]="'pm' + $index" [(ngModel)]="l.priceMethod" (ngModelChange)="onMethod(l)" aria-label="How the price was agreed">
                                                        @for (o of methods; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
                                                    </select>
                                                    <input type="number" min="0" step="0.01" class="form-control form-control-sm" [name]="'p' + $index" [(ngModel)]="l.pricePerKg" required aria-label="Price per kg" />
                                                </td>
                                                <td class="text-right">{{ amount(l) | php }}</td>
                                                <td class="text-right">
                                                    @if (m.lines.length > 1) {
                                                        <button type="button" class="btn btn-sm btn-outline-danger" (click)="m.lines.splice($index, 1)" aria-label="Remove"><i class="fas fa-times"></i></button>
                                                    }
                                                </td>
                                            </tr>
                                            @if (l.priceMethod > 1) {
                                                <tr class="bg-light">
                                                    <td colspan="6">
                                                        <div class="form-row align-items-end">
                                                            @if (l.priceMethod === 2 || l.priceMethod === 3) {
                                                                <div class="form-group col-6 col-md-3 mb-1">
                                                                    <label class="small mb-0" [for]="'bp' + $index">Base price (₱/kg)</label>
                                                                    <input [id]="'bp' + $index" type="number" min="0" step="0.01" class="form-control form-control-sm" [name]="'bp' + $index" [(ngModel)]="l.basePricePerKg" (ngModelChange)="applyFormula(l)" required />
                                                                </div>
                                                            }
                                                            @if (l.priceMethod === 2) {
                                                                <div class="form-group col-6 col-md-2 mb-1">
                                                                    <label class="small mb-0" [for]="'ba' + $index">at ABW (g)</label>
                                                                    <input [id]="'ba' + $index" type="number" min="0.01" max="60" step="0.01" class="form-control form-control-sm" [name]="'ba' + $index" [(ngModel)]="l.baseAbwG" (ngModelChange)="applyFormula(l)" required />
                                                                </div>
                                                                <div class="form-group col-6 col-md-2 mb-1">
                                                                    <label class="small mb-0" [for]="'st' + $index">+ ₱ per g</label>
                                                                    <input [id]="'st' + $index" type="number" min="0" step="0.01" class="form-control form-control-sm" [name]="'st' + $index" [(ngModel)]="l.stepPerG" (ngModelChange)="applyFormula(l)" required />
                                                                </div>
                                                                <div class="form-group col-6 col-md-2 mb-1">
                                                                    <label class="small mb-0" [for]="'pa' + $index">Shrimp ABW (g)</label>
                                                                    <input [id]="'pa' + $index" type="number" min="0.01" max="60" step="0.01" class="form-control form-control-sm" [name]="'pa' + $index" [(ngModel)]="l.priceAbwG" (ngModelChange)="applyFormula(l)" [placeholder]="option(l)?.harvestAbwG ?? ''" [required]="!option(l)?.harvestAbwG" />
                                                                </div>
                                                            }
                                                            @if (l.priceMethod === 3) {
                                                                <div class="form-group col-6 col-md-2 mb-1">
                                                                    <label class="small mb-0" [for]="'bc' + $index">at count (pcs/kg)</label>
                                                                    <input [id]="'bc' + $index" type="number" min="1" step="1" class="form-control form-control-sm" [name]="'bc' + $index" [(ngModel)]="l.baseCountPerKg" (ngModelChange)="applyFormula(l)" required />
                                                                </div>
                                                                <div class="form-group col-6 col-md-2 mb-1">
                                                                    <label class="small mb-0" [for]="'sc' + $index">+ ₱ per piece fewer</label>
                                                                    <input [id]="'sc' + $index" type="number" min="0" step="0.01" class="form-control form-control-sm" [name]="'sc' + $index" [(ngModel)]="l.stepPerCount" (ngModelChange)="applyFormula(l)" required />
                                                                </div>
                                                            }
                                                            @if (l.priceMethod === 4) {
                                                                <div class="form-group col-12 col-md-5 mb-1">
                                                                    <label class="small mb-0" [for]="'tb' + $index">Price table</label>
                                                                    <select [id]="'tb' + $index" class="custom-select custom-select-sm" [name]="'tb' + $index" [(ngModel)]="l.priceTableId" (ngModelChange)="applyFormula(l)" required>
                                                                        <option value="">Choose…</option>
                                                                        @for (t of tablesFor(l); track t.id) { <option [value]="t.id">{{ t.name }}{{ t.buyerName ? ' (' + t.buyerName + ')' : '' }}</option> }
                                                                    </select>
                                                                    @if (!tables.length) { <small class="text-muted">No price tables yet. <a routerLink="/app/sales/price-tables">Add one</a>.</small> }
                                                                </div>
                                                            }
                                                            @if (l.priceMethod === 3 || l.priceMethod === 4) {
                                                                <div class="form-group col-6 col-md-2 mb-1">
                                                                    <label class="small mb-0" [for]="'pc' + $index">Count (pcs/kg)</label>
                                                                    <input [id]="'pc' + $index" type="number" min="1" step="1" class="form-control form-control-sm" [name]="'pc' + $index" [(ngModel)]="l.priceCountPerKg" (ngModelChange)="applyFormula(l)" [placeholder]="option(l)?.defaultCountPerKg ?? ''" [required]="!option(l)?.defaultCountPerKg" />
                                                                </div>
                                                            }
                                                            <div class="form-group col-12 col-md-3 mb-1 small">
                                                                @if (formula(l) !== null) {
                                                                    <div>{{ working(l) }} = <strong>{{ formula(l) | php }}</strong></div>
                                                                    @if (overridden(l)) {
                                                                        <div class="text-warning-dark">Price differs. <a href="javascript:;" (click)="l.pricePerKg = formula(l)">Use {{ formula(l) | php }}</a></div>
                                                                    }
                                                                } @else if (l.priceMethod === 4 && l.priceTableId && countOf(l) !== null) {
                                                                    <div class="text-danger">No row of this table covers {{ countOf(l) }} pcs/kg.</div>
                                                                }
                                                                @if (l.termsFrom) { <div class="text-muted">Terms from {{ l.termsFrom }}; check them.</div> }
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            }
                                        }
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td><button type="button" class="btn btn-sm btn-outline-secondary" (click)="addLine()" [disabled]="m.lines.length >= sellable.length"><i class="fas fa-plus mr-1"></i>Add grade</button></td>
                                            <td><strong>{{ totalKg() | num: 3 }}</strong></td>
                                            <td></td>
                                            <td></td>
                                            <td class="text-right"><strong>{{ total() | php }}</strong></td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                                <p class="small text-muted px-3 my-2">Leave "Buyer kg" empty when the buyer pays on the farm's weight. When filled, the amount uses it; yield and FCR keep the farm weight. "Base ABW price" works the price out from the buyer's base price at a base ABW plus a step for each gram above it; the shrimp ABW defaults to the harvest's sampled ABW.</p>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <a href="javascript:;" class="card-title text-reset" role="button" (click)="showTransport = !showTransport" [attr.aria-expanded]="showTransport">
                                    <i class="fas mr-1" [class.fa-chevron-right]="!showTransport" [class.fa-chevron-down]="showTransport" aria-hidden="true"></i>Transport details (optional)
                                </a>
                            </div>
                            @if (showTransport) {
                                <div class="card-body">
                                    <div class="form-row">
                                        <div class="form-group col-md-4"><label for="tr">Transporter</label><input id="tr" class="form-control" name="transporter" [(ngModel)]="m.transporter" maxlength="100" /></div>
                                        <div class="form-group col-md-4"><label for="dr">Driver</label><input id="dr" class="form-control" name="driverName" [(ngModel)]="m.driverName" maxlength="100" /></div>
                                        <div class="form-group col-md-4"><label for="pl">Plate no.</label><input id="pl" class="form-control" name="plateNo" [(ngModel)]="m.plateNo" maxlength="20" /></div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group col-md-4"><label for="la">Loaded at</label><input id="la" type="datetime-local" class="form-control" name="loadedAt" [(ngModel)]="m.loadedAt" /></div>
                                        <div class="form-group col-md-4"><label for="de">Destination</label><input id="de" class="form-control" name="destination" [(ngModel)]="m.destination" maxlength="200" /></div>
                                        <div class="form-group col-md-4"><label for="ltp">Local transport permit no.</label><input id="ltp" class="form-control" name="localTransportPermitNo" [(ngModel)]="m.localTransportPermitNo" maxlength="100" /></div>
                                    </div>
                                    <div class="form-group mb-0"><label for="tn">Temperature / icing note</label><input id="tn" class="form-control" name="temperatureNote" [(ngModel)]="m.temperatureNote" maxlength="200" placeholder="e.g. iced 1:1, 4 °C" /></div>
                                </div>
                            }
                        </div>
                        @if (isNew) {
                            <div class="card">
                                <div class="card-body">
                                    <div class="form-row">
                                        <div class="form-group col-md-4 mb-0">
                                            <label for="paid">Paid now (₱)</label>
                                            <input id="paid" type="number" min="0" step="0.01" class="form-control" name="paidNow" [(ngModel)]="m.paidNow" />
                                        </div>
                                        <div class="form-group col-md-4 mb-0">
                                            <label for="pm">Method</label>
                                            <input id="pm" class="form-control" name="paidMethod" [(ngModel)]="m.paidMethod" maxlength="50" placeholder="cash, bank transfer, GCash" />
                                        </div>
                                        <div class="form-group col-md-4 mb-0 d-flex align-items-end">
                                            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="m.paidNow = total()">Paid in full</button>
                                        </div>
                                    </div>
                                    <small class="form-text text-muted">Later payments are recorded from the sales list or the dispatch receipt.</small>
                                </div>
                            </div>
                        }

                        @if (!review) {
                            <button type="submit" class="btn btn-primary btn-lg" [disabled]="!f.form.valid || !validLines().length || anyOver()">Review sale</button>
                            <fpms-form-hint [form]="f"></fpms-form-hint>
                        } @else {
                            <div class="card card-outline card-primary">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-clipboard-check" aria-hidden="true"></i>Check before saving</h3></div>
                                <div class="card-body">
                                    <p class="mb-1">{{ buyerName() }} · {{ m.saleDate | farmDate }} · {{ validLines().length }} grade line(s){{ m.dueDate ? ' · due ' + (m.dueDate | farmDate) : '' }}</p>
                                    <p class="mb-1">Total <strong>{{ totalKg() | num: 3 }} kg</strong> for <strong>{{ total() | php }}</strong>{{ isNew ? '; paid now ' + ((m.paidNow || 0) | php) : '' }}.</p>
                                    <p class="small text-muted mb-0">{{ isNew ? 'A dispatch receipt number is assigned when you save. ' : '' }}The dispatch receipt is for the farm's records, not an official receipt.</p>
                                </div>
                                <div class="card-footer">
                                    <button type="button" class="btn btn-primary mr-2" [disabled]="busy()" (click)="save()">Save sale</button>
                                    <button type="button" class="btn btn-default" (click)="review = false">Back</button>
                                </div>
                            </div>
                        }
                    </form>
                }
            </div>
        </section>
    `,
})
export class SaleEntryComponent extends FpmsPage implements OnInit {
    loading = true;
    isNew = true;
    review = false;
    showTransport = false;
    buyers: any[] = [];
    sellable: any[] = [];
    original: any = null;
    m: any = { lines: [] };
    /** Pricing terms from the buyer's last priced sale or their price table, fetched once per buyer (DEC-80, DEC-82). */
    terms: Record<string, any> = {};
    readonly methods = PRICE_METHODS;
    /** Active price tables with their rows (DEC-82). */
    tables: any[] = [];

    ngOnInit(): void {
        // Detail routes reuse this component when only the :id changes, so reload on every change.
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        const id = this.param('id');
        this.isNew = !id;
        this.review = false;
        this.original = this.isNew ? null : await this.api.get<any>('Sale', 'Get', { id });
        const [buyers, sellable] = await Promise.all([
            this.api.get<any[]>('Buyer', 'GetLookup'),
            this.api.get<any[]>('Sale', 'GetSellableLines', { saleId: this.original?.id }),
        ]);
        this.buyers = buyers.filter((b) => b.isActive || b.id === this.original?.buyerId);
        const keep = new Set((this.original?.lines ?? []).map((l: any) => l.priceTableId).filter((x: any) => x));
        this.tables = (await this.api.get<any[]>('PriceTable', 'GetAll')).filter((t) => t.isActive || keep.has(t.id));
        this.sellable = sellable;
        if (this.original) {
            const o = this.original;
            this.m = {
                id: o.id, buyerId: o.buyerId, saleDate: o.saleDate, dueDate: o.dueDate ?? '', paymentTerms: o.paymentTerms ?? '',
                transporter: o.transporter, driverName: o.driverName, plateNo: o.plateNo, loadedAt: o.loadedAtUtc ? FarmTime.toLocalInput(o.loadedAtUtc) : '',
                destination: o.destination, localTransportPermitNo: o.localTransportPermitNo, temperatureNote: o.temperatureNote,
                lines: o.lines.map((l: any) => ({
                    harvestGradeLineId: l.harvestGradeLineId, kg: l.kg, buyerAcceptedKg: l.buyerAcceptedKg, pricePerKg: l.pricePerKg,
                    priceMethod: l.priceMethod ?? 1, basePricePerKg: l.basePricePerKg, baseAbwG: l.baseAbwG, stepPerG: l.stepPerG, priceAbwG: l.priceAbwG,
                    baseCountPerKg: l.baseCountPerKg, stepPerCount: l.stepPerCount, priceCountPerKg: l.priceCountPerKg, priceTableId: l.priceTableId ?? '',
                })),
            };
            this.showTransport = !!(o.transporter || o.driverName || o.plateNo || o.loadedAtUtc || o.destination || o.localTransportPermitNo || o.temperatureNote);
        } else {
            this.m = {
                buyerId: this.buyers[0]?.id ?? '', saleDate: this.today, dueDate: '', paymentTerms: '', paidNow: null, paidMethod: '',
                lines: this.sellable.length ? [this.blankLine(this.sellable[0].harvestGradeLineId)] : [],
            };
            await this.startFromHarvest(this.query('harvestId'));
        }
        this.loading = false;
    }

    option(l: any): any {
        return this.sellable.find((o) => o.harvestGradeLineId === l.harvestGradeLineId);
    }

    /** Unsold kg of a grade line, not counting this sale's own kg (they are available again while editing). */
    unsold(o: any): number {
        return o ? o.unsoldKg : 0;
    }

    used(id: string, self: any): boolean {
        return this.m.lines.some((l: any) => l !== self && l.harvestGradeLineId === id);
    }

    over(l: any): boolean {
        const o = this.option(l);
        return !!o && Number(l.kg) > o.unsoldKg + 0.0005;
    }

    anyOver(): boolean {
        return this.m.lines.some((l: any) => this.over(l));
    }

    addLine(): void {
        const free = this.sellable.find((o) => !this.m.lines.some((l: any) => l.harvestGradeLineId === o.harvestGradeLineId));
        this.m.lines.push(this.blankLine(free?.harvestGradeLineId ?? ''));
    }

    /** "Sell this harvest": every unsold grade of the harvest, its buyer, and that buyer's last terms or price table. */
    private async startFromHarvest(harvestId: string | null): Promise<void> {
        const own = harvestId ? this.sellable.filter((o) => o.harvestId === harvestId && o.unsoldKg > 0) : [];
        if (!own.length) {
            return;
        }
        this.m.lines = own.map((o) => ({ ...this.blankLine(o.harvestGradeLineId), kg: o.unsoldKg }));
        const buyerId = own[0].harvestBuyerId;
        if (buyerId && this.buyers.some((b) => b.id === buyerId && b.isActive)) {
            this.m.buyerId = buyerId;
            const t = await this.buyerTerms();
            for (const l of this.m.lines) {
                if (t) {
                    l.priceMethod = t.priceMethod;
                    await this.onMethod(l);
                }
            }
        }
    }

    private blankLine(harvestGradeLineId: string): any {
        return {
            harvestGradeLineId, kg: null, buyerAcceptedKg: null, pricePerKg: null, priceMethod: 1,
            basePricePerKg: null, baseAbwG: null, stepPerG: null, priceAbwG: null, baseCountPerKg: null, stepPerCount: null, priceCountPerKg: null, priceTableId: '',
        };
    }

    private async buyerTerms(): Promise<any> {
        if (!this.m.buyerId) {
            return null;
        }
        if (!(this.m.buyerId in this.terms)) {
            this.terms[this.m.buyerId] = await this.api.get<any>('Sale', 'GetBuyerPriceTerms', { buyerId: this.m.buyerId });
        }
        return this.terms[this.m.buyerId];
    }

    /**
     * Choosing a priced method fills its empty terms: from another line on this sale with the same method, else the buyer's
     * last terms (or their price table); for a table with neither, the buyer's own table, else the only active one.
     */
    async onMethod(l: any): Promise<void> {
        if (l.priceMethod > 1 && termsEmpty(l)) {
            const sibling = this.m.lines.find((x: any) => x !== l && x.priceMethod === l.priceMethod && !termsEmpty(x));
            if (sibling) {
                applyTerms(l, { ...sibling });
                l.termsFrom = null;
            } else {
                const t = await this.buyerTerms();
                if (applyTerms(l, t)) {
                    l.termsFrom = t.fromDispatchReceiptNo ?? null;
                } else if (l.priceMethod === 4) {
                    const own = this.tables.filter((x) => x.isActive && x.buyerId === this.m.buyerId);
                    const any = this.tables.filter((x) => x.isActive);
                    l.priceTableId = (own.length ? own[0] : any.length === 1 ? any[0] : null)?.id ?? '';
                }
            }
        }
        this.applyFormula(l);
    }

    /** Tables for a line: the buyer's own first, then tables for any buyer; another buyer's table only if already chosen. */
    tablesFor(l: any): any[] {
        return this.tables
            .filter((t) => !t.buyerId || t.buyerId === this.m.buyerId || t.id === l.priceTableId)
            .sort((a, b) => Number(b.buyerId === this.m.buyerId) - Number(a.buyerId === this.m.buyerId));
    }

    /** The count a count-based price uses: typed, else the grade's middle count, else from the harvest's ABW. */
    countOf(l: any): number | null {
        const typed = num(l.priceCountPerKg);
        if (typed != null) {
            return Math.round(typed);
        }
        const o = this.option(l);
        return o?.defaultCountPerKg ?? countFromAbw(o?.harvestAbwG ?? null);
    }

    working(l: any): string {
        const php = (v: any) => '₱' + Number(v).toFixed(2);
        switch (l.priceMethod) {
            case 2:
                return `${php(l.basePricePerKg)} + (${this.abwOf(l)?.toFixed(2)} − ${Number(l.baseAbwG).toFixed(2)}) × ${php(l.stepPerG)}`;
            case 3:
                return `${php(l.basePricePerKg)} + (${l.baseCountPerKg} − ${this.countOf(l)}) × ${php(l.stepPerCount)}`;
            case 4: {
                const t = this.tables.find((x) => x.id === l.priceTableId);
                const row = tableRow(t, this.countOf(l));
                return `${t?.name ?? ''}, ${row?.label ?? ''} (count ${this.countOf(l)})`;
            }
        }
        return '';
    }

    abwOf(l: any): number | null {
        const v = this.num(l.priceAbwG) ?? this.option(l)?.harvestAbwG ?? null;
        return v == null ? null : Math.round(Number(v) * 100) / 100;
    }

    /** The method's price; null until every term is filled (and for Fixed). Matches the server's SaleLine helpers. */
    formula(l: any): number | null {
        return referencePrice(l, this.abwOf(l), this.countOf(l), this.tables);
    }

    applyFormula(l: any): void {
        const p = this.formula(l);
        if (p !== null && p >= 0) {
            l.pricePerKg = p;
        }
    }

    overridden(l: any): boolean {
        const p = this.formula(l);
        return p !== null && l.pricePerKg !== null && l.pricePerKg !== '' && Math.abs(Number(l.pricePerKg) - p) >= 0.01;
    }

    private num(v: any): number | null {
        return v === '' || v == null ? null : Number(v);
    }

    amount(l: any): number {
        const kg = this.num(l.buyerAcceptedKg) ?? (Number(l.kg) || 0);
        return Math.round(kg * (Number(l.pricePerKg) || 0) * 100) / 100;
    }

    diffPct(l: any): number {
        const b = this.num(l.buyerAcceptedKg);
        return b == null || !(l.kg > 0) ? 0 : (Math.abs(b - l.kg) / l.kg) * 100;
    }

    validLines(): any[] {
        return (this.m.lines ?? []).filter((l: any) => l.harvestGradeLineId && l.kg > 0 && l.pricePerKg !== null && l.pricePerKg !== '' && l.pricePerKg >= 0);
    }

    totalKg(): number {
        return (this.m.lines ?? []).reduce((s: number, l: any) => s + (Number(l.kg) || 0), 0);
    }

    total(): number {
        return (this.m.lines ?? []).reduce((s: number, l: any) => s + this.amount(l), 0);
    }

    buyerName(): string {
        return this.buyers.find((b) => b.id === this.m.buyerId)?.name ?? '';
    }

    async save(): Promise<void> {
        const body: any = {
            id: this.m.id, buyerId: this.m.buyerId, saleDate: this.m.saleDate, dueDate: this.m.dueDate || null, paymentTerms: this.m.paymentTerms,
            transporter: this.m.transporter, driverName: this.m.driverName, plateNo: this.m.plateNo,
            loadedAt: this.m.loadedAt ? FarmTime.fromLocalInput(this.m.loadedAt) : null, destination: this.m.destination,
            localTransportPermitNo: this.m.localTransportPermitNo, temperatureNote: this.m.temperatureNote,
            lines: this.validLines().map((l: any) => ({
                harvestGradeLineId: l.harvestGradeLineId, kg: Number(l.kg), buyerAcceptedKg: this.num(l.buyerAcceptedKg), pricePerKg: Number(l.pricePerKg),
                ...pricingBody(l),
            })),
        };
        if (this.isNew && Number(this.m.paidNow) > 0) {
            body.initialPayment = { paidOn: this.m.saleDate, amount: Number(this.m.paidNow), method: this.m.paidMethod };
        }
        let sale: any;
        const ok = await this.act(async () => (sale = this.isNew ? await this.api.post<any>('Sale', 'Create', body) : await this.api.put<any>('Sale', 'Update', body)));
        if (ok) {
            this.notifySaved(this.isNew ? `Sale saved as ${sale.dispatchReceiptNo}.` : 'Sale saved.');
            if (sale?.warnings?.length) {
                this.showWarnings(sale.warnings);
            }
            this.router.navigate(['/app/sales', sale.id], { replaceUrl: true });
        }
    }
}
