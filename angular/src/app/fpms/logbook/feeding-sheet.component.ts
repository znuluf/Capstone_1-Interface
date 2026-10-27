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
    clientRequestId: string;
}

/**
 * Feeding (Ref 6.1; Journey 4; AC-11, AC-22, AC-25; DEC-50, DEC-54): AM and PM sessions for every open batch on the farm
 * on one day, listed by pond (a cycle filter is optional). A session is either Fed, with kilograms from one or more feed
 * lots, or Not fed. Saving a session that already exists corrects it (stock is reversed and drawn again). Unsaved entries
 * are kept as a per-user draft in the browser.
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Feeding" subtitle="AM and PM feeding for every stocked pond" backLink="/app/logbook" backLabel="Logbooks"></fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid fpms-narrow">
                <div class="card">
                    <div class="card-body pb-1">
                        <div class="form-row align-items-end">
                            <div class="form-group col-md-6">
                                <label for="cycle">Ponds</label>
                                <select id="cycle" class="form-control" [(ngModel)]="cycleId" (ngModelChange)="load()">
                                    <option [ngValue]="null">All stocked ponds</option>
                                    @for (c of cycles; track c.id) {
                                        <option [ngValue]="c.id">Cycle {{ c.cycleCode }}{{ c.hatcheryShortCode ? ' · ' + c.hatcheryShortCode : '' }}</option>
                                    }
                                </select>
                            </div>
                            <div class="form-group col-md-4">
                                <label for="date">Feeding date</label>
                                <input id="date" type="date" class="form-control" [(ngModel)]="feedDate" (ngModelChange)="load()" [max]="today" />
                            </div>
                            <div class="form-group col-md-2">
                                <button type="button" class="btn btn-default btn-block" (click)="feedDate = today; load()" [disabled]="feedDate === today">Today</button>
                            </div>
                        </div>
                        @if (!cycles.length && !loading) {
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
                    @for (row of sheet.rows; track row.batchId) {
                        <div class="card" [class.card-outline]="row.batchId === focusBatchId" [class.card-primary]="row.batchId === focusBatchId">
                            <div class="card-header d-flex align-items-center">
                                <h3 class="card-title mr-auto">
                                    <a [routerLink]="['/app/production/batches', row.batchId]">{{ row.pondCode }} · {{ row.batchCode }}</a>
                                    @if (!cycleId && row.cycleCode) { <small class="text-muted ml-1">cycle {{ row.cycleCode }}</small> }
                                </h3>
                                <fpms-badge [text]="row.status | label: L.BatchStatuses"></fpms-badge>
                            </div>
                            <div class="card-body">
                                <div class="form-row">
                                    @for (s of sessionTimes; track s) {
                                        <div class="col-md-6 mb-2">
                                            @let existing = s === 1 ? row.am : row.pm;
                                            @let e = entry(row.batchId, s);
                                            <div class="border rounded p-2 h-100">
                                                <div class="d-flex align-items-center mb-1">
                                                    @if (!existing) {
                                                        <div class="custom-control custom-checkbox mr-auto">
                                                            <input type="checkbox" class="custom-control-input" [id]="'fed' + row.batchId + s" [(ngModel)]="e.open" (ngModelChange)="keepDraft()" [disabled]="!canCreate || !feedLots.length" />
                                                            <label class="custom-control-label font-weight-bold" [for]="'fed' + row.batchId + s">Record {{ s | label: L.FeedingSessions }}</label>
                                                        </div>
                                                    } @else if (existing.status === 2) {
                                                        <strong class="mr-auto">{{ s | label: L.FeedingSessions }}: <span class="text-muted">Not fed</span></strong>
                                                    } @else {
                                                        <strong class="mr-auto">{{ s | label: L.FeedingSessions }}: {{ existing.kg | num: 3 }} kg</strong>
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

                                                @if (existing && !e.open) {
                                                    <div class="small">
                                                        @for (l of existing.lines; track l.lotId) {
                                                            <div>{{ l.label }}: {{ l.kg | num: 3 }} kg</div>
                                                        }
                                                        @if (existing.notes) { <div class="text-muted">{{ existing.notes }}</div> }
                                                        <div class="text-muted">Recorded by {{ existing.recordedBy }}, {{ existing.creationTime | farmDateTime }}</div>
                                                    </div>
                                                    @if (voiding?.id === existing.id) {
                                                        <div class="mt-2">
                                                            <label class="small mb-1" [for]="'vr' + existing.id">Reason for voiding <span class="text-danger">*</span></label>
                                                            <input [id]="'vr' + existing.id" class="form-control form-control-sm mb-1" [(ngModel)]="voiding.reason" maxlength="500" placeholder="e.g. entered on the wrong pond" />
                                                            <button type="button" class="btn btn-sm btn-danger mr-1" (click)="voidSession(existing)" [disabled]="busy() || !voiding.reason.trim()">Void session</button>
                                                            <button type="button" class="btn btn-sm btn-default" (click)="voiding = null">Cancel</button>
                                                            <small class="d-block text-muted mt-1">Its feed is returned to stock with reversing movements.</small>
                                                        </div>
                                                    }
                                                }

                                                @if (e.open) {
                                                    <div class="btn-group btn-group-sm btn-group-toggle mb-2" role="group" aria-label="Fed or not fed">
                                                        <button type="button" class="btn" [class.btn-primary]="e.status === 1" [class.btn-outline-primary]="e.status !== 1" [attr.aria-pressed]="e.status === 1" (click)="e.status = 1; keepDraft()">Fed</button>
                                                        <button type="button" class="btn" [class.btn-secondary]="e.status === 2" [class.btn-outline-secondary]="e.status !== 2" [attr.aria-pressed]="e.status === 2" (click)="e.status = 2; keepDraft()">Not fed</button>
                                                    </div>
                                                    @if (e.status === 2) {
                                                        <small class="d-block text-muted mb-1">Saved as a deliberate skip (for example a molt, a treatment or bad weather). No stock is drawn.</small>
                                                    }
                                                    @for (l of (e.status === 1 ? e.lines : []); track l.key) {
                                                        <div class="form-row mb-1">
                                                            <div class="col-7">
                                                                <select class="form-control form-control-sm" [(ngModel)]="l.lotId" (ngModelChange)="keepDraft()" aria-label="Feed lot">
                                                                    @for (o of feedLots; track o.lotId) {
                                                                        <option [value]="o.lotId">{{ o.label }}</option>
                                                                    }
                                                                </select>
                                                            </div>
                                                            <div class="col-4">
                                                                <div class="input-group input-group-sm">
                                                                    <input type="number" min="0.001" max="1000" step="0.001" inputmode="decimal" class="form-control" [(ngModel)]="l.kg" (ngModelChange)="keepDraft()" aria-label="Kilograms fed" placeholder="kg" />
                                                                    <div class="input-group-append"><span class="input-group-text">kg</span></div>
                                                                </div>
                                                            </div>
                                                            <div class="col-1">
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
                                                    <input class="form-control form-control-sm mt-1" [(ngModel)]="e.notes" (ngModelChange)="keepDraft()" maxlength="500" [placeholder]="e.status === 2 ? 'Reason (optional)' : 'Notes (optional)'" aria-label="Notes" />
                                                    @if (existing) {
                                                        <button type="button" class="btn btn-sm btn-link px-0" (click)="cancelEdit(row.batchId, s)">Cancel correction</button>
                                                    }
                                                    @if (e.status === 1 && total(e) > 1000) {
                                                        <small class="d-block text-danger">More than 1,000 kg in one session is not allowed.</small>
                                                    }
                                                }
                                            </div>
                                        </div>
                                    }
                                </div>
                            </div>
                        </div>
                    } @empty {
                        <fpms-empty [text]="cycleId ? 'This cycle has no open batches.' : 'No pond is stocked on this date.'" icon="fas fa-utensils"></fpms-empty>
                    }

                    @if (canCreate && sheet.rows.length) {
                        <div class="d-flex align-items-center mb-3">
                            <button type="button" class="btn btn-primary btn-lg mr-3" (click)="save()" [disabled]="busy() || !pending().length || !valid()">
                                @if (busy()) { <i class="fas fa-spinner fa-spin mr-1"></i> }
                                Save {{ pending().length || '' }} session{{ pending().length === 1 ? '' : 's' }}
                            </button>
                            <span class="small text-muted">Only ticked or corrected sessions are saved. Fed sessions draw stock from the chosen lots.</span>
                        </div>
                    }
                }
            </div>
        </section>
    `,
})
export class FeedingSheetComponent extends FpmsPage implements OnInit {
    readonly sessionTimes = [1, 2];
    loading = true;
    cycles: any[] = [];
    cycleId: string | null = null;
    feedDate = FarmTime.today();
    focusBatchId: string | null = null;
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
        const [cycles, lots] = await Promise.all([
            this.api.get<any[]>('Cycle', 'GetAll', { status: 2 }),
            this.api.get<any[]>('Inventory', 'GetLotOptions', { category: 1 }),
        ]);
        this.cycles = cycles;
        this.feedLots = lots;
        this.focusBatchId = this.query('batchId');
        const date = this.query('date');
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= this.today) {
            this.feedDate = date;
        }
        // DEC-54: the sheet is farm-wide by default; a cycle filter comes only from a link.
        const cycleId = this.query('cycleId');
        this.cycleId = cycleId && this.cycles.some((c) => c.id === cycleId) ? cycleId : null;
        await this.load();
    }

    private get draftKey(): string {
        return `feeding.${this.cycleId ?? 'farm'}.${this.feedDate}`;
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
        if (this.cycleId) {
            OpsMemory.set({ ...OpsMemory.get(), cycleId: this.cycleId });
        }
        const params: any = { feedDate: this.feedDate };
        if (this.cycleId) {
            params.cycleId = this.cycleId;
        }
        this.sheet = await this.run(() => this.api.get<any>('Feeding', 'GetSheet', params));
        this.entries = {};
        for (const row of this.sheet?.rows ?? []) {
            for (const s of this.sessionTimes) {
                this.entries[`${row.batchId}.${s}`] = this.closedEntry();
            }
        }
        const draft = FormDrafts.load<Record<string, Entry>>(this.draftKey);
        let restored = 0;
        for (const [k, e] of Object.entries(draft?.data ?? {})) {
            if (e.open && this.entries[k]) {
                this.entries[k] = { ...e, status: e.status ?? 1, lines: e.lines.map((l) => ({ ...l, key: ++this.lineKey })) };
                restored++;
            }
        }
        this.restoredAt = restored ? new Date(draft!.savedAt).toISOString() : null;
        this.loading = false;
    }

    entry(batchId: string, s: number): Entry {
        return this.entries[`${batchId}.${s}`];
    }

    private closedEntry(): Entry {
        return { open: false, status: 1, lines: [this.newLine()], notes: '', clientRequestId: newGuid() };
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
        this.entries[`${batchId}.${s}`] = { open: true, status: existing.status ?? 1, lines: lines.length ? lines : [this.newLine()], notes: existing.notes ?? '', clientRequestId: newGuid() };
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
