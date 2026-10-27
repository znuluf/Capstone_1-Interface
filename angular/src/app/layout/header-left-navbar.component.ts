import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { LayoutStoreService } from '@shared/layout/layout-store.service';
import { AppSessionService } from '@shared/session/app-session.service';

@Component({
    selector: 'header-left-navbar',
    templateUrl: './header-left-navbar.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
})
export class HeaderLeftNavbarComponent implements OnInit {
    sidebarExpanded: boolean;
    private session = inject(AppSessionService);
    readonly isHost = !this.session.tenant;
    readonly farmName = this.session.tenant?.farmName || this.session.tenant?.name;

    constructor(private _layoutStore: LayoutStoreService) {}

    ngOnInit(): void {
        this._layoutStore.sidebarExpanded.subscribe((value) => {
            this.sidebarExpanded = value;
        });
    }

    toggleSidebar(): void {
        this._layoutStore.setSidebarExpanded(!this.sidebarExpanded);
    }
}
