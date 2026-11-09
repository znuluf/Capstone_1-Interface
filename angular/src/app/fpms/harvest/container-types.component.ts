import { Component, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { EMPTY_GUID } from '@shared/fpms/farm-time';
import { FPMS_IMPORTS } from '../shared-imports';

/**
 * The farm's crate types (DEC-80). "Crate" is the standard word; a type names it (banyera, tub, box) for the crate tally's
 * quick add. The usual kg prefills the quick add; an empty weight (tare) means the crate is on the scale and is subtracted.
 * One can be the default. The code keeps the name ContainerType.
 */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header title="Crate types" subtitle="Name the crates you weigh with (banyera, tub, box). A crate with no type is just called a crate." backLink="/app/harvests" backLabel="Harvests"></fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid">
                <div class="row">
                    <div class="col-xl-8">
                        <div class="card">
                            <div class="card-body p-0 table-responsive">
                                @if (!types()) {
                                    <fpms-loading></fpms-loading>
                                } @else if (!types()?.length) {
                                    <fpms-empty text="No crate types yet. Crates are recorded as "Crate". Add a type (e.g. Banyera, 30 kg) so the crate tally can fill in its name and weight." icon="fas fa-box"></fpms-empty>
                                } @else {
                                    <table class="table mb-0">
                                        <thead>
                                            <tr><th>Name</th><th class="text-right">Usual kg</th><th class="text-right">Empty weight (kg)</th><th class="text-right">Order</th><th>Default</th><th>Active</th><th></th></tr>
                                        </thead>
                                        <tbody>
                                            @for (t of types(); track t.id) {
                                                <tr [class.text-muted]="!t.isActive">
                                                    @if (canManage) {
                                                        <td><input class="form-control form-control-sm" [(ngModel)]="t.name" maxlength="40" [attr.aria-label]="'Name ' + t.name" /></td>
                                                        <td><input type="number" min="0.001" step="0.001" class="form-control form-control-sm text-right" [(ngModel)]="t.nominalKg" aria-label="Usual kg" /></td>
                                                        <td><input type="number" min="0.001" step="0.001" class="form-control form-control-sm text-right" [(ngModel)]="t.tareKg" aria-label="Empty weight (kg)" placeholder="none" /></td>
                                                        <td style="width: 6rem"><input type="number" min="0" max="999" class="form-control form-control-sm text-right" [(ngModel)]="t.sortOrder" aria-label="Order" /></td>
                                                        <td><input type="checkbox" [(ngModel)]="t.isDefault" [attr.aria-label]="'Default: ' + t.name" /></td>
                                                        <td><input type="checkbox" [(ngModel)]="t.isActive" [attr.aria-label]="'Active: ' + t.name" /></td>
                                                        <td class="text-right"><button class="btn btn-sm btn-outline-primary" [disabled]="busy() || !t.name?.trim()" (click)="save(t)">Save</button></td>
                                                    } @else {
                                                        <td>{{ t.name }}</td>
                                                        <td class="text-right">{{ t.nominalKg != null ? (t.nominalKg | num: 3) : '—' }}</td>
                                                        <td class="text-right">{{ t.tareKg != null ? (t.tareKg | num: 3) : '—' }}</td>
                                                        <td class="text-right">{{ t.sortOrder }}</td>
                                                        <td>{{ t.isDefault ? 'Yes' : '' }}</td>
                                                        <td>{{ t.isActive ? 'Yes' : 'No' }}</td>
                                                        <td></td>
                                                    }
                                                </tr>
                                            }
                                        </tbody>
                                    </table>
                                }
                            </div>
                        </div>
                        <p class="small text-muted mb-1">The default crate type is picked first in the crate tally, and its usual kg fills in the weight.</p>
                        <p class="small text-muted mb-1">Leave the empty weight blank when the shrimp are weighed without the crate. When it is set, weights for that crate type are read with the crate on the scale, and the empty weight is subtracted.</p>
                        <p class="small text-muted">Deactivate a crate type you no longer use; harvests already saved keep its name and empty weight.</p>
                    </div>
                    @if (canManage) {
                        <div class="col-xl-4">
                            <div class="card">
                                <div class="card-header"><h3 class="card-title"><i class="fas fa-box" aria-hidden="true"></i>Add a crate type</h3></div>
                                <form class="card-body" #f="ngForm" (ngSubmit)="save(draft, true)" novalidate>
                                    <div class="form-group">
                                        <label for="cn">Name <span class="text-danger">*</span></label>
                                        <input id="cn" class="form-control" name="name" [(ngModel)]="draft.name" required maxlength="40" placeholder="e.g. Banyera" />
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group col-6">
                                            <label for="cu">Usual kg</label>
                                            <input id="cu" type="number" min="0.001" step="0.001" class="form-control" name="nominalKg" [(ngModel)]="draft.nominalKg" placeholder="e.g. 30" />
                                        </div>
                                        <div class="form-group col-6">
                                            <label for="ct">Empty weight (kg)</label>
                                            <input id="ct" type="number" min="0.001" step="0.001" class="form-control" name="tareKg" [(ngModel)]="draft.tareKg" placeholder="none" />
                                        </div>
                                    </div>
                                    <div class="custom-control custom-checkbox mb-3">
                                        <input type="checkbox" class="custom-control-input" id="cd" name="isDefault" [(ngModel)]="draft.isDefault" />
                                        <label class="custom-control-label" for="cd">Use as the default</label>
                                    </div>
                                    <button type="submit" class="btn btn-primary" [disabled]="busy() || !f.form.valid">Add crate type</button>
                                    <fpms-form-hint [form]="f"></fpms-form-hint>
                                </form>
                            </div>
                        </div>
                    }
                </div>
            </div>
        </section>
    `,
})
export class ContainerTypesComponent extends FpmsPage implements OnInit {
    types = signal<any[] | null>(null);
    draft: any = this.blank();

    get canManage(): boolean {
        return this.can('Farm.Harvests.EditAny');
    }

    blank(): any {
        return { id: EMPTY_GUID, name: '', nominalKg: null, tareKg: null, sortOrder: 0, isDefault: false, isActive: true };
    }

    ngOnInit(): void {
        this.load();
    }

    async load(): Promise<void> {
        this.types.set(await this.api.get<any[]>('ContainerType', 'GetAll'));
    }

    async save(t: any, isNew = false): Promise<void> {
        const body = { ...t, nominalKg: t.nominalKg || null, tareKg: t.tareKg || null };
        if (await this.act(() => this.api.post('ContainerType', 'Save', body))) {
            this.notifySaved(isNew ? 'Crate type added.' : 'Crate type saved.');
            if (isNew) {
                this.draft = this.blank();
            }
            await this.load();
        }
    }
}
