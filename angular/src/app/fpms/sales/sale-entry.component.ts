import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { FPMS_IMPORTS } from '../shared-imports';
import { PRICE_METHODS, applyTerms, countFromAbw, pricingBody, referencePrice, termsEmpty, usedAbw, usedCount } from '@shared/fpms/pricing';
import { PriceTermsComponent, SalePaymentComponent, initialPaymentOf } from '@shared/fpms/pricing-ui';
import { crateKg, formatCrateNos, parseCrateNos } from '@shared/fpms/crates';

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
    imports: [...FPMS_IMPORTS, PriceTermsComponent, SalePaymentComponent],
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
                                <fpms-empty [text]="grading ? 'No harvest grade has kilograms left to sell. Record a harvest with its size grades first.' : 'No harvest has kilograms left to sell. Record a harvest first.'" icon="fas fa-shrimp"><a routerLink="/app/harvests" class="btn btn-sm btn-primary">Go to harvests</a></fpms-empty>
                            }
                        </div>
                    </div>
                } @else {
                    <form #f="ngForm" (ngSubmit)="review = true" novalidate>
                        <div class="card">
                            <div class="card-body">
                                <div class="form-row">
                                    <div class="form-group col-md-8 mb-0">
                                        <label for="by">Buyer <span class="text-danger">*</span></label>
                                        <select id="by" class="form-control" name="buyerId" [(ngModel)]="m.buyerId" (ngModelChange)="terms = {}" required>
                                            @for (b of buyers; track b.id) { <option [value]="b.id">{{ b.name }}</option> }
                                        </select>
                                    </div>
                                    <div class="form-group col-md-4 mb-0">
                                        <label for="sd">Sale date <span class="text-danger">*</span></label>
                                        <input id="sd" type="date" class="form-control" name="saleDate" [(ngModel)]="m.saleDate" required [max]="today" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-cash-register" aria-hidden="true"></i>What was sold</h3></div>
                            <div class="card-body p-0 table-responsive">
                                <table class="table table-sm mb-0">
                                    <thead><tr><th>{{ grading ? 'Harvest grade' : 'Harvest' }}</th><th style="width: 7rem">Farm kg</th><th style="width: 7rem">Buyer kg</th><th style="width: 8rem">Price / kg (₱)</th><th class="text-right">Amount</th><th><span class="sr-only">Actions</span></th></tr></thead>
                                    <tbody>
                                        @for (l of m.lines; track $index) {
                                            <tr>
                                                <td>
                                                    <select class="form-control form-control-sm" [name]="'g' + $index" [(ngModel)]="l.harvestGradeLineId" (ngModelChange)="onGrade(l)" required aria-label="Harvest grade">
                                                        @for (o of sellable; track o.harvestGradeLineId) {
                                                            <option [value]="o.harvestGradeLineId" [disabled]="used(o.harvestGradeLineId, l)">{{ o.harvestDate | farmDate }} · {{ o.pondCode }}{{ o.lotCode ? ' · lot ' + o.lotCode : '' }}{{ gradeText(o) }} ({{ unsold(o) | num: 3 }} kg left)</option>
                                                        }
                                                    </select>
                                                    @if (over(l)) { <small class="text-danger">More than the {{ unsold(option(l)) | num: 3 }} kg left to sell.</small> }
                                                </td>
                                                <td><input type="number" min="0.001" step="0.001" class="form-control form-control-sm" [name]="'k' + $index" [(ngModel)]="l.kg" required aria-label="Farm kg" /></td>
                                                <td>
                                                    <input type="number" min="0" step="0.001" class="form-control form-control-sm" [name]="'bk' + $index" [(ngModel)]="l.buyerAcceptedKg" aria-label="Buyer's accepted kg" placeholder="same" />
                                                    @if (diffPct(l) > 10) { <small class="text-warning-dark">{{ diffPct(l) | num: 1 }}% off</small> }
                                                </td>
                                                <td>
                                                    <select class="custom-select custom-select-sm mb-1" [name]="'pm' + $index" [(ngModel)]="l.priceMethod" (ngModelChange)="onMethod(l)" aria-label="How the price was agreed">
                                                        @for (o of methodsFor(l); track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
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
                                                        <fpms-price-terms [t]="l" [key]="'l' + $index" [tables]="tablesFor(l)" [abw]="option(l)?.harvestAbwG ?? null" [count]="defaultCount(l)" [termsFrom]="l.termsFrom" (changed)="applyFormula(l)"></fpms-price-terms>
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
                        @if (crateHarvests().length) {
                            <div class="card">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-box" aria-hidden="true"></i>Crates for this buyer (optional)</h3></div>
                                <div class="card-body">
                                    <p class="small text-muted">Type the crate numbers from the harvest's tally that went to this buyer, e.g. 1-10, 15. Their dispatch receipt then lists these crates. A crate can be on one sale only.</p>
                                    @for (h of crateHarvests(); track h.id) {
                                        <div class="form-group" [class.mb-0]="$last">
                                            <label [for]="'cr' + $index">{{ h.harvestedAtUtc | farmDayOf }} · {{ h.pondCode }}{{ h.lotCode ? ' · lot ' + h.lotCode : '' }} <span class="text-muted font-weight-normal">· {{ h.crates.length }} crates, {{ freeCrates(h).length }} not on another sale</span></label>
                                            <div class="input-group">
                                                <input [id]="'cr' + $index" class="form-control" [name]="'cr' + $index" [(ngModel)]="crateText[h.id]" placeholder="e.g. 1-10, 15" autocomplete="off" />
                                                <div class="input-group-append">
                                                    <button type="button" class="btn btn-outline-secondary" (click)="takeAllCrates(h)" [disabled]="!freeCrates(h).length">All {{ freeCrates(h).length }} free crates</button>
                                                </div>
                                            </div>
                                            @if (crateError(h); as e) {
                                                <small class="form-text text-danger">{{ e }}</small>
                                            } @else if (chosenCrates(h).length) {
                                                <small class="form-text text-muted">
                                                    {{ chosenCrates(h).length }} crate(s) · {{ chosenKg(h) | num: 3 }} kg.
                                                    @if (crateMismatch(h)) {
                                                        <span class="text-warning-dark">The lines from this harvest total {{ lineKg(h) | num: 3 }} kg.</span>
                                                        @if (canUseCrateKg(h)) { <a href="javascript:;" (click)="useCrateKg(h)">Use the crates' kg</a> }
                                                    }
                                                </small>
                                            }
                                        </div>
                                    }
                                </div>
                            </div>
                        }
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
                        <div class="card">
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-coins" aria-hidden="true"></i>Payment</h3></div>
                            <div class="card-body">
                                <fpms-sale-payment [m]="m" key="pay" [total]="total()" [minDue]="m.saleDate" [showPaidNow]="isNew"></fpms-sale-payment>
                            </div>
                        </div>

                        @if (!review) {
                            <button type="submit" class="btn btn-primary btn-lg" [disabled]="!f.form.valid || !validLines().length || anyOver() || anyCrateError()">Review sale</button>
                            <fpms-form-hint [form]="f"></fpms-form-hint>
                        } @else {
                            <div class="card card-outline card-primary">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-clipboard-check" aria-hidden="true"></i>Check before saving</h3></div>
                                <div class="card-body">
                                    <p class="mb-1">{{ buyerName() }} · {{ m.saleDate | farmDate }} · {{ validLines().length }} {{ grading ? 'grade line(s)' : 'line(s)' }}{{ totalChosenCrates() ? ' · ' + totalChosenCrates() + ' crate(s)' : '' }}{{ m.dueDate ? ' · due ' + (m.dueDate | farmDate) : '' }}</p>
                                    <p class="mb-1">Total <strong>{{ totalKg() | num: 3 }} kg</strong> for <strong>{{ total() | php }}</strong>{{ isNew ? '; paid now ' + ((m.paidInFull ? total() : m.paidNow || 0) | php) : '' }}.</p>
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

    /** Price by count is offered only on a line that already uses it: the partner farm always sells by kg (DEC-90). */
    methodsFor(l: any): typeof PRICE_METHODS {
        return PRICE_METHODS.filter((o) => o.value !== 3 || l.priceMethod === 3);
    }
    /** Active price tables with their rows (DEC-82). */
    tables: any[] = [];
    /** Harvests with a crate tally, loaded as the sale's lines name them (DEC-86): id → the harvest, or null while unknown. */
    private crateSource: Record<string, any> = {};
    /** The crate numbers typed for each harvest, e.g. "1-10, 15". */
    crateText: Record<string, string> = {};

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
                buyerId: this.buyers[0]?.id ?? '', saleDate: this.today, dueDate: '', paymentTerms: '', paidNow: null, paidMethod: '', paidInFull: true,
                lines: this.sellable.length ? [this.blankLine(this.sellable[0].harvestGradeLineId)] : [],
            };
            await this.startFromHarvest(this.query('harvestId'));
        }
        this.crateSource = {};
        this.crateText = {};
        const onSale: Record<string, number[]> = {};
        for (const c of this.original?.crates ?? []) {
            (onSale[c.harvestId] ??= []).push(c.crateNo);
        }
        for (const id of Object.keys(onSale)) {
            this.crateText[id] = formatCrateNos(onSale[id]);
        }
        await this.loadCrates();
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
        this.loadCrates();
    }

    onGrade(l: any): void {
        if (l.priceMethod > 1) {
            this.applyFormula(l);
        }
        this.loadCrates();
    }

    // ---- Crates for this buyer (DEC-86)

    /** The harvests this sale's lines sell from. */
    private lineHarvestIds(): string[] {
        return [...new Set<string>((this.m.lines ?? []).map((l: any) => this.option(l)?.harvestId).filter((id: any) => !!id))];
    }

    /** Loads the crate tally of each harvest on the sale, once. Without access to harvests the crates are left alone. */
    async loadCrates(): Promise<void> {
        if (!this.can('Farm.Harvests')) {
            return;
        }
        for (const id of this.lineHarvestIds()) {
            if (!(id in this.crateSource)) {
                this.crateSource[id] = null;
                try {
                    this.crateSource[id] = await this.api.get<any>('Harvest', 'Get', { id });
                } catch {
                    delete this.crateSource[id];
                }
            }
        }
    }

    /** The harvests on this sale that have a crate tally, in the order of the lines. */
    crateHarvests(): any[] {
        return this.lineHarvestIds().map((id) => this.crateSource[id]).filter((h) => h?.crates?.length);
    }

    /** Crates not on another sale: free ones and this sale's own. */
    freeCrates(h: any): any[] {
        return (h.crates ?? []).filter((c: any) => !c.saleId || c.saleId === this.original?.id);
    }

    crateError(h: any): string | null {
        const { nos, error } = parseCrateNos(this.crateText[h.id] ?? '');
        if (error) {
            return error;
        }
        for (const n of nos) {
            const crate = h.crates.find((c: any) => c.crateNo === n);
            if (!crate) {
                return `Crate ${n} is not on this harvest's tally (it has crates 1 to ${h.crates.length}).`;
            }
            if (crate.saleId && crate.saleId !== this.original?.id) {
                return `Crate ${n} is already on another sale.`;
            }
        }
        return null;
    }

    anyCrateError(): boolean {
        return this.crateHarvests().some((h) => !!this.crateError(h));
    }

    chosenCrates(h: any): any[] {
        const { nos, error } = parseCrateNos(this.crateText[h.id] ?? '');
        return error ? [] : h.crates.filter((c: any) => nos.includes(c.crateNo));
    }

    chosenKg(h: any): number {
        return crateKg(this.chosenCrates(h));
    }

    totalChosenCrates(): number {
        return this.crateHarvests().reduce((n, h) => n + this.chosenCrates(h).length, 0);
    }

    private linesOf(h: any): any[] {
        return (this.m.lines ?? []).filter((l: any) => this.option(l)?.harvestId === h.id);
    }

    lineKg(h: any): number {
        return this.linesOf(h).reduce((s: number, l: any) => s + (Number(l.kg) || 0), 0);
    }

    crateMismatch(h: any): boolean {
        return Math.abs(this.chosenKg(h) - this.lineKg(h)) >= 0.001;
    }

    takeAllCrates(h: any): void {
        this.crateText[h.id] = formatCrateNos(this.freeCrates(h).map((c: any) => c.crateNo));
    }

    /** " · 60/70" after a harvest in the line picker; nothing for an ungraded harvest on a farm that does not grade (DEC-100). */
    gradeText(o: any): string {
        return this.grading || (o.sizeLabel && o.sizeLabel !== 'Ungraded / mixed') ? ` · ${o.sizeLabel}` : '';
    }

    /** The size grade of a sale line, read from the harvest's grade lines. */
    private gradeOf(h: any, l: any): string | null {
        return (h.gradeLines ?? []).find((g: any) => g.id === l.harvestGradeLineId)?.sizeGradeId ?? null;
    }

    /**
     * The crates' kg for one line: all of them when the sale has one line from the harvest; with graded crates, the crates
     * of the line's grade (ungraded crates count for the grade no crate names). Null when it cannot be told.
     */
    private crateKgFor(h: any, l: any): number | null {
        const chosen = this.chosenCrates(h);
        if (this.linesOf(h).length === 1) {
            return crateKg(chosen);
        }
        if (!h.crates.some((c: any) => c.sizeGradeId)) {
            return null;
        }
        const grade = this.gradeOf(h, l);
        const named = new Set(h.crates.map((c: any) => c.sizeGradeId).filter((g: any) => !!g));
        return crateKg(chosen.filter((c: any) => (c.sizeGradeId ? c.sizeGradeId === grade : !named.has(grade))));
    }

    canUseCrateKg(h: any): boolean {
        return this.linesOf(h).every((l: any) => this.crateKgFor(h, l) !== null);
    }

    useCrateKg(h: any): void {
        for (const l of this.linesOf(h)) {
            const kg = this.crateKgFor(h, l);
            if (kg !== null && kg > 0) {
                l.kg = kg;
            }
        }
    }

    /**
     * The crates to send: every chosen crate, or null (leave the sale's crates as they are) when a harvest's tally could
     * not be read, so an edit never wipes crates this form could not show.
     */
    private cratesBody(): any[] | null {
        if (!this.can('Farm.Harvests') || this.lineHarvestIds().some((id) => !this.crateSource[id])) {
            return null;
        }
        return this.crateHarvests().flatMap((h) => this.chosenCrates(h).map((c: any) => ({ harvestId: h.id, crateNo: c.crateNo })));
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

    /** The count a count-based price starts from: the grade's middle count, else from the harvest's ABW. */
    defaultCount(l: any): number | null {
        const o = this.option(l);
        return o?.defaultCountPerKg ?? countFromAbw(o?.harvestAbwG ?? null);
    }

    /** The method's price; null until every term is filled (and for Fixed). Matches the server's SaleLine helpers. */
    formula(l: any): number | null {
        return referencePrice(l, usedAbw(l, this.option(l)?.harvestAbwG ?? null), usedCount(l, this.defaultCount(l)), this.tablesFor(l));
    }

    applyFormula(l: any): void {
        const p = this.formula(l);
        if (p !== null && p >= 0) {
            l.pricePerKg = p;
        }
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
            crates: this.cratesBody(),
        };
        const paid = this.isNew ? initialPaymentOf(this.m, this.total(), this.m.saleDate) : null;
        if (paid) {
            body.initialPayment = paid;
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
