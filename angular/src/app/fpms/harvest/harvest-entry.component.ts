import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { FormDrafts } from '@shared/fpms/drafts';
import { FPMS_IMPORTS } from '../shared-imports';
import { PRICE_METHODS, applyTerms, countFromAbw, num, pricingBody, referencePrice, tableRow, termsEmpty } from '@shared/fpms/pricing';

/**
 * Harvest entry and detail (Ref 7.1, AC-14, step E): Partial or Total, grade lines on the farm's size grades, optional
 * final count and dead-at-harvest count, not-sold entries (DEC-67) and optional quality checks. Optional crate tally and
 * ABW sample (DEC-80): with crates, the total kg and boxes come from them. Optional buyer and scale (DEC-81); for a new
 * harvest with a buyer, the sale can be recorded on the same form, like the paper tally sheet, and both save together.
 * Crates can be graded one by one; the grade lines are then their sums (DEC-82). A saved harvest prints as a tally sheet.
 * The Total harvest marks the batch Harvested. A new harvest keeps a browser draft until it is saved (AC-25).
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [narrow]="true" [title]="isNew ? 'Record harvest' : 'Harvest' + (batch ? ' · ' + batch.pondCode + ' ' + (batch.letter ? 'Batch ' + batch.letter : batch.batchCode) : '')" [subtitle]="isNew ? (batch ? batch.pondCode + ' · ' + (batch.letter ? 'Batch ' + batch.letter : batch.batchCode) : '') : (h ? (h.lotCode ? 'Lot ' + h.lotCode + ' · ' : '') + (h.harvestType | label: L.HarvestTypes) + ' harvest on ' + (h.harvestedAtUtc | farmDate) + '. Edit it here until the batch is closed.' : '')" backLink="/app/harvests" backLabel="Harvests">
            @if (!isNew && h) {
                <a class="btn btn-outline-primary mr-1" [routerLink]="['/app/harvests', h.id, 'tally']"><i class="fas fa-clipboard-list mr-1" aria-hidden="true"></i>Tally sheet</a>
            }
            @if (!isNew && h?.lotCode && can('Farm.Reports')) {
                <a class="btn btn-outline-secondary mr-1" [routerLink]="['/app/reports/trace/lot', h.lotCode]" [queryParams]="{ from: 'harvests' }"><i class="fas fa-project-diagram mr-1"></i>Trace this lot</a>
            }
            @if (!isNew && h && can('Farm.Sales') && sellableKg() > 0) {
                <a class="btn btn-outline-primary" routerLink="/app/sales/new" [queryParams]="{ harvestId: h.id }"><i class="fas fa-cash-register mr-1"></i>Sell this harvest</a>
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
                                            <label for="buyer">Buyer (Name of Customer)</label>
                                            <select id="buyer" class="form-control" name="buyerId" [(ngModel)]="m.buyerId" (ngModelChange)="onBuyer()">
                                                <option value="">Not one buyer / not decided</option>
                                                @for (b of buyers; track b.id) {
                                                    <option [value]="b.id" [disabled]="!b.isActive && b.id !== h?.buyerId">{{ b.name }}{{ b.isActive ? '' : ' (inactive)' }}</option>
                                                }
                                            </select>
                                            <small class="form-text text-muted">When one buyer harvests or orders it. Their usual crate and price terms are filled in.</small>
                                        </div>
                                        <div class="form-group col-md-6">
                                            <label for="wb">Weighed on</label>
                                            <select id="wb" class="form-control" name="weighedBy" [(ngModel)]="m.weighedBy" (ngModelChange)="keepDraft()">
                                                <option [ngValue]="null">Not recorded</option>
                                                <option [ngValue]="1">The farm's scale</option>
                                                <option [ngValue]="2">The buyer's scale</option>
                                            </select>
                                            @if (m.weighedBy === 2) { <small class="form-text text-muted">The kg are the buyer's weight; the sale needs no separate buyer kg.</small> }
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
                                        <div class="custom-control custom-switch mb-2">
                                            <input type="checkbox" class="custom-control-input" id="gradeCrates" name="gradeCrates" [(ngModel)]="m.gradeCrates" (ngModelChange)="syncCrates()" />
                                            <label class="custom-control-label" for="gradeCrates">Grade each crate</label>
                                            <small class="form-text text-muted mt-0">The size grading below then adds up the crates of each grade; ungraded crates go to "Ungraded / mixed".</small>
                                        </div>
                                        <p class="small text-muted">Weigh crate by crate, as on the harvest tally sheet. The total kg and boxes then come from the crates. Leave empty to enter only the total. A crate with no type is just "Crate"; a crate type with an empty weight is weighed with the crate, and the crate's weight is subtracted.</p>
                                        @if (hasCrates()) {
                                            <div class="table-responsive tally-scroll mb-2" [class.tally-long]="m.crates.length > 12">
                                                <table class="table table-sm table-hover mb-0 tally-table">
                                                    <thead>
                                                        <tr>
                                                            <th scope="col" class="text-right">#</th>
                                                            @if (showCrateType()) { <th scope="col">Crate type</th> }
                                                            @if (m.gradeCrates) { <th scope="col">Grade</th> }
                                                            <th scope="col" class="text-right">{{ crateTare() > 0 ? 'Scale kg' : 'Kg' }}</th>
                                                            @if (crateTare() > 0) {
                                                                <th scope="col" class="text-right">Crate kg</th>
                                                                <th scope="col" class="text-right">Shrimp kg</th>
                                                            }
                                                            <th scope="col" class="text-right">Running total</th>
                                                            <th scope="col"><span class="sr-only">Remove</span></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        @for (c of m.crates; track $index; let i = $index) {
                                                            <tr [class.table-danger]="c.kg > 0 && netOf(c) <= 0">
                                                                <td class="text-right text-muted align-middle">{{ i + 1 }}</td>
                                                                @if (showCrateType()) {
                                                                    <td>
                                                                        <select class="custom-select custom-select-sm" [name]="'ct' + i" [(ngModel)]="c.containerTypeId" (ngModelChange)="setCrateType(c)" [attr.aria-label]="'Crate type of crate ' + (i + 1)">
                                                                            <option value="">Crate</option>
                                                                            @if (c.containerTypeId && !containerKnown(c.containerTypeId)) { <option [value]="c.containerTypeId">{{ c.containerName }}</option> }
                                                                            @for (t of containers; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
                                                                        </select>
                                                                    </td>
                                                                }
                                                                @if (m.gradeCrates) {
                                                                    <td>
                                                                        <select class="custom-select custom-select-sm" [name]="'cg' + i" [(ngModel)]="c.sizeGradeId" (ngModelChange)="syncCrates()" [attr.aria-label]="'Size grade of crate ' + (i + 1)">
                                                                            <option value="">Ungraded</option>
                                                                            @for (o of gradedOptions(); track o.id) { <option [value]="o.id">{{ o.label }}</option> }
                                                                        </select>
                                                                    </td>
                                                                }
                                                                <td class="tally-kg">
                                                                    <input [id]="'cr' + i" type="number" inputmode="decimal" min="0.001" step="0.001" class="form-control form-control-sm text-right" [name]="'cr' + i" [(ngModel)]="c.kg" (ngModelChange)="syncCrates()" (keydown.enter)="nextCrate($event, i)" required [attr.aria-label]="'Kg of crate ' + (i + 1)" />
                                                                </td>
                                                                @if (crateTare() > 0) {
                                                                    <td class="text-right text-muted align-middle">{{ c.tareKg > 0 ? '− ' + (c.tareKg | num: 3) : '' }}</td>
                                                                    <td class="text-right align-middle" [class.text-danger]="c.kg > 0 && netOf(c) <= 0">{{ c.kg > 0 ? (netOf(c) | num: 3) : '' }}</td>
                                                                }
                                                                <td class="text-right text-muted align-middle">{{ runningKg(i) | num: 3 }}</td>
                                                                <td class="text-right">
                                                                    <button type="button" class="btn btn-sm btn-link text-danger" (click)="removeCrate(i)" [attr.aria-label]="'Remove crate ' + (i + 1)"><i class="fas fa-times"></i></button>
                                                                </td>
                                                            </tr>
                                                        }
                                                    </tbody>
                                                    <tfoot>
                                                        <tr class="font-weight-bold">
                                                            <td class="text-right">{{ m.crates.length }}</td>
                                                            <td [attr.colspan]="(showCrateType() ? 1 : 0) + (m.gradeCrates ? 1 : 0) + 1" class="text-right">{{ m.crates.length === 1 ? 'crate' : 'crates' }}{{ crateTare() > 0 ? ' · ' + (scaleTotalKg() | num: 3) + ' kg on the scale' : '' }}</td>
                                                            @if (crateTare() > 0) {
                                                                <td class="text-right text-muted">− {{ crateTare() | num: 3 }}</td>
                                                                <td class="text-right">{{ crateKg() | num: 3 }}</td>
                                                            }
                                                            <td class="text-right">{{ crateKg() | num: 3 }} kg</td>
                                                            <td></td>
                                                        </tr>
                                                        @if (m.gradeCrates && crateGradeSums().length > 1) {
                                                            <tr class="small text-muted">
                                                                <td></td>
                                                                <td [attr.colspan]="(showCrateType() ? 1 : 0) + 1 + 1 + (crateTare() > 0 ? 2 : 0) + 2">
                                                                    @for (g of crateGradeSums(); track g.label) { <span class="mr-3">{{ g.label }}: {{ g.count }} × · {{ g.kg | num: 3 }} kg</span> }
                                                                </td>
                                                            </tr>
                                                        }
                                                    </tfoot>
                                                </table>
                                            </div>
                                            <p class="small text-muted mb-2">Press Enter after each weight to go to the next crate; on the last crate, Enter adds a new one of the same type and grade.</p>
                                        }
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
                                            @if (m.gradeCrates) {
                                                <div class="form-group col-auto mb-2">
                                                    <label class="small mb-0" for="bulkG">grade</label>
                                                    <select id="bulkG" class="custom-select custom-select-sm" name="bulkG" [(ngModel)]="bulk.sizeGradeId" [ngModelOptions]="{ standalone: true }">
                                                        <option value="">Ungraded</option>
                                                        @for (o of gradedOptions(); track o.id) { <option [value]="o.id">{{ o.label }}</option> }
                                                    </select>
                                                </div>
                                            }
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
                                                        <select class="form-control form-control-sm" [name]="'gs' + $index" [(ngModel)]="g.sizeGradeId" (ngModelChange)="keepDraft()" required aria-label="Size grade" [disabled]="g.soldKg > 0 || gradedByCrate()">
                                                            @for (o of grades; track o.id) {
                                                                <option [value]="o.id" [disabled]="usedGrade(o.id, g)">{{ o.label }}{{ o.isUngraded ? ' (pieces from ABW)' : '' }}</option>
                                                            }
                                                        </select>
                                                    </td>
                                                    <td><input type="number" [min]="g.soldKg || 0.001" step="0.001" class="form-control form-control-sm" [name]="'gk' + $index" [(ngModel)]="g.kg" (ngModelChange)="keepDraft()" required aria-label="Kg" [readonly]="gradedByCrate()" /></td>
                                                    @if (!isNew) { <td class="text-right small">{{ g.soldKg | num: 3 }}</td> }
                                                    <td class="text-right">
                                                        @if (!(g.soldKg > 0) && !gradedByCrate()) {
                                                            <button type="button" class="btn btn-sm btn-outline-danger" (click)="m.gradeLines.splice($index, 1); keepDraft()" aria-label="Remove"><i class="fas fa-times"></i></button>
                                                        }
                                                    </td>
                                                </tr>
                                            }
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td><button type="button" class="btn btn-sm btn-outline-secondary" (click)="addGrade()" [disabled]="m.gradeLines.length >= grades.length || gradedByCrate()"><i class="fas fa-plus mr-1"></i>Add grade</button></td>
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
                            @if (isNew && m.buyerId && canSell) {
                                <div class="card card-outline card-primary">
                                    <div class="card-header">
                                        <div class="custom-control custom-switch">
                                            <input type="checkbox" class="custom-control-input" id="sell" name="sell" [(ngModel)]="m.sell" (ngModelChange)="keepDraft()" />
                                            <label class="custom-control-label" for="sell">Record the sale to {{ buyerName() }} now (tally sheet)</label>
                                        </div>
                                    </div>
                                    @if (m.sell) {
                                        <div class="card-body">
                                            <p class="small text-muted">All {{ sellKg() | num: 3 }} kg are sold to this buyer at one price{{ gradeKg() > 0 ? ', on every grade line' : ' as "Ungraded / mixed"' }}. Splitting between buyers or grades at different prices: save the harvest alone, then record each sale.</p>
                                            <div class="form-row">
                                                <div class="form-group col-md-4">
                                                    <label for="spm">Price</label>
                                                    <select id="spm" class="form-control" name="salePriceMethod" [(ngModel)]="m.sale.priceMethod" (ngModelChange)="onSaleMethod()">
                                                        @for (o of methods; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
                                                    </select>
                                                </div>
                                                <div class="form-group col-md-4">
                                                    <label for="spp">Price per kg (₱) @if (!perGradePricing()) {<span class="text-danger">*</span>}</label>
                                                    <input id="spp" type="number" min="0" step="0.01" class="form-control" name="salePrice" [(ngModel)]="m.sale.pricePerKg" (ngModelChange)="keepDraft()" [required]="!perGradePricing()" [placeholder]="perGradePricing() ? 'per grade' : ''" />
                                                </div>
                                                <div class="form-group col-md-4">
                                                    <label>Total amount</label>
                                                    <div class="form-control-plaintext font-weight-bold">{{ saleTotal() | php }}</div>
                                                </div>
                                            </div>
                                            @if (m.sale.priceMethod === 2 || m.sale.priceMethod === 3) {
                                                <div class="form-row">
                                                    <div class="form-group col-6 col-md-3">
                                                        <label class="small" for="sbp">Base price (₱/kg)</label>
                                                        <input id="sbp" type="number" min="0" step="0.01" class="form-control form-control-sm" name="saleBase" [(ngModel)]="m.sale.basePricePerKg" (ngModelChange)="applySaleFormula()" required />
                                                    </div>
                                                    @if (m.sale.priceMethod === 2) {
                                                        <div class="form-group col-6 col-md-3">
                                                            <label class="small" for="sba">at ABW (g)</label>
                                                            <input id="sba" type="number" min="0.01" max="60" step="0.01" class="form-control form-control-sm" name="saleBaseAbw" [(ngModel)]="m.sale.baseAbwG" (ngModelChange)="applySaleFormula()" required />
                                                        </div>
                                                        <div class="form-group col-6 col-md-3">
                                                            <label class="small" for="sst">+ ₱ per g</label>
                                                            <input id="sst" type="number" min="0" step="0.01" class="form-control form-control-sm" name="saleStep" [(ngModel)]="m.sale.stepPerG" (ngModelChange)="applySaleFormula()" required />
                                                        </div>
                                                    } @else {
                                                        <div class="form-group col-6 col-md-3">
                                                            <label class="small" for="sbc">at count (pcs/kg)</label>
                                                            <input id="sbc" type="number" min="1" step="1" class="form-control form-control-sm" name="saleBaseCount" [(ngModel)]="m.sale.baseCountPerKg" (ngModelChange)="applySaleFormula()" required />
                                                        </div>
                                                        <div class="form-group col-6 col-md-3">
                                                            <label class="small" for="ssc">+ ₱ per piece fewer</label>
                                                            <input id="ssc" type="number" min="0" step="0.01" class="form-control form-control-sm" name="saleStepCount" [(ngModel)]="m.sale.stepPerCount" (ngModelChange)="applySaleFormula()" required />
                                                        </div>
                                                    }
                                                    <div class="form-group col-6 col-md-3 small">
                                                        <label class="small d-block">{{ m.sale.priceMethod === 2 ? 'Shrimp ABW' : 'Shrimp count' }}</label>
                                                        @if (m.sale.priceMethod === 2) {
                                                            {{ m.abwG ? (m.abwG | num: 2) + ' g (from the sample above)' : 'Enter the ABW above' }}
                                                        } @else {
                                                            {{ saleCount() !== null ? saleCount() + ' pcs/kg (from the ABW)' : 'Enter the ABW above' }}
                                                        }
                                                    </div>
                                                </div>
                                            }
                                            @if (m.sale.priceMethod === 4) {
                                                <div class="form-row">
                                                    <div class="form-group col-md-6">
                                                        <label class="small" for="stb">Price table</label>
                                                        <select id="stb" class="custom-select custom-select-sm" name="saleTable" [(ngModel)]="m.sale.priceTableId" (ngModelChange)="applySaleFormula()" required>
                                                            <option value="">Choose…</option>
                                                            @for (t of saleTables(); track t.id) { <option [value]="t.id">{{ t.name }}{{ t.buyerName ? ' (' + t.buyerName + ')' : '' }}</option> }
                                                        </select>
                                                    </div>
                                                    <div class="form-group col-md-6 small">
                                                        <label class="small d-block">Shrimp count</label>
                                                        {{ saleCount() !== null ? saleCount() + ' pcs/kg (from the ABW)' : 'Enter the ABW above' }}
                                                    </div>
                                                </div>
                                            }
                                            @if (m.sale.priceMethod > 1) {
                                                @if (saleFormula() !== null) {
                                                    <p class="small mb-2">{{ saleWorking() }} = <strong>{{ saleFormula() | php }}</strong>
                                                        @if (saleOverridden()) { · <span class="text-warning-dark">price differs</span> <a href="javascript:;" (click)="m.sale.pricePerKg = saleFormula()">use {{ saleFormula() | php }}</a> }
                                                    </p>
                                                } @else if (m.sale.priceMethod === 4 && m.sale.priceTableId && saleCount() !== null) {
                                                    <p class="small text-danger mb-2">No row of this table covers {{ saleCount() }} pcs/kg.</p>
                                                }
                                                @if (perGradePricing()) {
                                                    <p class="small text-muted mb-2">Several grades: each grade is priced from its own count, as listed. The price above applies to none of them.</p>
                                                    <ul class="small mb-2">
                                                        @for (x of saleLines(); track x.label) { <li>{{ x.label }}: {{ x.kg | num: 3 }} kg × {{ x.price != null ? (x.price | php) : '—' }}</li> }
                                                    </ul>
                                                }
                                            }
                                            <div class="form-row">
                                                <div class="form-group col-md-4">
                                                    <label for="spt">Payment terms</label>
                                                    <input id="spt" class="form-control" name="salePaymentTerms" [(ngModel)]="m.sale.paymentTerms" maxlength="200" placeholder="e.g. cash, net 7 days" />
                                                </div>
                                                <div class="form-group col-md-4">
                                                    <label for="sdd">Due date</label>
                                                    <input id="sdd" type="date" class="form-control" name="saleDueDate" [(ngModel)]="m.sale.dueDate" />
                                                </div>
                                                <div class="form-group col-md-4">
                                                    <label for="spn">Paid now (₱)</label>
                                                    <div class="input-group">
                                                        <input id="spn" type="number" min="0" step="0.01" class="form-control" name="salePaidNow" [(ngModel)]="m.sale.paidNow" />
                                                        <div class="input-group-append"><button type="button" class="btn btn-outline-secondary" (click)="m.sale.paidNow = saleTotal()">In full</button></div>
                                                    </div>
                                                    <input class="form-control form-control-sm mt-1" name="salePaidMethod" [(ngModel)]="m.sale.paidMethod" maxlength="50" placeholder="cash, bank transfer, GCash" aria-label="Payment method" />
                                                </div>
                                            </div>
                                            <p class="small text-muted mb-0">Both are saved together, and the dispatch receipt opens. Edit them later on their own pages.</p>
                                        </div>
                                    }
                                </div>
                            }
                        </fieldset>
                        @if (!isNew && h) {
                            <p class="small text-muted">
                                Recorded by {{ h.recordedBy }}, {{ h.creationTime | farmDateTime }} · {{ h.harvestedPieces | num: 0 }} pieces ·
                                sold {{ h.soldKg | num: 2 }} kg · not sold {{ h.notSoldKg | num: 2 }} kg
                                @if (h.unaccountedKg > 0) { · <span class="text-warning-dark">{{ h.unaccountedKg | num: 2 }} kg neither sold nor recorded</span> }
                            </p>
                        }
                        @if (!readOnly) {
                            <button type="submit" class="btn btn-primary btn-lg mr-2" [disabled]="busy() || !f.form.valid || gradeOver() || sampleHalf()">{{ isNew ? (selling() ? 'Save harvest and sale' : 'Save harvest') : 'Save changes' }}</button>
                            <a class="btn btn-default btn-lg" routerLink="/app/harvests">Cancel</a>
                            <fpms-form-hint [form]="f"></fpms-form-hint>
                        }
                    </form>
                }
            </div>
        </section>
    `,
    styles: [
        `
            .tally-table th {
                white-space: nowrap;
                font-size: 0.85rem;
            }
            .tally-table td {
                vertical-align: middle;
            }
            .tally-table .tally-kg {
                width: 8rem;
            }
            .tally-table tfoot td {
                border-top: 2px solid var(--fpms-line-strong);
            }
            .tally-long {
                max-height: 26rem;
                overflow-y: auto;
            }
            .tally-long thead th {
                position: sticky;
                top: 0;
                background: var(--fpms-surface, #fff);
                z-index: 1;
            }
            .tally-long tfoot td {
                position: sticky;
                bottom: 0;
                background: var(--fpms-surface, #fff);
            }
        `,
    ],
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
    buyers: any[] = [];
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
        this.buyers = await this.api.get<any[]>('TallySheet', 'GetBuyerOptions');
        this.tables = this.can('Farm.Sales') ? (await this.api.get<any[]>('PriceTable', 'GetAll')).filter((t) => t.isActive) : [];
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
                buyerId: h.buyerId ?? '',
                crates: (h.crates ?? []).map((c: any) => ({ kg: c.grossKg ?? c.kg, containerTypeId: c.containerTypeId ?? '', containerName: c.containerName, tareKg: c.tareKg, sizeGradeId: c.sizeGradeId ?? '' })),
                gradeCrates: (h.crates ?? []).some((c: any) => c.sizeGradeId),
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
            buyerId: '', weighedBy: null, sell: false, sale: this.blankSale(), gradeCrates: false,
        };
    }

    async onBatch(): Promise<void> {
        this.batch = await this.api.get<any>('Batch', 'Get', { id: this.m.batchId });
        if (this.isNew) {
            const draft = FormDrafts.load<any>(this.draftKey);
            if (draft?.data) {
                this.m = { ...this.blank(this.m.batchId), ...draft.data, batchId: this.m.batchId };
                this.m.crates = this.m.crates ?? [];
                this.m.sale = { ...this.blankSale(), ...(this.m.sale ?? {}) };
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

    /** Sum of the scale readings (with the crates). */
    scaleTotalKg(): number {
        return (this.m.crates ?? []).reduce((s: number, c: any) => s + (Number(c.kg) || 0), 0);
    }

    /** Shrimp kg of crates 1 … i, as the paper sheet's running total. */
    runningKg(i: number): number {
        return (this.m.crates ?? []).slice(0, i + 1).reduce((s: number, c: any) => s + Math.max(0, this.netOf(c)), 0);
    }

    /** The crate type column shows when the farm has crate types or a crate already has one. */
    showCrateType(): boolean {
        return this.containers.length > 0 || (this.m.crates ?? []).some((c: any) => c.containerTypeId);
    }

    containerKnown(id: string): boolean {
        return this.containers.some((t) => t.id === id);
    }

    /** Changing a crate's type takes that type's name and empty weight. */
    setCrateType(c: any): void {
        const t = this.container(c.containerTypeId);
        if (t) {
            c.containerName = t.name;
            c.tareKg = t.tareKg ?? null;
        } else if (!c.containerTypeId) {
            c.containerName = null;
            c.tareKg = null;
        }
        this.syncCrates();
    }

    /** Graded crates: count and shrimp kg per grade, for the table footer. */
    crateGradeSums(): { label: string; count: number; kg: number }[] {
        const by = new Map<string, { label: string; count: number; kg: number }>();
        for (const c of this.m.crates ?? []) {
            const label = this.gradedOptions().find((o) => o.id === c.sizeGradeId)?.label ?? 'Ungraded';
            const row = by.get(label) ?? { label, count: 0, kg: 0 };
            row.count++;
            row.kg += Math.max(0, this.netOf(c));
            by.set(label, row);
        }
        return Array.from(by.values());
    }

    /** Enter in a crate's kg: go to the next crate, or add one (same type and grade, no weight) after the last. Never submits the form. */
    nextCrate(event: Event, i: number): void {
        event.preventDefault();
        if (i === this.m.crates.length - 1) {
            if (!(this.m.crates[i].kg > 0) || this.m.crates.length >= this.maxCrates) {
                return;
            }
            const last = this.m.crates[i];
            this.m.crates.push({ ...last, kg: null });
            this.syncCrates();
        }
        this.focusCrate(i + 1);
    }

    /** Focuses a crate's kg box once the row is on the page. */
    private focusCrate(i: number, tries = 10): void {
        const el = document.getElementById('cr' + i) as HTMLInputElement | null;
        if (el) {
            el.focus();
            el.select();
        } else if (tries > 0) {
            requestAnimationFrame(() => this.focusCrate(i, tries - 1));
        }
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
        this.bulk = { count: null, containerTypeId: d?.id ?? '', kg: d ? this.scaleKg(d) : null, sizeGradeId: '' };
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
            this.m.crates.push({
                kg: kg > 0 ? Number(kg) : null, containerTypeId: t?.id ?? '', containerName: t?.name ?? null, tareKg: t?.tareKg ?? null,
                sizeGradeId: this.m.gradeCrates ? this.bulk.sizeGradeId || '' : '',
            });
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
        if (this.gradedByCrate()) {
            this.gradeLinesFromCrates();
        }
        this.keepDraft();
    }

    /** Grades a crate can take: the farm's count grades ("Ungraded" is the empty choice). */
    gradedOptions(): any[] {
        return this.grades.filter((g) => !g.isUngraded);
    }

    /** True when crates are graded one by one: the grade lines then come from the crates (DEC-82). */
    gradedByCrate(): boolean {
        return !!this.m.gradeCrates && this.hasCrates();
    }

    /** The grade lines as the server will set them: net kg per crate grade, ungraded crates on "Ungraded / mixed". */
    private gradeLinesFromCrates(): void {
        const ungraded = this.grades.find((g) => g.isUngraded)?.id ?? '';
        const sums = new Map<string, number>();
        for (const c of this.m.crates) {
            const id = c.sizeGradeId || ungraded;
            sums.set(id, (sums.get(id) ?? 0) + this.netOf(c));
        }
        const sold = new Map<string, number>((this.m.gradeLines ?? []).map((g: any) => [g.sizeGradeId, g.soldKg || 0]));
        this.m.gradeLines = Array.from(sums, ([sizeGradeId, kg]) => ({ sizeGradeId, kg: Math.round(kg * 1000) / 1000, soldKg: sold.get(sizeGradeId) ?? 0 }));
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

    get canSell(): boolean {
        return this.can('Farm.Sales');
    }

    readonly methods = PRICE_METHODS;
    /** Active price tables (DEC-82), loaded only for users who can sell. */
    tables: any[] = [];

    blankSale(): any {
        return {
            priceMethod: 1, pricePerKg: null, basePricePerKg: null, baseAbwG: null, stepPerG: null, baseCountPerKg: null, stepPerCount: null, priceTableId: '',
            paymentTerms: '', dueDate: '', paidNow: null, paidMethod: '',
        };
    }

    /** Last terms of the buyer chosen on this form (from GetBuyerDefaults). */
    private buyerPriceTerms: any = null;

    buyerName(): string {
        return this.buyers.find((b) => b.id === this.m.buyerId)?.name ?? 'the buyer';
    }

    /** A new harvest's buyer suggests their usual crate type, scale and terms (from their last harvest and sale). */
    async onBuyer(): Promise<void> {
        this.keepDraft();
        if (!this.isNew || !this.m.buyerId) {
            this.m.sell = false;
            return;
        }
        const d = await this.api.get<any>('TallySheet', 'GetBuyerDefaults', { buyerId: this.m.buyerId });
        if (d?.containerTypeId && this.containers.some((t) => t.id === d.containerTypeId) && !this.hasCrates()) {
            this.bulk.containerTypeId = d.containerTypeId;
            this.onBulkContainer();
        }
        if (this.m.weighedBy == null && d?.weighedBy) {
            this.m.weighedBy = d.weighedBy;
        }
        const sale = this.m.sale;
        if (!sale.paymentTerms && d?.paymentTerms) {
            sale.paymentTerms = d.paymentTerms;
        }
        this.buyerPriceTerms = d?.priceTerms ?? null;
        if (this.buyerPriceTerms && (sale.priceMethod === 1 || termsEmpty(sale)) && !(num(sale.pricePerKg) > 0)) {
            sale.priceMethod = this.buyerPriceTerms.priceMethod;
            applyTerms(sale, this.buyerPriceTerms);
            this.applySaleFormula();
        }
        this.keepDraft();
    }

    selling(): boolean {
        return this.isNew && !!this.m.buyerId && this.canSell && !!this.m.sell;
    }

    /** Graded kg, or the whole total when nothing is graded (it is sold as "Ungraded / mixed"). */
    sellKg(): number {
        return this.gradeKg() > 0 ? this.gradeKg() : Number(this.m.totalKg) || 0;
    }

    /** The harvest's count from its ABW (whole pieces per kg), used by count and table pricing. */
    saleCount(): number | null {
        return countFromAbw(num(this.m.abwG));
    }

    saleFormula(): number | null {
        return referencePrice(this.m.sale, num(this.m.abwG), this.saleCount(), this.tables);
    }

    saleTables(): any[] {
        return this.tables
            .filter((t) => !t.buyerId || t.buyerId === this.m.buyerId)
            .sort((a, b) => Number(b.buyerId === this.m.buyerId) - Number(a.buyerId === this.m.buyerId));
    }

    onSaleMethod(): void {
        const s = this.m.sale;
        if (s.priceMethod > 1 && termsEmpty(s)) {
            if (!applyTerms(s, this.buyerPriceTerms) && s.priceMethod === 4) {
                const list = this.saleTables();
                s.priceTableId = list.length && (list[0].buyerId === this.m.buyerId || list.length === 1) ? list[0].id : '';
            }
        }
        this.applySaleFormula();
    }

    saleWorking(): string {
        const s = this.m.sale;
        const php = (v: any) => '₱' + Number(v).toFixed(2);
        switch (s.priceMethod) {
            case 2:
                return `${php(s.basePricePerKg)} + (${Number(this.m.abwG).toFixed(2)} − ${Number(s.baseAbwG).toFixed(2)}) × ${php(s.stepPerG)}`;
            case 3:
                return `${php(s.basePricePerKg)} + (${s.baseCountPerKg} − ${this.saleCount()}) × ${php(s.stepPerCount)}`;
            case 4: {
                const t = this.tables.find((x) => x.id === s.priceTableId);
                return `${t?.name ?? ''}, ${tableRow(t, this.saleCount())?.label ?? ''} (count ${this.saleCount()})`;
            }
        }
        return '';
    }

    /** Count and table pricing with several grades: each grade follows its own count (as the server does). */
    perGradePricing(): boolean {
        return (this.m.sale.priceMethod === 3 || this.m.sale.priceMethod === 4) && this.gradeLinesForSale().length > 1;
    }

    private gradeLinesForSale(): any[] {
        return (this.m.gradeLines ?? []).filter((g: any) => g.sizeGradeId && g.kg > 0);
    }

    /** What the sale will sell: one line per grade (or the whole total as ungraded), with its price per kg. */
    saleLines(): { label: string; kg: number; price: number | null }[] {
        const lines = this.gradeLinesForSale();
        if (!lines.length) {
            return [{ label: 'Ungraded / mixed', kg: Number(this.m.totalKg) || 0, price: num(this.m.sale.pricePerKg) }];
        }
        return lines.map((g: any) => {
            const grade = this.grades.find((o) => o.id === g.sizeGradeId);
            let price = num(this.m.sale.pricePerKg);
            if (this.perGradePricing()) {
                const mid = grade?.minCountPerKg && grade?.maxCountPerKg ? (grade.minCountPerKg + grade.maxCountPerKg) / 2 : (grade?.minCountPerKg ?? grade?.maxCountPerKg ?? null);
                price = referencePrice(this.m.sale, num(this.m.abwG), mid ?? this.saleCount(), this.tables);
                price = price == null ? null : Math.max(0, price);
            }
            return { label: grade?.label ?? '', kg: Number(g.kg) || 0, price };
        });
    }

    applySaleFormula(): void {
        const p = this.saleFormula();
        if (p !== null && p >= 0) {
            this.m.sale.pricePerKg = p;
        }
        this.keepDraft();
    }

    saleOverridden(): boolean {
        const p = this.saleFormula();
        const v = this.m.sale.pricePerKg;
        return p !== null && v !== null && v !== '' && Math.abs(Number(v) - p) >= 0.01;
    }

    saleTotal(): number {
        return this.saleLines().reduce((sum, x) => sum + Math.round(x.kg * (x.price ?? 0) * 100) / 100, 0);
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
            buyerId: this.m.buyerId || null,
            weighedBy: this.m.weighedBy ?? null,
            totalKg: this.m.totalKg,
            boxes: this.m.boxes,
            abwG: this.m.abwG || null,
            abwSampleWeightG: this.sampleComplete() ? Number(this.m.abwSampleWeightG) : null,
            abwSamplePieces: this.sampleComplete() ? Number(this.m.abwSamplePieces) : null,
            // Every crate sends its tare (0 when none), so a later change to the container's empty weight does not alter it.
            crates: (this.m.crates ?? []).filter((c: any) => c.kg > 0)
                .map((c: any) => ({
                    kg: Number(c.kg), containerTypeId: c.containerTypeId || null, tareKg: Number(c.tareKg) || 0,
                    sizeGradeId: this.m.gradeCrates ? c.sizeGradeId || null : null,
                })),
            finalCount: this.m.finalCount === '' ? null : this.m.finalCount,
            deadAtHarvest: this.m.deadAtHarvest === '' ? null : this.m.deadAtHarvest,
            smoothShell: this.m.smoothShell,
            intactAppendages: this.m.intactAppendages,
            noNecrosis: this.m.noNecrosis,
            qualityNotes: this.m.qualityNotes,
            gradeLines: this.m.gradeLines.filter((g: any) => g.sizeGradeId && g.kg > 0).map((g: any) => ({ sizeGradeId: g.sizeGradeId, kg: Number(g.kg) })),
            disposals: this.m.disposals.filter((d: any) => d.kg > 0).map((d: any) => ({ kg: Number(d.kg), reason: d.reason, note: d.note })),
        };
        if (this.selling()) {
            await this.saveWithSale(body);
            return;
        }
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
            this.router.navigate(['/app/production/batches', saved?.batchId ?? body.batchId], { queryParams: { tab: 'harvests' }, replaceUrl: true });
        }
    }

    /** Tally sheet (DEC-81): the harvest and its sale save together, then the dispatch receipt opens. */
    private async saveWithSale(body: any): Promise<void> {
        if (!body.gradeLines.length) {
            const ungraded = this.grades.find((g) => g.isUngraded);
            if (ungraded) {
                body.gradeLines = [{ sizeGradeId: ungraded.id, kg: Number(this.m.totalKg) }];
            }
        }
        const s = this.m.sale;
        const sale: any = {
            ...pricingBody(s),
            pricePerKg: num(s.pricePerKg) ?? 0,
            paymentTerms: s.paymentTerms, dueDate: s.dueDate || null,
        };
        if (Number(s.paidNow) > 0) {
            // Paid on the farm-local harvest date, which is the sale date.
            sale.initialPayment = { paidOn: String(this.m.harvestedAt).slice(0, 10), amount: Number(s.paidNow), method: s.paidMethod };
        }
        let saved: any;
        if (await this.act(async () => (saved = await this.api.post<any>('TallySheet', 'Save', { harvest: body, sale })))) {
            FormDrafts.clear(this.draftKey);
            this.notifySaved(`Harvest and sale saved as ${saved.sale.dispatchReceiptNo}.`);
            if (saved.warnings?.length) {
                this.showWarnings(saved.warnings);
            }
            this.router.navigate(['/app/sales', saved.sale.id], { replaceUrl: true });
        }
    }
}
