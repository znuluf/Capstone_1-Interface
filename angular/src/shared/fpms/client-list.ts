import { computed, signal } from '@angular/core';
import { ToolbarChip } from './ui';

/**
 * Search and chips for a list that is loaded whole and filtered in the browser (Hatcheries, Buyers, Users...).
 * Every typed word must appear in at least one of the row's search fields, in any case. Chip counts follow the
 * search, as on the server-paged lists, so the numbers always match what the chip would show.
 */
export class ClientListFilter<T> {
    readonly search = signal('');
    readonly chip = signal<unknown>(null);

    constructor(
        private readonly items: () => T[] | null,
        private readonly fields: (row: T) => (string | number | null | undefined)[],
        private readonly chipOf: (row: T) => unknown = () => null,
        private readonly chipDefs: { value: unknown; label: string }[] = [],
        private readonly allLabel = 'All',
        private readonly noun: [string, string] = ['row', 'rows']
    ) {}

    private readonly searched = computed<T[]>(() => {
        const words = this.search()
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w);
        const all = this.items() ?? [];
        if (!words.length) {
            return all;
        }
        return all.filter((row) => {
            const hay = this.fields(row).map((f) => String(f ?? '').toLowerCase());
            return words.every((w) => hay.some((h) => h.includes(w)));
        });
    });

    readonly visible = computed<T[]>(() => {
        const chip = this.chip();
        return chip === null ? this.searched() : this.searched().filter((row) => this.chipOf(row) === chip);
    });

    readonly chips = computed<ToolbarChip[]>(() => {
        if (!this.chipDefs.length) {
            return [];
        }
        const rows = this.searched();
        return [
            { value: null, label: this.allLabel, count: rows.length },
            ...this.chipDefs.map((d) => ({
                value: d.value,
                label: d.label,
                count: rows.filter((r) => this.chipOf(r) === d.value).length,
            })),
        ];
    });

    readonly resultText = computed(() => {
        const n = this.visible().length;
        return `${n} ${n === 1 ? this.noun[0] : this.noun[1]}`;
    });

    /** True when the list has rows but the search or chip hides all of them. */
    readonly noMatch = computed(() => (this.items()?.length ?? 0) > 0 && this.visible().length === 0);
}
