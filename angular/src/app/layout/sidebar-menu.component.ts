import { ChangeDetectorRef, Component, Injector, OnInit, inject } from '@angular/core';
import { AppComponentBase } from '@shared/app-component-base';
import { Router, RouterEvent, NavigationCancel, NavigationEnd, NavigationError, RoutesRecognized, PRIMARY_OUTLET, RouterLink } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { MenuItem } from '@shared/layout/menu-item';
import { SECTIONS, effectiveUrl, leafTabs } from '@shared/layout/sections';
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
    private cd = inject(ChangeDetectorRef);

    constructor(
        injector: Injector,
        private router: Router
    ) {
        super(injector);
    }

    ngOnInit(): void {
        this.menuItems = this.getMenuItems();
        this.markSectionHeadings();
        this.patchMenuItems(this.menuItems);

        // Light up the current page on first load too: the navigation that brought us here has already finished.
        this.showUrl(this.router.url);

        this.router.events.subscribe((event) => {
            if (event instanceof RoutesRecognized || event instanceof NavigationEnd) {
                // Light the item as soon as the destination is known (before its code loads), and follow redirects:
                // "/app" ends up on the dashboard.
                this.showUrl(event.urlAfterRedirects);
            } else if (event instanceof NavigationCancel || event instanceof NavigationError) {
                // The move did not happen (e.g. the unsaved-changes prompt was cancelled): back to the page still shown.
                this.showUrl(this.router.url);
            }
        });
    }

    private showUrl(url: string): void {
        const target = !url || url === '/' ? this.homeRoute : effectiveUrl(url);
        const first = this.router.parseUrl(target).root.children[PRIMARY_OUTLET];
        if (first) {
            this.activateMenuItems('/' + first.toString());
            // The app runs without zone.js: the router events arrive outside any click, so ask for a repaint.
            this.cd.markForCheck();
        }
    }

    getMenuItems(): MenuItem[] {
        if (!this.appSession.tenant) {
            // System Administration (host) — visually separate from any farm workspace (D-16).
            return [
                new MenuItem('Farms', '/app/system/farms', 'fas fa-building', 'System.Farms'),
                new MenuItem('Account recovery', '/app/system/recovery', 'fas fa-user-shield', 'System.AccountRecovery'),
                new MenuItem('Reference data', '/app/system/reference', 'fas fa-sliders-h', 'System.ReferenceData'),
                new MenuItem('Security and error logs', '/app/system/logs', 'fas fa-clipboard-list', 'System.Logs'),
                new MenuItem('System health', '/app/system/health', 'fas fa-heartbeat', 'System.Health'),
            ].map((i) => this.inSection('System', i));
        }

        // Daily work first (production level), what the farm is made of last (farm level).
        // Sections with several pages show one item here; their pages are tabs across the top of the content.
        const production = 'Production level';
        const farm = 'Farm level';
        const canSell = this.permission.isGranted('Farm.Sales');
        return [
            new MenuItem('Dashboard', '/app/dashboard', 'fas fa-tachometer-alt', 'Farm.Dashboard'),
            this.inSection(production, this.sectionItem('operations', 'Operations', 'fas fa-clipboard-check')),
            this.inSection(production, this.sectionItem('production', 'Production', 'fas fa-seedling', '/app/production/batches')),
            this.inSection(production, this.sectionItem('harvest', canSell ? 'Harvest and sales' : 'Harvest', 'fas fa-shrimp')),
            this.inSection(production, new MenuItem('Reports', '/app/reports', 'fas fa-chart-line', 'Farm.Reports')),
            this.inSection(farm, new MenuItem('Ponds', '/app/ponds', 'fas fa-water', 'Farm.Ponds')),
            this.inSection(farm, this.sectionItem('resources', 'Resources', 'fas fa-boxes')),
            this.inSection(farm, this.sectionItem('farm', 'Farm', 'fas fa-home')),
        ];
    }

    /** One sidebar item for a section: it opens the first page the user may see and stays lit on every page of the section. */
    private sectionItem(key: string, label: string, icon: string, landing?: string): MenuItem {
        const section = SECTIONS.find((s) => s.key === key);
        const pages = leafTabs(section);
        const first = pages.find((t) => (!t.permission || this.permission.isGranted(t.permission)) && (!t.setting || !!this.appSession.tenant?.[t.setting])) ?? pages[0];
        const item = new MenuItem(label, landing && pages.some((t) => t.route === landing && (!t.permission || this.permission.isGranted(t.permission))) ? landing : first.route, icon);
        item.anyPermissions = pages.filter((t) => t.permission).map((t) => t.permission);
        item.matchPrefixes = section.prefixes;
        return item;
    }

    private inSection(section: string, item: MenuItem): MenuItem {
        item.section = section;
        return item;
    }

    /** Puts the section label on the first visible item of each section, so a hidden item never takes its label with it. */
    private markSectionHeadings(): void {
        let current: string | undefined;
        this.menuItems
            .filter((i) => this.isMenuItemVisible(i))
            .forEach((i) => {
                if (i.section && i.section !== current) {
                    i.heading = i.section;
                    current = i.section;
                }
            });
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
            const inPrefixes = item.matchPrefixes?.some((p) => url === p || url.startsWith(p + '/'));
            if (item.route && (item.route === url || url.startsWith(item.route + '/') || inPrefixes)) {
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
        if (item.anyPermissions) {
            return item.anyPermissions.some((p) => this.permission.isGranted(p));
        }
        if (item.children) {
            return item.children.some((c) => this.isMenuItemVisible(c));
        }

        if (!item.permissionName) {
            return true;
        }
        return this.permission.isGranted(item.permissionName);
    }
}
