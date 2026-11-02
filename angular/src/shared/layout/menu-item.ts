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
    /** Other route prefixes that keep this item highlighted, for example every page of its section. */
    matchPrefixes?: string[];
    /** The item shows when any of these permissions is granted (used by items that open a section of pages). */
    anyPermissions?: string[];
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
