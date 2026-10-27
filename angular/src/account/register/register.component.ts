import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { accountModuleAnimation } from '@shared/animations/routerTransition';
import { AppAuthService } from '@shared/auth/app-auth.service';
import { FpmsApiService } from '@shared/fpms/api.service';


/** Farm Account Registration (Ref 1.1, AC-01). */
@Component({
    templateUrl: './register.component.html',
    animations: [accountModuleAnimation()],
    standalone: true,
    imports: [FormsModule, RouterLink],
})
export class RegisterComponent {
    private api = inject(FpmsApiService);
    private auth = inject(AppAuthService);

    enabled = signal<boolean | null>(null);
    step = signal<1 | 2 | 3>(1);
    saving = signal(false);
    confirmPassword = '';

    model = {
        farmCode: '',
        farmName: '',
        addressLine1: '',
        addressLine2: '',
        cityMunicipality: '',
        province: '',
        postalCode: '',
        country: 'Philippines',
        totalAreaHectares: null as number | null,
        contactName: '',
        contactPhone: '',
        contactEmail: '',

        ownerName: '',
        ownerSurname: '',
        ownerUserName: '',
        ownerEmailAddress: '',
        ownerPassword: '',
    };

    constructor() {
        this.api
            .get<{ isEnabled: boolean }>('Account', 'GetRegistrationStatus')
            .then((r) => this.enabled.set(!!r?.isEnabled))
            .catch(() => this.enabled.set(false));
    }

    get addressComplete(): boolean {
        const m = this.model;
        return !!m.addressLine1?.trim() && !!m.cityMunicipality?.trim() && !!m.province?.trim() && !!m.country?.trim() && this.postalOk;
    }

    /** Philippine postal codes have 4 digits; other countries are not checked here. */
    get postalOk(): boolean {
        const code = this.model.postalCode?.trim();
        return !code || this.model.country?.trim().toLowerCase() !== 'philippines' || /^[0-9]{4}$/.test(code);
    }

    get fullAddress(): string {
        const m = this.model;
        const prov = [m.province, m.postalCode].map((s) => s?.trim()).filter((s) => !!s).join(' ');
        return [m.addressLine1, m.addressLine2, m.cityMunicipality, prov, m.country].map((s) => s?.trim()).filter((s) => !!s).join(', ');
    }

    get passwordsMatch(): boolean {
        return this.model.ownerPassword === this.confirmPassword;
    }

    async submit(): Promise<void> {
        this.saving.set(true);
        try {
            abp.multiTenancy.setTenantIdCookie(undefined);
            await this.api.post('Account', 'RegisterFarm', this.model);
            abp.notify.success('Farm account created. Signing you in…');
            this.auth.farmCode = this.model.farmCode;
            this.auth.authenticateModel.userNameOrEmailAddress = this.model.ownerUserName;
            this.auth.authenticateModel.password = this.model.ownerPassword;
            await this.auth.authenticate();
        } catch {
            // validation messages are shown by the interceptor; entered values are kept
        } finally {
            this.saving.set(false);
        }
    }
}
