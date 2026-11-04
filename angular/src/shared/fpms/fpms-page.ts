import { ChangeDetectorRef, DestroyRef, Directive, QueryList, ViewChildren, inject, signal } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { PermissionCheckerService } from 'abp-ng2-module';
import { AppSessionService } from '@shared/session/app-session.service';
import { FpmsApiService } from './api.service';
import { BRAND } from './brand';
import * as L from './labels';
import { FarmTime } from './farm-time';
import { PagerState } from './pager';
import { EMBEDDED_QUERY, LogDrawerService } from './log-drawer.service';

/** How a list filter is written in the address. */
export type FilterKind = 'string' | 'number' | 'boolean';

/** Base for FPMS pages: API client, permissions, labels, notifications and a busy flag. */
@Directive()
export abstract class FpmsPage {
    protected api = inject(FpmsApiService);
    /** Set when the page is shown inside the log drawer instead of the router outlet. */
    protected readonly embedded = inject(EMBEDDED_QUERY, { optional: true });
    readonly drawer = inject(LogDrawerService);
    protected router = inject(Router);
    protected route = inject(ActivatedRoute);
    protected session = inject(AppSessionService);
    private permissions = inject(PermissionCheckerService);
    private browserTitle = inject(Title);

    readonly L = L;
    readonly Options = L.Options;
    readonly today = FarmTime.today();
    busy = signal(false);

    /** Every template-driven form on the page; used to warn before leaving with unsaved changes. */
    @ViewChildren(NgForm) private pageForms?: QueryList<NgForm>;

    /** Pages that keep a browser draft of unsaved entries set this, so leaving them never asks. */
    protected keepsDrafts = false;

    /** True when a form on the page has been changed and not saved. */
    hasUnsavedChanges(): boolean {
        return !this.keepsDrafts && !!this.pageForms?.some((f) => !!f.dirty);
    }

    /** True when a form on the page has typed input that is not saved, whether or not a draft is kept (the logging wizard asks before discarding it). */
    hasUnsavedInput(): boolean {
        return !!this.pageForms?.some((f) => !!f.dirty);
    }

    constructor() {
        if (this.embedded) {
            this.drawer.embeddedPage = this;
            inject(DestroyRef).onDestroy(() => {
                if (this.drawer.embeddedPage === this) {
                    this.drawer.embeddedPage = null;
                }
            });
        }
        // Closing the tab or reloading with unsaved changes: let the browser ask too.
        const beforeUnload = (e: BeforeUnloadEvent) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', beforeUnload));

        // Zoneless change detection: re-render this page after each API response it may have awaited.
        const cdr = inject(ChangeDetectorRef);
        this.api.settled.pipe(takeUntilDestroyed()).subscribe(() => cdr.markForCheck());
    }

    /** Names the browser tab once the record is loaded, for example "Batch B-2026-015 · Farm.Shrimp.io". */
    protected setPageTitle(name: string | null | undefined): void {
        if (name?.trim()) {
            this.browserTitle.setTitle(`${name.trim()} · ${BRAND.name}`);
        }
    }

    can(permission: string): boolean {
        return this.permissions.isGranted(permission);
    }

    get isOwner(): boolean {
        return this.can('Farm.Dashboard.Full');
    }

    notifySaved(message = 'Saved.'): void {
        abp.notify.success(message);
    }

    /** Non-blocking server warnings after a save that leaves the page: one dialog, one wording everywhere. */
    showWarnings(warnings: { message: string }[] | null | undefined): void {
        if (!warnings?.length) {
            return;
        }
        const title = warnings.length === 1 ? 'Saved with a warning' : `Saved with ${warnings.length} warnings`;
        abp.message.warn(warnings.map((w) => '• ' + w.message).join('\n'), title);
    }

    confirm(message: string, title?: string): Promise<boolean> {
        return new Promise((resolve) => abp.message.confirm(message, title, (ok: boolean) => resolve(!!ok)));
    }

