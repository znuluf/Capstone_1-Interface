import { Component, OnInit } from '@angular/core';
import moment from 'moment-timezone';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime, newGuid } from '@shared/fpms/farm-time';
import { FormDrafts } from '@shared/fpms/drafts';
import { FPMS_IMPORTS } from '../shared-imports';
import { optimalState } from '../production/water-quality';

/** One column of the sheet: a parameter and the half of the day it is read in (salinity is read once a day). */
interface Col {
    key: string;
    code: string;
    half: 'AM' | 'PM';
    label: string;
}

/** The sheet's columns, in the order of the printed sheet. */
const COLUMNS: { code: string; halves: ('AM' | 'PM')[]; name: string }[] = [
    { code: 'DO', halves: ['AM', 'PM'], name: 'Dissolved oxygen' },
    { code: 'TEMP', halves: ['AM', 'PM'], name: 'Temperature' },
    { code: 'PH', halves: ['AM', 'PM'], name: 'pH' },
    { code: 'SAL', halves: ['AM'], name: 'Salinity' },
];

/** AM readings are saved at 6:00 AM and PM readings at 4:00 PM, unless that is later than now. */
const DEFAULT_TIME = { AM: '06:00', PM: '16:00' };

/**
 * Water sheet, all ponds on one day (mockup "Operations: Water sheet"; D-23 paper-then-enter): one row per stocked
 * pond, laid out like the paper sheet: dissolved oxygen, temperature and pH morning and afternoon, and salinity.
 * Each pond and half of the day with typed values is saved as one water quality log (Log.Create). Readings that are
 * already saved show as locked and are corrected in Logbooks. A reading is AM when its farm time is before noon.
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Water sheet" subtitle="Water readings for every stocked pond on one day, laid out like the paper sheet.">
            <a class="btn btn-default" [routerLink]="['/app/logbook/sheets']" [queryParams]="{ sheet: 'wq' }">Print log sheet</a>
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="d-flex flex-wrap align-items-center mb-3">
                    <span class="small text-muted mr-3">Layout</span>
                    <a class="btn btn-primary mr-2" routerLink="/app/logbook/water" aria-current="page">All ponds, one day</a>
                    <a class="btn btn-default" routerLink="/app/logbook/water/pond">One pond, many readings</a>
                </div>

                <div class="card">
                    <div class="card-body pb-1">
                        <div class="form-row align-items-end">
                            <div class="form-group col-md-5">
                                <label for="ws-pond">Ponds</label>
                                <select id="ws-pond" class="form-control" [(ngModel)]="pondFilter">
                                    <option [ngValue]="null">All stocked ponds</option>
                                    @for (b of allBatches; track b.id) {
                                        <option [ngValue]="b.id">{{ label(b) }}</option>
                                    }
                                </select>
                            </div>
                            <div class="form-group col-md-3">
                                <label for="ws-date">Reading date</label>
                                <input id="ws-date" type="date" class="form-control" [(ngModel)]="date" (ngModelChange)="load()" [max]="today" />
                            </div>
                            <div class="form-group col-md-4">
                                <button type="button" class="btn btn-default mr-2" (click)="shiftDay(-1)">Previous day</button>
                                <button type="button" class="btn btn-default" (click)="date = today; load()" [disabled]="date === today">Today</button>
                            </div>
                        </div>
                    </div>
                </div>

                @if (date < today) {
                    <div class="alert alert-warning" role="status">
                        You are entering {{ longDate(date) }}, {{ ago(date) }}. Each reading will show that it was recorded today.
                    </div>
                }
                @if (restoredAt) {
                    <div class="alert alert-info d-flex align-items-center" role="status">
                        <i class="fas fa-history mr-2"></i>
                        <span class="mr-auto">Your unsaved readings from {{ restoredAt | farmDateTime }} were restored.</span>
                        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="discard(true)">Discard them</button>
                    </div>
                }

                @if (loading) {
                    <fpms-loading></fpms-loading>
                } @else if (!shown.length) {
                    <fpms-empty text="No pond is stocked on this date." icon="fas fa-tint"></fpms-empty>
                } @else {
                    <div class="d-flex flex-wrap mb-3 ws-chips">
                        <span class="ws-chip ws-ok">{{ completeCount }} of {{ shown.length }} pond{{ shown.length === 1 ? '' : 's' }} complete</span>
                        <span class="ws-chip ws-todo">{{ toEnter }} reading{{ toEnter === 1 ? '' : 's' }} still to enter</span>
                        <span class="ws-chip ws-out">{{ outCount }} reading{{ outCount === 1 ? '' : 's' }} out of range</span>
                    </div>

                    <section class="card ws-sheet" aria-label="Water sheet">
                        <div class="ws-scroll">
                            <div class="ws-grid ws-head" [style.grid-template-columns]="gridColumns">
                                <div class="ws-r text-left">Pond and batch</div>
                                @for (c of cols; track c.key) {
                                    <div><div class="ws-l">{{ c.label }}</div><div class="ws-r">{{ rangeOf(c) }}</div></div>
                                }
                                <div class="ws-r text-right">Row status</div>
                            </div>
                            @for (b of shown; track b.id) {
                                <div class="ws-grid" [style.grid-template-columns]="gridColumns">
                                    <div class="ws-pond">
                                        <a [routerLink]="['/app/production/batches', b.id]" class="font-weight-bold">{{ label(b) }}</a>
                                        <div class="ws-r text-left">DOC {{ docOf(b) }}</div>
                                    </div>
                                    @for (c of cols; track c.key) {
                                        @let v = valueOf(b, c);
                                        @let st = stateOf(b, c);
                                        <div>
                                            @if (savedOf(b, c) !== null) {
                                                <input type="text" class="form-control ws-in text-center ws-saved" [class.ws-out-cell]="st === 'out'" [value]="savedOf(b, c)" readonly
                                                    [attr.aria-label]="label(b) + ' ' + c.label + ' (saved)'" title="Saved. Correct it in Logbooks." />
                                            } @else {
                                                <input type="text" inputmode="decimal" class="form-control ws-in text-center" [class.ws-out-cell]="st === 'out'" [class.ws-bad]="st === 'invalid'" [class.ws-empty]="v === ''"
                                                    [(ngModel)]="cells[b.id][c.key]" (ngModelChange)="keep()" [disabled]="!canCreate || pmLocked(c)"
                                                    [attr.aria-label]="label(b) + ' ' + c.label" [attr.title]="pmLocked(c) ? 'Afternoon readings can be entered from noon.' : null" />
                                            }
                                            @if (st === 'out') { <div class="ws-side">{{ sideOf(b, c) }}</div> }
                                            @if (st === 'invalid') { <div class="ws-side ws-side-bad">Not possible</div> }
                                        </div>
                                    }
                                    <div class="text-right ws-status">
                                        @let n = missing(b);
                                        <span class="badge" [class.badge-success]="!n" [class.badge-info]="n">{{ n ? n + ' to enter' : 'Complete' }}</span>
                                    </div>
                                </div>
                            }
                        </div>
                        <div class="ws-foot">
                            <div class="ws-help">
                                <strong>Tab moves to the next box.</strong>
                                Readings outside the farm's range are marked and show their recommendation after saving. Unsaved entries are kept as a draft on this computer.
                                AM readings are saved at 6:00 AM and PM readings at 4:00 PM; to record an exact time, use <a routerLink="/app/logbook/water/pond">One pond, many readings</a>.
                            </div>
                            @if (canCreate) {
                                <button type="button" class="btn btn-default" (click)="discard(false)" [disabled]="!pendingCount">Discard</button>
                                <button type="button" class="btn btn-primary" (click)="save()" [disabled]="busy() || !pendingCount || hasProblems()">
                                    @if (busy()) { <i class="fas fa-spinner fa-spin mr-1"></i> }
                                    Save sheet{{ pendingCount ? ' (' + pendingCount + ')' : '' }}
                                </button>
                            }
                        </div>
                    </section>
                    @if (hasProblems()) {
                        <p class="small text-danger">Fix the marked cells before saving: a value must be physically possible.</p>
                    }
                }
            </div>
        </section>
    `,
    styles: [
        `
            .ws-chip {
                padding: 4px 12px;
                border-radius: 14px;
                font-size: 13px;
                font-weight: 500;
                margin: 0 8px 8px 0;
            }
            .ws-ok {
                background: #e1f1e6;
                color: #1b5a35;
            }
            .ws-todo {
                background: #f1ede0;
                color: #4f4420;
            }
            .ws-out {
                background: #fff0d2;
                color: #6b4200;
            }
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
                padding: 10px 16px;
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
            .ws-pond {
                line-height: 1.3;
                padding-top: 8px;
            }
            .ws-status {
                padding-top: 8px;
            }
            .ws-in {
                min-height: 40px;
                font-weight: 600;
            }
            .ws-empty {
                border-color: #8fa0a0;
            }
            .ws-saved {
                background: #f6f8f7;
            }
            .ws-out-cell {
                background: #fff0d2;
                border-color: #e3c27a;
                color: #6b4200;
            }
            .ws-bad {
                border-color: #b33a3a;
            }
            .ws-side {
                text-align: center;
                font-size: 11px;
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
export class WaterSheetComponent extends FpmsPage implements OnInit {
    protected override keepsDrafts = true;
    loading = true;
    date = FarmTime.today();
    pondFilter: string | null = null;
    allBatches: any[] = [];
    params: any[] = [];
    cols: Col[] = [];
    /** Typed values by batch id, then column key ("DO.AM"). */
    cells: Record<string, Record<string, string>> = {};
    /** Saved values by batch id, then column key. */
    saved: Record<string, Record<string, number>> = {};
    restoredAt: string | null = null;
    private requestIds: Record<string, string> = {};

    get canCreate(): boolean {
        return this.can('Farm.Logs.Create');
    }

    get shown(): any[] {
        return this.allBatches.filter((b) => (!this.pondFilter || b.id === this.pondFilter) && (!b.stockingDate || b.stockingDate <= this.date));
    }

    get gridColumns(): string {
        return `170px repeat(${this.cols.length}, minmax(0, 1fr)) 110px`;
    }

    async ngOnInit(): Promise<void> {
        FormDrafts.purgeExpired();
        const [batches, params] = await Promise.all([this.api.get<any[]>('Batch', 'GetAll', { openOnly: true }), this.api.get<any[]>('Log', 'GetParameters')]);
        this.allBatches = batches
            .filter((b) => b.stockingDate)
            .sort((a, b) => String(a.pondCode).localeCompare(String(b.pondCode), undefined, { numeric: true }));
        this.params = params;
        this.cols = COLUMNS.flatMap((c) =>
            c.halves.map((half) => ({ key: `${c.code}.${half}`, code: c.code, half, label: c.halves.length === 1 ? c.name : `${c.name} ${half}` }))
        ).filter((c) => this.param(c.code));
        const date = this.query('date');
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= this.today) {
            this.date = date;
        }
        await this.load();
    }

    private get draftKey(): string {
        return `water-all.${this.date}`;
    }

    async load(): Promise<void> {
        if (!this.date) {
            return;
        }
        this.loading = true;
        this.restoredAt = null;
        this.cells = {};
        this.saved = {};
        this.requestIds = {};
        for (const b of this.allBatches) {
            this.cells[b.id] = {};
        }
        const logs = await this.readLogs();
        for (const l of logs.sort((x, y) => String(x.observedAtUtc).localeCompare(String(y.observedAtUtc)))) {
            const half: 'AM' | 'PM' = Number(FarmTime.toLocalInput(l.observedAtUtc).substring(11, 13)) < 12 ? 'AM' : 'PM';
            for (const m of l.measurements ?? []) {
                const key = m.parameterCode === 'SAL' ? 'SAL.AM' : `${m.parameterCode}.${half}`;
                if (this.cols.some((c) => c.key === key)) {
                    (this.saved[l.batchId] ??= {})[key] = m.value;
                }
            }
        }
        const draft = FormDrafts.load<Record<string, Record<string, string>>>(this.draftKey);
        if (draft?.data) {
            let any = false;
            for (const [id, vals] of Object.entries(draft.data)) {
                if (this.cells[id]) {
                    for (const [k, v] of Object.entries(vals)) {
                        if (v !== '' && this.saved[id]?.[k] === undefined) {
                            this.cells[id][k] = v;
                            any = true;
                        }
                    }
                }
            }
            this.restoredAt = any ? new Date(draft.savedAt).toISOString() : null;
        }
        this.loading = false;
    }

    private async readLogs(): Promise<any[]> {
        const out: any[] = [];
        for (let skip = 0; ; skip += 100) {
            const page = await this.api.get<any>('Log', 'GetList', { logType: 4, from: this.date, to: this.date, maxResultCount: 100, skipCount: skip });
            out.push(...(page?.items ?? []));
            if (!page || out.length >= page.totalCount || !(page.items ?? []).length) {
                return out;
            }
        }
    }

    shiftDay(n: number): void {
        this.date = FarmTime.addDays(this.date, n);
        if (this.date > this.today) {
            this.date = this.today;
        }
        this.load();
    }

    // ---------------------------------------------------------------- the sheet

    private param(code: string): any {
        return this.params.find((p) => p.code === code);
    }

    label(b: any): string {
        return `${b.pondCode} · ${b.letter ? 'Batch ' + b.letter : b.batchCode}`;
    }

    docOf(b: any): number {
        return b.stockingDate ? moment(this.date, 'YYYY-MM-DD').diff(moment(b.stockingDate, 'YYYY-MM-DD'), 'days') : 0;
    }

    rangeOf(c: Col): string {
        const p = this.param(c.code);
        return [p.optimalRange, p.unitCode].filter((x) => !!x).join(' ');
    }

    /** Afternoon readings cannot exist before noon today. */
    pmLocked(c: Col): boolean {
        return c.half === 'PM' && this.date === this.today && Number(moment().tz(FarmTime.zone).format('H')) < 12;
    }

    savedOf(b: any, c: Col): number | null {
        return this.saved[b.id]?.[c.key] ?? null;
    }

    valueOf(b: any, c: Col): string {
        const s = this.savedOf(b, c);
        return s !== null ? String(s) : (this.cells[b.id]?.[c.key] ?? '').toString().trim();
    }

    stateOf(b: any, c: Col): 'empty' | 'ok' | 'out' | 'invalid' {
        return optimalState(this.param(c.code), this.valueOf(b, c));
    }

    sideOf(b: any, c: Col): string {
        const p = this.param(c.code);
        const v = Number(this.valueOf(b, c));
        return p.optimalMin !== null && p.optimalMin !== undefined && v <= p.optimalMin ? 'Low' : 'High';
    }

    /** Cells of a pond that still have no reading (saved or typed). */
    missing(b: any): number {
        return this.cols.filter((c) => this.valueOf(b, c) === '' && !this.pmLocked(c)).length;
    }

    get toEnter(): number {
        return this.shown.reduce((n, b) => n + this.missing(b), 0);
    }

    get completeCount(): number {
        return this.shown.filter((b) => this.missing(b) === 0).length;
    }

    get outCount(): number {
        return this.shown.reduce((n, b) => n + this.cols.filter((c) => this.stateOf(b, c) === 'out').length, 0);
    }

    /** Typed cells that are not saved yet. */
    get pendingCount(): number {
        return this.allBatches.reduce((n, b) => n + this.typed(b).length, 0);
    }

    private typed(b: any): Col[] {
        return this.cols.filter((c) => this.savedOf(b, c) === null && (this.cells[b.id]?.[c.key] ?? '').toString().trim() !== '');
    }

    hasProblems(): boolean {
        return this.allBatches.some((b) => this.typed(b).some((c) => this.stateOf(b, c) === 'invalid'));
    }

    // ---------------------------------------------------------------- save

    async save(): Promise<void> {
        let logs = 0;
        let flagged = 0;
        for (const b of this.allBatches) {
            for (const half of ['AM', 'PM'] as const) {
                const cols = this.typed(b).filter((c) => (c.code === 'SAL' ? 'AM' : c.half) === half);
                if (!cols.length) {
                    continue;
                }
                const id = `${b.id}.${half}`;
                this.requestIds[id] ??= newGuid();
                const body = {
                    batchId: b.id,
                    logType: 4,
                    observedAt: FarmTime.fromLocalInput(`${this.date}T${this.timeFor(half)}`),
                    notes: '',
                    clientRequestId: this.requestIds[id],
                    readings: cols.map((c) => ({ parameterCode: c.code, value: Number(this.cells[b.id][c.key]) })),
                };
                let res: any;
                if (!(await this.act(async () => (res = await this.api.post<any>('Log', 'Create', body))))) {
                    await this.finish(logs, flagged);
                    return;
                }
                logs++;
                if (res?.log?.hasOutOfRange) {
                    flagged++;
                }
                delete this.requestIds[id];
                for (const c of cols) {
                    (this.saved[b.id] ??= {})[c.key] = Number(this.cells[b.id][c.key]);
                    delete this.cells[b.id][c.key];
                }
                this.keep();
            }
        }
        await this.finish(logs, flagged);
    }

    private async finish(logs: number, flagged: number): Promise<void> {
        if (logs) {
            this.notifySaved(`Saved ${logs} reading set${logs === 1 ? '' : 's'}${flagged ? `, ${flagged} with out-of-range values` : ''}.`);
        }
        await this.load();
    }

    /** The default time of a half of the day; today it is never later than now. */
    private timeFor(half: 'AM' | 'PM'): string {
        const t = DEFAULT_TIME[half];
        if (this.date === this.today) {
            const now = moment().tz(FarmTime.zone).format('HH:mm');
            return t > now ? now : t;
        }
        return t;
    }

    // ---------------------------------------------------------------- drafts (AC-25)

    keep(): void {
        const used: Record<string, Record<string, string>> = {};
        for (const b of this.allBatches) {
            for (const c of this.typed(b)) {
                (used[b.id] ??= {})[c.key] = String(this.cells[b.id][c.key]);
            }
        }
        if (Object.keys(used).length) {
            FormDrafts.save(this.draftKey, used);
        } else {
            FormDrafts.clear(this.draftKey);
        }
    }

    async discard(restoredOnly: boolean): Promise<void> {
        if (!restoredOnly && this.pendingCount && !(await this.confirm('Discard the readings you typed on this sheet?', 'Discard?'))) {
            return;
        }
        FormDrafts.clear(this.draftKey);
        for (const b of this.allBatches) {
            this.cells[b.id] = {};
        }
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
