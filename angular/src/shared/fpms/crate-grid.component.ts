import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FPMS_PIPES } from './pipes';
import { crateKg } from './crates';

/** One crate box: its number, net kilos and up to two short marks (its grade, and a key such as a receipt letter). */
export interface GridCrate {
    crateNo: number;
    kg: number;
    tareKg?: number | null;
    sizeLabel?: string | null;
    /** A one- or two-character key explained in the legend, e.g. "A" for the first dispatch receipt. */
    mark?: string | null;
}

/**
 * The crate tally as a grid of numbered boxes, like the farm's paper tally card (DEC-86): ten crates to a row, each box
 * holding the crate number small and the net kilos large, and a total at the end of each row so the sheet can be checked
 * by hand. Crate weights are subtracted and noted once under the grid instead of taking columns. With `blank` set it
 * prints that many empty numbered boxes, to write the weights in at the pond.
 *
 * Used by the harvest tally sheet, the dispatch receipt and the blank tally sheet, so all three read the same way.
 */
@Component({
    selector: 'fpms-crate-grid',
    standalone: true,
    imports: [CommonModule, ...FPMS_PIPES],
    template: `
        <table class="fpms-crate-grid" [class.is-blank]="blank > 0">
            <caption class="sr-only">{{ blank > 0 ? 'Blank crate tally' : 'Crate tally: crate number and net kilograms' }}</caption>
            <colgroup>
                @for (i of cols; track i) {
                    <col class="box" />
                }
                <col class="row-total" />
            </colgroup>
            <thead>
                <tr>
                    <th [attr.colspan]="perRow" scope="col" class="text-left">{{ heading }}</th>
                    <th scope="col" class="num">Row total</th>
                </tr>
            </thead>
            <tbody>
                @for (row of rows(); track $index) {
                    <tr>
                        @for (i of cols; track i) {
                            @if (row[i]; as c) {
                                <td class="box">
                                    <span class="no">{{ c.crateNo }}</span>
                                    <span class="kg">{{ blank > 0 ? '' : (c.kg | num: 2) }}</span>
                                    @if (c.sizeLabel || c.mark) {
                                        <span class="sub">
                                            <span>{{ c.sizeLabel }}</span>
                                            @if (c.mark) { <b>{{ c.mark }}</b> }
                                        </span>
                                    }
                                </td>
                            } @else {
                                <td class="box empty"></td>
                            }
                        }
                        <td class="num total">{{ blank > 0 ? '' : (rowKg(row) | num: 2) }}</td>
                    </tr>
                }
            </tbody>
            <tfoot>
                <tr>
                    @if (blank > 0) {
                        <td [attr.colspan]="perRow" class="text-left">
                            Total crates <span class="fill"></span>
                            Empty-crate weight each <span class="fill short"></span> kg
                        </td>
                        <td class="num"><span class="fill short"></span> kg</td>
                    } @else {
                        <td [attr.colspan]="perRow" class="text-left">
                            {{ crates.length }} crate{{ crates.length === 1 ? '' : 's' }}, net of the empty crate
                            @if (tareKg() > 0) { · {{ tareKg() | num: 2 }} kg of crate weight subtracted }
                        </td>
                        <td class="num">{{ totalKg() | num: 2 }} kg</td>
                    }
                </tr>
            </tfoot>
        </table>
        @if (legend.length) {
            <p class="fpms-crate-legend">
                @for (l of legend; track l.key) {
                    <span><b>{{ l.key }}</b> {{ l.label }}</span>
                }
            </p>
        }
        @if (gradeSummary && grades().length > 1) {
            <table class="fpms-doc-table fpms-crate-grades">
                <caption class="sr-only">Kilograms per size grade</caption>
                <thead><tr><th scope="col">Size grade</th><th scope="col" class="num">Crates</th><th scope="col" class="num">Kg</th></tr></thead>
                <tbody>
                    @for (g of grades(); track g.label) {
                        <tr><td>{{ g.label }}</td><td class="num">{{ g.crates }}</td><td class="num">{{ g.kg | num: 2 }}</td></tr>
                    }
                </tbody>
            </table>
        }
    `,
})
export class CrateGridComponent {
    @Input() crates: GridCrate[] = [];
    /** Boxes per row; ten makes a hundred crates fit ten rows that are easy to add up. */
    @Input() perRow = 10;
    /** Print this many empty numbered boxes instead of `crates`. */
    @Input() blank = 0;
    @Input() heading = 'Crate no. and net kg';
    /** Keys used in the boxes (for example the dispatch receipts on a split harvest) and what each means. */
    @Input() legend: { key: string; label: string }[] = [];
    /** A crates-and-kilos table per grade under the grid, when the crates were graded. */
    @Input() gradeSummary = false;

    get cols(): number[] {
        return Array.from({ length: this.perRow }, (_, i) => i);
    }

    rows(): (GridCrate | null)[][] {
        const list: GridCrate[] = this.blank > 0 ? Array.from({ length: this.blank }, (_, i) => ({ crateNo: i + 1, kg: 0 })) : (this.crates ?? []);
        const rows: (GridCrate | null)[][] = [];
        for (let i = 0; i < list.length; i += this.perRow) {
            rows.push(list.slice(i, i + this.perRow));
        }
        return rows;
    }

    rowKg(row: (GridCrate | null)[]): number {
        return crateKg(row.filter((c) => !!c));
    }

    totalKg(): number {
        return crateKg(this.crates);
    }

    tareKg(): number {
        return (this.crates ?? []).reduce((s, c) => s + (Number(c.tareKg) || 0), 0);
    }

    grades(): { label: string; crates: number; kg: number }[] {
        const map = new Map<string, { label: string; crates: number; kg: number }>();
        for (const c of this.crates ?? []) {
            const label = c.sizeLabel || 'Ungraded';
            const g = map.get(label) ?? { label, crates: 0, kg: 0 };
            g.crates++;
            g.kg = Math.round((g.kg + (Number(c.kg) || 0)) * 1000) / 1000;
            map.set(label, g);
        }
        return [...map.values()];
    }
}
