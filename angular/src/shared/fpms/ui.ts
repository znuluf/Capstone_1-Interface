import { PagerComponent, SortHeaderComponent } from './pager';
export { PagerComponent, SortHeaderComponent, PagerState } from './pager';
import { Component, ElementRef, HostListener, Input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgForm } from '@angular/forms';
import { NavHistory } from './nav-history';
import { toneFor } from './labels';

/** Status shown as text plus color (UI brief: never color alone). */
@Component({
    selector: 'fpms-badge',
    standalone: true,
    template: `<span class="badge fpms-badge badge-{{ tone || toneOf(text) }}"
        >{{ text }}</span
    >`,
})
export class StatusBadgeComponent {
    @Input() text = '';
    @Input() tone?: string;

    toneOf(label: string): string {
        return toneFor(label);
    }
}

@Component({
    selector: 'fpms-page-header',
    standalone: true,
    imports: [RouterLink],
    template: `
        <section class="content-header fpms-page-header no-print">
            <div class="container-fluid" [class.fpms-narrow]="narrow">
                <div class="d-flex flex-wrap align-items-center justify-content-between">
                    <div class="mb-2">
                        @if (backLink) {
                            @if (previous(); as prev) {
                                <a [href]="prev" (click)="goBack($event, prev)" class="text-muted small d-inline-block mb-1">
                                    <i class="fas fa-arrow-left mr-1"></i>{{ isParent(prev) ? backLabel : 'Back' }}
                                </a>
                            } @else {
                                <a [routerLink]="backLink" class="text-muted small d-inline-block mb-1">
                                    <i class="fas fa-arrow-left mr-1"></i>{{ backLabel }}
                                </a>
                            }
                        }
                        <h1 class="m-0">{{ title }}</h1>
                        @if (subtitle) {
                            <div class="text-muted">{{ subtitle }}</div>
                        }
                    </div>
                    <div class="mb-2 fpms-actions"><ng-content></ng-content></div>
                </div>
            </div>
        </section>
    `,
})
export class PageHeaderComponent {
    @Input() title = '';
    @Input() subtitle?: string;
    @Input() backLink?: string | any[];
    @Input() backLabel = 'Back';
    /** Match the page's narrow content width (see .fpms-narrow). */
    @Input() narrow = false;

    private history = inject(NavHistory);
    private router = inject(Router);

    /** The fixed parent as a URL (without a query string), for comparing with the page the user came from. */
    parentUrl(): string {
        return this.router.serializeUrl(this.router.createUrlTree(Array.isArray(this.backLink) ? this.backLink : [this.backLink ?? '']));
    }

    isParent(url: string): boolean {
        return url.split(/[?#]/)[0] === this.parentUrl();
    }

    /** Where the user came from, when that is a page worth returning to. */
    previous(): string | null {
        return this.history.previous();
    }

    goBack(event: Event, url: string): void {
        event.preventDefault();
        this.router.navigateByUrl(url);
    }
}

@Component({
    selector: 'fpms-empty',
    standalone: true,
    template: `
        <div class="fpms-empty text-center text-muted py-4">
            <i class="{{ icon }} fa-2x mb-2 d-block" aria-hidden="true"></i>
            <div class="mb-2">{{ text }}</div>
            <ng-content></ng-content>
        </div>
    `,
})
export class EmptyStateComponent {
    @Input() text = 'Nothing here yet.';
    @Input() icon = 'far fa-folder-open';
}

/** Non-blocking warnings returned by the API (out-of-range readings, stock shortfalls, compliance gaps). */
@Component({
    selector: 'fpms-warnings',
    standalone: true,
    template: `
        @if (warnings?.length) {
            <div class="alert alert-warning fpms-warning" role="status">
                <i class="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i><strong>{{ warnings.length === 1 ? 'Saved with a warning' : 'Saved with ' + warnings.length + ' warnings' }}</strong>
                <ul class="mb-0 mt-1 pl-3">
                    @for (w of warnings; track $index) {
                        <li>{{ w.message }}</li>
                    }
                </ul>
            </div>
        }
    `,
})
export class WarningsComponent {
    @Input() warnings: { kind: string; message: string }[] = [];
}

@Component({
    selector: 'fpms-loading',
    standalone: true,
    template: `<div class="text-center text-muted py-4 fpms-loading" role="status" aria-live="polite"><i class="fas fa-spinner fa-spin mr-2" aria-hidden="true"></i>Loading…</div>`,
})
export class LoadingComponent {}

/**
 * Explains a disabled save button: shown next to it while the form is invalid, with a link that
 * highlights the fields that need attention and moves focus to the first one.
 */
@Component({
    selector: 'fpms-form-hint',
    standalone: true,
    template: `
        @if (form?.invalid) {
            <span class="fpms-form-hint" role="status">
                <i class="fas fa-info-circle mr-1" aria-hidden="true"></i>Some required fields are empty or not valid.
                <button type="button" class="btn btn-link p-0 align-baseline fpms-form-hint-link" (click)="show()">Show them</button>
            </span>
        }
    `,
})
export class FormHintComponent {
    @Input({ required: true }) form!: NgForm | null;

    show(): void {
        this.form?.form.markAllAsTouched();
        setTimeout(() => (document.querySelector('form .form-control.ng-invalid, form .custom-select.ng-invalid') as HTMLElement | null)?.focus());
    }
}

/**
 * "More" menu for page-header actions that are rare or drastic (close, reopen, declare failure, export).
 * Built on <details>, so it works with keyboard and screen readers without extra libraries.
 * Put <button class="dropdown-item"> or <a class="dropdown-item"> children inside.
 */
@Component({
    selector: 'fpms-more',
    standalone: true,
    template: `
        <details class="fpms-more" #d>
            <summary class="btn btn-outline-secondary">{{ label }}<i class="fas fa-chevron-down ml-2" aria-hidden="true"></i></summary>
            <div class="fpms-more-menu" role="menu"><ng-content></ng-content></div>
        </details>
    `,
})
export class MoreMenuComponent {
    @Input() label = 'More';
    private host = inject(ElementRef<HTMLElement>);

    private close(): void {
        const d = this.host.nativeElement.querySelector('details');
        if (d?.open) {
            d.open = false;
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(e: Event): void {
        const target = e.target as HTMLElement;
        if (!this.host.nativeElement.contains(target) || target.closest('.fpms-more-menu .dropdown-item')) {
            this.close();
        }
    }

    @HostListener('keydown.escape')
    onEscape(): void {
        this.close();
        (this.host.nativeElement.querySelector('summary') as HTMLElement | null)?.focus();
    }
}

export const FPMS_UI = [StatusBadgeComponent, PageHeaderComponent, EmptyStateComponent, WarningsComponent, LoadingComponent, PagerComponent, SortHeaderComponent, FormHintComponent, MoreMenuComponent];
