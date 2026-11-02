import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * Remembers the in-app page the user came from, so a page's "Back" link can return there
 * (with its list page, sort and filters) instead of always going to a fixed parent.
 *
 * It keeps the trail of pages: returning to an earlier page cuts the trail there, so Back never bounces
 * between two pages. Forms ("new", "edit") are skipped, and a browser Back/Forward to a page not on the
 * trail leaves the previous page unknown (the fixed parent is used then).
 */
@Injectable({ providedIn: 'root' })
export class NavHistory {
    private router = inject(Router);
    /** The trail of pages that led here, oldest first; the last entry is the current page. */
    private trail: string[] = [this.router.url];
    private replacing = false;
    private popped = false;

    constructor() {
        this.router.events.subscribe((e) => {
            if (e instanceof NavigationStart) {
                this.replacing = !!this.router.getCurrentNavigation()?.extras.replaceUrl;
                this.popped = e.navigationTrigger === 'popstate';
            } else if (e instanceof NavigationEnd) {
                this.visit(e.urlAfterRedirects);
            }
        });
    }

    private visit(url: string): void {
        const path = NavHistory.path(url);
        const last = this.trail.length - 1;
        if (path === NavHistory.path(this.trail[last])) {
            // A replaced or query-only navigation (for example list paging) keeps the same page and trail.
            this.trail[last] = url;
            return;
        }
        if (this.replacing) {
            this.trail[last] = url;
            return;
        }
        // Going to the page before this one (its Back link, or the browser's Back) steps back along the trail,
        // so two pages never send the user back and forth between each other.
        const at = this.trail.map(NavHistory.path).lastIndexOf(path);
        if (at >= 0) {
            this.trail = this.trail.slice(0, at);
        } else if (this.popped) {
            // Browser Back/Forward to a page not on the trail: the previous page is unknown.
            this.trail = [];
        }
        this.trail.push(url);
        if (this.trail.length > 20) {
            this.trail = this.trail.slice(-20);
        }
    }

    /** The page the user came from, or null when unknown or not worth returning to. */
    previous(): string | null {
        for (let i = this.trail.length - 2; i >= 0; i--) {
            const p = this.trail[i];
            const path = NavHistory.path(p);
            // Forms ("new", "edit") are passed over: after saving, Back skips the form.
            if (/\/(new|edit|create-batch)$/.test(path)) {
                continue;
            }
            return p.startsWith('/app/') ? p : null;
        }
        return null;
    }

    private static path(url: string): string {
        return url.split(/[?#]/)[0];
    }
}
