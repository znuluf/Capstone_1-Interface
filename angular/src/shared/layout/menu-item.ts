export class MenuItem {
    id: number;
    parentId: number;
    label: string;
    route: string;
    icon: string;
    permissionName: string;
    isActive?: boolean;
    isCollapsed?: boolean;
    /** Section this top-level item belongs to (shown as a small label above its first visible item). */
    section?: string;
    /** Set at runtime on the first visible item of each section. */
    heading?: string;
    children: MenuItem[];

    constructor(
        label: string,
        route: string,
        icon: string,
        permissionName: string = null,
        children: MenuItem[] = null
    ) {
        this.label = label;
        this.route = route;
        this.icon = icon;
        this.permissionName = permissionName;
        this.children = children;
    }
}
