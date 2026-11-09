import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FarmTime } from '@shared/fpms/farm-time';
import { LAST_FARM_CODE_KEY } from '@shared/auth/app-auth.service';
import { FPMS_IMPORTS } from '../shared-imports';
import { applyCoverageCity, applyCoverageProvince, coverageCities, coverageProvinces } from '@shared/fpms/coverage-area';

/** Farm Profile Management (Ref 2.1, D-31). Owners edit; Technicians read. The Ponds tab summarizes pond specifications (D-32). */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [narrow]="true" title="Farm profile" subtitle="Your farm, how dates show, and the production settings."></fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid fpms-narrow">
                @if (!p) {
                    <fpms-loading></fpms-loading>
                } @else {
                    <ul class="nav nav-tabs mb-3" role="tablist">
                        <li class="nav-item">
                            <a class="nav-link" href="javascript:;" role="tab" [class.active]="tab() === 'details'" [attr.aria-selected]="tab() === 'details'" (click)="tab.set('details')">
                                <i class="fas fa-home mr-1"></i>Farm details
                            </a>
                        </li>
                        @if (canSeePonds) {
                            <li class="nav-item">
                                <a class="nav-link" href="javascript:;" role="tab" [class.active]="tab() === 'ponds'" [attr.aria-selected]="tab() === 'ponds'" (click)="openPonds()">
                                    <i class="fas fa-water mr-1"></i>Ponds
                                    @if (ponds()?.length) { <span class="badge badge-secondary ml-1">{{ ponds()!.length }}</span> }
                                </a>
                            </li>
                        }
                    </ul>

                    @if (tab() === 'details' && !canEdit) {
                        <div class="card">
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-warehouse" aria-hidden="true"></i>Farm details</h3></div>
                            <div class="card-body">
                                <dl class="row mb-0 fpms-dl">
                                    <dt class="col-sm-4">Farm code</dt><dd class="col-sm-8"><code>{{ p.farmCode }}</code><span class="fpms-none ml-2">used with your username to sign in</span></dd>
                                    <dt class="col-sm-4">Farm name</dt><dd class="col-sm-8">{{ p.farmName }}</dd>
                                    <dt class="col-sm-4">Total farm area</dt>
                                    <dd class="col-sm-8">
                                        @if (p.totalAreaHectares) { {{ p.totalAreaHectares | num: 2 }} ha } @else { <span class="fpms-none">—</span> }
                                        <span class="fpms-none ml-1">· ponds on record {{ p.pondAreaHectares | num: 2 }} ha</span>
                                    </dd>
                                    <dt class="col-sm-4">Address</dt><dd class="col-sm-8">{{ p.fullAddress || '—' }}</dd>
                                    <dt class="col-sm-4">Coordinates</dt>
                                    <dd class="col-sm-8">
                                        @if (p.latitude != null && p.longitude != null) { {{ p.latitude | num: 6 }}, {{ p.longitude | num: 6 }} } @else { <span class="fpms-none">—</span> }
                                    </dd>
                                </dl>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-phone" aria-hidden="true"></i>Contact</h3></div>
                            <div class="card-body">
                                <dl class="row mb-0 fpms-dl">
                                    <dt class="col-sm-4">Contact person</dt><dd class="col-sm-8">{{ p.contactName || '—' }}</dd>
                                    <dt class="col-sm-4">Phone</dt><dd class="col-sm-8">{{ p.contactPhone || '—' }}</dd>
                                    <dt class="col-sm-4">Email</dt><dd class="col-sm-8">{{ p.contactEmail || '—' }}</dd>
                                </dl>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header"><h3 class="card-title"><i class="fas fa-cog" aria-hidden="true"></i>Settings</h3></div>
                            <div class="card-body">
                                <dl class="row mb-0 fpms-dl">
                                    <dt class="col-sm-4">Time zone</dt><dd class="col-sm-8">{{ p.timeZone }}</dd>
                                    <dt class="col-sm-4">Farming system</dt><dd class="col-sm-8">{{ p.farmingSystem | label: L.FarmingSystems }}</dd>
                                    <dt class="col-sm-4">Document alert window</dt><dd class="col-sm-8">{{ p.documentExpiryAlertDays }} days</dd>
                                    <dt class="col-sm-4">Date display</dt><dd class="col-sm-8">{{ p.dateOrder === 2 ? 'Day first (22 Oct 2026)' : 'Month first (Oct 22, 2026)' }}</dd>
                                    <dt class="col-sm-4">Time display</dt><dd class="col-sm-8">{{ p.use24HourTime ? '24-hour (14:30)' : '12-hour (2:30 PM)' }}</dd>
                                </dl>
                            </div>
                        </div>
                        <p class="text-muted small"><i class="fas fa-lock mr-1"></i>Only a Farm Owner can change the farm profile.</p>
                    }

                    @if (tab() === 'details' && canEdit) {
                        <form #f="ngForm" (ngSubmit)="save()" novalidate>
                            <fieldset [disabled]="!canEdit">
                                <div class="card">
                                    <div class="card-header"><h3 class="card-title"><i class="fas fa-warehouse" aria-hidden="true"></i>Farm details</h3></div>
                                    <div class="card-body">
                                        <div class="form-group">
                                            <label for="farmCode">Farm code</label>
                                            <div class="input-group fpms-code-field-group">
                                                <input id="farmCode" class="form-control fpms-code-field" name="farmCode" [ngModel]="p.farmCode" readonly aria-describedby="farmCodeHelp" />
                                                @if (p.canChangeFarmCode) {
                                                    <div class="input-group-append">
                                                        <button type="button" class="btn btn-outline-secondary" [disabled]="!!p.nextFarmCodeChange" (click)="openCodeDlg()">
                                                            <i class="fas fa-key mr-1" aria-hidden="true"></i>Change code
                                                        </button>
                                                    </div>
                                                }
                                            </div>
                                            <small id="farmCodeHelp" class="form-text text-muted">
                                                Staff enter this with their username to sign in, and it appears on exports and reports.
                                                @if (!p.canChangeFarmCode) {
                                                    Only the Farm Owner can change it.
                                                } @else if (p.nextFarmCodeChange) {
                                                    It was changed recently and can be changed again from {{ p.nextFarmCodeChange | farmDate }}.
                                                } @else {
                                                    Changing it means everyone must use the new code to sign in.
                                                }
                                            </small>
                                        </div>
                                        <div class="form-row">
                                            <div class="form-group col-md-8">
                                                <label for="farmName">Farm name <span class="text-danger">*</span></label>
                                                <input id="farmName" class="form-control" name="farmName" [(ngModel)]="p.farmName" required maxlength="150" />
                                            </div>
                                            <div class="form-group col-md-4">
                                                <label for="area">Total farm area (hectares)</label>
                                                <input id="area" type="number" min="0.01" max="100000" step="0.01" class="form-control" name="totalAreaHectares" [(ngModel)]="p.totalAreaHectares" />
                                                <small class="form-text text-muted">Ponds on record: {{ p.pondAreaHectares | num: 2 }} ha.</small>
                                            </div>
                                        </div>
                                        @if (areaExceeded) {
                                            <div class="alert alert-warning py-2 small" role="status">
                                                <i class="fas fa-exclamation-triangle mr-1"></i>The ponds add up to {{ p.pondAreaHectares | num: 2 }} ha, more than the total farm area.
                                                Check the total area or the pond areas. You can still save.
                                            </div>
                                        }
                                    </div>
                                </div>
                                <div class="card">
                                    <div class="card-header"><h3 class="card-title"><i class="fas fa-map-marker-alt" aria-hidden="true"></i>Address</h3></div>
                                    <div class="card-body">
                                        <div class="form-row">
                                            <div class="form-group col-md-6">
                                                <label for="line1">Address line 1 <span class="text-danger">*</span></label>
                                                <input id="line1" class="form-control" name="addressLine1" [(ngModel)]="p.addressLine1" required maxlength="200" />
                                                <small class="form-text text-muted">House number, street, purok or sitio, apartment/unit.</small>
                                            </div>
                                            <div class="form-group col-md-6">
                                                <label for="line2">Address line 2</label>
                                                <input id="line2" class="form-control" name="addressLine2" [(ngModel)]="p.addressLine2" maxlength="200" />
                                                <small class="form-text text-muted">Building, suite or floor; or the barangay.</small>
                                            </div>
                                        </div>
                                        <div class="form-row">
                                            <div class="form-group col-md-3">
                                                                    <label for="province">Province <span class="text-danger">*</span></label>
                                                                    <select id="province" class="form-control" name="province" [(ngModel)]="p.province" (ngModelChange)="onProvinceChange()" required>
                                                                        <option value="" disabled>Choose a province</option>
                                                                        @for (name of provinces(); track name) {
                                                                            <option [value]="name">{{ name }}</option>
                                                                        }
                                                                    </select>
                                                                </div>
                                                                <div class="form-group col-md-4">
                                                                    <label for="city">City / Municipality <span class="text-danger">*</span></label>
                                                                    <select id="city" class="form-control" name="cityMunicipality" [(ngModel)]="p.cityMunicipality" (ngModelChange)="onCityChange()" [disabled]="!p.province" required>
                                                                        <option value="" disabled>{{ p.province ? 'Choose a city or municipality' : 'Choose the province first' }}</option>
                                                                        @for (name of cities(); track name) {
                                                                            <option [value]="name">{{ name }}</option>
                                                                        }
                                                                    </select>
                                                                    <small class="form-text text-muted">Covered: General Santos City and Sarangani.</small>
                                                                </div>
                                            <div class="form-group col-md-2">
                                                <label for="postal">Postal code</label>
                                                <input id="postal" class="form-control" name="postalCode" [(ngModel)]="p.postalCode" maxlength="10" inputmode="numeric" />
                                                @if (!postalOk) {
                                                    <small class="text-danger">4 digits, e.g. 9502.</small>
                                                }
                                            </div>
                                            <div class="form-group col-md-3">
                                                <label for="country">Country <span class="text-danger">*</span></label>
                                                <input id="country" class="form-control" name="country" [(ngModel)]="p.country" required maxlength="100" />
                                            </div>
                                        </div>
                                        <div class="form-row">
                                            <div class="form-group col-md-3">
                                                <label for="lat">Latitude</label>
                                                <input id="lat" type="number" step="0.000001" min="-90" max="90" class="form-control" name="latitude" [(ngModel)]="p.latitude" />
                                            </div>
                                            <div class="form-group col-md-3">
                                                <label for="lng">Longitude</label>
                                                <input id="lng" type="number" step="0.000001" min="-180" max="180" class="form-control" name="longitude" [(ngModel)]="p.longitude" />
                                            </div>
                                        </div>
                                        @if (p.fullAddress) {
                                            <p class="small text-muted mb-0">Printed on reports and sales records as: <span class="text-body">{{ p.fullAddress }}</span></p>
                                        }
                                    </div>
                                </div>
                                <div class="card">
                                    <div class="card-header"><h3 class="card-title"><i class="fas fa-phone" aria-hidden="true"></i>Contact</h3></div>
                                    <div class="card-body">
                                        <div class="form-row">
                                            <div class="form-group col-md-4">
                                                <label for="cname">Contact person</label>
                                                <input id="cname" class="form-control" name="contactName" [(ngModel)]="p.contactName" maxlength="100" />
                                            </div>
                                            <div class="form-group col-md-4">
                                                <label for="cphone">Phone</label>
                                                <input id="cphone" class="form-control" name="contactPhone" [(ngModel)]="p.contactPhone" maxlength="50" />
                                            </div>
                                            <div class="form-group col-md-4">
                                                <label for="cemail">Email</label>
                                                <input id="cemail" type="email" email class="form-control" name="contactEmail" [(ngModel)]="p.contactEmail" maxlength="256" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="card">
                                    <div class="card-header"><h3 class="card-title"><i class="fas fa-cog" aria-hidden="true"></i>Settings</h3></div>
                                    <div class="card-body">
                                        <div class="form-row">
                                            <div class="form-group col-md-4">
                                                <label for="tz">Time zone</label>
                                                <input id="tz" class="form-control" name="timeZone" [(ngModel)]="p.timeZone" required maxlength="64" />
                                                <small class="form-text text-muted">IANA name. Default Asia/Manila (UTC+08:00).</small>
                                            </div>
                                            <div class="form-group col-md-4">
                                                <label for="alert">Document alert window (days)</label>
                                                <input id="alert" type="number" min="1" max="365" class="form-control" name="documentExpiryAlertDays" [(ngModel)]="p.documentExpiryAlertDays" required />
                                                <small class="form-text text-muted">Permits expiring within this many days show "Expiring soon".</small>
                                            </div>
                                            <div class="form-group col-md-4">
                                                <label for="fsys">Farming system</label>
                                                <select id="fsys" class="form-control" name="farmingSystem" [(ngModel)]="p.farmingSystem">
                                                    @for (o of Options.farmingSystem; track o.value) {
                                                        <option [ngValue]="o.value">{{ o.label }}</option>
                                                    }
                                                </select>
                                                <small class="form-text text-muted">Every pond uses this unless the pond sets its own.</small>
                                            </div>
                                            <div class="form-group col-md-4">
                                                <label for="dord">Date display</label>
                                                <select id="dord" class="form-control" name="dateOrder" [(ngModel)]="p.dateOrder">
                                                    <option [ngValue]="1">Month first (Oct 22, 2026)</option>
                                                    <option [ngValue]="2">Day first (22 Oct 2026)</option>
                                                </select>
                                            </div>
                                            <div class="form-group col-md-4">
                                                <label for="tfmt">Time display</label>
                                                <select id="tfmt" class="form-control" name="use24HourTime" [(ngModel)]="p.use24HourTime">
                                                    <option [ngValue]="false">12-hour (2:30 PM)</option>
                                                    <option [ngValue]="true">24-hour (14:30)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>
                            @if (canEdit) {
                                <div class="d-flex">
                                    <button type="submit" class="btn btn-primary mr-2" [disabled]="busy() || !f.form.valid || !postalOk">
                                        @if (busy()) {
                                            <i class="fas fa-spinner fa-spin mr-1"></i>
                                        }
                                        Save profile
                                    </button>
                                    <button type="button" class="btn btn-default" (click)="f.form.markAsPristine(); load()">Cancel</button>
                                    <fpms-form-hint [form]="f"></fpms-form-hint>
                                </div>
                            } @else {
                                <p class="text-muted small"><i class="fas fa-lock mr-1"></i>Only a Farm Owner can change the farm profile.</p>
                            }
                        </form>
                    }

                    @if (tab() === 'ponds') {
                        <div class="card">
                            <div class="card-header d-flex align-items-center">
                                <h3 class="card-title mr-auto"><i class="fas fa-water" aria-hidden="true"></i>Pond specifications</h3>
                                <a routerLink="/app/ponds" class="btn btn-sm btn-outline-primary">Manage ponds</a>
                            </div>
                            @if (ponds()?.length) {
                                <div class="card-body pb-0">
                                    <div class="row">
                                        <div class="col-6 col-md-3"><div class="fpms-kpi"><div class="v">{{ ponds()!.length | num: 0 }}</div><div class="l">Ponds</div></div></div>
                                        <div class="col-6 col-md-3"><div class="fpms-kpi"><div class="v">{{ p.pondAreaHectares | num: 2 }} ha</div><div class="l">Total pond area</div></div></div>
                                        <div class="col-6 col-md-3"><div class="fpms-kpi"><div class="v">{{ inProduction | num: 0 }}</div><div class="l">In production now</div></div></div>
                                        <div class="col-6 col-md-3">
                                            <div class="fpms-kpi" [class.fpms-kpi-warn]="areaExceeded">
                                                @if (p.totalAreaHectares) {
                                                    <div class="v">{{ areaShare | num: 0 }}%</div>
                                                    <div class="l">of {{ p.totalAreaHectares | num: 2 }} ha farm area</div>
                                                } @else {
                                                    <div class="v fpms-none">—</div>
                                                    <div class="l">Farm area not set</div>
                                                }
                                            </div>
                                        </div>
                                    </div>
                                    @if (p.totalAreaHectares) {
                                        <div class="progress mb-2" style="height: 0.5rem" role="progressbar" aria-label="Share of the farm area used by ponds" [attr.aria-valuenow]="areaShare" aria-valuemin="0" aria-valuemax="100">
                                            <div class="progress-bar" [class.bg-warning]="areaExceeded" [style.width.%]="areaShare > 100 ? 100 : areaShare"></div>
                                        </div>
                                        @if (areaExceeded) {
                                            <div class="small text-warning-dark mb-2"><i class="fas fa-exclamation-triangle mr-1"></i>The ponds add up to more than the total farm area. Check the total area or the pond areas.</div>
                                        }
                                    } @else {
                                        <div class="small text-muted mb-2">Add the total farm area on the Farm details tab to compare it with the ponds.</div>
                                    }
                                </div>
                            }
                            <div class="card-body p-0 table-responsive">
                                @if (!ponds()) {
                                    <fpms-loading></fpms-loading>
                                } @else if (!ponds()!.length) {
                                    <fpms-empty text="No ponds yet." icon="fas fa-water">
                                        <a routerLink="/app/ponds" class="btn btn-sm btn-primary">Add ponds</a>
                                    </fpms-empty>
                                } @else {
                                    <table class="table table-sm table-hover mb-0">
                                        <caption class="sr-only">Pond specifications</caption>
                                        <thead>
                                            <tr>
                                                <th>Pond</th>
                                                <th>Purpose</th>
                                                <th>Construction</th>
                                                <th class="text-right">Area (m²)</th>
                                                <th class="text-right">Avg depth (m)</th>
                                                <th class="text-right">Max depth (m)</th>
                                                <th>Farming system</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @for (x of ponds(); track x.id) {
                                                <tr>
                                                    <td class="text-nowrap">
                                                        <a [routerLink]="['/app/ponds', x.id]">{{ x.pondCode }}</a>
                                                        <div class="small text-muted">{{ x.name }}</div>
                                                    </td>
                                                    <td>{{ x.purpose | label: L.PondPurposes }}</td>
                                                    <td>{{ x.constructionType | label: L.ConstructionTypes }}</td>
                                                    <td class="text-right">{{ x.areaM2 | num: 0 }}</td>
                                                    <td class="text-right">{{ x.averageDepthM | num: 2 }}</td>
                                                    <td class="text-right">{{ x.maxDepthM | num: 2 }}</td>
                                                    <td>
                                                        {{ x.farmingSystem | label: L.FarmingSystems }}
                                                        @if (x.farmingSystemOverride == null) {
                                                            <span class="small text-muted">(farm setting)</span>
                                                        }
                                                        @if (x.systemWarning) {
                                                            <div class="small text-warning-dark"><i class="fas fa-exclamation-triangle mr-1"></i>{{ x.systemWarning }}</div>
                                                        }
                                                    </td>
                                                    <td><fpms-badge [text]="x.status | label: L.PondDisplayStatuses"></fpms-badge></td>
                                                </tr>
                                            }
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colspan="3">{{ ponds()!.length === 1 ? '1 pond' : ponds()!.length + ' ponds' }}</td>
                                                <td class="text-right">{{ totalAreaM2 | num: 0 }}</td>
                                                <td colspan="4"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                }
                            </div>
                        </div>
                    }
                }
            </div>
        </section>
        @if (codeDlg; as d) {
            <div class="fpms-dialog-backdrop">
                <div class="fpms-dialog fpms-dialog-sm" role="dialog" aria-modal="true" aria-labelledby="codeDlgTitle">
                    <div class="fpms-dialog-head">
                        <h2 id="codeDlgTitle" class="mr-auto">{{ d.done ? 'Farm code changed' : 'Change farm code' }}</h2>
                        <button type="button" class="fpms-dialog-close" aria-label="Close" (click)="closeCodeDlg()"><span aria-hidden="true">&times;</span></button>
                    </div>
                    @if (d.done) {
                        <div class="fpms-dialog-body">
                            <p class="mb-2">The new farm code is</p>
                            <p class="h3 mb-3"><code>{{ d.done.farmCode }}</code></p>
                            <div class="alert alert-info small mb-0">
                                <i class="fas fa-info-circle mr-1" aria-hidden="true"></i>
                                Tell your staff to sign in with the new code. Anyone who types <code>{{ d.done.oldCode }}</code> is shown the new code instead.
                                People who are signed in now stay signed in.
                            </div>
                        </div>
                        <div class="fpms-dialog-foot">
                            <button type="button" class="btn btn-outline-secondary" (click)="copyCode()"><i class="far fa-copy mr-1" aria-hidden="true"></i>Copy code</button>
                            <button type="button" class="btn btn-primary" (click)="closeCodeDlg()">Done</button>
                        </div>
                    } @else {
                        <form (ngSubmit)="saveCode()" novalidate autocomplete="off">
                            <div class="fpms-dialog-body">
                                <div class="alert alert-warning small">
                                    <i class="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>
                                    The farm code is what staff type, with their username, to sign in. After the change:
                                    <ul class="mb-0 pl-3 mt-1">
                                        <li>everyone must sign in with the new code, and saved links or bookmarks that use the old one stop working;</li>
                                        <li>exports and reports made earlier keep the old code;</li>
                                        <li>the old code can never be used again, by this farm or any other;</li>
                                        <li>the code can be changed again only after {{ cooldownDays }} days.</li>
                                    </ul>
                                </div>
                                <div class="form-group">
                                    <label for="oldCode">Current code</label>
                                    <input id="oldCode" class="form-control fpms-code-field" [value]="p.farmCode" readonly />
                                </div>
                                <div class="form-group">
                                    <label for="newCode">New code <span class="text-danger">*</span></label>
                                    <input id="newCode" class="form-control fpms-code-field" name="newCode" [(ngModel)]="d.newCode" (ngModelChange)="codeInput()" maxlength="64" autocomplete="off" spellcheck="false" aria-describedby="newCodeHelp"
                                        [class.is-valid]="d.check?.available && d.checkedFor === d.newCode.trim()" [class.is-invalid]="d.check && !d.check.available && d.checkedFor === d.newCode.trim()" />
                                    <small id="newCodeHelp" class="form-text" [class.text-muted]="!d.check || d.check.available" [class.text-danger]="d.check && !d.check.available" role="status">
                                        @if (d.checking) {
                                            Checking…
                                        } @else if (d.check && d.checkedFor === d.newCode.trim()) {
                                            {{ d.check.available ? 'This code is free.' : d.check.message }}
                                        } @else {
                                            Starts with a letter. 2–64 letters, digits, - or _.
                                        }
                                    </small>
                                </div>
                                <div class="form-group mb-0">
                                    <label for="confirmCode">Type the new code again <span class="text-danger">*</span></label>
                                    <input id="confirmCode" class="form-control fpms-code-field" name="confirmCode" [(ngModel)]="d.confirm" maxlength="64" autocomplete="off" spellcheck="false" />
                                    @if (d.confirm && d.confirm.trim() !== d.newCode.trim()) {
                                        <small class="text-danger">The two codes do not match.</small>
                                    }
                                </div>
                            </div>
                            <div class="fpms-dialog-foot">
                                <button type="button" class="btn btn-default" (click)="closeCodeDlg()">Cancel</button>
                                <button type="submit" class="btn btn-primary" [disabled]="!canSaveCode || busy()">
                                    @if (busy()) { <i class="fas fa-spinner fa-spin mr-1"></i> }
                                    Change farm code
                                </button>
                            </div>
                        </form>
                    }
                </div>
            </div>
        }
    `,
})
export class FarmProfileComponent extends FpmsPage implements OnInit, OnDestroy {
    p: any = null;

    // Address dropdowns: General Santos City and Sarangani only (shared/fpms/coverage-area.ts).
    provinces(): string[] {
        return coverageProvinces(this.p?.province);
    }

    cities(): string[] {
        return coverageCities(this.p?.province, this.p?.cityMunicipality);
    }

    onProvinceChange(): void {
        applyCoverageProvince(this.p);
    }

    onCityChange(): void {
        applyCoverageCity(this.p);
    }
    readonly cooldownDays = 30;
    codeDlg: {
        newCode: string;
        confirm: string;
        check: { available: boolean; message: string } | null;
        checkedFor: string;
        checking: boolean;
        done: { oldCode: string; farmCode: string } | null;
    } | null = null;
    private codeTimer: any;
    tab = signal<'details' | 'ponds'>('details');
    ponds = signal<any[] | null>(null);

    get canEdit(): boolean {
        return this.can('Farm.Profile.Edit');
    }

    get canSeePonds(): boolean {
        return this.can('Farm.Ponds');
    }

    get totalAreaM2(): number {
        return (this.ponds() ?? []).reduce((n, x) => n + Number(x.areaM2 || 0), 0);
    }

    /** Ponds with a batch growing in them (display status 3, In production). */
    get inProduction(): number {
        return (this.ponds() ?? []).filter((x) => x.status === 3).length;
    }

    /** The ponds' share of the total farm area, in percent (not capped). */
    get areaShare(): number {
        const total = Number(this.p?.totalAreaHectares);
        return total > 0 ? (Number(this.p.pondAreaHectares) / total) * 100 : 0;
    }

    get areaExceeded(): boolean {
        return !!this.p?.totalAreaHectares && Number(this.p.pondAreaHectares) > Number(this.p.totalAreaHectares);
    }

    /** Philippine postal codes have 4 digits; other countries are not checked here. */
    get postalOk(): boolean {
        const code = this.p?.postalCode?.trim();
        return !code || (this.p?.country ?? '').trim().toLowerCase() !== 'philippines' || /^[0-9]{4}$/.test(code);
    }

    ngOnInit(): void {
        this.load();
    }

    // ------------------------------------------------------------ farm code (DEC-78)

    get canSaveCode(): boolean {
        const d = this.codeDlg;
        const code = d?.newCode.trim() ?? '';
        return !!d && !d.checking && !!d.check?.available && d.checkedFor === code && d.confirm.trim() === code;
    }

    openCodeDlg(): void {
        this.codeDlg = { newCode: '', confirm: '', check: null, checkedFor: '', checking: false, done: null };
        setTimeout(() => document.getElementById('newCode')?.focus());
    }

    closeCodeDlg(): void {
        clearTimeout(this.codeTimer);
        this.codeDlg = null;
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.codeDlg && !this.busy()) {
            this.closeCodeDlg();
        }
    }

    /** Checks the typed code against the server a moment after typing stops. */
    codeInput(): void {
        const d = this.codeDlg;
        if (!d) {
            return;
        }
        clearTimeout(this.codeTimer);
        d.check = null;
        const code = d.newCode.trim();
        if (!code) {
            d.checking = false;
            return;
        }
        d.checking = true;
        this.codeTimer = setTimeout(async () => {
            let result: any = null;
            try {
                result = await this.api.get<any>('FarmProfile', 'GetFarmCodeAvailability', { code });
            } catch {
                /* the interceptor shows the error */
            }
            if (this.codeDlg === d && d.newCode.trim() === code) {
                d.check = result ? { available: !!result.available, message: result.message } : null;
                d.checkedFor = code;
                d.checking = false;
            }
        }, 400);
    }

    async saveCode(): Promise<void> {
        const d = this.codeDlg;
        if (!d || !this.canSaveCode) {
            return;
        }
        let result: any = null;
        if (await this.act(async () => (result = await this.api.post<any>('FarmProfile', 'ChangeFarmCode', { newCode: d.newCode.trim() })))) {
            d.done = { oldCode: result.oldCode, farmCode: result.farmCode };
            try {
                localStorage.setItem(LAST_FARM_CODE_KEY, result.farmCode);
            } catch {
                /* storage unavailable */
            }
            await this.load();
        }
    }

    async copyCode(): Promise<void> {
        const code = this.codeDlg?.done?.farmCode ?? '';
        try {
            await navigator.clipboard.writeText(code);
            this.notifySaved('Farm code copied.');
        } catch {
            abp.message.info(code, 'Farm code');
        }
    }

    ngOnDestroy(): void {
        clearTimeout(this.codeTimer);
    }

    async load(): Promise<void> {
        this.p = await this.api.get<any>('FarmProfile', 'Get');
    }

    async openPonds(): Promise<void> {
        this.tab.set('ponds');
        if (!this.ponds()) {
            this.ponds.set(await this.api.get<any[]>('Pond', 'GetAll'));
        }
    }

    async save(): Promise<void> {
        let warnings: any[] = [];
        if (await this.act(async () => (warnings = (await this.api.put<any[]>('FarmProfile', 'Update', this.p)) ?? []))) {
            FarmTime.setZone(this.p.timeZone);
            FarmTime.setDisplay(this.p.dateOrder, this.p.use24HourTime);
            this.notifySaved('Farm profile saved.');
            if (warnings.length) {
                this.showWarnings(warnings);
            }
            await this.load();
        }
    }
}
