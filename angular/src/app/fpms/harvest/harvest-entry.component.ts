import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { FormDrafts } from '@shared/fpms/drafts';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * Harvest entry and detail (Ref 7.1, AC-14, step E): Partial or Total, grade lines on the farm's size grades, optional
 * final count and dead-at-harvest count, not-sold entries (DEC-67) and optional quality checks. Optional crate tally and
 * ABW sample (DEC-80): with crates, the total kg and boxes come from them. The Total harvest marks the batch Harvested. A new harvest keeps a browser draft until it is saved (AC-25).
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [narrow]="true" [title]="isNew ? 'Record harvest' : 'Harvest' + (batch ? ' · ' + batch.pondCode + ' ' + (batch.letter ? 'Batch ' + batch.letter : batch.batchCode) : '')" [subtitle]="isNew ? (batch ? batch.pondCode + ' · ' + (batch.letter ? 'Batch ' + batch.letter : batch.batchCode) : '') : (h ? (h.harvestType | label: L.HarvestTypes) + ' harvest on ' + (h.harvestedAtUtc | farmDate) + '. Edit it here until the batch is closed.' : '')" backLink="/app/harvests" backLabel="Harvests">
            @if (!isNew && h && can('Farm.Sales') && sellableKg() > 0) {
                <a class="btn btn-outline-primary" routerLink="/app/sales/new"><i class="fas fa-cash-register mr-1"></i>Record sale</a>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid fpms-narrow">
                @if (loading) {
                    <fpms-loading></fpms-loading>
                } @else if (isNew && !batches.length) {
                    <div class="card"><div class="card-body"><fpms-empty text="No batch can take a harvest. Harvests are recorded for Stocked batches, or Failed batches as a salvage harvest." icon="fas fa-shrimp"></fpms-empty></div></div>
                } @else {
                    @if (readOnly) {
                        <div class="alert alert-secondary small"><i class="fas fa-lock mr-1"></i>{{ batch?.isReadOnly ? 'The batch is Closed; this harvest is read-only.' : 'You can only edit harvests you recorded.' }}</div>
                    }
                    @if (restoredAt) {
                        <div class="alert alert-info d-flex align-items-center" role="status">
                            <i class="fas fa-history mr-2"></i>
                            <span class="mr-auto">Your unsaved harvest from {{ restoredAt | farmDateTime }} was restored.</span>
                            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="discardDraft()">Discard it</button>
                        </div>
                    }
                    @if (batch?.earliestSafeHarvestDate && isNew) {
                        <div class="alert alert-warning small"><i class="fas fa-prescription-bottle-alt mr-1"></i>Earliest safe harvest date from treatment withdrawal periods: <strong>{{ batch.earliestSafeHarvestDate | farmDate }}</strong>.</div>
                    }
                    <form #f="ngForm" (ngSubmit)="save()" novalidate>
                        <fieldset [disabled]="readOnly">
                            <div class="card">
                                <div class="card-body">
                                    <div class="form-row">
                                        <div class="form-group col-md-6">
                                            <label for="b">Batch <span class="text-danger">*</span></label>
                                            <select id="b" class="form-control" name="batchId" [(ngModel)]="m.batchId" (ngModelChange)="onBatch()" required [disabled]="!isNew">
                                                @for (x of batches; track x.id) {
                                                    <option [value]="x.id">{{ x.pondCode }} · {{ x.batchCode }} ({{ x.status | label: L.BatchStatuses }})</option>
                                                }
                                            </select>
                                        </div>
                                        <div class="form-group col-md-6">
                                            <label class="d-block">Harvest type <span class="text-danger">*</span></label>
                                            @for (o of Options.harvestType; track o.value) {
                                                <div class="custom-control custom-radio custom-control-inline">
                                                    <input type="radio" class="custom-control-input" [id]="'ht' + o.value" name="harvestType" [value]="o.value" [(ngModel)]="m.harvestType" (ngModelChange)="keepDraft()" />
                                                    <label class="custom-control-label" [for]="'ht' + o.value">{{ o.label }}</label>
                                                </div>
                                            }
                                            <small class="form-text text-muted">
                                                {{ m.harvestType === 2 ? (batch?.status === 4 ? 'Salvage of a Failed batch; the batch stays Failed.' : 'The last harvest: the batch becomes Harvested. No harvest or log can be dated after it.') : 'Some shrimp stay in the pond.' }}
                                            </small>
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group col-md-6">
                                            <label for="at">Harvest date and time <span class="text-danger">*</span></label>
                                            <input id="at" type="datetime-local" class="form-control" name="harvestedAt" [(ngModel)]="m.harvestedAt" (ngModelChange)="keepDraft()" required [max]="nowInput" />
                                        </div>
                                        <div class="form-group col-md-3">
                                            <label for="kg">Total kg (farm weight) <span class="text-danger">*</span></label>
                                            <input id="kg" type="number" min="0.001" step="0.001" class="form-control" name="totalKg" [(ngModel)]="m.totalKg" (ngModelChange)="keepDraft()" required [readonly]="hasCrates()" />
                                            @if (hasCrates()) { <small class="form-text text-muted">Sum of the crate tally.</small> }
                                        </div>
                                        <div class="form-group col-md-3">
                                            <label for="bx">Boxes / crates</label>
                                            <input id="bx" type="number" min="0" step="1" class="form-control" name="boxes" [(ngModel)]="m.boxes" (ngModelChange)="keepDraft()" [readonly]="hasCrates()" />
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group col-md-4">
                                            <label for="sw">ABW sample weight (g)</label>
                                            <input id="sw" type="number" min="0.01" step="0.01" class="form-control" name="abwSampleWeightG" [(ngModel)]="m.abwSampleWeightG" (ngModelChange)="onSample()" placeholder="optional, e.g. 5002" />
                                        </div>
                                        <div class="form-group col-md-4">
                                            <label for="sp">Pieces in the sample</label>
                                            <input id="sp" type="number" min="1" step="1" class="form-control" name="abwSamplePieces" [(ngModel)]="m.abwSamplePieces" (ngModelChange)="onSample()" placeholder="optional, e.g. 414" />
                                            @if (sampleHalf()) { <small class="form-text text-danger">Enter both the weight and the pieces, or neither.</small> }
                                        </div>
                                        <div class="form-group col-md-4">
                                            <label for="abw">Sampled ABW (g)</label>
                                            <input id="abw" type="number" min="0.01" max="60" step="0.01" class="form-control" name="abwG" [(ngModel)]="m.abwG" (ngModelChange)="keepDraft()" [readonly]="sampleComplete()" />
                                            @if (sampleComplete()) {
                                                <small class="form-text text-muted">{{ m.abwSampleWeightG | num: 2 }} g ÷ {{ m.abwSamplePieces | num: 0 }} pcs</small>
                                            } @else if (m.abwG > 0) {
                                                <small class="form-text text-muted">≈ {{ 1000 / m.abwG | num: 0 }} pcs/kg; used for ungraded kg</small>
                                            }
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group col-md-4">
                                            <label for="fc">Final count (pieces)</label>
                                            <input id="fc" type="number" min="0" step="1" class="form-control" name="finalCount" [(ngModel)]="m.finalCount" (ngModelChange)="keepDraft()" placeholder="optional" />
                                            <small class="form-text text-muted">When counted, replaces the estimate.</small>
                                        </div>
                                        <div class="form-group col-md-4">
                                            <label for="dh">Dead at harvest</label>
                                            <input id="dh" type="number" min="0" step="1" class="form-control" name="deadAtHarvest" [(ngModel)]="m.deadAtHarvest" (ngModelChange)="keepDraft()" placeholder="optional" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="card">
                                <div class="card-header">
                                    <a href="javascript:;" class="card-title text-reset" role="button" (click)="showCrates = !showCrates" [attr.aria-expanded]="showCrates">
                                        <i class="fas mr-1" [class.fa-chevron-right]="!showCrates" [class.fa-chevron-down]="showCrates" aria-hidden="true"></i>Crate tally (optional)
                                        @if (hasCrates()) { <span class="badge badge-secondary ml-1">{{ m.crates.length }} · {{ m.totalKg | num: 3 }} kg</span> }
                                    </a>
                                </div>
                                @if (showCrates) {
                                    <div class="card-body">
                                        <p class="small text-muted">Weigh crate by crate, as on the harvest tally sheet. The total kg and boxes then come from the crates. Leave empty to enter only the total. A crate with no type is just "Crate"; a crate type with an empty weight is weighed with the crate, and the crate's weight is subtracted.</p>
                                        <div class="form-row">
                                            @for (c of m.crates; track $index) {
                                                <div class="form-group col-6 col-md-3 col-xl-2 mb-2">
                                                    <label class="small mb-0 text-truncate d-block" [for]="'cr' + $index">Crate {{ $index + 1 }}{{ c.containerName ? ' · ' + c.containerName : '' }}</label>
                                                    <div class="input-group input-group-sm">
                                                        <input [id]="'cr' + $index" type="number" min="0.001" step="0.001" class="form-control" [name]="'cr' + $index" [(ngModel)]="c.kg" (ngModelChange)="syncCrates()" required aria-label="Crate kg" />
                                                        <div class="input-group-append">
                                                            <button type="button" class="btn btn-outline-danger" (click)="removeCrate($index)" [attr.aria-label]="'Remove crate ' + ($index + 1)"><i class="fas fa-times"></i></button>
                                                        </div>
                                                    </div>
                                                    @if (c.tareKg > 0) {
                                                        <small [class.text-danger]="netOf(c) <= 0" [class.text-muted]="netOf(c) > 0">− {{ c.tareKg | num: 3 }} = {{ netOf(c) | num: 3 }} kg</small>
                                                    }
                                                </div>
                                            }
                                        </div>
                                        <div class="form-row align-items-end">
                                            <div class="form-group col-auto mb-2">
                                                <button type="button" class="btn btn-sm btn-outline-secondary" (click)="addOneCrate()" [disabled]="m.crates.length >= maxCrates"><i class="fas fa-plus mr-1"></i>Add crate</button>
                                            </div>
                                            <div class="form-group col-auto mb-2">
                                                <label class="small mb-0" for="bulkN">Add</label>
                                                <input id="bulkN" type="number" min="1" max="200" step="1" class="form-control form-control-sm" style="width: 5rem" name="bulkN" [(ngModel)]="bulk.count" [ngModelOptions]="{ standalone: true }" />
                                            </div>
                                            <div class="form-group col-auto mb-2">
                                                <label class="small mb-0" for="bulkC">×</label>
                                                <select id="bulkC" class="custom-select custom-select-sm" style="min-width: 9rem" name="bulkC" [(ngModel)]="bulk.containerTypeId" (ngModelChange)="onBulkContainer()" [ngModelOptions]="{ standalone: true }">
                                                    <option value="">Crate</option>
                                                    @for (t of containers; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
                                                </select>
                                            </div>
                                            <div class="form-group col-auto mb-2">
                                                <label class="small mb-0" for="bulkKg">{{ bulkTare() > 0 ? 'scale kg each (with the crate)' : 'kg each' }}</label>
                                                <input id="bulkKg" type="number" min="0.001" step="0.001" class="form-control form-control-sm" style="width: 6rem" name="bulkKg" [(ngModel)]="bulk.kg" [ngModelOptions]="{ standalone: true }" />
                                            </div>
                                            <div class="form-group col-auto mb-2">
                                                <button type="button" class="btn btn-sm btn-outline-secondary" (click)="addBulk()" [disabled]="!(bulk.count > 0) || !(bulk.kg > 0) || m.crates.length + bulk.count > maxCrates">Add</button>
                                            </div>
                                            @if (canManageContainers) {
                                                <div class="form-group col-auto mb-2 ml-auto small"><a routerLink="/app/harvests/crate-types">Crate types</a></div>
                                            }
                                        </div>
                                        @if (hasCrates()) {
                                            <p class="mb-0"><strong>{{ m.crates.length }}</strong> crate(s), <strong>{{ crateKg() | num: 3 }} kg</strong> of shrimp{{ crateTare() > 0 ? ' (' + (crateTare() | num: 3) + ' kg of crate weight subtracted)' : '' }}</p>
                                        }
                                    </div>
                                }
                            </div>
                            <div class="card">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-ruler-horizontal" aria-hidden="true"></i>Size grading</h3></div>
                                <div class="card-body p-0">
                                    <div class="table-responsive">
                                    <table class="table table-sm mb-0">
                                        <thead><tr><th>Size grade</th><th style="width: 9rem">Kg</th>@if (!isNew) {<th class="text-right">Sold</th>}<th><span class="sr-only">Actions</span></th></tr></thead>
                                        <tbody>
                                            @for (g of m.gradeLines; track $index) {
                                                <tr>
                                                    <td>
                                                        <select class="form-control form-control-sm" [name]="'gs' + $index" [(ngModel)]="g.sizeGradeId" (ngModelChange)="keepDraft()" required aria-label="Size grade" [disabled]="g.soldKg > 0">
                                                            @for (o of grades; track o.id) {
                                                                <option [value]="o.id" [disabled]="usedGrade(o.id, g)">{{ o.label }}{{ o.isUngraded ? ' (pieces from ABW)' : '' }}</option>
                                                            }
                                                        </select>
                                                    </td>
                                                    <td><input type="number" [min]="g.soldKg || 0.001" step="0.001" class="form-control form-control-sm" [name]="'gk' + $index" [(ngModel)]="g.kg" (ngModelChange)="keepDraft()" required aria-label="Kg" /></td>
                                                    @if (!isNew) { <td class="text-right small">{{ g.soldKg | num: 3 }}</td> }
                                                    <td class="text-right">
                                                        @if (!(g.soldKg > 0)) {
                                                            <button type="button" class="btn btn-sm btn-outline-danger" (click)="m.gradeLines.splice($index, 1); keepDraft()" aria-label="Remove"><i class="fas fa-times"></i></button>
                                                        }
                                                    </td>
                                                </tr>
                                            }
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td><button type="button" class="btn btn-sm btn-outline-secondary" (click)="addGrade()" [disabled]="m.gradeLines.length >= grades.length"><i class="fas fa-plus mr-1"></i>Add grade</button></td>
                                                <td [class.text-danger]="gradeOver()" colspan="3"><strong>{{ gradeKg() | num: 3 }}</strong> of {{ m.totalKg || 0 | num: 3 }} kg graded</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                    </div>
                                    @if (gradeOver()) {
                                        <p class="text-danger small px-3 mb-2">Graded kilograms cannot exceed the harvest total.</p>
                                    } @else if (m.totalKg > 0 && gradeKg() > 0 && gradeKg() < m.totalKg) {
                                        <p class="text-warning-dark small px-3 mb-2">{{ m.totalKg - gradeKg() | num: 3 }} kg is not graded. Only graded kg can be sold; add it as "Ungraded / mixed" to sell it.</p>
                                    }
                                </div>
                            </div>
                            <div class="card">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-box-open" aria-hidden="true"></i>Not sold (optional)</h3></div>
                                <div class="card-body">
                                    <p class="small text-muted">Harvest kept for staff or home use, given away, or spoiled, so every kilogram is accounted for.</p>
                                    @for (d of m.disposals; track $index) {
                                        <div class="form-row align-items-end">
                                            <div class="form-group col-4">
                                                <label class="small" [for]="'dk' + $index">Kg</label>
                                                <input [id]="'dk' + $index" type="number" min="0.001" step="0.001" class="form-control form-control-sm" [name]="'dk' + $index" [(ngModel)]="d.kg" (ngModelChange)="keepDraft()" required />
                                            </div>
                                            <div class="form-group col-4">
                                                <label class="small" [for]="'dr' + $index">Reason</label>
                                                <select [id]="'dr' + $index" class="form-control form-control-sm" [name]="'dr' + $index" [(ngModel)]="d.reason" (ngModelChange)="keepDraft()">
                                                    @for (o of Options.disposalReason; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
                                                </select>
                                            </div>
                                            <div class="form-group col-3">
                                                <label class="small" [for]="'dn' + $index">Note</label>
                                                <input [id]="'dn' + $index" class="form-control form-control-sm" [name]="'dn' + $index" [(ngModel)]="d.note" (ngModelChange)="keepDraft()" maxlength="300" />
                                            </div>
                                            <div class="form-group col-1">
                                                <button type="button" class="btn btn-sm btn-link text-danger px-0" (click)="m.disposals.splice($index, 1); keepDraft()" aria-label="Remove"><i class="fas fa-times"></i></button>
                                            </div>
                                        </div>
                                    }
                                    <button type="button" class="btn btn-sm btn-outline-secondary" (click)="m.disposals.push({ kg: null, reason: 1, note: '' }); keepDraft()"><i class="fas fa-plus mr-1"></i>Add not-sold entry</button>
                                </div>
                            </div>
                            <div class="card">
                                <div class="card-header">
                                    <a href="javascript:;" class="card-title text-reset" role="button" (click)="showQuality = !showQuality" [attr.aria-expanded]="showQuality">
                                        <i class="fas mr-1" [class.fa-chevron-right]="!showQuality" [class.fa-chevron-down]="showQuality" aria-hidden="true"></i>Quality check (optional)
                                    </a>
                                </div>
                                @if (showQuality) {
                                    <div class="card-body">
                                        <p class="small text-muted">Leave a check as "Not assessed" when it was not inspected.</p>
                                        @for (q of qualityFields; track q.key) {
                                            <div class="form-group form-row align-items-center mb-2">
                                                <label class="col-md-4 mb-0" [for]="'q' + q.key">{{ q.label }}</label>
                                                <div class="col-md-4">
                                                    <select class="form-control form-control-sm" [id]="'q' + q.key" [name]="'q' + q.key" [(ngModel)]="m[q.key]" (ngModelChange)="keepDraft()">
                                                        <option [ngValue]="null">Not assessed</option>
                                                        <option [ngValue]="true">Yes</option>
                                                        <option [ngValue]="false">No</option>
                                                    </select>
                                                </div>
                                            </div>
                                        }
                                        <div class="form-group mb-0">
                                            <label for="qn">Notes</label>
                                            <textarea id="qn" rows="2" class="form-control" name="qualityNotes" [(ngModel)]="m.qualityNotes" (ngModelChange)="keepDraft()" maxlength="1000"></textarea>
                                        </div>
                                    </div>
                                }
                            </div>
                        </fieldset>
                        @if (!isNew && h) {
                            <p class="small text-muted">
                                Recorded by {{ h.recordedBy }}, {{ h.creationTime | farmDateTime }} · {{ h.harvestedPieces | num: 0 }} pieces ·
                                sold {{ h.soldKg | num: 2 }} kg · not sold {{ h.notSoldKg | num: 2 }} kg
                                @if (h.unaccountedKg > 0) { · <span class="text-warning-dark">{{ h.unaccountedKg | num: 2 }} kg neither sold nor recorded</span> }
                            </p>
                        }
                        @if (!readOnly) {
                            <button type="submit" class="btn btn-primary btn-lg mr-2" [disabled]="busy() || !f.form.valid || gradeOver() || sampleHalf()">{{ isNew ? 'Save harvest' : 'Save changes' }}</button>
                            <a class="btn btn-default btn-lg" routerLink="/app/harvests">Cancel</a>
                            <fpms-form-hint [form]="f"></fpms-form-hint>
                        }
                    </form>
                }
            </div>
        </section>
    `,
})
export class HarvestEntryComponent extends FpmsPage implements OnInit {
    /** Unsaved entries are kept as a browser draft, so leaving never needs to ask. */
    protected override keepsDrafts = true;
    loading = true;
    isNew = true;
    readOnly = false;
    showQuality = false;
    showCrates = false;
    readonly maxCrates = 1000;
    bulk: any = { count: null, containerTypeId: '', kg: null };
    /** Active crate types (DEC-80); the default is picked first in the quick add. "" = a plain crate. */
    containers: any[] = [];
    h: any = null;
    batch: any = null;
    batches: any[] = [];
    grades: any[] = [];
    m: any = {};
    restoredAt: string | null = null;
    readonly nowInput = FarmTime.nowInput();
    readonly qualityFields = [
        { key: 'smoothShell', label: 'Smooth shell' },
        { key: 'intactAppendages', label: 'Intact appendages' },
        { key: 'noNecrosis', label: 'No necrosis' },
    ];

    ngOnInit(): void {
        // Detail routes reuse this component when only the :id changes, so reload on every change.
        this.route.paramMap.subscribe(() => this.init());
    }

    private get draftKey(): string {
        return `harvest.${this.m.batchId}`;
    }

    async init(): Promise<void> {
        FormDrafts.purgeExpired();
        const id = this.param('id');
        this.isNew = !id;
        this.restoredAt = null;
        this.grades = await this.api.get<any[]>('Harvest', 'GetGradeOptions');
        this.containers = (await this.api.get<any[]>('ContainerType', 'GetAll')).filter((t) => t.isActive);
        this.resetBulk();
        if (this.isNew) {
            const all = await this.api.get<any[]>('Batch', 'GetAll', { openOnly: true });
            this.batches = all.filter((b) => b.status === 2 || b.status === 4);
            this.m = this.blank(this.query('batchId') ?? this.batches[0]?.id ?? '');
            if (this.m.batchId) {
                await this.onBatch();
            }
        } else {
            const h = await this.api.get<any>('Harvest', 'Get', { id });
            this.h = h;
            this.batch = await this.api.get<any>('Batch', 'Get', { id: h.batchId });
            this.batches = [this.batch];
            this.readOnly = !h.canEdit;
            this.m = {
                ...h,
                harvestedAt: FarmTime.toLocalInput(h.harvestedAtUtc),
                gradeLines: h.gradeLines.map((g: any) => ({ sizeGradeId: g.sizeGradeId, kg: g.kg, soldKg: g.soldKg })),
                disposals: h.disposals.map((d: any) => ({ ...d })),
                // The scale reading is shown again: gross when a container weight was subtracted, else net.
                crates: (h.crates ?? []).map((c: any) => ({ kg: c.grossKg ?? c.kg, containerTypeId: c.containerTypeId ?? '', containerName: c.containerName, tareKg: c.tareKg })),
            };
            this.showCrates = this.m.crates.length > 0;
            // A grade that has since been deactivated stays selectable for this harvest.
            for (const g of h.gradeLines) {
                if (!this.grades.some((o) => o.id === g.sizeGradeId)) {
                    this.grades = [...this.grades, { id: g.sizeGradeId, label: g.sizeLabel, isUngraded: g.isUngraded }];
                }
            }
            this.showQuality = h.smoothShell != null || h.intactAppendages != null || h.noNecrosis != null || !!h.qualityNotes;
        }
        this.loading = false;
    }

    private blank(batchId: string): any {
        return {
            batchId, harvestType: 1, harvestedAt: FarmTime.nowInput(), totalKg: null, boxes: null, abwG: null, abwSampleWeightG: null, abwSamplePieces: null,
            finalCount: null, deadAtHarvest: null, smoothShell: null, intactAppendages: null, noNecrosis: null, qualityNotes: '', gradeLines: [], disposals: [], crates: [],
        };
    }

    async onBatch(): Promise<void> {
        this.batch = await this.api.get<any>('Batch', 'Get', { id: this.m.batchId });
        if (this.isNew) {
            const draft = FormDrafts.load<any>(this.draftKey);
            if (draft?.data) {
                this.m = { ...this.blank(this.m.batchId), ...draft.data, batchId: this.m.batchId };
                this.m.crates = this.m.crates ?? [];
                this.showCrates = this.m.crates.length > 0;
                this.restoredAt = new Date(draft.savedAt).toISOString();
            } else {
                this.restoredAt = null;
            }
        }
    }

    keepDraft(): void {
        if (this.isNew && this.m.batchId) {
            FormDrafts.save(this.draftKey, this.m);
        }
    }

    discardDraft(): void {
        FormDrafts.clear(this.draftKey);
        this.m = this.blank(this.m.batchId);
        this.restoredAt = null;
    }

    usedGrade(id: string, self: any): boolean {
        return this.m.gradeLines.some((g: any) => g !== self && g.sizeGradeId === id);
    }

    addGrade(): void {
        const free = this.grades.find((o) => !this.m.gradeLines.some((g: any) => g.sizeGradeId === o.id));
        this.m.gradeLines.push({ sizeGradeId: free?.id ?? '', kg: null, soldKg: 0 });
        this.keepDraft();
    }

    gradeKg(): number {
        return (this.m.gradeLines ?? []).reduce((s: number, g: any) => s + (Number(g.kg) || 0), 0);
    }

    gradeOver(): boolean {
        return this.m.totalKg > 0 && this.gradeKg() > Number(this.m.totalKg) + 0.0005;
    }

    hasCrates(): boolean {
        return (this.m.crates ?? []).length > 0;
    }

    crateKg(): number {
        return (this.m.crates ?? []).reduce((s: number, c: any) => s + this.netOf(c), 0);
    }

    get canManageContainers(): boolean {
        return this.can('Farm.Harvests.EditAny');
    }

    netOf(c: any): number {
        return (Number(c.kg) || 0) - (Number(c.tareKg) || 0);
    }

    crateTare(): number {
        return (this.m.crates ?? []).reduce((s: number, c: any) => s + (Number(c.tareKg) || 0), 0);
    }

    private container(id: string): any {
        return this.containers.find((t) => t.id === id);
    }

    /** The quick add starts on the default container with its usual kg; the count is always typed. */
    resetBulk(): void {
        const d = this.containers.find((t) => t.isDefault);
        this.bulk = { count: null, containerTypeId: d?.id ?? '', kg: d ? this.scaleKg(d) : null };
    }

    /** The usual reading for a container: its usual shrimp kg, plus the container when it is weighed with it. */
    private scaleKg(t: any): number | null {
        return t?.nominalKg > 0 ? Math.round((Number(t.nominalKg) + (Number(t.tareKg) || 0)) * 1000) / 1000 : null;
    }

    onBulkContainer(): void {
        const t = this.container(this.bulk.containerTypeId);
        if (t?.nominalKg > 0) {
            this.bulk.kg = this.scaleKg(t);
        }
    }

    bulkTare(): number {
        return Number(this.container(this.bulk.containerTypeId)?.tareKg) || 0;
    }

    /** "Add crate" repeats the last crate (same container and reading), or uses the quick add's container and kg. */
    addOneCrate(): void {
        const last = this.m.crates?.[this.m.crates.length - 1];
        if (last) {
            this.m.crates.push({ ...last });
            this.syncCrates();
        } else {
            this.pushCrates(1, this.bulk.containerTypeId, this.bulk.kg);
        }
    }

    addBulk(): void {
        this.pushCrates(this.bulk.count, this.bulk.containerTypeId, this.bulk.kg);
        this.bulk.count = null;
    }

    private pushCrates(count: any, containerTypeId: string, kg: any): void {
        const t = this.container(containerTypeId);
        const n = Math.min(Number(count) || 0, this.maxCrates - this.m.crates.length);
        for (let i = 0; i < n; i++) {
            this.m.crates.push({ kg: kg > 0 ? Number(kg) : null, containerTypeId: t?.id ?? '', containerName: t?.name ?? null, tareKg: t?.tareKg ?? null });
        }
        this.syncCrates();
    }

    removeCrate(i: number): void {
        this.m.crates.splice(i, 1);
        this.syncCrates();
    }

    /** With crates, the total kg is their sum (rounded to grams) and the boxes their number, as the server does. */
    syncCrates(): void {
        if (this.hasCrates()) {
            this.m.totalKg = Math.round(this.crateKg() * 1000) / 1000;
            this.m.boxes = this.m.crates.length;
        }
        this.keepDraft();
    }

    sampleComplete(): boolean {
        return this.m.abwSampleWeightG > 0 && this.m.abwSamplePieces > 0;
    }

    sampleHalf(): boolean {
        const w = this.m.abwSampleWeightG, p = this.m.abwSamplePieces;
        const has = (v: any) => v !== null && v !== '' && v !== undefined;
        return has(w) !== has(p);
    }

    /** ABW = sample weight ÷ pieces, rounded to 0.01 g like the paper tally (5,002 g ÷ 414 = 12.08 g). */
    onSample(): void {
        if (this.sampleComplete()) {
            this.m.abwG = Math.round((Number(this.m.abwSampleWeightG) / Number(this.m.abwSamplePieces)) * 100) / 100;
        }
        this.keepDraft();
    }

    sellableKg(): number {
        return (this.h?.gradeLines ?? []).reduce((s: number, g: any) => s + (g.unsoldKg || 0), 0);
    }

    async save(): Promise<void> {
        const body = {
            id: this.isNew ? null : this.h.id,
            batchId: this.m.batchId,
            harvestedAt: FarmTime.fromLocalInput(this.m.harvestedAt),
            harvestType: this.m.harvestType,
            totalKg: this.m.totalKg,
            boxes: this.m.boxes,
            abwG: this.m.abwG || null,
            abwSampleWeightG: this.sampleComplete() ? Number(this.m.abwSampleWeightG) : null,
            abwSamplePieces: this.sampleComplete() ? Number(this.m.abwSamplePieces) : null,
            // Every crate sends its tare (0 when none), so a later change to the container's empty weight does not alter it.
            crates: (this.m.crates ?? []).filter((c: any) => c.kg > 0)
                .map((c: any) => ({ kg: Number(c.kg), containerTypeId: c.containerTypeId || null, tareKg: Number(c.tareKg) || 0 })),
            finalCount: this.m.finalCount === '' ? null : this.m.finalCount,
            deadAtHarvest: this.m.deadAtHarvest === '' ? null : this.m.deadAtHarvest,
            smoothShell: this.m.smoothShell,
            intactAppendages: this.m.intactAppendages,
            noNecrosis: this.m.noNecrosis,
            qualityNotes: this.m.qualityNotes,
            gradeLines: this.m.gradeLines.filter((g: any) => g.sizeGradeId && g.kg > 0).map((g: any) => ({ sizeGradeId: g.sizeGradeId, kg: Number(g.kg) })),
            disposals: this.m.disposals.filter((d: any) => d.kg > 0).map((d: any) => ({ kg: Number(d.kg), reason: d.reason, note: d.note })),
        };
        let saved: any;
        const ok = await this.act(async () => (saved = this.isNew ? await this.api.post<any>('Harvest', 'Create', body) : await this.api.put<any>('Harvest', 'Update', body)));
        if (ok) {
            if (this.isNew) {
                FormDrafts.clear(this.draftKey);
            }
            this.notifySaved(body.harvestType === 2 ? 'Total harvest saved.' : 'Harvest saved.');
            if (saved?.warnings?.length) {
                this.showWarnings(saved.warnings);
            }
            this.router.navigate(['/app/production/batches', saved?.batchId ?? body.batchId], { replaceUrl: true });
        }
    }
}
