import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

/**
 * Farm.Shrimp.io artwork, in one place.
 *
 * - "mark": the orange shrimp S on its own (sidebar, welcome bar). It has no background,
 *   so it sits on light or dark. Show the name next to it as text.
 * - "wordmark": the full Farm.Shrimp.io logo, for light backgrounds only (the blue and green of
 *   "Farm." and the navy ".io" disappear on dark ones).
 *
 * Leave `alt` empty when the name is already written next to the picture.
 * The images are bundled (assets/img/brand) because the farm network has no Internet.
 */
@Component({
    selector: 'fpms-logo',
    templateUrl: './fpms-logo.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
})
export class FpmsLogoComponent {
    @Input() variant: 'mark' | 'wordmark' = 'mark';
    @Input() alt = '';
}
