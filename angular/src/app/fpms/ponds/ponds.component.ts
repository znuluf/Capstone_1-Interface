import { Component, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FPMS_IMPORTS } from '../shared-imports';
import { ClientListFilter } from '@shared/fpms/client-list';

/** Pond Configuration Management (Ref 4.1) and status overview (Ref 4.2). */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Ponds" subtitle="Pond master data and current status">
            <a routerLink="/app/ponds/prefixes" class="btn btn-default mr-2"><i class="fas fa-tags mr-1"></i>Name prefixes</a>
            @if (can('Farm.Ponds.Manage')) {
                <a routerLink="/app/ponds/new" class="btn btn-primary"><i class="fas fa-plus mr-1"></i>New pond</a>
            }
        </fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="card">
                    <div class="card-header">
                        <fpms-list-toolbar
                            placeholder="Search by pond, purpose or batch"
                            [search]="f.search()"
                            [resultText]="f.resultText()"
                            [chips]="f.chips()"
                            [chip]="f.chip()"
                            (searchChange)="f.search.set($event)"
                            (chipChange)="f.chip.set($event)"></fpms-list-toolbar>
                    </div>
                    <div class="card-body p-0 table-responsive">
                        @if (!ponds()) {
                            <fpms-loading></fpms-loading>
                        } @else if (f.noMatch()) {
                            <fpms-empty text="No ponds match. Clear the search or the filter." icon="fas fa-water"></fpms-empty>
                        } @else if (!ponds().length) {
                            <fpms-empty text="No ponds yet. Add your ponds before planning a production cycle." icon="fas fa-water">
                                @if (can('Farm.Ponds.Manage')) {
                                    <a routerLink="/app/ponds/new" class="btn btn-sm btn-primary">Add a pond</a>
                                }
                            </fpms-empty>
                        } @else {
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th>Pond ID</th><th>Name</th><th class="text-right">Area (m²)</th><th class="text-right">Depth avg / max (m)</th>
                                        <th>Purpose</th><th>Construction</th><th>Farming system</th><th>Status</th><th>Current batch</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (p of f.visible(); track p.id) {
                                        <tr>
                                            <td><a [routerLink]="['/app/ponds', p.id]">{{ p.pondCode }}</a></td>
                                            <td>{{ p.name }}</td>
                                            <td class="text-right">{{ p.areaM2 | num: 0 }}</td>
                                            <td class="text-right">{{ p.averageDepthM | num: 2 }} / {{ p.maxDepthM | num: 2 }}</td>
                                            <td>{{ p.purpose | label: L.PondPurposes }}</td>
                                            <td>{{ p.constructionType | label: L.ConstructionTypes }}</td>
                                            <td>
                                                {{ p.farmingSystem | label: L.FarmingSystems }}
                                                @if (p.farmingSystemOverride == null) {
                                                    <span class="small text-muted">(farm)</span>
                                                }
                                                @if (p.systemWarning) {
                                                    <i class="fas fa-exclamation-triangle text-warning ml-1" [title]="p.systemWarning" aria-label="Unusual for this pond type"></i>
                                                }
                                            </td>
                                            <td><fpms-badge [text]="p.status | label: L.PondDisplayStatuses"></fpms-badge></td>
                                            <td>
                                                @if (p.currentBatchId) {
                                                    <a [routerLink]="['/app/production/batches', p.currentBatchId]">{{ p.currentBatchCode }}</a>
                                                    <span class="small text-muted"> ({{ p.currentBatchStatus | label: L.BatchStatuses }})</span>
                                                } @else {
                                                    <span class="text-muted">—</span>
                                                }
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        }
                    </div>
                </div>
            </div>
        </section>
    `,
})
export class PondsComponent extends FpmsPage implements OnInit {
    ponds = signal<any[] | null>(null);
    f = new ClientListFilter<any>(
        () => this.ponds(),
        (p) => [p.pondCode, p.name, p.currentBatchCode, this.L.PondPurposes[p.purpose], this.L.ConstructionTypes[p.constructionType]],
        (p) => p.status,
        Object.entries(this.L.PondDisplayStatuses).map(([value, label]) => ({ value: Number(value), label: label as string })),
        'All ponds',
        ['pond', 'ponds']
    );

    async ngOnInit(): Promise<void> {
        this.ponds.set(await this.api.get<any[]>('Pond', 'GetAll'));
    }
}
