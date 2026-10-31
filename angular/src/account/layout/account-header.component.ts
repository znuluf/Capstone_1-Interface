import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FpmsLogoComponent } from '@shared/fpms/fpms-logo.component';

@Component({
    selector: 'account-header',
    templateUrl: './account-header.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [FpmsLogoComponent],
})
export class AccountHeaderComponent {}
