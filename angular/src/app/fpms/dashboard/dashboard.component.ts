import { Component, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FPMS_IMPORTS } from '../shared-imports';

/** Role-specific dashboard (Ref 9.2). */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [title]="'Dashboard'" [subtitle]="d()?.farmName + ' · ' + today">
            @if (can('Farm.Logs.Create')) {
                <a routerLink="/app/logbook/new" class="btn btn-primary mr-1"><i class="fas fa-plus mr-1"></i>Add log</a>
                <a routerLink="/app/logbook/feeding" class="btn btn-outline-primary mr-1"><i class="fas fa-utensils mr-1"></i>Feeding sheet</a>
            }
            @if (can('Farm.Logs')) {
                <a routerLink="/app/logbook/status" class="btn btn-outline-secondary mr-1"><i class="fas fa-calendar-check mr-1"></i>Daily log status</a>
            }
            @if (can('Farm.Reports')) {
                <a routerLink="/app/reports" class="btn btn-outline-secondary"><i class="fas fa-chart-line mr-1"></i>Reports</a>
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
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-tasks" aria-hidden="true"></i>Set up your farm</h3></div>
                            <div class="card-body py-2">
                                <ul class="list-unstyled mb-0 fpms-setup">
                                    @for (t of x.setupTasks; track t.key) {
                                        <li>
                                            <i class="far mr-2" [class.fa-check-circle]="t.done" [class.text-success]="t.done" [class.fa-circle]="!t.done"></i>
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

                    @if (x.isOwner && x.finishStocking?.length) {
                        <div class="card card-outline card-warning">
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-truck mr-1" aria-hidden="true"></i>Finish stocking</h3></div>
                            <div class="card-body py-2">
                                <p class="small text-muted mb-1">These deliveries are past their stocking window. Record the PL that were not stocked so each delivery adds up.</p>
                                <ul class="list-unstyled mb-0">
                                    @for (d of x.finishStocking; track d.id) {
                                        <li>
                                            <a [routerLink]="['/app/resources/fry-deliveries', d.id]"><strong>{{ d.hatcheryBatchNumber }}</strong></a> · {{ d.hatcheryName }}
                                            · received {{ d.deliveryDate | farmDate }} · {{ d.plStocked | num: 0 }} of {{ d.plReceived | num: 0 }} PL stocked
                                            @if (d.cycleCode) { · cycle {{ d.cycleCode }} } @else { · <span class="text-muted">nothing stocked</span> }
                                        </li>
                                    }
                                </ul>
                            </div>
                        </div>
                    }

                    <div class="fpms-stats">
                        <div class="fpms-stat"><div class="v">{{ x.kpis.activeCycles }}</div><div class="l">Active cycles</div></div>
                        <div class="fpms-stat"><div class="v">{{ x.kpis.stockedBatches }}</div><div class="l">Stocked batches</div></div>
                        <div class="fpms-stat"><div class="v">{{ x.kpis.averageAbwG | num: 2 }} g</div><div class="l">Avg. current ABW</div></div>
                        <div class="fpms-stat"><div class="v">{{ x.kpis.averageFcrToDate | num: 2 }}</div><div class="l">Avg. FCR to date</div></div>
                        <div class="fpms-stat"><div class="v">{{ x.kpis.averageEstimatedSurvivalPct | num: 1 }}%</div><div class="l">Est. survival</div></div>
                        <div class="fpms-stat" [class.warn]="x.kpis.waterQualityAlerts7Days > 0">
                            <div class="v">{{ x.kpis.waterQualityAlerts7Days }}</div><div class="l">WQ alerts (7 days)</div>
                        </div>
                        <div class="fpms-stat" [class.warn]="x.kpis.highMortalityDays7Days > 0">
                            <div class="v">{{ x.kpis.highMortalityDays7Days }}</div><div class="l">High-mortality days (7 days)</div>
                        </div>
                        <a class="fpms-stat" routerLink="/app/logbook/status" [class.warn]="x.kpis.blankDailyRecordsYesterday > 0">
                            <div class="v">{{ x.kpis.blankDailyRecordsYesterday }}</div><div class="l">Blank daily records yesterday</div>
                        </a>
                    </div>

                    <div class="card">
                        <div class="card-header"><h3 class="card-title"><i class="fas fa-water" aria-hidden="true"></i>Ponds</h3></div>
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
                                    <a class="fpms-pond" [routerLink]="p.batchId ? ['/app/production/batches', p.batchId] : ['/app/ponds', p.pondId]" [class.alert-pond]="p.hasWaterQualityAlert">
                                        <div class="d-flex justify-content-between align-items-start">
                                            <strong>{{ p.pondCode }}</strong>
                                            <fpms-badge [text]="p.status | label: L.PondDisplayStatuses"></fpms-badge>
                                        </div>
                                        <div class="small text-muted mb-1">{{ p.pondName }} · {{ p.areaM2 | num: 0 }} m²</div>
                                        @if (p.batchCode) {
                                            <div class="small">{{ p.batchCode }}</div>
                                            @if (p.doc !== null && p.doc !== undefined) {
                                                <div class="fpms-pond-stats">
                                                    <span><b>DOC</b> {{ p.doc }}</span>
                                                    <span><b>ABW</b> {{ p.abwG | num: 1 }} g</span>
                                                    <span><b>FCR</b> {{ p.fcrToDate | num: 2 }}</span>
                                                    <span><b>Surv.</b> {{ p.estimatedSurvivalPct | num: 0 }}%</span>
                                                </div>
                                            }
                                        }
                                        @if (p.hasWaterQualityAlert) {
                                            <div class="small text-warning-dark mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>Water-quality alert</div>
                                        }
                                    </a>
                                }
                            </div>
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-lg-6">
                            <div class="card">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-tint mr-1" aria-hidden="true"></i>Water-quality alerts (last 7 days)</h3></div>
                                <div class="card-body p-0">
                                    @if (!x.waterQualityAlerts.length) {
                                        <fpms-empty text="No out-of-range readings in the last 7 days." icon="far fa-check-circle"></fpms-empty>
                                    } @else {
                                        <div class="table-responsive">
                                        <table class="table table-sm mb-0">
                                            <thead><tr><th>Day</th><th>Pond / batch</th><th>Out-of-range readings</th></tr></thead>
                                            <tbody>
                                                @for (a of x.waterQualityAlerts; track a.batchId + a.farmDate) {
                                                    <tr>
                                                        <td class="text-nowrap">{{ a.farmDate | farmDate }}</td>
                                                        <td><a [routerLink]="['/app/production/batches', a.batchId]">{{ a.pondCode }} · {{ a.batchCode }}</a></td>
                                                        <td class="small">
                                                            @for (r of a.readings; track $index) {
                                                                <div><i class="fas fa-exclamation-triangle text-warning mr-1"></i>{{ r }}</div>
                                                            }
                                                            <a [routerLink]="['/app/logbook', a.logId]">Latest reading</a>
                                                        </td>
                                                    </tr>
                                                }
                                            </tbody>
                                        </table>
                                        </div>
                                    }
                                </div>
                            </div>
                            <div class="card">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-skull-crossbones mr-1" aria-hidden="true"></i>High mortality (last 7 days)</h3></div>
                                <div class="card-body p-0">
                                    @if (!x.highMortality.length) {
                                        <fpms-empty text="No entry over 1% of the estimated population in the last 7 days." icon="far fa-check-circle"></fpms-empty>
                                    } @else {
                                        <div class="table-responsive">
                                        <table class="table table-sm mb-0">
                                            <thead><tr><th>Day</th><th>Pond / batch</th><th class="text-right">Dead</th></tr></thead>
                                            <tbody>
                                                @for (h of x.highMortality; track h.logId) {
                                                    <tr>
                                                        <td class="text-nowrap"><a [routerLink]="['/app/logbook', h.logId]">{{ h.farmDate | farmDate }}</a></td>
                                                        <td><a [routerLink]="['/app/production/batches', h.batchId]">{{ h.pondCode }} · {{ h.batchCode }}</a></td>
                                                        <td class="text-right">{{ h.count | num: 0 }}</td>
                                                    </tr>
                                                }
                                            </tbody>
                                        </table>
                                        </div>
                                    }
                                </div>
                            </div>
                            <div class="card">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-boxes mr-1" aria-hidden="true"></i>Stock alerts</h3></div>
                                <div class="card-body p-0">
                                    @if (!x.stockAlerts.length) {
                                        <fpms-empty text="No low or negative stock." icon="far fa-check-circle"></fpms-empty>
                                    } @else {
                                        <div class="table-responsive">
                                        <table class="table table-sm mb-0">
                                            <tbody>
                                                @for (s of x.stockAlerts; track $index) {
                                                    <tr>
                                                        <td><fpms-badge [text]="s.kind"></fpms-badge></td>
                                                        <td>{{ s.itemName }} @if (s.lotNumber) { <span class="text-muted">lot {{ s.lotNumber }}</span> }</td>
                                                        <td class="text-right">{{ s.quantity | num: 2 }} {{ s.unit }}</td>
                                                    </tr>
                                                }
                                            </tbody>
                                        </table>
                                        </div>
                                    }
                                </div>
                            </div>
                        </div>
                        <div class="col-lg-6">
                            @if (x.isOwner) {
                                <div class="card">
                                    <div class="card-header"><h3 class="card-title"><i class="far fa-file-alt mr-1" aria-hidden="true"></i>Compliance</h3></div>
                                    <div class="card-body p-0">
                                        @if (x.missingRequiredDocuments.length) {
                                            <div class="alert alert-warning m-2 mb-0 small">
                                                <i class="fas fa-exclamation-triangle mr-1"></i>No active record for these required permits:
                                                <strong>{{ x.missingRequiredDocuments.join(', ') }}</strong>.
                                                <a routerLink="/app/farm/documents">Record or renew permits</a>
                                            </div>
                                        }
                                        @if (x.documentAlerts.length) {
                                            <div class="table-responsive">
                                            <table class="table table-sm mb-0">
                                                <tbody>
                                                    @for (doc of x.documentAlerts; track doc.documentId) {
                                                        <tr>
                                                            <td><fpms-badge [text]="doc.status | label: L.ExpiryStatuses"></fpms-badge></td>
                                                            <td>{{ doc.categoryName }} — {{ doc.title }}</td>
                                                            <td class="text-nowrap">{{ doc.expiryDate | farmDate }}</td>
                                                        </tr>
                                                    }
                                                </tbody>
                                            </table>
                                            </div>
                                        } @else if (!x.missingRequiredDocuments.length) {
                                            <fpms-empty text="All permits current." icon="far fa-check-circle"></fpms-empty>
                                        }
                                    </div>
                                </div>
                            }
                            <div class="card">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-sync mr-1" aria-hidden="true"></i>Active cycles</h3></div>
                                <div class="card-body p-0">
                                    @if (!x.activeCycles.length) {
                                        <fpms-empty text="No planned or active cycles.">
                                            @if (can('Farm.Production.Manage')) {
                                                <a routerLink="/app/production/cycles" class="btn btn-sm btn-primary">Create a cycle</a>
                                            }
                                        </fpms-empty>
                                    } @else {
                                        <div class="table-responsive">
                                        <table class="table table-sm mb-0">
                                            <tbody>
                                                @for (c of x.activeCycles; track c.id) {
                                                    <tr>
                                                        <td><a [routerLink]="['/app/production/cycles', c.id]">{{ c.cycleCode }}</a></td>
                                                        <td><fpms-badge [text]="c.status | label: L.CycleStatuses"></fpms-badge></td>
                                                        <td>{{ c.stockedCount }} of {{ c.batchCount }} batches stocked</td>
                                                    </tr>
                                                }
                                            </tbody>
                                        </table>
                                        </div>
                                    }
                                </div>
                            </div>
                            <div class="card">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-history mr-1" aria-hidden="true"></i>Recent log entries</h3></div>
                                <div class="card-body p-0">
                                    <div class="table-responsive">
                                    <table class="table table-sm mb-0">
                                        <tbody>
                                            @for (r of x.recentLogs; track r.id) {
                                                <tr>
                                                    <td class="text-nowrap">{{ r.observedAtUtc | farmDateTime }}</td>
                                                    <td><a [routerLink]="['/app/logbook', r.id]">{{ r.logType | label: L.LogTypes }}</a></td>
                                                    <td>{{ r.batchCode }}</td>
                                                    <td class="text-muted small">{{ r.recordedBy }}</td>
                                                </tr>
                                            } @empty {
                                                <tr><td class="text-muted text-center py-3">No log entries yet.</td></tr>
                                            }
                                        </tbody>
                                    </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p class="small text-muted"><i class="fas fa-info-circle mr-1"></i>GAqP monitoring guidance: {{ x.monitoringGuidance }}</p>
                }
            </div>
        </section>
    `,
})
export class DashboardComponent extends FpmsPage implements OnInit {
    d = signal<any>(null);
    pendingSetup = signal<any[]>([]);

    async ngOnInit(): Promise<void> {
        const data = await this.api.get<any>('Dashboard', 'Get');
        this.pendingSetup.set((data?.setupTasks ?? []).filter((t: any) => !t.done));
        this.d.set(data);
    }
}
