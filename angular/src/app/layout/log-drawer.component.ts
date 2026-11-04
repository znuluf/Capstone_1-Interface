import { Component, ChangeDetectionStrategy, Injector, Type, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgComponentOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { FpmsApiService } from '@shared/fpms/api.service';
import { NewLogTypes, LogTypes } from '@shared/fpms/labels';
import { EMBEDDED_QUERY, LogDrawerRequest, LogDrawerService } from '@shared/fpms/log-drawer.service';

type Kind = 'feeding' | 'log';

const NEW_LOG_TYPES = NewLogTypes.map((value) => ({ value, label: (LogTypes as Record<number, string>)[value] }));

/**
 * The logging wizard: a centered dialog over the current page, so a batch, pond or cycle page need not be left to log.
 * Always for one pond: step 1 asks which pond, step 2 what to record, step 3 is the same Feeding or Record operations
 * page the Operations tabs show. A pond's calendar square or a batch page already knows the pond, so it skips step 1.
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
                                {{ view() ? 'Saved entries are kept in the logbook.' : stage() === 'pond' ? 'Logging is recorded for one pond at a time.' : 'Choose what to record for this pond.' }}
                            </p>
                        </div>
                        <button type="button" class="fpms-dialog-close" (click)="close()" aria-label="Close" title="Close">
                            &times;
                        </button>
                    </div>
                    <div class="fpms-dialog-body">
                        @if (view(); as v) {
                            <ng-container *ngComponentOutlet="v.type; injector: v.injector"></ng-container>
                        } @else if (!batchId() || stage() === 'pond') {
                            <div class="form-group mb-0">
                                <label for="lw-pond">Which pond? <span class="text-danger">*</span></label>
                                <select id="lw-pond" class="form-control" [ngModel]="batchId()" (ngModelChange)="batchId.set($event)">
                                    @for (b of batches(); track b.id) {
                                        <option [ngValue]="b.id">{{ b.pondCode }} · {{ b.batchCode }}</option>
                                    }
                                </select>
                                @if (!batches().length) {
                                    <small class="form-text text-muted">No pond has an open batch yet.</small>
                                }
                            </div>
                        } @else {
                            <p class="mb-2"><strong>Pond:</strong> {{ pondLabel() }}</p>
                            <label class="d-block">What are you recording?</label>
                            <div class="fpms-choice">
                                <button type="button" class="btn btn-outline-primary mr-1 mb-1" (click)="pick('feeding', null)">
                                    <i class="fas fa-utensils mr-1" aria-hidden="true"></i>
                                    Feeding (AM/PM)
                                </button>
                                @for (o of logTypes; track o.value) {
                                    <button type="button" class="btn btn-outline-primary mr-1 mb-1" (click)="pick('log', o.value)">
                                        {{ o.label }}
                                    </button>
                                }
                            </div>
                        }
                    </div>
                    @if (!view()) {
                        <div class="fpms-dialog-foot">
                            @if (stage() === 'type' && !startedWithPond()) {
                                <button type="button" class="btn btn-default mr-auto" (click)="stage.set('pond')">Back</button>
                            }
                            <button type="button" class="btn btn-default" (click)="close()">Cancel</button>
                            @if (stage() === 'pond') {
                                <button type="button" class="btn btn-primary" [disabled]="!batchId()" (click)="stage.set('type')">Next: what to record</button>
                            }
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
    readonly stage = signal<'pond' | 'type'>('pond');
    readonly startedWithPond = signal(false);
    readonly logTypes = NEW_LOG_TYPES;

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

    pondLabel(): string {
        const b = this.batches().find((x) => x.id === this.batchId());
        return b ? `${b.pondCode} · ${b.batchCode}` : '';
    }

    /** Opens the chosen form for the chosen pond. */
    pick(kind: Kind, logType: number | null): void {
        void this.show({ kind, batchId: this.batchId(), logType });
    }

    private async begin(request: LogDrawerRequest | null): Promise<void> {
        this.view.set(null);
        if (!request) {
            return;
        }
        this.kind.set(request.kind ?? null);
        this.batchId.set(request.batchId ?? null);
        this.startedWithPond.set(!!request.batchId);
        this.stage.set(request.batchId ? 'type' : 'pond');
        if (request.kind && request.batchId) {
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