    /** Runs an API call with the busy flag set; errors are already shown by the HTTP interceptor. */
    async run<T>(action: () => Promise<T>): Promise<T | undefined> {
        this.busy.set(true);
        try {
            return await action();
        } catch (e) {
            console.warn(e);
            return undefined;
        } finally {
            this.busy.set(false);
        }
    }

    /** Runs a command with the busy flag set; true when it succeeded (errors are shown by the interceptor). */
    async act(action: () => Promise<unknown>): Promise<boolean> {
        this.busy.set(true);
        try {
            await action();
            // Saved: what the forms show now matches the server, so leaving no longer asks.
            this.pageForms?.forEach((f) => f.form.markAsPristine());
            if (this.embedded) {
                this.drawer.markSaved();
            }
            return true;
        } catch (e) {
            console.warn(e);
            return false;
        } finally {
            this.busy.set(false);
        }
    }

    /** Returns the value of a query-string parameter of the current route. */
    query(name: string): string | null {
        if (this.embedded) {
            return this.embedded[name] ?? null;
        }
        return this.route.snapshot.queryParamMap.get(name);
    }

    private pagerPath = '';
    private listFilters: { target: any; keys: Record<string, FilterKind>; defaults: Record<string, unknown> } | null = null;

    /** Starts a list from the page, size and sort in the address (see syncPager). Call once in ngOnInit. */
    restorePager(pager: PagerState): void {
        this.pagerPath = this.router.url.split(/[?#]/)[0];
        pager.fromQuery((n) => this.query(n));
    }

    /**
     * Like restorePager, and also restores filter fields (target[key]) from the address. Call it after any
     * other start-up values are set: the values at that moment count as the defaults and stay out of the address.
     */
    restoreList(pager: PagerState, target: any, keys: Record<string, FilterKind>): void {
        this.restorePager(pager);
        const defaults: Record<string, unknown> = {};
        for (const [key, kind] of Object.entries(keys)) {
            defaults[key] = target[key];
            const raw = this.query(key);
            if (raw === null) {
                continue;
            }
            if (raw === '') {
                target[key] = kind === 'boolean' ? false : null;
            } else if (kind === 'boolean') {
                target[key] = raw === '1';
            } else if (kind === 'number') {
                const n = Number(raw);
                if (Number.isFinite(n)) {
                    target[key] = n;
                }
            } else {
                target[key] = raw;
            }
        }
        this.listFilters = { target, keys, defaults };
    }

    /** Writes the list's page, size, sort and filters into the address without adding a history entry. */
    syncPager(pager: PagerState): void {
        if (this.router.url.split(/[?#]/)[0] !== this.pagerPath) {
            return; // the user has already left this page
        }
        const queryParams: Record<string, unknown> = { ...pager.toQuery() };
        const lf = this.listFilters;
        if (lf) {
            for (const [key, kind] of Object.entries(lf.keys)) {
                const v = lf.target[key];
                if (v === lf.defaults[key] || (v == null && lf.defaults[key] == null)) {
                    queryParams[key] = null;
                } else if (v == null || v === '') {
                    queryParams[key] = '';
                } else {
                    queryParams[key] = kind === 'boolean' ? (v ? '1' : '0') : String(v);
                }
            }
        }
        this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
    }

    param(name: string): string | null {
        return this.embedded ? null : this.route.snapshot.paramMap.get(name);
    }

    /**
     * Downloads a CSV export (Owner only, audit-logged on the server). `method` is ExportList or ExportReport; the body carries
     * the list or report kind plus the filters currently applied.
     */
    async exportCsv(method: 'ExportList' | 'ExportReport', body: Record<string, unknown>): Promise<void> {
        const file = await this.run(() => this.api.post<{ fileName: string; contentType: string; contentBase64: string; rowCount: number }>('Export', method, body));
        if (!file) {
            return;
        }
        const bytes = Uint8Array.from(atob(file.contentBase64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        abp.notify.success(`${file.fileName}: ${file.rowCount} row${file.rowCount === 1 ? '' : 's'} exported.`);
    }

    print(): void {
        window.print();
    }
}
