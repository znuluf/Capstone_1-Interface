import { Component, ChangeDetectionStrategy, Renderer2, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppAuthService } from '@shared/auth/app-auth.service';
import { LayoutStoreService } from '@shared/layout/layout-store.service';
import { SidebarLogoComponent } from './sidebar-logo.component';
import { SidebarUserPanelComponent } from './sidebar-user-panel.component';
import { SidebarMenuComponent } from './sidebar-menu.component';

@Component({
    // tslint:disable-next-line:component-selector
    selector: 'sidebar',
    templateUrl: './sidebar.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [SidebarLogoComponent, SidebarUserPanelComponent, SidebarMenuComponent, RouterLink],
})
export class SidebarComponent implements OnInit {
    sidebarExpanded: boolean;
    private _authService = inject(AppAuthService);

    constructor(
        private renderer: Renderer2,
        private _layoutStore: LayoutStoreService
    ) {}

    ngOnInit(): void {
        this._layoutStore.sidebarExpanded.subscribe((value) => {
            this.sidebarExpanded = value;
            this.toggleSidebar();
        });
    }

    /** Edge tab: same toggle the header button uses. */
    toggleCollapsed(): void {
        this._layoutStore.setSidebarExpanded(!this.sidebarExpanded);
    }

    logout(): void {
        this._authService.logout();
    }

    toggleSidebar(): void {
        if (this.sidebarExpanded) {
            this.hideSidebar();
        } else {
            this.showSidebar();
        }
    }

    showSidebar(): void {
        this.renderer.removeClass(document.body, 'sidebar-collapse');
        this.renderer.addClass(document.body, 'sidebar-open');
    }

    hideSidebar(): void {
        this.renderer.removeClass(document.body, 'sidebar-open');
        this.renderer.addClass(document.body, 'sidebar-collapse');
    }
}
