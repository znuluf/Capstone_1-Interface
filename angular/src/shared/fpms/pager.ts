import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Server-side paging and sorting state shared by every long list (AC-27: 25 per page by default, 100 at most). */
export class PagerState {
    page = 1;
    size = 25;
    sort = '';
    total = 0;

    constructor(defaultSort = '') {
        this.sort = defaultSort;
    }

    get pages(): number {
        return Math.max(1, Math.ceil(this.total / this.size));
    }

    get from(): number {
        return this.total === 0 ? 0 : (this.page - 1) * this.size + 1;
    }

    get to(): number {
        return Math.min(this.total, this.page * this.size);
    }

    /** Query parameters for the paged application-service calls. */
    get params(): { skipCount: number; maxResultCount: number; sorting?: string } {
        return { skipCount: (this.page - 1) * this.size, maxResultCount: this.size, sorting: this.sort || undefined };
    }

    /** After a new result arrives: remember the total and step back if the page no longer exists. */
    update(total: number): boolean {
        this.total = total;
        if (this.page > this.pages) {
            this.page = this.pages;
            return true; // caller should reload
        }
        return false;
    }

    reset(): void {
        this.page = 1;
    }

    /** Sort direction of a column key: 'asc', 'desc' or '' when the list is not sorted by it. */
    direction(key: string): 'asc' | 'desc' | '' {
        const [k, d] = this.sort.split(' ');
        return k === key ? (d === 'desc' ? 'desc' : 'asc') : '';
    }

    toggle(key: string): void {
        this.sort = this.direction(key) === 'asc' ? `${key} desc` : `${key} asc`;
        this.page = 1;
    }
}

/** Page controls under a list: "26-50 of 213", previous/next and the page size. */
@Component({
    selector: 'fpms-pager',
    standalone: true,
    template: `
        @if (state.total > 0) {
            <div class="d-flex flex-wrap align-items-center justify-content-between px-3 py-2 border-top no-print fpms-pager">
                <div class="text-muted small mb-1" role="status">{{ state.from }}–{{ state.to }} of {{ state.total }}</div>
                <div class="d-flex align-items-center mb-1">
                    <label class="small text-muted mb-0 mr-1" [attr.for]="'ps-' + id">Per page</label>
                    <select class="form-control form-control-sm mr-3" style="width:auto" [attr.id]="'ps-' + id" [ngModel]="state.size" (ngModelChange)="size($event)">
                        <option [ngValue]="25">25</option>
                        <option [ngValue]="50">50</option>
                        <option [ngValue]="100">100</option>
                    </select>
                    <button type="button" class="btn btn-sm btn-outline-secondary mr-1" [disabled]="state.page <= 1" (click)="go(state.page - 1)" aria-label="Previous page">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="small mx-1">Page {{ state.page }} of {{ state.pages }}</span>
                    <button type="button" class="btn btn-sm btn-outline-secondary ml-1" [disabled]="state.page >= state.pages" (click)="go(state.page + 1)" aria-label="Next page">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        }
    `,
    imports: [FormsModule],
})
export class PagerComponent {
    private static next = 0;
    readonly id = PagerComponent.next++;
    @Input({ required: true }) state!: PagerState;
    @Output() changed = new EventEmitter<void>();

    go(page: number): void {
        this.state.page = page;
        this.changed.emit();
    }

    size(n: number): void {
        this.state.size = Number(n);
        this.state.page = 1;
        this.changed.emit();
    }
}

/** Sortable column header: <th fpmsSort="total" [pager]="pager" (sorted)="load()">Total</th> */
@Component({
    selector: 'th[fpmsSort]',
    standalone: true,
    host: {
        '[attr.aria-sort]': 'aria()',
        '[style.cursor]': '"pointer"',
        '(click)': 'toggle()',
        '(keydown.enter)': 'toggle()',
        tabindex: '0',
        class: 'text-nowrap user-select-none',
    },
    template: `<ng-content></ng-content>
        <i class="fas ml-1 small" [class.fa-sort]="!dir()" [class.text-muted]="!dir()" [class.fa-sort-up]="dir() === 'asc'" [class.fa-sort-down]="dir() === 'desc'" aria-hidden="true"></i>`,
})
export class SortHeaderComponent {
    @Input({ required: true }) fpmsSort!: string;
    @Input({ required: true }) pager!: PagerState;
    @Output() sorted = new EventEmitter<void>();

    dir(): string {
        return this.pager.direction(this.fpmsSort);
    }

    aria(): string {
        const d = this.dir();
        return d === 'asc' ? 'ascending' : d === 'desc' ? 'descending' : 'none';
    }

    toggle(): void {
        this.pager.toggle(this.fpmsSort);
        this.sorted.emit();
    }
}
