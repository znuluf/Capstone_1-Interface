/**
 * The pages inside each sidebar section. The sidebar shows one item per section; the pages of the section
 * show as a tab bar across the top of the content (SectionTabsComponent). Routes and permission names are
 * the ones in app-routing.module.ts; this file only groups them.
 */
export interface SectionTab {
    label: string;
    route: string;
    /** The tab shows only when this permission is granted. No permission means everyone sees it. */
    permission?: string;
}

export interface Section {
    key: string;
    /** Name of the section in the sidebar and in the header breadcrumb. */
    label: string;
    tabs: SectionTab[];
    /** Every URL that starts with one of these belongs to the section, so detail pages keep its tab bar. */
    prefixes: string[];
    /** One primary action shown at the right of the tab bar while one of `onTabs` is open, so the tabs need no create button of their own. */
    action?: SectionAction;
}

export interface SectionAction {
    label: string;
    route: string;
    icon: string;
    permission: string;
    /** The tab routes where the action shows. */
    onTabs: string[];
}

export const SECTIONS: Section[] = [
    {
        key: 'operations',
        label: 'Operations',
        prefixes: ['/app/logbook'],
        tabs: [
            { label: 'Feeding (AM/PM)', route: '/app/logbook/feeding', permission: 'Farm.Logs' },
            { label: 'Record operations', route: '/app/logbook/new', permission: 'Farm.Logs.Create' },
            { label: 'Daily log status', route: '/app/logbook/status', permission: 'Farm.Logs' },
            { label: 'Logbooks', route: '/app/logbook', permission: 'Farm.Logs' },
            { label: 'Printable log sheets', route: '/app/logbook/sheets', permission: 'Farm.Logs' },
        ],
    },
    {
        key: 'production',
        label: 'Production',
        prefixes: ['/app/production'],
        tabs: [
            { label: 'Cycles', route: '/app/production/cycles', permission: 'Farm.Production' },
            { label: 'Batches', route: '/app/production/batches', permission: 'Farm.Production' },
        ],
        action: {
            label: 'Stock a batch',
            route: '/app/production/create-batch',
            icon: 'fas fa-shrimp',
            permission: 'Farm.Production.Stock',
            onTabs: ['/app/production/cycles', '/app/production/batches'],
        },
    },
    {
        key: 'harvest',
        label: 'Harvest and sales',
        prefixes: ['/app/harvests', '/app/sales'],
        tabs: [
            { label: 'Harvests', route: '/app/harvests', permission: 'Farm.Harvests' },
            { label: 'Sales', route: '/app/sales', permission: 'Farm.Sales' },
        ],
    },
    {
        key: 'resources',
        label: 'Resources',
        prefixes: ['/app/resources', '/app/inventory'],
        tabs: [
            { label: 'Hatchery sources', route: '/app/resources/hatcheries', permission: 'Farm.Hatcheries' },
            { label: 'Fry deliveries', route: '/app/resources/fry-deliveries', permission: 'Farm.FryDeliveries' },
            { label: 'Buyers', route: '/app/resources/buyers', permission: 'Farm.Buyers' },
            { label: 'Inventory', route: '/app/inventory', permission: 'Farm.Inventory' },
        ],
    },
    {
        key: 'farm',
        label: 'Farm',
        prefixes: ['/app/farm'],
        tabs: [
            { label: 'Profile', route: '/app/farm/profile', permission: 'Farm.Profile' },
            { label: 'Farm standards', route: '/app/farm/standards', permission: 'Farm.Profile' },
            { label: 'Users', route: '/app/farm/users', permission: 'Farm.Users' },
            { label: 'Permits and licenses', route: '/app/farm/documents', permission: 'Farm.Compliance' },
            { label: 'Activity log', route: '/app/farm/activity', permission: 'Farm.ActivityLog' },
        ],
    },
];

function startsWithPath(url: string, prefix: string): boolean {
    return url === prefix || url.startsWith(prefix + '/');
}

/**
 * The URL whose sidebar item, tab bar and breadcrumb a page should show. The trace report belongs to the page it was
 * opened from: the batch (Production) or, with ?from=sales, a dispatch receipt (Harvest and sales).
 */
export function effectiveUrl(url: string): string {
    const [path, query = ''] = (url || '').split('?');
    if (/^\/app\/reports\/trace(\/|$)/.test(path.split('#')[0])) {
        return /(^|&)from=sales(&|#|$)/.test(query) ? '/app/sales' : '/app/production/batches';
    }
    return url;
}

/** The URL without its query string or fragment. */
export function pathOf(url: string): string {
    return (url || '').split(/[?#]/)[0];
}

/** The section a URL belongs to, or undefined for single pages such as the dashboard, ponds and reports. */
export function sectionOfUrl(url: string): Section | undefined {
    const path = pathOf(url);
    return SECTIONS.find((s) => s.prefixes.some((p) => startsWithPath(path, p)));
}

/** The tab that is open for a URL: the tab with the longest route that the URL starts with. */
export function activeTabRoute(section: Section, url: string): string | undefined {
    const path = pathOf(url);
    let best: SectionTab | undefined;
    for (const tab of section.tabs) {
        if (startsWithPath(path, tab.route) && (!best || tab.route.length > best.route.length)) {
            best = tab;
        }
    }
    return best?.route;
}
