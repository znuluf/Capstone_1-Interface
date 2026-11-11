import { Component, OnInit, signal, inject } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { SectionNav } from '@shared/layout/section-nav.service';
import { EMPTY_GUID } from '@shared/fpms/farm-time';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * Price tables by count (DEC-82): a price per kg for each count range (pieces per kg), for one buyer or any. A sale line
 * priced "From a price table" reads the row covering the shrimp's count; it keeps a copy, so editing a table changes no sale.
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Price tables" subtitle="Prices per kg by count (pieces per kg), e.g. a buyer's weekly price list.">
            @if (canManage && !editing) {
                <button class="btn btn-primary" (click)="edit(null)"><i class="fas fa-plus mr-1"></i>New price table</button>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (editing) {
                    <div class="card card-outline card-primary">
                        <div class="card-header"><h3 class="card-title">{{ editing.id === emptyId ? 'New price table' : 'Edit ' + editing.name }}</h3></div>
                        <form class="card-body" #f="ngForm" (ngSubmit)="save()" novalidate>
                            <div class="form-row">
                                <div class="form-group col-md-5">
                                    <label for="tn">Name <span class="text-danger">*</span></label>
                                    <input id="tn" class="form-control" name="name" [(ngModel)]="editing.name" required maxlength="60" placeholder="e.g. Mindanao Processing, November" />
                                </div>
                                <div class="form-group col-md-5">
                                    <label for="tb">For buyer</label>
                                    <select id="tb" class="form-control" name="buyerId" [(ngModel)]="editing.buyerId">
                                        <option value="">Any buyer</option>
                                        @for (b of buyers; track b.id) { <option [value]="b.id">{{ b.name }}</option> }
                                    </select>
                                    <small class="form-text text-muted">A buyer's own table is suggested on their next sale.</small>
                                </div>
                                <div class="form-group col-md-2 d-flex align-items-center">
                                    <div class="custom-control custom-checkbox mt-3">
                                        <input type="checkbox" class="custom-control-input" id="ta" name="isActive" [(ngModel)]="editing.isActive" />
                                        <label class="custom-control-label" for="ta">Active</label>
                                    </div>
                                </div>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-sm mb-2">
                                    <thead><tr><th>From count (pcs/kg)</th><th>To count (pcs/kg)</th><th>Price per kg (₱) <span class="text-danger">*</span></th><th></th></tr></thead>
                                    <tbody>
                                        @for (r of editing.rows; track $index) {
                                            <tr>
                                                <td><input type="number" min="1" step="1" class="form-control form-control-sm" [name]="'rmin' + $index" [(ngModel)]="r.minCountPerKg" placeholder="no lower limit" aria-label="From count" /></td>
                                                <td><input type="number" min="1" step="1" class="form-control form-control-sm" [name]="'rmax' + $index" [(ngModel)]="r.maxCountPerKg" placeholder="no upper limit" aria-label="To count" /></td>
                                                <td><input type="number" min="0" step="0.01" class="form-control form-control-sm" [name]="'rp' + $index" [(ngModel)]="r.pricePerKg" required aria-label="Price per kg" /></td>
                                                <td class="text-right">
                                                    <button type="button" class="btn btn-sm btn-outline-danger" (click)="editing.rows.splice($index, 1)" aria-label="Remove row"><i class="fas fa-times"></i></button>
                                                </td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-secondary mb-3" (click)="addRow()"><i class="fas fa-plus mr-1"></i>Add count range</button>
                            <p class="small text-muted">A smaller count means bigger shrimp. Ranges may not overlap; leave an end empty for "up to" or "and above".</p>
                            <button type="submit" class="btn btn-primary mr-2" [disabled]="busy() || !f.form.valid || !editing.rows.length">Save table</button>
                            <button type="button" class="btn btn-default" (click)="editing = null">Cancel</button>
                        </form>
                    </div>
                }
                @if (!tables()) {
                    <fpms-loading></fpms-loading>
                } @else if (!tables()?.length) {
                    <div class="card"><div class="card-body"><fpms-empty text="No price tables yet. Add one when a buyer prices by count, e.g. 41–50 pcs/kg at ₱400." icon="fas fa-table"></fpms-empty></div></div>
                } @else {
                    <div class="row">
                        @for (t of tables(); track t.id) {
                            <div class="col-lg-6">
                                <div class="card" [class.text-muted]="!t.isActive">
                                    <div class="card-header d-flex align-items-center">
                                        <h3 class="card-title mr-auto">{{ t.name }}{{ t.isActive ? '' : ' (inactive)' }}</h3>
                                        <span class="small mr-2">{{ t.buyerName || 'Any buyer' }}</span>
                                        @if (canManage) { <button class="btn btn-sm btn-outline-primary" (click)="edit(t)">Edit</button> }
                                    </div>
                                    <div class="card-body p-0">
                                        <table class="table table-sm mb-0">
                                            <thead><tr><th>Count</th><th class="text-right">Price per kg</th></tr></thead>
                                            <tbody>
                                                @for (r of t.rows; track $index) {
                                                    <tr><td>{{ r.label }}</td><td class="text-right">{{ r.pricePerKg | php }}</td></tr>
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        }
                    </div>
                }
            </div>
        </section>
    `,
})
export class PriceTablesComponent extends FpmsPage implements OnInit {
    /** Keeps this list's count on the Setup tab bar in step with the list (DEC-85 step 7). */
    private sectionNav = inject(SectionNav);
    readonly emptyId = EMPTY_GUID;
    tables = signal<any[] | null>(null);
    buyers: any[] = [];
    editing: any = null;

    get canManage(): boolean {
        return this.can('Farm.Production.Manage');
    }

    ngOnInit(): void {
        this.load();
    }

    async load(): Promise<void> {
        const [tables, buyers] = await Promise.all([this.api.get<any[]>('PriceTable', 'GetAll'), this.api.get<any[]>('TallySheet', 'GetBuyerOptions')]);
        this.buyers = buyers.filter((b) => b.isActive);
        this.tables.set(tables);
        this.sectionNav.setCount('/app/sales/price-tables', (this.tables() ?? []).length);
    }

    edit(t: any): void {
        this.editing = t
            ? { ...t, buyerId: t.buyerId ?? '', rows: t.rows.map((r: any) => ({ ...r })) }
            : { id: EMPTY_GUID, name: '', buyerId: '', isActive: true, rows: [{ minCountPerKg: null, maxCountPerKg: null, pricePerKg: null }] };
    }

    /** The next range starts after the last one ends. */
    addRow(): void {
        const last = this.editing.rows[this.editing.rows.length - 1];
        const from = last?.maxCountPerKg ? Number(last.maxCountPerKg) + 1 : null;
        this.editing.rows.push({ minCountPerKg: from, maxCountPerKg: null, pricePerKg: null });
    }

    async save(): Promise<void> {
        const n = (v: any) => (v === '' || v == null ? null : Number(v));
        const body = {
            id: this.editing.id, name: this.editing.name, buyerId: this.editing.buyerId || null, isActive: this.editing.isActive,
            rows: this.editing.rows.map((r: any) => ({ minCountPerKg: n(r.minCountPerKg), maxCountPerKg: n(r.maxCountPerKg), pricePerKg: Number(r.pricePerKg) || 0 })),
        };
        if (await this.act(() => this.api.post('PriceTable', 'Save', body))) {
            this.notifySaved('Price table saved.');
            this.editing = null;
            await this.load();
        }
    }
}
