import { Component, OnInit, computed, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { PagerState } from '@shared/fpms/pager';
import { FPMS_IMPORTS } from '../shared-imports';
import { ToolbarChip } from '@shared/fpms/ui';

/** Sales list with payments and overdue tracking (Ref 7.3, DEC-67). Owner only. */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Sales" subtitle="Dispatch receipts, payments and balances.">
            @if (can('Farm.Reports')) {
                <button
                    class="btn btn-outline-secondary"
                    (click)="exportCsv('ExportList', exportBody())"
                    [disabled]="busy()">
                    <i class="fas fa-file-csv mr-1"></i>
                    Export CSV
                </button>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="card">
                    <div class="card-header">
                        <fpms-list-toolbar
                            placeholder="Search by receipt, buyer or batch"
                            [search]="f.search"
                            [resultText]="resultText()"
                            [chips]="chips()"
                            [chip]="f.overdueOnly ? 'overdue' : f.paymentStatus"
                            (searchChange)="onSearch($event)"
                            (chipChange)="onPayment($event)">
                            <label class="sl-field">
                                <span>Buyer</span>
                                <select
                                    class="form-control form-control-sm"
                                    [(ngModel)]="f.buyerId"
                                    (ngModelChange)="apply()">
                                    <option [ngValue]="null">All buyers</option>
                                    @for (b of buyers(); track b.id) {
                                        <option [ngValue]="b.id">{{ b.name }}</option>
                                    }
                                </select>
                            </label>
                            <span class="sl-range" role="group" aria-label="Dates">
                            <label class="sl-field">
                                <span>From</span>
                                <input
                                    type="date"
                                    class="form-control form-control-sm"
                                    [(ngModel)]="f.from"
                                    (ngModelChange)="apply()" />
                            </label>
                            <label class="sl-field">
                                <span>To</span>
                                <input
                                    type="date"
                                    class="form-control form-control-sm"
                                    [(ngModel)]="f.to"
                                    (ngModelChange)="apply()" />
                            </label>
                            </span>
                        </fpms-list-toolbar>
                        @if (filterTags().length) {
                            <div class="fpms-filter-tags" role="group" aria-label="Filters in use">
                                <span class="small text-muted">Filters:</span>
                                @for (t of filterTags(); track t.label) {
                                    <button type="button" class="fpms-filter-tag" (click)="t.clear()" [attr.aria-label]="'Remove filter ' + t.label">{{ t.label }} <i class="fas fa-times" aria-hidden="true"></i></button>
                                }
                                <button type="button" class="btn btn-link btn-sm p-0 ml-1" (click)="clearFilters()">Clear all</button>
                            </div>
                        }
                    </div>
                </div>
                @if (payment) {
                    <div class="card card-outline card-primary">
                        <div class="card-header">
                            <h3 class="card-title">
                                <i class="fas fa-money-bill-wave" aria-hidden="true"></i>
                                Add payment: {{ payment.sale.dispatchReceiptNo }}, {{ payment.sale.buyerName }} (balance
                                {{ payment.sale.balance | php }})
                            </h3>
                        </div>
                        <div class="card-body">
                            <div class="form-row align-items-end">
                                <div class="form-group col-md-3 mb-0">
                                    <label for="pon">Paid on</label>
                                    <input
                                        id="pon"
                                        type="date"
                                        class="form-control"
                                        [(ngModel)]="payment.paidOn"
                                        [min]="payment.sale.saleDate"
                                        [max]="today" />
                                </div>
                                <div class="form-group col-md-3 mb-0">
                                    <label for="amt">Amount (₱)</label>
                                    <input
                                        id="amt"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        class="form-control"
                                        [(ngModel)]="payment.amount" />
                                </div>
                                <div class="form-group col-md-3 mb-0">
                                    <label for="mth">Method</label>
                                    <input
                                        id="mth"
                                        class="form-control"
                                        [(ngModel)]="payment.method"
                                        maxlength="50"
                                        placeholder="cash, bank transfer, GCash" />
                                </div>
                                <div class="form-group col-md-3 mb-0">
                                    <button
                                        class="btn btn-outline-secondary btn-sm"
                                        (click)="payment.amount = payment.sale.balance">
                                        Pay the balance
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="card-footer">
                            <button
                                class="btn btn-primary mr-2"
                                [disabled]="busy() || !(payment.amount > 0) || !payment.paidOn"
                                (click)="savePayment()">
                                Save payment
                            </button>
                            <button class="btn btn-default" (click)="payment = null">Cancel</button>
                        </div>
                    </div>
                }
                <div class="card">
                    <div class="card-body p-0 table-responsive">
                        @if (!sales()) {
                            <fpms-loading></fpms-loading>
                        } @else if (!sales().length) {
                            <fpms-empty [text]="emptyText()" icon="fas fa-cash-register">
                                @if (f.from || f.to) {
                                    <button type="button" class="btn btn-sm btn-outline-primary" (click)="allDates()">Show sales of all dates</button>
                                }
                            </fpms-empty>
                        } @else {
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <!-- Date and receipt share a column, buyer and batch share one, balance and due date share one (DEC-99). -->
                                        <th fpmsSort="saleDate" [pager]="pager" (sorted)="load()">Date · receipt</th>
                                        <th fpmsSort="buyerName" [pager]="pager" (sorted)="load()">Buyer · batch</th>
                                        <th>Lot code</th>
                                        <th class="text-right" fpmsSort="totalKg" [pager]="pager" (sorted)="load()">Kg</th>
                                        <th class="text-right" fpmsSort="total" [pager]="pager" (sorted)="load()">
                                            Total
                                        </th>
                                        <th class="text-right" fpmsSort="balance" [pager]="pager" (sorted)="load()">
                                            Balance
                                        </th>
                                        <th fpmsSort="paymentStatus" [pager]="pager" (sorted)="load()">Payment</th>
                                        <th><span class="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (s of sales(); track s.id) {
                                        <tr>
                                            <td class="text-nowrap">
                                                {{ s.saleDate | farmDate }}
                                                <div><a [routerLink]="['/app/sales', s.id]">{{ s.dispatchReceiptNo }}</a></div>
                                            </td>
                                            <td>
                                                {{ s.buyerName }}
                                                @if (s.batches) { <div class="text-muted">{{ s.batches }}</div> }
                                            </td>
                                            <td class="text-nowrap text-monospace small">
                                                @for (c of lotCodes(s); track c) {
                                                    <div>
                                                        @if (can('Farm.Reports')) {
                                                            <a [routerLink]="['/app/reports/trace/lot', c]" [queryParams]="{ from: 'sales' }" title="Trace this lot">{{ c }}</a>
                                                        } @else {
                                                            {{ c }}
                                                        }
                                                    </div>
                                                } @empty {
                                                    <span class="fpms-none">—</span>
                                                }
                                            </td>
                                            <td class="text-right">{{ s.totalKg | num: 2 }}</td>
                                            <td class="text-right">
                                                {{ s.total | php }}
                                                @if (s.paid > 0 && s.paid !== s.total) { <div class="text-muted">paid {{ s.paid | php }}</div> }
                                            </td>
                                            <td class="text-right">
                                                {{ s.balance | php }}
                                                @if (s.dueDate && s.balance > 0) { <div class="text-muted" [class.text-danger]="s.isOverdue">due {{ s.dueDate | farmDate }}</div> }
                                            </td>
                                            <!-- Status badges stack, so a partly paid, overdue sale keeps the table inside the card. -->
                                            <td class="text-nowrap fpms-badge-stack">
                                                <fpms-badge
                                                    [text]="s.paymentStatus | label: L.PaymentStatuses"></fpms-badge>
                                                @if (s.isOverdue) {
                                                    <span
                                                        class="badge badge-danger"
                                                        [title]="'Due ' + (s.dueDate | farmDate)">
                                                        Overdue
                                                    </span>
                                                }
                                                @if (s.overpaid > 0) {
                                                    <span class="badge badge-warning">Overpaid</span>
                                                }
                                            </td>
                                            <td class="text-right text-nowrap">
                                                @if (s.balance > 0) {
                                                    <button
                                                        class="btn btn-sm btn-outline-primary mr-1"
                                                        (click)="startPayment(s)">
                                                        Payment
                                                    </button>
                                                }
                                                <a
                                                    class="btn btn-sm btn-outline-secondary"
                                                    [routerLink]="['/app/sales', s.id]"
                                                    title="Dispatch receipt"
                                                    aria-label="Dispatch receipt">
                                                    <i class="fas fa-print"></i>
                                                </a>
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                                <tfoot>
                                    <tr class="font-weight-bold">
                                        <td colspan="3">All {{ pager.total }} matching sales</td>
                                        <td class="text-right">{{ totals().totalKg | num: 2 }}</td>
                                        <td class="text-right">
                                            {{ totals().totalAmount | php }}
                                            <div class="font-weight-normal text-muted">paid {{ totals().totalPaid | php }}</div>
                                        </td>
                                        <td class="text-right">{{ totals().totalBalance | php }}</td>
                                        <td colspan="2">
                                            @if (totals().overdueCount) {
                                                <span class="badge badge-danger">
                                                    {{ totals().overdueCount }} overdue
                                                </span>
                                            }
                                        </td>
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
    styles: [
        `
            .sl-field {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin: 0;
                font-weight: 400;
                font-size: 0.9rem;
                color: var(--fpms-muted);
            }
            .sl-field .form-control {
                height: 38px;
                width: auto;
            }
        `,
    ],
})
export class SalesComponent extends FpmsPage implements OnInit {
    sales = signal<any[] | null>(null);
    totals = signal<any>({});
    pager = new PagerState('saleDate desc');
    buyers = signal<any[]>([]);
    payment: any = null;
    counts = signal<Record<number, number>>({});
    f: any = {
        search: '',
        from: FarmTime.addDays(FarmTime.today(), -90),
        to: FarmTime.today(),
        buyerId: null,
        paymentStatus: null,
        overdueOnly: false,
    };

    chips = computed<ToolbarChip[]>(() => {
        const c = this.counts();
        // Status 9 is the overdue count (those sales are also counted under Unpaid or Partial), so it is left out of "All".
        const all = this.Options.paymentStatus.reduce((n: number, o: any) => n + (c[o.value] ?? 0), 0);
        return [
            { value: null, label: 'All payments', count: all },
            ...this.Options.paymentStatus.map((o: any) => ({ value: o.value, label: o.label, count: c[o.value] ?? 0 })),
            { value: 'overdue', label: 'Overdue', count: c[9] ?? 0 },
        ];
    });

    resultText = computed(() => {
        const n = this.totals().totalCount ?? 0;
        return n === 1 ? '1 sale' : `${n} sales`;
    });

    ngOnInit(): void {
        if (this.query('overdue') === '1') {
            this.f = { ...this.f, from: null, overdueOnly: true };
        }
        this.restoreList(this.pager, this.f, {
            search: 'string',
            from: 'string',
            to: 'string',
            buyerId: 'string',
            paymentStatus: 'number',
            overdueOnly: 'boolean',
        });
        this.api.get<any[]>('Buyer', 'GetLookup').then((b) => this.buyers.set(b ?? []));
        this.load();
    }

    apply(): void {
        this.pager.reset();
        this.load();
    }

    onSearch(value: string): void {
        this.f.search = value;
        this.apply();
    }

    /** A payment chip, or "Overdue": unpaid or partly paid sales past their due date. */
    onPayment(value: unknown): void {
        this.f.overdueOnly = value === 'overdue';
        this.f.paymentStatus = value === 'overdue' ? null : (value as number | null);
        this.apply();
    }

    /** The lot codes a sale sold from, each once. */
    lotCodes(sale: any): string[] {
        return [...new Set<string>((sale.lines ?? []).map((l: any) => l.lotCode).filter((c: any) => !!c))];
    }

    /** Every filter in use as a removable tag, so a filtered list never looks like an empty one (the list opens on the last 90 days). */
    filterTags(): { label: string; clear: () => void }[] {
        const f = this.f;
        const tags: { label: string; clear: () => void }[] = [];
        const add = (label: string, clear: () => void) => tags.push({ label, clear: () => { clear(); this.apply(); } });
        if (f.search) { add(`"${f.search}"`, () => (f.search = '')); }
        if (f.overdueOnly) { add('Overdue', () => (f.overdueOnly = false)); }
        if (f.paymentStatus != null) { add(this.Options.paymentStatus.find((o: any) => o.value === f.paymentStatus)?.label ?? 'Payment', () => (f.paymentStatus = null)); }
        if (f.buyerId) { add(this.buyers().find((b) => b.id === f.buyerId)?.name ?? 'Buyer', () => (f.buyerId = null)); }
        if (f.from) { add('From ' + FarmTime.date(f.from), () => (f.from = null)); }
        if (f.to) { add('To ' + FarmTime.date(f.to), () => (f.to = null)); }
        return tags;
    }

    clearFilters(): void {
        Object.assign(this.f, { search: '', from: null, to: null, buyerId: null, paymentStatus: null, overdueOnly: false });
        this.apply();
    }

    async load(): Promise<void> {
        await this.run(async () => {
            const q = { ...this.f, search: this.f.search || undefined };
            const [r, counts] = await Promise.all([
                this.api.get<any>('Sale', 'GetAll', { ...q, ...this.pager.params }),
                this.api.get<any[]>('Sale', 'GetPaymentStatusCounts', q),
            ]);
            this.counts.set(Object.fromEntries((counts ?? []).map((x) => [x.status, x.count])));
            this.totals.set(r);
            this.sales.set(r.items);
            const reload = this.pager.update(r.totalCount);
            this.syncPager(this.pager);
            if (reload) {
                await this.load();
            }
        });
    }

    /** Says why the list is empty: other filters, the date range (the list opens on the last 90 days), or no sales at all. */
    emptyText(): string {
        if (this.f.search || this.f.buyerId || this.f.paymentStatus != null || this.f.overdueOnly) {
            return 'No sales match these filters.';
        }
        if (this.f.from || this.f.to) {
            return `No sales dated ${this.f.from ? 'from ' + this.f.from : ''}${this.f.from && this.f.to ? ' ' : ''}${this.f.to ? 'to ' + this.f.to : ''}. The list opens on the last 90 days; older sales are outside it.`;
        }
        return 'No sales recorded yet. Record one with "Record sale", or from a harvest with "Sell this harvest".';
    }

    allDates(): void {
        this.f.from = null;
        this.f.to = null;
        this.apply();
    }

    exportBody(): Record<string, unknown> {
        return {
            list: 'Sales',
            search: this.f.search || null,
            buyerId: this.f.buyerId,
            from: this.f.from,
            to: this.f.to,
            paymentStatus: this.f.paymentStatus,
            overdueOnly: this.f.overdueOnly,
        };
    }

    startPayment(s: any): void {
        this.payment = { sale: s, paidOn: this.today, amount: s.balance, method: '' };
    }

    async savePayment(): Promise<void> {
        const p = this.payment;
        let sale: any;
        if (
            await this.act(
                async () =>
                    (sale = await this.api.post<any>('Sale', 'AddPayment', {
                        saleId: p.sale.id,
                        paidOn: p.paidOn,
                        amount: p.amount,
                        method: p.method,
                    }))
            )
        ) {
            this.notifySaved('Payment recorded.');
            if (sale?.warnings?.length) {
                this.showWarnings(sale.warnings);
            }
            this.payment = null;
            this.load();
        }
    }
}
