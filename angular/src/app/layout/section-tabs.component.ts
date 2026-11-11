import { Component, ChangeDetectionStrategy, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { FpmsApiService } from '@shared/fpms/api.service';
import { SectionNav } from '@shared/layout/section-nav.service';

/**
 * The pages of the open sidebar section as a tab bar above the content (Operations, Production, Harvest and sales,
 * Resources, Farm). Single pages such as the dashboard, ponds and reports have no tabs, and a focused page that is no tab
 * of its own (the stocking wizard) hides the bar.
 *
 * Design (DEC-85 step 7): a tab is a place; what the user does there (Record harvest, Record sale, Record operations,
 * Stock a batch) is a button at the right of the bar. A tab that groups pages (Setup) shows them as a second row in the
 * same style, each with a count. On a narrow screen the tabs stay on one row that scrolls sideways, with the open tab
 * brought into view, and the action shows as its icon.
 */
@Component({
    selector: 'fpms-section-tabs',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink],
    template: `
        @if (nav.barVisible()) {
            <div class="fpms-section-bar no-print">
                <nav class="fpms-section-tabs" [attr.aria-label]="nav.label() + ' pages'">
                    @for (t of nav.tabs(); track t.route) {
                        <a
                            class="fpms-section-tab"
                            [routerLink]="t.link"
                            [class.active]="t.route === nav.activeRoute()"
                            [attr.aria-current]="t.route === nav.activeRoute() && !nav.activeChildRoute() ? 'page' : null">
                            {{ t.label }}
                        </a>
                    }
                </nav>
                @if (nav.actions().length) {
                    <div class="fpms-section-actions">
                        @for (a of nav.actions(); track a.route) {
                            <a class="btn btn-primary" [routerLink]="a.route" [attr.aria-label]="a.label" [attr.title]="a.label">
                                <i [class]="a.icon" aria-hidden="true"></i>
                                <span class="d-none d-sm-inline ml-1">{{ a.label }}</span>
                            </a>
                        }
                    </div>
                }
            </div>
            @if (nav.subTabs().length > 1) {
                <nav class="fpms-section-tabs fpms-section-subtabs no-print" [attr.aria-label]="nav.activeTabLabel() + ' pages'">
                    @for (t of nav.subTabs(); track t.route) {
                        <a
                            class="fpms-section-tab"
                            [routerLink]="t.route"
                            [class.active]="t.route === nav.activeChildRoute()"
                            [attr.aria-current]="t.route === nav.activeChildRoute() ? 'page' : null">
                            {{ t.label }}
                            @if (nav.counts()[t.route] !== undefined) {
                                <span class="fpms-tab-count">{{ nav.counts()[t.route] }}</span>
                            }
                        </a>
                    }
                </nav>
            }
        }
    `,
})
export class SectionTabsComponent {
    readonly nav = inject(SectionNav);
    private api = inject(FpmsApiService);
    private host: ElementRef<HTMLElement> = inject(ElementRef);
    /** Count calls already made, so each list is asked for once; after that the list pages keep their own count fresh. */
    private asked = new Set<string>();

    constructor() {
        inject(Router)
            .events.pipe(
                filter((e): e is NavigationEnd => e instanceof NavigationEnd),
                takeUntilDestroyed()
            )
            .subscribe(() => this.afterNavigation());
        this.afterNavigation();
    }

    /** After the bar is redrawn for the new page: bring the open tab into view and fetch any count not yet known. */
    private afterNavigation(): void {
        setTimeout(() => {
            this.host.nativeElement.querySelectorAll('.fpms-section-tab.active').forEach((el) => {
                const row = el.parentElement;
                if (row && row.scrollWidth > row.clientWidth) {
                    const tab = el as HTMLElement;
                    row.scrollLeft = Math.max(0, tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2);
                }
            });
            this.loadCounts();
        });
    }

    private loadCounts(): void {
        for (const t of this.nav.subTabs()) {
            if (!t.count || this.asked.has(t.route) || this.nav.counts()[t.route] !== undefined) {
                continue;
            }
            this.asked.add(t.route);
            this.api
                .get<any[]>(t.count.service, t.count.method)
                .then((list) => this.nav.setCount(t.route, (list ?? []).length))
                .catch(() => this.asked.delete(t.route));
        }
    }
}
