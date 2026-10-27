import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AppAuthService } from '@shared/auth/app-auth.service';
import { BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective } from 'ngx-bootstrap/dropdown';
import { RouterLink } from '@angular/router';
import { AppSessionService } from '@shared/session/app-session.service';

@Component({
    selector: 'header-user-menu',
    templateUrl: './header-user-menu.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, RouterLink],
})
export class HeaderUserMenuComponent {
    private _authService = inject(AppAuthService);
    readonly userName = inject(AppSessionService).user?.userName;

    logout(): void {
        this._authService.logout();
    }
}
