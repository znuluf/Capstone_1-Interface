import { Component, OnInit, effect, untracked } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { PagerState } from '@shared/fpms/pager';
import { logSummary } from '@shared/fpms/log-summary';
import { FPMS_IMPORTS } from '../shared-imports';

/** Batch detail: stocking data, live indicators, logs, harvests and lifecycle actions (Refs 5.2, 5.5, 7.4; AC-14, AC-16, AC-17). */
/** One day square of the log calendar; day is null outside the culture period. */
interface CalCell {
    day: any;
    dayOfMonth: number;
    doc: number;
    isToday: boolean;
}

interface CalMonth {
    key: string;
    title: string;
    cells: CalCell[];
}

@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [title]="b ? b.pondCode + ' · ' + (b.letter ? 'Batch ' + b.letter : b.batchCode) : 'Batch'" [subtitle]="b ? 'Cycle ' + b.cycleCode + ' · ' + (b.pondAreaM2AtStocking | num: 0) + ' m²' + (b.stockingDate ? ' · stocked ' + (b.stockingDate | farmDate) : '') + '.' : ''" backLink="/app/production/batches" backLabel="Batches">
            @if (b) {
                <fpms-badge [text]="b.status | label: L.BatchStatuses"></fpms-badge>
                @if (b.allowedLogTypes.length && can('Farm.Logs.Create')) {
                    <button type="button" class="btn btn-primary" (click)="drawer.open({ batchId: b.id })"><i class="fas fa-plus mr-1"></i>Record operations</button>
                }
                @if (can('Farm.Reports')) {
                    <a class="btn btn-outline-secondary" [routerLink]="['/app/reports/trace', b.id]"><i class="fas fa-project-diagram mr-1"></i>Trace report</a>
                }
                @if (b.canAddHarvest && can('Farm.Harvests.Create')) {
                    <a class="btn btn-outline-primary" routerLink="/app/harvests/new" [queryParams]="{ batchId: b.id }"><i class="fas fa-shrimp mr-1"></i>Record harvest</a>
                }
                @if (canManage && b.canDeclareFailure) {
                    <button class="btn btn-outline-danger" (click)="startFailure()">Declare failure</button>
                }
                @if (canManage && b.canClose) {
                    <button class="btn btn-outline-secondary" (click)="startClose()">Close batch</button>
                }
                @if (canManage && b.canReopen) {
                    <button class="btn btn-outline-secondary" (click)="reopening = { reason: '' }">Reopen batch</button>
                }
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (!b) {
                    <fpms-loading></fpms-loading>
                } @else {
                    @if (b.isReadOnly) {
                        <div class="alert alert-secondary">
                            <i class="fas fa-lock mr-1"></i>This batch is Closed{{ b.closedAtUtc ? ' (' + (b.closedAtUtc | farmDateTime) + ' by ' + b.closedBy + ')' : '' }}. Its logs and harvests are read-only. Sales payments can still be recorded.
                            @if (canManage && !b.canReopen && b.reopenBlockedReason) { <div class="small mt-1">To reopen it: {{ b.reopenBlockedReason }}</div> }
                        </div>
                    }
                    @if (reopening) {
                        <div class="fpms-dialog-backdrop"><div class="fpms-dialog fpms-dialog-sm"><div class="fpms-dialog-body p-0"><div class="card card-outline card-warning mb-0 border-0">
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-undo" aria-hidden="true"></i>Reopen batch {{ b.batchCode }}</h3></div>
                            <div class="card-body">
                                <p class="small">
                                    The batch returns to {{ b.failureReason ? 'Failed' : 'Harvested' }} so its records can be corrected. Its final indicators are worked out again when you close it.
                                    The reason is kept in the batch's history and the activity log.
                                </p>
                                <label for="br">Reason <span class="text-danger">*</span></label>
                                <input id="br" class="form-control" [(ngModel)]="reopening.reason" maxlength="500" placeholder="e.g. the final harvest kg was entered wrong" />
                            </div>
                            <div class="card-footer">
                                <button class="btn btn-warning mr-2" [disabled]="busy() || reopening.reason.trim().length < 3" (click)="reopen()">Reopen batch</button>
                                <button class="btn btn-default" (click)="reopening = null">Cancel</button>
                            </div>
                        </div></div></div></div>
                    }
                    @if (b.earliestSafeHarvestDate && !b.isReadOnly) {
                        <div class="alert" [class.alert-warning]="b.earliestSafeHarvestDate > today" [class.alert-light]="b.earliestSafeHarvestDate <= today">
                            <i class="fas fa-prescription-bottle-alt mr-1"></i>Earliest safe harvest date from treatment withdrawal periods: <strong>{{ b.earliestSafeHarvestDate | farmDate }}</strong>
                            {{ b.earliestSafeHarvestDate > today ? '(a harvest before then saves with a warning)' : '(passed)' }}.
                        </div>
                    }
                    @if (b.status === 1 && docHint) {
                        <p class="small text-muted"><i class="fas fa-vial mr-1"></i>{{ docHint }}</p>
                    }
                    @if (b.failureReason) {
                        <div class="alert alert-danger">
                            <strong>Failed</strong> on {{ b.failureDate | farmDate }}: {{ b.failureReason }}
                            @if (b.estimatedLossPhp) { · estimated loss {{ b.estimatedLossPhp | php }} }
                            @if (can('Farm.Reports')) {
                                <a class="alert-link ml-2" [routerLink]="['/app/reports']" [queryParams]="{ report: 'failure', batchId: b.id }">Failure report</a>
                            }
                        </div>
                    }

                    @if (failure) {
                        <div class="fpms-dialog-backdrop"><div class="fpms-dialog fpms-dialog-sm"><div class="fpms-dialog-body p-0"><div class="card card-outline card-danger mb-0 border-0">
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-ban" aria-hidden="true"></i>Declare batch failed</h3></div>
                            <form #ff="ngForm" (ngSubmit)="saveFailure()" novalidate>
                                <div class="card-body">
                                    <div class="form-row">
                                        <div class="form-group col-md-3">
                                            <label for="fd">Failure date <span class="text-danger">*</span></label>
                                            <input id="fd" type="date" class="form-control" name="fd" [(ngModel)]="failure.failureDate" required [min]="b.stockingDate" [max]="today" />
                                        </div>
                                        <div class="form-group col-md-3">
                                            <label for="fl">Estimated loss (₱)</label>
                                            <input id="fl" type="number" min="0" step="0.01" class="form-control" name="fl" [(ngModel)]="failure.estimatedLossPhp" />
                                        </div>
                                        <div class="form-group col-md-6">
                                            <label for="fr">Reason <span class="text-danger">*</span></label>
                                            <input id="fr" class="form-control" name="fr" [(ngModel)]="failure.reason" required maxlength="1000" />
                                        </div>
                                    </div>
                                    <p class="small text-muted mb-0">The pond becomes Post-harvest. A salvage harvest, notes and sales can still be recorded until the batch is closed.</p>
                                </div>
                                <div class="card-footer">
                                    <button class="btn btn-danger mr-2" type="submit" [disabled]="busy() || !ff.form.valid">Declare failed</button>
                                    <button class="btn btn-default" type="button" (click)="failure = null">Cancel</button>
                                    <fpms-form-hint [form]="ff"></fpms-form-hint>
                                </div>
                            </form>
                        </div></div></div></div>
                    }

                    @if (closing) {
                        <div class="fpms-dialog-backdrop"><div class="fpms-dialog fpms-dialog-sm"><div class="fpms-dialog-body p-0"><div class="card card-outline card-warning mb-0 border-0">
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-lock" aria-hidden="true"></i>Close batch {{ b.batchCode }}</h3></div>
                            <div class="card-body">
                                <p>Final FCR, survival rate, ABW and culture days are fixed. Logs, feeding and harvests become read-only for everyone, and pond {{ b.pondCode }} becomes Available (or stays in preparation if a new round has started). The Owner can reopen the batch later, with a reason, to correct a mistake.</p>
                                @if (!closeCheck) {
                                    <p class="small text-muted"><i class="fas fa-spinner fa-spin mr-1"></i>Checking daily records…</p>
                                } @else if (closeCheck.blankDaysTotal) {
                                    <div class="alert alert-warning small">
                                        <strong>{{ closeCheck.blankDaysTotal }} day{{ closeCheck.blankDaysTotal === 1 ? '' : 's' }} with blank daily records</strong>
                                        between {{ closeCheck.from | farmDate }} and {{ closeCheck.to | farmDate }}:
                                        {{ closeCheck.blankFeedingSlots }} feeding session{{ closeCheck.blankFeedingSlots === 1 ? '' : 's' }} and {{ closeCheck.blankWaterDays }} water-quality day{{ closeCheck.blankWaterDays === 1 ? '' : 's' }} not recorded
                                        ({{ closeCheck.notFedSlots }} session{{ closeCheck.notFedSlots === 1 ? '' : 's' }} marked Not fed).
                                        Review them before closing; the final indicators use only what was recorded.
                                        <ul class="mb-0 mt-1 fpms-scroll-list">
                                            @for (d of closeCheck.blankDays; track d.date) {
                                                <li>{{ d.date | farmDate }}: {{ d.missing }}</li>
                                            }
                                            @if (closeCheck.blankDaysTotal > closeCheck.blankDays.length) {
                                                <li class="text-muted">…and {{ closeCheck.blankDaysTotal - closeCheck.blankDays.length }} more</li>
                                            }
                                        </ul>
                                    </div>
                                } @else {
                                    <p class="small text-success"><i class="fas fa-check mr-1"></i>Every day has its feeding and water-quality records{{ closeCheck.notFedSlots ? ' (' + closeCheck.notFedSlots + ' sessions marked Not fed)' : '' }}.</p>
                                }
                                @if (closeCheck?.sfscMissing) {
                                    <div class="alert alert-warning small">
                                        <strong>No Shrimp Fry Source Certificate number</strong> on fry delivery {{ closeCheck.fryDeliveryBatchNumber }}.
                                        BFAR FAO 225-1 requires it, and the harvest can be confiscated without it. Add it on the fry delivery. You can still close.
                                    </div>
                                }
                                @if (closeCheck?.flaggedLots?.length) {
                                    <div class="alert alert-warning small">
                                        <strong>{{ closeCheck.flaggedLots.length }} stock lot{{ closeCheck.flaggedLots.length === 1 ? '' : 's' }} used by this batch {{ closeCheck.flaggedLots.length === 1 ? 'is' : 'are' }} flagged for reconciliation:</strong>
                                        @for (l of closeCheck.flaggedLots; track $index) { <span class="d-block">{{ l.product }}, lot {{ l.lotNumber }}</span> }
                                        The feed or chemical amounts for this batch may be off until the stock is reconciled (Stock page). You can still close.
                                    </div>
                                }
                                @if (closeCheck?.unaccountedKg > 0.0005) {
                                    <div class="alert alert-warning small">
                                        <strong>{{ closeCheck.unaccountedKg | num: 3 }} kg harvested but not accounted for:</strong>
                                        harvested {{ closeCheck.harvestedKg | num: 3 }} kg, sold {{ closeCheck.soldKg | num: 3 }} kg, not sold (home use, given away, spoiled) {{ closeCheck.notSoldKg | num: 3 }} kg.
                                        Record the remaining sales or not-sold kg first, or close anyway.
                                    </div>
                                } @else if (closeCheck && closeCheck.harvestedKg > 0) {
                                    <p class="small text-success"><i class="fas fa-check mr-1"></i>All {{ closeCheck.harvestedKg | num: 3 }} harvested kg are sold or recorded as not sold.</p>
                                }
                                <div class="custom-control custom-checkbox">
                                    <input type="checkbox" class="custom-control-input" id="ro" [(ngModel)]="closing.confirm" />
                                    <label class="custom-control-label" for="ro">I understand this batch's records will become read-only.</label>
                                </div>
                            </div>
                            <div class="card-footer">
                                <button class="btn btn-warning mr-2" [disabled]="busy() || !closing.confirm" (click)="close()">Close batch</button>
                                <button class="btn btn-default" (click)="closing = null">Cancel</button>
                            </div>
                        </div></div></div></div>
                    }

                    @let i = b.indicators;
                    @if (i) {
                        <div class="row">
                            <div class="col-6 col-md-3 col-xl"><div class="fpms-kpi"><div class="v">{{ i.doc ?? '—' }}</div><div class="l">DOC</div></div></div>
                            <div class="col-6 col-md-3 col-xl"><div class="fpms-kpi"><div class="v">{{ i.currentAbwG | num: 2 }} g</div><div class="l">ABW</div></div></div>
                            <div class="col-6 col-md-3 col-xl">
                                <div class="fpms-kpi" [title]="i.populationBasis === 'Estimate' ? 'PL stocked × the latest survival estimate, less mortality and harvests after it' : 'PL stocked less recorded mortality and harvested pieces'">
                                    <div class="v">{{ i.estimatedPopulation | num: 0 }}</div>
                                    <div class="l">Est. population · {{ i.populationBasis === 'Estimate' ? 'from survival estimate' : 'from mortality' }}</div>
                                </div>
                            </div>
                            <div class="col-6 col-md-3 col-xl"><div class="fpms-kpi"><div class="v">{{ i.estimatedBiomassKg | num: 1 }} kg</div><div class="l">Est. biomass</div></div></div>
                            <div class="col-6 col-md-3 col-xl"><div class="fpms-kpi"><div class="v">{{ i.cumulativeFeedKg | num: 1 }} kg</div><div class="l">Feed to date</div></div></div>
                            <div class="col-6 col-md-3 col-xl"><div class="fpms-kpi"><div class="v">{{ (b.status === 5 ? i.finalFcr : i.fcrToDate) | num: 2 }}</div><div class="l">{{ b.status === 5 ? 'Final FCR' : 'FCR to date' }}</div></div></div>
                            <div class="col-6 col-md-3 col-xl">
                                <div class="fpms-kpi">
                                    <div class="v">{{ (b.status === 5 ? i.survivalRatePct : i.estimatedSurvivalPct) | num: 1 }}%</div>
                                    <div class="l">{{ b.status === 5 ? 'Survival rate' : 'Est. survival' }}</div>
                                </div>
                            </div>
                        </div>
                        <p class="small text-muted mt-n2">Computed from source records. Mortality to date: {{ i.cumulativeMortality | num: 0 }} · harvested {{ i.totalHarvestKg | num: 1 }} kg ({{ i.harvestedPieces | num: 0 }} pcs){{ i.cultureDays != null ? ' · culture days ' + i.cultureDays : '' }}.</p>
                    }

                    <div class="fpms-tabs no-print" role="tablist" aria-label="Batch pages">
                        @for (x of sections; track x.id) {
                            @if (x.id !== 'sec-calendar' || calMonths.length) {
                                <button type="button" role="tab" [attr.aria-selected]="tab === x.id" (click)="setTab(x.id)">{{ x.label }}</button>
                            }
                        }
                    </div>

                    <div class="row">
                        <div class="col-12">
                            @if (tab === 'sec-stocking') {
                            <div class="card" id="sec-stocking">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-shrimp" aria-hidden="true"></i>Stocking</h3></div>
                                <div class="card-body">
                                    <dl class="row mb-0 fpms-dl">
                                        <dt class="col-6">Pond</dt><dd class="col-6"><a [routerLink]="['/app/ponds', b.pondId]">{{ b.pondCode }}</a> · {{ b.pondAreaM2AtStocking | num: 0 }} m²</dd>
                                        <dt class="col-6">Fry delivery</dt>
                                        <dd class="col-6"><a [routerLink]="['/app/resources/fry-deliveries', b.fryDeliveryId]">{{ b.hatcheryBatchNumber }}</a> · {{ b.hatcheryName }}</dd>
                                        <dt class="col-6">PL age</dt><dd class="col-6">{{ b.plAgeDays != null ? 'PL' + b.plAgeDays : '—' }}</dd>
                                        <dt class="col-6">Stocked</dt><dd class="col-6">{{ b.stockedAtUtc | farmDateTime }}</dd>
                                        <dt class="col-6">Stocking count</dt><dd class="col-6">{{ b.plCountStocked | num: 0 }} PL</dd>
                                        <dt class="col-6">Density</dt>
                                        <dd class="col-6">
                                            {{ b.stockingDensityPerM2 | num: 2 }} PL/m²
                                            @if (b.densityFlag) {
                                                <span class="badge ml-1" [class.badge-success]="b.densityFlag === 1" [class.badge-warning]="b.densityFlag !== 1">{{ b.densityFlag | label: L.DensityFlags }}</span>
                                            }
                                        </dd>
                                        <dt class="col-6">Farming system</dt><dd class="col-6">{{ b.farmingSystemAtStocking ? (b.farmingSystemAtStocking | label: L.FarmingSystems) : '—' }}</dd>
                                        <dt class="col-6">Pond construction</dt><dd class="col-6">{{ b.constructionTypeAtStocking ? (b.constructionTypeAtStocking | label: L.ConstructionTypes) : '—' }}</dd>
                                        <dt class="col-6">Transport</dt><dd class="col-6">{{ b.transportMode | label: L.TransportModes }}</dd>
                                        <dt class="col-6">Time processed</dt><dd class="col-6">{{ b.timeProcessedUtc ? (b.timeProcessedUtc | farmDateTime) : '—' }}</dd>
                                        <dt class="col-6">Acclimation</dt><dd class="col-6">{{ b.acclimationMinutes ?? '—' }} min</dd>
                                        <dt class="col-6">Initial survival est.</dt><dd class="col-6">{{ b.initialSurvivalEstimatePct ?? '—' }}%</dd>
                                        <dt class="col-6">Dead at stocking</dt><dd class="col-6">{{ b.deadAtStocking != null ? (b.deadAtStocking | num: 0) + ' PL' : '—' }}</dd>
                                        <dt class="col-6">PL health certificate</dt><dd class="col-6">{{ b.plHealthCertificateNo ?? '—' }}</dd>
                                        <dt class="col-6">Shrimp Fry Source Certificate no.</dt><dd class="col-6">{{ b.sfscNo ?? '—' }}</dd>
                                        <dt class="col-6">Hatchery certification</dt><dd class="col-6 small">{{ b.hatcheryCertificationStatusAtStocking }}</dd>
                                    </dl>
                                </div>
                            </div>
                            @if (b.reopenings?.length) {
                                <div class="card">
                                    <div class="card-header"><h3 class="card-title"><i class="fas fa-history" aria-hidden="true"></i>Reopened</h3></div>
                                    <ul class="list-group list-group-flush small">
                                        @for (r of b.reopenings; track $index) {
                                            <li class="list-group-item py-2">{{ r.reopenedAtUtc | farmDateTime }} by {{ r.reopenedBy }}: {{ r.reason }}</li>
                                        }
                                    </ul>
                                </div>
                            }
                            <div class="card">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-book" aria-hidden="true"></i>Log counts</h3></div>
                                <div class="card-body py-2">
                                    <div class="d-flex justify-content-between small py-1 border-bottom">
                                        <span>Feeding sessions (AM/PM)</span><span>{{ feedPager.total }}</span>
                                    </div>
                                    @for (t of logTypeKeys; track t.key) {
                                        @if (L.NewLogTypes.includes(t.value) || (b.logCounts[t.key] ?? b.logCounts[t.camel] ?? 0) > 0) {
                                        <div class="d-flex justify-content-between small py-1 border-bottom">
                                            <span>{{ t.label }}</span><span>{{ b.logCounts[t.key] ?? b.logCounts[t.camel] ?? 0 }}</span>
                                        </div>
                                        }
                                    }
                                </div>
                            </div>
                            }
                        </div>
                        <div class="col-12">
                            @if (tab === 'sec-calendar' && calMonths.length) {
                                <div class="card" id="sec-calendar">
                                    <div class="card-header d-flex align-items-center flex-wrap">
                                        <h3 class="card-title mr-auto"><i class="far fa-calendar-alt" aria-hidden="true"></i>Log calendar</h3>
                                        <span class="small text-muted">{{ calStats.days }} days of culture</span>
                                    </div>
                                    <div class="card-body">
                                        <div class="cal-stats">
                                            <div class="cal-stat"><span class="cal-stat-n text-success">{{ calStats.full }}</span><span class="cal-stat-l">Fully logged</span></div>
                                            <div class="cal-stat"><span class="cal-stat-n cal-text-partial">{{ calStats.partial }}</span><span class="cal-stat-l">Partly logged</span></div>
                                            <div class="cal-stat"><span class="cal-stat-n text-danger">{{ calStats.empty }}</span><span class="cal-stat-l">Nothing logged</span></div>
                                            <div class="cal-stat cal-stat-wide">
                                                <span class="cal-stat-l">Days fully logged: {{ calStats.pct }}%</span>
                                                <div class="cal-bar" role="img" [attr.aria-label]="calStats.pct + '% of days fully logged'">
                                                    <span class="cal-bar-full" [style.width.%]="calStats.fullPct"></span><span class="cal-bar-partial" [style.width.%]="calStats.partialPct"></span><span class="cal-bar-empty" [style.width.%]="calStats.emptyPct"></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="cal-months">
                                            @for (m of calMonths; track m.key) {
                                                <section class="cal-month-block" [attr.aria-label]="m.title">
                                                    <h4 class="cal-month-title">{{ m.title }}</h4>
                                                    <div class="cal-grid" role="grid">
                                                        @for (n of weekdayNames; track $index) { <span class="cal-wd" role="columnheader">{{ n }}</span> }
                                                        @for (c of m.cells; track $index) {
                                                            @if (!c.day) {
                                                                <span class="cal-day cal-out" aria-hidden="true">{{ c.dayOfMonth || '' }}</span>
                                                            } @else {
                                                                <a [class]="'cal-day ' + calClass(c.day)" [class.cal-today]="c.isToday" [class.cal-static]="b.isReadOnly"
                                                                    [title]="calTip(c.day, c.doc)" [attr.aria-label]="calTip(c.day, c.doc)"
                                                                    [attr.role]="b.isReadOnly ? null : 'button'" [attr.tabindex]="b.isReadOnly ? null : 0"
                                                                    (click)="openDay(c.day)" (keydown.enter)="openDay(c.day)">
                                                                    <span class="cal-num">{{ c.dayOfMonth }}</span>
                                                                    <span class="cal-doc">D{{ c.doc }}</span>
                                                                    @if (c.day.hasMortality || c.day.hasGrowthSampling || c.day.hasChemical) {
                                                                        <span class="cal-events">
                                                                            @if (c.day.hasMortality) { <i class="cal-dot cal-m"></i> }
                                                                            @if (c.day.hasGrowthSampling) { <i class="cal-dot cal-g"></i> }
                                                                            @if (c.day.hasChemical) { <i class="cal-dot cal-c"></i> }
                                                                        </span>
                                                                    }
                                                                    <span class="cal-segs">
                                                                        <i [class]="'cal-seg ' + segClass(c.day.am)"></i><i [class]="'cal-seg ' + segClass(c.day.pm)"></i><i [class]="'cal-seg ' + segClass(c.day.water)"></i>
                                                                    </span>
                                                                </a>
                                                            }
                                                        }
                                                    </div>
                                                </section>
                                            }
                                        </div>
                                        <div class="cal-legend small text-muted mt-3">
                                            <span><span class="cal-swatch cal-s3"></span>All 3 records</span>
                                            <span><span class="cal-swatch cal-s1"></span>1 or 2 of 3</span>
                                            <span><span class="cal-swatch cal-s0"></span>Nothing logged</span>
                                            <span><span class="cal-segs cal-segs-legend"><i class="cal-seg cal-seg-in"></i><i class="cal-seg cal-seg-notfed"></i><i class="cal-seg cal-seg-missing"></i></span>AM · PM · water: in, not fed, missing</span>
                                            <span><i class="cal-dot cal-m"></i>Mortality</span>
                                            <span><i class="cal-dot cal-g"></i>Growth sample</span>
                                            <span><i class="cal-dot cal-c"></i>Chemical</span>
                                            <span><span class="cal-swatch cal-swatch-today"></span>Today</span>
                                        </div>
                                        <div class="small text-muted mt-1">D is the day of culture. The three daily records are AM feeding, PM feeding and water quality; "Not fed" counts as logged.{{ b.isReadOnly ? '' : ' Click a day to open its log.' }}</div>
                                    </div>
                                </div>
                            }
                            @if (tab === 'sec-feeding') {
                            <div class="card" id="sec-feeding">
                                <div class="card-header d-flex align-items-center">
                                    <h3 class="card-title mr-auto"><i class="fas fa-utensils" aria-hidden="true"></i>Feeding</h3>
                                    <span class="small text-muted">{{ b.indicators.cumulativeFeedKg | num: 1 }} kg in {{ feedPager.total }} session{{ feedPager.total === 1 ? '' : 's' }}</span>
                                </div>
                                <div class="card-body p-0 table-responsive fpms-scroll">
                                    <table class="table table-sm mb-0">
                                        <thead><tr><th fpmsSort="feedDate" [pager]="feedPager" (sorted)="loadFeeding()">Date</th><th fpmsSort="session" [pager]="feedPager" (sorted)="loadFeeding()">Session</th><th class="text-right">Kg</th><th>Feed lots</th><th>By</th></tr></thead>
                                        <tbody>
                                            @for (s of sessions; track s.id) {
                                                <tr>
                                                    <td class="text-nowrap"><a href="javascript:;" (click)="drawer.open({ kind: 'feeding', batchId: b.id, date: String(s.feedDate).substring(0, 10) })">{{ s.feedDate | farmDate }}</a></td>
                                                    <td>{{ s.session | label: L.FeedingSessions }}</td>
                                                    <td class="text-right">@if (s.status === 2) { <span class="text-muted">Not fed</span> } @else { {{ s.kg | num: 3 }} }</td>
                                                    <td class="small">
                                                        @for (l of s.lines; track l.lotId) { <div>{{ l.label }}{{ s.lines.length > 1 ? ': ' + (l.kg | num: 3) + ' kg' : '' }}</div> }
                                                    </td>
                                                    <td class="small text-muted">{{ s.recordedBy }}<div>recorded {{ s.creationTime | farmDateTime }}</div></td>
                                                </tr>
                                            } @empty {
                                                <tr><td colspan="5" class="text-center text-muted py-3">No feeding recorded yet.</td></tr>
                                            }
                                        </tbody>
                                    </table>
                                </div>
                                <fpms-pager [state]="feedPager" (changed)="loadFeeding()"></fpms-pager>
                            </div>
                            }
                            @if (tab === 'sec-logs') {
                            <div class="card" id="sec-logs">
                                <div class="card-header d-flex align-items-center">
                                    <h3 class="card-title mr-auto"><i class="fas fa-book" aria-hidden="true"></i>Logs</h3>
                                    <select class="form-control form-control-sm w-auto" aria-label="Filter log type" [(ngModel)]="logType" (ngModelChange)="logPager.reset(); loadLogs()">
                                        <option [ngValue]="null">All types</option>
                                        @for (o of Options.logType; track o.value) {
                                            <option [ngValue]="o.value">{{ o.label }}</option>
                                        }
                                    </select>
                                </div>
                                <div class="card-body p-0 table-responsive fpms-scroll">
                                    <table class="table table-sm mb-0">
                                        <thead><tr><th fpmsSort="observedAt" [pager]="logPager" (sorted)="loadLogs()">Observed</th><th fpmsSort="logType" [pager]="logPager" (sorted)="loadLogs()">Type</th><th>Details</th><th>By</th></tr></thead>
                                        <tbody>
                                            @for (l of logs; track l.id) {
                                                <tr>
                                                    <td class="text-nowrap"><a [routerLink]="['/app/logbook', l.id]">{{ l.observedAtUtc | farmDateTime }}</a></td>
                                                    <td>
                                                        {{ l.logType | label: L.LogTypes }}
                                                        @if (l.hasOutOfRange) { <i class="fas fa-exclamation-triangle text-warning ml-1" title="Out of range"></i> }
                                                    </td>
                                                    <td class="small">{{ summary(l) }}</td>
                                                    <td class="small text-muted">{{ l.recordedBy }}<div>recorded {{ l.creationTime | farmDateTime }}</div></td>
                                                </tr>
                                            } @empty {
                                                <tr><td colspan="4" class="text-center text-muted py-3">No log entries yet.</td></tr>
                                            }
                                        </tbody>
                                    </table>
                                </div>
                                <fpms-pager [state]="logPager" (changed)="loadLogs()"></fpms-pager>
                            </div>
                            }
                            @if (tab === 'sec-harvests') {
                            <div class="card" id="sec-harvests">
                                <div class="card-header d-flex align-items-center">
                                    <h3 class="card-title mr-auto"><i class="fas fa-shrimp" aria-hidden="true"></i>Harvests</h3>
                                    @if (b.canAddHarvest && can('Farm.Harvests.Create')) {
                                        <a class="btn btn-sm btn-outline-primary" routerLink="/app/harvests/new" [queryParams]="{ batchId: b.id }"><i class="fas fa-plus mr-1"></i>Record harvest</a>
                                    }
                                </div>
                                @if (harvests.length) {
                                    <!-- Where every harvested kg went: sold, recorded as not sold, or still to account for (DEC-67). -->
                                    <div class="card-body pb-2">
                                        <div class="row text-center">
                                            <div class="col-6 col-md-3"><div class="fpms-kpi"><div class="v">{{ hTotals().kg | num: 2 }}</div><div class="l">kg harvested ({{ harvests.length }})</div></div></div>
                                            <div class="col-6 col-md-3"><div class="fpms-kpi"><div class="v">{{ hTotals().sold | num: 2 }}</div><div class="l">kg sold</div></div></div>
                                            <div class="col-6 col-md-3"><div class="fpms-kpi"><div class="v">{{ hTotals().notSold | num: 2 }}</div><div class="l">kg not sold (kept, given, spoiled)</div></div></div>
                                            <div class="col-6 col-md-3"><div class="fpms-kpi"><div class="v" [class.text-warning-dark]="hTotals().left > 0">{{ hTotals().left | num: 2 }}</div><div class="l">kg still to account for</div></div></div>
                                        </div>
                                        @if (hTotals().left > 0) {
                                            <div class="alert alert-warning small mb-0 mt-2" role="status">
                                                <i class="fas fa-info-circle mr-1"></i><strong>{{ hTotals().left | num: 2 }} kg</strong> of this batch's harvest is neither sold nor recorded as not sold.
                                                @if (hTotals().sellable > 0) { {{ hTotals().sellable | num: 2 }} kg is graded and ready to sell: use <strong>Sell</strong> on its row. }
                                                @if (hTotals().ungraded > 0) { {{ hTotals().ungraded | num: 2 }} kg is not on any grade line yet: open the harvest and add it to a grade (or "Ungraded / mixed") before it can be sold. }
                                                Kg that were kept, given away or spoiled: open the harvest and add them under <em>Not sold</em>.{{ b.status !== 5 ? ' Close Batch lists whatever is left.' : '' }}
                                            </div>
                                        } @else {
                                            <p class="small text-success mb-0 mt-2"><i class="fas fa-check-circle mr-1"></i>Every harvested kilogram is sold or recorded as not sold.</p>
                                        }
                                    </div>
                                }
                                <div class="card-body p-0 table-responsive">
                                    <table class="table table-sm mb-0">
                                        <thead>
                                            <tr>
                                                <th>Date</th><th>Type</th><th>Buyer</th><th class="text-right">Kg</th><th class="text-right">ABW (g)</th>
                                                <th class="text-right">Sold</th><th class="text-right">Not sold</th><th class="text-right">To account for</th><th><span class="sr-only">Actions</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @for (h of harvests; track h.id) {
                                                <tr>
                                                    <td class="text-nowrap"><a [routerLink]="['/app/harvests', h.id]">{{ h.harvestedAtUtc | farmDateTime }}</a>@if (h.lotCode) { <div class="small text-muted text-monospace">{{ h.lotCode }}@if (can('Farm.Reports')) { · <a [routerLink]="['/app/reports/trace/lot', h.lotCode]" title="Trace this lot">Trace</a> }</div> }</td>
                                                    <td>{{ h.harvestType | label: L.HarvestTypes }}</td>
                                                    <td>{{ h.buyerName || '—' }}</td>
                                                    <td class="text-right">{{ h.totalKg | num: 2 }}@if (h.crates?.length) { <div class="small text-muted">{{ h.crates.length }} crates</div> }</td>
                                                    <td class="text-right">{{ h.abwG != null ? (h.abwG | num: 2) : '—' }}</td>
                                                    <td class="text-right">{{ h.soldKg | num: 2 }}</td>
                                                    <td class="text-right">{{ h.notSoldKg | num: 2 }}</td>
                                                    <td class="text-right">
                                                        @if (h.unaccountedKg > 0) {
                                                            <span class="text-warning-dark font-weight-bold">{{ h.unaccountedKg | num: 2 }}</span>
                                                            @if (h.ungradedRemainderKg > 0) { <div class="small text-muted">{{ h.ungradedRemainderKg | num: 2 }} not graded</div> }
                                                        } @else {
                                                            <span class="text-success" title="Sold or recorded as not sold"><i class="fas fa-check" aria-hidden="true"></i><span class="sr-only">Nothing left</span></span>
                                                        }
                                                    </td>
                                                    <td class="text-right text-nowrap">
                                                        @if (sellableOf(h) > 0 && can('Farm.Sales')) {
                                                            <a class="btn btn-xs btn-outline-primary mr-1" routerLink="/app/sales/new" [queryParams]="{ harvestId: h.id }" [title]="'Sell the ' + (sellableOf(h) | num: 2) + ' kg left'">Sell</a>
                                                        }
                                                        <a class="btn btn-xs btn-outline-secondary" [routerLink]="['/app/harvests', h.id, 'tally']"><i class="fas fa-clipboard-list mr-1" aria-hidden="true"></i>Tally sheet</a>
                                                    </td>
                                                </tr>
                                            } @empty {
                                                <tr>
                                                    <td colspan="9" class="text-center text-muted py-3">
                                                        No harvests yet.
                                                        @if (b.canAddHarvest && can('Farm.Harvests.Create')) {
                                                            <div class="small mt-1">Use <strong>Record harvest</strong>: a <em>Partial</em> harvest leaves shrimp in the pond; the <em>Total</em> harvest is the last one and marks the batch Harvested.</div>
                                                        }
                                                    </td>
                                                </tr>
                                            }
                                        </tbody>
                                        @if (harvests.length > 1) {
                                            <tfoot>
                                                <tr class="font-weight-bold">
                                                    <td colspan="3">Total</td>
                                                    <td class="text-right">{{ hTotals().kg | num: 2 }}</td>
                                                    <td></td>
                                                    <td class="text-right">{{ hTotals().sold | num: 2 }}</td>
                                                    <td class="text-right">{{ hTotals().notSold | num: 2 }}</td>
                                                    <td class="text-right">{{ hTotals().left | num: 2 }}</td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        }
                                    </table>
                                </div>
                            </div>
                            }
                        </div>
                    </div>
                }
            </div>
        </section>
    `,
    styles: [
        `
            .fpms-tabs {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin: 0.25rem 0 1rem;
                border-bottom: 1px solid var(--fpms-line);
            }
            .fpms-tabs button {
                padding: 0.6rem 0.9rem;
                border: 0;
                border-bottom: 3px solid transparent;
                margin-bottom: -1px;
                background: transparent;
                color: var(--fpms-text);
                font-size: 0.92rem;
                cursor: pointer;
            }
            .fpms-tabs button[aria-selected='true'] {
                border-bottom-color: var(--fpms-primary);
                color: var(--fpms-primary);
                font-weight: 600;
            }
            .card[id^='sec-'] {
                scroll-margin-top: 1rem;
            }
        `,
        `
            .cal-stats { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
            .cal-stat { display: flex; flex-direction: column; min-width: 96px; padding: 0.5rem 0.75rem; border: 1px solid #e4e7ea; border-radius: 6px; }
            .cal-stat-wide { flex: 1 1 220px; justify-content: center; }
            .cal-stat-n { font-size: 1.35rem; font-weight: 600; line-height: 1.2; }
            .cal-stat-l { font-size: 0.8rem; color: #6c757d; }
            .cal-text-partial { color: #b7791f; }
            .cal-bar { display: flex; height: 8px; margin-top: 6px; border-radius: 4px; overflow: hidden; background: #f1f3f5; }
            .cal-bar-full { background: #2b7a46; }
            .cal-bar-partial { background: #f0b429; }
            .cal-bar-empty { background: #dc3545; }
            .cal-months { display: flex; flex-wrap: wrap; gap: 1.25rem 1.5rem; }
            .cal-month-block { flex: 0 1 330px; min-width: 260px; }
            .cal-month-title { font-size: 0.95rem; font-weight: 600; margin: 0 0 0.4rem; color: #213260; }
            .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(34px, 1fr)); gap: 4px; }
            .cal-wd { font-size: 0.7rem; font-weight: 600; text-align: center; color: #6c757d; text-transform: uppercase; letter-spacing: 0.03em; }
            .cal-day { position: relative; display: block; aspect-ratio: 1 / 1; min-height: 38px; padding: 3px 4px; border-radius: 6px; border: 1px solid transparent; color: #212529; text-decoration: none; }
            a.cal-day:not(.cal-static) { cursor: pointer; }
            a.cal-day:not(.cal-static):hover, a.cal-day:focus-visible { outline: 2px solid #1b6697; outline-offset: 1px; text-decoration: none; color: #212529; }
            .cal-out { color: #ced4da; font-size: 0.75rem; background: transparent; }
            .cal-num { font-size: 0.8rem; font-weight: 600; line-height: 1; }
            .cal-doc { position: absolute; right: 4px; top: 3px; font-size: 0.6rem; color: #6c757d; line-height: 1; }
            .cal-events { position: absolute; left: 4px; top: 16px; display: flex; gap: 2px; }
            .cal-segs { position: absolute; left: 4px; right: 4px; bottom: 4px; display: flex; gap: 2px; }
            .cal-seg { flex: 1; height: 4px; border-radius: 2px; }
            .cal-seg-in { background: #2b7a46; }
            .cal-seg-notfed { background: repeating-linear-gradient(45deg, #6c757d, #6c757d 2px, #ced4da 2px, #ced4da 4px); }
            .cal-seg-missing { background: transparent; box-shadow: inset 0 0 0 1px #c9303e; }
            .cal-s3 { background: #e7f5ec; border-color: #b7e0c4; }
            .cal-s1, .cal-s2 { background: #fff6dd; border-color: #f3d38a; }
            .cal-s0 { background: #fdecee; border-color: #f2b8bf; }
            .cal-today { box-shadow: 0 0 0 2px #213260; }
            .cal-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; }
            .cal-m { background: #dc3545; }
            .cal-g { background: #1b6697; }
            .cal-c { background: #6f42c1; }
            .cal-legend { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; align-items: center; }
            .cal-legend > span { display: inline-flex; align-items: center; gap: 0.35rem; }
            .cal-swatch { display: inline-block; width: 14px; height: 14px; border-radius: 4px; border: 1px solid transparent; }
            .cal-swatch-today { box-shadow: 0 0 0 2px #213260; background: #fff; }
            .cal-segs-legend { position: static; width: 34px; }
            @media print { .cal-day { aspect-ratio: auto; min-height: 30px; } .cal-today { box-shadow: none; } }
        `,
    ],
})
export class BatchDetailComponent extends FpmsPage implements OnInit {
    readonly sections = [
        { id: 'sec-stocking', label: 'Stocking details' },
        { id: 'sec-calendar', label: 'Log calendar' },
        { id: 'sec-feeding', label: 'Feeding' },
        { id: 'sec-logs', label: 'Logs' },
        { id: 'sec-harvests', label: 'Harvests' },
    ];

    /** The batch page shows one section at a time, chosen from the tab bar (as in the mockup). */
    tab = 'sec-stocking';

    b: any = null;
    logs: any[] = [];
    sessions: any[] = [];
    harvests: any[] = [];
    feedPager = new PagerState('feedDate desc');
    logPager = new PagerState('observedAt desc');
    logType: number | null = null;
    failure: any = null;
    closing: any = null;
    closeCheck: any = null;
    reopening: { reason: string } | null = null;
    calendar: any = null;
    calMonths: CalMonth[] = [];
    calStats = { days: 0, full: 0, partial: 0, empty: 0, pct: 0, fullPct: 0, partialPct: 0, emptyPct: 0 };
    readonly weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    /** DEC-62: display-only health test hint by DOC (Shrimp Farmers' Manual); no tasks or overdue state. */
    get docHint(): string | null {
        const doc = this.b?.indicators?.doc;
        if (doc == null) {
            return null;
        }
        const next = [30, 45, 60, 75].find((d) => d >= doc - 2);
        return next == null
            ? null
            : `Health check: a PCR test is suggested around DOC 30, 45, 60 and 75. Next: DOC ${next}${next - doc > 0 ? ` (in ${next - doc} day${next - doc === 1 ? '' : 's'})` : ' (now)'}.`;
    }

    async reopen(): Promise<void> {
        if (await this.act(() => this.api.post('Batch', 'Reopen', { id: this.b.id, reason: this.reopening!.reason.trim(), rowVersion: this.b.rowVersion }))) {
            this.notifySaved('Batch reopened.');
            this.load();
        }
    }
    readonly logTypeKeys = Object.keys(this.L.LogTypeNames).map((key) => ({ key, value: this.L.LogTypeNames[key], camel: key[0].toLowerCase() + key.slice(1), label: this.L.LogTypes[this.L.LogTypeNames[key]] }));

    get canManage(): boolean {
        return this.can('Farm.Production.Manage');
    }

    /** Reloads the batch when something is saved in the log drawer beside it. */
    private readonly reloadOnDrawerSave = (() => {
        let first = true;
        return effect(() => {
            this.drawer.saved();
            if (first) {
                first = false;
                return;
            }
            untracked(() => {
                if (this.b) {
                    void this.load();
                }
            });
        });
    })();

    protected readonly String = String;

    ngOnInit(): void {
        // Detail routes reuse this component when only the :id changes, so reload on every change.
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        // ?tab=harvests (or another section) opens that tab, e.g. after recording a harvest.
        const wanted = this.query('tab');
        this.tab = this.sections.find((x) => x.id === wanted || x.id === 'sec-' + wanted)?.id ?? 'sec-stocking';
        this.load();
    }

    /** Kg of a harvest on grade lines and not yet sold: what a sale can still take. */
    sellableOf(h: any): number {
        return (h.gradeLines ?? []).reduce((sum: number, g: any) => sum + (g.unsoldKg || 0), 0);
    }

    /** The batch's harvest totals, as the server computes them per harvest (sold, not sold, unaccounted = total − both). */
    hTotals(): { kg: number; sold: number; notSold: number; left: number; sellable: number; ungraded: number } {
        const sum = (f: (h: any) => number) => Math.round(this.harvests.reduce((s, h) => s + (f(h) || 0), 0) * 1000) / 1000;
        return {
            kg: sum((h) => h.totalKg),
            sold: sum((h) => h.soldKg),
            notSold: sum((h) => h.notSoldKg),
            left: sum((h) => h.unaccountedKg),
            sellable: sum((h) => this.sellableOf(h)),
            ungraded: sum((h) => Math.min(h.ungradedRemainderKg || 0, h.unaccountedKg || 0)),
        };
    }

    /** Keeps the tab in the address, so a refresh or Back returns to it (as on the pond page). */
    setTab(id: string): void {
        this.tab = id;
        this.router.navigate([], { relativeTo: this.route, queryParams: { tab: id.replace(/^sec-/, '') }, queryParamsHandling: 'merge', replaceUrl: true });
    }

    async load(): Promise<void> {
        const id = this.param('id');
        this.b = await this.api.get<any>('Batch', 'Get', { id });
        this.setPageTitle(this.b ? `Batch ${this.b.batchCode}` : null);
        this.failure = this.closing = null;
        this.reopening = null;
        this.loadLogs();
        this.loadFeeding();
        this.loadCalendar();
        if (this.can('Farm.Harvests')) {
            // A batch has a handful of harvests, so the first 100 cover it.
            this.harvests = (await this.api.get<any>('Harvest', 'GetList', { batchId: id, maxResultCount: 100, sorting: 'harvestedAt desc' })).items;
        }
    }

    /**
     * Log calendar: a month grid (Monday first) per month of culture, one cell per day from stocking to the end of culture.
     * A cell shows the date, the day of culture, its AM / PM / water records as three bars, and dots for other entries.
     */
    async loadCalendar(): Promise<void> {
        const cal = await this.run(() => this.api.get<any>('Batch', 'GetLogCalendar', { id: this.b.id }));
        this.calendar = cal;
        const days: any[] = cal?.days ?? [];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const ymd = (d: any): string => String(d.date).substring(0, 10);
        const utc = (iso: string): Date => new Date(iso + 'T00:00:00Z');
        const byDate = new Map<string, any>(days.map((d) => [ymd(d), d]));
        const first = days.length ? utc(ymd(days[0])) : null;
        const months: CalMonth[] = [];
        if (first) {
            const last = utc(ymd(days[days.length - 1]));
            const end = last.getUTCFullYear() * 12 + last.getUTCMonth();
            for (let index = first.getUTCFullYear() * 12 + first.getUTCMonth(); index <= end; index++) {
                const y = Math.floor(index / 12);
                const m = index % 12;
                const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
                const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
                const cells: CalCell[] = [];
                for (let i = 0; i < lead; i++) {
                    cells.push({ day: null, dayOfMonth: 0, doc: 0, isToday: false });
                }

                for (let dom = 1; dom <= length; dom++) {
                    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(dom).padStart(2, '0')}`;
                    const day = byDate.get(iso) ?? null;
                    const doc = Math.round((utc(iso).getTime() - first.getTime()) / 86400000);
                    cells.push({ day, dayOfMonth: dom, doc, isToday: iso === this.today });
                }

                months.push({ key: `${y}-${m}`, title: `${monthNames[m]} ${y}`, cells });
            }
        }

        this.calMonths = months;
        const full = days.filter((d) => this.calScore(d) === 3).length;
        const empty = days.filter((d) => this.calScore(d) === 0).length;
        const partial = days.length - full - empty;
        const pct = (n: number): number => (days.length ? Math.round((n / days.length) * 1000) / 10 : 0);
        this.calStats = { days: days.length, full, partial, empty, pct: Math.round(pct(full)), fullPct: pct(full), partialPct: pct(partial), emptyPct: pct(empty) };
    }

    /** One of the three daily records: 0 missing, 1 in, 2 Not fed. */
    segClass(v: number): string {
        return v === 0 ? 'cal-seg-missing' : v === 2 ? 'cal-seg-notfed' : 'cal-seg-in';
    }

    openDay(d: any): void {
        if (!this.b.isReadOnly) {
            this.drawer.open({ batchId: this.b.id, date: String(d.date).substring(0, 10) });
        }
    }

    /** Number of the three daily records (AM, PM, water) in for the day; Not fed counts as in. */
    calScore(d: any): number {
        return [d.am, d.pm, d.water].filter((x) => x !== 0).length;
    }

    calClass(d: any): string {
        return 'cal-s' + this.calScore(d);
    }

    calTip(d: any, doc?: number): string {
        const missing = [d.am === 0 ? 'AM feeding' : '', d.pm === 0 ? 'PM feeding' : '', d.water === 0 ? 'water quality' : ''].filter((x) => x);
        const notFed = [d.am === 2 ? 'AM' : '', d.pm === 2 ? 'PM' : ''].filter((x) => x);
        const events = [d.hasMortality ? 'mortality' : '', d.hasGrowthSampling ? 'growth sample' : '', d.hasChemical ? 'chemical' : ''].filter((x) => x);
        return [
            String(d.date).substring(0, 10) + (doc != null ? ` (day ${doc})` : ''),
            missing.length ? 'Missing: ' + missing.join(', ') : 'All daily records in',
            notFed.length ? 'Not fed: ' + notFed.join(', ') : '',
            events.length ? 'Also: ' + events.join(', ') : '',
        ].filter((x) => x).join(' · ');
    }

    async loadLogs(): Promise<void> {
        const r = await this.api.get<any>('Log', 'GetList', { batchId: this.b.id, logType: this.logType, ...this.logPager.params });
        this.logs = r.items;
        if (this.logPager.update(r.totalCount)) {
            await this.loadLogs();
        }
    }

    async loadFeeding(): Promise<void> {
        const r = await this.api.get<any>('Feeding', 'GetList', { batchId: this.b.id, ...this.feedPager.params });
        this.sessions = r.items;
        if (this.feedPager.update(r.totalCount)) {
            await this.loadFeeding();
        }
    }

    summary(l: any): string {
        return logSummary(l);
    }

    feedKg(sessions: any[]): number {
        return sessions.reduce((sum, x) => sum + (x.kg ?? 0), 0);
    }

    startFailure(): void {
        this.failure = { id: this.b.id, reason: '', failureDate: this.today, estimatedLossPhp: null, rowVersion: this.b.rowVersion };
    }

    async saveFailure(): Promise<void> {
        if (await this.act(() => this.api.post('Batch', 'DeclareFailure', this.failure))) {
            this.notifySaved('Batch declared failed.');
            this.load();
        }
    }

    async startClose(): Promise<void> {
        this.closing = { confirm: false };
        this.closeCheck = null;
        this.closeCheck = (await this.run(() => this.api.get<any>('Batch', 'GetCloseCheck', { id: this.b.id }))) ?? { blankDaysTotal: 0, notFedSlots: 0, blankDays: [] };
    }

    async close(): Promise<void> {
        let result: any;
        if (await this.act(async () => (result = await this.api.post('Batch', 'Close', { id: this.b.id, confirmReadOnly: true, rowVersion: this.b.rowVersion })))) {
            this.notifySaved(`Batch closed. Final FCR ${result?.finalFcr?.toFixed?.(2) ?? '—'}, survival ${result?.survivalRatePct?.toFixed?.(1) ?? '—'}%.`);
            this.load();
        }
    }
}
