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
    /**
     * Pages grouped under this tab (DEC-85), shown as a second row while the tab is open. A tab with children shows when
     * the user may open at least one of them and links to the first of those; its own `route` is only its key.
     */
    children?: SectionTab[];
    /** The list call whose length shows as a count beside a grouped page's label (DEC-85 step 7). */
    count?: { service: string; method: string };
}

export interface Section {
    key: string;
    /** Name of the section in the sidebar and in the header breadcrumb. */
    label: string;
    tabs: SectionTab[];
    /** Every URL that starts with one of these belongs to the section, so detail pages keep its tab bar. */
    prefixes: string[];
    /**
     * The primary actions shown at the right of the tab bar, so a tab is always a place and never an action, and the
     * list pages need no create button of their own (DEC-85 step 7).
     */
    actions?: SectionAction[];
}

export interface SectionAction {
    label: string;
    route: string;
    icon: string;
    permission: string;
    /** The tab routes where the action shows. */
    onTabs: string[];
    /** True to show the action on the pages under those tabs too (a batch's page); otherwise only on the tab's own page. */
    onDetail?: boolean;
}

export const SECTIONS: Section[] = [
    {
        key: 'operations',
        label: 'Operations',
        prefixes: ['/app/logbook'],
        tabs: [
            { label: 'Feeding', route: '/app/logbook/feeding', permission: 'Farm.Logs' },
            // Kept as a tab, as before, at the owner's request (DEC-85 step 7).
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
        actions: [
            {
                label: 'Stock a batch',
                route: '/app/production/create-batch',
                icon: 'fas fa-shrimp',
                permission: 'Farm.Production.Stock',
                onTabs: ['/app/production/cycles', '/app/production/batches'],
                onDetail: true,
            },
        ],
    },
    {
        key: 'harvest',
        label: 'Harvest and sales',
        prefixes: ['/app/harvests', '/app/sales'],
        tabs: [
            { label: 'Harvests', route: '/app/harvests', permission: 'Farm.Harvests' },
            { label: 'Sales', route: '/app/sales', permission: 'Farm.Sales' },
            {
                // The lists set up once and used by every harvest and sale (DEC-85). Their routes are unchanged.
                label: 'Setup',
                route: '/app/harvests/size-grades',
                children: [
                    { label: 'Size grades', route: '/app/harvests/size-grades', permission: 'Farm.Harvests', count: { service: 'SizeGrade', method: 'GetAll' } },
                    { label: 'Crate types', route: '/app/harvests/crate-types', permission: 'Farm.Harvests', count: { service: 'ContainerType', method: 'GetAll' } },
                    { label: 'Price tables', route: '/app/sales/price-tables', permission: 'Farm.Sales', count: { service: 'PriceTable', method: 'GetAll' } },
                ],
            },
        ],
        actions: [
            { label: 'Record harvest', route: '/app/harvests/new', icon: 'fas fa-plus', permission: 'Farm.Harvests.Create', onTabs: ['/app/harvests'] },
            { label: 'Record sale', route: '/app/sales/new', icon: 'fas fa-plus', permission: 'Farm.Sales', onTabs: ['/app/sales'] },
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
 * opened from: the batch (Production), or with ?from=sales a dispatch receipt, ?from=harvests a harvest or tally sheet,
 * ?from=reports the Reports page. A lot trace (DEC-84) with no ?from belongs to Reports.
 */
export function effectiveUrl(url: string): string {
    const [path, query = ''] = (url || '').split('?');
    if (/^\/app\/reports\/trace(\/|$)/.test(path.split('#')[0])) {
        const from = /(?:^|&)from=([a-z]+)/.exec(query)?.[1];
        if (from === 'sales') return '/app/sales';
        if (from === 'harvests') return '/app/harvests';
        if (from === 'reports' || /^\/app\/reports\/trace\/lot\//.test(path)) return '/app/reports';
        return '/app/production/batches';
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

/** Every page of a section: its tabs, with a grouping tab replaced by the pages under it. */
export function leafTabs(section: Section): SectionTab[] {
    return section.tabs.flatMap((t) => (t.children?.length ? t.children : [t]));
}

/**
 * The tab that is open for a URL, and the page under it when the tab groups pages: the page with the longest route
 * that the URL starts with.
 */
export function activeTab(section: Section, url: string): { tab: SectionTab; child?: SectionTab } | undefined {
    const path = pathOf(url);
    let best: { tab: SectionTab; child?: SectionTab } | undefined;
    let bestLength = -1;
    for (const tab of section.tabs) {
        const pages = tab.children?.length ? tab.children.map((child) => ({ tab, child })) : [{ tab, child: undefined }];
        for (const page of pages) {
            const route = (page.child ?? page.tab).route;
            if (startsWithPath(path, route) && route.length > bestLength) {
                best = page;
                bestLength = route.length;
            }
        }
    }
    return best;
}

/** The route (key) of the tab that is open for a URL. */
export function activeTabRoute(section: Section, url: string): string | undefined {
    return activeTab(section, url)?.tab.route;
}
