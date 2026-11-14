import { Component, OnInit } from '@angular/core';
import { FpmsPage } from '@shared/fpms/fpms-page';
import { FPMS_IMPORTS } from '../shared-imports';
import { signOutLocally } from '@shared/fpms/session';
import { applyTheme, savedTheme, THEME_MODES, ThemeMode } from '@shared/fpms/theme-mode';

/** Own profile and password, for every signed-in user. */
@Component({
    standalone: true,
    imports: FPMS_IMPORTS,
    template: `
        <fpms-page-header [narrow]="true" title="My account" subtitle="Your own sign-in details."></fpms-page-header>
        <section class="content px-2 pb-3">
            <div class="container-fluid fpms-narrow">
                <div class="row">
                    <div class="col-lg-6">
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Profile</h3></div>
                            @if (!p) {
                                <fpms-loading></fpms-loading>
                            } @else {
                                <form #pf="ngForm" (ngSubmit)="saveProfile()" novalidate>
                                    <div class="card-body">
                                        <div class="form-group">
                                            <label for="un">Username</label>
                                            <input id="un" class="form-control" [value]="p.userName" disabled />
                                        </div>
                                        <div class="form-row">
                                            <div class="form-group col-6">
                                                <label for="n">First name</label>
                                                <input id="n" class="form-control" name="name" [(ngModel)]="p.name" required maxlength="64" />
                                            </div>
                                            <div class="form-group col-6">
                                                <label for="s">Surname</label>
                                                <input id="s" class="form-control" name="surname" [(ngModel)]="p.surname" required maxlength="64" />
                                            </div>
                                        </div>
                                        <div class="form-group">
                                            <label for="e">Email</label>
                                            <input id="e" type="email" email class="form-control" name="emailAddress" [(ngModel)]="p.emailAddress" required maxlength="256" />
                                        </div>
                                    </div>
                                    <div class="card-footer">
                                        <button class="btn btn-primary" type="submit" [disabled]="busy() || !pf.form.valid">Save profile</button>
                                        <fpms-form-hint [form]="pf"></fpms-form-hint>
                                    </div>
                                </form>
                            }
                        </div>
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Appearance</h3></div>
                            <div class="card-body" role="radiogroup" aria-label="Colour theme">
                                @for (m of themeModes; track m.value) {
                                    <div class="custom-control custom-radio mb-2">
                                        <input type="radio" class="custom-control-input" name="theme" [id]="'theme-' + m.value" [value]="m.value" [checked]="theme === m.value" (change)="setTheme(m.value)" />
                                        <label class="custom-control-label" [for]="'theme-' + m.value">{{ m.label }}</label>
                                        <small class="form-text text-muted mt-0">{{ m.hint }}</small>
                                    </div>
                                }
                                <small class="form-text text-muted">Saved on this device only.</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Change password</h3></div>
                            <form #wf="ngForm" (ngSubmit)="changePassword()" novalidate>
                                <div class="card-body">
                                    <div class="form-group">
                                        <label for="cur">Current password</label>
                                        <input id="cur" type="password" class="form-control" name="current" [(ngModel)]="pw.current" required autocomplete="current-password" />
                                    </div>
                                    <div class="form-group">
                                        <label for="nw">New password</label>
                                        <input id="nw" type="password" class="form-control" name="next" [(ngModel)]="pw.next" required minlength="8" autocomplete="new-password" />
                                        <small class="form-text text-muted">At least 8 characters with upper- and lower-case letters and a digit.</small>
                                    </div>
                                    <div class="form-group">
                                        <label for="cf">Confirm new password</label>
                                        <input id="cf" type="password" class="form-control" name="confirm" [(ngModel)]="pw.confirm" required autocomplete="new-password" />
                                        @if (pw.confirm && pw.confirm !== pw.next) {
                                            <small class="text-danger">Passwords do not match.</small>
                                        }
                                    </div>
                                </div>
                                <div class="card-footer">
                                    <button class="btn btn-primary" type="submit" [disabled]="busy() || !wf.form.valid || pw.next.length < 8 || pw.next !== pw.confirm">Change password</button>
                                    <fpms-form-hint [form]="wf"></fpms-form-hint>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `,
})
export class MyAccountComponent extends FpmsPage implements OnInit {
    readonly themeModes = THEME_MODES;
    theme: ThemeMode = savedTheme();
    p: any = null;
    pw = { current: '', next: '', confirm: '' };

    async ngOnInit(): Promise<void> {
        this.p = await this.api.get<any>('Profile', 'GetMyProfile');
    }

    setTheme(mode: ThemeMode): void {
        this.theme = mode;
        applyTheme(mode, true);
    }

    async saveProfile(): Promise<void> {
        if (await this.act(() => this.api.put('Profile', 'UpdateMyProfile', this.p))) {
            this.notifySaved('Profile saved.');
        }
    }

    async changePassword(): Promise<void> {
        if (await this.act(() => this.api.post('Profile', 'ChangeMyPassword', { currentPassword: this.pw.current, newPassword: this.pw.next }))) {
            // Changing the password renews the security stamp, which ends every session (DEC-37), including this one.
            Promise.resolve(abp.message.info('Password changed. Please sign in again with your new password.', 'Password changed')).then(() => signOutLocally());
        }
    }
}
