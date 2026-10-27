import { PagerComponent, SortHeaderComponent } from './pager';
export { PagerComponent, SortHeaderComponent, PagerState } from './pager';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
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
            <div class="container-fluid">
                <div class="d-flex flex-wrap align-items-center justify-content-between">
                    <div class="mb-2">
                        @if (backLink) {
                            <a [routerLink]="backLink" class="text-muted small d-inline-block mb-1">
                                <i class="fas fa-arrow-left mr-1"></i>{{ backLabel }}
                            </a>
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
}

@Component({
    selector: 'fpms-empty',
    standalone: true,
    template: `
        <div class="fpms-empty text-center text-muted py-4">
            <i class="{{ icon }} fa-2x mb-2 d-block"></i>
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
                <i class="fas fa-exclamation-triangle mr-1"></i><strong>Saved with warnings</strong>
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
    template: `<div class="text-center text-muted py-4" role="status"><i class="fas fa-spinner fa-spin mr-2"></i>Loading…</div>`,
})
export class LoadingComponent {}

export const FPMS_UI = [StatusBadgeComponent, PageHeaderComponent, EmptyStateComponent, WarningsComponent, LoadingComponent, PagerComponent, SortHeaderComponent];
