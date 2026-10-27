import { ChangeDetectorRef, Directive, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { PermissionCheckerService } from 'abp-ng2-module';
import { AppSessionService } from '@shared/session/app-session.service';
import { FpmsApiService } from './api.service';
import * as L from './labels';
import { FarmTime } from './farm-time';

/** Base for FPMS pages: API client, permissions, labels, notifications and a busy flag. */
@Directive()
export abstract class FpmsPage {
    protected api = inject(FpmsApiService);
    protected router = inject(Router);
    protected route = inject(ActivatedRoute);
    protected session = inject(AppSessionService);
    private permissions = inject(PermissionCheckerService);

    readonly L = L;
    readonly Options = L.Options;
    readonly today = FarmTime.today();
    busy = signal(false);

    constructor() {
        // Zoneless change detection: re-render this page after each API response it may have awaited.
        const cdr = inject(ChangeDetectorRef);
        this.api.settled.pipe(takeUntilDestroyed()).subscribe(() => cdr.markForCheck());
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
        return this.route.snapshot.queryParamMap.get(name);
    }

    param(name: string): string | null {
        return this.route.snapshot.paramMap.get(name);
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
