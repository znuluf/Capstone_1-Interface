import { Component, OnInit } from '@angular/core';
import { batchShort } from '@shared/fpms/labels';
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
        <fpms-page-header [narrow]="true" title="Feeding" subtitle="Each feeding in the farm's schedule, for every stocked pond on one day.">
            <a class="btn btn-default" [routerLink]="['/app/logbook/sheets']" [queryParams]="{ sheet: 'feeding' }">Print log sheet</a>
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid fpms-narrow">
                <!-- One line of filters on the page ground (DEC-105), not a box of its own. -->
                <div class="fpms-filter-row">
                    @if (!inWizard) {
                        <label class="sl-field">
                            <span>Pond</span>
                            <select class="form-control form-control-sm" [(ngModel)]="batchFilter" (ngModelChange)="load()">
                                <option [ngValue]="null">All stocked ponds</option>
                                @for (b of batches; track b.id) {
                                    <option [ngValue]="b.id">{{ b.pondCode }} · {{ b.letter ? 'Batch ' + b.letter : b.batchCode }}</option>
                                }
                            </select>
                        </label>
                    }
                    <label class="sl-field">
                        <span>Date</span>
                        <input type="date" class="form-control form-control-sm" [(ngModel)]="feedDate" (ngModelChange)="load()" [max]="today" />
                    </label>
                    <button type="button" class="btn btn-sm btn-outline-secondary" (click)="feedDate = today; load()" [disabled]="feedDate === today">Today</button>
                </div>
                @if (!batches.length && !loading) {
                    <p class="text-muted">No pond is stocked. Stock a batch first (Production → Stock a batch).</p>
                }

                @if (restoredAt) {
                    <div class="alert alert-info d-flex align-items-center" role="status">
                        <i class="fas fa-history mr-2"></i>
                        <span class="mr-auto">Your unsaved feeding entries from {{ restoredAt | farmDateTime }} were restored.</span>
                        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="discardDraft()">Discard them</button>
                    </div>
                }

                @if (results.length) {
                    <div class="alert" [class.alert-success]="!hasWarnings" [class.alert-warning]="hasWarnings" role="status">
                        <strong>Saved {{ results.length }} feeding{{ results.length === 1 ? '' : 's' }}.</strong>
                        @for (r of results; track $index) {
                            @for (w of r.warnings; track $index) {
                                <div><i class="fas fa-exclamation-triangle mr-1"></i>{{ r.session.pondCode }} {{ r.session.session | label: L.FeedingSessions }}: {{ w.message }}</div>
                            }
                        }
                    </div>
                }

                @if (!feedLots.length && !loading) {
                    <div class="alert alert-info small">No feed lots in stock records. Ask a Farm Owner to record a feed receipt under Inventory.</div>
                }

                @if (loading) {
                    <fpms-loading></fpms-loading>
                } @else if (sheet) {
                    @for (row of sheet.rows; track row.batchId) {
                        <div class="card" [class.card-outline]="row.batchId === focusBatchId" [class.card-primary]="row.batchId === focusBatchId">
                            <div class="card-header d-flex align-items-center">
                                <h3 class="card-title mr-auto">
                                    <a [routerLink]="['/app/production/batches', row.batchId]" [title]="row.batchCode"><span class="fpms-pond-tag">{{ row.pondCode }}</span> {{ batchShort(row.batchCode) }}</a>
                                </h3>
                                <span class="text-muted">{{ fedCount(row) }} of {{ slots(row).length }} entered · {{ fedKg(row) | num: 3 : true }} kg</span>
                                @if (row.status !== 2) { <fpms-badge class="ml-2" [text]="row.status | label: L.BatchStatuses"></fpms-badge> }
                            </div>
                            <div class="card-body">
                                <!-- A tile per feeding (DEC-96); each keeps its own height, so an open one does not stretch its neighbour (DEC-105). -->
                                <div class="fpms-slots">
                                    @for (s of slots(row); track s) {
                                        <div class="fpms-slots-cell">
                                            @let existing = row.sessions[s - 1];
                                            @let e = entry(row.batchId, s);
                                            <div class="fpms-slot" [class.fpms-slot-open]="e.open" [class.fpms-slot-now]="!existing && !e.open && currentSlot(row) === s" [class.fpms-slot-later]="!existing && !e.open && isLater(s)" [class.fpms-slot-fed]="existing && existing.status !== 2 && !e.open" [class.fpms-slot-skipped]="existing && existing.status === 2 && !e.open">
                                                <div class="d-flex align-items-center mb-1">
                                                    @if (!existing) {
                                                        <div class="custom-control custom-checkbox mr-auto">
                                                            <input type="checkbox" class="custom-control-input" [id]="'fed' + row.batchId + s" [(ngModel)]="e.open" (ngModelChange)="keepDraft()" [disabled]="!canCreate || !feedLots.length" />
                                                            <label class="custom-control-label font-weight-bold" [for]="'fed' + row.batchId + s">Record {{ s | label: L.FeedingSessions }}</label>
                                                        </div>
                                                        @if (usualTime(s)) {
                                                            <span class="fpms-slot-time" title="Usual time"><i class="far fa-clock" aria-hidden="true"></i><span class="sr-only">usually </span>{{ usualTime(s) }}</span>
                                                        }
                                                    } @else if (existing.status === 2) {
                                                        <strong class="mr-auto">{{ s | label: L.FeedingSessions }}: <span class="text-muted">Not fed</span></strong>
                                                    } @else {
                                                        <strong class="mr-auto">{{ s | label: L.FeedingSessions }}: {{ existing.kg | num: 3 : true }} kg</strong>
                                                    }
                                                    @if (existing) {
                                                        @if (existing.canEdit && !e.open) {
                                                            <button type="button" class="btn btn-sm btn-outline-primary mr-1" (click)="startEdit(row.batchId, s, existing)">Correct</button>
                                                        }
                                                        @if (existing.canVoid && !e.open && voiding?.id !== existing.id) {
                                                            <button type="button" class="btn btn-sm btn-outline-danger" (click)="voiding = { id: existing.id, reason: '' }">Void</button>
                                                        }
                                                    }
                                                </div>

                                                @if (!existing && !e.open && currentSlot(row) === s) {
                                                    <div class="fpms-slot-tag">Current feeding</div>
                                                }
                                                @if (existing && !e.open) {
                                                    <div class="small">
                                                        @for (l of existing.lines; track l.lotId) {
                                                            <div>{{ l.label }}{{ existing.lines.length > 1 ? ': ' + (l.kg | num: 3 : true) + ' kg' : '' }}</div>
                                                        }
                                                        @if (existing.notes) { <div>{{ existing.notes }}</div> }
                                                        <div class="text-muted">{{ existing.fedAtTime ? 'Fed ' + existing.fedAtTime + ' · ' : '' }}{{ existing.recordedBy }}, {{ existing.creationTime | farmDateTime }}</div>
                                                    </div>
                                                    @if (voiding?.id === existing.id) {
                                                        <div class="mt-2">
                                                            <label class="small mb-1" [for]="'vr' + existing.id">Reason for voiding <span class="text-danger">*</span></label>
                                                            <input [id]="'vr' + existing.id" class="form-control form-control-sm mb-1" [(ngModel)]="voiding.reason" maxlength="500" placeholder="e.g. entered on the wrong pond" />
                                                            <button type="button" class="btn btn-sm btn-danger mr-1" (click)="voidSession(existing)" [disabled]="busy() || !voiding.reason.trim()">Void feeding</button>
                                                            <button type="button" class="btn btn-sm btn-default" (click)="voiding = null">Cancel</button>
                                                            <small class="d-block text-muted mt-1">Its feed is returned to stock with reversing movements.</small>
                                                        </div>
                                                    }
                                                }

                                                @if (e.open) {
                                                    <div class="btn-group btn-group-toggle mb-2" role="group" aria-label="Fed or not fed">
                                                        <button type="button" class="btn" [class.btn-primary]="e.status === 1" [class.btn-outline-primary]="e.status !== 1" [attr.aria-pressed]="e.status === 1" (click)="setFed(e)">Fed</button>
                                                        <button type="button" class="btn" [class.btn-secondary]="e.status === 2" [class.btn-outline-secondary]="e.status !== 2" [attr.aria-pressed]="e.status === 2" (click)="e.status = 2; keepDraft()">Not fed</button>
                                                    </div>
                                                    @if (e.status === 2) {
                                                        <small class="d-block text-muted mb-1">Saved as a deliberate skip (for example a molt, a treatment or bad weather). No stock is drawn.</small>
                                                    }
                                                    @for (l of (e.status === 1 ? e.lines : []); track l.key) {
                                                        <!-- The lot on its own line, so its name is never cut off; its kg under it. -->
                                                        <div class="fpms-feed-line mb-1">
                                                            <div class="lot">
                                                                <select class="form-control form-control-sm" [(ngModel)]="l.lotId" (ngModelChange)="keepDraft()" aria-label="Feed lot">
                                                                    @for (o of feedLots; track o.lotId) {
                                                                        <option [value]="o.lotId">{{ o.label }}</option>
                                                                    }
                                                                </select>
                                                            </div>
                                                            <div class="kg">
                                                                <div class="input-group input-group-sm">
                                                                    <input type="number" min="0.001" max="1000" step="0.001" inputmode="decimal" class="form-control" [(ngModel)]="l.kg" (ngModelChange)="keepDraft()" aria-label="Kilograms fed" />
                                                                    <div class="input-group-append"><span class="input-group-text">kg</span></div>
                                                                </div>
                                                            </div>
                                                            <div class="rm">
                                                                @if (e.lines.length > 1) {
                                                                    <button type="button" class="btn btn-sm btn-link text-danger px-0" (click)="removeLine(e, l)" aria-label="Remove lot"><i class="fas fa-times"></i></button>
                                                                }
                                                            </div>
                                                        </div>
                                                        @if (short(l)) {
                                                            <small class="d-block text-warning-dark mb-1"><i class="fas fa-exclamation-triangle mr-1"></i>More than this lot's stock on hand; it will save and the lot will be flagged.</small>
                                                        }
                                                    }
                                                    @if (e.status === 1) {
                                                        <button type="button" class="btn btn-sm btn-link px-0" (click)="addLine(e)"><i class="fas fa-plus mr-1"></i>Another lot</button>
                                                    }
                                                    @if (e.status === 1) {
                                                        <div class="form-row align-items-center mt-1">
                                                            <label class="col-auto mb-0" [for]="'fat' + row.batchId + s">Time fed <span class="font-weight-normal text-muted">(optional)</span></label>
                                                            <div class="col-auto">
                                                                <input type="time" class="form-control form-control-sm" [id]="'fat' + row.batchId + s" [(ngModel)]="e.fedAt" (ngModelChange)="keepDraft()" />
                                                            </div>
                                                        </div>
                                                    }
                                                    @if (e.status === 2) {
                                                        <div class="mt-1" role="group" aria-label="Common reasons">
                                                            @for (r of notFedReasons; track r) {
                                                                <button type="button" class="btn btn-xs btn-sm py-0 px-2 mr-1 mb-1" [class.btn-secondary]="e.notes === r" [class.btn-outline-secondary]="e.notes !== r" [attr.aria-pressed]="e.notes === r" (click)="e.notes = r; keepDraft()">{{ r }}</button>
                                                            }
                                                        </div>
                                                    }
                                                    <input class="form-control form-control-sm mt-1" [(ngModel)]="e.notes" (ngModelChange)="keepDraft()" maxlength="500" [placeholder]="e.status === 2 ? 'Reason (optional): pick one above or type your own' : 'Notes (optional)'" aria-label="Notes" />
                                                    @if (existing) {
                                                        <button type="button" class="btn btn-sm btn-link px-0" (click)="cancelEdit(row.batchId, s)">Cancel correction</button>
                                                    }
                                                    @if (e.status === 1 && total(e) > 1000) {
                                                        <small class="d-block text-danger">More than 1,000 kg in one feeding is not allowed.</small>
                                                    }
                                                }
                                            </div>
                                        </div>
                                    }
                                </div>
                            </div>
                        </div>
                    } @empty {
                        <fpms-empty text="No pond is stocked on this date." icon="fas fa-utensils"></fpms-empty>
                    }

                    @if (canCreate && sheet.rows.length) {
                        <div class="d-flex align-items-center mb-3 fpms-savebar" [class.fpms-savebar-sticky]="!inWizard">
                            <button type="button" class="btn btn-primary btn-lg mr-3 text-nowrap" (click)="save()" [disabled]="busy() || !pending().length || !valid()">
                                @if (busy()) { <i class="fas fa-spinner fa-spin mr-1"></i> }
                                Save {{ pending().length || '' }} feeding{{ pending().length === 1 ? '' : 's' }}
                            </button>
                            <span class="small text-muted">Only ticked or corrected feedings are saved; fed ones draw stock from their lots.</span>
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

    /** Back to Fed: a quick reason picked while Not fed was chosen is not a note on a feeding that happened. */
    setFed(e: Entry): void {
        e.status = 1;
        if (this.notFedReasons.includes(e.notes)) {
            e.notes = '';
        }
        this.keepDraft();
    }
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
        this.sheet = await this.run(() => this.api.get<any>('Feeding', 'GetSheet', params));
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
    /** Feedings entered on this pond's sheet (Not fed counts), for the line beside its name. */
    fedCount(row: any): number {
        return ((row.sessions as any[]) ?? []).filter((x) => !!x).length;
    }

    /** Kilograms fed on this pond's sheet; Not fed feedings add nothing. */
    fedKg(row: any): number {
        return ((row.sessions as any[]) ?? []).filter((x) => x && x.status !== 2).reduce((n, x) => n + (Number(x.kg) || 0), 0);
    }

    /** "Batch B" from the batch code; the full code is in the link's tooltip. */
    readonly batchShort = batchShort;

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
            this.notifySaved('Feeding voided.');
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
