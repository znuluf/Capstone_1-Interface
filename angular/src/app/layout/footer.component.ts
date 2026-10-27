import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AppSessionService } from '@shared/session/app-session.service';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
})
export class FooterComponent {
    currentYear = new Date().getFullYear();
    versionText = inject(AppSessionService).application?.version ?? '';
}
