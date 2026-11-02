import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { accountModuleAnimation } from '@shared/animations/routerTransition';
import { AppAuthService } from '@shared/auth/app-auth.service';
import { FpmsApiService } from '@shared/fpms/api.service';
import { environment } from '../../environments/environment';

@Component({
    templateUrl: './login.component.html',
    animations: [accountModuleAnimation()],
    standalone: true,
    imports: [FormsModule, RouterLink],
})
export class LoginComponent {
    authService = inject(AppAuthService);
    private api = inject(FpmsApiService);
    submitting = signal(false);
    registrationEnabled = signal(false);

    /** Development-only quick sign-in, grouped for the template. Empty in production builds. */
    readonly devAccountGroups = Object.entries(
        environment.devAccounts.reduce<Record<string, typeof environment.devAccounts>>((groups, a) => {
            (groups[a.group] ??= []).push(a);
            return groups;
        }, {})
    ).map(([name, accounts]) => ({ name, accounts }));

    constructor() {
        this.api
            .get<{ isEnabled: boolean }>('Account', 'GetRegistrationStatus')
            .then((r) => this.registrationEnabled.set(!!r?.isEnabled))
            .catch(() => this.registrationEnabled.set(false));
    }

    login(): void {
        this.submitting.set(true);
        this.authService.authenticate(() => this.submitting.set(false));
    }

    quickSignIn(account: (typeof environment.devAccounts)[number]): void {
        if (this.submitting()) {
            return;
        }
        this.authService.farmCode = account.farmCode;
        this.authService.authenticateModel.userNameOrEmailAddress = account.userName;
        this.authService.authenticateModel.password = account.password;
        this.login();
    }
}
