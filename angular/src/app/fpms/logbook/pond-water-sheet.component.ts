import { Component, OnInit } from '@angular/core';
import moment from 'moment-timezone';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime, newGuid } from '@shared/fpms/farm-time';
import { FormDrafts, OpsMemory } from '@shared/fpms/drafts';
import { FPMS_IMPORTS } from '../shared-imports';
import { optimalState } from '../production/water-quality';

/** The columns of the printed water quality sheet, in the same order (Printable log sheets). */
const SHEET_CODES = ['DO', 'TEMP', 'PH', 'SAL', 'TAN', 'NO2', 'NO3', 'ALK'];
const ROWS = 12;

interface Row {
    key: number;
    time: string;
    values: Record<string, string | number | null>;
    notes: string;
    clientRequestId: string;
}

/**
 * Water sheet, one pond (mockup "Operations: Water sheet, one pond"; D-23 paper-then-enter): the printed water
 * quality sheet of one pond is typed in row by row and saved together. Each row with a time and at least one value
 * becomes one water quality log (Log.Create), dated the sheet date at that time. Entry time never limits the date;
 * only the batch's own rules apply (not before stocking, not in the future). Unsaved rows are kept as a draft.
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Water sheet" subtitle="One pond, one printed sheet. Type each row of the sheet and save them together.">
            <a class="btn btn-default" [routerLink]="['/app/logbook/sheets']" [queryParams]="{ sheet: 'wq' }">Print log sheet</a>
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="d-flex flex-wrap align-items-center mb-3">
                    <span class="small text-muted mr-3">Layout</span>
                    <a class="btn btn-default mr-2" routerLink="/app/logbook/water">All ponds, one day</a>
                    <a class="btn btn-primary" routerLink="/app/logbook/water/pond" aria-current="page">One pond, many readings</a>
                </div>
                @if (loading) {
                    <fpms-loading></fpms-loading>
                } @else if (!batches.length) {
                    <fpms-empty text="No pond is stocked. Stock a batch first (Production → Create Batch)." icon="fas fa-tint"></fpms-empty>
                } @else {
                    <div class="card">
                        <div class="card-body pb-1">
                            <div class="form-row align-items-end">
                                <div class="form-group col-md-5">
                                    <label for="ws-batch">Pond (batch)</label>
                                    <select id="ws-batch" class="form-control" [(ngModel)]="batchId" (ngModelChange)="load()">
                                        @for (b of batches; track b.id) {
                                            <option [ngValue]="b.id">{{ batchLabel(b) }}</option>
                                        }
                                    </select>
                                </div>
                                <div class="form-group col-md-3">
                                    <label for="ws-date">Sheet date</label>
                                    <input id="ws-date" type="date" class="form-control" [(ngModel)]="sheetDate" (ngModelChange)="load()" [min]="batch?.stockingDate ?? ''" [max]="today" />
                                </div>
                                <div class="form-group col-md-4">
                                    <button type="button" class="btn btn-default mr-2" (click)="step(-1)" [disabled]="batches.length < 2">Previous pond</button>
                                    <button type="button" class="btn btn-default" (click)="step(1)" [disabled]="batches.length < 2">Next pond</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    @if (sheetDate && sheetDate < today) {
                        <div class="alert alert-warning" role="status">
                            You are entering {{ longDate(sheetDate) }}, {{ ago(sheetDate) }}. Each reading will show that it was recorded today.
                        </div>
                    }
                    @if (restoredAt) {
                        <div class="alert alert-info d-flex align-items-center" role="status">
                            <i class="fas fa-history mr-2"></i>
                            <span class="mr-auto">Your unsaved rows from {{ restoredAt | farmDateTime }} were restored.</span>
                            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="discard()">Discard them</button>
                        </div>
                    }
                    @if (savedCount !== null) {
                        <div class="alert alert-light border small" role="status">
                            {{ savedCount === 0 ? 'No readings are saved for this pond on this date yet.' : savedCount + ' reading' + (savedCount === 1 ? ' is' : 's are') + ' already saved for this pond on this date.' }}
                            @if (savedCount) {
                                <a [routerLink]="['/app/logbook']" [queryParams]="{ batchId: batchId, logType: 4, from: sheetDate, to: sheetDate }">See them in Logbooks</a>
                            }
                        </div>
                    }

                    <section class="card ws-sheet" aria-label="Water quality sheet">
                        <div class="ws-scroll">
                            <div class="ws-grid ws-head" [style.grid-template-columns]="gridColumns">
                                <div><div class="ws-l">Time</div><div class="ws-r">HH:mm</div></div>
                                @for (p of params; track p.code) {
                                    <div><div class="ws-l">{{ p.name }} ({{ p.unitCode }})</div><div class="ws-r">{{ p.optimalRange }}</div></div>
                                }
                                <div><div class="ws-l">Notes</div><div class="ws-r">&nbsp;</div></div>
                            </div>
                            @for (r of rows; track r.key; let i = $index) {
                                <div class="ws-grid" [style.grid-template-columns]="gridColumns">
                                    <div>
                                        <input type="time" class="form-control ws-in" [class.ws-bad]="timeProblem(r)" [(ngModel)]="r.time" (ngModelChange)="keep()" [attr.aria-label]="'Row ' + (i + 1) + ' time'" />
                                        @if (timeProblem(r); as t) { <div class="ws-side ws-side-bad">{{ t }}</div> }
                                    </div>
                                    @for (p of params; track p.code) {
                                        @let st = state(p, r);
                                        <div>
                                            <input type="number" step="any" inputmode="decimal" class="form-control ws-in text-center" [class.ws-out]="st === 'out'" [class.ws-bad]="st === 'invalid'"
                                                [(ngModel)]="r.values[p.code]" (ngModelChange)="keep()" [attr.aria-label]="'Row ' + (i + 1) + ' ' + p.name" [min]="p.physicalMin" [max]="p.physicalMax" />
                                            @if (st === 'out') { <div class="ws-side">{{ side(p, r) }}</div> }
                                            @if (st === 'invalid') { <div class="ws-side ws-side-bad">Not possible</div> }
                                        </div>
                                    }
                                    <div>
                                        <input type="text" class="form-control ws-in" maxlength="500" [(ngModel)]="r.notes" (ngModelChange)="keep()" [attr.aria-label]="'Row ' + (i + 1) + ' notes'" />
                                    </div>
                                </div>
                            }
                        </div>
                        <div class="ws-foot">
                            <div class="ws-help">
                                <strong>{{ ready().length }} reading{{ ready().length === 1 ? '' : 's' }} ready to save.</strong>
                                Each row with a time and at least one value becomes one reading. Empty rows are ignored. Unsaved entries are kept as a draft on this computer.
                            </div>
                            <button type="button" class="btn btn-default" (click)="addRows()">Add rows</button>
                            <button type="button" class="btn btn-default" (click)="discard()" [disabled]="!hasInput()">Discard</button>
                            @if (canCreate) {
                                <button type="button" class="btn btn-primary" (click)="save()" [disabled]="busy() || !ready().length || hasProblems()">
                                    @if (busy()) { <i class="fas fa-spinner fa-spin mr-1"></i> }
                                    Save {{ ready().length || '' }} reading{{ ready().length === 1 ? '' : 's' }}
                                </button>
                            }
                        </div>
                    </section>
                    @if (hasProblems()) {
                        <p class="small text-danger">Fix the marked cells before saving: every row with values needs a time, and values must be physically possible.</p>
                    }
                }
            </div>
        </section>
    `,
    styles: [
        `
            .ws-sheet {
                overflow: hidden;
            }
            .ws-scroll {
                overflow-x: auto;
            }
            .ws-grid {
                display: grid;
                gap: 8px;
                min-width: 1000px;
                padding: 8px 16px;
                border-bottom: 1px solid #e6eceb;
                align-items: start;
            }
            .ws-head {
                padding: 12px 16px;
                align-items: end;
                text-align: center;
            }
            .ws-l {
                font-size: 13px;
                font-weight: 600;
                line-height: 1.3;
            }
            .ws-r {
                font-size: 12px;
                color: #596872;
            }
            .ws-in {
                min-height: 40px;
                font-weight: 600;
            }
            .ws-out {
                background: #fff0d2;
                border-color: #e3c27a;
                color: #6b4200;
            }
            .ws-bad {
                border-color: #b33a3a;
            }
            .ws-side {
                text-align: center;
                font-size: 12px;
                font-weight: 600;
                color: #6b4200;
                margin-top: 2px;
            }
            .ws-side-bad {
                color: #b33a3a;
            }
            .ws-foot {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 10px 16px;
                padding: 14px 20px;
                background: #f6f8f7;
                border-top: 1px solid #dce4e3;
            }
            .ws-help {
                flex: 1 1 300px;
                font-size: 13px;
                color: #596872;
            }
            .ws-help strong {
                color: #232d36;
            }
        `,
    ],
})
export class PondWaterSheetComponent extends FpmsPage implements OnInit {
    protected override keepsDrafts = true;
    loading = true;
    batches: any[] = [];
    params: any[] = [];
    batchId: string | null = null;
    sheetDate = FarmTime.today();
    rows: Row[] = [];
    restoredAt: string | null = null;
    savedCount: number | null = null;
    private rowKey = 0;

    get canCreate(): boolean {
        return this.can('Farm.Logs.Create');
    }

    get batch(): any {
        return this.batches.find((b) => b.id === this.batchId) ?? null;
    }

    get gridColumns(): string {
        return `96px repeat(${this.params.length}, minmax(0, 1fr)) minmax(0, 1.6fr)`;
    }

    async ngOnInit(): Promise<void> {
        FormDrafts.purgeExpired();
        const [batches, params] = await Promise.all([this.api.get<any[]>('Batch', 'GetAll', { openOnly: true }), this.api.get<any[]>('Log', 'GetParameters')]);
        // Water readings belong to a stocked pond; sorted by pond, as on the farm.
        this.batches = batches.filter((b) => b.stockingDate).sort((a, b) => String(a.pondCode).localeCompare(String(b.pondCode), undefined, { numeric: true }));
        const active = params.filter((p) => p.isActive !== false);
        this.params = [
            ...SHEET_CODES.map((c) => active.find((p) => p.code === c)).filter((p) => !!p),
            ...active.filter((p) => !SHEET_CODES.includes(p.code)),
        ];
        const wanted = this.query('batchId') ?? OpsMemory.get().batchId ?? null;
        this.batchId = this.batches.find((b) => b.id === wanted)?.id ?? this.batches[0]?.id ?? null;
        const date = this.query('date');
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= this.today) {
            this.sheetDate = date;
        }
        await this.load();
    }

    private get draftKey(): string {
        return `water.${this.batchId}.${this.sheetDate}`;
    }

    batchLabel(b: any): string {
        return `${b.pondCode} · ${b.letter ? 'Batch ' + b.letter : b.batchCode}`;
    }

    async load(): Promise<void> {
        this.restoredAt = null;
        this.savedCount = null;
        this.rows = Array.from({ length: ROWS }, () => this.newRow());
        if (!this.batchId || !this.sheetDate) {
            this.loading = false;
            return;
        }
        OpsMemory.set({ ...OpsMemory.get(), batchId: this.batchId, cycleId: this.batch?.cycleId ?? OpsMemory.get().cycleId });
        const draft = FormDrafts.load<Row[]>(this.draftKey);
        if (draft?.data?.length) {
            const restored = draft.data.map((r) => ({ ...this.newRow(), ...r, key: ++this.rowKey }));
            this.rows = [...restored, ...Array.from({ length: Math.max(0, ROWS - restored.length) }, () => this.newRow())];
            this.restoredAt = new Date(draft.savedAt).toISOString();
        }
        this.loading = false;
        await this.countSaved();
    }

    private async countSaved(): Promise<void> {
        const page = await this.api.get<any>('Log', 'GetList', { batchId: this.batchId, logType: 4, from: this.sheetDate, to: this.sheetDate, maxResultCount: 1 });
        this.savedCount = page?.totalCount ?? null;
    }

    step(dir: number): void {
        const i = this.batches.findIndex((b) => b.id === this.batchId);
        this.batchId = this.batches[(i + dir + this.batches.length) % this.batches.length].id;
        this.load();
    }

    private newRow(): Row {
        return { key: ++this.rowKey, time: '', values: {}, notes: '', clientRequestId: newGuid() };
    }

    addRows(): void {
        this.rows = [...this.rows, ...Array.from({ length: 6 }, () => this.newRow())];
    }

    // ---------------------------------------------------------------- checks

    private filled(r: Row): any[] {
        return this.params.filter((p) => optimalState(p, r.values[p.code]) !== 'empty');
    }

    state(p: any, r: Row): 'empty' | 'ok' | 'out' | 'invalid' {
        return optimalState(p, r.values[p.code]);
    }

    side(p: any, r: Row): string {
        const v = Number(r.values[p.code]);
        return p.optimalMin !== null && p.optimalMin !== undefined && v <= p.optimalMin ? 'Low' : 'High';
    }

    timeProblem(r: Row): string | null {
        if (!r.time) {
            return this.filled(r).length || r.notes.trim() ? 'Time needed' : null;
        }
        if (this.sheetDate === this.today && r.time > moment().tz(FarmTime.zone).format('HH:mm')) {
            return 'Later than now';
        }
        return null;
    }

    hasInput(): boolean {
        return this.rows.some((r) => r.time || r.notes.trim() || this.filled(r).length);
    }

    ready(): Row[] {
        return this.rows.filter((r) => r.time && this.filled(r).length);
    }

    hasProblems(): boolean {
        return this.rows.some((r) => !!this.timeProblem(r) || this.params.some((p) => this.state(p, r) === 'invalid'));
    }

    // ---------------------------------------------------------------- save

    async save(): Promise<void> {
        const rows = this.ready().sort((a, b) => a.time.localeCompare(b.time));
        let saved = 0;
        let flagged = 0;
        for (const r of rows) {
            const body = {
                batchId: this.batchId,
                logType: 4,
                observedAt: FarmTime.fromLocalInput(`${this.sheetDate}T${r.time}`),
                notes: r.notes.trim(),
                clientRequestId: r.clientRequestId,
                readings: this.filled(r).map((p) => ({ parameterCode: p.code, value: Number(r.values[p.code]) })),
            };
            let res: any;
            if (!(await this.act(async () => (res = await this.api.post<any>('Log', 'Create', body))))) {
                break;
            }
            saved++;
            if (res?.log?.hasOutOfRange) {
                flagged++;
            }
            this.rows = this.rows.filter((x) => x !== r);
            this.keep();
        }
        if (saved) {
            this.notifySaved(`Saved ${saved} reading${saved === 1 ? '' : 's'}${flagged ? `, ${flagged} with out-of-range values` : ''}.`);
        }
        if (this.rows.length < ROWS) {
            this.rows = [...this.rows, ...Array.from({ length: ROWS - this.rows.length }, () => this.newRow())];
        }
        this.restoredAt = null;
        await this.countSaved();
    }

    // ---------------------------------------------------------------- drafts (AC-25)

    keep(): void {
        const used = this.rows.filter((r) => r.time || r.notes.trim() || this.filled(r).length);
        if (used.length) {
            FormDrafts.save(this.draftKey, used);
        } else {
            FormDrafts.clear(this.draftKey);
        }
    }

    async discard(): Promise<void> {
        if (this.hasInput() && !(await this.confirm('Discard the rows you typed on this sheet?', 'Discard?'))) {
            return;
        }
        FormDrafts.clear(this.draftKey);
        this.rows = Array.from({ length: ROWS }, () => this.newRow());
        this.restoredAt = null;
    }

    // ---------------------------------------------------------------- text

    longDate(d: string): string {
        return moment(d, 'YYYY-MM-DD').format(`dddd, ${FarmTime.dateFormat}`);
    }

    ago(d: string): string {
        const n = moment(this.today, 'YYYY-MM-DD').diff(moment(d, 'YYYY-MM-DD'), 'days');
        return n === 1 ? 'one day ago' : `${n} days ago`;
    }
}
