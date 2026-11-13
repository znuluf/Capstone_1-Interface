import { ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WizardSteps } from '@shared/fpms/wizard-steps';
import { accountModuleAnimation } from '@shared/animations/routerTransition';
import { AppAuthService } from '@shared/auth/app-auth.service';
import { FpmsApiService } from '@shared/fpms/api.service';
import { applyCoverageBarangay, applyCoverageCity, applyCoverageProvince, coverageBarangays, coverageCities, coverageProvinces } from '@shared/fpms/coverage-area';


/** Farm Account Registration (Ref 1.1, AC-01). */
@Component({
    templateUrl: './register.component.html',
    animations: [accountModuleAnimation()],
    standalone: true,
    imports: [FormsModule, RouterLink],
})
export class RegisterComponent {
    // Address dropdowns: General Santos City and Sarangani only (shared/fpms/coverage-area.ts).
    provinces(): string[] {
        return coverageProvinces(this.model?.province);
    }

    cities(): string[] {
        return coverageCities(this.model?.province, this.model?.cityMunicipality);
    }

    onProvinceChange(): void {
        applyCoverageProvince(this.model);
        applyCoverageBarangay(this.model);
    }

    barangays(): string[] {
        return coverageBarangays(this.model?.province, this.model?.cityMunicipality, this.model?.addressLine2);
    }

    onCityChange(): void {
        applyCoverageCity(this.model);
        applyCoverageBarangay(this.model);
    }

    private api = inject(FpmsApiService);
    private auth = inject(AppAuthService);
    private cdr = inject(ChangeDetectorRef);

    /** Set once the person types their own farm code or username; suggestions then stop replacing it (DEC-75). */
    farmCodeEdited = false;
    ownerUserNameEdited = false;

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

    /** The step lives in the address (?step=n), so the browser Back button goes one step back. */
    readonly wizard = new WizardSteps(1, () => this.furthestStep(), (n) => this.step.set(n as 1 | 2 | 3));

    constructor() {
        inject(ActivatedRoute)
            .queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
            .subscribe((q) => this.wizard.sync(q));
        this.api
            .get<{ isEnabled: boolean }>('Account', 'GetRegistrationStatus')
            .then((r) => this.enabled.set(!!r?.isEnabled))
            .catch(() => this.enabled.set(false));
    }

    /** Fills the farm code from the farm name (numbered when taken), unless the person typed their own. */
    async suggestFarmCode(): Promise<void> {
        if (this.farmCodeEdited || !this.model.farmName?.trim()) {
            return;
        }
        const r = await this.suggestions();
        if (r?.farmCode && !this.farmCodeEdited) {
            this.model.farmCode = r.farmCode;
            this.cdr.markForCheck();
        }
    }

    /** Fills the Owner username from first initial and surname, unless the person typed their own. */
    async suggestOwnerUserName(): Promise<void> {
        if (this.ownerUserNameEdited || (!this.model.ownerName?.trim() && !this.model.ownerSurname?.trim())) {
            return;
        }
        const r = await this.suggestions();
        if (r?.ownerUserName && !this.ownerUserNameEdited) {
            this.model.ownerUserName = r.ownerUserName;
            this.cdr.markForCheck();
        }
    }

    private suggestions(): Promise<{ farmCode?: string; ownerUserName?: string } | null> {
        const m = this.model;
        return this.api
            .get<{ farmCode?: string; ownerUserName?: string }>('Account', 'GetRegistrationSuggestions', {
                farmName: m.farmName?.trim(),
                ownerName: m.ownerName?.trim(),
                ownerSurname: m.ownerSurname?.trim(),
            })
            .catch(() => null); // a suggestion is a convenience; the person can always type the value
    }

    /** Step 2 needs a complete farm; step 3 needs a complete owner account. */
    private furthestStep(): number {
        const m = this.model;
        if (!m.farmCode || !m.farmName || !this.addressComplete) {
            return 1;
        }
        const ownerDone = !!m.ownerName && !!m.ownerSurname && !!m.ownerUserName && !!m.ownerEmailAddress && this.passwordStrong && this.passwordsMatch;
        return ownerDone ? 3 : 2;
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

    /** The sign-up rule, checked here as well so a weak password is caught on step 2, not after Create. */
    get passwordStrong(): boolean {
        const p = this.model.ownerPassword ?? '';
        return p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p);
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
