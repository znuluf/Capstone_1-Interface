import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { pondSystemWarning } from '@shared/fpms/labels';
import { FarmTime, newGuid } from '@shared/fpms/farm-time';
import { FormDrafts } from '@shared/fpms/drafts';
import { FPMS_IMPORTS } from '../shared-imports';

/** Pond detail: Table 3 master data (Ref 4.1), status and history (Ref 4.2). */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [narrow]="true" [title]="isNew ? 'New pond' : 'Pond ' + (pond?.pondCode ?? '')" [subtitle]="isNew ? 'Add a pond to this farm. The code is made from the prefix and number.' : 'Pond master data, preparation rounds and status.'" backLink="/app/ponds" backLabel="Ponds">
            @if (pond && !isNew) {
                <fpms-badge [text]="pond.status | label: L.PondDisplayStatuses"></fpms-badge>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid fpms-narrow">
                @if (!pond) {
                    <fpms-loading></fpms-loading>
                } @else {
                    <div class="row">
                        <div class="col-xl-8">
                            <form #f="ngForm" (ngSubmit)="save()" novalidate>
                                <fieldset [disabled]="!canManage">
                                    <div class="card">
                                        <div class="card-header"><h3 class="card-title"><i class="fas fa-water" aria-hidden="true"></i>Pond master data</h3></div>
                                        <div class="card-body">
                                            <div class="form-row">
                                                @if (isNew) {
                                                    <div class="form-group col-md-4">
                                                        <label for="prefix">Name prefix <span class="text-danger">*</span></label>
                                                        <select id="prefix" class="form-control" name="prefixId" [(ngModel)]="pond.prefixId" (ngModelChange)="onPrefixChange()" required>
                                                            @for (x of activePrefixes; track x.id) {
                                                                <option [ngValue]="x.id">{{ x.name }} ({{ x.shortCode }})</option>
                                                            }
                                                        </select>
                                                        <small class="form-text text-muted"><a routerLink="/app/ponds/prefixes">Manage prefixes</a></small>
                                                    </div>
                                                    <div class="form-group col-md-2">
                                                        <label for="num">Number</label>
                                                        <input id="num" type="number" min="1" max="999" step="1" class="form-control" name="number" [(ngModel)]="pond.number" [placeholder]="selectedPrefix?.nextNumber ?? ''" />
                                                    </div>
                                                    <div class="form-group col-md-2">
                                                        <label>Pond ID</label>
                                                        <p class="form-control-plaintext font-weight-bold" aria-live="polite">{{ previewCode || '—' }}</p>
                                                    </div>
                                                } @else {
                                                    <div class="form-group col-md-3">
                                                        <label>Pond ID</label>
                                                        <p class="form-control-plaintext font-weight-bold">{{ pond.pondCode }}</p>
                                                    </div>
                                                    <div class="form-group col-md-5">
                                                        <label>Name</label>
                                                        <p class="form-control-plaintext">{{ pond.name }}</p>
                                                    </div>
                                                }
                                                <div class="form-group col-md-4">
                                                    <label for="purpose">Purpose <span class="text-danger">*</span></label>
                                                    <select id="purpose" class="form-control" name="purpose" [(ngModel)]="pond.purpose">
                                                        @for (o of Options.pondPurpose; track o.value) {
                                                            <option [ngValue]="o.value">{{ o.label }}</option>
                                                        }
                                                    </select>
                                                    <small class="form-text text-muted">Batches are stocked only in grow-out ponds.</small>
                                                </div>
                                            </div>
                                            <div class="form-row">
                                                <div class="form-group col-md-4">
                                                    <label for="area">Area <span class="text-danger">*</span></label>
                                                    <div class="input-group">
                                                        <input id="area" type="number" min="0.01" step="0.01" class="form-control" name="areaM2" [(ngModel)]="pond.areaM2" required />
                                                        <div class="input-group-append"><span class="input-group-text">m²</span></div>
                                                    </div>
                                                </div>
                                                <div class="form-group col-md-4">
                                                    <label for="avg">Average depth <span class="text-danger">*</span></label>
                                                    <div class="input-group">
                                                        <input id="avg" type="number" min="0.01" max="100" step="0.01" class="form-control" name="averageDepthM" [(ngModel)]="pond.averageDepthM" required />
                                                        <div class="input-group-append"><span class="input-group-text">m</span></div>
                                                    </div>
                                                </div>
                                                <div class="form-group col-md-4">
                                                    <label for="max">Maximum depth <span class="text-danger">*</span></label>
                                                    <div class="input-group">
                                                        <input id="max" type="number" min="0.01" max="100" step="0.01" class="form-control" name="maxDepthM" [(ngModel)]="pond.maxDepthM" required />
                                                        <div class="input-group-append"><span class="input-group-text">m</span></div>
                                                    </div>
                                                    @if (depthError) {
                                                        <small class="text-danger">Maximum depth cannot be less than average depth.</small>
                                                    }
                                                </div>
                                            </div>
                                            <div class="form-row">
                                                <div class="form-group col-md-4">
                                                    <label for="ctype">Construction (pond type)</label>
                                                    <select id="ctype" class="form-control" name="constructionType" [(ngModel)]="pond.constructionType">
                                                        @for (o of Options.construction; track o.value) {
                                                            <option [ngValue]="o.value">{{ o.label }}</option>
                                                        }
                                                    </select>
                                                </div>
                                                <div class="form-group col-md-4">
                                                    <label for="fs">Farming system</label>
                                                    <select id="fs" class="form-control" name="farmingSystemOverride" [(ngModel)]="pond.farmingSystemOverride">
                                                        <option [ngValue]="null">Farm setting ({{ farmSystem | label: L.FarmingSystems }})</option>
                                                        @for (o of Options.farmingSystem; track o.value) {
                                                            <option [ngValue]="o.value">{{ o.label }}</option>
                                                        }
                                                    </select>
                                                </div>
                                            </div>
                                            @if (systemWarning) {
                                                <div class="alert alert-warning py-2 small" role="status">
                                                    <i class="fas fa-exclamation-triangle mr-1"></i>{{ systemWarning }} You can still save the pond.
                                                </div>
                                            }
                                            <div class="form-row">
                                                <div class="form-group col-md-4">
                                                    <label for="inlet">Inlet type</label>
                                                    <input id="inlet" class="form-control" name="inletType" [(ngModel)]="pond.inletType" maxlength="100" placeholder="e.g. PVC pipe with screen" />
                                                </div>
                                                <div class="form-group col-md-4">
                                                    <label for="outlet">Outlet type</label>
                                                    <input id="outlet" class="form-control" name="outletType" [(ngModel)]="pond.outletType" maxlength="100" placeholder="e.g. Monk / central drain" />
                                                </div>
                                                <div class="form-group col-md-4">
                                                    <label for="aer">Aeration system</label>
                                                    <input id="aer" class="form-control" name="aerationSystem" [(ngModel)]="pond.aerationSystem" maxlength="300" placeholder="Type, count, horsepower" />
                                                </div>
                                            </div>
                                            <div class="form-row">
                                                <div class="form-group col-md-3">
                                                    <label for="lat">Latitude</label>
                                                    <input id="lat" type="number" step="0.000001" min="-90" max="90" class="form-control" name="latitude" [(ngModel)]="pond.latitude" />
                                                </div>
                                                <div class="form-group col-md-3">
                                                    <label for="lng">Longitude</label>
                                                    <input id="lng" type="number" step="0.000001" min="-180" max="180" class="form-control" name="longitude" [(ngModel)]="pond.longitude" />
                                                </div>
                                            </div>
                                            <div class="form-group">
                                                <label for="notes">Notes</label>
                                                <textarea id="notes" rows="2" class="form-control" name="notes" [(ngModel)]="pond.notes" maxlength="1000"></textarea>
                                            </div>
                                            @if (!isNew) {
                                                <div class="form-group mb-0">
                                                    <label for="cn">Change note (optional)</label>
                                                    <input id="cn" class="form-control" name="changeNote" [(ngModel)]="pond.changeNote" maxlength="500" placeholder="Why the infrastructure changed, e.g. added 2 paddlewheels" />
                                                    <small class="form-text text-muted">Changes are added to the pond history.</small>
                                                </div>
                                            }
                                        </div>
                                        @if (canManage) {
                                            <div class="card-footer">
                                                <button type="submit" class="btn btn-primary mr-2" [disabled]="busy() || !f.form.valid || depthError">Save pond</button>
                                                <a routerLink="/app/ponds" class="btn btn-default">Cancel</a>
                                                <fpms-form-hint [form]="f"></fpms-form-hint>
                                            </div>
                                        }
                                    </div>
                                </fieldset>
                            </form>
                        </div>
                        @if (!isNew) {
                            <div class="col-xl-4">
                                <div class="card" [class.card-outline]="pond.openRound" [class.card-info]="pond.openRound">
                                    <div class="card-header"><h3 class="card-title"><i class="fas fa-broom" aria-hidden="true"></i>Preparation</h3></div>
                                    <div class="card-body">
                                        @if (pond.openRound) {
                                            <p class="small mb-2">
                                                Started {{ pond.openRound.startedAtUtc | farmDateTime }}.
                                                @if (pond.openRound.preparedAtUtc) {
                                                    <strong>Prepared</strong> {{ pond.openRound.preparedAtUtc | farmDateTime }} by {{ pond.openRound.preparedBy }}; ready for Create Batch (Stocking).
                                                } @else {
                                                    In progress.
                                                }
                                            </p>
                                            <ul class="list-unstyled small mb-2">
                                                @for (e of pond.openRound.entries; track e.id) {
                                                    <li class="border-bottom py-1"><span class="text-muted">{{ e.observedAtUtc | farmDateTime }} · {{ e.recordedBy }}</span><br />{{ e.description }}</li>
                                                }
                                            </ul>
                                        } @else {
                                            <p class="small text-muted">No preparation in progress. The first entry starts a preparation round and the pond becomes Under preparation.</p>
                                        }
                                        @if (pond.canAddPreparationEntry) {
                                            @if (prepRestored) {
                                                <div class="small text-info mb-1"><i class="fas fa-history mr-1"></i>Your unsaved entry was restored. <a href="javascript:;" (click)="discardPrep()">Discard</a></div>
                                            }
                                            <div class="form-group mb-2">
                                                <label for="pt" class="small mb-0">Date and time</label>
                                                <input id="pt" type="datetime-local" class="form-control form-control-sm" [(ngModel)]="prep.observedAt" (ngModelChange)="keepPrepDraft()" [max]="nowInput" />
                                            </div>
                                            <div class="form-group mb-2">
                                                <label for="pdx" class="small mb-0">What was done</label>
                                                <textarea id="pdx" rows="2" class="form-control form-control-sm" [(ngModel)]="prep.description" (ngModelChange)="keepPrepDraft()" maxlength="1000" placeholder="e.g. Drained pond, drying started"></textarea>
                                            </div>
                                            <button class="btn btn-sm btn-outline-primary mr-1" [disabled]="busy() || !prep.description?.trim() || !prep.observedAt" (click)="addPrep()">Add entry</button>
                                        }
                                        @if (pond.canMarkPrepared) {
                                            <button class="btn btn-sm btn-primary" [disabled]="busy()" (click)="markPrepared()"><i class="fas fa-check mr-1"></i>Mark Prepared</button>
                                        }
                                        @if (pond.pastRounds.length) {
                                            <details class="mt-2 small">
                                                <summary>Earlier rounds ({{ pond.pastRounds.length }})</summary>
                                                @for (r of pond.pastRounds; track r.id) {
                                                    <div class="mt-1"><strong>{{ r.startedAtUtc | farmDayOf }}</strong>{{ r.usedByBatchCode ? ' → batch ' + r.usedByBatchCode : '' }}</div>
                                                    <ul class="mb-1">
                                                        @for (e of r.entries; track e.id) {
                                                            <li>{{ e.observedAtUtc | farmDayOf }}: {{ e.description }}</li>
                                                        }
                                                    </ul>
                                                }
                                            </details>
                                        }
                                    </div>
                                </div>
                                <div class="card">
                                    <div class="card-header"><h3 class="card-title"><i class="fas fa-flag" aria-hidden="true"></i>Status</h3></div>
                                    <div class="card-body">
                                        <p class="mb-2">
                                            Displayed status: <fpms-badge [text]="pond.status | label: L.PondDisplayStatuses"></fpms-badge>
                                            @if (pond.currentBatchId) {
                                                <br />Open batch: <a [routerLink]="['/app/production/batches', pond.currentBatchId]">{{ pond.currentBatchCode }}</a>
                                            }
                                        </p>
                                        @if (canManage) {
                                            <div class="form-group mb-2">
                                                <label for="ms">Manual status</label>
                                                <select id="ms" class="form-control" [(ngModel)]="newStatus">
                                                    @for (o of Options.pondManualStatus; track o.value) {
                                                        <option [ngValue]="o.value">{{ o.label }}</option>
                                                    }
                                                </select>
                                            </div>
                                            <div class="form-group mb-2">
                                                <label for="sn">Note</label>
                                                <input id="sn" class="form-control" [(ngModel)]="statusNote" maxlength="500" />
                                            </div>
                                            <button class="btn btn-outline-primary btn-sm" [disabled]="busy() || newStatus === pond.manualStatus" (click)="setStatus()">Change status</button>
                                        }
                                    </div>
                                </div>
                                <div class="card">
                                    <div class="card-header"><h3 class="card-title"><i class="fas fa-layer-group" aria-hidden="true"></i>Batches</h3></div>
                                    <div class="card-body p-0">
                                        <div class="table-responsive">
                                        <table class="table table-sm mb-0">
                                            <tbody>
                                                @for (b of pond.batches; track b.id) {
                                                    <tr>
                                                        <td><a [routerLink]="['/app/production/batches', b.id]">{{ b.batchCode }}</a></td>
                                                        <td class="small text-muted">{{ b.cycleCode }}</td>
                                                        <td><fpms-badge [text]="b.status | label: L.BatchStatuses"></fpms-badge></td>
                                                        <td class="text-nowrap small">{{ b.stockingDate | farmDate }}</td>
                                                    </tr>
                                                } @empty {
                                                    <tr><td class="text-muted text-center py-3">No batches yet.</td></tr>
                                                }
                                            </tbody>
                                        </table>
                                        </div>
                                    </div>
                                </div>
                                <div class="card">
                                    <div class="card-header"><h3 class="card-title"><i class="fas fa-history" aria-hidden="true"></i>History</h3></div>
                                    <div class="card-body p-0">
                                        <ul class="list-group list-group-flush">
                                            @for (h of pond.history; track $index) {
                                                <li class="list-group-item py-2">
                                                    <div class="small text-muted">{{ h.changeDateUtc | farmDateTime }} · {{ h.changeType | label: L.PondChangeTypes }} · {{ h.recordedBy }}</div>
                                                    <div>{{ h.description }}</div>
                                                </li>
                                            }
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        }
                    </div>
                }
            </div>
        </section>
    `,
})
export class PondDetailComponent extends FpmsPage implements OnInit {
    /** Unsaved entries are kept as a browser draft, so leaving never needs to ask. */
    protected override keepsDrafts = true;
    pond: any = null;
    isNew = false;
    newStatus = 1;
    statusNote = '';

    get canManage(): boolean {
        return this.can('Farm.Ponds.Manage');
    }

    prefixes: any[] = [];
    farmSystem = 2;
    prep: any = this.newPrep();
    prepRestored = false;
    readonly nowInput = FarmTime.nowInput();

    get activePrefixes(): any[] {
        return this.prefixes.filter((x) => x.isActive);
    }

    get selectedPrefix(): any {
        return this.prefixes.find((x) => x.id === this.pond?.prefixId);
    }

    /** Same pattern as the API: short code plus a two-digit number. */
    get previewCode(): string {
        const p = this.selectedPrefix;
        const n = this.pond?.number || p?.nextNumber;
        return p && n ? `${p.shortCode}-${String(n).padStart(2, '0')}` : '';
    }

    get systemWarning(): string | null {
        const system = this.pond?.farmingSystemOverride ?? this.farmSystem;
        return this.pond ? pondSystemWarning(Number(this.pond.constructionType), Number(system)) : null;
    }

    onPrefixChange(): void {
        this.pond.number = null;
    }

    get depthError(): boolean {
        return this.pond?.maxDepthM != null && this.pond?.averageDepthM != null && Number(this.pond.maxDepthM) < Number(this.pond.averageDepthM);
    }

    ngOnInit(): void {
        // Detail routes reuse this component when only the :id changes, so reload on every change.
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        const id = this.param('id');
        this.isNew = !id;
        if (this.isNew) {
            const [prefixes, profile] = await Promise.all([this.api.get<any[]>('Pond', 'GetPrefixes'), this.api.get<any>('FarmProfile', 'Get')]);
            this.prefixes = prefixes;
            this.farmSystem = profile.farmingSystem;
            this.pond = {
                id: '00000000-0000-0000-0000-000000000000',
                prefixId: this.activePrefixes[0]?.id ?? null,
                number: null,
                areaM2: null,
                averageDepthM: null,
                maxDepthM: null,
                purpose: 1,
                constructionType: 1,
                farmingSystemOverride: null,
                inletType: '',
                outletType: '',
                aerationSystem: '',
                notes: '',
            };
        } else {
            this.load(id);
        }
    }

    async load(id: string): Promise<void> {
        this.pond = await this.api.get<any>('Pond', 'Get', { id });
        this.setPageTitle(this.pond ? `Pond ${this.pond.pondCode}` : null);
        this.farmSystem = this.pond.farmFarmingSystem;
        const draft = FormDrafts.load<any>(this.prepDraftKey);
        this.prep = draft ? { ...this.newPrep(), ...draft.data } : this.newPrep();
        this.prepRestored = !!draft;
        this.newStatus = this.pond.manualStatus;
        this.statusNote = '';
    }

    async save(): Promise<void> {
        if (this.isNew) {
            let id: string;
            if (await this.act(async () => (id = await this.api.post<string>('Pond', 'Create', this.pond)))) {
                this.notifySaved('Pond created. Status: Available.');
                this.router.navigate(['/app/ponds', id], { replaceUrl: true });
            }
        } else if (await this.act(() => this.api.put('Pond', 'Update', this.pond))) {
            this.notifySaved('Pond saved.');
            this.load(this.pond.id);
        }
    }

    private newPrep(): any {
        return { observedAt: FarmTime.nowInput(), description: '', clientRequestId: newGuid() };
    }

    private get prepDraftKey(): string {
        return `prep.${this.pond?.id}`;
    }

    /** Per-user draft of the preparation entry (AC-25); deleted on save or discard. */
    keepPrepDraft(): void {
        if (this.pond?.id && this.prep.description?.trim()) {
            FormDrafts.save(this.prepDraftKey, this.prep);
        }
    }

    discardPrep(): void {
        FormDrafts.clear(this.prepDraftKey);
        this.prep = this.newPrep();
        this.prepRestored = false;
    }

    async addPrep(): Promise<void> {
        const body = { pondId: this.pond.id, observedAt: FarmTime.fromLocalInput(this.prep.observedAt), description: this.prep.description, clientRequestId: this.prep.clientRequestId };
        if (await this.act(() => this.api.post('Pond', 'AddPreparationEntry', body))) {
            FormDrafts.clear(this.prepDraftKey);
            this.notifySaved('Preparation entry added.');
            this.load(this.pond.id);
        }
    }

    async markPrepared(): Promise<void> {
        if (!(await this.confirm(`Pond ${this.pond.pondCode} will show as Prepared and can be chosen in Create Batch (Stocking).`, 'Mark Prepared?'))) {
            return;
        }
        if (await this.act(() => this.api.post('Pond', 'MarkPrepared', { id: this.pond.id }))) {
            this.notifySaved('Pond marked Prepared.');
            this.load(this.pond.id);
        }
    }

    async setStatus(): Promise<void> {
        if (await this.act(() => this.api.post('Pond', 'SetManualStatus', { id: this.pond.id, manualStatus: this.newStatus, note: this.statusNote }))) {
            this.notifySaved('Status changed.');
            this.load(this.pond.id);
        }
    }
}
