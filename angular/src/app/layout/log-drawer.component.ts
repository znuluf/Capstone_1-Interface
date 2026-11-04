import { Component, ChangeDetectionStrategy, Injector, Type, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgComponentOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { FpmsApiService } from '@shared/fpms/api.service';
import { EMBEDDED_QUERY, LogDrawerRequest, LogDrawerService } from '@shared/fpms/log-drawer.service';

type Kind = 'feeding' | 'log';

/**
 * The logging wizard: a centered dialog over the current page, so a batch, pond or cycle page need not be left to log.
 * Step 1 (only when it was opened without a pond and a kind) asks what to record and for which pond; step 2 is the same
 * Feeding or Record operations page the Operations tabs show. A pond's calendar square or a batch page skips step 1.
 * Opened from page-header buttons and calendar squares; the Dashboard links to the Operations pages instead.
 */
@Component({
    selector: 'fpms-log-drawer',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgComponentOutlet, FormsModule],
    template: `
        @if (request(); as r) {
            <div class="fpms-dialog-backdrop no-print">
                <div class="fpms-dialog" role="dialog" aria-modal="true" aria-labelledby="lw-h">
                    <div class="fpms-dialog-head">
                        <div class="flex-fill">
                            <h2 id="lw-h">{{ title() }}</h2>
                            <p class="text-muted mb-0">
                                {{ view() ? 'Saved entries are kept in the logbook.' : 'Choose what to record and for which pond.' }}
                            </p>
                        </div>
                        <button type="button" class="fpms-dialog-close" (click)="close()" aria-label="Close" title="Close">
                            &times;
                        </button>
                    </div>
                    <div class="fpms-dialog-body">
                        @if (view(); as v) {
                            <ng-container *ngComponentOutlet="v.type; injector: v.injector"></ng-container>
                        } @else {
                            <div class="form-group">
                                <label class="d-block">What are you recording?</label>
                                <div class="btn-group" role="group">
                                    <button type="button" class="btn" [class.btn-primary]="kind() === 'feeding'" [class.btn-outline-primary]="kind() !== 'feeding'" (click)="kind.set('feeding')">
                                        <i class="fas fa-utensils mr-1" aria-hidden="true"></i>
                                        Feeding
                                    </button>
                                    <button type="button" class="btn" [class.btn-primary]="kind() === 'log'" [class.btn-outline-primary]="kind() !== 'log'" (click)="kind.set('log')">
                                        <i class="fas fa-clipboard-check mr-1" aria-hidden="true"></i>
                                        Water, growth, treatment, mortality, notes
                                    </button>
                                </div>
                            </div>
                            <div class="form-group mb-0">
                                <label for="lw-pond">Pond</label>
                                <select id="lw-pond" class="form-control" [ngModel]="batchId()" (ngModelChange)="batchId.set($event)">
                                    @if (kind() === 'feeding') {
                                        <option [ngValue]="null">All stocked ponds</option>
                                    }
                                    @for (b of batches(); track b.id) {
                                        <option [ngValue]="b.id">{{ b.pondCode }} · {{ b.batchCode }}</option>
                                    }
                                </select>
                                @if (!batches().length) {
                                    <small class="form-text text-muted">No pond has an open batch yet.</small>
                                }
                            </div>
                        }
                    </div>
                    @if (!view()) {
                        <div class="fpms-dialog-foot">
                            <button type="button" class="btn btn-default" (click)="close()">Cancel</button>
                            <button type="button" class="btn btn-primary" [disabled]="!kind() || (kind() === 'log' && !batchId())" (click)="next()">
                                Next
                            </button>
                        </div>
                    }
                </div>
            </div>
        }
    `,
})
export class LogDrawerComponent {
    private router = inject(Router);
    private injector = inject(Injector);
    private api = inject(FpmsApiService);
    private drawer = inject(LogDrawerService);

    readonly request = this.drawer.request;
    readonly view = signal<{ type: Type<unknown>; injector: Injector } | null>(null);
    readonly kind = signal<Kind | null>(null);
    readonly batchId = signal<string | null>(null);
    readonly batches = signal<any[]>([]);

    constructor() {
        this.router.events
            .pipe(
                filter((e): e is NavigationEnd => e instanceof NavigationEnd),
                takeUntilDestroyed()
            )
            .subscribe(() => this.drawer.close());
        effect(() => {
            const request = this.drawer.request();
            untracked(() => void this.begin(request));
        });
    }

    title(): string {
        const kind = this.view() ? this.kind() : null;
        return kind === 'feeding' ? 'Record feeding' : kind === 'log' ? 'Record operations' : 'Log';
    }

    close(): void {
        this.drawer.close();
    }

    next(): void {
        void this.show({ kind: this.kind()!, batchId: this.batchId() });
    }

    private async begin(request: LogDrawerRequest | null): Promise<void> {
        this.view.set(null);
        if (!request) {
            return;
        }
        this.kind.set(request.kind ?? null);
        this.batchId.set(request.batchId ?? null);
        if (request.kind) {
            await this.show(request);
            return;
        }
        const batches = await this.api.get<any[]>('Batch', 'GetAll', { openOnly: true });
        this.batches.set(batches.sort((x, y) => String(x.pondCode).localeCompare(String(y.pondCode), undefined, { numeric: true })));
        this.batchId.set(request.batchId ?? this.batches()[0]?.id ?? null);
    }

    private async show(request: LogDrawerRequest): Promise<void> {
        const query: Record<string, string | null> = {
            batchId: request.batchId ?? null,
            date: request.date ?? null,
            logType: request.logType != null ? String(request.logType) : null,
        };
        const injector = Injector.create({ providers: [{ provide: EMBEDDED_QUERY, useValue: query }], parent: this.injector });
        const type =
            request.kind === 'feeding'
                ? (await import('../fpms/logbook/feeding-sheet.component')).FeedingSheetComponent
                : (await import('../fpms/logbook/log-entry.component')).LogEntryComponent;
        this.kind.set(request.kind ?? null);
        this.view.set({ type, injector });
    }
}
