import { Component, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FPMS_IMPORTS } from '../shared-imports';

/** One line of "Needs attention": shown only when its count is above zero and the user can open its page. */
interface AttentionLine {
    /** How many; the line is hidden at 0. */
    n: number;
    /** Whether this user can act on it (role and permission). */
    show: boolean;
    /** warn = something is wrong; todo = something is waiting to be done. Problems are listed first. */
    tone: 'warn' | 'todo';
    icon: string;
    text: string;
    link: string | unknown[];
    query?: Record<string, string>;
    action: string;
}

/**
 * Role-specific dashboard (Ref 9.2), kept short: the setup checklist while it is unfinished, one "Needs attention"
 * list, the pond grid, and (Owners) four farm numbers. Details live on the pages each line links to.
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [title]="'Dashboard'" [subtitle]="d() ? d().farmName + ' · ' + today : today">
            @if (can('Farm.Logs.Create')) {
                <a routerLink="/app/logbook/feeding" class="btn btn-primary mr-1">
                    <i class="fas fa-utensils mr-1"></i>
                    Feeding sheet
                </a>
                <a routerLink="/app/logbook/new" class="btn btn-outline-secondary">
                    <i class="fas fa-plus mr-1"></i>
                    Add log
                </a>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (!d()) {
                    <fpms-loading></fpms-loading>
                } @else {
                    @let x = d();
                    @if (x.isOwner && pendingSetup().length) {
                        <div class="card card-outline card-primary">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <i class="fas fa-tasks" aria-hidden="true"></i>
                                    Set up your farm
                                </h3>
                            </div>
                            <div class="card-body py-2">
                                <ul class="list-unstyled mb-0 fpms-setup">
                                    @for (t of x.setupTasks; track t.key) {
                                        <li>
                                            <i
                                                class="far mr-2"
                                                [class.fa-check-circle]="t.done"
                                                [class.text-success]="t.done"
                                                [class.fa-circle]="!t.done"></i>
                                            @if (t.done) {
                                                <span class="text-muted">{{ t.label }}</span>
                                            } @else {
                                                <a [routerLink]="t.route">{{ t.label }}</a>
                                            }
                                        </li>
                                    }
                                </ul>
                            </div>
                        </div>
                    }

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">
                                <i class="fas fa-bell" aria-hidden="true"></i>
                                Needs attention
                            </h3>
                        </div>
                        @if (!attention().length) {
                            <div class="card-body fpms-all-clear">
                                <i class="far fa-check-circle mr-2" aria-hidden="true"></i>
                                All clear. Nothing needs attention today.
                            </div>
                        } @else {
                            <ul class="fpms-attention">
                                @for (a of attention(); track a.text) {
                                    <li [class.warn]="a.tone === 'warn'">
                                        <i [class]="a.icon" aria-hidden="true"></i>
                                        <span class="t">{{ a.text }}</span>
                                        <a [routerLink]="a.link" [queryParams]="a.query">{{ a.action }}</a>
                                    </li>
                                }
                            </ul>
                        }
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">
                                <i class="fas fa-water" aria-hidden="true"></i>
                                Ponds
                            </h3>
                        </div>
                        <div class="card-body">
                            @if (!x.ponds.length) {
                                <fpms-empty text="No ponds yet." icon="fas fa-water">
                                    @if (can('Farm.Ponds.Manage')) {
                                        <a routerLink="/app/ponds/new" class="btn btn-sm btn-primary">Add a pond</a>
                                    }
                                </fpms-empty>
                            }
                            <div class="fpms-pond-grid">
                                @for (p of x.ponds; track p.pondId) {
                                    <a
                                        class="fpms-pond"
                                        [routerLink]="
                                            p.batchId
                                                ? ['/app/production/batches', p.batchId]
                                                : ['/app/ponds', p.pondId]
                                        "
                                        [class.alert-pond]="p.hasWaterQualityAlert"
                                        [title]="p.pondName + ' · ' + (p.areaM2 | num: 0) + ' m²'">
                                        <div class="d-flex justify-content-between align-items-start">
                                            <strong>{{ p.pondCode }}</strong>
                                            <fpms-badge [text]="p.status | label: L.PondDisplayStatuses"></fpms-badge>
                                        </div>
                                        @if (p.doc !== null && p.doc !== undefined) {
                                            <div class="fpms-pond-line">
                                                Day {{ p.doc }}
                                                @if (p.abwG !== null && p.abwG !== undefined) {
                                                    · {{ p.abwG | num: 1 }} g
                                                }
                                            </div>
                                        } @else if (p.batchCode) {
                                            <div class="fpms-pond-line text-muted">
                                                {{ p.batchStatus | label: L.BatchStatuses }} · {{ p.batchCode }}
                                            </div>
                                        }
                                        @if (p.hasWaterQualityAlert) {
                                            <div class="small text-warning-dark mt-1">
                                                <i class="fas fa-exclamation-triangle mr-1"></i>
                                                Water-quality alert
                                            </div>
                                        }
                                    </a>
                                }
                            </div>
                        </div>
                    </div>

                    @if (x.isOwner) {
                        <h2 class="fpms-section-title">Farm at a glance</h2>
                        <div class="fpms-stats">
                            <a class="fpms-stat" routerLink="/app/production/cycles">
                                <div class="v">{{ x.kpis.stockedBatches }}</div>
                                <div class="l">
                                    Stocked batches · {{ x.kpis.activeCycles }} active
                                    {{ x.kpis.activeCycles === 1 ? 'cycle' : 'cycles' }}
                                </div>
                            </a>
                            <div class="fpms-stat">
                                <div class="v">{{ x.kpis.averageAbwG | num: 2 }} g</div>
                                <div class="l">Average ABW</div>
                            </div>
                            <div class="fpms-stat">
                                <div class="v">{{ x.kpis.averageFcrToDate | num: 2 }}</div>
                                <div class="l">Average FCR to date</div>
                            </div>
                            <div class="fpms-stat">
                                <div class="v">{{ x.kpis.averageEstimatedSurvivalPct | num: 1 }}%</div>
                                <div class="l">Estimated survival</div>
                            </div>
                        </div>
                    }
                }
            </div>
        </section>
    `,
})
export class DashboardComponent extends FpmsPage implements OnInit {
    d = signal<any>(null);
    pendingSetup = signal<any[]>([]);
    attention = signal<AttentionLine[]>([]);

    async ngOnInit(): Promise<void> {
        const data = await this.api.get<any>('Dashboard', 'Get');
        this.pendingSetup.set((data?.setupTasks ?? []).filter((t: any) => !t.done));
        this.attention.set(data ? this.buildAttention(data) : []);
        this.d.set(data);
    }

    /** Every alert and waiting task as one short line, problems first. Lines the user cannot act on are left out. */
    private buildAttention(x: any): AttentionLine[] {
        const k = x.kpis ?? {};
        const owner = !!x.isOwner;
        const stock = (kind: string) => (x.stockAlerts ?? []).filter((s: any) => s.kind === kind).length;
        const permits = (status: number) => (x.documentAlerts ?? []).filter((d: any) => d.status === status).length;
        const lines: AttentionLine[] = [
            // Problems
            {
                n: x.missingRequiredDocuments?.length ?? 0,
                show: owner && this.can('Farm.Compliance'),
                tone: 'warn',
                icon: 'fas fa-file-alt',
                text:
                    this.count(x.missingRequiredDocuments?.length, 'required permit is', 'required permits are') +
                    ' not recorded',
                link: '/app/farm/documents',
                action: 'Permits',
            },
            {
                n: permits(3) ?? 0,
                show: owner && this.can('Farm.Compliance'),
                tone: 'warn',
                icon: 'fas fa-file-alt',
                text: this.count(permits(3), 'permit has', 'permits have') + ' expired',
                link: '/app/farm/documents',
                action: 'Renew',
            },
            {
                n: k.waterQualityAlerts7Days ?? 0,
                show: this.can('Farm.Logs'),
                tone: 'warn',
                icon: 'fas fa-tint',
                text:
                    this.count(k.waterQualityAlerts7Days, 'water-quality alert', 'water-quality alerts') + ' this week',
                link: '/app/logbook',
                query: { outOfRangeOnly: '1' },
                action: 'View readings',
            },
            {
                n: k.highMortalityDays7Days ?? 0,
                show: this.can('Farm.Logs'),
                tone: 'warn',
                icon: 'fas fa-heartbeat',
                text: 'High mortality on ' + this.count(k.highMortalityDays7Days, 'day', 'days') + ' this week',
                link: '/app/logbook',
                query: { logType: '7' },
                action: 'View entries',
            },
            {
                n: stock('Negative') ?? 0,
                show: this.can('Farm.Inventory'),
                tone: 'warn',
                icon: 'fas fa-boxes',
                text: this.count(stock('Negative'), 'lot is', 'lots are') + ' below zero stock',
                link: '/app/inventory',
                action: 'Inventory',
            },
            {
                n: k.lotsExpired ?? 0,
                show: this.can('Farm.Inventory'),
                tone: 'warn',
                icon: 'fas fa-boxes',
                text: this.count(k.lotsExpired, 'lot with stock has', 'lots with stock have') + ' expired',
                link: '/app/inventory',
                action: 'Inventory',
            },
            // Waiting to be done
            {
                n: k.blankDailyRecordsYesterday ?? 0,
                show: this.can('Farm.Logs'),
                tone: 'todo',
                icon: 'fas fa-calendar-check',
                text:
                    this.count(k.blankDailyRecordsYesterday, 'blank daily record', 'blank daily records') +
                    ' yesterday',
                link: '/app/logbook/status',
                action: 'Daily log status',
            },
            {
                n: x.finishStocking?.length ?? 0,
                show: owner && this.can('Farm.FryDeliveries'),
                tone: 'todo',
                icon: 'fas fa-truck',
                text:
                    this.count(x.finishStocking?.length, 'fry delivery needs', 'fry deliveries need') +
                    ' Finish stocking',
                link:
                    x.finishStocking?.length === 1
                        ? ['/app/resources/fry-deliveries', x.finishStocking[0].id]
                        : '/app/resources/fry-deliveries',
                action: 'Finish stocking',
            },
            {
                n: k.batchesAwaitingClose ?? 0,
                show: owner && this.can('Farm.Production'),
                tone: 'todo',
                icon: 'fas fa-flag-checkered',
                text: this.count(k.batchesAwaitingClose, 'batch is', 'batches are') + ' ready to close',
                link:
                    k.batchesAwaitingClose === 1 && x.batchesToClose?.length
                        ? ['/app/production/batches', x.batchesToClose[0].batchId]
                        : '/app/production/batches',
                action: 'Close batch',
            },
            {
                n: permits(2) ?? 0,
                show: owner && this.can('Farm.Compliance'),
                tone: 'todo',
                icon: 'fas fa-file-alt',
                text: this.count(permits(2), 'permit expires', 'permits expire') + ' soon',
                link: '/app/farm/documents',
                action: 'Permits',
            },
            {
                n: stock('Low') ?? 0,
                show: this.can('Farm.Inventory'),
                tone: 'todo',
                icon: 'fas fa-boxes',
                text: this.count(stock('Low'), 'item is', 'items are') + ' low on stock',
                link: '/app/inventory',
                action: 'Inventory',
            },
            {
                n: stock('Reconcile') ?? 0,
                show: this.can('Farm.Inventory'),
                tone: 'todo',
                icon: 'fas fa-boxes',
                text: this.count(stock('Reconcile'), 'lot needs', 'lots need') + ' a stock count',
                link: '/app/inventory',
                action: 'Inventory',
            },
            {
                n: k.lotsExpiringSoon ?? 0,
                show: this.can('Farm.Inventory'),
                tone: 'todo',
                icon: 'fas fa-boxes',
                text:
                    this.count(k.lotsExpiringSoon, 'lot expires', 'lots expire') +
                    ` within ${k.lotExpiringSoonDays ?? 30} days`,
                link: '/app/inventory',
                action: 'Inventory',
            },
        ];
        return lines.filter((l) => l.show && l.n > 0);
    }

    /** "1 lot is" / "3 lots are". */
    private count(n: number | null | undefined, one: string, many: string): string {
        const v = n ?? 0;
        return `${v} ${v === 1 ? one : many}`;
    }
}
