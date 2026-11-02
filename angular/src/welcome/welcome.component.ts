import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FpmsLogoComponent } from '@shared/fpms/fpms-logo.component';

/** Home page ("/") for visitors: one quiet screen with the headline, Create a farm account and Sign in. */
@Component({
    selector: 'fpms-welcome',
    templateUrl: './welcome.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [RouterLink, FpmsLogoComponent],
})
export class WelcomeComponent implements OnInit, OnDestroy {
    constructor(private renderer: Renderer2) {}

    ngOnInit(): void {
        // Reached from the sign-in page by client-side navigation, so clear its body classes.
        this.renderer.removeClass(document.body, 'login-page');
        this.renderer.removeClass(document.body, 'fpms-account');
        this.renderer.addClass(document.body, 'fpms-welcome-page');
    }

    ngOnDestroy(): void {
        this.renderer.removeClass(document.body, 'fpms-welcome-page');
    }
}
