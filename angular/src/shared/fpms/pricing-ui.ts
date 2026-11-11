import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FPMS_PIPES } from './pipes';
import { priceOverridden, priceWorking, referencePrice, usedAbw, usedCount } from './pricing';

/**
 * The terms of a priced method (Base ABW, Base count, Price table) with the working and the "price differs" warning: one
 * block for every form that records a sale, so the harvest form and the Sales form look and behave the same (DEC-85).
 * It edits `t` in place (the sale line, or the harvest form's sale) and shows nothing for a Fixed price. The inputs
 * belong to the surrounding form, so its validity and the form hint cover them. `changed` fires after any term changes;
 * the page then applies the method's price to its own price field.
 */
@Component({
    selector: 'fpms-price-terms',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, ...FPMS_PIPES],
    viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
    template: `
        @if (t && t.priceMethod > 1) {
            <div class="form-row align-items-end">
                @if (t.priceMethod === 2 || t.priceMethod === 3) {
                    <div class="form-group col-6 col-md-3 mb-1">
                        <label class="small mb-0" [for]="key + 'bp'">Base price (₱/kg)</label>
                        <input [id]="key + 'bp'" type="number" min="0" step="0.01" class="form-control form-control-sm" [name]="key + 'bp'" [(ngModel)]="t.basePricePerKg" (ngModelChange)="changed.emit()" required />
                    </div>
                }
                @if (t.priceMethod === 2) {
                    <div class="form-group col-6 col-md-2 mb-1">
                        <label class="small mb-0" [for]="key + 'ba'">at ABW (g)</label>
                        <input [id]="key + 'ba'" type="number" min="0.01" max="60" step="0.01" class="form-control form-control-sm" [name]="key + 'ba'" [(ngModel)]="t.baseAbwG" (ngModelChange)="changed.emit()" required />
                    </div>
                    <div class="form-group col-6 col-md-2 mb-1">
                        <label class="small mb-0" [for]="key + 'st'">+ ₱ per g</label>
                        <input [id]="key + 'st'" type="number" min="0" step="0.01" class="form-control form-control-sm" [name]="key + 'st'" [(ngModel)]="t.stepPerG" (ngModelChange)="changed.emit()" required />
                    </div>
                    <div class="form-group col-6 col-md-2 mb-1">
                        @if (editShrimp) {
                            <label class="small mb-0" [for]="key + 'pa'">Shrimp ABW (g)</label>
                            <input [id]="key + 'pa'" type="number" min="0.01" max="60" step="0.01" class="form-control form-control-sm" [name]="key + 'pa'" [(ngModel)]="t.priceAbwG" (ngModelChange)="changed.emit()" [placeholder]="abw ?? ''" [required]="abw == null" />
                        } @else {
                            <span class="small d-block">Shrimp ABW (g)</span>
                            <span class="small">{{ abw != null ? (abw | num: 2) + ' (' + shrimpSource + ')' : shrimpMissing }}</span>
                        }
                    </div>
                }
                @if (t.priceMethod === 3) {
                    <div class="form-group col-6 col-md-2 mb-1">
                        <label class="small mb-0" [for]="key + 'bc'">at count (pcs/kg)</label>
                        <input [id]="key + 'bc'" type="number" min="1" step="1" class="form-control form-control-sm" [name]="key + 'bc'" [(ngModel)]="t.baseCountPerKg" (ngModelChange)="changed.emit()" required />
                    </div>
                    <div class="form-group col-6 col-md-2 mb-1">
                        <label class="small mb-0" [for]="key + 'sc'">+ ₱ per piece fewer</label>
                        <input [id]="key + 'sc'" type="number" min="0" step="0.01" class="form-control form-control-sm" [name]="key + 'sc'" [(ngModel)]="t.stepPerCount" (ngModelChange)="changed.emit()" required />
                    </div>
                }
                @if (t.priceMethod === 4) {
                    <div class="form-group col-12 col-md-5 mb-1">
                        <label class="small mb-0" [for]="key + 'tb'">Price table</label>
                        <select [id]="key + 'tb'" class="custom-select custom-select-sm" [name]="key + 'tb'" [(ngModel)]="t.priceTableId" (ngModelChange)="changed.emit()" required>
                            <option value="">Choose…</option>
                            @for (x of tables; track x.id) {
                                <option [value]="x.id">{{ x.name }}{{ x.buyerName ? ' (' + x.buyerName + ')' : '' }}</option>
                            }
                        </select>
                        @if (!tables?.length) {
                            <small class="text-muted">No price tables yet. <a routerLink="/app/sales/price-tables">Add one</a>.</small>
                        }
                    </div>
                }
                @if (t.priceMethod === 3 || t.priceMethod === 4) {
                    <div class="form-group col-6 col-md-2 mb-1">
                        @if (editShrimp) {
                            <label class="small mb-0" [for]="key + 'pc'">Count (pcs/kg)</label>
                            <input [id]="key + 'pc'" type="number" min="1" step="1" class="form-control form-control-sm" [name]="key + 'pc'" [(ngModel)]="t.priceCountPerKg" (ngModelChange)="changed.emit()" [placeholder]="count ?? ''" [required]="count == null" />
                        } @else {
                            <span class="small d-block">Count (pcs/kg)</span>
                            <span class="small">{{ count != null ? count + ' (from the ABW)' : shrimpMissing }}</span>
                        }
                    </div>
                }
                <div class="form-group col-12 col-md-3 mb-1 small">
                    @if (formula() !== null) {
                        <div>{{ working() }} = <strong>{{ formula() | php }}</strong></div>
                        @if (overridden()) {
                            <div class="text-warning-dark">Price differs. <a href="javascript:;" (click)="useFormula()">Use {{ formula() | php }}</a></div>
                        }
                    } @else if (t.priceMethod === 4 && t.priceTableId && countUsed() !== null) {
                        <div class="text-danger">No row of this table covers {{ countUsed() }} pcs/kg.</div>
                    }
                    @if (termsFrom) {
                        <div class="text-muted">Terms from {{ termsFrom }}; check them.</div>
                    }
                </div>
            </div>
        }
    `,
})
export class PriceTermsComponent {
    /** The object holding the terms and `pricePerKg`: a sale line, or the harvest form's sale. Edited in place. */
    @Input() t: any;
    /** The price tables this buyer may use, the buyer's own first. */
    @Input() tables: any[] = [];
    /** Prefix that keeps the control names unique in the form, e.g. "l0" for the first sale line. */
    @Input() key = 'pt';
    /** The harvest's sampled ABW (g), used unless the line types its own. */
    @Input() abw: number | null = null;
    /** The default count (pcs/kg): the grade's middle count, else from the harvest's ABW. */
    @Input() count: number | null = null;
    /** When true the shrimp's ABW and count can be typed over; when false they are shown as read from the harvest. */
    @Input() editShrimp = true;
    @Input() shrimpSource = 'from the harvest';
    @Input() shrimpMissing = 'Enter the ABW above';
    /** The dispatch receipt the terms were copied from, when they were. */
    @Input() termsFrom: string | null = null;
    @Output() changed = new EventEmitter<void>();

