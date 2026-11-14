import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime, newGuid } from '@shared/fpms/farm-time';
import { FormDrafts, OpsMemory } from '@shared/fpms/drafts';
import { FPMS_IMPORTS } from '../shared-imports';

interface Line {
    key: number;
    lotId: string;
    kg: number | null;
}

interface Entry {
    open: boolean;
    /** 1 = Fed, 2 = Not fed (DEC-50). */
    status: number;
    lines: Line[];
    notes: string;
    /** Optional time of feeding, 24-hour "HH:mm" (DEC-71). */
    fedAt: string;
    clientRequestId: string;
}

/**
 * Feeding (Ref 6.1; Journey 4; AC-11, AC-22, AC-25; DEC-50, DEC-54, DEC-61): the farm's scheduled feedings (four by
 * default) for every open batch on the farm on one day, listed by pond (a pond filter is optional). A session is either Fed, with kilograms from one or more feed
 * lots, or Not fed. Saving a session that already exists corrects it (stock is reversed and drawn again). Unsaved entries
 * are kept as a per-user draft in the browser.
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Feeding" subtitle="Each feeding in the farm's schedule, for every stocked pond on one day.">
            <a class="btn btn-default" [routerLink]="['/app/logbook/sheets']" [queryParams]="{ sheet: 'feeding' }">Print log sheet</a>
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="card">
                    <div class="card-body pb-1">
                        <div class="form-row align-items-end">
                            @if (!inWizard) {
                            <div class="form-group col-md-6">
                                <label for="pond">Pond</label>
                                <select id="pond" class="form-control" [(ngModel)]="batchFilter" (ngModelChange)="load()">
                                    <option [ngValue]="null">All stocked ponds</option>
                                    @for (b of batches; track b.id) {
                                        <option [ngValue]="b.id">{{ b.pondCode }} · {{ b.letter ? 'Batch ' + b.letter : b.batchCode }}</option>
                                    }
                                </select>
                            </div>
                            }
                            <div class="form-group col-md-4">
                                <label for="date">Feeding date</label>
                                <input id="date" type="date" class="form-control" [(ngModel)]="feedDate" (ngModelChange)="load()" [max]="today" />
                            </div>
                            <div class="form-group col-md-2">
                                <button type="button" class="btn btn-default btn-block" (click)="feedDate = today; load()" [disabled]="feedDate === today">Today</button>
                            </div>
                        </div>
                        @if (!batches.length && !loading) {
                            <p class="text-muted">No pond is stocked. Stock a batch first (Production → Create Batch).</p>
                        }
                    </div>
                </div>

                @if (restoredAt) {
                    <div class="alert alert-info d-flex align-items-center" role="status">
                        <i class="fas fa-history mr-2"></i>
                        <span class="mr-auto">Your unsaved feeding entries from {{ restoredAt | farmDateTime }} were restored.</span>
                        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="discardDraft()">Discard them</button>
                    </div>
                }

                @if (results.length) {
                    <div class="alert" [class.alert-success]="!hasWarnings" [class.alert-warning]="hasWarnings" role="status">
                        <strong>Saved {{ results.length }} session{{ results.length === 1 ? '' : 's' }}.</strong>
                        @for (r of results; track $index) {
                            @for (w of r.warnings; track $index) {
                                <div><i class="fas fa-exclamation-triangle mr-1"></i>{{ r.session.pondCode }} {{ r.session.session | label: L.FeedingSessions }}: {{ w.message }}</div>
                            }
                        }
                    </div>
                }

                @if (!feedLots.length && !loading) {
                    <div class="alert alert-info small">No feed lots in stock records. Ask a Farm Owner to record a feed receipt under Stock.</div>
                }

                @if (loading) {
                    <fpms-loading></fpms-loading>
                } @else if (sheet) {
                    @if (sheet.rows.length) {
                        <div class="card fpms-feed-card">
                            <div class="card-body p-0 table-responsive">
                                <table class="table mb-0 fpms-feed-table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Pond</th>
                                            <th scope="col">Feed lot</th>
                                            @for (s of headerSlots(); track s) {
                                                <th scope="col" [class.is-now]="s === headerCurrent()">
                                                    {{ s | label: L.FeedingSessions }}{{ s === headerCurrent() ? ' · now' : '' }}
                                                    @if (usualTime(s)) { <div class="fpms-feed-usual">usually {{ usualTime(s) }}</div> }
                                                </th>
                                            }
                                            <th scope="col" class="text-right">Day total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @for (row of sheet.rows; track row.batchId) {
                                            <tr [class.is-focus]="row.batchId === focusBatchId">
                                                <th scope="row">
                                                    <a [routerLink]="['/app/production/batches', row.batchId]">{{ row.pondCode }}</a>
                                                    <div class="fpms-feed-sub">{{ row.batchCode }}</div>
                                                </th>
                                                <td>
                                                    <select class="form-control form-control-sm fpms-feed-lot" [attr.aria-label]="row.pondCode + ' feed lot'" [ngModel]="rowLot(row)" (ngModelChange)="setRowLot(row, $event)" [disabled]="!canCreate || !feedLots.length">
                                                        @for (o of feedLots; track o.lotId) {
                                                            <option [value]="o.lotId">{{ o.label }}</option>
                                                        }
                                                    </select>
                                                </td>
                                                @for (s of slots(row); track s) {
                                                    @let existing = row.sessions[s - 1];
                                                    @let e = entry(row.batchId, s);
                                                    <td [class.is-now]="!existing && currentSlot(row) === s" [class.is-later]="!existing && !e.open && isLater(s)" [class.is-open]="e.open">
                                                        @if (existing && !e.open) {
                                                            @if (existing.status === 2) {
                                                                <div class="fpms-feed-value text-muted">Not fed</div>
                                                            } @else {
                                                                <div class="fpms-feed-value">{{ existing.kg | num: 1 }} kg</div>
                                                            }
                                                            <div class="fpms-feed-sub">
                                                                {{ existing.fedAtTime || '' }}{{ existing.fedAtTime ? ' · ' : '' }}{{ existing.recordedBy }}
                                                                @if (existing.lines?.length > 1) { <div>{{ existing.lines.length }} lots</div> }
                                                                @if (existing.notes) { <div>{{ existing.notes }}</div> }
                                                            </div>
                                                            <div class="fpms-feed-actions">
                                                                @if (existing.canEdit) {
                                                                    <button type="button" class="btn btn-link btn-sm p-0" (click)="startEdit(row.batchId, s, existing)">Correct</button>
                                                                }
                                                                @if (existing.canVoid && voiding?.id !== existing.id) {
                                                                    <button type="button" class="btn btn-link btn-sm p-0 text-danger" (click)="voiding = { id: existing.id, reason: '' }">Void</button>
                                                                }
                                                            </div>
                                                            @if (voiding?.id === existing.id) {
                                                                <div class="mt-1">
                                                                    <label class="sr-only" [for]="'vr' + existing.id">Reason for voiding</label>
                                                                    <input [id]="'vr' + existing.id" class="form-control form-control-sm mb-1" [(ngModel)]="voiding.reason" maxlength="500" placeholder="Reason, e.g. wrong pond" />
                                                                    <button type="button" class="btn btn-sm btn-danger mr-1" (click)="voidSession(existing)" [disabled]="busy() || !voiding.reason.trim()">Void</button>
                                                                    <button type="button" class="btn btn-sm btn-default" (click)="voiding = null">Cancel</button>
                                                                </div>
                                                            }
                                                        } @else if (canCreate && feedLots.length) {
                                                            <div class="fpms-feed-entry">
                                                                @if (e.status !== 2) {
                                                                    <div class="input-group input-group-sm">
                                                                        <input type="number" min="0.001" max="1000" step="0.1" inputmode="decimal" class="form-control" [attr.aria-label]="row.pondCode + ' feeding ' + s + ', kilograms'"
                                                                            [ngModel]="e.lines[0]?.kg" (ngModelChange)="setKg(row, s, $event)" [placeholder]="yesterday(row.batchId, s) ?? 'kg'" />
                                                                        <div class="input-group-append"><span class="input-group-text">kg</span></div>
                                                                    </div>
                                                                    @if (!e.open && yesterday(row.batchId, s) != null) {
                                                                        <button type="button" class="btn btn-link btn-sm p-0" (click)="setKg(row, s, yesterday(row.batchId, s))">Same as yesterday ({{ yesterday(row.batchId, s) | num: 1 }})</button>
                                                                    }
                                                                }
                                                                <div class="custom-control custom-checkbox">
                                                                    <input type="checkbox" class="custom-control-input" [id]="'nf' + row.batchId + s" [ngModel]="e.status === 2" (ngModelChange)="setNotFed(row, s, $event)" />
                                                                    <label class="custom-control-label" [for]="'nf' + row.batchId + s">Not fed</label>
                                                                </div>
                                                                @if (e.open) {
                                                                    <details class="fpms-feed-more" [open]="e.lines.length > 1 || !!e.notes || !!e.fedAt || e.status === 2">
                                                                        <summary>{{ e.status === 2 ? 'Reason' : 'Time, lots, notes' }}</summary>
                                                                        @if (e.status === 2) {
                                                                            <div class="mt-1" role="group" aria-label="Common reasons">
                                                                                @for (r of notFedReasons; track r) {
                                                                                    <button type="button" class="btn btn-sm py-0 px-2 mr-1 mb-1" [class.btn-secondary]="e.notes === r" [class.btn-outline-secondary]="e.notes !== r" [attr.aria-pressed]="e.notes === r" (click)="e.notes = r; keepDraft()">{{ r }}</button>
                                                                                }
                                                                            </div>
                                                                        } @else {
                                                                            <label class="small mb-0 mt-1" [for]="'fat' + row.batchId + s">Time fed</label>
                                                                            <input type="time" class="form-control form-control-sm" [id]="'fat' + row.batchId + s" [(ngModel)]="e.fedAt" (ngModelChange)="keepDraft()" />
                                                                            @for (l of e.lines; track l.key; let i = $index) {
                                                                                @if (i > 0) {
                                                                                    <div class="d-flex mt-1">
                                                                                        <select class="form-control form-control-sm mr-1" [(ngModel)]="l.lotId" (ngModelChange)="keepDraft()" aria-label="Second feed lot">
                                                                                            @for (o of feedLots; track o.lotId) { <option [value]="o.lotId">{{ o.label }}</option> }
                                                                                        </select>
                                                                                        <input type="number" min="0.001" step="0.1" class="form-control form-control-sm mr-1" style="max-width: 6rem" [(ngModel)]="l.kg" (ngModelChange)="keepDraft()" aria-label="Kilograms from this lot" placeholder="kg" />
                                                                                        <button type="button" class="btn btn-sm btn-link text-danger px-1" (click)="removeLine(e, l)" aria-label="Remove lot"><i class="fas fa-times" aria-hidden="true"></i></button>
                                                                                    </div>
                                                                                }
                                                                                @if (short(l)) {
                                                                                    <small class="d-block text-warning-dark"><i class="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>More than this lot's stock; it will save and the lot will be flagged.</small>
                                                                                }
                                                                            }
                                                                            <button type="button" class="btn btn-link btn-sm p-0" (click)="addLine(e)">Add another lot</button>
                                                                        }
                                                                        <input class="form-control form-control-sm mt-1" [(ngModel)]="e.notes" (ngModelChange)="keepDraft()" maxlength="500" [placeholder]="e.status === 2 ? 'Reason (optional)' : 'Notes (optional)'" aria-label="Notes" />
                                                                    </details>
                                                                    @if (existing) {
                                                                        <button type="button" class="btn btn-link btn-sm p-0" (click)="cancelEdit(row.batchId, s)">Cancel correction</button>
                                                                    }
                                                                    @if (e.status === 1 && total(e) > 1000) {
                                                                        <small class="d-block text-danger">More than 1,000 kg in one feeding is not allowed.</small>
                                                                    }
                                                                }
                                                            </div>
                                                        } @else {
                                                            <span class="text-muted">—</span>
                                                        }
                                                    </td>
                                                }
                                                @for (x of fillerSlots(row); track x) { <td></td> }
                                                <td class="text-right fpms-feed-value">{{ dayTotal(row) | num: 1 }} kg</td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    } @else {
                        <fpms-empty text="No pond is stocked on this date." icon="fas fa-utensils"></fpms-empty>
                    }

                    @if (canCreate && sheet.rows.length) {
                        <div class="d-flex align-items-center mb-3 fpms-savebar" [class.fpms-savebar-sticky]="!inWizard">
                            <button type="button" class="btn btn-primary btn-lg mr-3" (click)="save()" [disabled]="busy() || !pending().length || !valid()">
                                @if (busy()) { <i class="fas fa-spinner fa-spin mr-1"></i> }
                                Save {{ pending().length || '' }} session{{ pending().length === 1 ? '' : 's' }}
                            </button>
                            <span class="small text-muted">Only feedings with kilograms typed, Not fed ticked, or a correction are saved. Fed feedings draw stock from the pond's lot.</span>
                        </div>
                    }
                }
            </div>
        </section>
    `,
})
export class FeedingSheetComponent extends FpmsPage implements OnInit {
    /** Unsaved entries are kept as a browser draft, so leaving never needs to ask. */
    protected override keepsDrafts = true;
    /** Quick picks for why a feeding was skipped; they only fill the reason text, which staff can still edit (DEC-61). */
    readonly notFedReasons = ['Molting', 'Rain / weather', 'Low DO', 'Treatment', 'Tray not cleared', 'Power outage'];
    loading = true;
    batches: any[] = [];
    batchFilter: string | null = null;
    feedDate = FarmTime.today();
    focusBatchId: string | null = null;
    /** Shown in the logging wizard, which has already fixed the pond. */
    readonly inWizard = !!this.embedded;
    sheet: any = null;
    feedLots: any[] = [];
    entries: Record<string, Entry> = {};
    results: any[] = [];
    restoredAt: string | null = null;
    voiding: { id: string; reason: string } | null = null;
    /** Kilograms per pond and feeding on the day before the sheet's date, keyed "batchId.session". */
    yesterdayKg: Record<string, number> = {};
    /** The feed lot chosen per pond on this sheet. */
    rowLots: Record<string, string> = {};
    private lineKey = 0;

    get canCreate(): boolean {
        return this.can('Farm.Logs.Create');
    }

    get hasWarnings(): boolean {
        return this.results.some((r) => r.warnings?.length);
    }

    async ngOnInit(): Promise<void> {
        FormDrafts.purgeExpired();
        const [batches, lots] = await Promise.all([
            this.api.get<any[]>('Batch', 'GetAll', { openOnly: true }),
            this.api.get<any[]>('Inventory', 'GetLotOptions', { category: 1 }),
        ]);
        this.batches = batches.sort((x, y) => String(x.pondCode).localeCompare(String(y.pondCode), undefined, { numeric: true }));
        this.feedLots = lots;
        this.focusBatchId = this.query('batchId');
        if (this.inWizard && this.focusBatchId) {
            // The wizard is for one pond: only that pond's sessions are listed.
            this.batchFilter = this.focusBatchId;
        }
        const date = this.query('date');
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= this.today) {
            this.feedDate = date;
        }
        // DEC-54: the sheet is farm-wide by default; the pond filter is chosen on the page.
        await this.load();
    }

    private get draftKey(): string {
        return `feeding.${this.batchFilter ?? 'farm'}.${this.feedDate}`;
    }

    async load(): Promise<void> {
        this.results = [];
        this.voiding = null;
        this.restoredAt = null;
        if (!this.feedDate) {
            this.sheet = null;
            this.loading = false;
            return;
        }
        this.loading = true;
        if (this.batchFilter) {
            OpsMemory.set({ ...OpsMemory.get(), batchId: this.batchFilter });
        }
        const params: any = { feedDate: this.feedDate };
        if (this.batchFilter) {
            params.batchId = this.batchFilter;
        }
        const [sheet, before] = await Promise.all([
            this.run(() => this.api.get<any>('Feeding', 'GetSheet', params)),
            this.run(() => this.api.get<any>('Feeding', 'GetSheet', { ...params, feedDate: FarmTime.addDays(this.feedDate, -1) })),
        ]);
        this.sheet = sheet;
        this.rowLots = {};
        this.yesterdayKg = {};
        for (const row of before?.rows ?? []) {
            (row.sessions ?? []).forEach((x: any, i: number) => {
                if (x && x.status !== 2 && Number(x.kg) > 0) {
                    this.yesterdayKg[`${row.batchId}.${i + 1}`] = Number(x.kg);
                }
            });
        }
        this.entries = {};
        for (const row of this.sheet?.rows ?? []) {
            for (const s of this.slots(row)) {
                this.entries[`${row.batchId}.${s}`] = this.closedEntry();
            }
        }
        const draft = FormDrafts.load<Record<string, Entry>>(this.draftKey);
        let restored = 0;
        for (const [k, e] of Object.entries(draft?.data ?? {})) {
            if (e.open && this.entries[k]) {
                this.entries[k] = { ...e, status: e.status ?? 1, fedAt: e.fedAt ?? '', lines: e.lines.map((l) => ({ ...l, key: ++this.lineKey })) };
                restored++;
            }
        }
        this.restoredAt = restored ? new Date(draft!.savedAt).toISOString() : null;
        this.loading = false;
    }

    /** Feeding numbers shown for a row: the farm's schedule, plus any feeding logged beyond it (DEC-61). */
    slots(row: any): number[] {
        const count = Math.max(this.sheet?.feedingTimes?.length ?? 0, row.sessions?.length ?? 0);
        return Array.from({ length: count }, (_, i) => i + 1);
    }

    /** Minutes since midnight on the farm clock; used only to point at the feeding that is current on today's sheet. */
    private farmMinutesNow(): number {
        const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: FarmTime.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':');
        return Number(h) * 60 + Number(m);
    }

    private usualMinutes(s: number): number | null {
        const t = /^(\d{1,2}):(\d{2})$/.exec(this.usualTime(s));
        return t ? Number(t[1]) * 60 + Number(t[2]) : null;
    }

    /**
     * On today's sheet, the feeding not yet recorded whose usual time is the latest one that has begun (or begins within
     * half an hour). It is a pointer, not a task: nothing is assigned or overdue (DEC-31), and 0 means no cue.
     */
    currentSlot(row: any): number {
        if (this.feedDate !== this.today) {
            return 0;
        }
        const now = this.farmMinutesNow() + 30;
        let current = 0;
        for (const s of this.slots(row)) {
            const at = this.usualMinutes(s);
            if (!row.sessions?.[s - 1] && at !== null && at <= now) {
                current = s;
            }
        }
        return current;
    }

    /** A feeding whose usual time is still ahead today; shown quieter, never hidden. */
    isLater(s: number): boolean {
        const at = this.usualMinutes(s);
        return this.feedDate === this.today && at !== null && at > this.farmMinutesNow() + 30;
    }

    /** The schedule's usual time for a feeding, shown as a hint; the time field itself stays optional (DEC-71). */
    usualTime(s: number): string {
        return this.sheet?.feedingTimes?.[s - 1] ?? '';
    }

    entry(batchId: string, s: number): Entry {
        return this.entries[`${batchId}.${s}`];
    }

    // ---------------------------------------------------------------- table layout (redesign)

    /** Feeding columns for the whole table: the most any pond has. */
    headerSlots(): number[] {
        const most = Math.max(0, ...(this.sheet?.rows ?? []).map((r: any) => this.slots(r).length));
        return Array.from({ length: most }, (_, i) => i + 1);
    }

    /** Empty cells that keep a pond with fewer feedings aligned with the header. */
    fillerSlots(row: any): number[] {
        return Array.from({ length: this.headerSlots().length - this.slots(row).length }, (_, i) => i);
    }

    /** On today's sheet, the feeding whose usual time has most recently begun: highlighted in the header. */
    headerCurrent(): number {
        if (this.feedDate !== this.today) {
            return 0;
        }
        const now = this.farmMinutesNow() + 30;
        let current = 0;
        for (const s of this.headerSlots()) {
            const at = this.usualMinutes(s);
            if (at !== null && at <= now) {
                current = s;
            }
        }
        return current;
    }

    /** Kilograms fed at this feeding the day before, if any: the usual starting point. */
    yesterday(batchId: string, s: number): number | null {
        return this.yesterdayKg[`${batchId}.${s}`] ?? null;
    }

    /** The pond's feed lot: the one chosen on this sheet, else the one used last, else the first in stock. */
    rowLot(row: any): string {
        const chosen = this.rowLots[row.batchId];
        if (chosen) {
            return chosen;
        }
        const last = [...(row.sessions ?? [])].reverse().find((x: any) => x?.lines?.length);
        const lotId = last?.lines[0]?.lotId;
        return lotId && this.feedLots.some((o) => o.lotId === lotId) ? lotId : this.feedLots[0]?.lotId ?? '';
    }

    setRowLot(row: any, lotId: string): void {
        this.rowLots[row.batchId] = lotId;
        for (const s of this.slots(row)) {
            const e = this.entry(row.batchId, s);
            if (e?.open && !row.sessions?.[s - 1] && e.lines.length === 1) {
                e.lines[0].lotId = lotId;
            }
        }
        this.keepDraft();
    }

    /** Typing kilograms opens the feeding for saving; clearing them closes it again (a correction stays open). */
    setKg(row: any, s: number, value: any): void {
        const e = this.entry(row.batchId, s);
        if (!e || e.status === 2) {
            return;
        }
        const existing = row.sessions?.[s - 1];
        if (!e.lines.length) {
            e.lines.push(this.newLine());
        }
        const kg = value === '' || value == null ? null : Number(value);
        e.lines[0].kg = kg;
        if (!existing && e.lines.length === 1) {
            e.lines[0].lotId = this.rowLot(row);
        }
        e.open = !!existing || (kg ?? 0) > 0 || e.lines.length > 1;
        this.keepDraft();
    }

    setNotFed(row: any, s: number, notFed: boolean): void {
        const e = this.entry(row.batchId, s);
        if (!e) {
            return;
        }
        e.status = notFed ? 2 : 1;
        e.open = notFed || !!row.sessions?.[s - 1] || (Number(e.lines[0]?.kg) || 0) > 0;
        this.keepDraft();
    }

    /** The pond's kilograms for the day: saved feedings, with any typed or corrected ones in their place. */
    dayTotal(row: any): number {
        let sum = 0;
        for (const s of this.slots(row)) {
            const e = this.entry(row.batchId, s);
            const existing = row.sessions?.[s - 1];
            if (e?.open) {
                sum += e.status === 2 ? 0 : this.total(e);
            } else if (existing && existing.status !== 2) {
                sum += Number(existing.kg) || 0;
            }
        }
        return Math.round(sum * 1000) / 1000;
    }

    private closedEntry(): Entry {
        return { open: false, status: 1, lines: [this.newLine()], notes: '', fedAt: '', clientRequestId: newGuid() };
    }

    private newLine(lotId?: string, kg?: number | null): Line {
        return { key: ++this.lineKey, lotId: lotId ?? this.feedLots[0]?.lotId ?? '', kg: kg ?? null };
    }

    addLine(e: Entry): void {
        e.lines.push(this.newLine());
        this.keepDraft();
    }

    removeLine(e: Entry, l: Line): void {
        e.lines = e.lines.filter((x) => x !== l);
        this.keepDraft();
    }

    startEdit(batchId: string, s: number, existing: any): void {
        const lines = existing.lines.map((l: any) => this.newLine(l.lotId, l.kg));
        // A lot that is used up is no longer offered; keep it selectable for this correction.
        for (const l of existing.lines) {
            if (!this.feedLots.some((o) => o.lotId === l.lotId)) {
                this.feedLots = [...this.feedLots, { lotId: l.lotId, label: l.label, unit: 'kg', quantityOnHand: 0 }];
            }
        }
        this.entries[`${batchId}.${s}`] = { open: true, status: existing.status ?? 1, lines: lines.length ? lines : [this.newLine()], notes: existing.notes ?? '', fedAt: existing.fedAtTime ?? '', clientRequestId: newGuid() };
        this.keepDraft();
    }

    cancelEdit(batchId: string, s: number): void {
        this.entries[`${batchId}.${s}`] = this.closedEntry();
        this.keepDraft();
    }

    total(e: Entry): number {
        return e.lines.reduce((sum, l) => sum + (Number(l.kg) || 0), 0);
    }

    short(l: Line): boolean {
        const lot = this.feedLots.find((o) => o.lotId === l.lotId);
        return !!lot && Number(l.kg) > lot.quantityOnHand;
    }

    pending(): { batchId: string; session: number; e: Entry }[] {
        return Object.entries(this.entries)
            .filter(([, e]) => e.open)
            .map(([k, e]) => ({ batchId: k.split('.')[0], session: Number(k.split('.')[1]), e }));
    }

    valid(): boolean {
        return this.pending().every(({ e }) => e.status === 2 || (e.lines.length > 0 && e.lines.every((l) => l.lotId && Number(l.kg) > 0) && this.total(e) <= 1000));
    }

    async save(): Promise<void> {
        const sessions = this.pending().map(({ batchId, session, e }) => ({
            batchId,
            feedDate: this.feedDate,
            session,
            notes: e.notes,
            fedAtTime: e.status === 1 && e.fedAt ? e.fedAt : null,
            clientRequestId: e.clientRequestId,
            status: e.status,
            lines: e.status === 2 ? [] : e.lines.map((l) => ({ lotId: l.lotId, kg: Number(l.kg) })),
        }));
        let res: any[] = [];
        if (!(await this.act(async () => (res = await this.api.post<any[]>('Feeding', 'SaveSheet', { sessions }))))) {
            return;
        }
        FormDrafts.clear(this.draftKey);
        await this.load();
        this.results = res;
        this.feedLots = await this.api.get<any[]>('Inventory', 'GetLotOptions', { category: 1 });
        if (!this.hasWarnings) {
            this.notifySaved('Feeding saved.');
        }
    }

    async voidSession(existing: any): Promise<void> {
        const reason = this.voiding?.reason.trim();
        if (!reason) {
            return;
        }
        if (await this.act(() => this.api.post('Feeding', 'Void', { id: existing.id, reason }))) {
            this.notifySaved('Feeding session voided.');
            await this.load();
            this.feedLots = await this.api.get<any[]>('Inventory', 'GetLotOptions', { category: 1 });
        }
    }

    // ---------------------------------------------------------------- drafts (AC-25)

    keepDraft(): void {
        const open = Object.fromEntries(Object.entries(this.entries).filter(([, e]) => e.open));
        if (Object.keys(open).length) {
            FormDrafts.save(this.draftKey, open);
        } else {
            FormDrafts.clear(this.draftKey);
        }
    }

    discardDraft(): void {
        FormDrafts.clear(this.draftKey);
        for (const k of Object.keys(this.entries)) {
            this.entries[k] = this.closedEntry();
        }
        this.restoredAt = null;
    }
}
