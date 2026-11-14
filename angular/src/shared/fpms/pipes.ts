import { Pipe, PipeTransform } from '@angular/core';
import { FarmTime } from './farm-time';

@Pipe({ name: 'farmDateTime', standalone: true })
export class FarmDateTimePipe implements PipeTransform {
    transform(value?: string): string {
        return FarmTime.dateTime(value);
    }
}

@Pipe({ name: 'farmDate', standalone: true })
export class FarmDatePipe implements PipeTransform {
    transform(value?: string): string {
        return FarmTime.date(value);
    }
}

@Pipe({ name: 'farmDayOf', standalone: true })
export class FarmDayOfPipe implements PipeTransform {
    transform(value?: string): string {
        return FarmTime.localDateOf(value);
    }
}

/** Looks up an enum label: {{ status | label: BatchStatuses }} */
@Pipe({ name: 'label', standalone: true })
export class LabelPipe implements PipeTransform {
    transform(value: number | null | undefined, map: Record<number, string>): string {
        if (value === null || value === undefined) {
            return '';
        }
        return map[value] ?? String(value);
    }
}

/**
 * Number with fixed decimals and thousands separators; "—" when empty. With trim, trailing zeros are dropped
 * (24.500 reads 24.5): for a figure on its own, never in a column of figures, which keep one width.
 */
@Pipe({ name: 'num', standalone: true })
export class NumPipe implements PipeTransform {
    transform(value: number | null | undefined, decimals = 2, trim = false): string {
        if (value === null || value === undefined || isNaN(Number(value))) {
            return '—';
        }
        return Number(value).toLocaleString('en-PH', { minimumFractionDigits: trim ? 0 : decimals, maximumFractionDigits: decimals });
    }
}

@Pipe({ name: 'php', standalone: true })
export class PhpPipe implements PipeTransform {
    transform(value: number | null | undefined): string {
        if (value === null || value === undefined) {
            return '—';
        }
        return '₱' + Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

export const FPMS_PIPES = [FarmDateTimePipe, FarmDatePipe, FarmDayOfPipe, LabelPipe, NumPipe, PhpPipe];