    abwUsed(): number | null {
        return usedAbw(this.t, this.abw);
    }

    countUsed(): number | null {
        return usedCount(this.t, this.count);
    }

    formula(): number | null {
        return referencePrice(this.t, this.abwUsed(), this.countUsed(), this.tables ?? []);
    }

    working(): string {
        return priceWorking(this.t, this.abwUsed(), this.countUsed(), this.tables ?? []);
    }

    overridden(): boolean {
        return priceOverridden(this.t.pricePerKg, this.formula());
    }

    useFormula(): void {
        this.t.pricePerKg = this.formula();
        this.changed.emit();
    }
}

/**
 * Payment terms, due date and, for a new sale, the amount paid now: one block for every form that records a sale
 * (DEC-85). It edits `m` in place (`paymentTerms`, `dueDate`, `paidNow`, `paidMethod`).
 */
@Component({
    selector: 'fpms-sale-payment',
    standalone: true,
    imports: [CommonModule, FormsModule, ...FPMS_PIPES],
    viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
    template: `
        @if (m) {
            <div class="form-row">
                <div class="form-group col-md-4">
                    <label [for]="key + 'pt'">Payment terms</label>
                    <input [id]="key + 'pt'" class="form-control" [name]="key + 'pt'" [(ngModel)]="m.paymentTerms" (ngModelChange)="changed.emit()" maxlength="200" placeholder="e.g. cash, 50% on delivery, balance in 15 days" />
                </div>
                <div class="form-group col-md-4">
                    <label [for]="key + 'dd'">Due date</label>
                    <input [id]="key + 'dd'" type="date" class="form-control" [name]="key + 'dd'" [(ngModel)]="m.dueDate" (ngModelChange)="changed.emit()" [min]="minDue || null" />
                    <small class="form-text text-muted">For credit; shows Overdue when unpaid after it.</small>
                </div>
                @if (showPaidNow) {
                    <div class="form-group col-md-4">
                        <label [for]="key + 'pn'">Paid now (₱)</label>
                        <div class="input-group">
                            <input [id]="key + 'pn'" type="number" min="0" step="0.01" class="form-control" [name]="key + 'pn'" [(ngModel)]="m.paidNow" (ngModelChange)="changed.emit()" />
                            <div class="input-group-append">
                                <button type="button" class="btn btn-outline-secondary" (click)="payInFull()">Paid in full</button>
                            </div>
                        </div>
                        <input class="form-control form-control-sm mt-1" [name]="key + 'pm'" [(ngModel)]="m.paidMethod" (ngModelChange)="changed.emit()" maxlength="50" placeholder="cash, bank transfer, GCash" aria-label="Payment method" />
                    </div>
                }
            </div>
            @if (showPaidNow) {
                <small class="form-text text-muted">Later payments are recorded from the sales list or the dispatch receipt.</small>
            }
        }
    `,
})
export class SalePaymentComponent {
    @Input() m: any;
    @Input() key = 'pay';
    /** The sale total, for "Paid in full". */
    @Input() total = 0;
    /** The sale date: the due date cannot be before it. */
    @Input() minDue: string | null = null;
    /** Only a new sale takes a payment on the form; later payments are recorded from the sales list. */
    @Input() showPaidNow = true;
    @Output() changed = new EventEmitter<void>();

    payInFull(): void {
        this.m.paidNow = this.total;
        this.changed.emit();
    }
}
