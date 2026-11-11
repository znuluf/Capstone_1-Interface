import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * Trace report for one batch (DEC-72; PNS/BAFS 338:2022), or for one harvest lot code (DEC-84, /app/reports/trace/lot/:code):
 * the same sheet limited to that harvest, with feed and treatments up to its harvest and only its sales. Trace report for one batch: the fry source and certificates, the feed and chemical lots used,
 * the harvests, and every sale and disposal of that harvest. Read-only. Missing optional data reads "Not recorded".
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [title]="lotCode ? 'Trace · lot ' + lotCode : t ? 'Trace · batch ' + t.batchCode : 'Trace report'" [subtitle]="t ? (t.lotCode ? 'Batch ' + t.batchCode + ' · ' : '') + 'Pond ' + t.pondCode + ' · Cycle ' + t.cycleCode + ' · ' + (t.batchStatus | label: L.BatchStatuses) + '.' : ''" [backLink]="back().link" [backLabel]="back().label">
            @if (t?.lotCode) {
                <a class="btn btn-outline-secondary mr-1" [routerLink]="['/app/reports/trace', t.batchId]">Whole batch</a>
            }
            @if (t) {
                <button class="btn btn-primary" (click)="print()"><i class="fas fa-print mr-1"></i>Print</button>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                @if (notFound) {
                    <div class="alert alert-warning">
                        No harvest has the lot code <strong class="text-monospace">{{ lotCode }}</strong>. Check the code on the crate, receipt or tally sheet,
                        or search for it in <a routerLink="/app/harvests">Harvests</a>.
                    </div>
                } @else if (!t) {
                    <fpms-loading></fpms-loading>
                } @else {
                    <div class="card no-print">
                        <div class="card-body py-2 d-flex flex-wrap align-items-center">
                            <span class="font-weight-bold mr-2">Prepare as</span>
                            <button type="button" class="tr-chip" [attr.aria-pressed]="!buyerCopy()" (click)="buyerCopy.set(false)">Internal copy</button>
                            <button type="button" class="tr-chip" [attr.aria-pressed]="buyerCopy()" (click)="setBuyerCopy()" [disabled]="!buyers().length">Buyer copy</button>
                            @if (buyerCopy()) {
                                <label class="mb-0 ml-3 small text-muted">
                                    Prepared for
                                    <select class="form-control form-control-sm d-inline-block w-auto ml-1" [ngModel]="who()" (ngModelChange)="who.set($event)">
                                        @for (b of buyers(); track b) { <option [ngValue]="b">{{ b }}</option> }
                                    </select>
                                </label>
                            }
                            <div class="small text-muted w-100 mt-1">
                                @if (buyerCopy()) {
                                    For a buyer who asks where their shrimp came from. It shows only their own purchase and leaves out other buyers, unsold quantities and the list of missing items.
                                } @else {
                                    The full record, for the farm and for inspectors. Missing items are listed above the sheet.
                                }
                            </div>
                        </div>
                    </div>
                    @if (!buyerCopy() && gaps().length) {
                        <div class="alert alert-warning no-print">
                            <strong>{{ gaps().length }} {{ gaps().length === 1 ? 'item' : 'items' }} not recorded.</strong>
                            Record {{ gaps().length === 1 ? 'it' : 'them' }} before a buyer or inspector asks. The sheet still prints with "Not recorded" in their place.
                            <ul class="list-unstyled mb-0 mt-2">
                                @for (g of gaps(); track $index) {
                                    <li class="d-flex flex-wrap align-items-center py-1 border-top">
                                        <span class="flex-fill">{{ g.what }}<span class="small text-muted"> · {{ g.where }}</span></span>
                                        <a class="btn btn-sm btn-outline-secondary" [routerLink]="g.link">{{ g.action }}</a>
                                    </li>
                                }
                            </ul>
                        </div>
                    }
                    <article class="fpms-paper fpms-print-doc ts">
                        <header class="ts-head">
                            <div>
                                <div class="ts-eyebrow">{{ t.farmName }} · Trace report</div>
                                @if (t.lotCode) {
                                    <h1 class="ts-title">Lot <span class="ts-code">{{ t.lotCode }}</span></h1>
                                    <div class="ts-sub">
                                        @if (t.harvests[0]; as h) { {{ h.harvestType | label: L.HarvestTypes }} harvest on {{ h.harvestedAtUtc | farmDateTime }} · }
                                        Pond {{ t.pondCode }} · Batch {{ t.batchCode }} · Cycle {{ t.cycleCode }}
                                    </div>
                                } @else {
                                    <h1 class="ts-title">Batch <span class="ts-code">{{ t.batchCode }}</span></h1>
                                    <div class="ts-sub">Pond {{ t.pondCode }} · Cycle {{ t.cycleCode }} · {{ t.batchStatus | label: L.BatchStatuses }}</div>
                                }
                                <div class="ts-meta">
                                    BFAR registration @if (t.bfarRegistrationNo) { <b>{{ t.bfarRegistrationNo }}</b> } @else { <span class="ts-missing">not recorded</span> }
                                    · Generated {{ t.generatedAtUtc | farmDateTime }}@if (buyerCopy()) { · Prepared for <b>{{ who() }}</b> }
                                </div>
                            </div>
                        </header>

                        @if (t.lotCode && !buyerCopy()) {
                            @if (t.withdrawalNotMetCount) {
                                <div class="ts-status is-bad" role="alert">
                                    <strong>Withdrawal not over at harvest.</strong>
                                    {{ t.withdrawalNotMetCount }} {{ t.withdrawalNotMetCount === 1 ? "treatment's withdrawal period" : "treatments' withdrawal periods" }} ended after {{ t.lotHarvestDate | farmDate }}. Check before this lot is sold for food.
                                </div>
                            } @else if (lastSafeDate()) {
                                <div class="ts-status is-ok"><strong>Withdrawal periods ended.</strong> Every treatment's withdrawal period ended by {{ lastSafeDate() | farmDate }}, before this harvest.</div>
                            } @else {
                                <div class="ts-status is-none">
                                    <strong>No withdrawal period recorded.</strong>
                                    {{ t.treatments.length ? 'No treatment before this harvest has one.' : 'No treatment was recorded before this harvest.' }}
                                </div>
                            }
                        }

                        @if (buyerCopy()) {
                            <dl class="ts-figures is-3">
                                <div class="ts-fig"><dt>Supplied</dt><dd>{{ suppliedKg() | num: 1 }} <small>kg to {{ who() }}</small></dd></div>
                                @if (t.lotCode) {
                                    <div class="ts-fig"><dt>Harvested</dt><dd>{{ t.lotHarvestDate | farmDate }}</dd></div>
                                } @else {
                                    <div class="ts-fig"><dt>Harvests</dt><dd>{{ t.harvests.length }}</dd></div>
                                }
                                <div class="ts-fig"><dt>Hatchery</dt><dd>{{ t.frySource?.hatcheryShortCode || t.frySource?.hatcheryName || '—' }}</dd></div>
                            </dl>
                        } @else {
                            <dl class="ts-figures">
                                <div class="ts-fig"><dt>Harvested</dt><dd>{{ t.harvestedKg | num: 1 }} <small>kg</small></dd></div>
                                <div class="ts-fig"><dt>Sold</dt><dd>{{ t.soldKg | num: 1 }} <small>kg · {{ buyers().length }} {{ buyers().length === 1 ? 'buyer' : 'buyers' }}</small></dd></div>
                                <div class="ts-fig"><dt>Not sold</dt><dd>{{ t.disposedKg | num: 1 }} <small>kg</small></dd></div>
                                <div class="ts-fig" [class.is-warn]="t.unaccountedKg > 0"><dt>Not accounted for</dt><dd>{{ t.unaccountedKg | num: 1 }} <small>kg</small></dd></div>
                            </dl>
                        }

                        <!-- 01 Origin: one step back (PNS/BAFS 338:2022) -->
                        <section class="ts-sec">
                            <h2 class="ts-h"><span class="ts-num">01</span>Origin@if (t.lotCode) { <span class="ts-note">Shared by every lot of batch {{ t.batchCode }}</span> }</h2>
                            <div class="ts-h2">Fry source</div>
                            @if (t.frySource; as f) {
                                <dl class="ts-kv">
                                    <div><dt>Hatchery</dt><dd>{{ f.hatcheryName }}{{ f.hatcheryShortCode ? ' (' + f.hatcheryShortCode + ')' : '' }}</dd></div>
                                    <div><dt>BFAR accreditation</dt><dd>{{ f.accreditationStatus | label: L.AccreditationStatuses }} · @if (f.bfarAccreditationNo) { {{ f.bfarAccreditationNo }} } @else { <span class="ts-missing">no. not recorded</span> }</dd></div>
                                    <div><dt>Hatchery batch</dt><dd>{{ f.hatcheryBatchNumber }}</dd></div>
                                    <div><dt>Delivered</dt><dd>{{ f.deliveryDate | farmDate }} · {{ f.plReceived | num: 0 }} PL{{ f.plAgeDays != null ? ' · PL' + f.plAgeDays : '' }}</dd></div>
                                    <div><dt>Fry Source Certificate</dt><dd>@if (f.sfscNo) { {{ f.sfscNo }} } @else { <span class="ts-missing">Not recorded</span><span class="ts-d">Required by BFAR FAO 225-1</span> }</dd></div>
                                    <div><dt>PL health certificate</dt><dd>@if (f.plHealthCertificateNo) { {{ f.plHealthCertificateNo }} } @else { <span class="ts-missing">Not recorded</span> }</dd></div>
                                    <div><dt>Transport permit</dt><dd>@if (f.transportPermitNo) { {{ f.transportPermitNo }} } @else { <span class="ts-missing">Not recorded</span> }</dd></div>
                                </dl>
                            } @else {
                                <p class="ts-missing">Not recorded: no fry delivery is linked to this batch.</p>
                            }
                            <div class="ts-h2">Stocking</div>
                            <dl class="ts-kv">
                                <div><dt>Stocked</dt><dd>@if (t.stocking.stockingDate) { {{ t.stocking.stockingDate | farmDate }} } @else { <span class="ts-missing">Not recorded</span> }{{ t.stocking.plStocked != null ? ' · ' + (t.stocking.plStocked | num: 0) + ' PL' : '' }}{{ t.stocking.deadAtStocking != null ? ' · ' + (t.stocking.deadAtStocking | num: 0) + ' dead' : '' }}</dd></div>
                                <div><dt>Pond {{ t.pondCode }}</dt><dd>{{ t.stocking.pondAreaM2 | num: 0 }} m²{{ t.stocking.constructionType ? ' · ' + (t.stocking.constructionType | label: L.ConstructionTypes) : '' }}{{ t.stocking.farmingSystem ? ' · ' + (t.stocking.farmingSystem | label: L.FarmingSystems) : '' }}</dd></div>
                                <div><dt>Density</dt><dd>{{ t.stocking.densityPerM2 != null ? (t.stocking.densityPerM2 | num: 1) + ' PL/m²' : '—' }}{{ t.stocking.densityFlag ? ' · ' + (t.stocking.densityFlag | label: L.DensityFlags) : '' }}</dd></div>
                            </dl>
                        </section>

                        <!-- 02 Grow-out: what went into the shrimp -->
                        <section class="ts-sec">
                            <h2 class="ts-h"><span class="ts-num">02</span>Grow-out<span class="ts-note">{{ t.lotCode ? 'Feed up to the harvest day, treatments up to the harvest' : "Over the batch's whole life" }}</span></h2>
                            <div class="ts-h2">Feed <span>· {{ t.feedingSessionsFed }} {{ t.feedingSessionsFed === 1 ? 'session' : 'sessions' }} fed{{ t.feedingSessionsNotFed ? ', ' + t.feedingSessionsNotFed + ' not fed' : '' }}</span></div>
                            @if (t.feedLots.length) {
                                <div class="ts-scroll">
                                    <table class="ts-table">
                                        <colgroup><col style="width: 32%" /><col style="width: 28%" /><col style="width: 26%" /><col style="width: 14%" /></colgroup>
                                        <thead><tr><th>Product</th><th>Lot and supplier</th><th>Fed</th><th class="n">Kg</th></tr></thead>
                                        <tbody>
                                            @for (l of t.feedLots; track $index) {
                                                <tr>
                                                    <td><span class="ts-strong">{{ l.product }}</span>@if (l.feedType) { <span class="ts-d">{{ l.feedType }}</span> }</td>
                                                    <td>
                                                        @if (l.lotNumber) { <span class="ts-code">{{ l.lotNumber }}</span> } @else { <span class="ts-missing">Lot not recorded</span> }
                                                        <span class="ts-d">{{ l.supplier || 'Supplier not recorded' }}</span>
                                                        @if (l.needsReconciliation) { <span class="ts-flag" title="Stock for this lot is flagged for reconciliation, so the kg may be unreliable">Stock not reconciled</span> }
                                                    </td>
                                                    <td>@if (l.firstFedOn) { {{ l.firstFedOn | farmDate }}@if (l.lastFedOn && l.lastFedOn !== l.firstFedOn) { <span class="ts-d">to {{ l.lastFedOn | farmDate }}</span> } }</td>
                                                    <td class="n">{{ l.kg | num: 1 }}</td>
                                                </tr>
                                            }
                                        </tbody>
                                        <tfoot><tr><td colspan="3">Total feed</td><td class="n">{{ feedKg() | num: 1 }}</td></tr></tfoot>
                                    </table>
                                </div>
                            } @else {
                                <p class="ts-quiet">No feed recorded.</p>
                            }

                            <div class="ts-h2">Chemicals and supplements</div>
                            @if (t.treatments.length) {
                                <div class="ts-scroll">
                                    <table class="ts-table">
                                        @if (t.lotCode) {
                                            <colgroup><col style="width: 14%" /><col style="width: 35%" /><col style="width: 16%" /><col style="width: 22%" /><col style="width: 13%" /></colgroup>
                                        } @else {
                                            <colgroup><col style="width: 15%" /><col style="width: 41%" /><col style="width: 20%" /><col style="width: 24%" /></colgroup>
                                        }
                                        <thead><tr><th>Date</th><th>Product</th><th>Reason</th><th>Withdrawal</th>@if (t.lotCode) { <th>At harvest</th> }</tr></thead>
                                        <tbody>
                                            @for (x of t.treatments; track $index) {
                                                <tr [class.is-bad]="x.withdrawalNotMet">
                                                    <td>{{ x.date | farmDate }}@if (x.endDate) { <span class="ts-d">to {{ x.endDate | farmDate }}</span> }</td>
                                                    <td>
                                                        <span class="ts-strong">{{ x.product || 'No stock drawn' }}{{ x.activeIngredient ? ' (' + x.activeIngredient + ')' : '' }}</span>
                                                        @if (treatmentSource(x); as src) { <span class="ts-d">{{ src }}</span> }
                                                        @if (treatmentUse(x); as use) { <span class="ts-d">{{ use }}</span> }
                                                        @if (x.needsReconciliation) { <span class="ts-flag" title="Stock for this lot is flagged for reconciliation">Stock not reconciled</span> }
                                                    </td>
                                                    <td>{{ x.reason || '—' }}</td>
                                                    <td>
                                                        @if (x.withdrawalDays != null) { {{ x.withdrawalDays }} {{ x.withdrawalDays === 1 ? 'day' : 'days' }} } @else { <span class="ts-missing">Not recorded</span> }
                                                        @if (x.earliestSafeHarvestDate) { <span class="ts-d">safe from {{ x.earliestSafeHarvestDate | farmDate }}</span> }
                                                    </td>
                                                    @if (t.lotCode) {
                                                        <td>
                                                            @if (x.withdrawalNotMet) { <span class="ts-bad">Not over</span> }
                                                            @else if (x.earliestSafeHarvestDate) { <span class="ts-ok">Ended</span> }
                                                            @else { <span class="ts-quiet">—</span> }
                                                        </td>
                                                    }
                                                </tr>
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            } @else {
                                <p class="ts-quiet">None recorded.</p>
                            }
                        </section>

                        <!-- 03 Harvest -->
                        <section class="ts-sec">
                            <h2 class="ts-h"><span class="ts-num">03</span>Harvest@if (!t.lotCode) { <span class="ts-note">{{ t.harvests.length }} {{ t.harvests.length === 1 ? 'harvest' : 'harvests' }}</span> }</h2>
                            @if (t.lotCode && t.harvests[0]; as h) {
                                <dl class="ts-kv">
                                    <div><dt>Harvested</dt><dd>{{ h.harvestedAtUtc | farmDateTime }} · {{ h.harvestType | label: L.HarvestTypes }}</dd></div>
                                    <div><dt>Total</dt><dd>{{ h.totalKg | num: 1 }} kg</dd></div>
                                    <div><dt>Size grades</dt><dd>@for (g of h.grades; track g.gradeLineId; let last = $last) { {{ g.sizeLabel }} {{ g.kg | num: 1 }} kg@if (!last) { · } }</dd></div>
                                    @if (h.deadAtHarvest != null) { <div><dt>Dead at harvest</dt><dd>{{ h.deadAtHarvest | num: 0 }}</dd></div> }
                                    @if (h.finalCount != null) { <div><dt>Final count</dt><dd>{{ h.finalCount | num: 0 }}</dd></div> }
                                </dl>
                            } @else if (t.harvests.length) {
                                <div class="ts-scroll">
                                    <table class="ts-table">
                                        <colgroup><col style="width: 26%" /><col style="width: 26%" /><col style="width: 34%" /><col style="width: 14%" /></colgroup>
                                        <thead><tr><th>Lot code</th><th>Harvested</th><th>Size grades</th><th class="n">Kg</th></tr></thead>
                                        <tbody>
                                            @for (h of t.harvests; track h.harvestId) {
                                                <tr>
                                                    <td>@if (h.lotCode) { <a class="ts-code" [routerLink]="['/app/reports/trace/lot', h.lotCode]">{{ h.lotCode }}</a> } @else { <span class="ts-quiet">—</span> }</td>
                                                    <td>{{ h.harvestedAtUtc | farmDateTime }}<span class="ts-d">{{ h.harvestType | label: L.HarvestTypes }}</span></td>
                                                    <td>@for (g of h.grades; track g.gradeLineId; let last = $last) { {{ g.sizeLabel }} {{ g.kg | num: 1 }}@if (!last) { · } }</td>
                                                    <td class="n">{{ h.totalKg | num: 1 }}</td>
                                                </tr>
                                            }
                                        </tbody>
                                        <tfoot><tr><td colspan="3">Total harvested</td><td class="n">{{ t.harvestedKg | num: 1 }}</td></tr></tfoot>
                                    </table>
                                </div>
                            } @else {
                                <p class="ts-quiet">No harvest recorded.</p>
                            }
                        </section>

                        <!-- 04 Where it went: one step forward -->
                        <section class="ts-sec">
                            <h2 class="ts-h"><span class="ts-num">04</span>Where it went</h2>
                            @if (!buyerCopy()) {
                                <table class="ts-ledger">
                                    <tbody>
                                        <tr><td>Harvested</td><td class="n">{{ t.harvestedKg | num: 1 }} kg</td></tr>
                                        <tr><td>Sold to {{ buyers().length }} {{ buyers().length === 1 ? 'buyer' : 'buyers' }}</td><td class="n">− {{ t.soldKg | num: 1 }} kg</td></tr>
                                        <tr>
                                            <td>Not sold@if (t.disposals.length) { <span class="ts-d">@for (d of t.disposals; track $index; let last = $last) { {{ d.reason | label: L.DisposalReasons }} {{ d.kg | num: 1 }} kg{{ d.note ? ' (' + d.note + ')' : '' }}@if (!last) { · } }</span> }</td>
                                            <td class="n">− {{ t.disposedKg | num: 1 }} kg</td>
                                        </tr>
                                        <tr class="is-total" [class.is-warn]="t.unaccountedKg > 0"><td>Not accounted for</td><td class="n">{{ t.unaccountedKg | num: 1 }} kg</td></tr>
                                    </tbody>
                                </table>
                            }
                            <div class="ts-h2">{{ buyerCopy() ? 'Supplied to ' + who() : 'Sales by buyer' }}</div>
                            @if (salesByBuyer().length) {
                                <div class="ts-scroll">
                                    <table class="ts-table">
                                        <colgroup><col style="width: 40%" /><col style="width: 18%" /><col style="width: 12%" /><col style="width: 15%" /><col style="width: 15%" /></colgroup>
                                        <thead><tr><th>Dispatch receipt</th><th>Date</th><th>Grade</th><th class="n">Farm kg</th><th class="n">Buyer kg</th></tr></thead>
                                        <tbody>
                                            @for (b of salesByBuyer(); track b.buyer) {
                                                @if (!buyerCopy()) {
                                                    <tr class="ts-group"><td colspan="5">{{ b.buyer }}<small>{{ receiptCount(b.lines) }} {{ receiptCount(b.lines) === 1 ? 'receipt' : 'receipts' }} · {{ b.kg | num: 1 }} kg</small></td></tr>
                                                }
                                                @for (s of b.lines; track $index) {
                                                    <tr>
                                                        <td>
                                                            <a [routerLink]="['/app/sales', s.saleId]">{{ s.dispatchReceiptNo }}</a>
                                                            @if (transportOf(s); as tr) { <span class="ts-d">{{ tr }}</span> } @else { <span class="ts-d ts-missing">Transport not recorded</span> }
                                                        </td>
                                                        <td>{{ s.saleDate | farmDate }}</td>
                                                        <td>{{ s.sizeLabel }}</td>
                                                        <td class="n">{{ s.kg | num: 1 }}</td>
                                                        <td class="n">
                                                            {{ s.buyerAcceptedKg != null ? (s.buyerAcceptedKg | num: 1) : '—' }}
                                                            @if (s.buyerAcceptedKg != null && s.buyerAcceptedKg !== s.kg) {
                                                                <span class="ts-diff" [class.is-warn]="s.buyerAcceptedKg < s.kg">{{ s.buyerAcceptedKg > s.kg ? '+' : '−' }}{{ abs(s.buyerAcceptedKg - s.kg) | num: 1 }} ({{ s.buyerAcceptedKg > s.kg ? '+' : '−' }}{{ abs((s.buyerAcceptedKg - s.kg) / s.kg) * 100 | num: 1 }}%)</span>
                                                            }
                                                        </td>
                                                    </tr>
                                                }
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            } @else {
                                <p class="ts-quiet">No sale recorded.</p>
                            }
                            @if (buyerCopy()) {
                                <p class="ts-quiet mt-2 mb-0">Other buyers, unsold quantities and internal notes are left out of this copy.</p>
                            }
                        </section>

                        <div class="ts-signoff">
                            @if (buyerCopy()) {
                                <div>Released by (farm)</div><div>Date</div><div>Received by ({{ who() }})</div>
                            } @else {
                                <div>Prepared by</div><div>Checked by (Farm Owner)</div><div>Date</div>
                            }
                        </div>
                        <p class="ts-foot">Voided entries are not listed; the activity log keeps them. This sheet reads the farm's records and is not an official certificate.</p>
                    </article>
                }
            </div>
        </section>
    `,
    styles: [
        `
            /* Trace sheet (DEC-72, DEC-84): quiet, typographic layout. Hairlines, one accent, colour only for status. */
            .ts {
                --ts-ink: var(--fpms-text, #232d36);
                --ts-muted: var(--fpms-muted, #596872);
                --ts-line: var(--fpms-line, #dce4e3);
                --ts-rule: var(--fpms-line-strong, #c5d0d0);
                --ts-bad: var(--fpms-error, #b33a3a);
                --ts-warn: var(--fpms-warning-text, #8a5600);
                --ts-ok: var(--fpms-success, #287a4b);
                color: var(--ts-ink);
                font-size: 0.9rem;
                line-height: 1.5;
                font-variant-numeric: tabular-nums;
            }
            .ts-eyebrow {
                font-size: 0.72rem;
                font-weight: 600;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--ts-muted);
            }
            .ts-head {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                align-items: flex-end;
                gap: 0.75rem 2rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid var(--ts-ink);
            }
            .ts-title {
                font-size: 1.75rem;
                font-weight: 600;
                line-height: 1.15;
                margin: 0.15rem 0 0.35rem;
                letter-spacing: -0.01em;
            }
            .ts-code {
                white-space: nowrap;
                font-family: var(--fpms-mono, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace);
                font-weight: 600;
                letter-spacing: 0;
            }
            .ts-sub {
                color: var(--ts-muted);
            }
            .ts-meta {
                margin-top: 0.15rem;
                font-size: 0.8rem;
                color: var(--ts-muted);
            }
            .ts-meta b {
                font-weight: 600;
                color: var(--ts-ink);
            }

            /* One sentence that answers the food-safety question. */
            .ts-status {
                margin: 1rem 0 0;
                padding: 0.6rem 0.85rem;
                border-left: 3px solid var(--ts-ok);
                background: #f3f8f5;
            }
            .ts-status.is-bad {
                border-left-color: var(--ts-bad);
                background: #fbf0f0;
            }
            .ts-status.is-none {
                border-left-color: var(--ts-rule);
                background: transparent;
            }
            .ts-status strong {
                margin-right: 0.4rem;
            }
            .ts-status.is-bad strong {
                color: var(--ts-bad);
            }
            .ts-status.is-ok strong {
                color: var(--ts-ok);
            }

            /* Key figures: no boxes, hairline separators. */
            .ts-figures {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                margin: 1.25rem 0 0;
                border-bottom: 1px solid var(--ts-line);
                padding-bottom: 1rem;
            }
            .ts-figures.is-3 {
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }
            .ts-fig {
                padding: 0 1rem;
                border-left: 1px solid var(--ts-line);
            }
            .ts-fig:first-child {
                padding-left: 0;
                border-left: 0;
            }
            .ts-fig dt {
                font-size: 0.72rem;
                font-weight: 600;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--ts-muted);
            }
            .ts-fig dd {
                margin: 0.1rem 0 0;
                font-size: 1.35rem;
                font-weight: 600;
                line-height: 1.2;
            }
            .ts-fig dd small {
                font-size: 0.8rem;
                font-weight: 400;
                color: var(--ts-muted);
            }
            .ts-fig.is-warn dd {
                color: var(--ts-warn);
            }

            /* Sections */
            .ts-sec {
                margin-top: 2rem;
            }
            .ts-h {
                display: flex;
                align-items: baseline;
                gap: 0.75rem;
                margin: 0 0 0.75rem;
                padding-bottom: 0.4rem;
                border-bottom: 1px solid var(--ts-rule);
                font-size: 1rem;
                font-weight: 600;
                break-after: avoid;
            }
            .ts-h .ts-num {
                font-size: 0.75rem;
                color: var(--ts-muted);
                font-weight: 600;
                letter-spacing: 0.06em;
            }
            .ts-h {
                flex-wrap: wrap;
            }
            .ts-h .ts-note {
                margin-left: auto;
                font-size: 0.8rem;
                font-weight: 400;
                color: var(--ts-muted);
                text-align: right;
            }
            .ts-h2 {
                margin: 1.25rem 0 0.35rem;
                font-size: 0.72rem;
                font-weight: 600;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--ts-muted);
                break-after: avoid;
            }
            .ts-h2 span {
                text-transform: none;
                letter-spacing: 0;
                font-weight: 400;
            }

            /* Label / value lists */
            .ts-kv {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0 2.5rem;
                margin: 0;
            }
            .ts-kv > div {
                display: grid;
                grid-template-columns: 9rem minmax(0, 1fr);
                gap: 0.75rem;
                padding: 0.4rem 0;
                border-bottom: 1px solid var(--ts-line);
                break-inside: avoid;
            }
            .ts-kv dt {
                font-weight: 400;
                color: var(--ts-muted);
            }
            .ts-kv dd {
                margin: 0;
            }

            .ts-scroll {
                overflow-x: auto;
            }
            .ts-scroll > .ts-table {
                min-width: 40rem;
            }

            /* Tables: a tinted header band, roomy rows, hairlines between them, numbers right-aligned. */
            .ts-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
                margin: 0;
            }
            .ts-table th {
                font-size: 0.72rem;
                font-weight: 600;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                color: var(--ts-ink);
                text-align: left;
                padding: 0.45rem 0.75rem;
                background: var(--fpms-ground-muted, #eef3f2);
                border-bottom: 1px solid var(--ts-rule);
                white-space: nowrap;
            }
            .ts-table td {
                padding: 0.65rem 0.75rem;
                border-bottom: 1px solid var(--ts-line);
                vertical-align: top;
                overflow-wrap: anywhere;
            }
            .ts-table tr {
                break-inside: avoid;
            }
            .ts-table tbody tr:hover td {
                background: #fafbfb;
            }
            .ts-table .n {
                text-align: right;
                white-space: nowrap;
            }
            .ts-table td.n {
                font-weight: 500;
            }
            .ts-table tfoot td {
                font-weight: 600;
                border-bottom: 0;
                border-top: 2px solid var(--ts-ink);
            }
            .ts-table .ts-group td {
                padding: 0.55rem 0.75rem 0.4rem;
                font-weight: 600;
                background: transparent;
                border-bottom: 1px solid var(--ts-rule);
            }
            .ts-table .ts-group + tr td,
            .ts-table tbody tr:first-child td {
                border-top: 0;
            }
            .ts-table .ts-group td small {
                font-weight: 400;
                color: var(--ts-muted);
                margin-left: 0.4rem;
            }
            .ts-table tbody .ts-group:not(:first-child) td {
                padding-top: 1.1rem;
            }
            .ts-table tr.is-bad td {
                background: #fbf0f0;
            }
            .ts-table tr.is-bad td:first-child {
                box-shadow: inset 3px 0 0 var(--ts-bad);
            }
            .ts-table .ts-strong {
                font-weight: 600;
            }
            .ts-diff {
                display: block;
                font-size: 0.75rem;
                font-weight: 400;
                color: var(--ts-muted);
            }
            .ts-diff.is-warn {
                color: var(--ts-warn);
            }
            .ts-d {
                display: block;
                font-size: 0.8rem;
                color: var(--ts-muted);
            }
            .ts-nowrap {
                white-space: nowrap;
            }
            .ts-missing {
                color: var(--ts-warn);
            }
            .ts-flag {
                display: block;
                font-size: 0.75rem;
                color: var(--ts-warn);
                white-space: nowrap;
            }
            .ts-bad {
                color: var(--ts-bad);
                font-weight: 600;
            }
            .ts-ok {
                color: var(--ts-ok);
            }
            .ts-quiet {
                color: var(--ts-muted);
            }

            /* Where it went: an account of the kilos. */
            .ts-ledger {
                width: 100%;
                max-width: 26rem;
                border-collapse: collapse;
                margin-bottom: 0.5rem;
            }
            .ts-ledger td {
                padding: 0.3rem 0;
                border-bottom: 1px solid var(--ts-line);
            }
            .ts-ledger td.n {
                text-align: right;
                white-space: nowrap;
            }
            .ts-ledger tr.is-total td {
                font-weight: 600;
                border-top: 1px solid var(--ts-ink);
                border-bottom: 0;
            }
            .ts-ledger tr.is-warn td {
                color: var(--ts-warn);
                font-weight: 600;
            }
            .ts-ledger .ts-d {
                padding-left: 1rem;
            }

            .ts-signoff {
                display: none;
            }
            .ts-foot {
                margin: 2rem 0 0;
                padding-top: 0.6rem;
                border-top: 1px solid var(--ts-line);
                font-size: 0.75rem;
                color: var(--ts-muted);
            }

            @media (max-width: 640px) {
                .ts-title {
                    font-size: 1.4rem;
                }
                .ts-h .ts-note {
                    margin-left: 0;
                    width: 100%;
                    text-align: left;
                }
                .ts-figures,
                .ts-figures.is-3 {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    row-gap: 0.75rem;
                }
                .ts-fig:nth-child(3) {
                    padding-left: 0;
                    border-left: 0;
                }
                .ts-kv {
                    grid-template-columns: 1fr;
                }
                .ts-kv > div {
                    grid-template-columns: 8.5rem minmax(0, 1fr);
                }
            }

            @media print {
                .ts-scroll {
                    overflow: visible;
                }
                .ts-scroll > .ts-table {
                    min-width: 0;
                }
                .ts {
                    font-size: 9pt;
                    color: #000;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .ts-title {
                    font-size: 18pt;
                }
                .ts-fig dd {
                    font-size: 13pt;
                }
                .ts-sec {
                    margin-top: 14pt;
                }
                .ts-h {
                    font-size: 10.5pt;
                }
                .ts-table td {
                    padding: 3.5pt 5pt;
                }
                .ts-table th {
                    padding: 3pt 5pt;
                    font-size: 6.5pt;
                }
                .ts-table thead {
                    display: table-header-group;
                }
                .ts-table tfoot {
                    display: table-row-group;
                }
                .ts-kv > div {
                    padding: 2.5pt 0;
                }
                .ts-d {
                    font-size: 7.5pt;
                    color: #444;
                }
                .ts-fig dt,
                .ts-h2,
                .ts-eyebrow,
                .ts-kv dt {
                    color: #444;
                }
                .ts-signoff {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0 14pt;
                    margin-top: 40pt;
                    font-size: 8pt;
                    break-inside: avoid;
                }
                .ts-signoff div {
                    border-top: 1px solid #000;
                    padding-top: 3pt;
                    text-align: center;
                }
            }
            .tr-chip {
                min-height: 36px;
                padding: 0 0.9rem;
                margin-right: 0.4rem;
                border-radius: 18px;
                border: 1px solid var(--fpms-line-strong);
                background: var(--fpms-surface);
                font-size: 0.9rem;
                cursor: pointer;
            }
            .tr-chip[aria-pressed='true'] {
                background: var(--fpms-primary);
                border-color: var(--fpms-primary);
                color: #fff;
            }
        `,
    ],
})
export class TraceReportComponent extends FpmsPage implements OnInit {
    t: any = null;
    batchId = '';
    /** Set for a lot trace (DEC-84). */
    lotCode = '';
    notFound = false;
    /** Where the sheet was opened from (?from=sales|harvests|reports); the page then belongs to that section. */
    readonly from = this.query('from');

    back(): { link: any; label: string } {
        if (this.from === 'sales') return { link: '/app/sales', label: 'Sales' };
        if (this.from === 'harvests') return { link: '/app/harvests', label: 'Harvests' };
        if (this.from === 'reports') return { link: '/app/reports', label: 'Reports' };
        const batch = this.batchId || this.t?.batchId;
        return batch ? { link: ['/app/production/batches', batch], label: 'Batch' } : { link: '/app/reports', label: 'Reports' };
    }
    private readonly tick = signal(0);
    buyerCopy = signal(false);
    who = signal('');

    /** The buyers that bought from this batch, for the "Prepared for" choice. */
    buyers = computed<string[]>(() => {
        this.tick();
        return Array.from(new Set<string>((this.t?.sales ?? []).map((s: any) => s.buyerName))).sort();
    });

    /** Sales shown on the sheet: all of them, or only the chosen buyer's in a buyer copy. */
    visibleSales = computed<any[]>(() => {
        this.tick();
        const all: any[] = this.t?.sales ?? [];
        return this.buyerCopy() ? all.filter((s) => s.buyerName === this.who()) : all;
    });

    suppliedKg = computed(() => {
        this.tick();
        return this.visibleSales().reduce((n, s) => n + (s.buyerAcceptedKg ?? s.kg), 0);
    });

    /** Total kg of feed listed. */
    feedKg = computed(() => {
        this.tick();
        return (this.t?.feedLots ?? []).reduce((n: number, l: any) => n + (l.kg || 0), 0);
    });

    /** The visible sales grouped by buyer, with each buyer's farm kg. */
    salesByBuyer = computed<{ buyer: string; kg: number; lines: any[] }[]>(() => {
        this.tick();
        const by = new Map<string, { buyer: string; kg: number; lines: any[] }>();
        for (const s of this.visibleSales()) {
            const g = by.get(s.buyerName) ?? { buyer: s.buyerName, kg: 0, lines: [] };
            g.kg += s.kg;
            g.lines.push(s);
            by.set(s.buyerName, g);
        }
        return Array.from(by.values());
    });

    /** A treatment's lot and supplier, as one quiet line. */
    treatmentSource(x: any): string {
        return [x.lotNumber ? 'Lot ' + x.lotNumber : '', x.supplier].filter((v) => !!v).join(' · ');
    }

    /** How much was used and how: quantity, dose and method, prescription. */
    treatmentUse(x: any): string {
        const dose = [x.dosage != null ? `${x.dosage} ${x.dosageUnit || ''}`.trim() : '', x.method].filter((v) => !!v).join(', ');
        return [x.quantity, dose, x.prescriptionRef ? 'Rx ' + x.prescriptionRef : ''].filter((v) => !!v).join(' · ');
    }

    /** Distinct dispatch receipts among a buyer's sale lines. */
    receiptCount(lines: any[]): number {
        return new Set(lines.map((l) => l.saleId)).size;
    }

    abs(n: number): number {
        return Math.abs(n);
    }

    /** A sale's transport details as one line, or '' when none is recorded. */
    transportOf(s: any): string {
        return [s.transporter, s.driverName, s.plateNo, s.destination ? 'to ' + s.destination : '', s.localTransportPermitNo ? 'permit ' + s.localTransportPermitNo : '']
            .filter((v) => !!v).join(' · ');
    }

    /** Lot sheet: the latest earliest-safe-harvest date among the treatments before the harvest, if any has a withdrawal period. */
    lastSafeDate = computed<string | null>(() => {
        this.tick();
        const dates: string[] = (this.t?.treatments ?? []).map((x: any) => x.earliestSafeHarvestDate).filter((d: string | null) => !!d);
        return dates.length ? dates.sort()[dates.length - 1] : null;
    });

    /** Things the sheet prints as "Not recorded", each with the place to record it. */
    gaps = computed<{ what: string; where: string; action: string; link: any[] }[]>(() => {
        this.tick();
        const t = this.t;
        if (!t) {
            return [];
        }
        const out: { what: string; where: string; action: string; link: any[] }[] = [];
        const f = t.frySource;
        const delivery = f ? ['/app/resources/fry-deliveries', f.deliveryId] : ['/app/resources/fry-deliveries'];
        if (f) {
            if (!f.plHealthCertificateNo) out.push({ what: 'PL health certificate number', where: 'Origin · ' + f.hatcheryBatchNumber, action: 'Open fry delivery', link: delivery });
            if (!f.sfscNo) out.push({ what: 'Shrimp Fry Source Certificate number', where: 'Origin · ' + f.hatcheryBatchNumber, action: 'Open fry delivery', link: delivery });
            if (!f.transportPermitNo) out.push({ what: 'Transport permit (DTP/LTP)', where: 'Origin · ' + f.hatcheryBatchNumber, action: 'Open fry delivery', link: delivery });
            if (!f.bfarAccreditationNo) out.push({ what: 'Hatchery BFAR accreditation number', where: 'Origin · ' + f.hatcheryName, action: 'Open hatcheries', link: ['/app/resources/hatcheries'] });
        }
        if (!t.bfarRegistrationNo) out.push({ what: 'Farm BFAR registration number', where: 'Farm profile', action: 'Open farm profile', link: ['/app/farm/profile'] });
        for (const l of t.feedLots ?? []) {
            if (!l.lotNumber) out.push({ what: `Lot number for ${l.product}`, where: 'Grow-out · feed', action: 'Open inventory', link: ['/app/inventory'] });
        }
        for (const x of t.treatments ?? []) {
            if (x.withdrawalDays == null) out.push({ what: `Withdrawal period for ${x.product || 'a treatment'}`, where: 'Grow-out · chemicals and supplements', action: 'Open inventory', link: ['/app/inventory'] });
        }
        for (const s of t.sales ?? []) {
            if (!s.transporter && !s.driverName && !s.plateNo && !s.destination && !s.localTransportPermitNo) {
                out.push({ what: `Transport details for ${s.dispatchReceiptNo}`, where: `Where it went · sale to ${s.buyerName}`, action: 'Open sale', link: ['/app/sales', s.saleId, 'edit'] });
            }
        }
        return out;
    });

    setBuyerCopy(): void {
        if (!this.who() || !this.buyers().includes(this.who())) {
            this.who.set(this.buyers()[0] ?? '');
        }
        this.buyerCopy.set(true);
    }

    /** A4 page with a footer naming the sheet and the page count (Chrome and Edge print margin boxes). */
    private readonly pageStyle = (() => {
        const el = document.createElement('style');
        el.id = 'fpms-trace-page';
        document.head.appendChild(el);
        inject(DestroyRef).onDestroy(() => el.remove());
        return el;
    })();

    private setPageFooter(): void {
        const t = this.t;
        const quote = (v: string) => '"' + (v ?? '').replace(/["\\]/g, '').replace(/\s+/g, ' ') + '"';
        const name = !t ? 'Trace report' : t.lotCode ? `${t.farmName} · Trace report, lot ${t.lotCode}` : `${t.farmName} · Trace report, batch ${t.batchCode}`;
        this.pageStyle.textContent =
            `@page { size: A4; margin: 14mm 12mm 16mm 12mm; ` +
            `@bottom-left { content: ${quote(name)}; font-size: 8pt; color: #555; } ` +
            `@bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #555; } }`;
    }

    ngOnInit(): void {
        this.route.paramMap.subscribe(() => this.init());
    }

    async init(): Promise<void> {
        this.lotCode = this.param('code') ?? '';
        this.batchId = this.lotCode ? '' : (this.param('id') ?? '');
        this.t = null;
        this.notFound = false;
        this.t = this.lotCode
            ? await this.run(() => this.api.get<any>('Trace', 'GetLotTrace', { lotCode: this.lotCode }))
            : await this.run(() => this.api.get<any>('Trace', 'GetBatchTrace', { batchId: this.batchId }));
        this.notFound = !!this.lotCode && !this.t;
        this.buyerCopy.set(false);
        this.who.set('');
        this.tick.update((n) => n + 1);
        this.setPageFooter();
        this.setPageTitle(this.lotCode ? `Trace lot ${this.lotCode}` : this.t ? `Trace ${this.t.batchCode}` : null);
    }
}
