import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PermissionCheckerService } from 'abp-ng2-module';
import { activeTabRoute, pathOf, sectionOfUrl } from '@shared/layout/sections';

/**
 * The pages of the open sidebar section as a tab bar above the content (Operations, Production, Harvest and sales,
 * Resources, Farm). Single pages such as the dashboard, ponds and reports have no tabs, and a section with only
 * one page the user may open shows no bar either.
 */
@Component({
    selector: 'fpms-section-tabs',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink],
    template: `
        @if (tabs().length > 1) {
            <nav class="fpms-section-tabs no-print" [attr.aria-label]="label() + ' pages'">
                @for (t of tabs(); track t.route) {
                    <a
                        class="fpms-section-tab"
                        [routerLink]="t.route"
                        [class.active]="t.route === activeRoute()"
                        [attr.aria-current]="t.route === activeRoute() ? 'page' : null">
                        {{ t.label }}
                    </a>
                }
            </nav>
        }
    `,
})
export class SectionTabsComponent {
    private router = inject(Router);
    private permission = inject(PermissionCheckerService);
    private url = signal(pathOf(this.router.url));

    readonly section = computed(() => sectionOfUrl(this.url()));
    readonly label = computed(() => this.section()?.label ?? '');
    readonly tabs = computed(() => {
        const section = this.section();
        return section ? section.tabs.filter((t) => !t.permission || this.permission.isGranted(t.permission)) : [];
    });
    readonly activeRoute = computed(() => {
        const section = this.section();
        return section ? activeTabRoute(section, this.url()) : undefined;
    });

    constructor() {
        this.router.events
            .pipe(
                filter((e): e is NavigationEnd => e instanceof NavigationEnd),
                takeUntilDestroyed()
            )
            .subscribe((e) => this.url.set(pathOf(e.urlAfterRedirects)));
    }
}
