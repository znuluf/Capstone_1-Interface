import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime, newGuid } from '@shared/fpms/farm-time';
import { FormDrafts, OpsMemory } from '@shared/fpms/drafts';
import { logSummary } from '@shared/fpms/log-summary';
import { FPMS_IMPORTS } from '../shared-imports';
import { optimalState } from '../production/water-quality';

const DRAFT = 'log-entry';

/**
 * Operations log entry (Refs 6.2–6.5; Journey 4; AC-11, AC-12, AC-20, AC-22, AC-25): choose the pond (batch), then record water quality, growth sampling, chemical and supplement application, mortality or a note.
 * Feeding is recorded as numbered feedings on the feeding page (DEC-61). New entries keep a per-user draft in the browser.
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [narrow]="!pondDay" [title]="isNew ? 'Record operations' : (log ? (log.logType | label: L.LogTypes) + ' log' : 'Log entry')" [subtitle]="subtitle" [backLink]="isNew && !cameFromBatch ? undefined : batch ? ['/app/production/batches', batch.id] : '/app/logbook'" [backLabel]="batch ? 'Batch ' + batch.batchCode : 'Logbooks'"></fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid" [class.fpms-narrow]="!pondDay">
                @if (loading) {
                    <fpms-loading></fpms-loading>
                } @else {
                    @if (restoredAt) {
                        <div class="alert alert-info d-flex align-items-center" role="status">
                            <i class="fas fa-history mr-2"></i>
                            <span class="mr-auto">Your unsaved entry from {{ restoredAt | farmDateTime }} was restored.</span>
                            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="discardDraft()">Discard it</button>
                        </div>
                    }

                    @if (result) {
                        <div class="alert" [class.alert-success]="!result.warnings.length" [class.alert-warning]="result.warnings.length" role="status">
                            <strong>{{ result.wasDuplicate ? 'Already saved' : 'Saved' }}.</strong>
                            @if (result.wasDuplicate) { This entry was already recorded; no duplicate was created. }
                            @for (w of result.warnings; track $index) {
                                <div><i class="fas fa-exclamation-triangle mr-1"></i>{{ w.message }}</div>
                            }
                            @if (result.indicators; as i) {
                                <div class="small mt-1">
                                    DOC {{ i.doc ?? '—' }} · ABW {{ i.currentAbwG | num: 2 }} g · feed {{ i.cumulativeFeedKg | num: 1 }} kg · FCR to date {{ i.fcrToDate | num: 2 }} · est. population {{ i.estimatedPopulation | num: 0 }}
                                </div>
                            }
                        </div>
                        @if (isNew) {
                            <div class="mb-3">
                                <button class="btn btn-primary mr-2" (click)="another(true)"><i class="fas fa-plus mr-1"></i>Another {{ form.logType | label: L.LogTypes }} log</button>
                                <button class="btn btn-outline-primary mr-2" (click)="another(false)">Different record</button>
                                <a class="btn btn-default" [routerLink]="['/app/production/batches', form.batchId]">Back to batch</a>
                            </div>
                        }
                    }

                    @if (log?.isVoided) {
                        <div class="alert alert-secondary small"><i class="fas fa-ban mr-1"></i>This entry was voided: {{ log.voidReason }}</div>
                    } @else if (readOnly && !isNew) {
                        <div class="alert alert-secondary small">
                            <i class="fas fa-lock mr-1"></i>
                            @if (batch?.isReadOnly) { The batch is Closed; its logs are read-only. }
                            @else if (historical) { This is a historical {{ log.logType | label: L.LogTypes }} entry kept for the record; it can no longer be edited. }
                            @else { You can only edit entries you recorded. Ask a Farm Owner to correct it. }
                        </div>
                    }

                    @if (!result || !isNew) {
                        <!-- This pond today (DEC-96, DEC-106): a band above the form, so what is already in for the day is seen first. -->
                        @if (pondDay; as t) {
                            <section class="fpms-summary fpms-today-band" aria-label="This pond today">
                                <div class="fpms-today-head">
                                    <h3>{{ batch?.pondCode }} {{ t.day === today ? 'today' : 'on ' + (t.day | farmDate) }}{{ batch?.indicators?.doc != null ? ' · day ' + batch.indicators.doc : '' }}</h3>
                                    <a [routerLink]="['/app/production/batches', batch?.id]" [queryParams]="{ tab: 'daily' }">Open the Daily record<i class="fas fa-arrow-right ml-1" aria-hidden="true"></i></a>
                                </div>
                                <dl class="fpms-figures-more">
                                    <div><dt>Feedings</dt><dd>{{ t.fed }} of {{ t.feedings }} entered</dd></div>
                                    <div><dt>Water quality</dt><dd>{{ t.water ? 'Entered' : 'Not entered yet' }}</dd></div>
                                    <div><dt>Mortality</dt><dd>{{ t.dead == null ? 'None entered' : (t.dead | num: 0) + ' dead' }}</dd></div>
                                    <div><dt>Growth sample</dt><dd>{{ t.lastSample ? 'Last ' + (t.lastSample.date | farmDate) + ' (' + (t.lastSample.abwG | num: 1) + ' g)' : 'None yet' }}</dd></div>
                                </dl>
                            </section>
                        }
                        <div class="fpms-entry-grid" [class.has-side]="!!(pondDay && form.logType && pondDay.recent.length)">
                        <div class="fpms-entry-main">
                        <!-- One panel (DEC-106): the form's parts are sections of it, divided by rules, with Save as its footer. -->
                        <form #f="ngForm" class="fpms-form-stack" (ngSubmit)="save()" (input)="keepDraft()" (change)="keepDraft()" novalidate>
                            <fieldset [disabled]="readOnly">
                                <!-- Observed at, shown beside the pond (new entries) or on its own; declared inside the form so it is validated with it. -->
                                <ng-template #observedTpl>
                                    <label for="obs">Observed at <span class="text-danger">*</span></label>
                                    <input id="obs" type="datetime-local" class="form-control" name="observedAt" [(ngModel)]="form.observedAt" required [max]="nowInput" />
                                    <small class="form-text text-muted">Farm time. For a paper sheet, the time written on it.</small>
                                </ng-template>
                                <div class="card">
                                    <div class="card-body">
                                        @if (isNew) {
                                            @if (inWizard) {
                                                <p class="mb-3"><strong>Pond (batch):</strong> {{ batch?.pondCode }} · {{ batch?.batchCode }}</p>
                                            } @else {
                                            <div class="form-row">
                                                    <div class="form-group col-md-6">
                                                        <label for="batch">Pond (batch) <span class="text-danger">*</span></label>
                                                        <select id="batch" class="form-control" name="batchId" [(ngModel)]="form.batchId" (ngModelChange)="onBatch()" required>
                                                            @for (x of openBatches; track x.id) {
                                                                <option [value]="x.id">{{ x.pondCode }} · {{ x.letter ? 'Batch ' + x.letter : x.batchCode }} ({{ x.status | label: L.BatchStatuses }})</option>
                                                            }
                                                        </select>
                                                        @if (!openBatches.length) {
                                                            <small class="form-text text-muted">No pond is stocked. Stock a batch first (Production → Stock a batch).</small>
                                                        }
                                                    </div>
                                                    <!-- When, beside where (DEC-106). -->
                                                    @if (form.logType) {
                                                        <div class="form-group col-md-6">
                                                            <ng-container *ngTemplateOutlet="observedTpl"></ng-container>
                                                        </div>
                                                    }
                                                </div>
                                            }
                                            @if (batch && !(inWizard && form.logType)) {
                                                <label class="d-block">What are you recording? <span class="text-danger">*</span></label>
                                                <div class="fpms-lw-tiles fpms-lw-tiles-row mt-2" role="radiogroup" aria-label="Record type">
                                                    @if (!inWizard) {
                                                        <a class="fpms-lw-tile" [routerLink]="['/app/logbook/feeding']" [queryParams]="{ batchId: batch.id }">
                                                            <i class="fas fa-utensils" aria-hidden="true"></i>Feeding <span class="sr-only">(opens the Feeding sheet)</span>
                                                        </a>
                                                    }
                                                    @for (o of allowedTypes; track o.value) {
                                                        <button type="button" class="fpms-lw-tile" role="radio" [attr.aria-checked]="form.logType === o.value" [attr.aria-label]="o.label" (click)="pickType(o.value)">
                                                            <i [class]="'fas ' + typeIcon(o.value)" aria-hidden="true"></i>{{ o.value === 6 ? 'Chemical or supplement' : o.label }}
                                                        </button>
                                                    }
                                                </div>
                                            }
                                        } @else {
                                            <p class="mb-2"><strong>Pond (batch):</strong> {{ batch?.pondCode }} · {{ batch?.batchCode }} · cycle {{ batch?.cycleCode }}</p>
                                        }
                                        @if (form.logType && (!isNew || inWizard)) {
                                            <div class="form-row">
                                                <div class="form-group col-md-6 mb-0">
                                                    <ng-container *ngTemplateOutlet="observedTpl"></ng-container>
                                                </div>
                                            </div>
                                        }
                                    </div>
                                </div>

                                @if (historical && log) {
                                    <div class="card">
                                        <div class="card-header"><h3 class="card-title">{{ log.logType | label: L.LogTypes }}</h3></div>
                                        <div class="card-body">{{ summary(log) || '—' }}</div>
                                    </div>
                                }

                                @if (form.logType === 2 || form.logType === 4) {
                                    <div class="card">
                                        <div class="card-header"><h3 class="card-title">Water quality readings</h3></div>
                                        <div class="card-body">
                                            <p class="small text-muted">Enter the parameters you measured (at least one{{ form.logType === 2 ? '; DO, temperature, pH and salinity are required before stocking' : '' }}). Out-of-range readings are saved and flagged.</p>
                                            <div class="form-row">
                                                @for (p of mainParams(); track p.code) {
                                                    <div class="form-group col-md-6 col-xl-3">
                                                        <label [for]="'r' + p.code">{{ p.name }} @if (form.logType === 2 && p.requiredAtStocking) { <span class="text-danger">*</span> }</label>
                                                        <div class="input-group">
                                                            <input [id]="'r' + p.code" type="number" step="any" inputmode="decimal" class="form-control" [name]="'r' + p.code" [(ngModel)]="readings[p.code]"
                                                                [min]="p.physicalMin" [max]="p.physicalMax" [required]="form.logType === 2 && p.requiredAtStocking" />
                                                            <div class="input-group-append"><span class="input-group-text">{{ p.unitCode }}</span></div>
                                                        </div>
                                                        <small class="form-text" [class.text-muted]="wq(p) === 'ok' || wq(p) === 'empty'" [class.text-warning-dark]="wq(p) === 'out'" [class.text-danger]="wq(p) === 'invalid'">
                                                            @switch (wq(p)) {
                                                                @case ('out') { <i class="fas fa-exclamation-triangle mr-1"></i>Out of range ({{ p.optimalRange }}) }
                                                                @case ('invalid') { Not physically possible ({{ p.physicalMin }}–{{ p.physicalMax }}) }
                                                                @default { {{ p.optimalRange }} · {{ p.guidanceFrequency }} }
                                                            }
                                                        </small>
                                                        @if (wq(p) === 'out' && advice(p); as a) {
                                                            <small class="form-text text-warning-dark">{{ a }}</small>
                                                        }
                                                    </div>
                                                }
                                            </div>
                                            @if (otherParams().length) {
                                                <details class="fpms-fold mb-0" [open]="form.logType === 2 || otherEntered()">
                                                    <summary>Other readings <span class="fpms-fold-hint">{{ otherNames() }}</span></summary>
                                                    <div class="form-row">
                                                        @for (p of otherParams(); track p.code) {
                                                    <div class="form-group col-md-6 col-xl-3">
                                                        <label [for]="'r' + p.code">{{ p.name }} @if (form.logType === 2 && p.requiredAtStocking) { <span class="text-danger">*</span> }</label>
                                                        <div class="input-group">
                                                            <input [id]="'r' + p.code" type="number" step="any" inputmode="decimal" class="form-control" [name]="'r' + p.code" [(ngModel)]="readings[p.code]"
                                                                [min]="p.physicalMin" [max]="p.physicalMax" [required]="form.logType === 2 && p.requiredAtStocking" />
                                                            <div class="input-group-append"><span class="input-group-text">{{ p.unitCode }}</span></div>
                                                        </div>
                                                        <small class="form-text" [class.text-muted]="wq(p) === 'ok' || wq(p) === 'empty'" [class.text-warning-dark]="wq(p) === 'out'" [class.text-danger]="wq(p) === 'invalid'">
                                                            @switch (wq(p)) {
                                                                @case ('out') { <i class="fas fa-exclamation-triangle mr-1"></i>Out of range ({{ p.optimalRange }}) }
                                                                @case ('invalid') { Not physically possible ({{ p.physicalMin }}–{{ p.physicalMax }}) }
                                                                @default { {{ p.optimalRange }} · {{ p.guidanceFrequency }} }
                                                            }
                                                        </small>
                                                        @if (wq(p) === 'out' && advice(p); as a) {
                                                            <small class="form-text text-warning-dark">{{ a }}</small>
                                                        }
                                                    </div>
                                                        }
                                                    </div>
                                                </details>
                                            }
                                        </div>
                                    </div>
                                }

                                @if (form.logType === 5) {
                                    <div class="card">
                                        <div class="card-header"><h3 class="card-title">Growth sampling</h3></div>
                                        <div class="card-body">
                                            <!-- DEC-97: the ABW is typed as in the logbook; a sample, if taken, works it out instead. -->
                                            <div class="form-row">
                                                <div class="form-group col-md-6">
                                                    <label for="abw">Average body weight (ABW) <span class="text-danger">*</span></label>
                                                    <div class="input-group">
                                                        @if (hasSample()) {
                                                            <input id="abw" class="form-control" name="abwShown" [ngModel]="sampleAbw() != null ? (sampleAbw()! | num: 2) : ''" readonly />
                                                        } @else {
                                                            <input id="abw" type="number" min="0.01" max="60" step="0.01" inputmode="decimal" class="form-control" name="abw" [(ngModel)]="growth.abwG" required />
                                                        }
                                                        <div class="input-group-append"><span class="input-group-text">g</span></div>
                                                    </div>
                                                    <small class="form-text text-muted">{{ hasSample() ? 'Worked out from the sample below.' : 'Type it as in the logbook, or work it out from a sample below.' }}</small>
                                                    @if (finalAbw() != null && finalAbw()! > 60) { <small class="form-text text-danger">More than 60 g is not possible. Check the value.</small> }
                                                    @if (abwChange(); as c) { <small class="form-text">{{ c }}</small> }
                                                </div>
                                            </div>
                                            <details class="fpms-fold" [open]="hasSample()">
                                                <summary>Work it out from a sample <span class="fpms-fold-hint">shrimp counted and their total weight</span></summary>
                                                <div class="form-row">
                                                    <div class="form-group col-md-6 mb-md-0">
                                                        <label for="sc">Shrimp in the sample</label>
                                                        <div class="input-group">
                                                            <input id="sc" type="number" min="1" step="1" inputmode="numeric" class="form-control" name="sc" [(ngModel)]="growth.sampleCount" [required]="hasSample()" />
                                                            <div class="input-group-append"><span class="input-group-text">pcs</span></div>
                                                        </div>
                                                    </div>
                                                    <div class="form-group col-md-6 mb-0">
                                                        <label for="sw2">Total sample weight</label>
                                                        <div class="input-group">
                                                            <input id="sw2" type="number" min="0.01" step="0.01" inputmode="decimal" class="form-control" name="sw2" [(ngModel)]="growth.totalSampleWeightG" [required]="hasSample()" />
                                                            <div class="input-group-append"><span class="input-group-text">g</span></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                @if (hasSample() && sampleAbw() == null) { <small class="d-block text-muted mt-2">Enter both numbers, or clear both and type the ABW.</small> }
                                            </details>
                                            <details class="fpms-fold mb-0" [open]="growth.estimatedSurvivalPct != null && growth.estimatedSurvivalPct !== ''">
                                                <summary>Estimated survival <span class="fpms-fold-hint">from a cast-net or feed tray check</span></summary>
                                                <div class="form-row">
                                                    <div class="form-group col-md-6 mb-0">
                                                        <label for="esp">Estimated survival</label>
                                                        <div class="input-group">
                                                            <input id="esp" type="number" min="0" max="100" step="0.1" inputmode="decimal" class="form-control" name="esp" [(ngModel)]="growth.estimatedSurvivalPct" />
                                                            <div class="input-group-append"><span class="input-group-text">%</span></div>
                                                        </div>
                                                        @if (growth.estimatedSurvivalPct != null && growth.estimatedSurvivalPct !== '' && (growth.estimatedSurvivalPct < 0 || growth.estimatedSurvivalPct > 100)) {
                                                            <small class="d-block text-danger">Enter a percentage from 0 to 100.</small>
                                                        }
                                                    </div>
                                                    <div class="col-md-6 d-flex align-items-center">
                                                        <small class="text-muted">When given, it replaces the population worked out from mortality: PL stocked × this % (losses and harvests after this sample are still taken off).</small>
                                                    </div>
                                                </div>
                                            </details>
                                            @if (log?.growthRateGPerDay != null) {
                                                <p class="small text-muted mt-3 mb-0">Growth since previous sample: {{ log.growthRateGPerDay | num: 2 }} g/day</p>
                                            }
                                        </div>
                                    </div>
                                }

                                @if (form.logType === 6) {
                                    <div class="card">
                                        <div class="card-header"><h3 class="card-title">Chemical and supplement application</h3></div>
                                        <div class="card-body">
                                            @if (!productLots.length) {
                                                <div class="alert alert-info small">No supplement or chemical lots in stock records. Ask a Farm Owner to record a receipt under Inventory.</div>
                                            }
                                            <label class="d-block">Products used <span class="text-danger">*</span></label>
                                            @for (u of chem.usages; track u.key) {
                                                <div class="form-row align-items-start mb-1">
                                                    <div class="col-7">
                                                        <select class="form-control" [name]="'ul' + u.key" [(ngModel)]="u.lotId" (ngModelChange)="prefillWithdrawal()" aria-label="Product lot" required>
                                                            @for (o of productLots; track o.lotId) {
                                                                <option [value]="o.lotId">{{ o.label }}</option>
                                                            }
                                                        </select>
                                                    </div>
                                                    <div class="col-3">
                                                        <div class="input-group">
                                                            <input type="number" min="0.001" step="0.001" inputmode="decimal" class="form-control" [name]="'uq' + u.key" [(ngModel)]="u.quantity" placeholder="Qty" aria-label="Quantity" required />
                                                            <div class="input-group-append"><span class="input-group-text">{{ lotUnit(u.lotId) }}</span></div>
                                                        </div>
                                                    </div>
                                                    <div class="col-2">
                                                        @if (chem.usages.length > 1) {
                                                            <button type="button" class="btn btn-outline-danger" (click)="removeUsage(u)" aria-label="Remove product"><i class="fas fa-times"></i></button>
                                                        }
                                                    </div>
                                                    @if (lotShort(u.lotId, u.quantity)) {
                                                        <div class="col-12"><small class="text-warning-dark"><i class="fas fa-exclamation-triangle mr-1"></i>More than this lot's stock on hand. It will save and the lot will be flagged for reconciliation.</small></div>
                                                    }
                                                    @if (lotExpired(u.lotId)) {
                                                        <div class="col-12"><small class="text-warning-dark"><i class="fas fa-exclamation-triangle mr-1"></i>This lot is past its expiry date.</small></div>
                                                    }
                                                </div>
                                            }
                                            <button type="button" class="btn btn-sm btn-outline-secondary mb-3" (click)="addUsage()" [disabled]="!productLots.length">
                                                <i class="fas fa-plus mr-1"></i>Add another product
                                            </button>
                                            <div class="form-group">
                                                <label for="rs">Reason</label>
                                                <input id="rs" class="form-control" name="rs" [(ngModel)]="chem.reason" maxlength="500" placeholder="e.g. low alkalinity, probiotic schedule, disinfection" />
                                            </div>
                                            <details class="fpms-fold mb-1" [open]="chemHasTreatment()">
                                                <summary>Treatment details <span class="fpms-fold-hint">dosage, method, withdrawal period, prescription; for drugs and chemicals</span></summary>
                                                <div class="form-row">
                                                    <div class="form-group col-6 col-md-3">
                                                        <label for="dz">Dosage</label>
                                                        <input id="dz" type="number" min="0" step="any" class="form-control" name="dz" [(ngModel)]="chem.dosage" />
                                                    </div>
                                                    <div class="form-group col-6 col-md-3">
                                                        <label for="du">Dosage unit</label>
                                                        <select id="du" class="form-control" name="du" [(ngModel)]="chem.dosageUnit">
                                                            <option value="">Select unit</option>
                                                            @for (u of dosageUnitOptions(); track u) {
                                                                <option [value]="u">{{ u }}</option>
                                                            }
                                                        </select>
                                                    </div>
                                                    <div class="form-group col-md-6">
                                                        <label for="me">Method</label>
                                                        <input id="me" class="form-control" name="me" [(ngModel)]="chem.method" maxlength="100" placeholder="broadcast, mixed in feed, bath" />
                                                    </div>
                                                </div>
                                                <div class="form-row">
                                                    <div class="form-group col-6 col-md-3">
                                                        <label for="ed">Last treatment day</label>
                                                        <input id="ed" type="date" class="form-control" name="ed" [(ngModel)]="chem.endDate" [min]="observedDate()" />
                                                    </div>
                                                    <div class="form-group col-6 col-md-3">
                                                        <label for="wd">Withdrawal days</label>
                                                        <input id="wd" type="number" min="0" max="365" step="1" class="form-control" name="wd" [(ngModel)]="chem.withdrawalDays" />
                                                        <small class="form-text text-muted">Pre-filled from the product when set.</small>
                                                    </div>
                                                    <div class="form-group col-md-6">
                                                        <label for="rx">Prescription / reference</label>
                                                        <input id="rx" class="form-control" name="rx" [(ngModel)]="chem.prescriptionRef" maxlength="100" placeholder="optional" />
                                                    </div>
                                                </div>
                                                @if (safeHarvestDate()) {
                                                    <p class="small mb-0"><i class="fas fa-prescription-bottle-alt mr-1"></i>Earliest safe harvest date: <strong>{{ safeHarvestDate() | farmDate }}</strong>. A harvest before then saves with a warning.</p>
                                                }
                                            </details>
                                        </div>
                                    </div>
                                }

                                @if (form.logType === 7) {
                                    <div class="card">
                                        <div class="card-header"><h3 class="card-title">Mortality</h3></div>
                                        <div class="card-body">
                                            <div class="form-row">
                                                <div class="form-group col-md-4">
                                                    <label for="mc">Dead shrimp counted <span class="text-danger">*</span></label>
                                                    <input id="mc" type="number" min="0" step="1" inputmode="numeric" class="form-control" name="mc" [(ngModel)]="mortality.count" required />
                                                </div>
                                                <div class="form-group col-md-8">
                                                    <label class="d-block">Cause <span class="text-danger">*</span></label>
                                                    <div role="radiogroup" aria-label="Cause">
                                                        @for (o of Options.mortalityCause; track o.value) {
                                                            <button type="button" class="btn mr-1 mb-1" role="radio" [attr.aria-checked]="mortality.cause === o.value"
                                                                [class.btn-primary]="mortality.cause === o.value" [class.btn-outline-primary]="mortality.cause !== o.value" (click)="mortality.cause = o.value; keepDraft()">
                                                                {{ o.label }}
                                                            </button>
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            @if (mortality.cause === 1) {
                                                <div class="form-group">
                                                    <label for="dn">Disease name <span class="text-danger">*</span></label>
                                                    <input id="dn" class="form-control" name="dn" [(ngModel)]="mortality.diseaseName" maxlength="100" required list="diseases" placeholder="e.g. WSSV, AHPND, EHP" />
                                                    <datalist id="diseases"><option value="WSSV"></option><option value="AHPND"></option><option value="EHP"></option><option value="IMNV"></option><option value="Vibriosis"></option></datalist>
                                                </div>
                                            }
                                            @if (mortality.cause === 7) {
                                                <div class="form-group">
                                                    <label for="oc">Describe the cause <span class="text-danger">*</span></label>
                                                    <input id="oc" class="form-control" name="oc" [(ngModel)]="mortality.otherCause" maxlength="500" required placeholder="e.g. predation by birds, molting stress" />
                                                </div>
                                            }
                                            @if (mortalityShare(); as share) {
                                                <p class="small text-muted">{{ share }}</p>
                                            }
                                            <details class="fpms-fold mb-0" [open]="mortality.cause === 1 || !!mortality.symptoms || !!mortality.responseAction">
                                                <summary>Symptoms and action taken <span class="fpms-fold-hint">{{ mortality.cause === 1 ? 'asked for with a disease' : 'optional' }}</span></summary>
                                                <div class="form-group">
                                                    <label for="sy">Observed symptoms</label>
                                                    <input id="sy" class="form-control" name="sy" [(ngModel)]="mortality.symptoms" maxlength="500" placeholder="e.g. red discoloration, soft shell, empty gut" />
                                                </div>
                                                <div class="form-group mb-0">
                                                    <label for="ra">Action taken</label>
                                                    <input id="ra" class="form-control" name="ra" [(ngModel)]="mortality.responseAction" maxlength="500" />
                                                </div>
                                            </details>
                                        </div>
                                    </div>
                                }

                                @if (form.logType === 10) {
                                    <div class="card">
                                        <div class="card-header"><h3 class="card-title">Pond activity</h3></div>
                                        <div class="card-body">
                                            <label class="d-block">What was done? <span class="text-danger">*</span></label>
                                            <div class="fpms-choice" role="radiogroup" aria-label="Pond activity">
                                                @for (o of pondActivities; track o.value) {
                                                    <button type="button" class="btn mr-1 mb-1" role="radio" [attr.aria-checked]="activity.activityType === o.value"
                                                        [class.btn-primary]="activity.activityType === o.value" [class.btn-outline-primary]="activity.activityType !== o.value"
                                                        [disabled]="readOnly" (click)="activity.activityType = o.value; keepDraft()">{{ o.label }}</button>
                                                }
                                            </div>
                                            <small class="form-text text-muted">For example the water exchange every two days. Add the amount or the reason in the notes.</small>
                                        </div>
                                    </div>
                                }

                                @if (form.logType) {
                                    <div class="card">
                                        <div class="card-body">
                                            <div class="form-group mb-0">
                                                <label for="notes">{{ form.logType === 9 ? 'Note' : 'Notes' }} @if (notesRequired) { <span class="text-danger">*</span> }</label>
                                                <textarea id="notes" rows="3" class="form-control" name="notes" [(ngModel)]="form.notes" maxlength="2000" [required]="notesRequired" [placeholder]="form.logType === 10 ? 'e.g. about 30% of the water changed' : ''"></textarea>
                                            </div>
                                        </div>
                                    </div>
                                }

                                @if (log && !isNew) {
                                    <p class="small text-muted">
                                        Recorded by {{ log.recordedBy }} on {{ log.creationTime | farmDateTime }}{{ log.lastModificationTime ? ', last edited ' + (log.lastModificationTime | farmDateTime) : '' }}.
                                        @for (u of log.usages; track $index) {
                                            <br />Stock used: {{ u.label }} {{ u.quantity | num: 3 }} {{ u.unit }}
                                        }
                                    </p>
                                }
                            </fieldset>
                            @if (!readOnly && form.logType) {
                                <div class="fpms-form-foot">
                                <button type="submit" class="btn btn-primary btn-lg mr-2" [disabled]="busy() || !f.form.valid || !canSubmit()">
                                    @if (busy()) {
                                        <i class="fas fa-spinner fa-spin mr-1"></i>
                                    }
                                    {{ isNew ? 'Save' : 'Save changes' }}
                                </button>
                                <fpms-form-hint [form]="f"></fpms-form-hint>
                                </div>
                            }
                        </form>
                        </div>
                            @if (pondDay; as t) {
                                <!-- The last few entries of this kind, beside the form on a wide screen and under it otherwise (DEC-106). -->
                                <aside class="fpms-entry-side" [attr.aria-label]="recentTitle()">
                                    @if (form.logType && t.recent.length) {
                                        <div class="card">
                                            <div class="card-header"><h3 class="card-title">{{ recentTitle() }}</h3></div>
                                            <div class="card-body">
                                                <ul class="fpms-side-list">
                                                    @for (r of t.recent; track $index) {
                                                        <li><span class="text-muted">{{ r.date | farmDate }}</span> {{ r.text }}</li>
                                                    }
                                                </ul>
                                            </div>
                                        </div>
                                    }
                                </aside>
                            }
                        </div>

                        @if (!isNew && log?.canVoid && !log?.isVoided) {
                            <div class="card card-outline card-danger mt-4">
                                <div class="card-header"><h3 class="card-title">Void this entry</h3></div>
                                <div class="card-body">
                                    <p class="small text-muted">Voiding hides the entry from records and indicators{{ log.usages?.length ? ' and returns its products to stock with reversing movements' : '' }}. It is kept in the audit history with your reason. You can then record it again correctly.</p>
                                    <div class="form-group">
                                        <label for="vr">Reason <span class="text-danger">*</span></label>
                                        <input id="vr" class="form-control" name="vr" [(ngModel)]="voidReason" maxlength="500" placeholder="e.g. entered on the wrong pond" />
                                    </div>
                                    <button type="button" class="btn btn-outline-danger" (click)="voidEntry()" [disabled]="busy() || !voidReason.trim()">Void entry</button>
                                </div>
                            </div>
                        }
                    }
                }
            </div>
        </section>
    `,
})
export class LogEntryComponent extends FpmsPage implements OnInit {
    /** Unsaved entries are kept as a browser draft, so leaving never needs to ask. */
    protected override keepsDrafts = true;
    loading = true;
    isNew = true;
    readOnly = false;
    historical = false;
    log: any = null;
    batch: any = null;
    openBatches: any[] = [];
    params: any[] = [];
    productLots: any[] = [];
    allowedTypes: { value: number; label: string }[] = [];
    result: any = null;
    restoredAt: string | null = null;
    voidReason = '';
    readonly nowInput = FarmTime.nowInput();

    form: any = {};
    readings: Record<string, number | null> = {};
    growth: any = {};
    chem: any = {};
    mortality: any = {};
    /** Pond activity (DEC-91): 5 water exchange, 6 aeration, 7 pond cleaning, 4 other. */
    activity: { activityType: number | null } = { activityType: null };
    readonly pondActivities = [5, 6, 7, 4].map((value) => ({ value, label: this.L.PondActivities[value] }));

    /** A note needs its text, and so does a pond activity of type Other. */
    get notesRequired(): boolean {
        return this.form.logType === 9 || (this.form.logType === 10 && this.activity.activityType === 4);
    }
    private usageKey = 0;

    /** Opened from a batch page (?batchId=…): only then does Record operations show a link back to it; from the Operations tabs it has none. */
    readonly cameFromBatch = !!this.query('batchId');

    /** Shown in the logging wizard, which has already fixed the pond (and usually the type). */
    readonly inWizard = !!this.embedded;

    get subtitle(): string {
        if (this.isNew) {
            return 'Water quality, growth sampling, chemicals, mortality and notes for one pond.';
        }
        return this.batch ? `Pond ${this.batch.pondCode} · ${this.batch.batchCode}` : 'Choose the pond';
    }


    ngOnInit(): void {
        FormDrafts.purgeExpired();
        // Detail routes reuse this component when only the :id changes, so reload on every change.
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        this.loading = true;
        const id = this.param('id');
        this.isNew = !id;
        this.result = null;
        this.restoredAt = null;
        this.log = null;
        this.historical = false;
        const [params, suppLots, chemLots] = await Promise.all([
            this.api.get<any[]>('Log', 'GetParameters'),
            this.api.get<any[]>('Inventory', 'GetLotOptions', { category: 2 }),
            this.api.get<any[]>('Inventory', 'GetLotOptions', { category: 3 }),
        ]);
        this.params = params.filter((p) => p.isActive);
        this.productLots = this.sortLots([...suppLots, ...chemLots]);
        this.resetDetails();

        if (this.isNew) {
            await this.initNew();
        } else {
            await this.loadExisting(id);
        }
        this.loading = false;
    }

    private async initNew(): Promise<void> {
        const batches = await this.api.get<any[]>('Batch', 'GetAll', { openOnly: true });
        this.openBatches = batches.sort((x, y) => String(x.pondCode).localeCompare(String(y.pondCode), undefined, { numeric: true }));

        const draft = this.query('batchId') ? null : FormDrafts.load<any>(DRAFT);
        const remembered = OpsMemory.get();
        const batchId = this.query('batchId') ?? draft?.data.form.batchId ?? remembered.batchId ?? null;
        const fromBatch = this.openBatches.find((b) => b.id === batchId);
        const type = Number(this.query('logType')) || null;
        const day = this.query('date');
        // A calendar square for an earlier day logs on that day, at the current time of day.
        const observedAt = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day < this.today ? `${day}T${FarmTime.nowInput().substring(11)}` : FarmTime.nowInput();
        this.form = { batchId: fromBatch?.id ?? null, logType: type, observedAt, notes: '', clientRequestId: newGuid() };
        if (!this.form.batchId) {
            this.form.batchId = this.openBatches[0]?.id ?? null;
        }
        await this.onBatch(type);

        if (draft && draft.data.form.batchId === this.form.batchId) {
            this.applyDraft(draft.data);
            this.restoredAt = new Date(draft.savedAt).toISOString();
        }
    }

    private readonly baseDosageUnits = ['ppm', 'mg/L', 'g/m³', 'kg/ha', 'g/kg feed', 'mL/m³', 'L/ha'];

    /** Standard units, plus any older free-text value so editing an existing record does not lose it. */
    dosageUnitOptions(): string[] {
        const cur = this.chem?.dosageUnit;
        return cur && !this.baseDosageUnits.includes(cur) ? [...this.baseDosageUnits, cur] : this.baseDosageUnits;
    }

    private resetDetails(): void {
        this.readings = {};
        this.params.forEach((p) => (this.readings[p.code] = null));
        this.growth = { abwG: null, sampleCount: null, totalSampleWeightG: null, estimatedSurvivalPct: null };
        this.chem = { reason: '', usages: [this.newUsage()], dosage: null, dosageUnit: '', method: '', endDate: '', withdrawalDays: null, prescriptionRef: '' };
        this.prefillWithdrawal();
        this.mortality = { count: null, cause: null, diseaseName: '', otherCause: '', symptoms: '', responseAction: '' };
    }

    /** DEC-68: lots with stock first, earliest expiry first, so the first option is the one to use up. */
    private sortLots(lots: any[]): any[] {
        return [...lots].sort((a, b) => (a.quantityOnHand > 0 ? 0 : 1) - (b.quantityOnHand > 0 ? 0 : 1) || String(a.expiryDate ?? '9999').localeCompare(String(b.expiryDate ?? '9999')));
    }

    private newUsage(lotId?: string, quantity?: number | null): any {
        return { key: ++this.usageKey, lotId: lotId ?? this.productLots[0]?.lotId ?? '', quantity: quantity ?? null };
    }

    /** DEC-57: withdrawal days default to the longest default of the chosen products, unless already entered. */
    prefillWithdrawal(): void {
        if (this.chem.withdrawalDays != null && this.chem.withdrawalDays !== '') {
            return;
        }
        const days = (this.chem.usages ?? [])
            .map((u: any) => this.productLots.find((o) => o.lotId === u.lotId)?.defaultWithdrawalDays)
            .filter((d: any) => d != null);
        if (days.length) {
            this.chem.withdrawalDays = Math.max(...days);
        }
    }

    chemHasTreatment(): boolean {
        const c = this.chem ?? {};
        return c.dosage != null || !!c.method || !!c.endDate || (c.withdrawalDays != null && c.withdrawalDays !== '') || !!c.prescriptionRef;
    }

    observedDate(): string {
        return this.form?.observedAt ? String(this.form.observedAt).substring(0, 10) : '';
    }

    safeHarvestDate(): string | null {
        const days = Number(this.chem?.withdrawalDays);
        if (!days || days <= 0) {
            return null;
        }
        const base = this.chem.endDate || this.observedDate();
        return base ? FarmTime.addDays(base, days) : null;
    }

    addUsage(): void {
        this.chem.usages.push(this.newUsage());
        this.keepDraft();
    }

    removeUsage(u: any): void {
        this.chem.usages = this.chem.usages.filter((x: any) => x !== u);
        this.keepDraft();
    }

    async onBatch(preferredType?: number | null): Promise<void> {
        if (!this.form.batchId) {
            this.batch = null;
            this.allowedTypes = [];
            return;
        }
        this.batch = await this.api.get<any>('Batch', 'Get', { id: this.form.batchId });
        if (this.isNew) {
            OpsMemory.set({ cycleId: this.batch.cycleId, batchId: this.batch.id });
        }
        const allowed = (this.batch.allowedLogTypes as string[]).map((n) => this.L.LogTypeNames[n]);
        this.allowedTypes = this.Options.newLogType.filter((o) => allowed.includes(o.value));
        const wanted = preferredType ?? this.form.logType;
        this.form.logType = this.allowedTypes.some((t) => t.value === wanted) ? wanted : null;
        this.keepDraft();
        void this.loadPanel();
    }

    pickType(type: number): void {
        this.form.logType = type;
        this.keepDraft();
        void this.loadPanel();
    }

    private async loadExisting(id: string): Promise<void> {
        const l = await this.api.get<any>('Log', 'Get', { id });
        this.log = l;
        this.batch = await this.api.get<any>('Batch', 'Get', { id: l.batchId });
        this.historical = [1, 3, 8].includes(l.logType);
        this.readOnly = !l.canEdit || this.batch.isReadOnly || this.historical || !!l.isVoided;
        this.voidReason = '';
        this.form = {
            id: l.id,
            batchId: l.batchId,
            logType: this.historical ? null : l.logType,
            observedAt: FarmTime.toLocalInput(l.observedAtUtc),
            notes: l.notes ?? '',
            clientRequestId: l.clientRequestId,
        };
        (l.measurements ?? []).forEach((m: any) => (this.readings[m.parameterCode] = m.value));
        if (l.growth) {
            this.growth = { ...l.growth };
        }
        if (l.chemicalApplication) {
            this.chem = {
                reason: l.chemicalApplication.reason ?? '',
                dosage: l.chemicalApplication.dosage ?? null,
                dosageUnit: l.chemicalApplication.dosageUnit ?? '',
                method: l.chemicalApplication.method ?? '',
                endDate: l.chemicalApplication.endDate ?? '',
                withdrawalDays: l.chemicalApplication.withdrawalDays ?? null,
                prescriptionRef: l.chemicalApplication.prescriptionRef ?? '',
                usages: (l.chemicalApplication.usages ?? []).map((u: any) => this.newUsage(u.lotId, u.quantity)),
            };
            // A lot that is used up or inactive is no longer offered; keep it selectable for this entry.
            for (const u of l.usages ?? []) {
                if (!this.productLots.some((o) => o.lotId === u.lotId)) {
                    this.productLots = [...this.productLots, { lotId: u.lotId, label: u.label, unit: u.unit, quantityOnHand: 0 }];
                }
            }
        }
        if (l.mortality) {
            this.mortality = { ...l.mortality, diseaseName: l.mortality.diseaseName ?? '', otherCause: l.mortality.otherCause ?? '' };
        }
        if (l.pondActivity) {
            this.activity = { activityType: l.pondActivity.activityType };
        }
    }

    summary(l: any): string {
        return logSummary(l);
    }

    wq(p: any): 'empty' | 'ok' | 'out' | 'invalid' {
        return optimalState(p, this.readings[p.code]);
    }

    /** The recommendation for an out-of-range reading (Low or High text set by the System Administrator). */
    advice(p: any): string | null {
        const v = Number(this.readings[p.code]);
        if (p.optimalMin != null && (p.optimalMinExclusive ? v <= p.optimalMin : v < p.optimalMin)) {
            return p.lowRecommendation || null;
        }
        if (p.optimalMax != null && (p.optimalMaxExclusive ? v >= p.optimalMax : v > p.optimalMax)) {
            return p.highRecommendation || null;
        }
        return null;
    }

    /** True once either sample number is typed: the ABW then comes from the sample (DEC-97). */
    hasSample(): boolean {
        const filled = (v: any) => v != null && v !== '';
        return filled(this.growth.sampleCount) || filled(this.growth.totalSampleWeightG);
    }

    sampleAbw(): number | null {
        const n = Number(this.growth.sampleCount);
        const w = Number(this.growth.totalSampleWeightG);
        return n > 0 && w > 0 ? w / n : null;
    }

    /** The ABW that will be saved: from the sample when there is one, else as typed. */
    finalAbw(): number | null {
        if (this.hasSample()) {
            return this.sampleAbw();
        }
        const v = Number(this.growth.abwG);
        return this.growth.abwG != null && this.growth.abwG !== '' && v > 0 ? v : null;
    }

    /** "+0.7 g since Thu 12 Nov (7.4 g), 0.18 g a day": compared with the pond's last sample, from the side panel's data. */
    abwChange(): string | null {
        const last = this.pondDay?.lastSample;
        const abw = this.finalAbw();
        if (!last || abw == null || !this.isNew) {
            return null;
        }
        const diff = abw - last.abwG;
        const days = Math.round((Date.parse(this.observedDate() || this.today) - Date.parse(last.date)) / 86400000);
        const sign = diff >= 0 ? '+' : '−';
        const perDay = days > 0 ? `, ${(diff / days).toFixed(2)} g a day over ${days} day${days === 1 ? '' : 's'}` : '';
        return `${sign}${Math.abs(diff).toFixed(1)} g since ${this.shortDay(last.date)} (${Number(last.abwG).toFixed(1)} g)${perDay}`;
    }

    /** The farm's strict readings first (DO and salinity, partner farm, DEC-94); the rest fold under Other readings. */
    private readonly mainCodes = ['DO', 'SAL'];

    mainParams(): any[] {
        const main = this.params.filter((p) => this.mainCodes.includes(String(p.code).toUpperCase()));
        return main.length ? main : this.params;
    }

    otherParams(): any[] {
        const main = this.mainParams();
        return this.params.filter((p) => !main.includes(p));
    }

    otherEntered(): boolean {
        return this.otherParams().some((p) => this.wq(p) !== 'empty');
    }

    otherNames(): string {
        return this.otherParams().map((p) => p.name).join(', ');
    }

    /** "About 0.01% of the estimated population (318,500)." */
    mortalityShare(): string | null {
        const pop = Number(this.batch?.indicators?.estimatedPopulation);
        const n = Number(this.mortality.count);
        if (!pop || !n || n < 0) {
            return null;
        }
        const pct = (n / pop) * 100;
        return `About ${pct < 0.01 ? 'less than 0.01' : pct.toFixed(2)}% of the estimated population (${Math.round(pop).toLocaleString('en-US')}).`;
    }

    private shortDay(iso: string): string {
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    // ---- This pond today (DEC-96): what is already in for the pond on the entry's day, and the last few of this kind.

    pondDay: {
        day: string;
        fed: number;
        feedings: number;
        water: boolean;
        dead: number | null;
        lastSample: { date: string; abwG: number } | null;
        recent: { date: string; text: string }[];
    } | null = null;

    async loadPanel(): Promise<void> {
        if (this.inWizard || !this.batch || !this.isNew) {
            this.pondDay = null;
            return;
        }
        const batchId = this.batch.id;
        const day = this.observedDate() || this.today;
        const type = this.form.logType;
        const safe = <T>(p: Promise<T>) => p.catch(() => null);
        const [sheet, logs, samples, recent] = await Promise.all([
            safe(this.api.get<any>('Feeding', 'GetSheet', { feedDate: day, batchId })),
            safe(this.api.get<any>('Log', 'GetList', { batchId, from: day, to: day, maxResultCount: 50 })),
            safe(this.api.get<any>('Log', 'GetList', { batchId, logType: 5, maxResultCount: 1 })),
            type ? safe(this.api.get<any>('Log', 'GetList', { batchId, logType: type, maxResultCount: 3 })) : Promise.resolve(null),
        ]);
        if (this.batch?.id !== batchId) {
            return;
        }
        const row = sheet?.rows?.[0];
        const dayLogs = ((logs?.items as any[]) ?? []).filter((l) => !l.isVoided);
        const deadLogs = dayLogs.filter((l) => l.logType === 7);
        const last = (samples?.items as any[])?.[0];
        this.pondDay = {
            day,
            fed: ((row?.sessions as any[]) ?? []).filter((x) => !!x).length,
            feedings: Math.max(sheet?.feedingTimes?.length ?? 0, row?.sessions?.length ?? 0),
            water: dayLogs.some((l) => l.logType === 4),
            dead: deadLogs.length ? deadLogs.reduce((n, l) => n + (l.mortality?.count ?? 0), 0) : null,
            lastSample: last?.abwG != null ? { date: FarmTime.isoDateOf(last.observedAtUtc), abwG: Number(last.abwG) } : null,
            recent: ((recent?.items as any[]) ?? [])
                .filter((l) => !l.isVoided)
                .map((l) => ({ date: FarmTime.isoDateOf(l.observedAtUtc), text: this.summary(l) || this.L.LogTypes[l.logType] })),
        };
    }

    /** The same icons as the logging wizard's tiles: the words carry the meaning, the icon helps scanning. */
    typeIcon(type: number): string {
        return ({ 4: 'fa-tint', 5: 'fa-ruler-horizontal', 6: 'fa-flask', 7: 'fa-heart-broken', 9: 'fa-sticky-note', 10: 'fa-water' } as Record<number, string>)[type] ?? 'fa-pen';
    }

    recentTitle(): string {
        switch (this.form.logType) {
            case 4:
                return 'Recent water quality';
            case 5:
                return 'Recent samples';
            case 6:
                return 'Last applications';
            case 7:
                return 'Recent losses';
            case 10:
                return 'Recent pond activity';
            default:
                return 'Recent notes';
        }
    }

    private lot(lotId: string): any {
        return this.productLots.find((o) => o.lotId === lotId);
    }

    lotUnit(lotId: string): string {
        return this.lot(lotId)?.unit ?? '';
    }

    lotShort(lotId: string, qty: number | null): boolean {
        const lot = this.lot(lotId);
        return this.isNew && !!lot && !!qty && Number(qty) > lot.quantityOnHand;
    }

    lotExpired(lotId: string): boolean {
        const expiry = this.lot(lotId)?.expiryDate;
        return !!expiry && expiry < FarmTime.today();
    }

    canSubmit(): boolean {
        switch (this.form.logType) {
            case 2:
            case 4: {
                const entered = this.params.filter((p) => this.wq(p) !== 'empty');
                return entered.length > 0 && !entered.some((p) => this.wq(p) === 'invalid');
            }
            case 5: {
                const abw = this.finalAbw() ?? 0;
                return abw > 0 && abw <= 60 && (!this.hasSample() || this.sampleAbw() != null);
            }
            case 6:
                return this.chem.usages.length > 0 && this.chem.usages.every((u: any) => u.lotId && Number(u.quantity) > 0);
            case 7:
                return !!this.mortality.cause && Number(this.mortality.count) >= 0;
            case 10:
                return !!this.activity.activityType && (!this.notesRequired || !!this.form.notes?.trim());
            default:
                return !!this.form.logType;
        }
    }

    private buildBody(): any {
        const body: any = {
            id: this.form.id ?? null,
            batchId: this.form.batchId,
            logType: this.form.logType,
            observedAt: FarmTime.fromLocalInput(this.form.observedAt),
            notes: this.form.notes,
            clientRequestId: this.form.clientRequestId,
        };
        switch (this.form.logType) {
            case 2:
            case 4:
                body.readings = this.params.filter((p) => this.wq(p) !== 'empty').map((p) => ({ parameterCode: p.code, value: Number(this.readings[p.code]) }));
                break;
            case 5:
                body.growth = {
                    abwG: this.hasSample() ? null : Number(this.growth.abwG),
                    sampleCount: this.hasSample() ? Number(this.growth.sampleCount) : null,
                    totalSampleWeightG: this.hasSample() ? Number(this.growth.totalSampleWeightG) : null,
                    estimatedSurvivalPct: this.growth.estimatedSurvivalPct === '' || this.growth.estimatedSurvivalPct == null ? null : Number(this.growth.estimatedSurvivalPct),
                };
                break;
            case 6:
                body.chemicalApplication = {
                    reason: this.chem.reason,
                    dosage: this.chem.dosage === '' || this.chem.dosage == null ? null : Number(this.chem.dosage),
                    dosageUnit: this.chem.dosageUnit,
                    method: this.chem.method,
                    endDate: this.chem.endDate || null,
                    withdrawalDays: this.chem.withdrawalDays === '' || this.chem.withdrawalDays == null ? null : Number(this.chem.withdrawalDays),
                    prescriptionRef: this.chem.prescriptionRef,
                    usages: this.chem.usages.map((u: any) => ({ lotId: u.lotId, quantity: Number(u.quantity) })),
                };
                break;
            case 7:
                body.mortality = {
                    count: Number(this.mortality.count),
                    cause: this.mortality.cause,
                    diseaseName: this.mortality.cause === 1 ? this.mortality.diseaseName : null,
                    otherCause: this.mortality.cause === 7 ? this.mortality.otherCause : null,
                    symptoms: this.mortality.symptoms,
                    responseAction: this.mortality.responseAction,
                };
                break;
            case 10:
                body.pondActivity = { activityType: this.activity.activityType };
                break;
        }
        return body;
    }

    async save(): Promise<void> {
        const body = this.buildBody();
        let res: any;
        const ok = await this.act(async () => (res = this.isNew ? await this.api.post<any>('Log', 'Create', body) : await this.api.put<any>('Log', 'Update', body)));
        if (!ok) {
            return;
        }
        this.result = res;
        void this.loadPanel();
        if (this.isNew) {
            FormDrafts.clear(DRAFT);
            this.restoredAt = null;
            window.scrollTo({ top: 0 });
        } else {
            this.log = res.log;
            this.notifySaved('Log entry updated.');
        }
    }

    async voidEntry(): Promise<void> {
        if (!(await this.confirm(`Void this ${this.L.LogTypes[this.log.logType]} entry? Reason: "${this.voidReason.trim()}".`, 'Void entry?'))) {
            return;
        }
        if (await this.act(() => this.api.post('Log', 'Void', { id: this.log.id, reason: this.voidReason.trim() }))) {
            this.notifySaved('Entry voided.');
            this.router.navigate(['/app/production/batches', this.log.batchId], { replaceUrl: true });
        }
    }

    // ---------------------------------------------------------------- drafts (AC-25)

    keepDraft(): void {
        if (!this.isNew || this.result || !this.form.batchId) {
            return;
        }
        FormDrafts.save(DRAFT, {
            form: this.form,
            readings: this.readings,
            growth: this.growth,
            chem: { reason: this.chem.reason, usages: this.chem.usages.map((u: any) => ({ lotId: u.lotId, quantity: u.quantity })) },
            mortality: this.mortality,
            activity: this.activity,
        });
    }

    private applyDraft(d: any): void {
        this.form = { ...this.form, ...d.form };
        this.readings = { ...this.readings, ...(d.readings ?? {}) };
        this.growth = { ...this.growth, ...(d.growth ?? {}) };
        this.mortality = { ...this.mortality, ...(d.mortality ?? {}) };
        this.activity = { activityType: d.activity?.activityType ?? null };
        const usages = (d.chem?.usages ?? []).filter((u: any) => this.productLots.some((o) => o.lotId === u.lotId));
        this.chem = { reason: d.chem?.reason ?? '', usages: usages.length ? usages.map((u: any) => this.newUsage(u.lotId, u.quantity)) : [this.newUsage()] };
        if (!this.allowedTypes.some((t) => t.value === this.form.logType)) {
            this.form.logType = null;
        }
    }

    discardDraft(): void {
        FormDrafts.clear(DRAFT);
        this.restoredAt = null;
        this.resetDetails();
        this.form = { ...this.form, logType: null, observedAt: FarmTime.nowInput(), notes: '', clientRequestId: newGuid() };
    }

    /** Starts a fresh entry for the same pond (new ClientRequestId so it is a separate record). */
    async another(sameType: boolean): Promise<void> {
        const type = sameType ? this.form.logType : null;
        this.result = null;
        const [suppLots, chemLots] = await Promise.all([
            this.api.get<any[]>('Inventory', 'GetLotOptions', { category: 2 }),
            this.api.get<any[]>('Inventory', 'GetLotOptions', { category: 3 }),
        ]);
        this.productLots = this.sortLots([...suppLots, ...chemLots]);
        this.resetDetails();
        this.form = { ...this.form, observedAt: FarmTime.nowInput(), notes: '', clientRequestId: newGuid(), logType: type };
        await this.onBatch(type);
    }
}
