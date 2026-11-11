import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PermissionCheckerService } from 'abp-ng2-module';
import { SectionTab, activeTab, effectiveUrl, pathOf, sectionOfUrl } from '@shared/layout/sections';

/**
 * The pages of the open sidebar section as a tab bar above the content (Operations, Production, Harvest and sales,
 * Resources, Farm). Single pages such as the dashboard, ponds and reports have no tabs, a section with only
 * one page the user may open shows no bar, and a focused page that is no tab of its own (the stocking wizard) hides it.
 * A tab that groups pages (Setup under Harvest and sales, DEC-85) shows them as a second, smaller row while it is open.
 */
@Component({
    selector: 'fpms-section-tabs',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink],
    template: `
        @if (tabs().length > 1 && activeRoute()) {
            <nav class="fpms-section-tabs no-print" [attr.aria-label]="label() + ' pages'">
                @for (t of tabs(); track t.route) {
                    <a
                        class="fpms-section-tab"
                        [routerLink]="t.link"
                        [class.active]="t.route === activeRoute()"
                        [attr.aria-current]="t.route === activeRoute() ? 'page' : null">
                        {{ t.label }}
                    </a>
                }
                @if (action(); as a) {
                    <a class="btn btn-primary fpms-section-action" [routerLink]="a.route">
                        <i [class]="a.icon + ' mr-1'" aria-hidden="true"></i>
                        {{ a.label }}
                    </a>
                }
            </nav>
            @if (subTabs().length > 1) {
                <nav class="fpms-section-subtabs no-print" [attr.aria-label]="activeLabel() + ' pages'">
                    @for (t of subTabs(); track t.route) {
                        <a
                            class="fpms-section-subtab"
                            [routerLink]="t.route"
                            [class.active]="t.route === activeChildRoute()"
                            [attr.aria-current]="t.route === activeChildRoute() ? 'page' : null">
                            {{ t.label }}
                        </a>
                    }
                </nav>
            }
        }
    `,
})
export class SectionTabsComponent {
    private router = inject(Router);
    private permission = inject(PermissionCheckerService);
    private url = signal(pathOf(effectiveUrl(this.router.url)));

    readonly section = computed(() => sectionOfUrl(this.url()));
    readonly label = computed(() => this.section()?.label ?? '');
    /** The tabs the user may open. A grouping tab shows when one of its pages may be opened, and links to the first. */
    readonly tabs = computed(() => {
        const section = this.section();
        if (!section) {
            return [];
        }
        return section.tabs
            .map((t) => {
                const pages = t.children?.length ? this.allowed(t.children) : null;
                return { label: t.label, route: t.route, link: pages ? pages[0]?.route : t.route, show: pages ? pages.length > 0 : this.allowed([t]).length > 0 };
            })
            .filter((t) => t.show);
    });
    /** The section's primary action, when the open tab offers it and the user may use it. */
    readonly action = computed(() => {
        const a = this.section()?.action;
        const active = this.activeRoute();
        return a && active && a.onTabs.includes(active) && this.permission.isGranted(a.permission) ? a : null;
    });
    private readonly active = computed(() => {
        const section = this.section();
        return section ? activeTab(section, this.url()) : undefined;
    });
    readonly activeRoute = computed(() => this.active()?.tab.route);
    readonly activeLabel = computed(() => this.active()?.tab.label ?? '');
    readonly activeChildRoute = computed(() => this.active()?.child?.route);
    /** The pages under the open tab that the user may open; empty for an ordinary tab. */
    readonly subTabs = computed(() => this.allowed(this.active()?.tab.children ?? []));

    private allowed(tabs: SectionTab[]): SectionTab[] {
        return tabs.filter((t) => !t.permission || this.permission.isGranted(t.permission));
    }

    constructor() {
        this.router.events
            .pipe(
                filter((e): e is NavigationEnd => e instanceof NavigationEnd),
                takeUntilDestroyed()
            )
            .subscribe((e) => this.url.set(pathOf(effectiveUrl(e.urlAfterRedirects))));
    }
}
