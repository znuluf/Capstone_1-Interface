import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AppSessionService } from '@shared/session/app-session.service';

@Component({
    selector: 'sidebar-user-panel',
    templateUrl: './sidebar-user-panel.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
})
export class SidebarUserPanelComponent {
    private session = inject(AppSessionService);
    readonly name = `${this.session.user?.name ?? ''} ${this.session.user?.surname ?? ''}`.trim();
    readonly role = this.session.user?.roleDisplayName ?? '';
    readonly farm = this.session.tenant ? this.session.tenant.farmName || this.session.tenant.name : 'System Administration';
}
