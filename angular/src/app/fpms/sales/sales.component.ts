import { Component, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { PagerState } from '@shared/fpms/pager';
import { FPMS_IMPORTS } from '../shared-imports';

/** Sales list with payments and overdue tracking (Ref 7.3, DEC-67). Owner only. */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Sales" subtitle="Dispatch receipts, payments and balances">
            @if (can('Farm.Reports')) {
                <button class="btn btn-outline-secondary mr-2" (click)="exportCsv('ExportList', exportBody())" [disabled]="busy()"><i class="fas fa-file-csv mr-1"></i>Export CSV</button>
            }
            <a routerLink="/app/sales/new" class="btn btn-primary"><i class="fas fa-plus mr-1"></i>Record sale</a>
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="card">
                    <div class="card-body pb-1">
                        <div class="form-row align-items-end">
                            <div class="form-group col-6 col-md-2">
                                <label for="from">From</label>
                                <input id="from" type="date" class="form-control" [(ngModel)]="f.from" />
                            </div>
                            <div class="form-group col-6 col-md-2">
                                <label for="to">To</label>
                                <input id="to" type="date" class="form-control" [(ngModel)]="f.to" />
                            </div>
                            <div class="form-group col-md-3">
                                <label for="buyer">Buyer</label>
                                <select id="buyer" class="form-control" [(ngModel)]="f.buyerId">
                                    <option [ngValue]="null">All buyers</option>
                                    @for (b of buyers(); track b.id) {
                                        <option [ngValue]="b.id">{{ b.name }}</option>
                                    }
                                </select>
                            </div>
                            <div class="form-group col-md-2">
                                <label for="ps">Payment</label>
                                <select id="ps" class="form-control" [(ngModel)]="f.paymentStatus">
                                    <option [ngValue]="null">Any status</option>
                                    @for (o of Options.paymentStatus; track o.value) {
                                        <option [ngValue]="o.value">{{ o.label }}</option>
                                    }
                                </select>
                            </div>
                            <div class="form-group col-6 col-md-1">
                                <div class="custom-control custom-checkbox mb-2">
                                    <input type="checkbox" class="custom-control-input" id="od" [(ngModel)]="f.overdueOnly" />
                                    <label class="custom-control-label" for="od">Overdue</label>
                                </div>
                            </div>
                            <div class="form-group col-6 col-md-2">
                                <button class="btn btn-primary btn-block" (click)="apply()" [disabled]="busy()">Apply</button>
                            </div>
                        </div>
                    </div>
                </div>
                @if (payment) {
                    <div class="card card-outline card-success">
                        <div class="card-header"><h3 class="card-title">Add payment: {{ payment.sale.dispatchReceiptNo }}, {{ payment.sale.buyerName }} (balance {{ payment.sale.balance | php }})</h3></div>
                        <div class="card-body">
                            <div class="form-row align-items-end">
                                <div class="form-group col-md-3 mb-0">
                                    <label for="pon">Paid on</label>
                                    <input id="pon" type="date" class="form-control" [(ngModel)]="payment.paidOn" [min]="payment.sale.saleDate" [max]="today" />
                                </div>
                                <div class="form-group col-md-3 mb-0">
                                    <label for="amt">Amount (₱)</label>
                                    <input id="amt" type="number" min="0.01" step="0.01" class="form-control" [(ngModel)]="payment.amount" />
                                </div>
                                <div class="form-group col-md-3 mb-0">
                                    <label for="mth">Method</label>
                                    <input id="mth" class="form-control" [(ngModel)]="payment.method" maxlength="50" placeholder="cash, bank transfer, GCash" />
                                </div>
                                <div class="form-group col-md-3 mb-0">
                                    <button class="btn btn-outline-secondary btn-sm" (click)="payment.amount = payment.sale.balance">Pay the balance</button>
                                </div>
                            </div>
                        </div>
                        <div class="card-footer">
                            <button class="btn btn-success mr-2" [disabled]="busy() || !(payment.amount > 0) || !payment.paidOn" (click)="savePayment()">Save payment</button>
                            <button class="btn btn-default" (click)="payment = null">Cancel</button>
                        </div>
                    </div>
                }
                <div class="card">
                    <div class="card-body p-0 table-responsive">
                        @if (!sales()) {
                            <fpms-loading></fpms-loading>
                        } @else if (!sales().length) {
                            <fpms-empty text="No sales match." icon="fas fa-cash-register"></fpms-empty>
                        } @else {
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th fpmsSort="dispatchReceiptNo" [pager]="pager" (sorted)="load()">Receipt</th>
                                        <th fpmsSort="saleDate" [pager]="pager" (sorted)="load()">Date</th>
                                        <th fpmsSort="buyerName" [pager]="pager" (sorted)="load()">Buyer</th>
                                        <th>Batch</th>
                                        <th class="text-right">Kg</th>
                                        <th class="text-right" fpmsSort="total" [pager]="pager" (sorted)="load()">Total</th>
                                        <th class="text-right" fpmsSort="paid" [pager]="pager" (sorted)="load()">Paid</th>
                                        <th class="text-right" fpmsSort="balance" [pager]="pager" (sorted)="load()">Balance</th>
                                        <th fpmsSort="paymentStatus" [pager]="pager" (sorted)="load()">Payment</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (s of sales(); track s.id) {
                                        <tr>
                                            <td class="text-nowrap"><a [routerLink]="['/app/sales', s.id]">{{ s.dispatchReceiptNo }}</a></td>
                                            <td class="text-nowrap">{{ s.saleDate | farmDate }}</td>
                                            <td>{{ s.buyerName }}</td>
                                            <td>{{ s.batches }}</td>
                                            <td class="text-right">{{ s.totalKg | num: 2 }}</td>
                                            <td class="text-right">{{ s.total | php }}</td>
                                            <td class="text-right">{{ s.paid | php }}</td>
                                            <td class="text-right">{{ s.balance | php }}</td>
                                            <td class="text-nowrap">
                                                <fpms-badge [text]="s.paymentStatus | label: L.PaymentStatuses"></fpms-badge>
                                                @if (s.isOverdue) { <span class="badge badge-danger ml-1" [title]="'Due ' + (s.dueDate | farmDate)">Overdue</span> }
                                                @if (s.overpaid > 0) { <span class="badge badge-warning ml-1">Overpaid</span> }
                                            </td>
                                            <td class="text-right text-nowrap">
                                                @if (s.balance > 0) {
                                                    <button class="btn btn-sm btn-outline-success mr-1" (click)="startPayment(s)">Payment</button>
                                                }
                                                <a class="btn btn-sm btn-outline-secondary" [routerLink]="['/app/sales', s.id]" title="Dispatch receipt" aria-label="Dispatch receipt"><i class="fas fa-print"></i></a>
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                                <tfoot>
                                    <tr class="font-weight-bold">
                                        <td colspan="4">All {{ pager.total }} matching sales</td>
                                        <td class="text-right">{{ totals().totalKg | num: 2 }}</td>
                                        <td class="text-right">{{ totals().totalAmount | php }}</td>
                                        <td class="text-right">{{ totals().totalPaid | php }}</td>
                                        <td class="text-right">{{ totals().totalBalance | php }}</td>
                                        <td colspan="2">@if (totals().overdueCount) { <span class="badge badge-danger">{{ totals().overdueCount }} overdue</span> }</td>
                                    </tr>
                                </tfoot>
                            </table>
                        }
                    </div>
                    <fpms-pager [state]="pager" (changed)="load()"></fpms-pager>
                </div>
            </div>
        </section>
    `,
})
export class SalesComponent extends FpmsPage implements OnInit {
    sales = signal<any[] | null>(null);
    totals = signal<any>({});
    pager = new PagerState('saleDate desc');
    buyers = signal<any[]>([]);
    payment: any = null;
    f: any = { from: FarmTime.addDays(FarmTime.today(), -90), to: FarmTime.today(), buyerId: null, paymentStatus: null, overdueOnly: false };

    ngOnInit(): void {
        if (this.query('overdue') === '1') {
            this.f = { ...this.f, from: null, overdueOnly: true };
        }
        this.api.get<any[]>('Buyer', 'GetLookup').then((b) => this.buyers.set(b ?? []));
        this.load();
    }

    apply(): void {
        this.pager.reset();
        this.load();
    }

    async load(): Promise<void> {
        await this.run(async () => {
            const r = await this.api.get<any>('Sale', 'GetAll', { ...this.f, ...this.pager.params });
            this.totals.set(r);
            this.sales.set(r.items);
            if (this.pager.update(r.totalCount)) {
                await this.load();
            }
        });
    }

    exportBody(): Record<string, unknown> {
        return { list: 'Sales', buyerId: this.f.buyerId, from: this.f.from, to: this.f.to, paymentStatus: this.f.paymentStatus, overdueOnly: this.f.overdueOnly };
    }

    startPayment(s: any): void {
        this.payment = { sale: s, paidOn: this.today, amount: s.balance, method: '' };
    }

    async savePayment(): Promise<void> {
        const p = this.payment;
        let sale: any;
        if (await this.act(async () => (sale = await this.api.post<any>('Sale', 'AddPayment', { saleId: p.sale.id, paidOn: p.paidOn, amount: p.amount, method: p.method })))) {
            this.notifySaved('Payment recorded.');
            if (sale?.warnings?.length) {
                abp.message.warn(sale.warnings.map((w: any) => w.message).join('\n'), 'Saved with a warning');
            }
            this.payment = null;
            this.load();
        }
    }
}
