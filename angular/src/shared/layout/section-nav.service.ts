import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PermissionCheckerService } from 'abp-ng2-module';
import { AppSessionService } from '@shared/session/app-session.service';
import { SectionAction, SectionTab, activeTab, effectiveUrl, pathOf, sectionOfUrl } from './sections';

/**
 * What the section tab bar shows for the open page (DEC-85 step 7): the tabs the user may open, the open tab and the page
 * under it, and the actions at the right. The tab bar draws it; the page header reads it to leave out a title that only
 * repeats the open tab. It also holds the counts shown beside grouped pages (the Setup lists), which each list page
 * reports when it loads so the number follows what was just added or removed.
 */
@Injectable({ providedIn: 'root' })
export class SectionNav {
    private router = inject(Router);
    private permission = inject(PermissionCheckerService);
    private session = inject(AppSessionService);

    /** The path the tab bar is drawn for (the trace report belongs to the page it was opened from). */
    readonly url = signal(pathOf(effectiveUrl(this.router.url)));

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

    private readonly active = computed(() => {
        const section = this.section();
        return section ? activeTab(section, this.url()) : undefined;
    });
    readonly activeRoute = computed(() => this.active()?.tab.route);
    readonly activeTabLabel = computed(() => this.active()?.tab.label ?? '');
    readonly activeChildRoute = computed(() => this.active()?.child?.route);
    /** The name of the open page as the bar shows it: the page under a grouping tab, else the tab. */
    readonly activeLabel = computed(() => (this.active()?.child ?? this.active()?.tab)?.label ?? '');

    /** The pages under the open tab that the user may open; empty for an ordinary tab. */
    readonly subTabs = computed(() => this.allowed(this.active()?.tab.children ?? []));

    /** The section's actions for the open page that the user may use. */
    readonly actions = computed<SectionAction[]>(() => {
        const active = this.active();
        if (!active) {
            return [];
        }
        const page = (active.child ?? active.tab).route;
        const onOwnPage = this.url() === page;
        return (this.section()?.actions ?? []).filter(
            (a) => a.onTabs.includes(active.tab.route) && (a.onDetail || onOwnPage) && this.permission.isGranted(a.permission)
        );
    });

    /** The bar shows when there is something to choose: more than one tab, or an action. A page that is no tab hides it. */
    readonly barVisible = computed(() => !!this.activeRoute() && (this.tabs().length > 1 || this.actions().length > 0));

    /** Counts by page route, e.g. the number of size grades. Undefined until known. */
    readonly counts = signal<Record<string, number>>({});

    constructor() {
        this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => this.url.set(pathOf(effectiveUrl(e.urlAfterRedirects))));
    }

    /** Called by a list page after it loads, so its count on the tab bar is always the list on screen. */
    setCount(route: string, count: number): void {
        if (this.counts()[route] !== count) {
            this.counts.update((c) => ({ ...c, [route]: count }));
        }
    }

    private allowed(tabs: SectionTab[]): SectionTab[] {
        return tabs.filter((t) => (!t.permission || this.permission.isGranted(t.permission)) && (!t.setting || !!this.session.tenant?.[t.setting]));
    }
}
