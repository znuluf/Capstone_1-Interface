import { Injectable, InjectionToken, signal } from '@angular/core';

/**
 * Query values for a page shown inside the logging wizard. A routed page reads ?batchId=… from the address; the same page
 * shown in the drawer finds these values here instead (see FpmsPage.query).
 */
export const EMBEDDED_QUERY = new InjectionToken<Record<string, string | null>>('EMBEDDED_QUERY');

export interface LogDrawerRequest {
    /** feeding = the AM/PM feeding sheet; log = Record operations. Left out, the wizard asks first. */
    kind?: 'feeding' | 'log';
    batchId?: string | null;
    /** yyyy-MM-dd; feeding only. */
    date?: string | null;
    /** Preselected log type; log only. */
    logType?: number | null;
}

/** Opens the Feeding and Record operations pages in the logging wizard dialog, so a batch, pond or cycle page need not be left to log. */
@Injectable({ providedIn: 'root' })
export class LogDrawerService {
    /** The open request, or null while the drawer is closed. */
    readonly request = signal<LogDrawerRequest | null>(null);

    /**
     * The page shown in the wizard, set by the page itself (FpmsPage). Lets the wizard ask whether the form has typed input
     * that switching to another form, or closing, would discard.
     */
    embeddedPage: { hasUnsavedInput(): boolean } | null = null;

    /** Counts saves made in the drawer; pages behind it reload when it changes. */
    readonly saved = signal(0);

    open(request: LogDrawerRequest): void {
        this.request.set({ ...request });
    }

    close(): void {
        this.request.set(null);
    }

    markSaved(): void {
        this.saved.update((n) => n + 1);
    }
}
