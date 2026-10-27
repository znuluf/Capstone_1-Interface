import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * Remembers the in-app page the user came from, so a page's "Back" link can return there
 * (with its list page, sort and filters) instead of always going to a fixed parent.
 *
 * Only plain pages count: forms ("new", "edit"), sign-in pages and the page itself are skipped,
 * and a browser Back/Forward leaves the previous page unknown (the fixed parent is used then).
 */
@Injectable({ providedIn: 'root' })
export class NavHistory {
    private router = inject(Router);
    private current = this.router.url;
    private before: string | null = null;
    private replacing = false;
    private popped = false;

    constructor() {
        this.router.events.subscribe((e) => {
            if (e instanceof NavigationStart) {
                this.replacing = !!this.router.getCurrentNavigation()?.extras.replaceUrl;
                this.popped = e.navigationTrigger === 'popstate';
            } else if (e instanceof NavigationEnd) {
                const url = e.urlAfterRedirects;
                if (this.popped) {
                    this.before = null;
                } else if (!this.replacing && NavHistory.path(url) !== NavHistory.path(this.current)) {
                    this.before = this.current;
                }
                // A replaced or query-only navigation (for example list paging) keeps the same previous page.
                this.current = url;
            }
        });
    }

    /** The page the user came from, or null when unknown or not worth returning to. */
    previous(): string | null {
        const p = this.before;
        if (!p || !p.startsWith('/app/')) {
            return null;
        }
        const path = NavHistory.path(p);
        if (path === NavHistory.path(this.current) || /\/(new|edit|create-batch)$/.test(path)) {
            return null;
        }
        return p;
    }

    private static path(url: string): string {
        return url.split(/[?#]/)[0];
    }
}
