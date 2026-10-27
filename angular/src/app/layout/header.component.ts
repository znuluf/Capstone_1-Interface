import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { HeaderLeftNavbarComponent } from './header-left-navbar.component';
import { HeaderUserMenuComponent } from './header-user-menu.component';
import { HeaderNotificationsComponent } from './header-notifications.component';
import { AppSessionService } from '@shared/session/app-session.service';

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [HeaderLeftNavbarComponent, HeaderUserMenuComponent, HeaderNotificationsComponent],
})
export class HeaderComponent {
    readonly isHost = !inject(AppSessionService).tenant;
}
