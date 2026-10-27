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
    /** Up to two initials from the signed-in user's name (no profile photos in FPMS). */
    readonly initials = (this.name || this.session.user?.userName || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join('');
}
