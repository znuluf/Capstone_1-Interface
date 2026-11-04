import { Component, ChangeDetectionStrategy, Injector, Type, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgComponentOutlet } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { PermissionCheckerService } from 'abp-ng2-module';
import { filter } from 'rxjs/operators';
import { EMBEDDED_QUERY, LogDrawerRequest, LogDrawerService } from '@shared/fpms/log-drawer.service';

/** Pages where the floating Log button shows: the Production lists and batch page, and the Ponds list. */
const FAB_PAGES = /^\/app\/(production\/(cycles|batches)(\/[^/]+)?|ponds)$/;
const BATCH_PAGE = /^\/app\/production\/batches\/([0-9a-fA-F-]{36})$/;

/**
 * The floating Log button and the drawer behind it. The drawer shows the same Feeding and Record operations pages as the
 * Operations tabs, so a batch, cycle or pond page need not be left to log. The Dashboard has no button: its calendar
 * squares open the Operations pages.
 */
@Component({
    selector: 'fpms-log-drawer',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgComponentOutlet],
    template: `
        @if (showFab()) {
            <div class="fpms-fab no-print">
                @if (menuOpen()) {
                    <div class="fpms-fab-menu" role="menu">
                        <button type="button" class="btn btn-light" role="menuitem" (click)="start('feeding')">
                            <i class="fas fa-utensils mr-1" aria-hidden="true"></i>
                            Record feeding
                        </button>
                        <button type="button" class="btn btn-light" role="menuitem" (click)="start('log')">
                            <i class="fas fa-clipboard-check mr-1" aria-hidden="true"></i>
                            Record operations
                        </button>
                    </div>
                }
                <button
                    type="button"
                    class="btn btn-primary btn-lg fpms-fab-button"
                    [attr.aria-expanded]="menuOpen()"
                    (click)="menuOpen.set(!menuOpen())">
                    <i class="fas fa-plus mr-1" aria-hidden="true"></i>
                    Log
                </button>
            </div>
        }
        @if (view(); as v) {
            <div class="fpms-drawer-backdrop no-print" (click)="close()"></div>
            <aside class="fpms-drawer no-print" role="dialog" aria-modal="true" [attr.aria-label]="v.title">
                <div class="fpms-drawer-head">
                    <strong>{{ v.title }}</strong>
                    <button type="button" class="btn btn-sm btn-default" (click)="close()" aria-label="Close" title="Close">
                        &times;
                    </button>
                </div>
                <div class="fpms-drawer-body">
                    <ng-container *ngComponentOutlet="v.type; injector: v.injector"></ng-container>
                </div>
            </aside>
        }
    `,
})
export class LogDrawerComponent {
    private router = inject(Router);
    private injector = inject(Injector);
    private permission = inject(PermissionCheckerService);
    private drawer = inject(LogDrawerService);

    private url = signal(this.router.url.split(/[?#]/)[0]);
    readonly menuOpen = signal(false);
    readonly view = signal<{ type: Type<unknown>; injector: Injector; title: string } | null>(null);

    readonly showFab = computed(
        () => FAB_PAGES.test(this.url()) && !this.view() && this.permission.isGranted('Farm.Logs.Create')
    );

    constructor() {
        this.router.events
            .pipe(
                filter((e): e is NavigationEnd => e instanceof NavigationEnd),
                takeUntilDestroyed()
            )
            .subscribe((e) => {
                this.url.set(e.urlAfterRedirects.split(/[?#]/)[0]);
                this.menuOpen.set(false);
                this.drawer.close();
            });
        effect(() => {
            const request = this.drawer.request();
            untracked(() => void this.show(request));
        });
    }

    start(kind: 'feeding' | 'log'): void {
        this.menuOpen.set(false);
        this.drawer.open({ kind, batchId: BATCH_PAGE.exec(this.url())?.[1] ?? null });
    }

    close(): void {
        this.drawer.close();
    }

    private async show(request: LogDrawerRequest | null): Promise<void> {
        if (!request) {
            this.view.set(null);
            return;
        }
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
        // The request may have changed while the page loaded.
        if (this.drawer.request() === request || this.drawer.request()?.kind === request.kind) {
            this.view.set({ type, injector, title: request.kind === 'feeding' ? 'Record feeding' : 'Record operations' });
        }
    }
}
