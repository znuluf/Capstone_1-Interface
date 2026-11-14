import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FarmTime } from '@shared/fpms/farm-time';
import { FPMS_IMPORTS } from '../shared-imports';

type FigureKey = 'doc' | 'abw' | 'fcr' | 'survival';

interface Figure {
    key: FigureKey;
    label: string;
    value: string;
    unit: string;
    warn: boolean;
    note: string;
}

/** One line of a figure's working: text, an optional link to the record it came from, and a muted note. */
interface WorkingLine {
    text: string;
    link?: any[];
    linkText?: string;
    strong?: boolean;
}

/** "1,234.5": fixed decimals, thousands separators; "—" when empty. */
function num(value: number | null | undefined, decimals: number): string {
    return value === null || value === undefined || isNaN(Number(value))
        ? '—'
        : Number(value).toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * A batch's four headline figures (day of culture, ABW, FCR, survival). Each is a button that opens how it is worked out,
 * from the records it came from, with a link to them (DEC-101). Used in the batch page's summary band and, compact, in
 * the Daily record for the figures at the end of a day. The formulas live on the server (IndicatorCalculator); this
 * only writes them out with the numbers the server used.
 */
@Component({
    selector: 'fpms-batch-figures',
    standalone: true,
    imports: FPMS_IMPORTS,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <dl class="fpms-figures" [class.fpms-figures-sm]="compact()">
            @for (f of figures(); track f.key) {
                <div class="fpms-figure" [class.warn]="f.warn">
                    <dt class="l">{{ f.label }}</dt>
                    <dd class="v">
                        <button
                            type="button"
                            class="fpms-figure-btn"
                            [attr.aria-expanded]="open() === f.key"
                            [attr.aria-controls]="panelId + f.key"
                            [title]="'How ' + labelOf(f.key) + ' is worked out'"
                            (click)="toggle(f.key)">
                            <span class="fpms-figure-num">{{ f.value }}</span>@if (f.unit) {<span class="u">{{ f.unit }}</span>}
                            @if (f.warn) { <i class="fas fa-exclamation-triangle ml-1" aria-hidden="true"></i> }
                            <i class="fas fa-chevron-down fpms-figure-chev" aria-hidden="true"></i>
                        </button>
                    </dd>
                    @if (f.note) { <dd class="s">{{ f.note }}</dd> }
                </div>
            }
        </dl>
        @if (open(); as key) {
            <section class="fpms-working" [id]="panelId + key" [attr.aria-label]="'How ' + labelOf(key) + ' is worked out'">
                <div class="fpms-working-head">
                    <h4>How {{ labelOf(key) }} is worked out</h4>
                    <button type="button" class="btn btn-sm btn-link" (click)="open.set(null)">Close</button>
                </div>
                @for (line of working(); track $index) {
                    <p [class.fpms-working-total]="line.strong">
                        {{ line.text }}
                        @if (line.link) { <a [routerLink]="line.link">{{ line.linkText }}</a> }
                    </p>
                }
            </section>
        }
    `,
})
export class BatchFiguresComponent {
    /** IndicatorsDto from Batch/Get or Batch/GetIndicatorsOn. */
    readonly indicators = input.required<any>();
    /** Closed batch: final FCR and survival rate instead of the running estimates. */
    readonly closed = input(false);
    readonly stockingDate = input<string | null>(null);
    /** Smaller figures, for the Daily record. */
    readonly compact = input(false);

    readonly open = signal<FigureKey | null>(null);
    readonly panelId = 'fw-' + Math.random().toString(36).slice(2, 8) + '-';

    readonly figures = computed<Figure[]>(() => {
        const i = this.indicators() ?? {};
        const closed = this.closed();
        const sv = closed ? i.survivalRatePct : i.estimatedSurvivalPct;
        return [
            { key: 'doc', label: 'Day of culture', value: i.doc != null ? String(i.doc) : '—', unit: '', warn: false, note: '' },
            { key: 'abw', label: 'ABW', value: num(i.currentAbwG, 2), unit: i.currentAbwG != null ? 'g' : '', warn: false, note: '' },
            { key: 'fcr', label: closed ? 'Final FCR' : 'FCR to date', value: num(closed ? i.finalFcr : i.fcrToDate, 2), unit: '', warn: false, note: '' },
            {
                key: 'survival',
                label: closed ? 'Survival rate' : 'Est. survival',
                value: num(sv, 1),
                unit: sv != null ? '%' : '',
                warn: sv > 100,
                note: sv > 100 ? 'Above 100%: open it to see why' : '',
            },
        ];
    });

    toggle(key: FigureKey): void {
        this.open.set(this.open() === key ? null : key);
    }

    /** The figure's name inside a sentence: "est. survival", "day of culture"; ABW and FCR keep their capitals. */
    labelOf(key: FigureKey): string {
        const label = this.figures().find((f) => f.key === key)?.label ?? '';
        return /^(ABW|FCR)/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
    }

    /** The working for the open figure, from the numbers the server used. */
    readonly working = computed<WorkingLine[]>(() => {
        const i = this.indicators() ?? {};
        const date = (d: string | null | undefined) => (d ? FarmTime.date(String(d).substring(0, 10)) : '');
        const asOf = i.asOf ? ` at the end of ${date(i.asOf)}` : '';
        switch (this.open()) {
            case 'doc': {
                const stocked = this.stockingDate();
                return stocked
                    ? [
                          { text: `Days since stocking on ${date(stocked)}, which is day 0.` },
                          { text: `Day of culture${asOf}: ${i.doc ?? '—'}.`, strong: true },
                      ]
                    : [{ text: 'No stocking date yet, so there is no day of culture.' }];
            }
            case 'abw':
                return this.abwWorking(i, date);
            case 'fcr':
                return this.fcrWorking(i);
            case 'survival':
                return this.survivalWorking(i, date);
            default:
                return [];
        }
    });

    private abwWorking(i: any, date: (d: string) => string): WorkingLine[] {
        if (i.abwSource === 'Harvest') {
            return [
                { text: `From the harvest on ${date(i.abwSourceDate)}, the most recent record with an ABW.`, link: ['/app/harvests', i.abwSourceId], linkText: 'Open the harvest' },
                { text: `ABW: ${num(i.currentAbwG, 2)} g.`, strong: true },
            ];
        }
        if (i.abwSource === 'Sample') {
            const lines: WorkingLine[] = [
                { text: `From the growth sample on ${date(i.abwSourceDate)}, the most recent one.`, link: ['/app/logbook', i.abwSourceId], linkText: 'Open the sample' },
            ];
            lines.push(
                i.abwSampleCount && i.abwSampleWeightG
                    ? { text: `${num(i.abwSampleWeightG, 0)} g weighed ÷ ${num(i.abwSampleCount, 0)} pieces = ${num(i.currentAbwG, 2)} g.`, strong: true }
                    : { text: `ABW as written on the sample: ${num(i.currentAbwG, 2)} g.`, strong: true }
            );
            return lines;
        }
        return [{ text: 'No growth sample or harvest with an ABW yet. Record a growth sample to get one.' }];
    }

    private fcrWorking(i: any): WorkingLine[] {
        if (this.closed()) {
            return [
                { text: `Feed fed: ${num(i.cumulativeFeedKg, 1)} kg. Harvested: ${num(i.totalHarvestKg, 1)} kg.` },
                { text: `${num(i.cumulativeFeedKg, 1)} ÷ ${num(i.totalHarvestKg, 1)} = ${num(i.finalFcr, 2)}.`, strong: true },
            ];
        }
        if (i.fcrToDate == null) {
            return [{ text: 'Needs feed fed and an estimated biomass (a growth sample with an ABW). One of them is missing.' }];
        }
        return [
            { text: `Feed fed to date: ${num(i.cumulativeFeedKg, 1)} kg.` },
            {
                text: `Est. biomass: ${num(i.estimatedPopulation, 0)} shrimp × ${num(i.latestSampleAbwG, 2)} g ÷ 1,000 = ${num(i.estimatedBiomassKg, 1)} kg. Harvested so far: ${num(i.totalHarvestKg, 1)} kg.`,
            },
            {
                text: `${num(i.cumulativeFeedKg, 1)} ÷ (${num(i.estimatedBiomassKg, 1)} + ${num(i.totalHarvestKg, 1)}) = ${num(i.fcrToDate, 2)}.`,
                strong: true,
            },
        ];
    }

    private survivalWorking(i: any, date: (d: string) => string): WorkingLine[] {
        if (!i.plCountStocked) {
            return [{ text: 'No stocking count, so survival cannot be worked out.' }];
        }
        if (this.closed()) {
            return [
                { text: `Pieces harvested: ${num(i.harvestedPieces, 0)}. PL stocked: ${num(i.plCountStocked, 0)}.` },
                { text: `${num(i.harvestedPieces, 0)} ÷ ${num(i.plCountStocked, 0)} = ${num(i.survivalRatePct, 1)}%.`, strong: true },
            ];
        }
        const lines: WorkingLine[] = [];
        if (i.populationBasis === 'Estimate') {
            const start = (i.plCountStocked * i.survivalEstimatePct) / 100;
            lines.push({
                text: `Starts from the survival estimate of ${num(i.survivalEstimatePct, 1)}% on the growth sample of ${date(i.survivalEstimateDate)}: ${num(i.plCountStocked, 0)} PL stocked × ${num(i.survivalEstimatePct, 1)}% = ${num(start, 0)}.`,
                link: ['/app/logbook', i.survivalEstimateLogId],
                linkText: 'Open the sample',
            });
            lines.push({
                text: `Less what was logged after that sample: ${num(i.mortalitySubtracted, 0)} dead and ${num(i.harvestedPiecesSubtracted, 0)} pieces harvested. Est. population: ${num(i.estimatedPopulation, 0)}.`,
            });
        } else {
            lines.push({
                text: `No survival estimate yet, so: ${num(i.plCountStocked, 0)} PL stocked − ${num(i.mortalitySubtracted, 0)} dead − ${num(i.harvestedPiecesSubtracted, 0)} pieces harvested = ${num(i.estimatedPopulation, 0)} est. population.`,
            });
        }
        lines.push({
            text: `(${num(i.estimatedPopulation, 0)} still in the pond + ${num(i.harvestedPieces, 0)} harvested) ÷ ${num(i.plCountStocked, 0)} PL stocked = ${num(i.estimatedSurvivalPct, 1)}%.`,
            strong: true,
        });
        if (i.estimatedSurvivalPct > 100) {
            lines.push({
                text:
                    i.populationBasis === 'Estimate'
                        ? 'More than were stocked: the survival estimate on that sample is likely too high, or the stocking count too low. Check the sample, then Stocking details.'
                        : 'More than were stocked: the stocking count is likely too low. Check Stocking details.',
            });
        }
        return lines;
    }
}
