import { Component, Injector, OnInit } from '@angular/core';
import { AppComponentBase } from '@shared/app-component-base';
import { Router, RouterEvent, NavigationEnd, PRIMARY_OUTLET, RouterLink } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { MenuItem } from '@shared/layout/menu-item';
import { NgTemplateOutlet } from '@angular/common';
import { CollapseDirective } from 'ngx-bootstrap/collapse';

@Component({
    selector: 'sidebar-menu',
    templateUrl: './sidebar-menu.component.html',
    standalone: true,
    imports: [NgTemplateOutlet, RouterLink, CollapseDirective],
})
export class SidebarMenuComponent extends AppComponentBase implements OnInit {
    menuItems: MenuItem[];
    menuItemsMap: { [key: number]: MenuItem } = {};
    activatedMenuItems: MenuItem[] = [];
    routerEvents: BehaviorSubject<RouterEvent> = new BehaviorSubject(undefined);
    homeRoute = '/app/dashboard';

    constructor(
        injector: Injector,
        private router: Router
    ) {
        super(injector);
    }

    ngOnInit(): void {
        this.menuItems = this.getMenuItems();
        this.patchMenuItems(this.menuItems);

        this.router.events.subscribe((event: NavigationEnd) => {
            const currentUrl = event.url !== '/' ? event.url : this.homeRoute;
            const primaryUrlSegmentGroup = this.router.parseUrl(currentUrl).root.children[PRIMARY_OUTLET];
            if (primaryUrlSegmentGroup) {
                this.activateMenuItems('/' + primaryUrlSegmentGroup.toString());
            }
        });
    }

    getMenuItems(): MenuItem[] {
        if (!this.appSession.tenant) {
            // System Administration (host) — visually separate from any farm workspace (D-16).
            return [
                new MenuItem('Farms', '/app/system/farms', 'fas fa-building', 'System.Farms'),
                new MenuItem('Account recovery', '/app/system/recovery', 'fas fa-user-shield', 'System.AccountRecovery'),
                new MenuItem('Reference data', '/app/system/reference', 'fas fa-sliders-h', 'System.ReferenceData'),
                new MenuItem('Security & error logs', '/app/system/logs', 'fas fa-clipboard-list', 'System.Logs'),
                new MenuItem('System health', '/app/system/health', 'fas fa-heartbeat', 'System.Health'),
            ];
        }

        return [
            new MenuItem('Dashboard', '/app/dashboard', 'fas fa-tachometer-alt', 'Farm.Dashboard'),
            new MenuItem('Farm', '', 'fas fa-home', '', [
                new MenuItem('Profile', '/app/farm/profile', 'far fa-circle', 'Farm.Profile'),
                new MenuItem('Farm Standards', '/app/farm/standards', 'far fa-circle', 'Farm.Profile'),
                new MenuItem('Users', '/app/farm/users', 'far fa-circle', 'Farm.Users'),
                new MenuItem('Permits and licenses', '/app/farm/documents', 'far fa-circle', 'Farm.Compliance'),
                new MenuItem('Activity log', '/app/farm/activity', 'far fa-circle', 'Farm.ActivityLog'),
            ]),
            new MenuItem('Ponds', '/app/ponds', 'fas fa-water', 'Farm.Ponds'),
            new MenuItem('Resources', '', 'fas fa-boxes', '', [
                new MenuItem('Hatchery sources', '/app/resources/hatcheries', 'far fa-circle', 'Farm.Hatcheries'),
                new MenuItem('Fry deliveries', '/app/resources/fry-deliveries', 'far fa-circle', 'Farm.FryDeliveries'),
                new MenuItem('Buyers', '/app/resources/buyers', 'far fa-circle', 'Farm.Buyers'),
                new MenuItem('Inventory', '/app/inventory', 'far fa-circle', 'Farm.Inventory'),
            ]),
            new MenuItem('Production', '', 'fas fa-seedling', '', [
                new MenuItem('Create Batch (Stocking)', '/app/production/create-batch', 'far fa-circle', 'Farm.Production.Stock'),
                new MenuItem('Cycles', '/app/production/cycles', 'far fa-circle', 'Farm.Production'),
                new MenuItem('Batches', '/app/production/batches', 'far fa-circle', 'Farm.Production'),
            ]),
            // Operations (Journey 4): choose the cycle, then the pond; the choice is remembered.
            new MenuItem('Operations', '', 'fas fa-clipboard-check', '', [
                new MenuItem('Feeding (AM/PM)', '/app/logbook/feeding', 'far fa-circle', 'Farm.Logs'),
                new MenuItem('Record operations', '/app/logbook/new', 'far fa-circle', 'Farm.Logs.Create'),
                new MenuItem('Logbooks', '/app/logbook', 'far fa-circle', 'Farm.Logs'),
                new MenuItem('Printable log sheets', '/app/logbook/sheets', 'far fa-circle', 'Farm.Logs'),
            ]),
            new MenuItem('Harvest & sales', '', 'fas fa-fish', '', [
                new MenuItem('Harvests', '/app/harvests', 'far fa-circle', 'Farm.Harvests'),
                new MenuItem('Sales', '/app/sales', 'far fa-circle', 'Farm.Sales'),
            ]),
            new MenuItem('Reports', '/app/reports', 'fas fa-chart-line', 'Farm.Reports'),
        ];
    }

    patchMenuItems(items: MenuItem[], parentId?: number): void {
        items.forEach((item: MenuItem, index: number) => {
            item.id = parentId ? Number(parentId + '' + (index + 1)) : index + 1;
            if (parentId) {
                item.parentId = parentId;
            }
            if (parentId || item.children) {
                this.menuItemsMap[item.id] = item;
            }
            if (item.children) {
                this.patchMenuItems(item.children, item.id);
            }
        });
    }

    activateMenuItems(url: string): void {
        this.deactivateMenuItems(this.menuItems);
        this.activatedMenuItems = [];
        const foundedItems = this.findMenuItemsByUrl(url, this.menuItems);
        foundedItems.forEach((item) => {
            this.activateMenuItem(item);
        });
    }

    deactivateMenuItems(items: MenuItem[]): void {
        items.forEach((item: MenuItem) => {
            item.isActive = false;
            item.isCollapsed = true;
            if (item.children) {
                this.deactivateMenuItems(item.children);
            }
        });
    }

    findMenuItemsByUrl(url: string, items: MenuItem[], foundedItems: MenuItem[] = []): MenuItem[] {
        items.forEach((item: MenuItem) => {
            if (item.route && (item.route === url || (url.startsWith(item.route + '/') && item.route !== '/app/logbook'))) {
                foundedItems.push(item);
            } else if (item.children) {
                this.findMenuItemsByUrl(url, item.children, foundedItems);
            }
        });
        return foundedItems;
    }

    activateMenuItem(item: MenuItem): void {
        item.isActive = true;
        if (item.children) {
            item.isCollapsed = false;
        }
        this.activatedMenuItems.push(item);
        if (item.parentId) {
            this.activateMenuItem(this.menuItemsMap[item.parentId]);
        }
    }

    isMenuItemVisible(item: MenuItem): boolean {
        if (item.children) {
            return item.children.some((c) => this.isMenuItemVisible(c));
        }

        if (!item.permissionName) {
            return true;
        }
        return this.permission.isGranted(item.permissionName);
    }
}
