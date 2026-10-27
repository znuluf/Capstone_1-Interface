import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AppSessionService } from '@shared/session/app-session.service';

@Component({
    selector: 'account-footer',
    templateUrl: './account-footer.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
})
export class AccountFooterComponent {
    currentYear = new Date().getFullYear();
    versionText = inject(AppSessionService).application?.version ?? '';
}
